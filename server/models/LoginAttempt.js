const mongoose = require('mongoose');

/**
 * LoginAttempt Model - PHASE 2.1 Distributed Concurrency Support
 * 
 * Replaces in-memory failed login tracking with persistent MongoDB storage
 * Enables login lockout to survive server restarts and work across instances
 * 
 * Features:
 * - Automatic cleanup via TTL index (expires after 30 minutes of inactivity)
 * - Optimistic locking with version field to prevent race conditions
 * - Records failed attempts per email address
 * - Temporary lockout after 5 failures (15 minutes)
 */

const loginAttemptSchema = new mongoose.Schema({
    // Email being tracked
    email: {
        type: String,
        required: true,
        unique: true,
        lowercase: true,
        trim: true,
        index: true
    },
    
    // Failed attempt counter
    failedAttempts: {
        type: Number,
        default: 0,
        min: 0,
        max: 100
    },
    
    // Timestamp of first failed attempt in current window
    firstAttemptAt: {
        type: Date,
        default: () => new Date()
    },
    
    // Timestamp of last failed attempt
    lastAttemptAt: {
        type: Date,
        default: () => new Date()
    },
    
    // If set, account is locked until this time
    lockedUntil: {
        type: Date,
        default: null
    },
    
    // Version field for optimistic locking (compare-and-swap)
    // Prevents race conditions when multiple requests increment attempts
    version: {
        type: Number,
        default: 1,
        min: 1
    }
}, {
    timestamps: true
});

// TTL Index: Automatically delete records 30 minutes after last update
// This ensures stale lockout records are automatically cleaned up
loginAttemptSchema.index(
    { updatedAt: 1 },
    { 
        expireAfterSeconds: 30 * 60,
        name: 'ttl_index_30_minutes'
    }
);

// Prevent duplicate email entries from being created
loginAttemptSchema.index({ email: 1 }, { unique: true, sparse: true });

module.exports = mongoose.model('LoginAttempt', loginAttemptSchema);
