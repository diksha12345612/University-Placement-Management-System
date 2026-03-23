const mongoose = require('mongoose');

/**
 * AdminSectionAccess Model
 * Tracks verified admin section access sessions
 * Expires after 1 hour for security
 */

const adminSectionAccessSchema = new mongoose.Schema({
    admin: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true,
        index: true
    },
    email: {
        type: String,
        required: true,
        lowercase: true
    },
    verifiedAt: {
        type: Date,
        default: Date.now,
        expires: 3600 // 1 hour in seconds
    },
    ipAddress: String,
    userAgent: String,
    createdAt: {
        type: Date,
        default: Date.now
    }
});

// Index for auto-deletion of expired records
adminSectionAccessSchema.index(
    { verifiedAt: 1 },
    { expireAfterSeconds: 0, name: 'ttl_index_admin_access' }
);

module.exports = mongoose.model('AdminSectionAccess', adminSectionAccessSchema);
