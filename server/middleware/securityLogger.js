/**
 * Security Logging Middleware
 * Logs suspicious activities and security events for monitoring
 */

const securityLogger = {
    // Log failed authentication attempts
    logFailedAuth: (req, email, reason = 'Invalid credentials') => {
        const clientIP = req.ip || req.connection.remoteAddress || 'unknown';
        console.warn(`[SECURITY] Failed auth attempt - Email: ${email}, IP: ${clientIP}, Reason: ${reason}`);
    },

    // Log rate limit violations
    logRateLimitHit: (req, endpoint) => {
        const clientIP = req.ip || req.connection.remoteAddress || 'unknown';
        console.warn(`[SECURITY] Rate limit exceeded - Endpoint: ${endpoint}, IP: ${clientIP}`);
    },

    // Log suspected injection attacks
    logSuspiciousInput: (req, field, value) => {
        const clientIP = req.ip || req.connection.remoteAddress || 'unknown';
        console.warn(`[SECURITY] Suspicious input detected - Field: ${field}, IP: ${clientIP}`);
    },

    // Log unauthorized access attempts
    logUnauthorizedAccess: (req, resource) => {
        const clientIP = req.ip || req.connection.remoteAddress || 'unknown';
        const userId = req.user?.id || 'anonymous';
        console.warn(`[SECURITY] Unauthorized access attempt - Resource: ${resource}, User: ${userId}, IP: ${clientIP}`);
    },

    // Log suspicious CORS attempts
    logCORSViolation: (origin) => {
        console.warn(`[SECURITY] CORS policy violation - Origin: ${origin}`);
    },

    // Log admin actions for audit trail
    logAdminAction: (adminId, action, target, details = '') => {
        const timestamp = new Date().toISOString();
        console.log(`[AUDIT] ${timestamp} - Admin: ${adminId}, Action: ${action}, Target: ${target}, Details: ${details}`);
    }
};

module.exports = securityLogger;
