const express = require('express');
const mongoose = require('mongoose');
const morgan = require('morgan');


// const rateLimit = require('express-rate-limit'); // Moved to middleware/rateLimiter.js

const path = require('path');
const logger = require('./utils/logger');

/**
 * Validate critical environment variables
 */
if (!process.env.MONGODB_URI) {
  logger.error('MONGODB_URI is not set. Startup halted.');
  process.exit(1);
}
if (!process.env.JWT_SECRET) {
  logger.error('JWT_SECRET is not set. Startup halted.');
  process.exit(1);
}


const app = express();

// Trust proxy - CRITICAL for Vercel
// Vercel sets X-Forwarded-For header, Express needs to trust it
app.set('trust proxy', 1);

/**
 * Security middleware registration.
 * Includes CORS, Helmet, NoSQL sanitization, and XSS protection.
 */
const securityMiddleware = require('./middleware/securityConfig');
const corsMiddleware = require('./middleware/corsConfig');
app.use(securityMiddleware);
app.use(corsMiddleware);

/**
 * Input Sanitization - Prevent NoSQL injection attacks
 * Escapes characters like $ and . in user-supplied object keys.
 */
const mongoSanitize = require('express-mongo-sanitize');
app.use(mongoSanitize({
  onSanitize: ({ req, key }) => {
    logger.security(`Sanitized potentially malicious key in request: ${key}`, { path: req.path });
  }
}));


/**
 * XSS Protection - Prevent Cross-Site Scripting attacks
 * Strips potentially malicious HTML/JS patterns from user input.
 */
const xss = require('xss-clean');
app.use(xss({
  whiteList: {}, // Strict: remove all HTML tags
  stripIgnoreTag: true,
  onTag: (tag, html, options) => {
    if (tag && !['b', 'strong', 'i', 'em', 'u', 'br'].includes(tag.toLowerCase())) {
      logger.security(`HTML tag attempt detected: ${tag}`, { tag });
    }
  }
}));


/**
 * MongoDB Connection Middleware (Serverless-optimized)
 * Ensures a database connection is active before processing any requests.
 */
let isConnected = false;
app.use(async (req, res, next) => {
  if (isConnected || mongoose.connection.readyState === 1) {
    isConnected = true;
    return next();
  }
  try {
    await mongoose.connect(process.env.MONGODB_URI, {
      serverSelectionTimeoutMS: 5000
    });
    isConnected = true;
    logger.info('Connected to MongoDB Atlas');
    next();
  } catch (err) {
    logger.error(`MongoDB connection error: ${err.message}`, { error: err });
    return res.status(500).json({ error: `Database connection failed: ${err.message}` });
  }
});


/**
 * Global and AI-specific Rate Limiting
 * Prevents abuse and manages resource consumption for LLM endpoints.
 */
const { globalLimiter, aiLimiter } = require('./middleware/rateLimiter');
app.use('/api/', globalLimiter);
app.use(['/api/preparation/generate-questions', '/api/preparation/generate-test', '/api/students/analyze-resume'], aiLimiter);
app.use('/api/applications/.*\\/ai-', aiLimiter);


/**
 * Standard Express Middleware
 * Handles body parsing, logging, and static file serving.
 */
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));

if (process.env.NODE_ENV !== 'production') {
  app.use(morgan('dev'));
} else {
  app.use(morgan('combined'));
}

app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

/**
 * Request ID Middleware
 * Assigns a unique trace ID to each incoming request for auditing and debugging.
 */
app.use((req, res, next) => {
  req.id = `REQ_${Date.now().toString(36)}_${Math.random().toString(36).substr(2, 5)}`.toUpperCase();
  res.setHeader('X-Request-ID', req.id);
  next();
});

/**
 * API Route Registration
 * Defines the main entry points for the application's REST API.
 */
app.use('/api/public', require('./routes/public'));
app.use('/api/auth', require('./routes/auth'));
app.use('/api/students', require('./routes/students'));
app.use('/api/recruiters', require('./routes/recruiters'));
app.use('/api/jobs', require('./routes/jobs'));
app.use('/api/applications', require('./routes/applications'));
app.use('/api/admin', require('./routes/admin'));
app.use('/api/admin-ats', require('./routes/adminRoutes'));
app.use('/api/resume', require('./routes/resumeRoutes'));
app.use('/api/preparation', require('./routes/preparation'));
app.use('/api/notifications', require('./routes/notifications'));

/**
 * Health Check Endpoint
 */
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
    logger.info(`Server running on port ${PORT}`, { port: PORT, env: process.env.NODE_ENV });
  });
}



module.exports = app;
