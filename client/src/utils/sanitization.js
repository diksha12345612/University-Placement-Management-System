/**
 * Frontend Input Sanitization & XSS Prevention Utilities
 * Uses DOMPurify for safe HTML rendering
 */

import DOMPurify from 'dompurify';

/**
 * Sanitize user input string to prevent XSS
 * @param {string} input - Raw user input
 * @returns {string} Sanitized string safe for display
 */
export const sanitizeString = (input) => {
  if (typeof input !== 'string') return '';
  
  // Remove dangerous patterns
  let sanitized = input
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
    .replace(/on\w+\s*=/gi, '')
    .replace(/javascript:/gi, '')
    .trim();
  
  // Limit length
  const MAX_LENGTH = 10000;
  return sanitized.length > MAX_LENGTH 
    ? sanitized.substring(0, MAX_LENGTH) 
    : sanitized;
};

/**
 * Sanitize email input
 * @param {string} email - Email address
 * @returns {string} Sanitized email
 */
export const sanitizeEmail = (email) => {
  if (typeof email !== 'string') return '';
  return email.toLowerCase().trim().replace(/\s+/g, '');
};

/**
 * Sanitize URL for rendering (href, src attributes)
 * @param {string} url - URL string
 * @returns {string} Safe URL or empty string if dangerous
 */
export const sanitizeUrl = (url) => {
  if (typeof url !== 'string') return '';
  
  // Block dangerous protocols
  if (url.match(/^(javascript|data|vbscript):/i)) {
    return '';
  }
  
  try {
    new URL(url); // Validate URL
    return url.trim();
  } catch (err) {
    return '';
  }
};

/**
 * Sanitize HTML content for safe rendering with DOMPurify
 * Used for user-generated content, markdown output, etc.
 * @param {string} htmlContent - HTML string to sanitize
 * @param {object} options - DOMPurify options (optional)
 * @returns {string} Safe HTML string
 */
export const sanitizeHtml = (htmlContent, options = {}) => {
  const DEFAULT_CONFIG = {
    ALLOWED_TAGS: [
      'b', 'i', 'em', 'strong', 'u', 'br', 'p',
      'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
      'ul', 'ol', 'li',
      'a', 'img',
      'code', 'pre',
      'blockquote',
      'hr',
      'table', 'thead', 'tbody', 'tr', 'td', 'th'
    ],
    ALLOWED_ATTR: [
      'href', 'src', 'alt', 'title',
      'target', 'rel'
    ],
    ALLOWED_URI_REGEXP: /^(?:(?:(?:f|ht)tps?|mailto|tel|callto|cid|xmpp):|[^a-z]|[a-z+.\-]*(?:[^a-z+.\-:]|$))/i
  };
  
  const config = { ...DEFAULT_CONFIG, ...options };
  
  return DOMPurify.sanitize(htmlContent, config);
};

/**
 * Sanitize markdown-generated HTML
 * More permissive than general sanitization (allows inline code, tables)
 * @param {string} htmlContent - Markdown-generated HTML
 * @returns {string} Safe HTML
 */
export const sanitizeMarkdownHtml = (htmlContent) => {
  return sanitizeHtml(htmlContent, {
    ALLOWED_TAGS: [
      'b', 'i', 'em', 'strong', 'u', 'br', 'p',
      'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
      'ul', 'ol', 'li',
      'a', 'img',
      'code', 'pre',
      'blockquote',
      'hr',
      'table', 'thead', 'tbody', 'tr', 'td', 'th',
      'input' // For checkboxes in markdown
    ],
    ALLOWED_ATTR: [
      'href', 'src', 'alt', 'title',
      'target', 'rel',
      'type', 'disabled', 'checked' // For checkboxes
    ]
  });
};

/**
 * Sanitize object recursively (prevents injection via object properties)
 * @param {object} obj - Object to sanitize
 * @returns {object} Sanitized object
 */
export const sanitizeObject = (obj) => {
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
    sanitized[key] = sanitizeObject(value);
  }
  
  return sanitized;
};

/**
 * Sanitize base64-encoded image data (validate MIME type)
 * @param {string} dataUrl - Data URL (e.g., data:image/jpeg;base64,...)
 * @returns {boolean} Valid image data URL
 */
export const validateBase64Image = (dataUrl) => {
  if (typeof dataUrl !== 'string') return false;
  
  // Check format
  if (!dataUrl.startsWith('data:image/')) return false;
  
  // Whitelist MIME types
  const allowedMimes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
  const mimeMatch = dataUrl.match(/^data:([^;]+);base64,/);
  
  if (!mimeMatch || !allowedMimes.includes(mimeMatch[1])) {
    return false;
  }
  
  // Check base64 format
  const base64Part = dataUrl.split(',')[1];
  return /^[A-Za-z0-9+/=]+$/.test(base64Part);
};

/**
 * Validate file upload (client-side preliminary check before server)
 * @param {File} file - File object from input
 * @param {object} options - Validation options
 * @returns {object} {valid: boolean, error?: string}
 */
export const validateFileUpload = (
  file,
  options = {
    allowedMimes: [],
    maxSizeMB: 25
  }
) => {
  if (!file) {
    return { valid: false, error: 'No file selected' };
  }
  
  // Check MIME type
  if (options.allowedMimes.length > 0 && !options.allowedMimes.includes(file.type)) {
    return { 
      valid: false, 
      error: `Invalid file type. Allowed: ${options.allowedMimes.join(', ')}` 
    };
  }
  
  // Check file size
  const maxBytes = options.maxSizeMB * 1024 * 1024;
  if (file.size > maxBytes) {
    return { 
      valid: false, 
      error: `File too large. Maximum: ${options.maxSizeMB}MB` 
    };
  }
  
  return { valid: true };
};

/**
 * Create DOMPurify config for specific use-cases
 * Returns function to safely render arbitrary HTML
 */
export const createSafeHtmlRenderer = () => {
  return (htmlContent) => {
    return sanitizeHtml(htmlContent);
  };
};

/**
 * Encode HTML entities to prevent interpretation
 * Use when you want to display HTML as text
 * @param {string} text - Text potentially containing HTML
 * @returns {string} HTML-encoded text
 */
export const encodeHtmlEntities = (text) => {
  if (typeof text !== 'string') return '';
  
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
};

export default {
  sanitizeString,
  sanitizeEmail,
  sanitizeUrl,
  sanitizeHtml,
  sanitizeMarkdownHtml,
  sanitizeObject,
  validateBase64Image,
  validateFileUpload,
  createSafeHtmlRenderer,
  encodeHtmlEntities
};
