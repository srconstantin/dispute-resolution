const { pool } = require('../database');
const encryption = require('../utils/encryption');

async function migrateToEncryption() {
  console.log('🔄 Starting encryption migration...');
  
  const client = await pool.connect();
  
  try {
    await client.query('BEGIN');
    
    // 1. Add new encrypted columns to existing tables
    console.log('📝 Adding encrypted columns...');
    
    // Add encrypted columns to users table
    await client.query(`
      ALTER TABLE users 
      ADD COLUMN IF NOT EXISTS name_encrypted TEXT,
      ADD COLUMN IF NOT EXISTS email_encrypted TEXT,
      ADD COLUMN IF NOT EXISTS email_hash TEXT
    `);
    
    // Add encrypted columns to disputes table
    await client.query(`
      ALTER TABLE disputes 
      ADD COLUMN IF NOT EXISTS title_encrypted TEXT,
      ADD COLUMN IF NOT EXISTS verdict_encrypted TEXT
    `);
    
    // Add encrypted columns to dispute_participants table
    await client.query(`
      ALTER TABLE dispute_participants 
      ADD COLUMN IF NOT EXISTS response_text_encrypted TEXT
    `);
    
    // Add encrypted columns to contacts table
    await client.query(`
      ALTER TABLE contacts 
      ADD COLUMN IF NOT EXISTS recipient_email_encrypted TEXT,
      ADD COLUMN IF NOT EXISTS recipient_email_hash TEXT
    `);

    // 2. Migrate existing user data
    console.log('👥 Migrating user data...');
    const users = await client.query('SELECT id, name, email FROM users WHERE name_encrypted IS NULL');
    
    for (const user of users.rows) {
      const nameEncrypted = encryption.encryptName(user.name);
      const emailEncrypted = encryption.encryptEmail(user.email);
      const emailHash = encryption.hashForSearch(user.email);
      
      await client.query(`
        UPDATE users 
        SET name_encrypted = $1, email_encrypted = $2, email_hash = $3 
        WHERE id = $4
      `, [nameEncrypted, emailEncrypted, emailHash, user.id]);
    }
    
    // 3. Migrate existing dispute data
    console.log('⚖️ Migrating dispute data...');
    const disputes = await client.query('SELECT id, title, verdict FROM disputes WHERE title_encrypted IS NULL');
    
    for (const dispute of disputes.rows) {
      const titleEncrypted = encryption.encryptText(dispute.title);
      const verdictEncrypted = dispute.verdict ? encryption.encryptText(dispute.verdict) : null;
      
      await client.query(`
        UPDATE disputes 
        SET title_encrypted = $1, verdict_encrypted = $2 
        WHERE id = $3
      `, [titleEncrypted, verdictEncrypted, dispute.id]);
    }
    
    // 4. Migrate existing dispute participant responses
    console.log('💬 Migrating dispute responses...');
    const responses = await client.query('SELECT id, response_text FROM dispute_participants WHERE response_text IS NOT NULL AND response_text_encrypted IS NULL');
    
    for (const response of responses.rows) {
      const responseEncrypted = encryption.encryptText(response.response_text);
      
      await client.query(`
        UPDATE dispute_participants 
        SET response_text_encrypted = $1 
        WHERE id = $2
      `, [responseEncrypted, response.id]);
    }
    
    // 5. Migrate existing contact data
    console.log('📞 Migrating contact data...');
    const contacts = await client.query('SELECT id, recipient_email FROM contacts WHERE recipient_email_encrypted IS NULL');
    
    for (const contact of contacts.rows) {
      const emailEncrypted = encryption.encryptEmail(contact.recipient_email);
      const emailHash = encryption.hashForSearch(contact.recipient_email);
      
      await client.query(`
        UPDATE contacts 
        SET recipient_email_encrypted = $1, recipient_email_hash = $2 
        WHERE id = $3
      `, [emailEncrypted, emailHash, contact.id]);
    }

    // 6. Add constraints and indexes for encrypted fields
    console.log('🔐 Adding security constraints...');
    
    // Make encrypted fields NOT NULL (after migration)
    await client.query(`
      ALTER TABLE users 
      ALTER COLUMN name_encrypted SET NOT NULL,
      ALTER COLUMN email_encrypted SET NOT NULL,
      ALTER COLUMN email_hash SET NOT NULL
    `);
    
    await client.query(`
      ALTER TABLE disputes 
      ALTER COLUMN title_encrypted SET NOT NULL
    `);
    
    // Add unique constraint on email_hash
    await client.query(`
      ALTER TABLE users 
      ADD CONSTRAINT unique_email_hash UNIQUE (email_hash)
    `);
    
    // Create indexes for encrypted lookups
    await client.query('CREATE INDEX IF NOT EXISTS idx_users_email_hash ON users(email_hash)');
    await client.query('CREATE INDEX IF NOT EXISTS idx_contacts_recipient_email_hash ON contacts(recipient_email_hash)');
    
    await client.query('COMMIT');
    console.log('✅ Migration completed successfully!');
    
    // 7. IMPORTANT: After successful migration, you should:
    console.log(`
    ⚠️  IMPORTANT NEXT STEPS:
    1. Update your application code to use encrypted database functions
    2. Test thoroughly in a development environment
    3. Once confirmed working, DROP the old plaintext columns:
       - ALTER TABLE users DROP COLUMN name, DROP COLUMN email;
       - ALTER TABLE disputes DROP COLUMN title, DROP COLUMN verdict;
       - ALTER TABLE dispute_participants DROP COLUMN response_text;
       - ALTER TABLE contacts DROP COLUMN recipient_email;
    4. Create database backups before dropping columns in production
    `);
    
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('❌ Migration failed:', error);
    throw error;
  } finally {
    client.release();
  }
}

// Run migration
if (require.main === module) {
  migrateToEncryption()
    .then(() => {
      console.log('Migration completed');
      process.exit(0);
    })
    .catch((error) => {
      console.error('Migration failed:', error);
      process.exit(1);
    });
}

module.exports = { migrateToEncryption };