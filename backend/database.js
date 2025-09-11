const { Pool } = require('pg');
const encryption = require('./utils/encryption');
const { generateVerdict } = require('./services/claude');

// Railway automatically provides DATABASE_URL
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
});

const initDatabase = async () => {
  console.log('🚀 initDatabase() function called!');
  console.log('📁 Database URL:', process.env.DATABASE_URL ? 'Connected' : 'Missing');
  
  try {
    // Create users table
    await pool.query(`
      CREATE TABLE IF NOT EXISTS users (
        id SERIAL PRIMARY KEY,
       name_encrypted TEXT NOT NULL,
        email_encrypted TEXT NOT NULL,
        email_hash TEXT UNIQUE NOT NULL,
        password TEXT NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT unique_email_hash UNIQUE (email_hash)
      )
    `);
    console.log('✅ Users table created/verified with encryption');

    // Create contacts table with encrypted emails
    await pool.query(`
      CREATE TABLE IF NOT EXISTS contacts (
        id SERIAL PRIMARY KEY,
        requester_id INTEGER NOT NULL,
        recipient_id INTEGER,
        recipient_email_encrypted TEXT NOT NULL,
        recipient_email_hash TEXT NOT NULL,
        status TEXT NOT NULL DEFAULT 'pending',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (requester_id) REFERENCES users (id),
        FOREIGN KEY (recipient_id) REFERENCES users (id)
      )
    `);
    console.log('✅ Contacts table created/verified with encryption');

    // Create disputes table with encrypted titles
    await pool.query(`
      CREATE TABLE IF NOT EXISTS disputes (
        id SERIAL PRIMARY KEY,
        title_encrypted TEXT NOT NULL,
        creator_id INTEGER NOT NULL,
        status TEXT NOT NULL DEFAULT 'ongoing',
        verdict_encrypted TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (creator_id) REFERENCES users (id)
      )
    `);
    console.log('✅ Disputes table created/verified with encryption');

    // Create dispute_participants table with encrypted response text
    await pool.query(`
      CREATE TABLE IF NOT EXISTS dispute_participants (
        id SERIAL PRIMARY KEY,
        dispute_id INTEGER NOT NULL,
        user_id INTEGER NOT NULL,
        status TEXT NOT NULL DEFAULT 'invited',
        response_text_encrypted TEXT,
        joined_at TIMESTAMP,
        response_submitted_at TIMESTAMP,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (dispute_id) REFERENCES disputes (id),
        FOREIGN KEY (user_id) REFERENCES users (id),
        UNIQUE(dispute_id, user_id)
      )
    `);
    console.log('✅ Dispute_participants table created/verified with encryption');
    
  } catch (error) {
    console.error('❌ Error creating tables:', error);
  }
};

const createUser = async (userData, callback) => {
  const { name, email, password } = userData;
  
  try {
    const nameEncrypted = encryption.encryptName(name);
    const emailEncrypted = encryption.encryptEmail(email);
    const emailHash = encryption.hashForSearch(email);
    
    const result = await pool.query(
      'INSERT INTO users (name_encrypted, email_encrypted, email_hash, password) VALUES ($1, $2, $3, $4) RETURNING id',
      [nameEncrypted, emailEncrypted, emailHash, password]
    );
    callback(null, {
      id: result.rows[0].id,
      name: name,
      email: email
    });
  } catch (err) {
    callback(err, null);
  }
};

const getUserByEmail = async (email, callback) => {
  try {
    console.log('🔍 Looking for user with email (encrypted lookup):', email);
    const emailHash = encryption.hashForSearch(email);
    
    const result = await pool.query('SELECT * FROM users WHERE email_hash = $1', [emailHash]);
    const user = result.rows[0];

   if (user) {
      // Decrypt sensitive fields for application use
      const decryptedUser = {
        ...user,
        name: encryption.decrypt(user.name_encrypted),
        email: encryption.decrypt(user.email_encrypted)
      };
      
      // Remove encrypted fields from response
      delete decryptedUser.name_encrypted;
      delete decryptedUser.email_encrypted;
      delete decryptedUser.email_hash;
      
      console.log('🔍 User found and decrypted');
      callback(null, decryptedUser);
    } else {
      console.log('🔍 User not found');
      callback(null, null);
    }
  } catch (err) {
    console.error('❌ Error in getUserByEmail:', err);
    callback(err, null);
  }
};

const createDispute = async (disputeData, callback) => {
  const { title, creator_id, participant_ids } = disputeData;

  const client = await pool.connect();
  
  try {
    await client.query('BEGIN');

    // Encrypt the dispute title
    const titleEncrypted = encryption.encryptText(title);
    
    // Create dispute
    const disputeResult = await client.query(
      'INSERT INTO disputes(title_encrypted, creator_id, status) VALUES ($1, $2, $3) RETURNING id',
      [titleEncrypted, creator_id, 'incomplete']
    );
    const dispute_id = disputeResult.rows[0].id;

    // Add creator as accepted participant
    await client.query(
      'INSERT INTO dispute_participants (dispute_id, user_id, status, joined_at) VALUES ($1, $2, $3, CURRENT_TIMESTAMP)',
      [dispute_id, creator_id, 'accepted']
    );

    // Add other participants as invited
    if (participant_ids && participant_ids.length > 0) {
      for (const user_id of participant_ids) {
        await client.query(
          'INSERT INTO dispute_participants (dispute_id, user_id, status) VALUES ($1, $2, $3)',
          [dispute_id, user_id, 'invited']
        );
      }
    }

    await client.query('COMMIT');
    callback(null, {id: dispute_id, title, creator_id, status: 'incomplete'});
  } catch (err) {
    await client.query('ROLLBACK');
    callback(err, null);
  } finally {
    client.release();
  }
};

const deleteDispute = async (dispute_id, user_id, callback) => {
  const client = await pool.connect();
  
  try {
    await client.query('BEGIN');
    
    // First, verify that the user is the creator of the dispute
    const disputeCheck = await client.query(
      'SELECT creator_id FROM disputes WHERE id = $1',
      [dispute_id]
    );
    
    if (disputeCheck.rows.length === 0) {
      throw new Error('Dispute not found');
    }
    
    if (disputeCheck.rows[0].creator_id !== user_id) {
      throw new Error('Only the dispute creator can delete the dispute');
    }
    
    // Delete all participant records (including pending invitations)
    await client.query(
      'DELETE FROM dispute_participants WHERE dispute_id = $1',
      [dispute_id]
    );
    
    // Delete the dispute itself
    const result = await client.query(
      'DELETE FROM disputes WHERE id = $1',
      [dispute_id]
    );
    
    await client.query('COMMIT');
    callback(null, { 
      dispute_id, 
      deleted: result.rowCount > 0,
      message: 'Dispute deleted successfully'
    });
  } catch (err) {
    await client.query('ROLLBACK');
    callback(err, null);
  } finally {
    client.release();
  }
};

const addParticipantsToDispute = (dispute_id, participant_ids, callback) => {
  if (!participant_ids || participant_ids.length === 0) {
    return callback(new Error('No participant IDs provided'));
  }
  
  // Create the values string for the SQL query
  const values = participant_ids.map((_, index) => {
    const offset = index * 2;
    return `($${offset + 1}, $${offset + 2})`;
  }).join(', ');
  
  // Create the parameters array
  const params = [];
  participant_ids.forEach(participant_id => {
    params.push(dispute_id, participant_id);
  });
  
  const query = `
    INSERT INTO dispute_participants (dispute_id, user_id, status, joined_at) 
    VALUES ${values}
  `;
  
  pool.query(query, params, (err, result) => {
    if (err) {
      console.error('Database error adding participants to dispute:', err);
      return callback(err);
    }
    
    console.log(`Added ${result.rowCount} participants to dispute ${dispute_id}`);
    callback(null, result);
  });
};

const getDisputesByUser = async (user_id, callback) => {
  try {
    const result = await pool.query(`
      SELECT DISTINCT 
        d.id,
        d.title_encrypted,
        d.creator_id,
        d.status,
        d.verdict_encrypted,
        d.created_at,
        u.name_encrypted as creator_name_encrypted,
        dp.status as user_participation_status
      FROM disputes d
      JOIN users u ON d.creator_id = u.id 
      JOIN dispute_participants dp ON d.id = dp.dispute_id
      WHERE dp.user_id = $1
      ORDER BY d.created_at DESC
    `, [user_id]);

    // Decrypt the results
    const decryptedDisputes = result.rows.map(row => ({
      id: row.id,
      title: encryption.decrypt(row.title_encrypted),
      creator_id: row.creator_id,
      status: row.status,
      verdict: row.verdict_encrypted ? encryption.decrypt(row.verdict_encrypted) : null,
      created_at: row.created_at,
      creator_name: encryption.decrypt(row.creator_name_encrypted),
      user_participation_status: row.user_participation_status
    }));
    
    callback(null, decryptedDisputes);
  } catch (err) {
    callback(err, null);
  }
};

const getDisputeById = async (dispute_id, callback) => {
  try {
    const disputeResult = await pool.query(`
      SELECT
        d.id,
        d.title_encrypted,
        d.creator_id,
        d.status,
        d.current_round,
        d.verdict_encrypted,
        d.created_at,
        u.name_encrypted as creator_name_encrypted,
        u.email_encrypted as creator_email_encrypted
      FROM disputes d
      JOIN users u on d.creator_id = u.id 
      WHERE d.id = $1
    `, [dispute_id]);
    
    const dispute = disputeResult.rows[0];
    
    if (!dispute) {
      callback(null, null);
      return;
    }
    // Decrypt dispute data
    const decryptedDispute = {
      id: dispute.id,
      title: encryption.decrypt(dispute.title_encrypted),
      creator_id: dispute.creator_id,
      status: dispute.status,
      verdict: dispute.verdict_encrypted ? encryption.decrypt(dispute.verdict_encrypted) : null,
      created_at: dispute.created_at,
      creator_name: encryption.decrypt(dispute.creator_name_encrypted),
      creator_email: encryption.decrypt(dispute.creator_email_encrypted)
    };
    
    const participantsResult = await pool.query(`
      SELECT
        dp.user_id,
        dp.status,
        dp.response_text_encrypted,
        dp.joined_at,
        dp.response_submitted_at,
        u.name_encrypted,
        u.email_encrypted 
      FROM dispute_participants dp 
      JOIN users u ON dp.user_id = u.id 
      WHERE dp.dispute_id = $1 
      ORDER BY dp.created_at ASC
    `, [dispute_id]);


        // Check if we have new tables for multi-round data
    let hasMultiRoundTables = false;
    try {
      await pool.query('SELECT 1 FROM dispute_responses LIMIT 1');
      hasMultiRoundTables = true;
    } catch (e) {
      // Tables don't exist yet, use old structure
    }
   if (hasMultiRoundTables) {
      // Get all responses across all rounds from new table
      const responsesResult = await pool.query(`
        SELECT
          dr.user_id,
          dr.round_number,
          dr.response_text_encrypted,
          dr.submitted_at,
          u.name_encrypted
        FROM dispute_responses dr
        JOIN users u ON dr.user_id = u.id
        WHERE dr.dispute_id = $1
        ORDER BY dr.round_number ASC, dr.submitted_at ASC
      `, [dispute_id]);

      // Get all verdicts across all rounds
      const verdictsResult = await pool.query(`
        SELECT
          dv.round_number,
          dv.verdict_encrypted,
          dv.generated_at
        FROM dispute_verdicts dv
        WHERE dv.dispute_id = $1
        ORDER BY dv.round_number ASC
      `, [dispute_id]);

      // Get participant satisfaction for current round
      const satisfactionResult = await pool.query(`
        SELECT
          ps.user_id,
          ps.round_number,
          ps.is_satisfied,
          ps.responded_at
        FROM participant_satisfaction ps
        WHERE ps.dispute_id = $1 AND ps.round_number = $2
      `, [dispute_id, dispute.current_round]);

      // Organize responses by round
      const responsesByRound = {};
      responsesResult.rows.forEach(row => {
        if (!responsesByRound[row.round_number]) {
          responsesByRound[row.round_number] = [];
        }
        responsesByRound[row.round_number].push({
          user_id: row.user_id,
          name: encryption.decrypt(row.name_encrypted),
          response_text: encryption.decrypt(row.response_text_encrypted),
          submitted_at: row.submitted_at
        });
      });
      decryptedDispute.responses_by_round = responsesByRound;

      // Decrypt verdicts
      decryptedDispute.verdicts = verdictsResult.rows.map(row => ({
        round_number: row.round_number,
        verdict: encryption.decrypt(row.verdict_encrypted),
        generated_at: row.generated_at
      }));

    // Add satisfaction data
      decryptedDispute.satisfaction = satisfactionResult.rows.map(row => ({
        user_id: row.user_id,
        round_number: row.round_number,
        is_satisfied: row.is_satisfied,
        responded_at: row.responded_at
      }));
    } else {
      // Use existing structure for backward compatibility
      decryptedDispute.responses_by_round = {};
      decryptedDispute.verdicts = [];
      decryptedDispute.satisfaction = [];
      
      // Convert old verdict to new format
      if (dispute.verdict_encrypted) {
        decryptedDispute.verdicts = [{
          round_number: 1,
          verdict: encryption.decrypt(dispute.verdict_encrypted),
          generated_at: dispute.updated_at
        }];
      }
    }

    // Decrypt participant data
    decryptedDispute.participants = participantsResult.rows.map(row => ({
      user_id: row.user_id,
      status: row.status,
      response_text: row.response_text_encrypted ? encryption.decrypt(row.response_text_encrypted) : null,
      joined_at: row.joined_at,
      response_submitted_at: row.response_submitted_at,
      name: encryption.decrypt(row.name_encrypted),
      email: encryption.decrypt(row.email_encrypted)
    }));

   // For backward compatibility, also add old verdict field
    decryptedDispute.verdict = decryptedDispute.verdicts.length > 0 ? 
      decryptedDispute.verdicts[decryptedDispute.verdicts.length - 1].verdict : null;


    callback(null, decryptedDispute);
  } catch (err) {
    callback(err, null);
  }
};




const updateParticipantStatus = async (dispute_id, user_id, status, callback) => {
  const client = await pool.connect();
  
  try {
    await client.query('BEGIN');
    
    // Update participant status
    const result = await client.query(`
      UPDATE dispute_participants 
      SET status = $1, joined_at = CASE WHEN $1 = 'accepted' THEN CURRENT_TIMESTAMP ELSE joined_at END, updated_at = CURRENT_TIMESTAMP
      WHERE dispute_id = $2 AND user_id = $3
    `, [status, dispute_id, user_id]);
    
    if (result.rowCount === 0) {
      throw new Error('Participant not found');
    }
    
    // If someone rejected, mark the entire dispute as rejected
    if (status === 'rejected') {
      await client.query(`
        UPDATE disputes 
        SET status = 'rejected', updated_at = CURRENT_TIMESTAMP 
        WHERE id = $1
      `, [dispute_id]);
    }
    
    await client.query('COMMIT');
    callback(null, { dispute_id, user_id, status });
  } catch (err) {
    await client.query('ROLLBACK');
    callback(err, null);
  } finally {
    client.release();
  }
};

const leaveDispute = async (dispute_id, user_id, callback) => {
  const client = await pool.connect();
  
  try {
    await client.query('BEGIN');
    
    // Check if the user is a participant in this dispute
    const participantCheck = await client.query(
      'SELECT dp.status, d.creator_id, d.status as dispute_status FROM dispute_participants dp JOIN disputes d ON dp.dispute_id = d.id WHERE dp.dispute_id = $1 AND dp.user_id = $2',
      [dispute_id, user_id]
    );
    
    if (participantCheck.rows.length === 0) {
      throw new Error('You are not a participant in this dispute');
    }
    
    const participant = participantCheck.rows[0];
    
    // Don't allow the creator to leave their own dispute
    if (participant.creator_id === user_id) {
      throw new Error('Dispute creators cannot leave their own dispute. Use delete instead.');
    }
    
    // Don't allow leaving if the dispute is already completed or resolved
    if (participant.dispute_status === 'concluded') {
      throw new Error('Cannot leave a completed dispute');
    }
    
    // Remove the participant from the dispute
    const result = await client.query(
      'DELETE FROM dispute_participants WHERE dispute_id = $1 AND user_id = $2',
      [dispute_id, user_id]
    );
    
    // Check if there are any remaining accepted participants
    const remainingParticipants = await client.query(`
      SELECT COUNT(*) as count 
      FROM dispute_participants 
      WHERE dispute_id = $1 AND status = 'accepted'
    `, [dispute_id]);
    
    // If no accepted participants remain (only creator), mark dispute as cancelled
    if (parseInt(remainingParticipants.rows[0].count) <= 1) {
      await client.query(
        'UPDATE disputes SET status = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2',
        ['cancelled', dispute_id]
      );
    }
    
    await client.query('COMMIT');
    callback(null, { 
      dispute_id, 
      user_id, 
      left: result.rowCount > 0,
      message: 'You have left the dispute'
    });
  } catch (err) {
    await client.query('ROLLBACK');
    callback(err, null);
  } finally {
    client.release();
  }
};

const submitDisputeResponse = async (dispute_id, user_id, response_text, callback) => {
  const client = await pool.connect();
  
  try {
    await client.query('BEGIN');

    // Check if user is accepted participant and get current round
    const participantCheck = await client.query(`
      SELECT dp.status, d.status as dispute_status, d.current_round
      FROM dispute_participants dp
      JOIN disputes d ON dp.dispute_id = d.id
      WHERE dp.dispute_id = $1 AND dp.user_id = $2
    `, [dispute_id, user_id]);

    if (participantCheck.rows.length === 0 || participantCheck.rows[0].status !== 'accepted') {
      throw new Error('Participant not found or not accepted');
    }

    const disputeStatus = participantCheck.rows[0].dispute_status;
    const currentRound = participantCheck.rows[0].current_round || 1;

    if (disputeStatus === 'concluded' || disputeStatus === 'cancelled' || disputeStatus === 'rejected') {
      throw new Error('Cannot submit response to completed dispute');
    }

    // Encrypt response text
    const responseTextEncrypted = encryption.encryptText(response_text);
    
    // Check if we have new tables
    let hasMultiRoundTables = false;
    try {
      await client.query('SELECT 1 FROM dispute_responses LIMIT 1');
      hasMultiRoundTables = true;
    } catch (e) {
      // Tables don't exist yet
    }
    // Initialize variables that will be used in both code paths
    let roundCompleted = false;
    let totalAccepted = 0;
    let responsesSubmitted = 0;

    if (hasMultiRoundTables) {
      // Insert or update response for current round in new table
      await client.query(`
        INSERT INTO dispute_responses (dispute_id, user_id, round_number, response_text_encrypted, submitted_at)
        VALUES ($1, $2, $3, $4, CURRENT_TIMESTAMP)
        ON CONFLICT (dispute_id, user_id, round_number)
        DO UPDATE SET 
          response_text_encrypted = EXCLUDED.response_text_encrypted,
          submitted_at = CURRENT_TIMESTAMP
      `, [dispute_id, user_id, currentRound, responseTextEncrypted]);

      console.log(`=== QUERY PARAMETERS DEBUG ===`);
      console.log(`dispute_id: ${dispute_id} (type: ${typeof dispute_id})`);
      console.log(`currentRound: ${currentRound} (type: ${typeof currentRound})`);
      console.log(`Query parameters array:`, [dispute_id, currentRound]);
      console.log(`===============================`);

     // Check if all accepted participants have submitted responses for current round
      const completionCheck = await client.query(`
        SELECT 
          COUNT(CASE WHEN dp.status = 'accepted' THEN 1 END) as total_accepted,
          COUNT(CASE WHEN dp.status = 'accepted' AND dr.user_id IS NOT NULL THEN 1 END) as responses_submitted,
          COUNT(CASE WHEN dp.status = 'invited' THEN 1 END) as still_invited,
          COUNT(CASE WHEN dp.status = 'rejected' THEN 1 END) as rejected_count
        FROM dispute_participants dp
        LEFT JOIN dispute_responses dr ON (dp.dispute_id = dr.dispute_id AND dp.user_id = dr.user_id AND dr.round_number = $2)
        WHERE dp.dispute_id = $1 AND dp.status = 'accepted'
      `, [dispute_id, currentRound]);

      console.log(`RAW SQL RESULT:`, JSON.stringify(completionCheck.rows[0], null, 2));
      console.log(`Raw still_invited value:`, completionCheck.rows[0].still_invited);
      console.log(`Type of still_invited:`, typeof completionCheck.rows[0].still_invited);

      const totalAccepted = parseInt(completionCheck.rows[0].total_accepted);
      const responsesSubmitted = parseInt(completionCheck.rows[0].responses_submitted);
      const stillInvited = parseInt(completionCheck.rows[0].still_invited);
      const rejectedCount = parseInt(completionCheck.rows[0].rejected_count);


      // Round is only completed when:
      // 1. No one is still 'invited' (all invitations resolved)
      // 2. All accepted participants have responded
      // 3. There's at least one response
      const allInvitationsResolved = stillInvited === 0;
      const allAcceptedHaveResponded = totalAccepted === responsesSubmitted;
      const roundCompleted = allInvitationsResolved && allAcceptedHaveResponded && responsesSubmitted > 0;

      console.log(`=== COMPLETION CHECK DEBUG ===`);
      console.log(`Dispute ${dispute_id}, Round ${currentRound}:`);
      console.log(`- Total accepted: ${totalAccepted}`);
      console.log(`- Responses submitted: ${responsesSubmitted}`);
      console.log(`- Still invited: ${stillInvited}`);
      console.log(`- Rejected: ${rejectedCount}`);
      console.log(`- All invitations resolved: ${allInvitationsResolved}`);
      console.log(`- All accepted have responded: ${allAcceptedHaveResponded}`);
      console.log(`- Round completed: ${roundCompleted}`);
      console.log(`===============================`);

      // If round is complete and dispute is incomplete, mark as evaluated and generate verdict
      if (roundCompleted && disputeStatus === 'incomplete') {
        await client.query(`
          UPDATE disputes 
          SET status = 'evaluated', updated_at = CURRENT_TIMESTAMP 
          WHERE id = $1
        `, [dispute_id]);
      }
    } else {
      // Use existing structure for backward compatibility
      await client.query(`
        UPDATE dispute_participants 
        SET response_text_encrypted = $1, response_submitted_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP
        WHERE dispute_id = $2 AND user_id = $3 AND status = 'accepted'
      `, [responseTextEncrypted, dispute_id, user_id]);

      // Check completion using old logic
      const checkResult = await client.query(`
        SELECT 
          COUNT(*) as total_participants,
          SUM(CASE WHEN status = 'accepted' AND response_text_encrypted IS NOT NULL THEN 1 ELSE 0 END) as responded_count,
          SUM(CASE WHEN status = 'accepted' AND response_text_encrypted IS NULL THEN 1 ELSE 0 END) as accepted_not_responded,
          SUM(CASE WHEN status = 'invited' THEN 1 ELSE 0 END) as still_invited
        FROM dispute_participants 
        WHERE dispute_id = $1
      `, [dispute_id]);
      
      const checkData = checkResult.rows[0];
      const allInvitationsResolved = parseInt(checkData.still_invited) === 0;
      const allAcceptedHaveResponded = parseInt(checkData.accepted_not_responded) === 0;
      
     // Set the variables for consistency with new system
      totalAccepted = parseInt(checkData.responded_count) + parseInt(checkData.accepted_not_responded);
      responsesSubmitted = parseInt(checkData.responded_count);
      roundCompleted = allInvitationsResolved && allAcceptedHaveResponded && responsesSubmitted > 0;
 
      
      if (roundCompleted && disputeStatus === 'incomplete') {
        await client.query(`
          UPDATE disputes 
          SET status = 'evaluated', updated_at = CURRENT_TIMESTAMP 
          WHERE id = $1
        `, [dispute_id]);
      }
    }

    await client.query('COMMIT');
    
    callback(null, {
      dispute_id,
      user_id,
      round_completed: hasMultiRoundTables ? (totalAccepted === responsesSubmitted && totalAccepted > 0) : roundCompleted,
      current_round: currentRound,
      status: (hasMultiRoundTables ? 
        (totalAccepted === responsesSubmitted && totalAccepted > 0 && disputeStatus === 'incomplete' ? 'evaluated' : disputeStatus) :
        (roundCompleted && disputeStatus === 'incomplete' ? 'evaluated' : disputeStatus))
    });

    // If round completed, generate verdict asynchronously
    if ((hasMultiRoundTables ? (totalAccepted === responsesSubmitted && totalAccepted > 0) : roundCompleted) && disputeStatus === 'incomplete') {
      generateVerdictForRound(dispute_id, currentRound);
    }

  } catch (err) {
    await client.query('ROLLBACK');
    callback(err, null);
  } finally {
    client.release();
  }
};

// New function to submit satisfaction response
const submitSatisfactionResponse = async (dispute_id, user_id, is_satisfied, additional_response, callback) => {
  const client = await pool.connect();
  
  try {
    await client.query('BEGIN');

    // Check if we have new tables
    let hasMultiRoundTables = false;
    try {
      await client.query('SELECT 1 FROM participant_satisfaction LIMIT 1');
      hasMultiRoundTables = true;
    } catch (e) {
      return callback(new Error('Multi-round tables not yet created. Please run migration first.'), null);
    }

    // Get current round and dispute status
    const disputeCheck = await client.query(`
      SELECT d.current_round, d.status
      FROM disputes d
      WHERE d.id = $1
    `, [dispute_id]);

    if (disputeCheck.rows.length === 0) {
      throw new Error('Dispute not found');
    }

    const currentRound = disputeCheck.rows[0].current_round || 1;
    const disputeStatus = disputeCheck.rows[0].status;

    if (disputeStatus !== 'evaluated') {
      throw new Error('Cannot submit satisfaction response - dispute not in evaluated state');
    }

    // Record satisfaction response
    await client.query(`
      INSERT INTO participant_satisfaction (dispute_id, user_id, round_number, is_satisfied)
      VALUES ($1, $2, $3, $4)
      ON CONFLICT (dispute_id, user_id, round_number)
      DO UPDATE SET 
        is_satisfied = EXCLUDED.is_satisfied,
        responded_at = CURRENT_TIMESTAMP
    `, [dispute_id, user_id, currentRound, is_satisfied]);

    // If not satisfied and provided additional response, add it to next round
    if (!is_satisfied && additional_response && additional_response.trim()) {
      const nextRound = currentRound + 1;
      const responseTextEncrypted = encryption.encryptText(additional_response.trim());
      
      await client.query(`
        INSERT INTO dispute_responses (dispute_id, user_id, round_number, response_text_encrypted, submitted_at)
        VALUES ($1, $2, $3, $4, CURRENT_TIMESTAMP)
        ON CONFLICT (dispute_id, user_id, round_number)
        DO UPDATE SET 
          response_text_encrypted = EXCLUDED.response_text_encrypted,
          submitted_at = CURRENT_TIMESTAMP
      `, [dispute_id, user_id, nextRound, responseTextEncrypted]);
    }


    // Check if all participants have responded to satisfaction question
    const satisfactionCheck = await client.query(`
      SELECT 
        COUNT(dp.user_id) as total_participants,
        COUNT(ps.user_id) as satisfaction_responses,
        COUNT(CASE WHEN ps.is_satisfied = true THEN 1 END) as satisfied_count,
        COUNT(CASE WHEN ps.is_satisfied = false THEN 1 END) as unsatisfied_count
      FROM dispute_participants dp
      LEFT JOIN participant_satisfaction ps ON (dp.dispute_id = ps.dispute_id AND dp.user_id = ps.user_id AND ps.round_number = $2)
      WHERE dp.dispute_id = $1 AND dp.status = 'accepted'
    `, [dispute_id, currentRound]);

    const totalParticipants = parseInt(satisfactionCheck.rows[0].total_participants);
    const satisfactionResponses = parseInt(satisfactionCheck.rows[0].satisfaction_responses);
    const satisfiedCount = parseInt(satisfactionCheck.rows[0].satisfied_count);
    const unsatisfiedCount = parseInt(satisfactionCheck.rows[0].unsatisfied_count);

    let newStatus = disputeStatus;
    let newRound = currentRound;

    // If everyone has responded to satisfaction
    if (totalParticipants === satisfactionResponses) {
      if (satisfiedCount === totalParticipants) {
        // Everyone satisfied - conclude dispute
        newStatus = 'concluded';
        await client.query(`
          UPDATE disputes 
          SET status = 'concluded', updated_at = CURRENT_TIMESTAMP 
          WHERE id = $1
        `, [dispute_id]);
      } else if (unsatisfiedCount > 0) {
        // Some unsatisfied - start new round
        newRound = currentRound + 1;
        newStatus = 'incomplete';
        await client.query(`
          UPDATE disputes 
          SET status = 'incomplete', current_round = $2, updated_at = CURRENT_TIMESTAMP 
          WHERE id = $1
        `, [dispute_id, newRound]);
      }
    }

    await client.query('COMMIT');

    callback(null, {
      dispute_id,
      user_id,
      current_round: newRound,
      status: newStatus,
      all_satisfied: satisfiedCount === totalParticipants && totalParticipants === satisfactionResponses
    });

    // If new round started and all have additional responses, generate new verdict
    if (newStatus === 'incomplete' && newRound > currentRound) {
      checkAndGenerateNewRoundVerdict(dispute_id, newRound);
    }

  } catch (err) {
    await client.query('ROLLBACK');
    callback(err, null);
  } finally {
    client.release();
  }
};

// Generate verdict for a specific round
const generateVerdictForRound = async (dispute_id, round_number) => {
  try {
    // Check if we have new tables
    let hasMultiRoundTables = false;
    try {
      await pool.query('SELECT 1 FROM dispute_responses LIMIT 1');
      hasMultiRoundTables = true;
    } catch (e) {
      // Fall back to old verdict generation
      const { checkAndGenerateVerdict } = require('./database');
      return checkAndGenerateVerdict(dispute_id, () => {});
    }

    // Get all responses up to this round
    const responsesResult = await pool.query(`
      SELECT 
        dr.round_number,
        dr.response_text_encrypted,
        u.name_encrypted
      FROM dispute_responses dr
      JOIN users u ON dr.user_id = u.id
      WHERE dr.dispute_id = $1 AND dr.round_number <= $2
      ORDER BY dr.round_number ASC, dr.submitted_at ASC
    `, [dispute_id, round_number]);

    // Get dispute info
    const disputeResult = await pool.query(`
      SELECT d.title_encrypted, u.name_encrypted as creator_name_encrypted
      FROM disputes d
      JOIN users u ON d.creator_id = u.id
      WHERE d.id = $1
    `, [dispute_id]);

    if (disputeResult.rows.length === 0) {
      throw new Error('Dispute not found');
    }

    // Decrypt and format data for Claude
    const disputeData = {
      id: dispute_id,
      title: encryption.decrypt(disputeResult.rows[0].title_encrypted),
      creator_name: encryption.decrypt(disputeResult.rows[0].creator_name_encrypted),
      round_number: round_number,
      all_responses: responsesResult.rows.map(row => ({
        round: row.round_number,
        name: encryption.decrypt(row.name_encrypted),
        response_text: encryption.decrypt(row.response_text_encrypted)
      }))
    };


    // Generate verdict
    const verdict = await generateVerdict(disputeData);

    // Save verdict
    const verdictEncrypted = encryption.encryptText(verdict);
    await pool.query(`
      INSERT INTO dispute_verdicts (dispute_id, round_number, verdict_encrypted)
      VALUES ($1, $2, $3)
      ON CONFLICT (dispute_id, round_number)
      DO UPDATE SET 
        verdict_encrypted = EXCLUDED.verdict_encrypted,
        generated_at = CURRENT_TIMESTAMP
    `, [dispute_id, round_number, verdictEncrypted]);

    console.log(`Verdict generated for dispute ${dispute_id}, round ${round_number}`);
  } catch (error) {
    console.error(`Error generating verdict for dispute ${dispute_id}, round ${round_number}:`, error);
  }
};

// Check if new round is ready for verdict generation
const checkAndGenerateNewRoundVerdict = async (dispute_id, round_number) => {
  try {
    // Check if all participants have submitted responses for this round
    const checkResult = await pool.query(`
      SELECT 
        COUNT(CASE WHEN dp.status = 'accepted' THEN 1 END) as total_accepted,
        COUNT(CASE WHEN dp.status = 'accepted' AND dr.user_id IS NOT NULL THEN 1 END) as responses_submitted,
        COUNT(CASE WHEN dp.status = 'invited' THEN 1 END) as still_invited,
        COUNT(CASE WHEN dp.status = 'rejected' THEN 1 END) as rejected_count
      FROM dispute_participants dp
      LEFT JOIN dispute_responses dr ON (dp.dispute_id = dr.dispute_id AND dp.user_id = dr.user_id AND dr.round_number = $2)
      WHERE dp.dispute_id = $1
    `, [dispute_id, round_number]);

    const totalAccepted = parseInt(checkResult.rows[0].total_accepted);
    const responsesSubmitted = parseInt(checkResult.rows[0].responses_submitted);
    const stillInvited = parseInt(checkResult.rows[0].still_invited);

    // Round is only completed when:
    // 1. No one is still 'invited' (all invitations resolved)
    // 2. All accepted participants have responded
    // 3. There's at least one response
    const allInvitationsResolved = stillInvited === 0;
    const allAcceptedHaveResponded = totalAccepted === responsesSubmitted;
    const roundCompleted = allInvitationsResolved && allAcceptedHaveResponded && responsesSubmitted > 0;

    console.log(`=== NEW ROUND VERDICT CHECK ===`);
    console.log(`Dispute ${dispute_id}, Round ${round_number}:`);
    console.log(`- Total accepted: ${totalAccepted}`);
    console.log(`- Responses submitted: ${responsesSubmitted}`);
    console.log(`- Still invited: ${stillInvited}`);
    console.log(`- All invitations resolved: ${allInvitationsResolved}`);
    console.log(`- All accepted have responded: ${allAcceptedHaveResponded}`);
    console.log(`- Round completed: ${roundCompleted}`);
    console.log(`===============================`);

    if (roundCompleted) {
      // Update dispute status to evaluated
      await pool.query(`
        UPDATE disputes 
        SET status = 'evaluated', updated_at = CURRENT_TIMESTAMP 
        WHERE id = $1
      `, [dispute_id]);

      // Generate verdict
      generateVerdictForRound(dispute_id, round_number);
    }
  } catch (error) {
    console.error(`Error checking round completion for dispute ${dispute_id}, round ${round_number}:`, error);
  }
};

const updateDisputeVerdict = async (dispute_id, verdict, callback) => {
  try {
    // Encrypt the verdict before storing
    const verdictEncrypted = encryption.encryptText(verdict);

    const result = await pool.query(`
      UPDATE disputes 
      SET verdict_encrypted = $1, updated_at = CURRENT_TIMESTAMP 
      WHERE id = $2
    `, [verdictEncrypted, dispute_id]);
    
    callback(null, { dispute_id, verdict, updated: result.rowCount > 0 });
  } catch (err) {
    callback(err, null);
  }
};

// Save a pre-generated verdict for a specific round
const saveVerdictForRound = async (dispute_id, round_number, verdict) => {
  try {
    const verdictEncrypted = encryption.encryptText(verdict);
    await pool.query(`
      INSERT INTO dispute_verdicts (dispute_id, round_number, verdict_encrypted)
      VALUES ($1, $2, $3)
      ON CONFLICT (dispute_id, round_number)
      DO UPDATE SET 
        verdict_encrypted = EXCLUDED.verdict_encrypted,
        generated_at = CURRENT_TIMESTAMP
    `, [dispute_id, round_number, verdictEncrypted]);

    console.log(`Verdict saved for dispute ${dispute_id}, round ${round_number}`);
  } catch (error) {
    console.error(`Error saving verdict for dispute ${dispute_id}, round ${round_number}:`, error);
    throw error;
  }
};


const createContactRequest = async (requesterEmail, recipientEmail, callback) => {
  try {

    console.log('📞 Creating encrypted contact request');
    // Get the requester using email hash
    const requesterEmailHash = encryption.hashForSearch(requesterEmail);
    const requesterResult = await pool.query('SELECT * FROM users WHERE email_hash = $1', [requesterEmailHash]);
    const requester = requesterResult.rows[0];
    
    if (!requester) {
      return callback(new Error('Requester not found'), null);
    }

    // Check if recipient exists using email hash
    const recipientEmailHash = encryption.hashForSearch(recipientEmail);
    const recipientResult = await pool.query('SELECT * FROM users WHERE email_hash = $1', [recipientEmailHash]);
    const recipient = recipientResult.rows[0];

    // Encrypt recipient email
    const recipientEmailEncrypted = encryption.encryptEmail(recipientEmail);
    
    const insertResult = await pool.query(`
      INSERT INTO contacts (requester_id, recipient_id, recipient_email_encrypted, recipient_email_hash, status) 
      VALUES ($1, $2, $3, $4, 'pending') RETURNING id
    `, [requester.id, recipient ? recipient.id : null, recipientEmailEncrypted, recipientEmailHash]);
    
    callback(null, { 
      id: insertResult.rows[0].id, 
      requesterEmail, 
      recipientEmail,
      recipientExists: !!recipient,
      status: 'pending'
    });
  } catch (err) {
    callback(err, null);
  }
};

const getUserContacts = async (userEmail, callback) => {
  try {
    const userEmailHash = encryption.hashForSearch(userEmail);
    const userResult = await pool.query('SELECT * FROM users WHERE email_hash = $1', [userEmailHash]);
    const user = userResult.rows[0];
    
    if (!user) {
      return callback(new Error('User not found'), null);
    }

    // Get accepted contacts
    const contactsResult = await pool.query(`
      SELECT 
        c.id,
        c.status,
        c.created_at,
        CASE 
          WHEN c.requester_id = $1 THEN ru.name_encrypted 
          ELSE rq.name_encrypted 
        END as contact_name_encrypted,
        CASE 
          WHEN c.requester_id = $1 THEN ru.email_encrypted 
          ELSE rq.email_encrypted 
        END as contact_email_encrypted
      FROM contacts c
      LEFT JOIN users rq ON c.requester_id = rq.id
      LEFT JOIN users ru ON c.recipient_id = ru.id
      WHERE (c.requester_id = $1 OR c.recipient_id = $1) 
        AND c.status = 'accepted'
    `, [user.id]);
    

       // Decrypt contacts
    const contacts = contactsResult.rows.map(row => ({
      id: row.id,
      status: row.status,
      created_at: row.created_at,
      contact_name: encryption.decrypt(row.contact_name_encrypted),
      contact_email: encryption.decrypt(row.contact_email_encrypted)
    }));


    // Get pending requests
    const pendingResult = await pool.query(`
      SELECT 
        c.id,
        c.status,
        c.created_at,
        rq.name_encrypted as requester_name_encrypted,
        rq.email_encrypted as requester_email_encrypted
      FROM contacts c
      JOIN users rq ON c.requester_id = rq.id
      WHERE c.recipient_id = $1 AND c.status = 'pending'
    `, [user.id]);


    // Decrypt pending requests
    const pendingRequests = pendingResult.rows.map(row => ({
      id: row.id,
      status: row.status,
      created_at: row.created_at,
      requester_name: encryption.decrypt(row.requester_name_encrypted),
      requester_email: encryption.decrypt(row.requester_email_encrypted)
    }));


    // Get outgoing pending requests (where user is requester)
    const outgoingPendingResult = await pool.query(`
      SELECT 
        c.id,
        c.status,
        c.created_at,
        c.recipient_email_encrypted,
        ru.name_encrypted as recipient_name_encrypted,
        ru.email_encrypted as recipient_email_encrypted_from_user
      FROM contacts c
      LEFT JOIN users ru ON c.recipient_id = ru.id
      WHERE c.requester_id = $1 AND c.status = 'pending'
    `, [user.id]);

    // Decrypt outgoing pending requests
    const outgoingPendingRequests = outgoingPendingResult.rows.map(row => ({
      id: row.id,
      status: row.status,
      created_at: row.created_at,
      // If recipient exists in users table, use their name, otherwise use email
      recipient_name: row.recipient_name_encrypted ? 
        encryption.decrypt(row.recipient_name_encrypted) : 
        encryption.decrypt(row.recipient_email_encrypted).split('@')[0], // Use email prefix as fallback
      recipient_email: row.recipient_email_encrypted_from_user ? 
        encryption.decrypt(row.recipient_email_encrypted_from_user) : 
        encryption.decrypt(row.recipient_email_encrypted)
    }));
        
    callback(null, { contacts, pendingRequests, outgoingPendingRequests });
  } catch (err) {
    callback(err, null);
  }
};

const updateContactRequest = async (requestId, status, callback) => {
  try {
    const result = await pool.query(`
      UPDATE contacts 
      SET status = $1, updated_at = CURRENT_TIMESTAMP 
      WHERE id = $2
    `, [status, requestId]);
    
    callback(null, { id: requestId, status, updated: result.rowCount > 0 });
  } catch (err) {
    callback(err, null);
  }
};

const deleteContact = async (contactId, userEmail, callback) => {
  try {
    const userEmailHash = encryption.hashForSearch(userEmail);
    const userResult = await pool.query('SELECT * FROM users WHERE email_hash = $1', [userEmailHash]);
    const user = userResult.rows[0];
    
    if (!user) {
      return callback(new Error('User not found'), null);
    }

   // Delete either:
    // 1. Accepted contacts where the user is either the requester or recipient, OR
    // 2. Pending requests where the user is the requester (allowing users to cancel their own pending requests)
    const result = await pool.query(`
      DELETE FROM contacts 
      WHERE id = $1 
        AND (
          (requester_id = $2 OR recipient_id = $2) AND status = 'accepted'
          OR 
          requester_id = $2 AND status = 'pending'
        )
    `, [contactId, user.id]);
    
    callback(null, { 
      contactId, 
      deleted: result.rowCount > 0 
    });
  } catch (err) {
    callback(err, null);
  }
};

const checkExistingContact = async (userEmail, contactEmail, callback) => {
  try {
    const userEmailHash = encryption.hashForSearch(userEmail);
    const contactEmailHash = encryption.hashForSearch(contactEmail);
    
    const userResult = await pool.query('SELECT * FROM users WHERE email_hash = $1', [userEmailHash]);
    const user = userResult.rows[0];
    
    if (!user) {
      return callback(new Error('User not found'), null);
    }

    // Check for existing accepted contact
    const existingContactResult = await pool.query(`
      SELECT c.id, c.status 
      FROM contacts c
      LEFT JOIN users u1 ON c.requester_id = u1.id
      LEFT JOIN users u2 ON c.recipient_id = u2.id
      WHERE ((c.requester_id = $1 AND c.recipient_email_hash = $2) 
        OR (c.recipient_id = $1 AND u1.email_hash = $2))
        AND c.status = 'accepted'
    `, [user.id, contactEmailHash]);

    if (existingContactResult.rows.length > 0) {
      return callback(null, { exists: true, isPending: false });
    }

    // Check for pending contact request
    const pendingRequestResult = await pool.query(`
      SELECT c.id, c.status 
      FROM contacts c
      LEFT JOIN users u1 ON c.requester_id = u1.id
      WHERE ((c.requester_id = $1 AND c.recipient_email_hash = $2) 
        OR (c.recipient_id = $1 AND u1.email_hash = $2))
        AND c.status = 'pending'
    `, [user.id, contactEmailHash]);

    if (pendingRequestResult.rows.length > 0) {
      return callback(null, { exists: true, isPending: true });
    }

    callback(null, { exists: false, isPending: false });
  } catch (err) {
    callback(err, null);
  }
};


const checkAndGenerateVerdict = async (disputeId, callback) => {
  try {
    // First, check if all participants have submitted responses
    const checkResult = await pool.query(`
      SELECT 
        COUNT(*) as total_participants,
        SUM(CASE WHEN status = 'accepted' AND response_text_encrypted IS NOT NULL THEN 1 ELSE 0 END) as responded_count,
        SUM(CASE WHEN status = 'accepted' AND response_text_encrypted IS NULL THEN 1 ELSE 0 END) as accepted_not_responded,
        SUM(CASE WHEN status = 'invited' THEN 1 ELSE 0 END) as still_invited
      FROM dispute_participants 
      WHERE dispute_id = $1
    `, [disputeId]);
    
    const checkData = checkResult.rows[0];
    const allInvitationsResolved = parseInt(checkData.still_invited) === 0;
    const allAcceptedHaveResponded = parseInt(checkData.accepted_not_responded) === 0;
    
    if (allInvitationsResolved && allAcceptedHaveResponded && parseInt(checkData.responded_count) > 0) {
      // Get dispute data for Claude
      const disputeData = await pool.query(`
        SELECT 
          d.id,
          d.title_encrypted,
          d.status,
          d.created_at,
          u.name_encrypted as creator_name_encrypted
        FROM disputes d
        JOIN users u ON d.creator_id = u.id
        WHERE d.id = $1
      `, [disputeId]);
      
      if (disputeData.rows.length === 0) {
        return callback(new Error('Dispute not found'), null);
      }
      
      // Get all participant responses
      const participantsData = await pool.query(`
        SELECT 
          dp.response_text_encrypted,
          u.name_encrypted
        FROM dispute_participants dp
        JOIN users u ON dp.user_id = u.id
        WHERE dp.dispute_id = $1 AND dp.status = 'accepted' AND dp.response_text_encrypted IS NOT NULL
      `, [disputeId]);
      
      // Decrypt data for Claude
      const dispute = disputeData.rows[0];
      const decryptedDisputeData = {
        id: dispute.id,
        title: encryption.decrypt(dispute.title_encrypted),
        creator_name: encryption.decrypt(dispute.creator_name_encrypted),
        participants: participantsData.rows.map(row => ({
          name: encryption.decrypt(row.name_encrypted),
          response: encryption.decrypt(row.response_text_encrypted)
        }))
      };
      
      // Generate verdict using Claude
      const verdict = await generateVerdict(decryptedDisputeData);
      
      // Encrypt and save verdict to database
      const verdictEncrypted = encryption.encryptText(verdict);
      const result = await pool.query(`
        UPDATE disputes 
        SET verdict_encrypted = $1, status = 'resolved' 
        WHERE id = $2
      `, [verdictEncrypted, disputeId]); // <-- Fixed: use verdict_encrypted
      
      callback(null, { disputeId, verdict, updated: result.rowCount > 0 });
    } else {
      callback(null, { disputeId, verdict: null, updated: false, message: 'Not all participants have responded' });
    }
  } catch (err) {
    callback(err, null);
  }
};

module.exports = {
  pool,
  initDatabase,
  createUser,
  getUserByEmail,
  createContactRequest,
  getUserContacts,
  updateContactRequest,
  deleteContact,
  checkExistingContact,
  createDispute,
  getDisputesByUser,
  getDisputeById,
  updateParticipantStatus,
  submitDisputeResponse,
  updateDisputeVerdict,
  checkAndGenerateVerdict,
  deleteDispute,
  leaveDispute,
  addParticipantsToDispute,
  submitSatisfactionResponse,
  generateVerdictForRound,
  checkAndGenerateNewRoundVerdict,
  saveVerdictForRound
};