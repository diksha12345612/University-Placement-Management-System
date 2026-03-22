/**
 * API Security Middleware
 * Implements per-route request size limits, content-type validation, and injection prevention
 */

const express = require('express');

/**
 * Create middleware for strict request size limits
 * @param {number} maxSizeKB - Maximum request size in kilobytes
 * @param {string} errorMessage - Custom error message
 * @returns {function} Express middleware
 */
const requestSizeLimit = (maxSizeKB, errorMessage = 'Request payload too large') => {
    const maxBytes = maxSizeKB * 1024;
    return express.json({ limit: `${maxSizeKB}kb` });
};

/**
 * Create middleware for strict content-type validation
 * Ensures requests have the correct MIME type
 * @param {string[]} allowedTypes - Array of allowed MIME types (e.g., ['application/json'])
 * @returns {function} Express middleware
 */
const validateContentType = (allowedTypes = ['application/json']) => {
    return (req, res, next) => {
        // Skip validation for GET, HEAD, DELETE requests (no body expected)
        if (['GET', 'HEAD', 'DELETE'].includes(req.method)) {
            return next();
        }

        // Skip if no request body
        if (!req.body || Object.keys(req.body).length === 0) {
            return next();
        }

        const contentType = req.get('Content-Type');
        if (!contentType) {
            return res.status(400).json({
                error: 'Missing Content-Type header. Required: application/json'
            });
        }

        // Extract MIME type (remove charset, boundary, etc.)
        const mimeType = contentType.split(';')[0].trim();

        if (!allowedTypes.includes(mimeType)) {
            return res.status(415).json({
                error: `Unsupported Content-Type: ${mimeType}. Allowed: ${allowedTypes.join(', ')}`
            });
        }

        next();
    };
};

/**
 * Create middleware for per-route request size validation
 * More flexible than built-in limiter - allows different limits for different endpoints
 * @param {number} maxSizeKB - Maximum size in KB
 * @returns {function} Express middleware
 */
const validateRequestSize = (maxSizeKB) => {
    return (req, res, next) => {
        // Get content length from request
        const contentLength = parseInt(req.get('Content-Length'), 10);
        
        if (isNaN(contentLength)) {
            return next(); // Skip if no content-length header
        }

        const maxBytes = maxSizeKB * 1024;
        if (contentLength > maxBytes) {
            return res.status(413).json({
                error: `Request payload exceeds maximum size of ${maxSizeKB}KB`,
                maxSizeKB,
                receivedKB: Math.ceil(contentLength / 1024)
            });
        }

        next();
    };
};

/**
 * Create middleware for request timeout
 * Prevents slow-client attacks and resource exhaustion
 * @param {number} timeoutMs - Timeout in milliseconds
 * @returns {function} Express middleware
 */
const requestTimeout = (timeoutMs = 30000) => { // Default 30 seconds
    return (req, res, next) => {
        const timeout = setTimeout(() => {
            if (!res.headersSent) {
                res.status(408).json({
                    error: 'Request timeout. The server cancelled the request after waiting too long.'
                });
            }
            req.abort();
        }, timeoutMs);

        // Clean up timeout on response
        res.on('finish', () => clearTimeout(timeout));
        res.on('close', () => clearTimeout(timeout));

        next();
    };
};

/**
 * Prevent NoSQL injection in query parameters
 * Ensures only allowed parameter names and types
 * @param {object} allowedParams - Whitelist of allowed parameters
 * @returns {function} Express middleware
 */
const validateQueryParams = (allowedParams = {}) => {
    return (req, res, next) => {
        // If no allowedParams specified, allow all (backward compat)
        if (Object.keys(allowedParams).length === 0) {
            return next();
        }

        // Check for unexpected parameters
        for (const param of Object.keys(req.query)) {
            if (!(param in allowedParams)) {
                console.warn(`[SECURITY] Unexpected query parameter: ${param}`);
                return res.status(400).json({
                    error: `Invalid query parameter: ${param}`
                });
            }
        }

        // Validate parameter types
        for (const [param, expectedType] of Object.entries(allowedParams)) {
            if (param in req.query) {
                const actualType = typeof req.query[param];
                if (expectedType !== 'any' && actualType !== expectedType) {
                    return res.status(400).json({
                        error: `Invalid type for parameter '${param}'. Expected ${expectedType}, got ${actualType}`
                    });
                }
            }
        }

        next();
    };
};

/**
 * Create endpoint-specific API security profile
 * Combines multiple security checks for a specific endpoint
 * @param {object} config - Configuration object
 *   - maxSizeKB: number (default 10)
 *   - allowedContentTypes: string[] (default ['application/json'])
 *   - timeoutMs: number (default 30000)
 *   - queryParams: object (allowed query parameters)
 * @returns {array} Array of middleware functions
 */
const createApiSecurityMiddleware = (config = {}) => {
    const {
        maxSizeKB = 10,
        allowedContentTypes = ['application/json'],
        timeoutMs = 30000,
        queryParams = {}
    } = config;

    const middleware = [];

    // Request timeout
    middleware.push(requestTimeout(timeoutMs));

    // Content-type validation
    middleware.push(validateContentType(allowedContentTypes));

    // Request size validation
    middleware.push(validateRequestSize(maxSizeKB));

    // Query parameters validation
    if (Object.keys(queryParams).length > 0) {
        middleware.push(validateQueryParams(queryParams));
    }

    return middleware;
};

/**
 * Pre-defined security profiles for common endpoint types
 */
const securityProfiles = {
    // Authentication endpoints (smaller payload, quick processing)
    auth: {
        maxSizeKB: 8,
        allowedContentTypes: ['application/json'],
        timeoutMs: 10000
    },

    // Profile update endpoints (moderate payload)
    profileUpdate: {
        maxSizeKB: 500,
        allowedContentTypes: ['application/json'],
        timeoutMs: 20000
    },

    // File upload endpoints (larger payload)
    upload: {
        maxSizeKB: 25000, // 25MB
        allowedContentTypes: ['multipart/form-data', 'application/octet-stream'],
        timeoutMs: 60000 // 1 minute for uploads
    },

    // API endpoint (standard)
    api: {
        maxSizeKB: 100,
        allowedContentTypes: ['application/json'],
        timeoutMs: 30000
    },

    // Data submission (moderate)
    submission: {
        maxSizeKB: 200,
        allowedContentTypes: ['application/json'],
        timeoutMs: 25000
    }
};

module.exports = {
    requestSizeLimit,
    validateContentType,
    validateRequestSize,
    requestTimeout,
    validateQueryParams,
    createApiSecurityMiddleware,
    securityProfiles
};
