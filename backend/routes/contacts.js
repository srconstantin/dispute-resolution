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