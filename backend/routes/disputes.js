const express = require('express');
const jwt = require('jsonwebtoken');
const { 
  createDispute, 
  getDisputesByUser, 
  getDisputeById, 
  updateParticipantStatus, 
  submitDisputeResponse,
  getContactsByUser,
  getUserById
} = require('../database');

const router = express.Router();
const JWT_SECRET = process.env.JWT_SECRET || 'fallback-secret-for-development';

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
  getContactsByUser(req.user.userId, (err, contacts) => {
    if (err) {
      console.error('Error fetching contacts:', err);
      return res.status(500).json({ error: 'Failed to verify contacts' });
    }
    
    // Create a map of contact emails to user IDs
    const contactEmailMap = {};
    contacts.forEach(contact => {
      if (contact.requester_id === req.user.userId && contact.recipient_id) {
        // User is the requester and recipient accepted
        contactEmailMap[contact.recipient_email] = contact.recipient_id;
      } else if (contact.recipient_id === req.user.userId) {
        // User is the recipient and accepted
        contactEmailMap[contact.requester_email] = contact.requester_id;
      }
    });
    
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
      res.json({ 
        message: 'Response submitted successfully. All participants have responded - dispute is now completed!',
        result 
      });
    } else {
      res.json({ 
        message: 'Response submitted successfully',
        result 
      });
    }
  });
});

module.exports = router;