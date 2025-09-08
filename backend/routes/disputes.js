const express = require('express');
const jwt = require('jsonwebtoken');
const { 
  createDispute, 
  getDisputesByUser, 
  getDisputeById, 
  updateParticipantStatus, 
  submitDisputeResponse,
  updateDisputeVerdict,
  getUserContacts,
  getUserByEmail,
  deleteDispute,
  leaveDispute,
  addParticipantsToDispute
} = require('../database');

const router = express.Router();
const JWT_SECRET = process.env.JWT_SECRET || 'fallback-secret-for-development';

const { generateVerdict } = require('../services/claude');

// Authentication middleware
const authenticateToken = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({ error: 'Access token required' });
  }

  jwt.verify(token, JWT_SECRET, (err, user) => {
    if (err) {
      return res.status(403).json({ error: 'Invalid or expired token' });
    }
    req.user = user;
    next();
  });
};

// GET /api/disputes - Get all disputes for the authenticated user
router.get('/', authenticateToken, (req, res) => {
  getDisputesByUser(req.user.userId, (err, disputes) => {
    if (err) {
      console.error('Error fetching disputes:', err);
      return res.status(500).json({ error: 'Failed to fetch disputes' });
    }
    
    res.json({ disputes });
  });
});

// POST /api/disputes - Create a new dispute
router.post('/', authenticateToken, (req, res) => {
  const { title, participant_emails } = req.body;
  
  if (!title || !title.trim()) {
    return res.status(400).json({ error: 'Dispute title is required' });
  }
  
  if (!participant_emails || !Array.isArray(participant_emails) || participant_emails.length === 0) {
    return res.status(400).json({ error: 'At least one participant email is required' });
  }
  
  // Get user's contacts to verify they can invite these people

  getUserContacts(req.user.email, (err, result) => {
    console.log('getUserContacts result:', { err, result });
    
    if (err) {
      console.error('Error fetching contacts:', err);
      return res.status(500).json({ error: 'Failed to verify contacts' });
    }
    
    // Create a map of contact emails to user IDs (need to look up user IDs)
    const contactEmails = result.contacts.map(contact => contact.contact_email);
    const contactEmailMap = {};
    
    // Look up user IDs for each contact email
    let completed = 0;
    if (contactEmails.length === 0) {
      return res.status(400).json({ error: 'You need contacts to create a dispute' });
    }
    
    contactEmails.forEach(email => {
      getUserByEmail(email, (err, user) => {
        if (!err && user) {
          contactEmailMap[email] = user.id;
        }
        completed++;
        
        if (completed === contactEmails.length) {
          // Continue with dispute creation logic
          processDisputeCreation();
        }
      });
    });

    function processDisputeCreation() {
    
    // Verify all participant emails are in user's contacts
    const participant_ids = [];
    const invalid_emails = [];
    
    participant_emails.forEach(email => {
      if (contactEmailMap[email]) {
        participant_ids.push(contactEmailMap[email]);
      } else {
        invalid_emails.push(email);
      }
    });
    
    if (invalid_emails.length > 0) {
      return res.status(400).json({ 
        error: `These emails are not in your contacts: ${invalid_emails.join(', ')}` 
      });
    }


    // Create the dispute
    createDispute({
      title: title.trim(),
      creator_id: req.user.userId,
      participant_ids
    }, (err, dispute) => {
      if (err) {
        console.error('Error creating dispute:', err);
        return res.status(500).json({ error: 'Failed to create dispute' });
      }
      
      res.status(201).json({ 
        message: 'Dispute created successfully',
        dispute 
      });
    });
    
    }
  });
});

// GET /api/disputes/:id - Get specific dispute details
router.get('/:id', authenticateToken, (req, res) => {
  const dispute_id = parseInt(req.params.id);
  
  if (isNaN(dispute_id)) {
    return res.status(400).json({ error: 'Invalid dispute ID' });
  }
  
  getDisputeById(dispute_id, (err, dispute) => {
    if (err) {
      console.error('Error fetching dispute:', err);
      return res.status(500).json({ error: 'Failed to fetch dispute' });
    }
    
    if (!dispute) {
      return res.status(404).json({ error: 'Dispute not found' });
    }
    
    // Check if user is a participant in this dispute
    const isParticipant = dispute.participants.some(p => p.user_id === req.user.userId);
    
    if (!isParticipant) {
      return res.status(403).json({ error: 'You are not a participant in this dispute' });
    }
    
    res.json({ dispute });
  });
});

// PUT /api/disputes/:id/join - Accept a dispute invitation
router.put('/:id/join', authenticateToken, (req, res) => {
  const dispute_id = parseInt(req.params.id);
  
  if (isNaN(dispute_id)) {
    return res.status(400).json({ error: 'Invalid dispute ID' });
  }
  
  updateParticipantStatus(dispute_id, req.user.userId, 'accepted', (err, result) => {
    if (err) {
      console.error('Error accepting dispute:', err);
      if (err.message === 'Participant not found') {
        return res.status(404).json({ error: 'Dispute invitation not found' });
      }
      return res.status(500).json({ error: 'Failed to accept dispute' });
    }
    
    res.json({ 
      message: 'Dispute invitation accepted',
      result 
    });
  });
});

// PUT /api/disputes/:id/reject - Reject a dispute invitation
router.put('/:id/reject', authenticateToken, (req, res) => {
  const dispute_id = parseInt(req.params.id);
  
  if (isNaN(dispute_id)) {
    return res.status(400).json({ error: 'Invalid dispute ID' });
  }
  
  updateParticipantStatus(dispute_id, req.user.userId, 'rejected', (err, result) => {
    if (err) {
      console.error('Error rejecting dispute:', err);
      if (err.message === 'Participant not found') {
        return res.status(404).json({ error: 'Dispute invitation not found' });
      }
      return res.status(500).json({ error: 'Failed to reject dispute' });
    }
    
    res.json({ 
      message: 'Dispute invitation rejected',
      result 
    });
  });
});

// POST /api/disputes/:id/invite - Invite more participants to existing dispute
router.post('/:id/invite', authenticateToken, (req, res) => {
  const dispute_id = parseInt(req.params.id);
  const { participant_emails } = req.body;
  
  if (isNaN(dispute_id)) {
    return res.status(400).json({ error: 'Invalid dispute ID' });
  }
  
  if (!participant_emails || !Array.isArray(participant_emails) || participant_emails.length === 0) {
    return res.status(400).json({ error: 'At least one participant email is required' });
  }
  
  // First, get the dispute to verify permissions
  getDisputeById(dispute_id, (err, dispute) => {
    if (err) {
      console.error('Error fetching dispute:', err);
      return res.status(500).json({ error: 'Failed to fetch dispute' });
    }
    
    if (!dispute) {
      return res.status(404).json({ error: 'Dispute not found' });
    }
    
    // Only the creator can invite more participants
    if (dispute.creator_id !== req.user.userId) {
      return res.status(403).json({ error: 'Only the dispute creator can invite more participants' });
    }
    
    // Only allow inviting to active disputes
    if (dispute.status !== 'active') {
      return res.status(400).json({ error: 'Cannot invite participants to a completed or cancelled dispute' });
    }
    
    // Get user's contacts to verify they can invite these people
    getUserContacts(req.user.email, (err, result) => {
      if (err) {
        console.error('Error fetching contacts:', err);
        return res.status(500).json({ error: 'Failed to verify contacts' });
      }
      
      // Create a map of contact emails to user IDs
      const contactEmails = result.contacts.map(contact => contact.contact_email);
      const contactEmailMap = {};
      
      // Look up user IDs for each contact email
      let completed = 0;
      if (contactEmails.length === 0) {
        return res.status(400).json({ error: 'You need contacts to invite participants' });
      }
      
      participant_emails.forEach(email => {
        getUserByEmail(email, (err, user) => {
          if (!err && user) {
            contactEmailMap[email] = user.id;
          }
          completed++;
          
          if (completed === participant_emails.length) {
            // Continue with invitation logic
            processInvitations();
          }
        });
      });

      function processInvitations() {
        // Verify all participant emails are in user's contacts
        const participant_ids = [];
        const invalid_emails = [];
        const existing_participants = dispute.participants.map(p => p.email);
        const duplicate_emails = [];
        
        participant_emails.forEach(email => {
          if (existing_participants.includes(email)) {
            duplicate_emails.push(email);
          } else if (contactEmailMap[email]) {
            participant_ids.push(contactEmailMap[email]);
          } else {
            invalid_emails.push(email);
          }
        });
        
        if (duplicate_emails.length > 0) {
          return res.status(400).json({ 
            error: `These users are already participants in this dispute: ${duplicate_emails.join(', ')}` 
          });
        }
        
        if (invalid_emails.length > 0) {
          return res.status(400).json({ 
            error: `These emails are not in your contacts: ${invalid_emails.join(', ')}` 
          });
        }
        
        // Add the new participants to the dispute
        addParticipantsToDispute(dispute_id, participant_ids, (err, result) => {
          if (err) {
            console.error('Error adding participants to dispute:', err);
            return res.status(500).json({ error: 'Failed to add participants to dispute' });
          }
          
          res.status(200).json({ 
            message: `Successfully invited ${participant_ids.length} participant(s) to the dispute`,
            invited_count: participant_ids.length
          });
        });
      }
    });
  });
});

// PUT /api/disputes/:id/response - Submit or update response text
router.put('/:id/response', authenticateToken, (req, res) => {
  const dispute_id = parseInt(req.params.id);
  const { response_text } = req.body;
  
  if (isNaN(dispute_id)) {
    return res.status(400).json({ error: 'Invalid dispute ID' });
  }
  
  if (!response_text || !response_text.trim()) {
    return res.status(400).json({ error: 'Response text is required' });
  }
  
  submitDisputeResponse(dispute_id, req.user.userId, response_text.trim(), (err, result) => {
    if (err) {
      console.error('Error submitting response:', err);
      if (err.message === 'Participant not found or not accepted') {
        return res.status(403).json({ error: 'You are not an accepted participant in this dispute' });
      }
      return res.status(500).json({ error: 'Failed to submit response' });
    }
    
    if (result.completed) {
      try {
        // Get full dispute data for Claude API
        getDisputeById(dispute_id, async (err, disputeData) => {
          if (err) {
            console.error('Error fetching dispute for verdict:', err);
            return res.status(500).json({ error: 'Failed to generate verdict' });
          }
  
          try {
            // Generate verdict using Claude API
            console.log('Generating verdict for dispute:', dispute_id);
            const verdict = await generateVerdict(disputeData);
            
            // Update database with verdict
            updateDisputeVerdict(dispute_id, verdict, (err, verdictResult) => {
              if (err) {
                console.error('Error saving verdict:', err);
                return res.status(500).json({ error: 'Failed to save verdict' });
              }
              
              console.log('Verdict saved successfully for dispute:', dispute_id);
              res.json({ 
                message: 'Response submitted successfully. All participants have responded - dispute is now completed with verdict!',
                result,
                verdict: verdict
              });
            });
          } catch (claudeError) {
            console.error('Error generating verdict:', claudeError);
            res.json({ 
              message: 'Response submitted successfully. All participants have responded - dispute is now completed! (Verdict generation failed)',
              result 
            });
          }
        });
      } catch (error) {
        console.error('Error in verdict generation process:', error);
        res.json({ 
          message: 'Response submitted successfully. All participants have responded - dispute is now completed!',
          result 
        });
      }
    } else {
      res.json({ 
        message: 'Response submitted successfully',
        result 
      });
    }
  });
});

// DELETE /api/disputes/:id - Delete a dispute (creator only)
router.delete('/:id', authenticateToken, (req, res) => {
  const dispute_id = parseInt(req.params.id);
  
  if (isNaN(dispute_id)) {
    return res.status(400).json({ error: 'Invalid dispute ID' });
  }
  
  deleteDispute(dispute_id, req.user.userId, (err, result) => {
    if (err) {
      console.error('Error deleting dispute:', err);
      if (err.message === 'Dispute not found') {
        return res.status(404).json({ error: 'Dispute not found' });
      }
      if (err.message === 'Only the dispute creator can delete the dispute') {
        return res.status(403).json({ error: 'Only the dispute creator can delete the dispute' });
      }
      return res.status(500).json({ error: 'Failed to delete dispute' });
    }
    
    res.json({ 
      message: result.message,
      result 
    });
  });
});

// PUT /api/disputes/:id/leave - Leave a dispute (participants only)
router.put('/:id/leave', authenticateToken, (req, res) => {
  const dispute_id = parseInt(req.params.id);
  
  if (isNaN(dispute_id)) {
    return res.status(400).json({ error: 'Invalid dispute ID' });
  }
  
  leaveDispute(dispute_id, req.user.userId, (err, result) => {
    if (err) {
      console.error('Error leaving dispute:', err);
      if (err.message === 'You are not a participant in this dispute') {
        return res.status(404).json({ error: 'You are not a participant in this dispute' });
      }
      if (err.message === 'Dispute creators cannot leave their own dispute. Use delete instead.') {
        return res.status(403).json({ error: 'Dispute creators cannot leave their own dispute. Use delete instead.' });
      }
      if (err.message === 'Cannot leave a completed dispute') {
        return res.status(403).json({ error: 'Cannot leave a completed dispute' });
      }
      return res.status(500).json({ error: 'Failed to leave dispute' });
    }
    
    res.json({ 
      message: result.message,
      result 
    });
  });
});

module.exports = router;