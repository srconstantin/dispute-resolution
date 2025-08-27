require('dotenv').config();
const { pool } = require('./database');

async function dropPlaintextColumns() {
  const client = await pool.connect();
  
  try {
    console.log('Dropping plaintext columns...');
    
    await client.query('ALTER TABLE users DROP COLUMN IF EXISTS name');
    await client.query('ALTER TABLE users DROP COLUMN IF EXISTS email');
    console.log('Dropped user plaintext columns');
    
    await client.query('ALTER TABLE disputes DROP COLUMN IF EXISTS title');
    await client.query('ALTER TABLE disputes DROP COLUMN IF EXISTS verdict');
    console.log('Dropped dispute plaintext columns');
    
    await client.query('ALTER TABLE dispute_participants DROP COLUMN IF EXISTS response_text');
    console.log('Dropped response plaintext column');
    
    await client.query('ALTER TABLE contacts DROP COLUMN IF EXISTS recipient_email');
    console.log('Dropped contact plaintext column');
    
    console.log('All plaintext columns removed!');
  } catch (error) {
    console.error('Error:', error);
  } finally {
    client.release();
    process.exit(0);
  }
}

dropPlaintextColumns();