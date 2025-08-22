const { Pool } = require('pg');

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
        name TEXT NOT NULL,
        email TEXT UNIQUE NOT NULL,
        password TEXT NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);
    console.log('✅ Users table created/verified');

    // Create contacts table 
    await pool.query(`
      CREATE TABLE IF NOT EXISTS contacts (
        id SERIAL PRIMARY KEY,
        requester_id INTEGER NOT NULL,
        recipient_id INTEGER,
        recipient_email TEXT NOT NULL,
        status TEXT NOT NULL DEFAULT 'pending',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (requester_id) REFERENCES users (id),
        FOREIGN KEY (recipient_id) REFERENCES users (id)
      )
    `);
    console.log('✅ Contacts table created/verified');

    // Create disputes table
    await pool.query(`
      CREATE TABLE IF NOT EXISTS disputes (
        id SERIAL PRIMARY KEY,
        title TEXT NOT NULL,
        creator_id INTEGER NOT NULL,
        status TEXT NOT NULL DEFAULT 'ongoing',
        verdict TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (creator_id) REFERENCES users (id)
      )
    `);
    console.log('✅ Disputes table created/verified');

    // Create dispute_participants table
    await pool.query(`
      CREATE TABLE IF NOT EXISTS dispute_participants (
        id SERIAL PRIMARY KEY,
        dispute_id INTEGER NOT NULL,
        user_id INTEGER NOT NULL,
        status TEXT NOT NULL DEFAULT 'invited',
        response_text TEXT,
        joined_at TIMESTAMP,
        response_submitted_at TIMESTAMP,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (dispute_id) REFERENCES disputes (id),
        FOREIGN KEY (user_id) REFERENCES users (id),
        UNIQUE(dispute_id, user_id)
      )
    `);
    console.log('✅ Dispute_participants table created/verified');
    
  } catch (error) {
    console.error('❌ Error creating tables:', error);
  }
};

const createUser = async (userData, callback) => {
  const { name, email, password } = userData;
  
  try {
    const result = await pool.query(
      'INSERT INTO users (name, email, password) VALUES ($1, $2, $3) RETURNING id, name, email',
      [name, email, password]
    );
    callback(null, result.rows[0]);
  } catch (err) {
    callback(err, null);
  }
};

const getUserByEmail = async (email, callback) => {
  try {
    console.log('🔍 Looking for user with email:', email);
    const result = await pool.query('SELECT * FROM users WHERE email = $1', [email]);
    const user = result.rows[0];
    console.log('🔍 getUserByEmail result:', user ? 'FOUND' : 'NOT FOUND');
    callback(null, user);
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
    
    // Create dispute
    const disputeResult = await client.query(
      'INSERT INTO disputes(title, creator_id, status) VALUES ($1, $2, $3) RETURNING id',
      [title, creator_id, 'ongoing']
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
        d.title,
        d.creator_id,
        d.status,
        d.verdict,
        d.created_at,
        u.name as creator_name,
        dp.status as user_participation_status
      FROM disputes d
      JOIN users u ON d.creator_id = u.id 
      JOIN dispute_participants dp ON d.id = dp.dispute_id
      WHERE dp.user_id = $1
      ORDER BY d.created_at DESC
    `, [user_id]);
    
    callback(null, result.rows);
  } catch (err) {
    callback(err, null);
  }
};

const getDisputeById = async (dispute_id, callback) => {
  try {
    const disputeResult = await pool.query(`
      SELECT
        d.id,
        d.title,
        d.creator_id,
        d.status,
        d.verdict,
        d.created_at,
        u.name as creator_name,
        u.email as creator_email
      FROM disputes d
      JOIN users u on d.creator_id = u.id 
      WHERE d.id = $1
    `, [dispute_id]);
    
    const dispute = disputeResult.rows[0];
    
    if (!dispute) {
      callback(null, null);
      return;
    }
    
    const participantsResult = await pool.query(`
      SELECT
        dp.user_id,
        dp.status,
        dp.response_text,
        dp.joined_at,
        dp.response_submitted_at,
        u.name,
        u.email 
      FROM dispute_participants dp 
      JOIN users u ON dp.user_id = u.id 
      WHERE dp.dispute_id = $1 
      ORDER BY dp.created_at ASC
    `, [dispute_id]);
    
    dispute.participants = participantsResult.rows;
    callback(null, dispute);
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
    
    // Update participant response
    const result = await client.query(`
      UPDATE dispute_participants 
      SET response_text = $1, response_submitted_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP
      WHERE dispute_id = $2 AND user_id = $3 AND status = 'accepted'
    `, [response_text, dispute_id, user_id]);
    
    if (result.rowCount === 0) {
      throw new Error('Participant not found or not accepted');
    }
    
    // Check if all accepted participants have submitted responses
    const checkResult = await client.query(`
      SELECT 
        COUNT(*) as total_participants,
        SUM(CASE WHEN status = 'rejected' THEN 1 ELSE 0 END) as rejected_count,
        SUM(CASE WHEN status = 'accepted' AND response_text IS NOT NULL THEN 1 ELSE 0 END) as responded_count,
        SUM(CASE WHEN status = 'accepted' AND response_text IS NULL THEN 1 ELSE 0 END) as accepted_not_responded,
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
    const result = await pool.query(`
      UPDATE disputes 
      SET verdict = $1, updated_at = CURRENT_TIMESTAMP 
      WHERE id = $2
    `, [verdict, dispute_id]);
    
    callback(null, { dispute_id, verdict, updated: result.rowCount > 0 });
  } catch (err) {
    callback(err, null);
  }
};

const createContactRequest = async (requesterEmail, recipientEmail, callback) => {
  try {
    // Get the requester
    const requesterResult = await pool.query('SELECT * FROM users WHERE email = $1', [requesterEmail]);
    const requester = requesterResult.rows[0];
    
    if (!requester) {
      return callback(new Error('Requester not found'), null);
    }

    // Check if recipient exists
    const recipientResult = await pool.query('SELECT * FROM users WHERE email = $1', [recipientEmail]);
    const recipient = recipientResult.rows[0];
    
    const insertResult = await pool.query(`
      INSERT INTO contacts (requester_id, recipient_id, recipient_email, status) 
      VALUES ($1, $2, $3, 'pending') RETURNING id
    `, [requester.id, recipient ? recipient.id : null, recipientEmail]);
    
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
    const userResult = await pool.query('SELECT * FROM users WHERE email = $1', [userEmail]);
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
          WHEN c.requester_id = $1 THEN ru.name 
          ELSE rq.name 
        END as contact_name,
        CASE 
          WHEN c.requester_id = $1 THEN ru.email 
          ELSE rq.email 
        END as contact_email
      FROM contacts c
      LEFT JOIN users rq ON c.requester_id = rq.id
      LEFT JOIN users ru ON c.recipient_id = ru.id
      WHERE (c.requester_id = $1 OR c.recipient_id = $1) 
        AND c.status = 'accepted'
    `, [user.id]);
    
    const contacts = contactsResult.rows;

    // Get pending requests
    const pendingResult = await pool.query(`
      SELECT 
        c.id,
        c.status,
        c.created_at,
        rq.name as requester_name,
        rq.email as requester_email
      FROM contacts c
      JOIN users rq ON c.requester_id = rq.id
      WHERE c.recipient_id = $1 AND c.status = 'pending'
    `, [user.id]);
    
    const pendingRequests = pendingResult.rows;
    
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
    // 1. Check if all participants have submitted
    const allSubmitted = await checkAllParticipantsSubmitted(disputeId);
    
    if (allSubmitted) {
      // 2. Get dispute data
      const disputeData = await getDisputeData(disputeId);
      
      // 3. Generate verdict using Claude
      const verdict = await generateVerdict(disputeData);
      
      // 4. Save verdict to database
      const result = await pool.query(`UPDATE disputes SET verdict = $1, status = 'resolved' WHERE id = $2`, [verdict, disputeId]);
      
      callback(null, { disputeId, verdict, updated: result.rowCount > 0 });
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