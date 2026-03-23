const express = require('express');
const router = express.Router();
const { auth, authorize } = require('../middleware/auth');
const Application = require('../models/Application');
const Job = require('../models/Job');
const User = require('../models/User');
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

// Get my applications (student) - PAGINATION SUPPORTED (backward compatible)
router.get('/my-applications', auth, authorize('student'), async (req, res) => {
    try {
        // Check if pagination is requested via query params
        const hasPaginationParams = req.query.page || req.query.limit;
        
        const page = Math.max(1, parseInt(req.query.page) || 1);
        const limit = Math.min(100, parseInt(req.query.limit) || 20);
        const skip = (page - 1) * limit;
        
        let query = Application.find({ student: req.user._id })
            .populate({ path: 'job', populate: { path: 'postedBy', select: 'name email recruiterProfile' } })
            .sort('-createdAt')
            .lean();
        
        // If pagination params provided, apply them; otherwise return all
        if (hasPaginationParams) {
            query = query.skip(skip).limit(limit);
            const applications = await query;
            const total = await Application.countDocuments({ student: req.user._id });
            res.json({
                applications,
                pagination: { page, limit, total, pages: Math.ceil(total / limit) }
            });
        } else {
            // Return simple array for backward compatibility
            const applications = await query;
            res.json(applications);
        }
    } catch (error) {
        res.status(500).json({ error: 'Error fetching applications' });
    }
});

const path = require('path');
const { extractTextFromPDF, analyzeResume } = require('../services/aiService');
const { parseResumeFile } = require('../services/resumeParser');
const { calculateScore } = require('../utils/atsScorer');
const ATSSettings = require('../models/ATSSettings');


// Get applicants for a job (recruiter) - PAGINATION SUPPORTED (backward compatible)
router.get('/job/:jobId', auth, authorize('recruiter', 'admin'), async (req, res) => {
    try {
        const hasPaginationParams = req.query.page || req.query.limit;
        
        const page = Math.max(1, parseInt(req.query.page) || 1);
        const limit = Math.min(100, parseInt(req.query.limit) || 20);
        const skip = (page - 1) * limit;
        
        let query = Application.find({ job: req.params.jobId })
            .populate('student', 'name email studentProfile')
            .sort('-createdAt')
            .lean();
        
        if (hasPaginationParams) {
            query = query.skip(skip).limit(limit);
            const applications = await query;
            const total = await Application.countDocuments({ job: req.params.jobId });
            res.json({
                applications,
                pagination: { page, limit, total, pages: Math.ceil(total / limit) }
            });
        } else {
            // Return simple array for backward compatibility
            const applications = await query;
            res.json(applications);
        }
    } catch (error) {
        res.status(500).json({ error: 'Error fetching applicants' });
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
                // Parse resume with Affinda API (or fallback)
                const parsedData = await parseResumeFile(studentProfile.resumeBase64 || resumeUrl);
                
                // Get resume full text - PRIORITY: Affinda's rawText > PDF extraction > fallback
                let resumeText = parsedData.rawText || ''; // Affinda provides raw extracted text
                if (!resumeText && studentProfile.resumeBase64) {
                    try {
                        const buffer = Buffer.from(studentProfile.resumeBase64, 'base64');
                        resumeText = await extractTextFromPDF(buffer);
                    } catch (e) {
                        // Fallback to parsed data reconstruction
                        resumeText = (parsedData.keywords || []).join(' ') + ' ' + (parsedData.skills || []).join(' ');
                    }
                }

                const jobDescription = `${application.job.title}\n${application.job.description}`;
                
                // Calculate ATS score with new algorithm
                // Pass: parsedResume (Affinda data), jobDescription, settings, jobRole, resumeText
                const atsResult = calculateScore(parsedData, jobDescription, settings, application.job.title, resumeText);

                application.atsEvaluation = {
                    ...atsResult,
                    evaluationVersion: 2, // Indicates new algorithm
                    parsedBy: parsedData.parsedBy // Track: 'affinda' or 'fallback'
                };
                
                application.aiEvaluation = {
                    matchScore: atsResult.atsScore,
                    matchPercentage: atsResult.atsScore,
                    recommendation: atsResult.atsScore >= settings.thresholdScore ? 'Strong' : (atsResult.atsScore >= 50 ? 'Moderate' : 'Weak'),
                    lastEvaluated: new Date()
                };

                await application.save();
                res.json(application);
            } catch (e) {
                res.status(500).json({ error: 'ATS evaluation failed: ' + e.message });
            }
        } else {
             res.status(400).json({ error: 'No resume found' });
        }
    } catch (error) {
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

                // Get resume full text - PRIORITY: Affinda's rawText > PDF extraction > fallback
                let resumeText = parsedData.rawText || ''; // Affinda provides raw extracted text
                if (!resumeText && studentProfile.resumeBase64) {
                    try {
                        const buffer = Buffer.from(studentProfile.resumeBase64, 'base64');
                        resumeText = await extractTextFromPDF(buffer);
                    } catch (e) {
                        // Fallback to parsed data reconstruction
                        resumeText = (parsedData.keywords || []).join(' ') + ' ' + (parsedData.skills || []).join(' ');
                    }
                }

                const jobDescription = `${app.job.title}\n${app.job.description}`;
                const atsResult = calculateScore(parsedData, jobDescription, settings, app.job.title, resumeText);

                app.atsEvaluation = {
                    ...atsResult,
                    evaluationVersion: 2,
                    parsedBy: parsedData.parsedBy // Track: 'affinda' or 'fallback'
                };
                
                app.aiEvaluation = {
                    matchScore: atsResult.atsScore,
                    matchPercentage: atsResult.atsScore,
                    recommendation: atsResult.atsScore >= settings.thresholdScore ? 'Strong' : (atsResult.atsScore >= 50 ? 'Moderate' : 'Weak'),
                    strengthSummary: atsResult.suggestions?.length ? atsResult.suggestions.join('. ') : 'Good match.',
                    lastEvaluated: new Date()
                };

                await app.save();
                rankedCount++;
            } catch (err) {
                console.warn(`Error ranking application: ${err.message}`);
                // Silent fail for individual apps, continue ranking
            }
        }

        const rankedApps = await Application.find({ job: req.params.jobId })
            .populate('student', 'name email studentProfile')
            .sort('-aiEvaluation.matchScore')
            .lean();

        res.json(rankedApps);
    } catch (error) {
        res.status(500).json({ error: 'Ranking failed: ' + error.message });
    }
});

// Update application status (recruiter/admin)
router.put('/:id/status', auth, authorize('recruiter', 'admin'), async (req, res) => {
    try {
        const { status } = req.body;
        if (!status) return res.status(400).json({ error: 'Status is required' });

        const application = await Application.findByIdAndUpdate(
            req.params.id,
            { status },
            { new: true }
        ).populate('job', 'title company');

        if (!application) return res.status(404).json({ error: 'Application not found' });

        // Get job title safely (handle missing job reference)
        const jobTitle = application.job ? application.job.title : 'Unknown Job';
        const jobCompany = application.job ? application.job.company : 'N/A';

        // Notify student
        try {
            await new Notification({
                user: application.student,
                title: 'Application Update',
                message: `Your application for ${jobTitle} has been ${status}`,
                type: status === 'selected' ? 'success' : status === 'rejected' ? 'warning' : 'info',
                link: '/student/applications'
            }).save();
        } catch (notifErr) {
            console.error('Notification save error:', notifErr.message);
            // Don't fail the whole request if notification fails
        }

        // Automate Student Placement Status
        if (status === 'selected') {
            try {
                await User.findByIdAndUpdate(application.student, {
                    'studentProfile.isPlaced': true,
                    'studentProfile.placedAt': jobCompany
                });
            } catch (userErr) {
                console.error('User update error:', userErr.message);
                // Don't fail if user update fails
            }
        }

        // Notify Admin if shortlisted
        if (status === 'shortlisted') {
            try {
                const admins = await User.find({ role: 'admin' });
                for (const admin of admins) {
                    await new Notification({
                        user: admin._id,
                        title: 'Student Shortlisted',
                        message: `A student has been shortlisted for ${jobTitle}`,
                        type: 'success',
                        link: '/admin/reports'
                    }).save();
                }
            } catch (adminErr) {
                console.error('Admin notification error:', adminErr.message);
                // Don't fail if admin notification fails
            }
        }

        res.json(application);
    } catch (error) {
        console.error('[APPS] Status update error:', error.message);
        res.status(500).json({ error: 'Error updating application status: ' + error.message });
    }
});

// Get all applications (admin) - PAGINATION SUPPORTED (backward compatible)
router.get('/', auth, authorize('admin'), async (req, res) => {
    try {
        const hasPaginationParams = req.query.page || req.query.limit;
        
        const page = Math.max(1, parseInt(req.query.page) || 1);
        const limit = Math.min(100, parseInt(req.query.limit) || 50);
        const skip = (page - 1) * limit;
        
        let query = Application.find()
            .populate('student', 'name email studentProfile')
            .populate({ path: 'job', populate: { path: 'postedBy', select: 'name recruiterProfile' } })
            .sort('-createdAt')
            .lean();
        
        if (hasPaginationParams) {
            query = query.skip(skip).limit(limit);
            const applications = await query;
            const total = await Application.countDocuments();
            res.json({
                applications,
                pagination: { page, limit, total, pages: Math.ceil(total / limit) }
            });
        } else {
            // Return simple array for backward compatibility
            const applications = await query;
            res.json(applications);
        }
    } catch (error) {
        res.status(500).json({ error: 'Error fetching applications' });
    }
});

// RE-EVALUATE Resume (fresh ATS scoring) - student or recruiter
router.post('/:id/re-evaluate', auth, authorize('student', 'recruiter'), async (req, res) => {
    try {
        const application = await Application.findById(req.params.id)
            .populate('student', 'name studentProfile')
            .populate('job', 'title description');

        if (!application) {
            return res.status(404).json({ error: 'Application not found' });
        }

        // Authorization: student can only re-evaluate their own applications, recruiter can re-evaluate all for their jobs
        if (req.user.role === 'student' && application.student._id.toString() !== req.user._id.toString()) {
            return res.status(403).json({ error: 'You can only re-evaluate your own applications' });
        }

        const studentProfile = application.student.studentProfile || {};
        const resumeUrl = application.resumeUrl || studentProfile.resumeUrl;

        if (!resumeUrl) {
            return res.status(400).json({ error: 'No resume found for re-evaluation' });
        }

        let settings = await ATSSettings.findOne({});
        if (!settings) settings = new ATSSettings();

        try {
            // Parse resume with Affinda API (or fallback)
            const parsedData = await parseResumeFile(studentProfile.resumeBase64 || resumeUrl);
            
            // Get resume full text - PRIORITY: Affinda's rawText > PDF extraction > fallback
            let resumeText = parsedData.rawText || ''; // Affinda provides raw extracted text
            if (!resumeText && studentProfile.resumeBase64) {
                try {
                    const buffer = Buffer.from(studentProfile.resumeBase64, 'base64');
                    resumeText = await extractTextFromPDF(buffer);
                } catch (e) {
                    // Fallback to parsed data reconstruction
                    resumeText = (parsedData.keywords || []).join(' ') + ' ' + (parsedData.skills || []).join(' ');
                }
            }

            const jobDescription = `${application.job.title}\n${application.job.description}`;
            
            // Calculate fresh ATS score using improved algorithm
            const atsResult = calculateScore(parsedData, jobDescription, settings, application.job.title, resumeText);

            // Store evaluation with timestamp
            application.atsEvaluation = {
                ...atsResult,
                lastEvaluatedAt: new Date(),
                evaluationVersion: 2, // Indicates new algorithm
                parsedBy: parsedData.parsedBy // Track: 'affinda' or 'fallback'
            };

            application.aiEvaluation = {
                matchScore: atsResult.atsScore,
                matchPercentage: atsResult.atsScore,
                recommendation: atsResult.atsScore >= settings.thresholdScore ? 'Strong' : (atsResult.atsScore >= 50 ? 'Moderate' : 'Weak'),
                strengthSummary: atsResult.suggestions?.length ? atsResult.suggestions.join('. ') : 'Resume analyzed.',
                lastEvaluated: new Date()
            };

            await application.save();

            res.json({
                success: true,
                atsEvaluation: application.atsEvaluation,
                aiEvaluation: application.aiEvaluation,
                message: 'Application re-evaluated successfully with fresh ATS scoring'
            });
        } catch (e) {
            console.error('[RE-EVALUATE] Error:', e.message);
            res.status(500).json({ error: 'ATS re-evaluation failed: ' + e.message });
        }
    } catch (error) {
        console.error('[RE-EVALUATE] Route error:', error.message);
        res.status(500).json({ error: 'Re-evaluation failed: ' + error.message });
    }
});

module.exports = router;
