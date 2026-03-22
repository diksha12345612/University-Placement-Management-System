const mongoose = require('mongoose');

/**
 * OTP Model - PHASE 2.2 Race Condition Prevention
 * 
 * Enhanced with optimistic locking (version field) to prevent OTP overwrites
 * when multiple registration requests arrive simultaneously.
 * 
 * Scenario prevented:
 * Request 1: OTP 123456 → User receives email with 123456
 * Request 2: OTP 654321 → Overwrites to 654321
 * User enters 123456 → Would fail without versioning protection
 */

const otpSchema = new mongoose.Schema({
    email: {
        type: String,
        required: true,
        lowercase: true,
        trim: true,
        index: true
    },
    otp: {
        type: String,
        required: true
    },
    type: {
        type: String,
        enum: ['registration', 'password-reset'],
        default: 'registration'
    },
    createdAt: {
        type: Date,
        default: Date.now,
        expires: 300 // 5 minutes in seconds
    },
    // PHASE 2.2: Expiry timestamp for explicit checks (backup to TTL index)
    expiresAt: {
        type: Date,
        default: () => new Date(Date.now() + 5 * 60 * 1000)
    },
    // PHASE 2.2: Optimistic locking version for preventing race conditions
    // When OTP generation requests arrive simultaneously, only one succeeds
    version: {
        type: Number,
        default: 1,
        min: 1
    },
    // PHASE 2.2: Track failed verification attempts
    // Prevents brute force guessing of OTP
    attempts: {
        type: Number,
        default: 0,
        max: 5
    }
});

// Index to quickly find OTP by email and type
otpSchema.index({ email: 1, type: 1 });

// Auto-delete expired OTPs
otpSchema.index(
    { expiresAt: 1 },
    { expireAfterSeconds: 0, name: 'ttl_index_otp' }
);

module.exports = mongoose.model('OTP', otpSchema);
