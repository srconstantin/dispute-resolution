require('dotenv').config();

const express = require('express');
const cors = require('cors');
const { initDatabase } = require('./database');
const authRoutes = require('./routes/auth');
const contactsRoutes = require('./routes/contacts');
const disputesRoutes = require('./routes/disputes');


const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());

//Request logging
app.use((req, res, next) => {
  console.log('📝 REQUEST:', req.method, req.path);
  next();
});



// Routes
app.use('/api/auth', authRoutes);
app.use('/api/contacts', contactsRoutes);
app.use('/api/disputes', disputesRoutes);

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'OK', message: 'Server is running' });
});



app.listen(PORT, () => {
  console.log(`DEBUG SERVER with logging enabled --  running on port ${PORT}`);

// Initialize database
  await initDatabase();

});
