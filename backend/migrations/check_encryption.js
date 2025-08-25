require('dotenv').config();
const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
});

async function checkEncryption() {
  try {
    console.log('🔍 Checking database encryption status...');
    
    // Check if encrypted columns exist and have data
    const result = await pool.query(`
      SELECT 
        id,
        name_encrypted,
        email_encrypted,
        email_hash,
        CASE WHEN name_encrypted IS NOT NULL THEN 'ENCRYPTED' ELSE 'MISSING' END as name_status,
        CASE WHEN email_encrypted IS NOT NULL THEN 'ENCRYPTED' ELSE 'MISSING' END as email_status
      FROM users 
      LIMIT 3
    `);
    
    console.log('👤 User data status:');
    result.rows.forEach((row, i) => {
      console.log(`User ${i+1}:`);
      console.log(`  ID: ${row.id}`);
      console.log(`  Name status: ${row.name_status}`);
      console.log(`  Email status: ${row.email_status}`);
      console.log(`  Name encrypted (first 20 chars): ${row.name_encrypted?.substring(0, 20) || 'NULL'}...`);
      console.log(`  Email encrypted (first 20 chars): ${row.email_encrypted?.substring(0, 20) || 'NULL'}...`);
      console.log(`  Email hash (first 20 chars): ${row.email_hash?.substring(0, 20) || 'NULL'}...`);
      console.log('');
    });
    
    // Check disputes
    const disputeResult = await pool.query(`
      SELECT 
        id,
        title_encrypted,
        CASE WHEN title_encrypted IS NOT NULL THEN 'ENCRYPTED' ELSE 'MISSING' END as title_status
      FROM disputes 
      LIMIT 2
    `);
    
    console.log('⚖️ Dispute data status:');
    disputeResult.rows.forEach((row, i) => {
      console.log(`Dispute ${i+1}: ${row.title_status} (${row.title_encrypted?.substring(0, 20) || 'NULL'}...)`);
    });
    
    // Summary
    const encryptedUsers = result.rows.filter(r => r.name_encrypted && r.email_encrypted).length;
    const totalUsers = result.rows.length;
    const encryptedDisputes = disputeResult.rows.filter(r => r.title_encrypted).length;
    const totalDisputes = disputeResult.rows.length;
    
    console.log('\n📊 SUMMARY:');
    console.log(`Users encrypted: ${encryptedUsers}/${totalUsers}`);
    console.log(`Disputes encrypted: ${encryptedDisputes}/${totalDisputes}`);
    
    if (encryptedUsers === totalUsers && encryptedDisputes === totalDisputes) {
      console.log('✅ Migration appears to have worked! Data is encrypted.');
    } else {
      console.log('❌ Migration incomplete. Some data is not encrypted.');
    }
    
  } catch (error) {
    console.error('Error checking encryption:', error.message);
  } finally {
    await pool.end();
  }
}

checkEncryption();