const express = require('express');
const router = express.Router();
const { auth, authorize } = require('../middleware/auth');
const upload = require('../middleware/upload');
const User = require('../models/User');

// Get recruiter profile
router.get('/profile', auth, authorize('recruiter'), async (req, res) => {
    try {
        const recruiter = await User.findById(req.user._id);
        res.json(recruiter);
    } catch (error) {
        res.status(500).json({ error: 'Server error' });
    }
});

// Update recruiter profile
router.put('/profile', auth, authorize('recruiter'), async (req, res) => {
    try {
        const updates = req.body || {};
        const existing = await User.findById(req.user._id);
        if (!existing) {
            return res.status(404).json({ error: 'Recruiter not found' });
        }

        const mergedProfile = { ...(existing.recruiterProfile || {}), ...updates };
        const phoneDigits = String(mergedProfile.phone || '').replace(/\D/g, '');
        const phoneCountryCode = String(mergedProfile.phoneCountryCode || '').trim();
        const resolvedName = String(updates.name || existing.name || '').trim();

        const missingFields = [];
        if (!resolvedName) missingFields.push('name');
        if (!String(mergedProfile.company || '').trim()) missingFields.push('company');
        if (!String(mergedProfile.designation || '').trim()) missingFields.push('designation');
        if (!/^\+\d{1,4}$/.test(phoneCountryCode)) missingFields.push('phone country code');
        if (!/^\d{10}$/.test(phoneDigits)) missingFields.push('phone (10 digits)');
        if (!String(mergedProfile.companyWebsite || '').trim()) missingFields.push('company website');
        if (!String(mergedProfile.companyDescription || '').trim()) missingFields.push('company description');
        if (!String(mergedProfile.industry || '').trim()) missingFields.push('industry');

        if (missingFields.length > 0) {
            return res.status(400).json({
                error: `Complete all required profile fields before saving. Missing: ${missingFields.join(', ')}.`,
                missingFields,
                profileRequired: true
            });
        }

        mergedProfile.phone = phoneDigits;
        mergedProfile.phoneCountryCode = phoneCountryCode;

        const recruiter = await User.findByIdAndUpdate(
            req.user._id,
            { $set: { recruiterProfile: mergedProfile, name: resolvedName } },
            { new: true, runValidators: true }
        );
        res.json(recruiter);
    } catch (error) {
        res.status(500).json({ error: 'Error updating profile' });
    }
});

// Get all recruiters (for admin)
router.get('/', auth, authorize('admin'), async (req, res) => {
    try {
        const recruiters = await User.find({ role: 'recruiter' }).select('-password');
        res.json(recruiters);
    } catch (error) {
        res.status(500).json({ error: 'Server error' });
    }
});

// Upload Profile Photo
router.post('/profile-photo', auth, authorize('recruiter'), upload.single('photo'), async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ error: 'No file uploaded' });
        }

        // Accept JPEG and PNG images only
        if (!['image/jpeg', 'image/png', 'image/webp'].includes(req.file.mimetype)) {
            return res.status(400).json({ error: 'Only JPEG, PNG, and WebP images are supported' });
        }

        // Limit file size to 5MB
        if (req.file.size > 5 * 1024 * 1024) {
            return res.status(400).json({ error: 'Image size must be less than 5MB' });
        }

        const fileBuffer = req.file.buffer;
        const base64String = fileBuffer.toString('base64');
        const contentType = req.file.mimetype;

        // Save Base64 string to recruiter profile
        const recruiter = await User.findByIdAndUpdate(
            req.user._id,
            {
                'recruiterProfile.profileImage': base64String,
                'recruiterProfile.profileImageContentType': contentType
            },
            { new: true }
        );

        res.json({ message: 'Profile photo uploaded successfully', recruiter });
    } catch (error) {
        console.error('Error uploading profile photo:', error);
        res.status(500).json({ error: 'Error uploading profile photo' });
    }
});

// GET /recruiters/profile-photo/:id — Serve Profile Photo from MongoDB Base64
router.get('/profile-photo/:id', async (req, res) => {
    try {
        const recruiter = await User.findById(req.params.id);
        if (!recruiter || !recruiter.recruiterProfile || !recruiter.recruiterProfile.profileImage) {
            return res.status(404).json({ error: 'Profile photo not found' });
        }

        const imageBuffer = Buffer.from(recruiter.recruiterProfile.profileImage, 'base64');
        const contentType = recruiter.recruiterProfile.profileImageContentType || 'image/jpeg';

        res.setHeader('Content-Type', contentType);
        res.setHeader('Content-Disposition', 'inline');
        res.send(imageBuffer);
    } catch (error) {
        console.error('Error serving profile photo:', error);
        res.status(500).json({ error: 'Error serving profile photo' });
    }
});

// PHASE 5: Recruiter Dashboard Summary - Real-time polling endpoint
// GET /api/recruiters/dashboard/:recruiterId/summary
router.get('/dashboard/:recruiterId/summary', auth, authorize('recruiter'), async (req, res) => {
    try {
        // Verify recruiter can only access their own dashboard
        if (req.user._id.toString() !== req.params.recruiterId) {
            return res.status(403).json({ error: 'Unauthorized to access this dashboard' });
        }

        const realtimeService = require('../services/realtimeService');
        const summary = await realtimeService.getRecruiterDashboardSummary(req.params.recruiterId);
        
        res.status(200).json({
            success: true,
            timestamp: new Date().toISOString(),
            ...summary
        });
    } catch (error) {
        console.error('[DASHBOARD] Recruiter dashboard error:', error);
        res.status(500).json({ 
            error: 'Failed to fetch dashboard summary',
            message: error.message 
        });
    }
});

module.exports = router;
