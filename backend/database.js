const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const dbPath = path.join(__dirname, 'database.sqlite');
const db = new sqlite3.Database(dbPath);

const initDatabase = () => {
  db.serialize(() => {
    // Create users table
    db.run(`
      CREATE TABLE IF NOT EXISTS users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        email TEXT UNIQUE NOT NULL,
        password TEXT NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);
    // create contacts table 
    db.run(`
      CREATE TABLE IF NOT EXISTS contacts (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        requester_id INTEGER NOT NULL,
        recipient_id INTEGER,
        recipient_email TEXT NOT NULL,
        status TEXT NOT NULL DEFAULT 'pending', -- 'pending', 'accepted', 'rejected'
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (requester_id) REFERENCES users (id),
        FOREIGN KEY (recipient_id) REFERENCES users (id)
      )
    `);

    //create disputes table
    db.run(`
      CREATE TABLE IF NOT EXISTS disputes (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        title TEXT NOT NULL,
        creator_id INTEGER NOT NULL,
        status TEXT NOT NULL DEFAULT 'ongoing', -- 'ongoing', 'rejected', 'ongoing', completed'
        verdict TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (creator_id) REFERENCES users (id)
      )
    `);

      // Create dispute_participants table

      db.run(`
        CREATE TABLE IF NOT EXISTS dispute_participants (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        dispute_id INTEGER NOT NULL,
        user_id INTEGER NOT NULL,
        status TEXT NOT NULL DEFAULT 'invited', -- 'invited', 'accepted', 'rejected'
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
  });
};

const createUser = (userData, callback) => {
  const { name, email, password } = userData;
  const stmt = db.prepare(`
    INSERT INTO users (name, email, password) 
    VALUES (?, ?, ?)
  `);
  
  stmt.run(name, email, password, function(err) {
    if (err) {
      callback(err, null);
    } else {
      callback(null, { id: this.lastID, name, email });
    }
  });
  
  stmt.finalize();
};

const getUserByEmail = (email, callback) => {
  db.get('SELECT * FROM users WHERE email = ?', [email], callback);
};

const createDispute = (disputeData, callback) => {
  const { title, creator_id, participant_ids } = disputeData;

  db.serialize(() => {
    db.run('BEGIN TRANSACTION');

    const stmt = db.prepare(`
      INSERT INTO disputes(title, creator_id, status)
      values (?, ?, 'ongoing')
    `);

    stmt.run(title, creator_id, function(err) {
      if (err) {
        db.run('ROLLBACK');
        callback(err, null);
        return;
      }

    const dispute_id = this.lastID;

    const creatorStmt = db.prepare(`
      INSERT INTO dispute_participants (dispute_id, user_id, status, joined_at)
      VALUES (?, ?, 'accepted', CURRENT_TIMESTAMP)
    `);

    creatorStmt.run(dispute_id, creator_id, (err) => {
      if (err) {
        db.run('ROLLBACK');
        callback(err, null);
        return;
      }

      if (participant_ids && participant_ids.length > 0) {
        const participantStmt = db.prepare(`
          INSERT INTO dispute_participants (dispute_id, user_id, status)
          VALUES (?, ?, 'invited')
          `);

          let completed = 0;
          let hasError = false;

          participant_ids.forEach(user_id => {
            participantStmt.run(dispute_id, user_id, (err) => {
              if (err && !hasError) {
                hasError = true;
                db.run('ROLLBACK');
                callback(err, null);
                return;
              }

              completed++
              if (completed === participant_ids.length && !hasError){
                db.run('COMMIT');
                callback(null, {id: dispute_id, title, creator_id, status: 'ongoing'});
              }
            });
          });

          participantStmt.finalize();
        } else {
          db.run('COMMIT');
          callback(null, {id: dispute_id, title, creator_id, status: 'ongoing'});
        }  
      });

      creatorStmt.finalize();
    });

    stmt.finalize();
  });
};

const getDisputesByUser = (user_id, callback) => {
  const query = `
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
    `;

  db.all(query, [user_id], callback);
};

const getDisputeById = (dispute_id, callback) => {
  const query = `
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
  `;

  db.get(query, [dispute_id], (err, dispute) => {
    if (err) {
      callback(err, null);
      return;
    }

    if (!dispute) {
      callback(null, null);
      return;
    }
      
    const participantsQuery = `
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
    `;

    db.all(participantsQuery, [dispute_id], (err, participants) => {
      if (err) {
        callback(err, null);
        return;
      }

      dispute.participants = participants;
      callback(null, dispute);
    });
  });
};


const updateParticipantStatus = (dispute_id, user_id, status, callback) => {
  db.serialize(() => {
    db.run('BEGIN TRANSACTION');
    
    // Update participant status
    const updateStmt = db.prepare(`
      UPDATE dispute_participants 
      SET status = ?, joined_at = CASE WHEN ? = 'accepted' THEN CURRENT_TIMESTAMP ELSE joined_at END, updated_at = CURRENT_TIMESTAMP
      WHERE dispute_id = ? AND user_id = ?
    `);
    
    updateStmt.run(status, status, dispute_id, user_id, function(err) {
      if (err) {
        db.run('ROLLBACK');
        callback(err, null);
        return;
      }
      
      if (this.changes === 0) {
        db.run('ROLLBACK');
        callback(new Error('Participant not found'), null);
        return;
      }
      
      // If someone rejected, mark the entire dispute as rejected
      if (status === 'rejected') {
        const disputeStmt = db.prepare(`
          UPDATE disputes 
          SET status = 'rejected', updated_at = CURRENT_TIMESTAMP 
          WHERE id = ?
        `);
        
        disputeStmt.run(dispute_id, (err) => {
          if (err) {
            db.run('ROLLBACK');
            callback(err, null);
          } else {
            db.run('COMMIT');
            callback(null, { dispute_id, user_id, status });
          }
        });
        
        disputeStmt.finalize();
      } else {
        db.run('COMMIT');
        callback(null, { dispute_id, user_id, status });
      }
    });
    
    updateStmt.finalize();
  });
};


const submitDisputeResponse = (dispute_id, user_id, response_text, callback) => {
  db.serialize(() => {
    db.run('BEGIN TRANSACTION');
    
    // Update participant response
    const updateStmt = db.prepare(`
      UPDATE dispute_participants 
      SET response_text = ?, response_submitted_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP
      WHERE dispute_id = ? AND user_id = ? AND status = 'accepted'
    `);
    
    updateStmt.run(response_text, dispute_id, user_id, function(err) {
      if (err) {
        db.run('ROLLBACK');
        callback(err, null);
        return;
      }
      
      if (this.changes === 0) {
        db.run('ROLLBACK');
        callback(new Error('Participant not found or not accepted'), null);
        return;
      }
      
      // Check if all accepted participants have submitted responses

      const checkQuery = `
        SELECT 
          COUNT(*) as total_participants,
          SUM(CASE WHEN status = 'rejected' THEN 1 ELSE 0 END) as rejected_count,
          SUM(CASE WHEN status = 'accepted' AND response_text IS NOT NULL THEN 1 ELSE 0 END) as responded_count,
          SUM(CASE WHEN status = 'accepted' AND response_text IS NULL THEN 1 ELSE 0 END) as accepted_not_responded,
          SUM(CASE WHEN status = 'invited' THEN 1 ELSE 0 END) as still_invited
        FROM dispute_participants 
        WHERE dispute_id = ?
      `;

      db.get(checkQuery, [dispute_id], (err, result) => {
        if (err) {
          db.run('ROLLBACK');
          callback(err, null);
          return;
        }
        // Only mark as completed if:
        // 1. No one is still invited (everyone has accepted or rejected)
        // 2. Everyone who accepted has submitted a response
        const allInvitationsResolved = result.still_invited === 0;
        const allAcceptedHaveResponded = result.accepted_not_responded === 0;
        
        if (allInvitationsResolved && allAcceptedHaveResponded && result.responded_count > 0) {
          const disputeStmt = db.prepare(`
            UPDATE disputes 
            SET status = 'completed', updated_at = CURRENT_TIMESTAMP 
            WHERE id = ?
          `);
        
          // TODO: compute & update verdict?
          
          disputeStmt.run(dispute_id, (err) => {
            if (err) {
              db.run('ROLLBACK');
              callback(err, null);
            } else {
              db.run('COMMIT');
              callback(null, { dispute_id, user_id, response_text, completed: true });
            }
          });
          
          disputeStmt.finalize();
        } else {
          db.run('COMMIT');
          callback(null, { dispute_id, user_id, response_text, completed: false });
        }
      });
    });
    
    updateStmt.finalize();
  });
};

const updateDisputeVerdict = (dispute_id, verdict, callback) => {
  const stmt = db.prepare(`
    UPDATE disputes 
    SET verdict = ?, updated_at = CURRENT_TIMESTAMP 
    WHERE id = ?
  `);
  
  stmt.run(verdict, dispute_id, function(err) {
    if (err) {
      callback(err, null);
    } else {
      callback(null, { dispute_id, verdict, updated: this.changes > 0 });
    }
  });
  
  stmt.finalize();
};

const createContactRequest = (requesterEmail, recipientEmail, callback) => {
  // First, get the requester ID
  getUserByEmail(requesterEmail, (err, requester) => {
    if (err || !requester) {
      return callback(err || new Error('Requester not found'), null);
    }

    // Check if recipient exists
    getUserByEmail(recipientEmail, (err, recipient) => {
      if (err) {
        return callback(err, null);
      }

      const stmt = db.prepare(`
        INSERT INTO contacts (requester_id, recipient_id, recipient_email, status) 
        VALUES (?, ?, ?, 'pending')
      `);
      
      stmt.run(
        requester.id, 
        recipient ? recipient.id : null, 
        recipientEmail, 
        function(err) {
          if (err) {
            callback(err, null);
          } else {
            callback(null, { 
              id: this.lastID, 
              requesterEmail, 
              recipientEmail,
              recipientExists: !!recipient,
              status: 'pending'
            });
          }
        }
      );
      
      stmt.finalize();
    });
  });
};

const getUserContacts = (userEmail, callback) => {
  getUserByEmail(userEmail, (err, user) => {
    if (err || !user) {
      return callback(err || new Error('User not found'), null);
    }

    // Get accepted contacts (where user is either requester or recipient)
    db.all(`
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
    `, [user.id, user.id, user.id, user.id], (err, contacts) => {
      if (err) {
        return callback(err, null);
      }

      // Get pending requests where this user is the recipient
      db.all(`
        SELECT 
          c.id,
          c.status,
          c.created_at,
          rq.name as requester_name,
          rq.email as requester_email
        FROM contacts c
        JOIN users rq ON c.requester_id = rq.id
        WHERE c.recipient_id = ? AND c.status = 'pending'
      `, [user.id], (err, pendingRequests) => {
        if (err) {
          return callback(err, null);
        }

        callback(null, { contacts, pendingRequests });
      });
    });
  });
};

const updateContactRequest = (requestId, status, callback) => {
  const stmt = db.prepare(`
    UPDATE contacts 
    SET status = ?, updated_at = CURRENT_TIMESTAMP 
    WHERE id = ?
  `);
  
  stmt.run(status, requestId, function(err) {
    if (err) {
      callback(err, null);
    } else {
      callback(null, { id: requestId, status, updated: this.changes > 0 });
    }
  });
  
  stmt.finalize();
};

const { generateVerdict } = require('./services/claude');

const checkAndGenerateVerdict = async (disputeId, callback) => {
  // 1. Check if all participants have submitted
  const allSubmitted = await checkAllParticipantsSubmitted(disputeId);
  
  if (allSubmitted) {
    // 2. Get dispute data
    const disputeData = await getDisputeData(disputeId);
    
    // 3. Generate verdict using Claude
    const verdict = await generateVerdict(disputeData);
    
    // 4. Save verdict to database
    const stmt = db.prepare(`UPDATE disputes SET verdict = ?, status = 'resolved' WHERE id = ?`);
    stmt.run(verdict, disputeId, callback);
  }
};

// Update the module.exports to include new functions:
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
  updateDisputeVerdict
};