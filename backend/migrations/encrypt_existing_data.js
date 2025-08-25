require('dotenv').config();
const { pool } = require('../database');
const encryption = require('../utils/encryption');

async function migrateToEncryption() {
  console.log('🔄 Starting encryption migration...');
  
  const client = await pool.connect();
  
  try {
    // 1. Add new encrypted columns to existing tables (outside transaction)
    console.log('📝 Adding encrypted columns...');
    
    // Add encrypted columns to users table
    try {
      await client.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS name_encrypted TEXT`);
      await client.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS email_encrypted TEXT`);
      await client.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS email_hash TEXT`);
      console.log('✅ User table columns added');
    } catch (err) {
      console.log('⚠️ User columns may already exist:', err.message);
    }
    
    // Add encrypted columns to disputes table
    try {
      await client.query(`ALTER TABLE disputes ADD COLUMN IF NOT EXISTS title_encrypted TEXT`);
      await client.query(`ALTER TABLE disputes ADD COLUMN IF NOT EXISTS verdict_encrypted TEXT`);
      console.log('✅ Dispute table columns added');
    } catch (err) {
      console.log('⚠️ Dispute columns may already exist:', err.message);
    }
    
    // Add encrypted columns to dispute_participants table
    try {
      await client.query(`ALTER TABLE dispute_participants ADD COLUMN IF NOT EXISTS response_text_encrypted TEXT`);
      console.log('✅ Dispute participants columns added');
    } catch (err) {
      console.log('⚠️ Dispute participants columns may already exist:', err.message);
    }
    
    // Add encrypted columns to contacts table
    try {
      await client.query(`ALTER TABLE contacts ADD COLUMN IF NOT EXISTS recipient_email_encrypted TEXT`);
      await client.query(`ALTER TABLE contacts ADD COLUMN IF NOT EXISTS recipient_email_hash TEXT`);
      console.log('✅ Contacts table columns added');
    } catch (err) {
      console.log('⚠️ Contacts columns may already exist:', err.message);
    }

    // 2. Migrate existing user data
    console.log('👥 Migrating user data...');
    const users = await client.query('SELECT id, name, email FROM users WHERE name_encrypted IS NULL');
    console.log(`Found ${users.rows.length} users to encrypt`);
    
    for (const user of users.rows) {
      try {
        const nameEncrypted = encryption.encryptName(user.name);
        const emailEncrypted = encryption.encryptEmail(user.email);
        const emailHash = encryption.hashForSearch(user.email);
        
        await client.query(`
          UPDATE users 
          SET name_encrypted = $1, email_encrypted = $2, email_hash = $3 
          WHERE id = $4
        `, [nameEncrypted, emailEncrypted, emailHash, user.id]);
        
        console.log(`✅ Encrypted user ${user.id}`);
      } catch (err) {
        console.log(`❌ Failed to encrypt user ${user.id}:`, err.message);
      }
    }
    
    // 3. Migrate existing dispute data
    console.log('⚖️ Migrating dispute data...');
    const disputes = await client.query('SELECT id, title, verdict FROM disputes WHERE title_encrypted IS NULL');
    console.log(`Found ${disputes.rows.length} disputes to encrypt`);
    
    for (const dispute of disputes.rows) {
      try {
        const titleEncrypted = encryption.encryptText(dispute.title);
        const verdictEncrypted = dispute.verdict ? encryption.encryptText(dispute.verdict) : null;
        
        await client.query(`
          UPDATE disputes 
          SET title_encrypted = $1, verdict_encrypted = $2 
          WHERE id = $3
        `, [titleEncrypted, verdictEncrypted, dispute.id]);
        
        console.log(`✅ Encrypted dispute ${dispute.id}`);
      } catch (err) {
        console.log(`❌ Failed to encrypt dispute ${dispute.id}:`, err.message);
      }
    }
    
    // 4. Migrate existing dispute participant responses
    console.log('💬 Migrating dispute responses...');
    const responses = await client.query('SELECT id, response_text FROM dispute_participants WHERE response_text IS NOT NULL AND response_text_encrypted IS NULL');
    console.log(`Found ${responses.rows.length} responses to encrypt`);
    
    for (const response of responses.rows) {
      try {
        const responseEncrypted = encryption.encryptText(response.response_text);
        
        await client.query(`
          UPDATE dispute_participants 
          SET response_text_encrypted = $1 
          WHERE id = $2
        `, [responseEncrypted, response.id]);
        
        console.log(`✅ Encrypted response ${response.id}`);
      } catch (err) {
        console.log(`❌ Failed to encrypt response ${response.id}:`, err.message);
      }
    }
    
    // 5. Migrate existing contact data
    console.log('📞 Migrating contact data...');
    const contacts = await client.query('SELECT id, recipient_email FROM contacts WHERE recipient_email_encrypted IS NULL');
    console.log(`Found ${contacts.rows.length} contacts to encrypt`);
    
    for (const contact of contacts.rows) {
      try {
        const emailEncrypted = encryption.encryptEmail(contact.recipient_email);
        const emailHash = encryption.hashForSearch(contact.recipient_email);
        
        await client.query(`
          UPDATE contacts 
          SET recipient_email_encrypted = $1, recipient_email_hash = $2 
          WHERE id = $3
        `, [emailEncrypted, emailHash, contact.id]);
        
        console.log(`✅ Encrypted contact ${contact.id}`);
      } catch (err) {
        console.log(`❌ Failed to encrypt contact ${contact.id}:`, err.message);
      }
    }

    // 6. Add constraints and indexes (handle failures gracefully)
    console.log('🔐 Adding security constraints...');
    
    // Try to add unique constraint (skip if exists)
    try {
      await client.query(`ALTER TABLE users ADD CONSTRAINT unique_email_hash UNIQUE (email_hash)`);
      console.log('✅ Added unique constraint');
    } catch (err) {
      if (err.code === '42P07') {
        console.log('⏭️ unique_email_hash constraint already exists, skipping');
      } else {
        console.log('⚠️ Could not add unique constraint:', err.message);
      }
    }
    
    // Create indexes (use IF NOT EXISTS)
    try {
      await client.query('CREATE INDEX IF NOT EXISTS idx_users_email_hash ON users(email_hash)');
      await client.query('CREATE INDEX IF NOT EXISTS idx_contacts_recipient_email_hash ON contacts(recipient_email_hash)');
      console.log('✅ Created indexes');
    } catch (err) {
      console.log('⚠️ Could not create indexes:', err.message);
    }
    
    console.log('✅ Migration completed successfully!');
    
    // 7. Instructions for next steps
    console.log(`
    ⚠️ IMPORTANT NEXT STEPS:
    1. Update your application code to use encrypted database functions
    2. Test thoroughly to ensure encryption/decryption works
    3. Run the check_encryption.js script to verify data is encrypted
    4. Once confirmed working, you can drop old plaintext columns:
       - ALTER TABLE users DROP COLUMN name, DROP COLUMN email;
       - ALTER TABLE disputes DROP COLUMN title, DROP COLUMN verdict;
       - ALTER TABLE dispute_participants DROP COLUMN response_text;
       - ALTER TABLE contacts DROP COLUMN recipient_email;
    5. Create database backups before dropping columns in production
    `);
    
  } catch (error) {
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