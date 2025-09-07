const express = require('express');
const jwt = require('jsonwebtoken');
const { getUserContacts, createContactRequest, updateContactRequest, getUserByEmail } = require('../database');
const { sendInvitationEmail } = require('../services/emailService');

const router = express.Router();
const JWT_SECRET = process.env.JWT_SECRET || 'fallback-secret-for-development';

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
router.post('/request', authenticateToken, async (req, res) => {
  const { email } = req.body;

  if (!email) {
    return res.status(400).json({ error: 'Email is required' });
  }

  if (email === req.user.email) {
    return res.status(400).json({ error: 'Cannot add yourself as a contact' });
  }

try {
    // Check if contact already exists or has a pending request
    const existingContact = await new Promise((resolve, reject) => {
      checkExistingContact(req.user.email, email, (err, result) => {
        if (err) reject(err);
        else resolve(result);
      });
    });


    if (existingContact.exists) {
      return res.status(400).json({ 
        error: existingContact.isPending 
          ? 'A contact request is already pending for this email' 
          : 'This contact already exists in your contact list'
      });
    }

    // Get the current user's info to include their name in the email
    const currentUser = await new Promise((resolve, reject) => {
      getUserByEmail(req.user.email, (err, user) => {
        if (err) reject(err);
        else resolve(user);
      });
    });

    if (!currentUser) {
      return res.status(404).json({ error: 'Current user not found' });
    }

    // Create the contact request
    createContactRequest(req.user.email, email, async (err, result) => {
      if (err) {
        if (err.message.includes('duplicate') || err.message.includes('already')) {
          return res.status(400).json({ error: 'A contact request for this email already exists' });
        }
        return res.status(500).json({ error: 'Failed to send contact request' });
      }

      if (result.recipientExists) {
        res.json({ 
          message: 'Contact request sent successfully',
          type: 'notification',
          result 
        });
      } else {
        // Send invitation email to non-existing user
        try {
          await sendInvitationEmail(
            currentUser.name,
            currentUser.email,
            email
          );
          
          console.log(`✅ Invitation email sent to ${email} by ${currentUser.name}`);
          
          res.json({ 
            message: 'Invitation email sent successfully',
            type: 'invitation',
            result 
          });
        } catch (emailError) {
          console.error('❌ Failed to send invitation email:', emailError);
          
          // Still return success for the contact request creation, but note email failed
          res.json({ 
            message: 'Contact request created, but invitation email failed to send',
            type: 'invitation',
            emailSent: false,
            result 
          });
        }
      }
    });
  } catch (error) {
    console.error('Error in contact request:', error);
    return res.status(500).json({ error: 'Failed to process contact request' });
  }
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

// Delete/remove contact
router.delete('/:id', authenticateToken, (req, res) => {
  const contactId = req.params.id;
  const userEmail = req.user.email;
  
  deleteContact(contactId, userEmail, (err, result) => {
    if (err) {
      return res.status(500).json({ error: 'Failed to remove contact' });
    }
    
    if (!result.deleted) {
      return res.status(404).json({ error: 'Contact not found or you do not have permission to delete it' });
    }
    
    res.json({ message: 'Contact removed successfully', result });
  });
});

module.exports = router;
