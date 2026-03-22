const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');
const { body, validationResult } = require('express-validator');
const User = require('../models/User');
const { auth } = require('../middleware/auth');
const OTP = require('../models/OTP');
const { sendOTP } = require('../services/emailService');
const { otpRequestLimiter, otpVerifyLimiter, loginLimiter } = require('../middleware/rateLimiter');
const { validateSchema } = require('../utils/validationSchemas');
const { authSchemas } = require('../utils/validationSchemas');
const { createApiSecurityMiddleware, securityProfiles } = require('../middleware/apiSecurity');
// PHASE 2: Import concurrency utilities for distributed state management
const { 
    recordFailedLoginAttempt, 
    recordSuccessfulLogin, 
    isLoginLocked,
    setOTPWithVersioning,
    verifyOTPWithVersioning
} = require('../utils/concurrencyUtils');

const getAdminContactEmail = () => {
    return process.env.ADMIN_EMAIL || process.env.EMAIL_USER || 'admin@university.edu';
};

// Phase 1: Request OTP for Signup - with strict API security
router.post('/register-otp', [
    ...createApiSecurityMiddleware(securityProfiles.auth),
    otpRequestLimiter,
    validateSchema(authSchemas.registerOtp, 'body'),
    body('name').trim().notEmpty().withMessage('Name is required'),
    body('email').isEmail().withMessage('Valid email is required'),
    body('password').isLength({ min: 6 }).withMessage('Password must be at least 6 characters'),
    body('role').isIn(['student', 'recruiter']).withMessage('Role must be student or recruiter')
], async (req, res) => {
    try {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({ errors: errors.array() });
        }

        const { email } = req.body;
        const normalizedEmail = email.toLowerCase().trim();

        // Check if user already exists
        const existingUser = await User.findOne({ email: normalizedEmail });
        if (existingUser && existingUser.isVerified) {
            return res.status(400).json({ error: 'An account with this email already exists and is verified. Please login.' });
        }

        // Generate 6-digit OTP
        const otp = Math.floor(100000 + Math.random() * 900000).toString();

        console.log('[AUTH] Generated OTP:', { email: normalizedEmail, otp, otpLength: otp.length });

        // PHASE 2: Use versioning to prevent OTP overwrite race conditions
        // Ensures that if multiple requests arrive at same time, only one OTP is set
        await setOTPWithVersioning(normalizedEmail, otp, 'registration');

        // Send OTP via Email and report delivery status
        const emailResult = await sendOTP(normalizedEmail, otp);
        const isDev = process.env.NODE_ENV !== 'production';

        if (!emailResult.sent) {
            return res.status(503).json({
                error: 'Unable to deliver OTP email right now. Please try again in a minute.',
                ...(isDev ? { emailError: emailResult.error } : {})
            });
        }

        res.status(200).json({
            message: 'OTP sent to your email successfully.',
            emailSent: true
        });
    } catch (error) {
        console.error('Register-OTP Error:', error);
        res.status(500).json({ error: `Server error: ${error.message || 'OTP request failed'}` });
    }
});

// Phase 2: Verify OTP and Create Account - with strict API security
router.post('/register-verify', [
    ...createApiSecurityMiddleware(securityProfiles.auth),
    otpVerifyLimiter,
    validateSchema(authSchemas.registerVerify, 'body'),
    body('name').trim().notEmpty().withMessage('Name is required'),
    body('email').isEmail().withMessage('Valid email is required'),
    body('password').isLength({ min: 6 }).withMessage('Password must be at least 6 characters'),
    body('role').isIn(['student', 'recruiter']).withMessage('Role must be student or recruiter'),
    body('otp').trim().isLength({ min: 6, max: 6 }).withMessage('Valid 6-digit OTP is required')
], async (req, res) => {
    try {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            console.error('[AUTH] Register-verify validation errors:', errors.array());
            return res.status(400).json({ 
                error: 'Validation failed',
                errors: errors.array(),
                details: errors.array().map(e => `${e.param}: ${e.msg}`).join('; ')
            });
        }

        const { name, password, role, otp } = req.body;
        const email = req.body.email.toLowerCase().trim();

        console.log('[AUTH] Register-verify attempt:', { email, role, otpLength: otp.length });

        // PHASE 2: Use versioning for safe OTP verification with attempt tracking
        const otpVerifyResult = await verifyOTPWithVersioning(email, otp, 'registration');
        if (!otpVerifyResult.valid) {
            console.error('[AUTH] OTP verification failed:', { email, error: otpVerifyResult.error });
            return res.status(400).json({ error: otpVerifyResult.error });
        }
        
        const otpRecord = otpVerifyResult.otpRecord;

        // Final duplicate check just in case
        const existingUser = await User.findOne({ email });
        if (existingUser && existingUser.isVerified) {
            return res.status(400).json({ error: 'Email already verified and registered.' });
        }

        // If unverified user exists, update them, else create new
        let user;
        if (existingUser) {
            existingUser.name = name;
            existingUser.password = password;
            existingUser.role = role;
            existingUser.isVerified = true;
            user = await existingUser.save();
        } else {
            user = new User({ name, email, password, role, isVerified: true });
            await user.save();
        }

        // Delete successful OTP record
        await OTP.deleteOne({ _id: otpRecord._id });

        // Notify Admins of new registration
        const Notification = require('../models/Notification');
        const admins = await User.find({ role: 'admin' });
        for (const admin of admins) {
            await new Notification({
                user: admin._id,
                title: user.role === 'recruiter' ? 'New Recruiter Approval' : 'New Student Registered',
                message: `${user.name} has registered as a ${user.role}.`,
                type: user.role === 'recruiter' ? 'warning' : 'info',
                link: user.role === 'recruiter' ? '/admin/recruiters' : '/admin/students'
            }).save();
        }

        // Phase 11: Do not issue token if recruiter is not approved
        if (user.role === 'recruiter' && user.isApprovedByAdmin !== true) {
            return res.status(201).json({
                user,
                message: 'Account verified! Pending admin approval.',
                adminEmail: getAdminContactEmail()
            });
        }

        const token = jwt.sign({ id: user._id, role: user.role }, process.env.JWT_SECRET, { expiresIn: process.env.JWT_EXPIRE || '7d' });

        res.status(201).json({ token, user, message: 'Account verified and created successfully!' });
    } catch (error) {
        console.error('Verify-OTP Error:', error);
        res.status(500).json({ error: 'Server error during verification' });
    }
});

// Login - with strict brute force protection and API security
// PHASE 2: Uses distributed login attempt tracking (MongoDB) instead of in-memory
router.post('/login', [
    ...createApiSecurityMiddleware(securityProfiles.auth),
    loginLimiter,
    validateSchema(authSchemas.login, 'body'),
    body('email').isEmail().withMessage('Valid email is required'),
    body('password').notEmpty().withMessage('Password is required')
], async (req, res) => {
    try {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({ errors: errors.array() });
        }

        // Always normalize email to lowercase
        const email = req.body.email.toLowerCase().trim();
        const { password } = req.body;

        console.log(`Login attempt for: ${email}`);

        // PHASE 2: Check if account is locked due to failed attempts (distributed, survives restart)
        const lockStatus = await isLoginLocked(email);
        if (lockStatus.locked) {
            console.warn(`[SECURITY] Login attempt from locked account: ${email}`);
            return res.status(429).json({
                error: `Account temporarily locked due to too many failed attempts. Try again in ${lockStatus.minutesRemaining} minutes.`,
                errorCode: 'ACCOUNT_LOCKED',
                minutesRemaining: lockStatus.minutesRemaining
            });
        }

        const user = await User.findOne({ email });
        if (!user) {
            console.log(`Login failed: No user found with email ${email}`);
            // PHASE 2: Record failed attempt in MongoDB (survives restart)
            await recordFailedLoginAttempt(email);
            return res.status(401).json({ error: 'Invalid email or password' });
        }

        if (!user.isVerified) {
            // Record failed attempt
            await recordFailedLoginAttempt(email);
            return res.status(403).json({ error: 'Account not verified. Please register again to verify your email.' });
        }

        // Phase 11: Recruiter Approval Block
        if (user.role === 'recruiter') {
            if (user.isApprovedByAdmin !== true) {
                console.log(`Login blocked: Recruiter ${email} is pending admin approval.`);
                await recordFailedLoginAttempt(email);
                return res.status(403).json({ error: 'Your recruiter account is pending Admin approval. You will gain access once verified.' });
            }
        }

        const isMatch = await user.comparePassword(password);
        if (!isMatch) {
            console.log(`Login failed: Incorrect password for ${email}`);
            // PHASE 2: Record failed attempt
            await recordFailedLoginAttempt(email);
            return res.status(401).json({ error: 'Invalid email or password' });
        }

        // Success! Clear failed login attempts
        // PHASE 2: Clear from MongoDB (distributed state)
        await recordSuccessfulLogin(email);

        console.log(`Login success for: ${email} (${user.role})`);
        
        // PHASE 3: Validate JWT claims before issuing
        const token = jwt.sign(
            { 
                id: user._id, 
                role: user.role,
                iat: Math.floor(Date.now() / 1000) // Issued at time
            }, 
            process.env.JWT_SECRET, 
            { 
                expiresIn: process.env.JWT_EXPIRE || '7d',
                algorithm: 'HS256' // Explicit algorithm
            }
        );

        res.json({ token, user });
    } catch (error) {
        console.error('Login Error:', error);
        res.status(500).json({ error: 'Server error during login' });
    }
});

// Get current user
router.get('/me', auth, async (req, res) => {
    try {
        res.json(req.user);
    } catch (error) {
        res.status(500).json({ error: 'Server error' });
    }
});

// Phase 3: Forgot Password - Request OTP for password reset
router.post('/forgot-password-otp', [
    otpRequestLimiter,
    body('email').isEmail().withMessage('Valid email is required')
], async (req, res) => {
    try {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({ errors: errors.array() });
        }

        const email = req.body.email.toLowerCase().trim();

        // Check if user exists and is verified
        const user = await User.findOne({ email });
        if (!user || !user.isVerified) {
            return res.status(404).json({ 
                error: 'No verified account found with this email. Please create an account first.' 
            });
        }

        // Generate 6-digit OTP
        const otp = Math.floor(100000 + Math.random() * 900000).toString();

        // Save OTP to DB (for password reset, we'll use a flag to distinguish from registration)
        await OTP.findOneAndUpdate(
            { email },
            { otp, createdAt: new Date(), type: 'password-reset' },
            { upsert: true, new: true }
        );

        // Send OTP via Email
        const emailResult = await sendOTP(email, otp);
        const isDev = process.env.NODE_ENV !== 'production';

        if (!emailResult.sent) {
            return res.status(503).json({
                error: 'Unable to deliver OTP email right now. Please try again in a minute.',
                ...(isDev ? { emailError: emailResult.error } : {})
            });
        }

        res.status(200).json({
            message: 'OTP sent to your email. Please check your inbox.',
            emailSent: true
        });
    } catch (error) {
        console.error('Forgot-Password-OTP Error:', error);
        res.status(500).json({ error: `Server error: ${error.message || 'OTP request failed'}` });
    }
});

// Phase 4: Forgot Password - Verify OTP and Reset Password
router.post('/reset-password', [
    otpVerifyLimiter,
    body('email').isEmail().withMessage('Valid email is required'),
    body('otp').isLength({ min: 6, max: 6 }).withMessage('Valid 6-digit OTP is required'),
    body('newPassword').isLength({ min: 6 }).withMessage('New password must be at least 6 characters')
], async (req, res) => {
    try {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({ errors: errors.array() });
        }

        const email = req.body.email.toLowerCase().trim();
        const { otp, newPassword } = req.body;

        // Check if user exists and is verified
        const user = await User.findOne({ email });
        if (!user || !user.isVerified) {
            return res.status(404).json({ 
                error: 'Account not found. Please create an account first.' 
            });
        }

        // Check OTP (verify it's a password-reset type) using versioned verification
        const { valid, otpRecord, error: otpError } = await verifyOTPWithVersioning(
            email, 
            otp, 
            'password-reset'
        );
        
        if (!valid) {
            return res.status(400).json({ error: otpError });
        }

        // Update password
        user.password = newPassword;
        await user.save();

        // Delete successful OTP record
        await OTP.deleteOne({ _id: otpRecord._id });

        res.status(200).json({
            message: 'Password reset successfully! You can now sign in with your new password.',
            success: true
        });
    } catch (error) {
        console.error('Reset-Password Error:', error);
        res.status(500).json({ error: 'Server error during password reset' });
    }
});

module.exports = router;

