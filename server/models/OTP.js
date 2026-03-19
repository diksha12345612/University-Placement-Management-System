const mongoose = require('mongoose');

const otpSchema = new mongoose.Schema({
    email: {
        type: String,
        required: true,
        lowercase: true,
        trim: true
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
    }
});

// Index to quickly find OTP by email
otpSchema.index({ email: 1 });

module.exports = mongoose.model('OTP', otpSchema);
