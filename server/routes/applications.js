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

        const profile = req.user.studentProfile || {};
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

        const existingApp = await Application.findOne({ job: jobId, student: req.user._id });
        if (existingApp) return res.status(400).json({ error: 'Already applied for this job' });

        const application = new Application({
            job: jobId,
            student: req.user._id,
            coverLetter,
            resumeUrl: profile.resumeUrl
        });
        await application.save();

        // Notify recruiter
        await new Notification({
            user: job.postedBy,
            title: 'New Application',
            message: `${req.user.name} applied for ${job.title}`,
            type: 'application'
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
const { extractTextFromPDF, rankCandidateForJob, analyzeResume } = require('../services/aiService');


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

// AI Evaluate a single application (recruiter)
router.post('/:id/ai-evaluate', auth, authorize('recruiter'), async (req, res) => {
    try {
        const application = await Application.findById(req.params.id)
            .populate('student', 'name studentProfile')
            .populate('job', 'title description');

        if (!application) return res.status(404).json({ error: 'Application not found' });

        const studentProfile = application.student.studentProfile || {};
        const resumeUrl = application.resumeUrl || studentProfile.resumeUrl;

        // Build candidate profile from stored data (no PDF parse needed for single eval)
        const candidateProfile = {
            name: application.student.name,
            department: studentProfile.department || 'CS',
            cgpa: studentProfile.cgpa || 0,
            skills: studentProfile.skills || [],
            resumeScore: studentProfile.aiResumeAnalysis?.resumeScore || studentProfile.aiResumeAnalysis?.score || 0,
            additionalInfo: `CGPA: ${studentProfile.cgpa || 'N/A'}, Department: ${studentProfile.department || 'CS'}`
        };

        // Try to also include resume text if available
        if (resumeUrl) {
            try {
                const filePath = path.join(__dirname, '../', resumeUrl);
                const resumeText = await extractTextFromPDF(filePath);
                candidateProfile.additionalInfo += '\n' + resumeText.slice(0, 600);
            } catch (e) {
                console.warn('Could not read resume PDF for evaluation:', e.message);
            }
        }

        const jobRequirements = `${application.job.title}\n${application.job.description}`;
        const evaluation = await rankCandidateForJob(jobRequirements, candidateProfile);

        application.aiEvaluation = {
            matchScore: evaluation.matchScore,
            skillMatchScore: evaluation.skillMatchScore,
            experienceMatchScore: evaluation.experienceMatchScore,
            matchPercentage: evaluation.matchScore, // legacy
            strengthSummary: evaluation.strengthSummary,
            riskFactors: evaluation.riskFactors,
            recommendation: evaluation.recommendation,
            lastEvaluated: new Date()
        };

        await application.save();
        res.json(application);
    } catch (error) {
        console.error('AI Evaluation Error:', error);
        res.status(500).json({ error: 'AI evaluation failed: ' + error.message });
    }
});

// AI Rank all applicants for a job (recruiter)
router.post('/job/:jobId/ai-rank', auth, authorize('recruiter'), async (req, res) => {
    try {
        const applications = await Application.find({ job: req.params.jobId })
            .populate('student', 'name email studentProfile')
            .populate('job', 'title description');

        if (applications.length === 0) {
            return res.status(400).json({ error: 'No applicants to rank' });
        }

        let rankedCount = 0;
        for (const app of applications) {
            try {
                const studentProfile = app.student?.studentProfile || {};
                const resumeUrl = app.resumeUrl || studentProfile.resumeUrl;

                const candidateProfile = {
                    name: app.student.name,
                    department: studentProfile.department || 'CS',
                    cgpa: studentProfile.cgpa || 0,
                    skills: studentProfile.skills || [],
                    resumeScore: studentProfile.aiResumeAnalysis?.resumeScore || studentProfile.aiResumeAnalysis?.score || 0,
                    additionalInfo: `CGPA: ${studentProfile.cgpa || 'N/A'}`
                };

                // Include resume text if available
                if (resumeUrl) {
                    try {
                        const filePath = path.join(__dirname, '../', resumeUrl);
                        const resumeText = await extractTextFromPDF(filePath);
                        candidateProfile.additionalInfo += '\n' + resumeText.slice(0, 1000);
                    } catch (e) {
                        console.warn(`Could not read resume for ${app.student.name}:`, e.message);
                    }
                }

                const jobRequirements = `${app.job.title}\n${app.job.description}`;
                const evalResult = await rankCandidateForJob(jobRequirements, candidateProfile);

                app.aiEvaluation = {
                    matchScore: evalResult.matchScore,
                    skillMatchScore: evalResult.skillMatchScore,
                    experienceMatchScore: evalResult.experienceMatchScore,
                    matchPercentage: evalResult.matchScore, // legacy
                    strengthSummary: evalResult.strengthSummary,
                    riskFactors: evalResult.riskFactors,
                    recommendation: evalResult.recommendation,
                    lastEvaluated: new Date()
                };
                await app.save();
                rankedCount++;
                console.log(`✅ Ranked ${app.student.name}: ${evalResult.matchScore}% match (${evalResult.recommendation})`);
            } catch (err) {
                console.error(`❌ Failed to evaluate application ${app._id}:`, err.message);
            }
        }

        const rankedApps = await Application.find({ job: req.params.jobId })
            .populate('student', 'name email studentProfile')
            .sort('-aiEvaluation.matchScore');

        console.log(`AI Ranking complete: ${rankedCount}/${applications.length} applicants evaluated`);
        res.json(rankedApps);
    } catch (error) {
        console.error('AI Rank Error:', error);
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
            type: status === 'selected' ? 'success' : status === 'rejected' ? 'warning' : 'info'
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
