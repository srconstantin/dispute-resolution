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

// Update the module.exports to include new functions:
module.exports = {
  initDatabase,
  createUser,
  getUserByEmail,
  createContactRequest,
  getUserContacts,
  updateContactRequest
};