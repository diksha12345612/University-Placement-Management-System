const express = require('express');
const mongoose = require('mongoose');
// const cors = require('cors'); // Moved to middleware/corsConfig.js

const morgan = require('morgan');
// const helmet = require('helmet'); // Moved to middleware/securityConfig.js

const rateLimit = require('express-rate-limit');
const path = require('path');
require('dotenv').config();
const { setupExpiryCheckInterval } = require('./services/expiryService');

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

const securityMiddleware = require('./middleware/securityConfig');
app.use(securityMiddleware);


// Security Middlewares
const corsMiddleware = require('./middleware/corsConfig');
app.use(corsMiddleware);


// Input Sanitization - Prevent NoSQL injection attacks
// sanitize user input data by escaping $ and . characters in object keys
const mongoSanitize = require('express-mongo-sanitize');
app.use(mongoSanitize({
  onSanitize: ({ req, key }) => {
    console.warn(`[SECURITY] Sanitized potentially malicious key in request: ${key}`);
  }
}));

// XSS Protection - Prevent Cross-Site Scripting attacks
// Cleans user input by escaping HTML/JS patterns
const xss = require('xss-clean');
app.use(xss({
  whiteList: {}, // Remove HTML tags from string values (very strict)
  stripIgnoreTag: true,
  onTag: (tag, html, options) => {
    // Log suspicious HTML attempts
    if (tag && !['b', 'strong', 'i', 'em', 'u', 'br'].includes(tag.toLowerCase())) {
      console.warn(`[SECURITY] HTML tag attempt detected: ${tag}`);
    }
  }
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

// AI-specific rate limiting (more restrictive to prevent abuse)
const aiLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 10, // 10 requests per minute for AI endpoints
  message: { success: false, message: 'Too many AI requests. Please wait before trying again.' },
  standardHeaders: false
});

// Apply AI limiter to AI-intensive endpoints
app.use('/api/preparation/generate-questions', aiLimiter);
app.use('/api/preparation/generate-test', aiLimiter);
app.use('/api/applications/.*\\/ai-', aiLimiter);
app.use('/api/students/analyze-resume', aiLimiter);

// Body parsing - with size limits to prevent DoS attacks
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));

// Logging
if (process.env.NODE_ENV !== 'production') {
  app.use(morgan('dev'));
} else {
  app.use(morgan('combined'));
}

// Static files for uploads
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// Request ID middleware for tracing and logging
app.use((req, res, next) => {
  req.id = `REQ_${Date.now().toString(36)}_${Math.random().toString(36).substr(2, 5)}`.toUpperCase();
  res.setHeader('X-Request-ID', req.id);
  next();
});

// Routes
app.use('/api/public', require('./routes/public'));  // Public landing page data
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

// Global error and 404 handlers
const { errorHandler, notFoundHandler } = require('./middleware/errorHandler');
app.use(notFoundHandler);
app.use(errorHandler);


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
