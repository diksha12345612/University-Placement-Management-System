const express = require('express');
const router = express.Router();
const { auth, authorize } = require('../middleware/auth');
const Application = require('../models/Application');
const Job = require('../models/Job');
const Notification = require('../models/Notification');

// Apply for a job (student)
router.post('/', auth, authorize('student'), async (req, res) => {
    try {
        const { jobId, coverLetter } = req.body;

        // Validate jobId format (CRITICAL FIX: Missing validation)
        if (!jobId) return res.status(400).json({ error: 'Job ID is required' });

        const profile = req.user.studentProfile || {};
        
        // CRITICAL FIX: Null check for profile - prevents crash on empty profiles
        if (!profile || Object.keys(profile).length === 0) {
            return res.status(400).json({
                error: 'Complete your profile before applying.',
                missingFields: ['Complete profile'],
                profileRequired: true,
                profilePath: '/student/profile'
            });
        }
        
        const normalizedSkills = Array.isArray(profile.skills)
            ? profile.skills.filter((s) => String(s || '').trim())
            : String(profile.skills || '')
                .split(',')
                .map((s) => s.trim())
                .filter(Boolean);

        const missingFields = [];
        if (!String(req.user.name || '').trim()) missingFields.push('name');
        if (!String(profile.rollNumber || '').trim()) missingFields.push('roll number');
        if (normalizedSkills.length === 0) missingFields.push('tech stack (skills)');
        const hasResumeUrl = Boolean(String(profile.resumeUrl || '').trim());
        const hasResumeBlob = Boolean(String(profile.resumeBase64 || '').trim());
        if (!hasResumeUrl && !hasResumeBlob) missingFields.push('resume');

        if (missingFields.length > 0) {
            return res.status(400).json({
                error: `Complete your profile before applying. Missing: ${missingFields.join(', ')}.`,
                missingFields,
                profileRequired: true,
                profilePath: '/student/profile'
            });
        }

        const job = await Job.findById(jobId);
        if (!job) return res.status(404).json({ error: 'Job not found' });
        if (job.status !== 'approved') return res.status(400).json({ error: 'Job is not approved for applications' });

        // CRITICAL FIX: Use atomic check-and-insert to prevent duplicate applications race condition
        const application = new Application({
            job: jobId,
            student: req.user._id,
            coverLetter,
            resumeUrl: profile.resumeUrl
        });
        
        try {
            await application.save();
        } catch (err) {
            // CRITICAL FIX: Catch duplicate key error properly
            if (err.code === 11000) {
                return res.status(400).json({ error: 'You have already applied for this job' });
            }
            throw err;
        }

        // Notify recruiter
        await new Notification({
            user: job.postedBy,
            title: 'New Application',
            message: `${req.user.name} applied for ${job.title}`,
            type: 'application',
            link: '/recruiter/my-jobs'
        }).save();

        res.status(201).json(application);
    } catch (error) {
        if (error.code === 11000) return res.status(400).json({ error: 'Already applied for this job' });
        res.status(500).json({ error: 'Error submitting application' });
    }
});

// Get my applications (student)
router.get('/my-applications', auth, authorize('student'), async (req, res) => {
    try {
        const applications = await Application.find({ student: req.user._id })
            .populate({ path: 'job', populate: { path: 'postedBy', select: 'name email recruiterProfile' } })
            .sort('-createdAt');
        res.json(applications);
    } catch (error) {
        res.status(500).json({ error: 'Server error' });
    }
});

const path = require('path');
const { extractTextFromPDF, analyzeResume } = require('../services/aiService');
const { parseResumeFile } = require('../services/resumeParser');
const { calculateScore } = require('../utils/atsScorer');
const ATSSettings = require('../models/ATSSettings');


// Get applicants for a job (recruiter)
router.get('/job/:jobId', auth, authorize('recruiter', 'admin'), async (req, res) => {
    try {
        const applications = await Application.find({ job: req.params.jobId })
            .populate('student', 'name email studentProfile')
            .sort('-createdAt');
        res.json(applications);
    } catch (error) {
        res.status(500).json({ error: 'Server error' });
    }
});

// ATS / AI Evaluate a single application (recruiter)
router.post('/:id/ai-evaluate', auth, authorize('recruiter'), async (req, res) => {
    try {
        const application = await Application.findById(req.params.id)
            .populate('student', 'name studentProfile')
            .populate('job', 'title description');

        if (!application) return res.status(404).json({ error: 'Application not found' });

        const studentProfile = application.student.studentProfile || {};
        const resumeUrl = application.resumeUrl || studentProfile.resumeUrl;

        let settings = await ATSSettings.findOne({});
        if (!settings) settings = new ATSSettings(); // Default weights

        if (resumeUrl) {
            try {
                // In production, we'd pass the actual file buffer from GridFS or Base64 here.
                // For the mocked parser, we can just pass the user metadata or URL
                const parsedData = await parseResumeFile(studentProfile.resumeBase64 || resumeUrl);
                
                const jobDescription = `${application.job.title}\n${application.job.description}`;
                const atsResult = calculateScore(parsedData, jobDescription, settings, application.job.title);

                application.atsEvaluation = atsResult;
                application.aiEvaluation = {
                    matchScore: atsResult.atsScore,
                    matchPercentage: atsResult.atsScore,
                    recommendation: atsResult.atsScore >= settings.thresholdScore ? 'Strong' : (atsResult.atsScore >= 50 ? 'Moderate' : 'Weak'),
                    lastEvaluated: new Date()
                };

                await application.save();
                res.json(application);
            } catch (e) {
                console.error('ATS Evaluation Error:', e.message);
                res.status(500).json({ error: 'ATS evaluation failed: ' + e.message });
            }
        } else {
             res.status(400).json({ error: 'No resume found' });
        }
    } catch (error) {
        console.error('Evaluation Error:', error);
        res.status(500).json({ error: 'Evaluation failed: ' + error.message });
    }
});

// ATS Rank all applicants for a job (recruiter)
router.post('/job/:jobId/ai-rank', auth, authorize('recruiter'), async (req, res) => {
    try {
        const applications = await Application.find({ job: req.params.jobId })
            .populate('student', 'name email studentProfile')
            .populate('job', 'title description');

        if (applications.length === 0) {
            return res.status(400).json({ error: 'No applicants to rank' });
        }

        let settings = await ATSSettings.findOne({});
        if (!settings) settings = new ATSSettings(); // Provide defaults

        let rankedCount = 0;
        for (const app of applications) {
            try {
                const studentProfile = app.student?.studentProfile || {};
                const resumeUrl = app.resumeUrl || studentProfile.resumeUrl;

                if (!resumeUrl) continue;

                let parsedData;
                try {
                    parsedData = await parseResumeFile(studentProfile.resumeBase64 || resumeUrl);
                } catch (e) {
                    console.warn(`Could not read/parse resume for ${app.student.name}:`, e.message);
                    continue;
                }

                const jobDescription = `${app.job.title}\n${app.job.description}`;
                const atsResult = calculateScore(parsedData, jobDescription, settings, app.job.title);

                app.atsEvaluation = atsResult;
                app.aiEvaluation = {
                    matchScore: atsResult.atsScore,
                    matchPercentage: atsResult.atsScore,
                    recommendation: atsResult.atsScore >= settings.thresholdScore ? 'Strong' : (atsResult.atsScore >= 50 ? 'Moderate' : 'Weak'),
                    strengthSummary: atsResult.suggestions?.length ? atsResult.suggestions.join('. ') : 'Good match.',
                    lastEvaluated: new Date()
                };

                await app.save();
                rankedCount++;
                console.log(`✅ Ranked ${app.student.name}: ${atsResult.atsScore}% match`);
            } catch (err) {
                console.error(`❌ Failed to evaluate application ${app._id}:`, err.message);
            }
        }

        const rankedApps = await Application.find({ job: req.params.jobId })
            .populate('student', 'name email studentProfile')
            .sort('-aiEvaluation.matchScore');

        console.log(`ATS Ranking complete: ${rankedCount}/${applications.length} applicants evaluated`);
        res.json(rankedApps);
    } catch (error) {
        console.error('ATS Rank Error:', error);
        res.status(500).json({ error: 'Ranking failed: ' + error.message });
    }
});

// Update application status (recruiter/admin)
router.put('/:id/status', auth, authorize('recruiter', 'admin'), async (req, res) => {
    try {
        const { status } = req.body;
        const application = await Application.findByIdAndUpdate(
            req.params.id,
            { status },
            { new: true }
        ).populate('job', 'title');

        if (!application) return res.status(404).json({ error: 'Application not found' });

        // Notify student
        await new Notification({
            user: application.student,
            title: 'Application Update',
            message: `Your application for ${application.job.title} has been ${status}`,
            type: status === 'selected' ? 'success' : status === 'rejected' ? 'warning' : 'info',
            link: '/student/applications'
        }).save();

        // Automate Student Placement Status
        if (status === 'selected') {
            const User = require('../models/User');
            await User.findByIdAndUpdate(application.student, {
                'studentProfile.isPlaced': true,
                'studentProfile.placedAt': application.job.company || 'N/A'
            });
        }

        // Notify Admin if shortlisted
        if (status === 'shortlisted') {
            const admins = await User.find({ role: 'admin' });
            for (const admin of admins) {
                await new Notification({
                    user: admin._id,
                    title: 'Student Shortlisted',
                    message: `A student has been shortlisted for ${application.job.title}`,
                    type: 'success',
                    link: '/admin/reports'
                }).save();
            }
        }

        res.json(application);
    } catch (error) {
        res.status(500).json({ error: 'Error updating application status' });
    }
});

// Get all applications (admin)
router.get('/', auth, authorize('admin'), async (req, res) => {
    try {
        const applications = await Application.find()
            .populate('student', 'name email studentProfile')
            .populate({ path: 'job', populate: { path: 'postedBy', select: 'name recruiterProfile' } })
            .sort('-createdAt');
        res.json(applications);
    } catch (error) {
        res.status(500).json({ error: 'Server error' });
    }
});

module.exports = router;
