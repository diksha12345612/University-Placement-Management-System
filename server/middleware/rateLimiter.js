const rateLimit = require('express-rate-limit');
const logger = require('../utils/logger');

/**
 * Standard Rate Limiter
 * Applied globally to all /api/ endpoints.
 */
const globalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 2000, // Limit each IP to 2000 requests per window
  message: {
    success: false,
    message: 'Too many requests from this IP, please try again after 15 minutes',
    status: 429
  },
  standardHeaders: true, // Return rate limit info in the `RateLimit-*` headers
  legacyHeaders: false, // Disable the `X-RateLimit-*` headers
  skip: (req) => {
    // Skip rate limiting for health checks
    return req.path === '/api/health' || req.path === '/health';
  },
  handler: (req, res, next, options) => {
    logger.warn(`Rate limit exceeded for IP: ${req.ip}`, { path: req.path });
    res.status(options.statusCode).send(options.message);
  }
});

/**
 * AI-specific Rate Limiter
 * More restrictive to prevent abuse of expensive LLM endpoints.
 */
const aiLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 15, // 15 requests per minute
  message: {
    success: false,
    message: 'Too many AI requests. Please wait a moment before trying again.',
    status: 429
  },
  standardHeaders: true,
  legacyHeaders: false,
  handler: (req, res, next, options) => {
    logger.warn(`AI Rate limit exceeded for IP: ${req.ip}`, { path: req.path });
    res.status(options.statusCode).send(options.message);
  }
});

module.exports = {
  globalLimiter,
  aiLimiter
};
