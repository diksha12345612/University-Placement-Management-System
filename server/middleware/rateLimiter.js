const rateLimit = require('express-rate-limit');

// Max 3 OTP requests per minute from a single IP/email
const otpRequestLimiter = rateLimit({
    windowMs: 60 * 1000,
    max: 3,
    message: { error: 'Too many OTP requests. Please try again after a minute.' },
    standardHeaders: true,
    legacyHeaders: false,
});

// Max 5 OTP verification attempts per minute
const otpVerifyLimiter = rateLimit({
    windowMs: 60 * 1000,
    max: 5,
    message: { error: 'Too many failed attempts. Please try again later.' },
    standardHeaders: true,
    legacyHeaders: false,
});

// PHASE 3 HARDENING: Strict Login Rate Limiting
// Max 5 login attempts per 5 minutes from a single IP
// This prevents brute force attacks on credentials
const loginLimiter = rateLimit({
    windowMs: 5 * 60 * 1000, // 5 minute window
    max: 5, // 5 attempts per window
    message: { 
        error: 'Too many login attempts. Account temporarily locked. Please try again in 5 minutes.',
        retryAfter: '5 minutes'
    },
    standardHeaders: true,
    legacyHeaders: false,
    skipSuccessfulRequests: false, // Count even successful logins
    skipFailedRequests: false, // Count failed attempts too
    handler: (req, res) => {
        // Log potential brute force attack
        console.warn(`[SECURITY] Brute force login attempt detected from IP: ${req.ip}`);
        res.status(429).json({ 
            error: 'Too many login attempts. Please try again in 5 minutes.',
            retryAfter: Math.ceil(req.rateLimit.resetTime / 1000),
            errorCode: 'ACCOUNT_TEMPORARILY_LOCKED'
        });
    }
});

// Failed Login Tracking per Username/Email
// Stores failed login attempts in-memory (in production, use Redis)
const failedLoginAttempts = new Map();

/**
 * Track and enforce per-user login failure limits
 * Implements temporary account lockout after 5 failed attempts
 * Lockout duration: 15 minutes (exponential could be better in production)
 */
const loginFailureTracker = (req, res, next) => {
    const email = req.body?.email?.toLowerCase().trim();
    
    if (!email) {
        return next();
    }
    
    const now = Date.now();
    const lockoutDuration = 15 * 60 * 1000; // 15 minutes
    
    // Get or initialize user's failure record
    if (!failedLoginAttempts.has(email)) {
        failedLoginAttempts.set(email, {
            attempts: 0,
            firstAttemptTime: now,
            lockoutUntil: null
        });
    }
    
    const record = failedLoginAttempts.get(email);
    
    // Check if user is currently locked out
    if (record.lockoutUntil && record.lockoutUntil > now) {
        const minutesRemaining = Math.ceil((record.lockoutUntil - now) / 60000);
        console.warn(`[SECURITY] Login attempt from locked-out account: ${email}`);
        return res.status(429).json({
            error: `Account temporarily locked due to too many failed attempts. Try again in ${minutesRemaining} minutes.`,
            errorCode: 'ACCOUNT_LOCKED',
            minutesRemaining
        });
    }
    
    // Reset counter if window expired (no attempts for 30 minutes)
    if (now - record.firstAttemptTime > 30 * 60 * 1000) {
        record.attempts = 0;
        record.firstAttemptTime = now;
        record.lockoutUntil = null;
    }
    
    // Attach ability to record failed login
    req.recordFailedLogin = () => {
        record.attempts++;
        record.lastAttemptTime = now;
        
        // Lock account after 5 failed attempts
        if (record.attempts >= 5) {
            record.lockoutUntil = now + lockoutDuration;
            console.warn(`[SECURITY] Account locked after 5 failed login attempts: ${email}`);
        }
    };
    
    // Attach ability to clear failed login count on success
    req.clearFailedLogins = () => {
        failedLoginAttempts.delete(email);
    };
    
    next();
};

module.exports = {
    otpRequestLimiter,
    otpVerifyLimiter,
    loginLimiter,
    loginFailureTracker
};
