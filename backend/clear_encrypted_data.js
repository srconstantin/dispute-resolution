require('dotenv').config();
const { pool } = require('./database');

async function clearEncryptedData() {
  const client = await pool.connect();
  
  try {
    console.log('Removing NOT NULL constraints...');
    
    // Remove NOT NULL constraints first
    await client.query('ALTER TABLE users ALTER COLUMN name_encrypted DROP NOT NULL');
    await client.query('ALTER TABLE users ALTER COLUMN email_encrypted DROP NOT NULL');
    await client.query('ALTER TABLE users ALTER COLUMN email_hash DROP NOT NULL');
    await client.query('ALTER TABLE disputes ALTER COLUMN title_encrypted DROP NOT NULL');
    console.log('Constraints removed');
    
    console.log('Clearing encrypted data...');
    
    await client.query('UPDATE users SET name_encrypted = NULL, email_encrypted = NULL, email_hash = NULL');
    console.log('Cleared user data');
    
    await client.query('UPDATE disputes SET title_encrypted = NULL, verdict_encrypted = NULL');
    console.log('Cleared dispute data');
    
    await client.query('UPDATE dispute_participants SET response_text_encrypted = NULL');
    console.log('Cleared response data');
    
    await client.query('UPDATE contacts SET recipient_email_encrypted = NULL, recipient_email_hash = NULL');
    console.log('Cleared contact data');
    
    console.log('All encrypted data cleared');
  } catch (error) {
    console.error('Error:', error);
  } finally {
    client.release();
    process.exit(0);
  }
}

clearEncryptedData();