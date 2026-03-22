const jwt = require('jsonwebtoken');
const User = require('../models/User');

const auth = async (req, res, next) => {
    try {
        const token = req.header('Authorization')?.replace('Bearer ', '');
        if (!token) {
            return res.status(401).json({ error: 'Access denied. No token provided.' });
        }

        // PHASE 3: Strict JWT validation
        let decoded;
        try {
            decoded = jwt.verify(token, process.env.JWT_SECRET, {
                algorithms: ['HS256'], // Only allow HS256
                ignoreExpiration: false, // Strictly enforce expiration
                complete: false
            });
        } catch (jwtErr) {
            if (jwtErr.name === 'TokenExpiredError') {
                return res.status(401).json({ 
                    error: 'Token has expired. Please login again.',
                    code: 'TOKEN_EXPIRED'
                });
            } else if (jwtErr.name === 'JsonWebTokenError') {
                return res.status(401).json({ 
                    error: 'Invalid token.',
                    code: 'INVALID_TOKEN'
                });
            }
            throw jwtErr;
        }

        // Validate token has required claims
        if (!decoded.id) {
            return res.status(401).json({ error: 'Invalid token structure.' });
        }

        const user = await User.findById(decoded.id);
        if (!user) {
            return res.status(401).json({ error: 'Invalid token. User not found.' });
        }

        // Phase 11: Security enhancement - block active sessions if recruiter approval is revoked
        if (user.role === 'recruiter' && user.isApprovedByAdmin !== true) {
            return res.status(401).json({ error: 'Your recruiter account is not approved or has been revoked by Admin.' });
        }

        req.user = user;
        next();
    } catch (error) {
        console.error('[AUTH ERROR]', error.message);
        res.status(401).json({ error: 'Invalid or expired token.' });
    }
};

const authorize = (...roles) => {
    return (req, res, next) => {
        if (!roles.includes(req.user.role)) {
            return res.status(403).json({ error: 'Access denied. Insufficient permissions.' });
        }
        next();
    };
};

module.exports = { auth, authorize };
