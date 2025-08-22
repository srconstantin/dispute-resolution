const Database = require('better-sqlite3');
const path = require('path');

const dbPath = path.join(__dirname, 'database.sqlite');
const db = new Database(dbPath);

const initDatabase = () => {
  console.log('🚀 initDatabase() function called!');
  console.log('📁 Database path:', dbPath);
  
  try {
    // Create users table
    db.exec(`
      CREATE TABLE IF NOT EXISTS users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        email TEXT UNIQUE NOT NULL,
        password TEXT NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);
    console.log('✅ Users table created/verified');

    // Create contacts table 
    db.exec(`
      CREATE TABLE IF NOT EXISTS contacts (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        requester_id INTEGER NOT NULL,
        recipient_id INTEGER,
        recipient_email TEXT NOT NULL,
        status TEXT NOT NULL DEFAULT 'pending',
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (requester_id) REFERENCES users (id),
        FOREIGN KEY (recipient_id) REFERENCES users (id)
      )
    `);
    console.log('✅ Contacts table created/verified');

    // Create disputes table
    db.exec(`
      CREATE TABLE IF NOT EXISTS disputes (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        title TEXT NOT NULL,
        creator_id INTEGER NOT NULL,
        status TEXT NOT NULL DEFAULT 'ongoing',
        verdict TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (creator_id) REFERENCES users (id)
      )
    `);
    console.log('✅ Disputes table created/verified');

    // Create dispute_participants table
    db.exec(`
      CREATE TABLE IF NOT EXISTS dispute_participants (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        dispute_id INTEGER NOT NULL,
        user_id INTEGER NOT NULL,
        status TEXT NOT NULL DEFAULT 'invited',
        response_text TEXT,
        joined_at DATETIME,
        response_submitted_at DATETIME,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
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

const createUser = (userData, callback) => {
  const { name, email, password } = userData;
  
  try {
    const stmt = db.prepare(`
      INSERT INTO users (name, email, password) 
      VALUES (?, ?, ?)
    `);
    
    const result = stmt.run(name, email, password);
    callback(null, { id: result.lastInsertRowid, name, email });
  } catch (err) {
    callback(err, null);
  }
};

const getUserByEmail = (email, callback) => {
  try {
    console.log('🔍 Looking for user with email:', email);
    const stmt = db.prepare('SELECT * FROM users WHERE email = ?');
    const user = stmt.get(email);
    console.log('🔍 getUserByEmail result:', user ? 'FOUND' : 'NOT FOUND');
    callback(null, user);
  } catch (err) {
    console.error('❌ Error in getUserByEmail:', err);
    callback(err, null);
  }
};

const createDispute = (disputeData, callback) => {
  const { title, creator_id, participant_ids } = disputeData;

  try {
    db.transaction(() => {
      // Create dispute
      const disputeStmt = db.prepare(`
        INSERT INTO disputes(title, creator_id, status)
        VALUES (?, ?, 'ongoing')
      `);
      const disputeResult = disputeStmt.run(title, creator_id);
      const dispute_id = disputeResult.lastInsertRowid;

      // Add creator as accepted participant
      const creatorStmt = db.prepare(`
        INSERT INTO dispute_participants (dispute_id, user_id, status, joined_at)
        VALUES (?, ?, 'accepted', CURRENT_TIMESTAMP)
      `);
      creatorStmt.run(dispute_id, creator_id);

      // Add other participants as invited
      if (participant_ids && participant_ids.length > 0) {
        const participantStmt = db.prepare(`
          INSERT INTO dispute_participants (dispute_id, user_id, status)
          VALUES (?, ?, 'invited')
        `);
        
        participant_ids.forEach(user_id => {
          participantStmt.run(dispute_id, user_id);
        });
      }

      callback(null, {id: dispute_id, title, creator_id, status: 'ongoing'});
    })();
  } catch (err) {
    callback(err, null);
  }
};

const getDisputesByUser = (user_id, callback) => {
  try {
    const stmt = db.prepare(`
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
      WHERE dp.user_id = ?
      ORDER BY d.created_at DESC
    `);
    
    const disputes = stmt.all(user_id);
    callback(null, disputes);
  } catch (err) {
    callback(err, null);
  }
};

const getDisputeById = (dispute_id, callback) => {
  try {
    const disputeStmt = db.prepare(`
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
      WHERE d.id = ?
    `);
    
    const dispute = disputeStmt.get(dispute_id);
    
    if (!dispute) {
      callback(null, null);
      return;
    }
    
    const participantsStmt = db.prepare(`
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
      WHERE dp.dispute_id = ? 
      ORDER BY dp.created_at ASC
    `);
    
    const participants = participantsStmt.all(dispute_id);
    dispute.participants = participants;
    
    callback(null, dispute);
  } catch (err) {
    callback(err, null);
  }
};

const updateParticipantStatus = (dispute_id, user_id, status, callback) => {
  try {
    db.transaction(() => {
      // Update participant status
      const updateStmt = db.prepare(`
        UPDATE dispute_participants 
        SET status = ?, joined_at = CASE WHEN ? = 'accepted' THEN CURRENT_TIMESTAMP ELSE joined_at END, updated_at = CURRENT_TIMESTAMP
        WHERE dispute_id = ? AND user_id = ?
      `);
      
      const result = updateStmt.run(status, status, dispute_id, user_id);
      
      if (result.changes === 0) {
        throw new Error('Participant not found');
      }
      
      // If someone rejected, mark the entire dispute as rejected
      if (status === 'rejected') {
        const disputeStmt = db.prepare(`
          UPDATE disputes 
          SET status = 'rejected', updated_at = CURRENT_TIMESTAMP 
          WHERE id = ?
        `);
        disputeStmt.run(dispute_id);
      }
      
      callback(null, { dispute_id, user_id, status });
    })();
  } catch (err) {
    callback(err, null);
  }
};

const submitDisputeResponse = (dispute_id, user_id, response_text, callback) => {
  try {
    db.transaction(() => {
      // Update participant response
      const updateStmt = db.prepare(`
        UPDATE dispute_participants 
        SET response_text = ?, response_submitted_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP
        WHERE dispute_id = ? AND user_id = ? AND status = 'accepted'
      `);
      
      const result = updateStmt.run(response_text, dispute_id, user_id);
      
      if (result.changes === 0) {
        throw new Error('Participant not found or not accepted');
      }
      
      // Check if all accepted participants have submitted responses
      const checkStmt = db.prepare(`
        SELECT 
          COUNT(*) as total_participants,
          SUM(CASE WHEN status = 'rejected' THEN 1 ELSE 0 END) as rejected_count,
          SUM(CASE WHEN status = 'accepted' AND response_text IS NOT NULL THEN 1 ELSE 0 END) as responded_count,
          SUM(CASE WHEN status = 'accepted' AND response_text IS NULL THEN 1 ELSE 0 END) as accepted_not_responded,
          SUM(CASE WHEN status = 'invited' THEN 1 ELSE 0 END) as still_invited
        FROM dispute_participants 
        WHERE dispute_id = ?
      `);
      
      const checkResult = checkStmt.get(dispute_id);
      
      const allInvitationsResolved = checkResult.still_invited === 0;
      const allAcceptedHaveResponded = checkResult.accepted_not_responded === 0;
      
      if (allInvitationsResolved && allAcceptedHaveResponded && checkResult.responded_count > 0) {
        const disputeStmt = db.prepare(`
          UPDATE disputes 
          SET status = 'completed', updated_at = CURRENT_TIMESTAMP 
          WHERE id = ?
        `);
        disputeStmt.run(dispute_id);
        
        callback(null, { dispute_id, user_id, response_text, completed: true });
      } else {
        callback(null, { dispute_id, user_id, response_text, completed: false });
      }
    })();
  } catch (err) {
    callback(err, null);
  }
};

const updateDisputeVerdict = (dispute_id, verdict, callback) => {
  try {
    const stmt = db.prepare(`
      UPDATE disputes 
      SET verdict = ?, updated_at = CURRENT_TIMESTAMP 
      WHERE id = ?
    `);
    
    const result = stmt.run(verdict, dispute_id);
    callback(null, { dispute_id, verdict, updated: result.changes > 0 });
  } catch (err) {
    callback(err, null);
  }
};

const createContactRequest = (requesterEmail, recipientEmail, callback) => {
  try {
    // Get the requester
    const requesterStmt = db.prepare('SELECT * FROM users WHERE email = ?');
    const requester = requesterStmt.get(requesterEmail);
    
    if (!requester) {
      return callback(new Error('Requester not found'), null);
    }

    // Check if recipient exists
    const recipientStmt = db.prepare('SELECT * FROM users WHERE email = ?');
    const recipient = recipientStmt.get(recipientEmail);
    
    const insertStmt = db.prepare(`
      INSERT INTO contacts (requester_id, recipient_id, recipient_email, status) 
      VALUES (?, ?, ?, 'pending')
    `);
    
    const result = insertStmt.run(
      requester.id, 
      recipient ? recipient.id : null, 
      recipientEmail
    );
    
    callback(null, { 
      id: result.lastInsertRowid, 
      requesterEmail, 
      recipientEmail,
      recipientExists: !!recipient,
      status: 'pending'
    });
  } catch (err) {
    callback(err, null);
  }
};

const getUserContacts = (userEmail, callback) => {
  try {
    const userStmt = db.prepare('SELECT * FROM users WHERE email = ?');
    const user = userStmt.get(userEmail);
    
    if (!user) {
      return callback(new Error('User not found'), null);
    }

    // Get accepted contacts
    const contactsStmt = db.prepare(`
      SELECT 
        c.id,
        c.status,
        c.created_at,
        CASE 
          WHEN c.requester_id = ? THEN ru.name 
          ELSE rq.name 
        END as contact_name,
        CASE 
          WHEN c.requester_id = ? THEN ru.email 
          ELSE rq.email 
        END as contact_email
      FROM contacts c
      LEFT JOIN users rq ON c.requester_id = rq.id
      LEFT JOIN users ru ON c.recipient_id = ru.id
      WHERE (c.requester_id = ? OR c.recipient_id = ?) 
        AND c.status = 'accepted'
    `);
    
    const contacts = contactsStmt.all(user.id, user.id, user.id, user.id);

    // Get pending requests
    const pendingStmt = db.prepare(`
      SELECT 
        c.id,
        c.status,
        c.created_at,
        rq.name as requester_name,
        rq.email as requester_email
      FROM contacts c
      JOIN users rq ON c.requester_id = rq.id
      WHERE c.recipient_id = ? AND c.status = 'pending'
    `);
    
    const pendingRequests = pendingStmt.all(user.id);
    
    callback(null, { contacts, pendingRequests });
  } catch (err) {
    callback(err, null);
  }
};

const updateContactRequest = (requestId, status, callback) => {
  try {
    const stmt = db.prepare(`
      UPDATE contacts 
      SET status = ?, updated_at = CURRENT_TIMESTAMP 
      WHERE id = ?
    `);
    
    const result = stmt.run(status, requestId);
    callback(null, { id: requestId, status, updated: result.changes > 0 });
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
      
      // 4. Save verdict to database (converted to better-sqlite3 syntax)
      const stmt = db.prepare(`UPDATE disputes SET verdict = ?, status = 'resolved' WHERE id = ?`);
      const result = stmt.run(verdict, disputeId);
      
      callback(null, { disputeId, verdict, updated: result.changes > 0 });
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