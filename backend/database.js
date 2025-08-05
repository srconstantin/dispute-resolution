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

module.exports = {
  initDatabase,
  createUser,
  getUserByEmail
};
