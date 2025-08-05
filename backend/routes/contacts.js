const express = require('express');
const jwt = require('jsonwebtoken');
const { getUserContacts, createContactRequest, updateContactRequest, getUserByEmail } = require('../database');

const router = express.Router();
const JWT_SECRET = 'your-secret-key'; // Should match your auth.js

// Middleware to verify JWT token
const authenticateToken = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({ error: 'Access token required' });
  }

  jwt.verify(token, JWT_SECRET, (err, user) => {
    if (err) {
      return res.status(403).json({ error: 'Invalid token' });
    }
    req.user = user;
    next();
  });
};

// Get user's contacts and pending requests
router.get('/', authenticateToken, (req, res) => {
  getUserContacts(req.user.email, (err, data) => {
    if (err) {
      return res.status(500).json({ error: 'Failed to get contacts' });
    }
    res.json(data);
  });
});

// Send contact request
router.post('/request', authenticateToken, (req, res) => {
  const { email } = req.body;

  if (!email) {
    return res.status(400).json({ error: 'Email is required' });
  }

  if (email === req.user.email) {
    return res.status(400).json({ error: 'Cannot add yourself as a contact' });
  }

  createContactRequest(req.user.email, email, (err, result) => {
    if (err) {
      return res.status(500).json({ error: 'Failed to send contact request' });
    }

    if (result.recipientExists) {
      res.json({ 
        message: 'Contact request sent successfully',
        type: 'notification',
        result 
      });
    } else {
      // TODO: Send invitation email here
      res.json({ 
        message: 'Invitation email sent',
        type: 'invitation',
        result 
      });
    }
  });
});

// Approve contact request
router.put('/:id/approve', authenticateToken, (req, res) => {
  const requestId = req.params.id;
  
  updateContactRequest(requestId, 'accepted', (err, result) => {
    if (err) {
      return res.status(500).json({ error: 'Failed to approve contact request' });
    }
    
    if (!result.updated) {
      return res.status(404).json({ error: 'Contact request not found' });
    }
    
    res.json({ message: 'Contact request approved', result });
  });
});

// Reject contact request
router.put('/:id/reject', authenticateToken, (req, res) => {
  const requestId = req.params.id;
  
  updateContactRequest(requestId, 'rejected', (err, result) => {
    if (err) {
      return res.status(500).json({ error: 'Failed to reject contact request' });
    }
    
    if (!result.updated) {
      return res.status(404).json({ error: 'Contact request not found' });
    }
    
    res.json({ message: 'Contact request rejected', result });
  });
});

module.exports = router;
