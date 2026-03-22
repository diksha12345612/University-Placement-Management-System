/**
 * Server-side Input Sanitization Utilities
 * Prevents XSS, script injection, and dangerous content
 */

const xss = require('xss-clean');

/**
 * Sanitize user input string to prevent XSS attacks
 * Removes dangerous HTML/JS patterns
 * @param {string} input - Raw user input
 * @returns {string} Sanitized string
 */
const sanitizeString = (input) => {
  if (typeof input !== 'string') return input;
  
  // Remove script tags and event handlers
  let sanitized = input
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
    .replace(/on\w+\s*=/gi, '') // Remove event handlers
    .replace(/javascript:/gi, '') // Remove javascript: protocol
    .trim();
  
  // Limit string length (prevent DoS)
  const MAX_LENGTH = 10000;
  if (sanitized.length > MAX_LENGTH) {
    sanitized = sanitized.substring(0, MAX_LENGTH);
  }
  
  return sanitized;
};

/**
 * Sanitize email input
 * @param {string} email - Email address
 * @returns {string} Sanitized email (lowercase, trimmed)
 */
const sanitizeEmail = (email) => {
  if (typeof email !== 'string') return '';
  return email.toLowerCase().trim().replace(/\s+/g, '');
};

/**
 * Sanitize URL input
 * @param {string} url - URL string
 * @returns {string} Sanitized URL or empty string if invalid
 */
const sanitizeUrl = (url) => {
  if (typeof url !== 'string') return '';
  
  try {
    // Remove dangerous protocols
    if (url.match(/^(javascript|data|vbscript):/i)) {
      return '';
    }
    
    // Validate URL format
    new URL(url);
    return url.trim();
  } catch (err) {
    return '';
  }
};

/**
 * Sanitize object keys and values recursively
 * Prevents NoSQL injection and XSS via object paths
 * @param {object} obj - Object to sanitize
 * @returns {object} Sanitized object
 */
const sanitizeObject = (obj) => {
  if (obj === null || typeof obj !== 'object') {
    return typeof obj === 'string' ? sanitizeString(obj) : obj;
  }
  
  if (Array.isArray(obj)) {
    return obj.map(item => sanitizeObject(item));
  }
  
  const sanitized = {};
  for (const [key, value] of Object.entries(obj)) {
    // Skip dangerous keys
    if (key.startsWith('$') || key.startsWith('__')) {
      continue;
    }
    
    // Sanitize value recursively
    sanitized[key] = sanitizeObject(value);
  }
  
  return sanitized;
};

/**
 * Validate and sanitize FormData file  (backend-side check)
 * @param {object} file - Multer file object
 * @param {string[]} allowedMimes - Allowed MIME types
 * @param {number} maxSize - Max file size in bytes
 * @returns {object} {valid: boolean, error?: string}
 */
const validateUploadFile = (file, allowedMimes = [], maxSize = 25 * 1024 * 1024) => {
  if (!file) {
    return { valid: false, error: 'No file provided' };
  }
  
  // Check MIME type
  if (allowedMimes.length > 0 && !allowedMimes.includes(file.mimetype)) {
    return { 
      valid: false, 
      error: `Invalid file type. Allowed: ${allowedMimes.join(', ')}` 
    };
  }
  
  // Check file size
  if (file.size > maxSize) {
    return { 
      valid: false, 
      error: `File too large. Maximum size: ${maxSize / 1024 / 1024}MB` 
    };
  }
  
  // Check filename (prevent path traversal)
  if (file.originalname.includes('..') || file.originalname.includes('/')) {
    return { 
      valid: false, 
      error: 'Invalid filename' 
    };
  }
  
  return { valid: true };
};

/**
 * Generate safe filename from original
 * Prevents directory traversal and shell injection
 * @param {string} originalName - Original filename
 * @returns {string} Safe filename
 */
const generateSafeFilename = (originalName) => {
  if (!originalName) return `file_${Date.now()}`;
  
  const timestamp = Date.now();
  const ext = originalName.split('.').pop().toLowerCase();
  
  // Allow only alphanumeric, dash, underscore extensions
  const safeExt = ext.match(/^[a-z0-9]{1,10}$/) ? ext : 'bin';
  
  // Generate safe filename
  return `file_${timestamp}_${Math.random().toString(36).substr(2, 9)}.${safeExt}`;
};

module.exports = {
  xssClean: xss,
  sanitizeString,
  sanitizeEmail,
  sanitizeUrl,
  sanitizeObject,
  validateUploadFile,
  generateSafeFilename
};
