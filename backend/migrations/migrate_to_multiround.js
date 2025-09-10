require('dotenv').config();
const { pool } = require('./database');

async function runMigration() {
  const client = await pool.connect();
  
  try {
    console.log('🚀 Starting multi-round dispute flow migration...');
    
    await client.query('BEGIN');

    // 1. Add new column to existing disputes table
    console.log('📊 Adding current_round column to disputes table...');
    try {
      await client.query(`
        ALTER TABLE disputes 
        ADD COLUMN IF NOT EXISTS current_round INTEGER DEFAULT 1
      `);
      console.log('   ✅ Added current_round column');
    } catch (err) {
      console.log('   ⚠️ current_round column may already exist');
    }

    // 2. Create new tables for multi-round support
    console.log('🏗️ Creating new tables for multi-round support...');
    
    // Dispute responses table
    await client.query(`
      CREATE TABLE IF NOT EXISTS dispute_responses (
        id SERIAL PRIMARY KEY,
        dispute_id INTEGER NOT NULL REFERENCES disputes(id) ON DELETE CASCADE,
        user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        round_number INTEGER NOT NULL DEFAULT 1,
        response_text_encrypted TEXT NOT NULL,
        submitted_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(dispute_id, user_id, round_number)
      )
    `);
    console.log('   ✅ Created dispute_responses table');

    // Dispute verdicts table
    await client.query(`
      CREATE TABLE IF NOT EXISTS dispute_verdicts (
        id SERIAL PRIMARY KEY,
        dispute_id INTEGER NOT NULL REFERENCES disputes(id) ON DELETE CASCADE,
        round_number INTEGER NOT NULL DEFAULT 1,
        verdict_encrypted TEXT NOT NULL,
        generated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(dispute_id, round_number)
      )
    `);
    console.log('   ✅ Created dispute_verdicts table');

    // Participant satisfaction table
    await client.query(`
      CREATE TABLE IF NOT EXISTS participant_satisfaction (
        id SERIAL PRIMARY KEY,
        dispute_id INTEGER NOT NULL REFERENCES disputes(id) ON DELETE CASCADE,
        user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        round_number INTEGER NOT NULL,
        is_satisfied BOOLEAN NOT NULL,
        responded_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(dispute_id, user_id, round_number)
      )
    `);
    console.log('   ✅ Created participant_satisfaction table');

    // 3. Create indexes for better performance
    console.log('🗂️ Creating indexes...');
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_dispute_responses_dispute_round 
      ON dispute_responses(dispute_id, round_number)
    `);
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_dispute_verdicts_dispute_round 
      ON dispute_verdicts(dispute_id, round_number)
    `);
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_participant_satisfaction_dispute_round 
      ON participant_satisfaction(dispute_id, round_number)
    `);
    console.log('   ✅ Created performance indexes');

    // 4. Migrate existing data from your current structure
    console.log('📦 Migrating existing data...');
    
    // Move existing responses from dispute_participants to dispute_responses
    const responsesMigrated = await client.query(`
      INSERT INTO dispute_responses (dispute_id, user_id, round_number, response_text_encrypted, submitted_at)
      SELECT dp.dispute_id, dp.user_id, 1, dp.response_text_encrypted, dp.response_submitted_at
      FROM dispute_participants dp 
      WHERE dp.response_text_encrypted IS NOT NULL
      ON CONFLICT (dispute_id, user_id, round_number) DO NOTHING
    `);
    console.log(`   ✅ Migrated ${responsesMigrated.rowCount} responses to new structure`);

    // Move existing verdicts from disputes to dispute_verdicts
    const verdictsMigrated = await client.query(`
      INSERT INTO dispute_verdicts (dispute_id, round_number, verdict_encrypted, generated_at)
      SELECT d.id, 1, d.verdict_encrypted, d.updated_at
      FROM disputes d 
      WHERE d.verdict_encrypted IS NOT NULL
      ON CONFLICT (dispute_id, round_number) DO NOTHING
    `);
    console.log(`   ✅ Migrated ${verdictsMigrated.rowCount} verdicts to new structure`);

    // 5. Update dispute statuses to new format
    console.log('🔄 Updating dispute statuses to new naming scheme...');
    
    const ongoingUpdated = await client.query(`
      UPDATE disputes SET status = 'incomplete' WHERE status = 'ongoing'
    `);
    console.log(`   ✅ Updated ${ongoingUpdated.rowCount} disputes from 'ongoing' to 'incomplete'`);
    
    const completedUpdated = await client.query(`
      UPDATE disputes SET status = 'evaluated' 
      WHERE status = 'completed' OR status = 'resolved'
    `);
    console.log(`   ✅ Updated ${completedUpdated.rowCount} disputes to 'evaluated'`);

    // 6. Initialize current_round for existing disputes
    const roundsInitialized = await client.query(`
      UPDATE disputes SET current_round = 1 WHERE current_round IS NULL
    `);
    console.log(`   ✅ Initialized current_round for ${roundsInitialized.rowCount} existing disputes`);

    await client.query('COMMIT');
    console.log('✅ Migration completed successfully!');

    // 7. Verify migration
    console.log('🔍 Verifying migration results...');
    const verification = await client.query(`
      SELECT 
        COUNT(*) as total_disputes,
        COUNT(CASE WHEN status = 'incomplete' THEN 1 END) as incomplete_disputes,
        COUNT(CASE WHEN status = 'evaluated' THEN 1 END) as evaluated_disputes,
        COUNT(CASE WHEN status = 'concluded' THEN 1 END) as concluded_disputes,
        COUNT(CASE WHEN status = 'cancelled' THEN 1 END) as cancelled_disputes,
        COUNT(CASE WHEN status = 'rejected' THEN 1 END) as rejected_disputes
      FROM disputes
    `);
    
    const responsesCount = await client.query('SELECT COUNT(*) as count FROM dispute_responses');
    const verdictsCount = await client.query('SELECT COUNT(*) as count FROM dispute_verdicts');
    
    console.log('📊 Migration Summary:');
    console.log(`   - Total disputes: ${verification.rows[0].total_disputes}`);
    console.log(`   - Incomplete disputes: ${verification.rows[0].incomplete_disputes}`);
    console.log(`   - Evaluated disputes: ${verification.rows[0].evaluated_disputes}`);
    console.log(`   - Concluded disputes: ${verification.rows[0].concluded_disputes}`);
    console.log(`   - Cancelled disputes: ${verification.rows[0].cancelled_disputes}`);
    console.log(`   - Rejected disputes: ${verification.rows[0].rejected_disputes}`);
    console.log(`   - Total responses in new table: ${responsesCount.rows[0].count}`);
    console.log(`   - Total verdicts in new table: ${verdictsCount.rows[0].count}`);

    console.log('\n🎉 Multi-round dispute flow migration completed successfully!');
    console.log('\n📋 Next steps:');
    console.log('1. Update your database.js with the new functions (see updated_database_functions artifact)');
    console.log('2. Add new routes to your disputes.js (see updated_api_routes artifact)');
    console.log('3. Update your claude.js service (see updated_claude_service artifact)');
    console.log('4. Add new API functions to your api.js (see updated_api_service artifact)');
    console.log('5. Update your DisputeDetailScreen.js (see updated_dispute_detail_screen artifact)');
    console.log('6. Update your DisputesScreen.js to handle new status names');
    console.log('7. Test the new multi-round flow thoroughly');
    console.log('8. Consider keeping old columns for a rollback period, then drop them later');

  } catch (error) {
    await client.query('ROLLBACK');
    console.error('❌ Migration failed:', error);
    throw error;
  } finally {
    client.release();
  }
}

// Function to rollback migration if needed
async function rollbackMigration() {
  const client = await pool.connect();
  
  try {
    console.log('🔄 Rolling back multi-round migration...');
    
    await client.query('BEGIN');

    // Restore old status names
    await client.query(`UPDATE disputes SET status = 'ongoing' WHERE status = 'incomplete'`);
    await client.query(`UPDATE disputes SET status = 'completed' WHERE status = 'evaluated'`);
    
    // Drop new tables (use carefully!)
    // await client.query('DROP TABLE IF EXISTS participant_satisfaction');
    // await client.query('DROP TABLE IF EXISTS dispute_verdicts');  
    // await client.query('DROP TABLE IF EXISTS dispute_responses');
    
    // Remove new column
    // await client.query('ALTER TABLE disputes DROP COLUMN IF EXISTS current_round');
    
    await client.query('COMMIT');
    console.log('✅ Rollback completed');
    
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('❌ Rollback failed:', error);
    throw error;
  } finally {
    client.release();
  }
}

// Main execution
async function main() {
  try {
    console.log('💾 IMPORTANT: Create a database backup before proceeding!');
    console.log('   Suggested command: pg_dump your_database > backup_$(date +%Y%m%d_%H%M%S).sql\n');
    
    await runMigration();
    
  } catch (error) {
    console.error('💥 Migration failed:', error);
    console.log('\n🔧 If you need to rollback, you can uncomment the rollback commands in rollbackMigration()');
    process.exit(1);
  }
}

// Run migration if this file is executed directly
if (require.main === module) {
  main();
}

module.exports = { runMigration, rollbackMigration };