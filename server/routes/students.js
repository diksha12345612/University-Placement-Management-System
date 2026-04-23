const express = require('express');
const router = express.Router();
const { auth, authorize } = require('../middleware/auth');
const upload = require('../middleware/upload');
const User = require('../models/User');
const MockTestAttempt = require('../models/MockTestAttempt');
const ResumeAnalysis = require('../models/ResumeAnalysis');
const RecommendationPlan = require('../models/RecommendationPlan');
const path = require('path');
const { extractTextFromPDF, analyzeResume, generateRecommendations, extractStudentProfileFromLinkedIn } = require('../services/aiService');

// Get student profile
router.get('/profile', auth, authorize('student'), async (req, res) => {
    try {
        const student = await User.findById(req.user._id);
        res.json(student);
    } catch (error) {
        res.status(500).json({ error: 'Server error' });
    }
});

// Update student profile
router.put('/profile', auth, authorize('student'), async (req, res) => {
    try {
        const updates = req.body || {};
        const { name, ...profileUpdates } = updates;
        const existing = await User.findById(req.user._id);
        if (!existing) {
            return res.status(404).json({ error: 'Student not found' });
        }

        const mergedProfile = { ...(existing.studentProfile || {}), ...profileUpdates };
        const normalizedSkills = Array.isArray(mergedProfile.skills)
            ? mergedProfile.skills.map((s) => String(s || '').trim()).filter(Boolean)
            : String(mergedProfile.skills || '')
                .split(',')
                .map((s) => s.trim())
                .filter(Boolean);

        const phoneDigits = String(mergedProfile.phone || '').replace(/\D/g, '');
        const phoneCountryCode = String(mergedProfile.phoneCountryCode || '').trim();
        const missingFields = [];

        if (!String(name || existing.name || '').trim()) missingFields.push('name');
        if (!String(mergedProfile.rollNumber || '').trim()) missingFields.push('roll number');
        if (!String(mergedProfile.department || '').trim()) missingFields.push('department');
        if (!String(mergedProfile.batch || '').trim()) missingFields.push('batch');
        if (!Number.isFinite(Number(mergedProfile.cgpa)) || String(mergedProfile.cgpa) === '') missingFields.push('cgpa');
        if (!/^\+\d{1,4}$/.test(phoneCountryCode)) missingFields.push('phone country code');
        if (!/^\d{10}$/.test(phoneDigits)) missingFields.push('phone (10 digits)');
        if (!String(mergedProfile.gender || '').trim()) missingFields.push('gender');
        if (normalizedSkills.length === 0) missingFields.push('skills');
        if (!Number.isFinite(Number(mergedProfile.tenthPercentage)) || String(mergedProfile.tenthPercentage) === '') missingFields.push('10th percentage');
        if (!Number.isFinite(Number(mergedProfile.twelfthPercentage)) || String(mergedProfile.twelfthPercentage) === '') missingFields.push('12th percentage');
        if (!String(mergedProfile.linkedIn || '').trim()) missingFields.push('linkedin');
        if (!String(mergedProfile.github || '').trim()) missingFields.push('github');
        const hasResume = Boolean(String(mergedProfile.resumeUrl || '').trim()) || Boolean(String(mergedProfile.resumeBase64 || '').trim());
        if (!hasResume) missingFields.push('resume');

        if (missingFields.length > 0) {
            return res.status(400).json({
                error: `Complete all required profile fields before saving. Missing: ${missingFields.join(', ')}.`,
                missingFields,
                profileRequired: true
            });
        }

        mergedProfile.skills = normalizedSkills;
        mergedProfile.phone = phoneDigits;
        mergedProfile.phoneCountryCode = phoneCountryCode;

        const student = await User.findByIdAndUpdate(
            req.user._id,
            { $set: { studentProfile: mergedProfile, ...(name ? { name } : {}) } },
            { new: true, runValidators: true }
        );
        res.json(student);
    } catch (error) {
        console.error('Profile update error:', error);
        res.status(500).json({ error: 'Error updating profile' });
    }
});

// Upload and Analyze Resume
router.post('/resume', auth, authorize('student'), upload.single('resume'), async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ error: 'No file uploaded' });
        }

        if (req.file.mimetype !== 'application/pdf') {
            return res.status(400).json({ error: 'Only PDF resumes are supported' });
        }

        if (!req.file.buffer) {
            return res.status(400).json({ error: 'Upload buffer missing. Please try again.' });
        }

        // Vercel Serverless: File is in memory buffer
        const fileBuffer = req.file.buffer;
        const base64String = fileBuffer.toString('base64');
        const contentType = req.file.mimetype;
        const resumeUrl = `/api/students/resume/${req.user._id}`;

        // 1. Save Base64 string and dynamically generated URL to user profile
        await User.findByIdAndUpdate(req.user._id, {
            'studentProfile.resumeUrl': resumeUrl,
            'studentProfile.resumeBase64': base64String,
            'studentProfile.resumeContentType': contentType
        });

        // 2. Extract Text & AI Analysis from Buffer
        try {
            const text = await extractTextFromPDF(fileBuffer);
            const user = await User.findById(req.user._id);

            // Trigger the new ATS Mock parsing just to store student metrics 
            // We don't have a job yet, but this gives them basic parsed attributes.
            const { parseResumeFile } = require('../services/resumeParser');
            const parsedData = await parseResumeFile(base64String);

            const analysis = await analyzeResume(text, user.studentProfile);

            // Save historical record to ResumeAnalysis collection
            await ResumeAnalysis.create({
                studentId: req.user._id,
                resumeScore: analysis.resumeScore,
                technicalSkillsScore: analysis.technicalSkillsScore,
                projectsScore: analysis.projectsScore,
                experienceScore: analysis.experienceScore,
                atsScore: analysis.atsScore,
                clarityScore: analysis.clarityScore,
                strengths: analysis.strengths,
                weaknesses: analysis.weaknesses,
                missingSkills: analysis.missingSkills,
                suggestions: analysis.suggestions
            });

            // Update latest on User profile
            await User.findByIdAndUpdate(req.user._id, {
                'studentProfile.parsedResumeData': parsedData,
                'studentProfile.aiResumeAnalysis': {
                    resumeScore: analysis.resumeScore,
                    technicalSkillsScore: analysis.technicalSkillsScore,
                    projectsScore: analysis.projectsScore,
                    experienceScore: analysis.experienceScore,
                    atsScore: analysis.atsScore,
                    clarityScore: analysis.clarityScore,
                    criteriaBreakdown: analysis.criteriaBreakdown || {},
                    strengths: analysis.strengths,
                    weaknesses: analysis.weaknesses,
                    missingSkills: analysis.missingSkills,
                    suggestions: analysis.suggestions,
                    // Legacy fields for backward compatibility
                    score: analysis.resumeScore,
                    missingKeywords: analysis.missingSkills,
                    improvements: analysis.suggestions,
                    lastAnalyzed: new Date()
                }
            });

            res.json({
                resumeUrl,
                analysis,
                message: 'Resume uploaded and AI analysis complete'
            });
        } catch (aiError) {
            console.error('AI Analysis Background Error:', aiError);
            res.json({ resumeUrl, message: 'Resume uploaded, but AI analysis failed: ' + aiError.message });
        }
    } catch (error) {
        console.error('Upload Error:', error);
        res.status(500).json({ error: 'Error uploading resume' });
    }
});

// POST /api/students/parse-linkedin - Extract data from LinkedIn PDF
router.post('/parse-linkedin', auth, authorize('student'), upload.single('linkedinPdf'), async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ error: 'No file uploaded' });
        }

        if (req.file.mimetype !== 'application/pdf') {
            return res.status(400).json({ error: 'Only PDF files are supported' });
        }

        const data = await extractStudentProfileFromLinkedIn(req.file.buffer);
        res.json(data);
    } catch (error) {
        console.error('LinkedIn Parsing Error:', error);
        res.status(500).json({ error: 'Failed to parse LinkedIn PDF: ' + error.message });
    }
});

// GET /students/resume/:id — Serve Resume PDF from MongoDB Base64
router.get('/resume/:id', async (req, res) => {
    try {
        const student = await User.findById(req.params.id);
        if (!student || !student.studentProfile || !student.studentProfile.resumeBase64) {
            return res.status(404).json({ error: 'Resume not found' });
        }

        const pdfBuffer = Buffer.from(student.studentProfile.resumeBase64, 'base64');
        const contentType = student.studentProfile.resumeContentType || 'application/pdf';

        res.setHeader('Content-Type', contentType);
        res.setHeader('Content-Disposition', `inline; filename="resume.pdf"`);
        res.send(pdfBuffer);
    } catch (error) {
        console.error('Error serving resume:', error);
        res.status(500).json({ error: 'Error serving resume file' });
    }
});

// Upload Profile Photo
router.post('/profile-photo', auth, authorize('student'), upload.single('photo'), async (req, res) => {
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

        // Save Base64 string to user profile
        const student = await User.findByIdAndUpdate(
            req.user._id,
            {
                'studentProfile.profileImage': base64String,
                'studentProfile.profileImageContentType': contentType
            },
            { new: true }
        );

        res.json({ message: 'Profile photo uploaded successfully', student });
    } catch (error) {
        console.error('Error uploading profile photo:', error);
        res.status(500).json({ error: 'Error uploading profile photo' });
    }
});

// GET /students/profile-photo/:id — Serve Profile Photo from MongoDB Base64
router.get('/profile-photo/:id', async (req, res) => {
    try {
        const student = await User.findById(req.params.id);
        if (!student || !student.studentProfile || !student.studentProfile.profileImage) {
            return res.status(404).json({ error: 'Profile photo not found' });
        }

        const imageBuffer = Buffer.from(student.studentProfile.profileImage, 'base64');
        const contentType = student.studentProfile.profileImageContentType || 'image/jpeg';

        res.setHeader('Content-Type', contentType);
        res.setHeader('Content-Disposition', 'inline');
        res.send(imageBuffer);
    } catch (error) {
        console.error('Error serving profile photo:', error);
        res.status(500).json({ error: 'Error serving profile photo' });
    }
});

// POST /students/recommendations — AI Personalized Recommendations
router.post('/recommendations', auth, authorize('student'), async (req, res) => {
    try {
        const { targetRole } = req.body;

        if (!targetRole || targetRole.trim() === '') {
            return res.status(400).json({ error: 'Please specify your target job role (example: Software Engineer, Data Analyst, Product Manager) to generate a personalized preparation plan.' });
        }

        const user = await User.findById(req.user._id);
        const profile = user.studentProfile || {};

        // Gather mock test performance
        const attempts = await MockTestAttempt.find({ student: req.user._id }).sort('-createdAt').limit(10);
        const avgPercentage = attempts.length
            ? Math.round(attempts.reduce((sum, a) => sum + a.percentage, 0) / attempts.length)
            : 0;

        const testPerformance = {
            avgPercentage,
            totalTests: attempts.length,
            topics: [] // Topics are stored on the test, not attempt — pass empty for now
        };

        const recommendations = await generateRecommendations(
            profile.aiResumeAnalysis?.resumeScore || profile.aiResumeAnalysis?.score || 0,
            profile.skills || [],
            testPerformance,
            targetRole
        );

        // Save historical record
        await RecommendationPlan.create({
            studentId: req.user._id,
            targetRole: recommendations.targetRole || targetRole,
            overallAssessment: recommendations.overallAssessment,
            skillGapAnalysis: recommendations.skillGapAnalysis,
            prioritySkills: recommendations.prioritySkills,
            roadmap: recommendations.roadmap,
            recommendedProjects: recommendations.recommendedProjects,
            recommendedResources: recommendations.recommendedResources,
            interviewPreparationTips: recommendations.interviewPreparationTips,
            suggestedCompanies: recommendations.suggestedCompanies
        });

        // Save to user profile
        const updatedUser = await User.findByIdAndUpdate(req.user._id, {
            'studentProfile.aiRecommendations': {
                targetRole: recommendations.targetRole || targetRole,
                overallAssessment: recommendations.overallAssessment,
                skillGapAnalysis: recommendations.skillGapAnalysis,
                prioritySkills: recommendations.prioritySkills,
                roadmap: recommendations.roadmap,
                recommendedProjects: recommendations.recommendedProjects,
                recommendedResources: recommendations.recommendedResources,
                interviewPreparationTips: recommendations.interviewPreparationTips,
                suggestedCompanies: recommendations.suggestedCompanies,
                // Legacy fields for backward compatibility
                recommendedTopics: (recommendations.roadmap || []).flatMap(lp => (lp.topics || []).map(t => typeof t === 'object' ? t.name : t)),
                skillsToImprove: recommendations.skillGapAnalysis,
                studyPlan: (recommendations.roadmap || []).map(lp => `${lp.phase}: ${lp.focusArea}`),
                lastUpdated: new Date()
            }
        }, { new: true });

        res.json(updatedUser.studentProfile.aiRecommendations);
    } catch (error) {
        console.error('Recommendations Error:', error);
        res.status(500).json({ error: 'Failed to generate recommendations: ' + error.message });
    }
});

router.put('/recommendations/progress', auth, authorize('student'), async (req, res) => {
    try {
        const { phaseIndex, topicIndex, taskIndex, completed, isTask } = req.body;
        console.log(`[Progress Update] Student: ${req.user._id}, Phase: ${phaseIndex}, Topic/Task: ${isTask ? taskIndex : topicIndex}, Completed: ${completed}, isTask: ${isTask}`);

        const user = await User.findById(req.user._id);
        if (!user.studentProfile || !user.studentProfile.aiRecommendations || !user.studentProfile.aiRecommendations.roadmap) {
            return res.status(404).json({ error: 'No roadmap found' });
        }

        const roadmap = user.studentProfile.aiRecommendations.roadmap;
        if (roadmap[phaseIndex]) {
            if (isTask && roadmap[phaseIndex].tasks && roadmap[phaseIndex].tasks[taskIndex]) {
                roadmap[phaseIndex].tasks[taskIndex].completed = completed;
            } else if (!isTask && roadmap[phaseIndex].topics && roadmap[phaseIndex].topics[topicIndex]) {
                roadmap[phaseIndex].topics[topicIndex].completed = completed;
            } else {
                return res.status(400).json({ error: 'Invalid topic or task index' });
            }

            // Mark the entire nested path as modified to ensure Mongoose saves correctly
            user.markModified('studentProfile.aiRecommendations.roadmap');
            await user.save();

            console.log('[Progress Update] Success');
            res.json({ message: 'Progress updated', roadmap });
        } else {
            console.warn('[Progress Update] Invalid phase index');
            res.status(400).json({ error: 'Invalid phase index' });
        }
    } catch (error) {
        console.error('[Progress Update] Error:', error);
        res.status(500).json({ error: 'Failed to update progress' });
    }
});

// GET /students/recommendations/history — Fetch past recommendation plans
router.get('/recommendations/history', auth, authorize('student'), async (req, res) => {
    try {
        const history = await RecommendationPlan.find({ studentId: req.user._id })
            .sort('-createdAt')
            .limit(10);
        res.json(history);
    } catch (error) {
        console.error('History Fetch Error:', error);
        res.status(500).json({ error: 'Failed to fetch recommendation history' });
    }
});

// Get all verified students (for admin)
router.get('/', auth, authorize('admin'), async (req, res) => {
    try {
        const students = await User.find({ role: 'student' }).select('-password');
        res.json(students);
    } catch (error) {
        res.status(500).json({ error: 'Server error' });
    }
});

// PHASE 5: Student Dashboard Summary - Real-time polling endpoint
// GET /api/students/dashboard/:studentId/summary
router.get('/dashboard/:studentId/summary', auth, authorize('student'), async (req, res) => {
    try {
        // Verify student can only access their own dashboard
        if (req.user._id.toString() !== req.params.studentId) {
            return res.status(403).json({ error: 'Unauthorized to access this dashboard' });
        }

        const realtimeService = require('../services/realtimeService');
        const summary = await realtimeService.getStudentDashboardSummary(req.params.studentId);
        
        res.status(200).json({
            success: true,
            timestamp: new Date().toISOString(),
            ...summary
        });
    } catch (error) {
        console.error('[DASHBOARD] Student dashboard error:', error);
        res.status(500).json({ 
            error: 'Failed to fetch dashboard summary',
            message: error.message 
        });
    }
});

module.exports = router;
