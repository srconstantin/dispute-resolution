const { Pool } = require('pg');
const encryption = require('./utils/encryption');


// Railway automatically provides DATABASE_URL
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
});

const initDatabase = async () => {
  console.log('🚀 initDatabase() function called!');
  console.log('📁 Database URL:', process.env.DATABASE_URL ? 'Connected' : 'Missing');
  
  try {
    // Create users table
    await pool.query(`
      CREATE TABLE IF NOT EXISTS users (
        id SERIAL PRIMARY KEY,
       name_encrypted TEXT NOT NULL,
        email_encrypted TEXT NOT NULL,
        email_hash TEXT UNIQUE NOT NULL,
        password TEXT NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT unique_email_hash UNIQUE (email_hash)
      )
    `);
    console.log('✅ Users table created/verified with encryption');

    // Create contacts table with encrypted emails
    await pool.query(`
      CREATE TABLE IF NOT EXISTS contacts (
        id SERIAL PRIMARY KEY,
        requester_id INTEGER NOT NULL,
        recipient_id INTEGER,
        recipient_email_encrypted TEXT NOT NULL,
        recipient_email_hash TEXT NOT NULL,
        status TEXT NOT NULL DEFAULT 'pending',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (requester_id) REFERENCES users (id),
        FOREIGN KEY (recipient_id) REFERENCES users (id)
      )
    `);
    console.log('✅ Contacts table created/verified with encryption');

    // Create disputes table with encrypted titles
    await pool.query(`
      CREATE TABLE IF NOT EXISTS disputes (
        id SERIAL PRIMARY KEY,
        title_encrypted TEXT NOT NULL,
        creator_id INTEGER NOT NULL,
        status TEXT NOT NULL DEFAULT 'ongoing',
        verdict_encrypted TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (creator_id) REFERENCES users (id)
      )
    `);
    console.log('✅ Disputes table created/verified with encryption');

    // Create dispute_participants table with encrypted response text
    await pool.query(`
      CREATE TABLE IF NOT EXISTS dispute_participants (
        id SERIAL PRIMARY KEY,
        dispute_id INTEGER NOT NULL,
        user_id INTEGER NOT NULL,
        status TEXT NOT NULL DEFAULT 'invited',
        response_text_encrypted TEXT,
        joined_at TIMESTAMP,
        response_submitted_at TIMESTAMP,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (dispute_id) REFERENCES disputes (id),
        FOREIGN KEY (user_id) REFERENCES users (id),
        UNIQUE(dispute_id, user_id)
      )
    `);
    console.log('✅ Dispute_participants table created/verified with encryption');
    
  } catch (error) {
    console.error('❌ Error creating tables:', error);
  }
};

const createUser = async (userData, callback) => {
  const { name, email, password } = userData;
  
  try {
    const nameEncrypted = encryption.encryptName(name);
    const emailEncrypted = encryption.encryptEmail(email);
    const emailHash = encryption.hashForSearch(email);
    
    const result = await pool.query(
      'INSERT INTO users (name_encrypted, email_encrypted, email_hash, password) VALUES ($1, $2, $3, $4) RETURNING id',
      [nameEncrypted, emailEncrypted, emailHash, password]
    );
    callback(null, {
      id: result.rows[0].id,
      name: name,
      email: email
    });
  } catch (err) {
    callback(err, null);
  }
};

const getUserByEmail = async (email, callback) => {
  try {
    console.log('🔍 Looking for user with email (encrypted lookup):', email);
    const emailHash = encryption.hashForSearch(email);
    
    const result = await pool.query('SELECT * FROM users WHERE email_hash = $1', [emailHash]);
    const user = result.rows[0];

   if (user) {
      // Decrypt sensitive fields for application use
      const decryptedUser = {
        ...user,
        name: encryption.decrypt(user.name_encrypted),
        email: encryption.decrypt(user.email_encrypted)
      };
      
      // Remove encrypted fields from response
      delete decryptedUser.name_encrypted;
      delete decryptedUser.email_encrypted;
      delete decryptedUser.email_hash;
      
      console.log('🔍 User found and decrypted');
      callback(null, decryptedUser);
    } else {
      console.log('🔍 User not found');
      callback(null, null);
    }
  } catch (err) {
    console.error('❌ Error in getUserByEmail:', err);
    callback(err, null);
  }
};

const createDispute = async (disputeData, callback) => {
  const { title, creator_id, participant_ids } = disputeData;

  const client = await pool.connect();
  
  try {
    await client.query('BEGIN');

    // Encrypt the dispute title
    const titleEncrypted = encryption.encryptText(title);
    
    // Create dispute
    const disputeResult = await client.query(
      'INSERT INTO disputes(title_encrypted, creator_id, status) VALUES ($1, $2, $3) RETURNING id',
      [titleEncrypted, creator_id, 'ongoing']
    );
    const dispute_id = disputeResult.rows[0].id;

    // Add creator as accepted participant
    await client.query(
      'INSERT INTO dispute_participants (dispute_id, user_id, status, joined_at) VALUES ($1, $2, $3, CURRENT_TIMESTAMP)',
      [dispute_id, creator_id, 'accepted']
    );

    // Add other participants as invited
    if (participant_ids && participant_ids.length > 0) {
      for (const user_id of participant_ids) {
        await client.query(
          'INSERT INTO dispute_participants (dispute_id, user_id, status) VALUES ($1, $2, $3)',
          [dispute_id, user_id, 'invited']
        );
      }
    }

    await client.query('COMMIT');
    callback(null, {id: dispute_id, title, creator_id, status: 'ongoing'});
  } catch (err) {
    await client.query('ROLLBACK');
    callback(err, null);
  } finally {
    client.release();
  }
};

const getDisputesByUser = async (user_id, callback) => {
  try {
    const result = await pool.query(`
      SELECT DISTINCT 
        d.id,
        d.title_encrypted,
        d.creator_id,
        d.status,
        d.verdict_encrypted,
        d.created_at,
        u.name_encrypted as creator_name_encrypted,
        dp.status as user_participation_status
      FROM disputes d
      JOIN users u ON d.creator_id = u.id 
      JOIN dispute_participants dp ON d.id = dp.dispute_id
      WHERE dp.user_id = $1
      ORDER BY d.created_at DESC
    `, [user_id]);

    // Decrypt the results
    const decryptedDisputes = result.rows.map(row => ({
      id: row.id,
      title: encryption.decrypt(row.title_encrypted),
      creator_id: row.creator_id,
      status: row.status,
      verdict: row.verdict_encrypted ? encryption.decrypt(row.verdict_encrypted) : null,
      created_at: row.created_at,
      creator_name: encryption.decrypt(row.creator_name_encrypted),
      user_participation_status: row.user_participation_status
    }));
    
    callback(null, decryptedDisputes);
  } catch (err) {
    callback(err, null);
  }
};

const getDisputeById = async (dispute_id, callback) => {
  try {
    const disputeResult = await pool.query(`
      SELECT
        d.id,
        d.title_encrypted,
        d.creator_id,
        d.status,
        d.verdict_encrypted,
        d.created_at,
        u.name_encrypted as creator_name_encrypted,
        u.email_encrypted as creator_email_encrypted
      FROM disputes d
      JOIN users u on d.creator_id = u.id 
      WHERE d.id = $1
    `, [dispute_id]);
    
    const dispute = disputeResult.rows[0];
    
    if (!dispute) {
      callback(null, null);
      return;
    }
    // Decrypt dispute data
    const decryptedDispute = {
      id: dispute.id,
      title: encryption.decrypt(dispute.title_encrypted),
      creator_id: dispute.creator_id,
      status: dispute.status,
      verdict: dispute.verdict_encrypted ? encryption.decrypt(dispute.verdict_encrypted) : null,
      created_at: dispute.created_at,
      creator_name: encryption.decrypt(dispute.creator_name_encrypted),
      creator_email: encryption.decrypt(dispute.creator_email_encrypted)
    };
    
    const participantsResult = await pool.query(`
      SELECT
        dp.user_id,
        dp.status,
        dp.response_text_encrypted,
        dp.joined_at,
        dp.response_submitted_at,
        u.name_encrypted,
        u.email_encrypted 
      FROM dispute_participants dp 
      JOIN users u ON dp.user_id = u.id 
      WHERE dp.dispute_id = $1 
      ORDER BY dp.created_at ASC
    `, [dispute_id]);
    
    // Decrypt participant data
    decryptedDispute.participants = participantsResult.rows.map(row => ({
      user_id: row.user_id,
      status: row.status,
      response_text: row.response_text_encrypted ? encryption.decrypt(row.response_text_encrypted) : null,
      joined_at: row.joined_at,
      response_submitted_at: row.response_submitted_at,
      name: encryption.decrypt(row.name_encrypted),
      email: encryption.decrypt(row.email_encrypted)
    }));

    callback(null, decryptedDispute);
  } catch (err) {
    callback(err, null);
  }
};

const updateParticipantStatus = async (dispute_id, user_id, status, callback) => {
  const client = await pool.connect();
  
  try {
    await client.query('BEGIN');
    
    // Update participant status
    const result = await client.query(`
      UPDATE dispute_participants 
      SET status = $1, joined_at = CASE WHEN $1 = 'accepted' THEN CURRENT_TIMESTAMP ELSE joined_at END, updated_at = CURRENT_TIMESTAMP
      WHERE dispute_id = $2 AND user_id = $3
    `, [status, dispute_id, user_id]);
    
    if (result.rowCount === 0) {
      throw new Error('Participant not found');
    }
    
    // If someone rejected, mark the entire dispute as rejected
    if (status === 'rejected') {
      await client.query(`
        UPDATE disputes 
        SET status = 'rejected', updated_at = CURRENT_TIMESTAMP 
        WHERE id = $1
      `, [dispute_id]);
    }
    
    await client.query('COMMIT');
    callback(null, { dispute_id, user_id, status });
  } catch (err) {
    await client.query('ROLLBACK');
    callback(err, null);
  } finally {
    client.release();
  }
};

const submitDisputeResponse = async (dispute_id, user_id, response_text, callback) => {
  const client = await pool.connect();
  
  try {
    await client.query('BEGIN');

    // Encrypt the response text before storing
    const responseTextEncrypted = encryption.encryptText(response_text);
    
    // Update participant response
    const result = await client.query(`
      UPDATE dispute_participants 
      SET response_text_encrypted = $1, response_submitted_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP
      WHERE dispute_id = $2 AND user_id = $3 AND status = 'accepted'
    `, [responseTextEncrypted, dispute_id, user_id]);
    
    if (result.rowCount === 0) {
      throw new Error('Participant not found or not accepted');
    }
    
    // Check if all accepted participants have submitted responses
    const checkResult = await client.query(`
      SELECT 
        COUNT(*) as total_participants,
        SUM(CASE WHEN status = 'rejected' THEN 1 ELSE 0 END) as rejected_count,
        SUM(CASE WHEN status = 'accepted' AND response_text_encrypted IS NOT NULL THEN 1 ELSE 0 END) as responded_count,
        SUM(CASE WHEN status = 'accepted' AND response_text_encrypted IS NULL THEN 1 ELSE 0 END) as accepted_not_responded,
        SUM(CASE WHEN status = 'invited' THEN 1 ELSE 0 END) as still_invited
      FROM dispute_participants 
      WHERE dispute_id = $1
    `, [dispute_id]);
    
    const checkData = checkResult.rows[0];
    const allInvitationsResolved = parseInt(checkData.still_invited) === 0;
    const allAcceptedHaveResponded = parseInt(checkData.accepted_not_responded) === 0;
    
    if (allInvitationsResolved && allAcceptedHaveResponded && parseInt(checkData.responded_count) > 0) {
      await client.query(`
        UPDATE disputes 
        SET status = 'completed', updated_at = CURRENT_TIMESTAMP 
        WHERE id = $1
      `, [dispute_id]);
      
      await client.query('COMMIT');
      callback(null, { dispute_id, user_id, response_text, completed: true });
    } else {
      await client.query('COMMIT');
      callback(null, { dispute_id, user_id, response_text, completed: false });
    }
  } catch (err) {
    await client.query('ROLLBACK');
    callback(err, null);
  } finally {
    client.release();
  }
};

const updateDisputeVerdict = async (dispute_id, verdict, callback) => {
  try {
    // Encrypt the verdict before storing
    const verdictEncrypted = encryption.encryptText(verdict);

    const result = await pool.query(`
      UPDATE disputes 
      SET verdict_encrypted = $1, updated_at = CURRENT_TIMESTAMP 
      WHERE id = $2
    `, [verdictEncrypted, dispute_id]);
    
    callback(null, { dispute_id, verdict, updated: result.rowCount > 0 });
  } catch (err) {
    callback(err, null);
  }
};

const createContactRequest = async (requesterEmail, recipientEmail, callback) => {
  try {

    console.log('📞 Creating encrypted contact request');
    // Get the requester using email hash
    const requesterEmailHash = encryption.hashForSearch(requesterEmail);
    const requesterResult = await pool.query('SELECT * FROM users WHERE email_hash = $1', [requesterEmail]);
    const requester = requesterResult.rows[0];
    
    if (!requester) {
      return callback(new Error('Requester not found'), null);
    }

    // Check if recipient exists using email hash
    const recipientEmailHash = encryption.hashForSearch(recipientEmail);
    const recipientResult = await pool.query('SELECT * FROM users WHERE email_hash = $1', [recipientEmailHash]);
    const recipient = recipientResult.rows[0];

    // Encrypt recipient email
    const recipientEmailEncrypted = encryption.encryptEmail(recipientEmail);
    
    const insertResult = await pool.query(`
      INSERT INTO contacts (requester_id, recipient_id, recipient_email_encrypted, recipient_email_hash, status) 
      VALUES ($1, $2, $3, $4, 'pending') RETURNING id
    `, [requester.id, recipient ? recipient.id : null, recipientEmailEncrypted, recipientEmailHash]);
    
    callback(null, { 
      id: insertResult.rows[0].id, 
      requesterEmail, 
      recipientEmail,
      recipientExists: !!recipient,
      status: 'pending'
    });
  } catch (err) {
    callback(err, null);
  }
};

const getUserContacts = async (userEmail, callback) => {
  try {
    const userEmailHash = encryption.hashForSearch(userEmail);
    const userResult = await pool.query('SELECT * FROM users WHERE email_hash = $1', [userEmailHash]);
    const user = userResult.rows[0];
    
    if (!user) {
      return callback(new Error('User not found'), null);
    }

    // Get accepted contacts
    const contactsResult = await pool.query(`
      SELECT 
        c.id,
        c.status,
        c.created_at,
        CASE 
          WHEN c.requester_id = $1 THEN ru.name_encrypted 
          ELSE rq.name_encrypted 
        END as contact_name_encrypted,
        CASE 
          WHEN c.requester_id = $1 THEN ru.email_encrypted 
          ELSE rq.email_encrypted 
        END as contact_email_encrypted
      FROM contacts c
      LEFT JOIN users rq ON c.requester_id = rq.id
      LEFT JOIN users ru ON c.recipient_id = ru.id
      WHERE (c.requester_id = $1 OR c.recipient_id = $1) 
        AND c.status = 'accepted'
    `, [user.id]);
    

       // Decrypt contacts
    const contacts = contactsResult.rows.map(row => ({
      id: row.id,
      status: row.status,
      created_at: row.created_at,
      contact_name: encryption.decrypt(row.contact_name_encrypted),
      contact_email: encryption.decrypt(row.contact_email_encrypted)
    }));


    // Get pending requests
    const pendingResult = await pool.query(`
      SELECT 
        c.id,
        c.status,
        c.created_at,
        rq.name_encrypted as requester_name_encrypted,
        rq.email_encrypted as requester_email_encrypted
      FROM contacts c
      JOIN users rq ON c.requester_id = rq.id
      WHERE c.recipient_id = $1 AND c.status = 'pending'
    `, [user.id]);


    // Decrypt pending requests
    const pendingRequests = pendingResult.rows.map(row => ({
      id: row.id,
      status: row.status,
      created_at: row.created_at,
      requester_name: encryption.decrypt(row.requester_name_encrypted),
      requester_email: encryption.decrypt(row.requester_email_encrypted)
    }));
        
    callback(null, { contacts, pendingRequests });
  } catch (err) {
    callback(err, null);
  }
};

const updateContactRequest = async (requestId, status, callback) => {
  try {
    const result = await pool.query(`
      UPDATE contacts 
      SET status = $1, updated_at = CURRENT_TIMESTAMP 
      WHERE id = $2
    `, [status, requestId]);
    
    callback(null, { id: requestId, status, updated: result.rowCount > 0 });
  } catch (err) {
    callback(err, null);
  }
};

const { generateVerdict } = require('./services/claude');


const checkAndGenerateVerdict = async (disputeId, callback) => {
  try {
    // First, check if all participants have submitted responses
    const checkResult = await pool.query(`
      SELECT 
        COUNT(*) as total_participants,
        SUM(CASE WHEN status = 'accepted' AND response_text_encrypted IS NOT NULL THEN 1 ELSE 0 END) as responded_count,
        SUM(CASE WHEN status = 'accepted' AND response_text_encrypted IS NULL THEN 1 ELSE 0 END) as accepted_not_responded,
        SUM(CASE WHEN status = 'invited' THEN 1 ELSE 0 END) as still_invited
      FROM dispute_participants 
      WHERE dispute_id = $1
    `, [disputeId]);
    
    const checkData = checkResult.rows[0];
    const allInvitationsResolved = parseInt(checkData.still_invited) === 0;
    const allAcceptedHaveResponded = parseInt(checkData.accepted_not_responded) === 0;
    
    if (allInvitationsResolved && allAcceptedHaveResponded && parseInt(checkData.responded_count) > 0) {
      // Get dispute data for Claude
      const disputeData = await pool.query(`
        SELECT 
          d.id,
          d.title_encrypted,
          d.status,
          d.created_at,
          u.name_encrypted as creator_name_encrypted
        FROM disputes d
        JOIN users u ON d.creator_id = u.id
        WHERE d.id = $1
      `, [disputeId]);
      
      if (disputeData.rows.length === 0) {
        return callback(new Error('Dispute not found'), null);
      }
      
      // Get all participant responses
      const participantsData = await pool.query(`
        SELECT 
          dp.response_text_encrypted,
          u.name_encrypted
        FROM dispute_participants dp
        JOIN users u ON dp.user_id = u.id
        WHERE dp.dispute_id = $1 AND dp.status = 'accepted' AND dp.response_text_encrypted IS NOT NULL
      `, [disputeId]);
      
      // Decrypt data for Claude
      const dispute = disputeData.rows[0];
      const decryptedDisputeData = {
        id: dispute.id,
        title: encryption.decrypt(dispute.title_encrypted),
        creator_name: encryption.decrypt(dispute.creator_name_encrypted),
        participants: participantsData.rows.map(row => ({
          name: encryption.decrypt(row.name_encrypted),
          response: encryption.decrypt(row.response_text_encrypted)
        }))
      };
      
      // Generate verdict using Claude
      const verdict = await generateVerdict(decryptedDisputeData);
      
      // Encrypt and save verdict to database
      const verdictEncrypted = encryption.encryptText(verdict);
      const result = await pool.query(`
        UPDATE disputes 
        SET verdict_encrypted = $1, status = 'resolved' 
        WHERE id = $2
      `, [verdictEncrypted, disputeId]); // <-- Fixed: use verdict_encrypted
      
      callback(null, { disputeId, verdict, updated: result.rowCount > 0 });
    } else {
      callback(null, { disputeId, verdict: null, updated: false, message: 'Not all participants have responded' });
    }
  } catch (err) {
    callback(err, null);
  }
};

module.exports = {
  initDatabase,
  createUser,
  getUserByEmail,
  createContactRequest,
  getUserContacts,
  updateContactRequest,
  createDispute,
  getDisputesByUser,
  getDisputeById,
  updateParticipantStatus,
  submitDisputeResponse,
  updateDisputeVerdict,
  checkAndGenerateVerdict
};