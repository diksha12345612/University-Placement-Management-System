const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const morgan = require('morgan');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const path = require('path');
require('dotenv').config();

// Validate critical environment variables
if (!process.env.MONGODB_URI) {
  console.error('ERROR: MONGODB_URI is not set. Startup halted.');
  process.exit(1);
}
if (!process.env.JWT_SECRET) {
  console.error('ERROR: JWT_SECRET is not set. Startup halted.');
  process.exit(1);
}

const app = express();

// Trust proxy - CRITICAL for Vercel
// Vercel sets X-Forwarded-For header, Express needs to trust it
app.set('trust proxy', 1);

// Security middleware
app.use(helmet());
app.use(cors({
  origin: (origin, callback) => {
    // Allow localhost and vercel deployments
    if (!origin || origin.startsWith('http://localhost') || origin.startsWith('http://127.0.0.1') || origin.includes('vercel.app')) {
      callback(null, true);
    } else {
      callback(null, process.env.FRONTEND_URL || false);
    }
  },
  credentials: true
}));

// Serverless DB Connection Middleware
// This guarantees Vercel establishes a connection BEFORE routing the request
let isConnected = false;
app.use(async (req, res, next) => {
  if (isConnected || mongoose.connection.readyState === 1) {
    isConnected = true;
    return next();
  }
  try {
    await mongoose.connect(process.env.MONGODB_URI, {
      serverSelectionTimeoutMS: 5000 // Fail fast if Vercel IPs are blocked by Atlas
    });
    isConnected = true;
    console.log('✅ Connected to MongoDB');
    next();
  } catch (err) {
    console.error('❌ MongoDB connection error:', err.message);
    return res.status(500).json({ error: `Database connection failed: ${err.message}` });
  }
});

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 2000, // Increase limit for Vercel environment
  message: { error: 'Too many requests, please try again later.' },
  standardHeaders: false, // Don't return rate limit info in headers
  skip: (req, res) => {
    // Skip rate limiting for health checks
    return req.path === '/api/health' || req.path === '/health';
  }
});
app.use('/api/', limiter);

// Body parsing
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// Logging
if (process.env.NODE_ENV !== 'production') {
  app.use(morgan('dev'));
} else {
  app.use(morgan('combined'));
}

// Static files for uploads
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// Routes
app.use('/api/auth', require('./routes/auth'));
app.use('/api/students', require('./routes/students'));
app.use('/api/recruiters', require('./routes/recruiters'));
app.use('/api/jobs', require('./routes/jobs'));
app.use('/api/applications', require('./routes/applications'));
app.use('/api/admin', require('./routes/admin'));
app.use('/api/admin-ats', require('./routes/adminRoutes')); // ATS custom routes
app.use('/api/resume', require('./routes/resumeRoutes'));   // Resume parsing functionality
app.use('/api/preparation', require('./routes/preparation'));
app.use('/api/notifications', require('./routes/notifications'));

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'OK', timestamp: new Date().toISOString() });
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error(err.stack);
  const statusCode = err.statusCode || 500;
  res.status(statusCode).json({
    error: err.message || 'Internal Server Error',
    ...(process.env.NODE_ENV === 'development' && { stack: err.stack })
  });
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({ error: 'Route not found' });
});

// Initialize expiry check service (runs on startup and periodically)
// Only run in local dev, NOT in Vercel production (serverless can't maintain intervals)
if (process.env.NODE_ENV !== 'production' && require.main === module) {
  // Run expiry check every 1 hour
  setupExpiryCheckInterval(60 * 60 * 1000);
}

// Server start (only if not in a serverless environment like Vercel production)
if (process.env.NODE_ENV !== 'production' || require.main === module) {
  const PORT = process.env.PORT || 5000;
  app.listen(PORT, () => {
    console.log(`🚀 Server running on port ${PORT}`);
  });
}


module.exports = app;
