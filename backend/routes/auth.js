const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { createUser, getUserByEmail } = require('../database');

const router = express.Router();
const JWT_SECRET = process.env.JWT_SECRET || 'fallback-secret-for-development';

// Sign up route
router.post('/signup', async (req, res) => {
  try {
    const { name, email, password } = req.body;

    // Validate input
    if (!name || !email || !password) {
      return res.status(400).json({ error: 'All fields are required' });
    }

    if (password.length < 6) {
      return res.status(400).json({ error: 'Password must be at least 6 characters' });
    }

    // Check if user already exists
    getUserByEmail(email, async (err, existingUser) => {
      console.log('🔍 getUserByEmail result:', { err, user: user ? 'FOUND' : 'NOT FOUND' });
    
      if (err) {
        console.error('❌ Database error:', err);

        return res.status(500).json({ error: 'Database error' });
      }

      if (existingUser) {
        return res.status(400).json({ error: 'User already exists with this email' });
      }

      // Hash password
      const hashedPassword = await bcrypt.hash(password, 10);

      // Create user
      createUser(
        { name, email, password: hashedPassword },
        (err, user) => {
          if (err) {
            return res.status(500).json({ error: 'Failed to create user' });
          }

          // Generate JWT token
          const token = jwt.sign(
            { userId: user.id, email: user.email },
            JWT_SECRET,
            { expiresIn: '7d' }
          );

          console.log('🎉 Login successful for user:', user.id);
          res.status(201).json({
            message: 'User created successfully',
            user: { id: user.id, name: user.name, email: user.email },
            token
          });
        }
      );
    });
  } catch (error) {
    res.status(500).json({ error: 'Server error' });
  }
});

// Login route
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;

    // Validate input
    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password are required' });
    }

    // Find user by email
    getUserByEmail(email, async (err, user) => {
      if (err) {
        return res.status(500).json({ error: 'Database error' });
      }

      if (!user) {
        return res.status(401).json({ error: 'Invalid email or password' });
      }

      // Check password
      const isPasswordValid = await bcrypt.compare(password, user.password);
      if (!isPasswordValid) {
        return res.status(401).json({ error: 'Invalid email or password' });
      }

      // Generate JWT token
      const token = jwt.sign(
        { userId: user.id, email: user.email },
        JWT_SECRET,
        { expiresIn: '7d' }
      );

      res.json({
        message: 'Login successful',
        user: { id: user.id, name: user.name, email: user.email },
        token
      });
    });
  } catch (error) {
    res.status(500).json({ error: 'Server error' });
  }
});


// Test route (just for browser testing)
router.get('/signup', (req, res) => {
  res.json({ 
    message: 'Signup endpoint is working. Use POST to create accounts.',
    method: 'Use POST request with JSON body containing: name, email, password'
  });
});

module.exports = router;

