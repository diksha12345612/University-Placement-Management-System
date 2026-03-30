const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const morgan = require('morgan');
const helmet = require('helmet');
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

// Enhanced Security Headers with Helmet
// Includes HSTS, CSP, X-Frame-Options, and other best practices
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"],
      scriptSrc: ["'self'", "https://vercel.com"],
      imgSrc: ["'self'", "data:", "https:"],
      connectSrc: ["'self'", "https://api.openrouter.io"],
      fontSrc: ["'self'", "https://fonts.gstatic.com"],
      mediaSrc: ["'self'"],
      objectSrc: ["'none'"],
    }
  },
  hsts: {
    maxAge: 31536000, // 1 year in seconds
    includeSubDomains: true,
    preload: true
  },
  frameguard: { action: 'deny' },
  referrerPolicy: { policy: 'strict-origin-when-cross-origin' }
}));

// Strict CORS configuration - only allow known safe origins
const allowedOrigins = [
  process.env.FRONTEND_URL, // Vercel production (e.g., https://uniplacements.vercel.app)
  'http://localhost:5173',   // Local Vite dev server
  'http://localhost:5500',   // Local dev fallback
  'http://127.0.0.1:5173',   // localhost IPv4 variant
].filter(Boolean); // Remove undefined values

app.use(cors({
  origin: (origin, callback) => {
    // Allow requests without origin (e.g., mobile apps, curl, Postman)
    if (!origin) {
      return callback(null, true);
    }
    
    // Check if origin is in allowed list
    if (allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      // Reject with descriptive error (safe for production)
      callback(new Error('CORS policy: Origin not allowed'));
    }
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
}));

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

// Enhanced Error handling middleware - prevents information disclosure in production
app.use((err, req, res, next) => {
  // Log full error server-side for debugging with request context
  const errorId = req.id || Date.now().toString(36) + Math.random().toString(36).substr(2);
  console.error(`[${errorId}] Error: ${err.stack || err.message}`);
  
  // Determine status code
  const statusCode = err.statusCode || err.status || 500;
  
  // Build safe response with consistent format
  let errorResponse = {
    success: false,
    message: 'An error occurred processing your request',
    status: statusCode,
    errorId: errorId
  };

  // Include specific safe error messages for known error types
  if (err.name === 'ValidationError') {
    errorResponse.message = 'Validation failed. Please check required fields.';
  } else if (err.name === 'CastError') {
    errorResponse.message = 'Invalid request parameters';
  } else if (err.name === 'MongooseError' || err.name === 'MongoError') {
    errorResponse.message = 'Database operation failed';
  } else if (statusCode === 401) {
    errorResponse.message = 'Authentication required. Please log in.';
  } else if (statusCode === 403) {
    errorResponse.message = 'You do not have permission to access this resource';
  } else if (statusCode === 404) {
    errorResponse.message = 'The requested resource was not found';
  } else if (statusCode >= 400 && statusCode < 500) {
    // Use original message for client errors (validation, bad requests)
    errorResponse.message = err.message || 'Invalid request';
  }

  // In development, include additional details
  if (process.env.NODE_ENV === 'development') {
    errorResponse.details = err.stack;
  }

  res.status(statusCode).json(errorResponse);
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
