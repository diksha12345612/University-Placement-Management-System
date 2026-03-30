const express = require('express');
const path = require('path');
const morgan = require('morgan');
const mongoSanitize = require('express-mongo-sanitize');
const xss = require('xss-clean');
const logger = require('./utils/logger');
const connectDB = require('./config/db');
const { globalLimiter, aiLimiter } = require('./middleware/rateLimiter');
const { errorHandler, notFoundHandler } = require('./middleware/errorHandler');

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
app.set('trust proxy', 1);

// Security middleware
const securityMiddleware = require('./middleware/securityConfig');
const corsMiddleware = require('./middleware/corsConfig');
app.use(securityMiddleware);
app.use(corsMiddleware);

// Input Sanitization
app.use(mongoSanitize({
  onSanitize: ({ req, key }) => {
    logger.security(`Sanitized potentially malicious key in request: ${key}`, { path: req.path });
  }
}));

// XSS Protection
app.use(xss());

// MongoDB Connection Middleware
app.use(async (req, res, next) => {
  try {
    await connectDB();
    next();
  } catch (err) {
    return res.status(500).json({ error: 'Database connection failed' });
  }
});

// Rate Limiting
app.use('/api/', globalLimiter);
app.use(['/api/preparation/generate-test', '/api/students/analyze-resume'], aiLimiter);

// Standard Middleware
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));

if (process.env.NODE_ENV !== 'production') {
  app.use(morgan('dev'));
} else {
  app.use(morgan('combined'));
}

app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// Request ID Middleware
app.use((req, res, next) => {
  req.id = `REQ_${Date.now().toString(36)}_${Math.random().toString(36).substr(2, 5)}`.toUpperCase();
  res.setHeader('X-Request-ID', req.id);
  next();
});

// --- API Routes ---
app.use('/api/public', require('./routes/public'));
app.use('/api/auth', require('./routes/auth'));
app.use('/api/students', require('./routes/students'));
app.use('/api/recruiters', require('./routes/recruiters'));
app.use('/api/jobs', require('./routes/jobs'));
app.use('/api/applications', require('./routes/applications'));
app.use('/api/admin', require('./routes/admin'));
app.use('/api/resume', require('./routes/resume'));
app.use('/api/preparation', require('./routes/preparation'));
app.use('/api/notifications', require('./routes/notifications'));

// Health Check
app.get('/api/health', (req, res) => {
  res.json({ status: 'OK', timestamp: new Date().toISOString() });
});

// Error Handlers
app.use(notFoundHandler);
app.use(errorHandler);

/**
 * Graceful Shutdown Handler
 */
const gracefulShutdown = (signal) => {
  logger.warn(`Received ${signal}. Starting graceful shutdown...`);
  const mongoose = require('mongoose');
  mongoose.connection.close(false, () => {
    logger.info('MongoDB connection closed.');
    process.exit(0);
  });
  setTimeout(() => {
    logger.error('Could not close connections in time, forcefully shutting down.');
    process.exit(1);
  }, 10000);
};

process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));

// Server Start
if (process.env.NODE_ENV !== 'production' || require.main === module) {
  const PORT = process.env.PORT || 5000;
  app.listen(PORT, () => {
    logger.info(`Server running on port ${PORT}`, { port: PORT, env: process.env.NODE_ENV });
  });
}

module.exports = app;
