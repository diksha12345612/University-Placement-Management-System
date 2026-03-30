const express = require('express');
const router = express.Router();
const { auth, authorize } = require('../middleware/auth');
const { checkAdminSectionAccess } = require('../middleware/adminSectionAccess');
const User = require('../models/User');
const Job = require('../models/Job');
const Application = require('../models/Application');
const PlacementDrive = require('../models/PlacementDrive');
const Announcement = require('../models/Announcement');
const Notification = require('../models/Notification');
const MockTest = require('../models/MockTest');
const MockTestAttempt = require('../models/MockTestAttempt');
const OTP = require('../models/OTP');
const AdminSectionAccess = require('../models/AdminSectionAccess');
const ResumeAnalysis = require('../models/ResumeAnalysis');
const RecommendationPlan = require('../models/RecommendationPlan');
const InterviewEvaluation = require('../models/InterviewEvaluation');
const LoginAttempt = require('../models/LoginAttempt');
const { sendRecruiterConfirmationEmail, sendOTP } = require('../services/emailService');

// ==================== Student Management ====================

// Verify/unverify student profile
router.put('/students/:id/verify', auth, authorize('admin'), async (req, res) => {
    try {
        const student = await User.findByIdAndUpdate(
            req.params.id,
            { isVerified: req.body.isVerified },
            { new: true }
        );
        if (!student) return res.status(404).json({ error: 'Student not found' });

        await new Notification({
            user: student._id,
            title: 'Profile Verification',
            message: req.body.isVerified ? 'Your profile has been verified!' : 'Your profile verification has been revoked.',
            type: req.body.isVerified ? 'success' : 'warning',
            link: '/student/profile'
        }).save();

        res.json(student);
    } catch (error) {
        res.status(500).json({ error: 'Error updating verification' });
    }
});

// ==================== Recruiter Management ====================

// Approve/Revoke recruiter
router.put('/recruiters/:id/verify', auth, authorize('admin'), async (req, res) => {
    try {
        const recruiter = await User.findByIdAndUpdate(
            req.params.id,
            { isApprovedByAdmin: req.body.isApprovedByAdmin },
            { new: true }
        );
        if (!recruiter) return res.status(404).json({ error: 'Recruiter not found' });

        // Send confirmation email if admin is approving
        if (req.body.isApprovedByAdmin) {
            await sendRecruiterConfirmationEmail(recruiter.email, recruiter.name || recruiter.companyName);
        }

        await new Notification({
            user: recruiter._id,
            title: 'Account Approval Status',
            message: req.body.isApprovedByAdmin ? 'Your recruiter account has been approved by the Admin! You can now log in and post jobs.' : 'Your recruiter account approval has been revoked.',
            type: req.body.isApprovedByAdmin ? 'success' : 'warning',
            link: '/recruiter/dashboard'
        }).save();

        res.json(recruiter);
    } catch (error) {
        res.status(500).json({ error: 'Error updating recruiter approval' });
    }
});

// Delete student account
// PHASE 2: Now uses MongoDB transactions for safe cascade deletion
router.delete('/students/:id', auth, authorize('admin'), async (req, res) => {
    const session = await require('mongoose').startSession();
    session.startTransaction();
    
    try {
        const student = await User.findOneAndDelete( { _id: req.params.id, role: 'student' }, { session });
        if (!student) {
            await session.abortTransaction();
            session.endSession();
            return res.status(404).json({ error: 'Student not found' });
        }

        const studentId = req.params.id;
        const studentEmail = student.email;

        // Cleanup all related data (atomic within transaction)
        await Application.deleteMany({ student: studentId }, { session });
        await ResumeAnalysis.deleteMany({ student: studentId }, { session });
        await RecommendationPlan.deleteMany({ student: studentId }, { session });
        await InterviewEvaluation.deleteMany({ student: studentId }, { session });
        await MockTestAttempt.deleteMany({ student: studentId }, { session });
        await Notification.deleteMany({ user: studentId }, { session });
        await OTP.deleteMany({ email: studentEmail }, { session });
        await LoginAttempt.deleteMany({ email: studentEmail }, { session });

        // All succeeded - commit transaction
        await session.commitTransaction();
        session.endSession();

        res.json({ message: 'Student account and all related data deleted successfully' });
    } catch (error) {
        // Something failed - rollback all changes
        await session.abortTransaction();
        session.endSession();
        console.error('[TRANSACTION] Error deleting student:', error);
        res.status(500).json({ error: 'Error deleting student' });
    }
});

// Delete recruiter account
// PHASE 2: Now uses MongoDB transactions for safe cascade deletion
// Deletes: Recruiter User, Jobs, Applications, and all related data
router.delete('/recruiters/:id', auth, authorize('admin'), async (req, res) => {
    const session = await require('mongoose').startSession();
    session.startTransaction();
    
    try {
        const recruiter = await User.findOneAndDelete({ _id: req.params.id, role: 'recruiter' }, { session });
        if (!recruiter) {
            await session.abortTransaction();
            session.endSession();
            return res.status(404).json({ error: 'Recruiter not found' });
        }

        const recruiterId = req.params.id;
        const recruiterEmail = recruiter.email;

        // Find all jobs posted by this recruiter (within transaction)
        const recruiterJobs = await Job.find({ postedBy: recruiterId }, null, { session });
        const jobIds = recruiterJobs.map(j => j._id);
        
        // Cleanup applications for these jobs (atomic)
        if (jobIds.length > 0) {
            await Application.deleteMany({ job: { $in: jobIds } }, { session });
        }
        
        // Cleanup jobs (atomic)
        await Job.deleteMany({ postedBy: recruiterId }, { session });

        // Cleanup all recruiter-specific data
        await Notification.deleteMany({ user: recruiterId }, { session });
        await OTP.deleteMany({ email: recruiterEmail }, { session });
        await LoginAttempt.deleteMany({ email: recruiterEmail }, { session });

        // All succeeded - commit transaction
        await session.commitTransaction();
        session.endSession();

        res.json({ message: 'Recruiter account and all related data deleted successfully' });
    } catch (error) {
        // Something failed - rollback all changes
        await session.abortTransaction();
        session.endSession();
        console.error('[TRANSACTION] Error deleting recruiter:', error);
        res.status(500).json({ error: 'Error deleting recruiter' });
    }
});

// ==================== Admin Management ====================

// Get all admins - PAGINATION SUPPORTED (backward compatible)
// PROTECTED: Requires OTP verification for admin section access
router.get('/admins', auth, authorize('admin'), checkAdminSectionAccess, async (req, res) => {
    try {
        const hasPaginationParams = req.query.page || req.query.limit;
        
        if (hasPaginationParams) {
            // Return structured pagination object only when params provided
            const page = Math.max(1, parseInt(req.query.page) || 1);
            const limit = Math.min(100, parseInt(req.query.limit) || 20);
            const skip = (page - 1) * limit;
            
            const admins = await User.find({ role: 'admin' })
                .select('name email createdAt')
                .sort('-createdAt')
                .skip(skip)
                .limit(limit)
                .lean();
            
            const total = await User.countDocuments({ role: 'admin' });
            return res.json({
                admins,
                pagination: { page, limit, total, pages: Math.ceil(total / limit) }
            });
        } else {
            // Return simple array for backward compatibility (no pagination params)
            const admins = await User.find({ role: 'admin' })
                .select('name email createdAt')
                .sort('-createdAt')
                .lean();
            
            return res.json(admins);
        }
    } catch (error) {
        console.error('[ADMIN] Error fetching admins:', error.message);
        res.status(500).json({ error: 'Error fetching admins: ' + error.message });
    }
});

// Promote user to admin
// PROTECTED: Requires OTP verification for admin section access
router.post('/promote/:userId', auth, authorize('admin'), checkAdminSectionAccess, async (req, res) => {
    try {
        const user = await User.findById(req.params.userId);
        if (!user) return res.status(404).json({ error: 'User not found' });

        if (user.role === 'admin') {
            return res.status(400).json({ error: 'User is already an admin' });
        }

        // Update user role to admin
        user.role = 'admin';
        await user.save();

        // Send notification to new admin
        await new Notification({
            user: user._id,
            title: 'Admin Privileges Granted',
            message: 'You have been promoted to Admin. You now have full access to the admin portal.',
            type: 'success',
            link: '/admin/dashboard'
        }).save();

        res.json({ message: 'User promoted to admin successfully', user });
    } catch (error) {
        res.status(500).json({ error: 'Error promoting user to admin' });
    }
});

// Remove admin status
// PROTECTED: Requires OTP verification for admin section access
router.delete('/admins/:id', auth, authorize('admin'), checkAdminSectionAccess, async (req, res) => {
    try {
        // Prevent removing the last admin (optional safety measure)
        const adminCount = await User.countDocuments({ role: 'admin' });
        if (adminCount <= 1) {
            return res.status(400).json({ error: 'Cannot remove the last admin' });
        }

        const admin = await User.findById(req.params.id);
        if (!admin) return res.status(404).json({ error: 'Admin not found' });

        if (admin.role !== 'admin') {
            return res.status(400).json({ error: 'User is not an admin' });
        }

        // Update user role
        admin.role = 'student'; // Default to student role
        await admin.save();

        // Send notification
        await new Notification({
            user: admin._id,
            title: 'Admin Privileges Revoked',
            message: 'Your admin privileges have been revoked. You have been demoted to student role.',
            type: 'warning',
            link: '/student/dashboard'
        }).save();

        res.json({ message: 'Admin privileges revoked successfully' });
    } catch (error) {
        res.status(500).json({ error: 'Error removing admin privileges' });
    }
});

// ==================== Job Management ====================

// Get all jobs (for admin) - PAGINATION ADDED
router.get('/jobs', auth, authorize('admin'), async (req, res) => {
    try {
        const hasPaginationParams = req.query.page || req.query.limit;
        
        if (hasPaginationParams) {
            // Return structured pagination object only when params provided
            const page = Math.max(1, parseInt(req.query.page) || 1);
            const limit = Math.min(100, parseInt(req.query.limit) || 50);
            const skip = (page - 1) * limit;
            
            const jobs = await Job.find()
                .populate('postedBy', 'name email recruiterProfile')
                .sort('-createdAt')
                .skip(skip)
                .limit(limit)
                .lean();
            
            const total = await Job.countDocuments();
            return res.json({
                jobs,
                pagination: { page, limit, total, pages: Math.ceil(total / limit) }
            });
        } else {
            // Return simple array for backward compatibility (no pagination params)
            const jobs = await Job.find()
                .populate('postedBy', 'name email recruiterProfile')
                .sort('-createdAt')
                .lean();
            
            return res.json(jobs);
        }
    } catch (error) {
        console.error('[ADMIN] Error fetching jobs:', error.message);
        res.status(500).json({ error: 'Error fetching jobs: ' + error.message });
    }
});

// Get pending jobs - PAGINATION ADDED
router.get('/jobs/pending', auth, authorize('admin'), async (req, res) => {
    try {
        const page = Math.max(1, parseInt(req.query.page) || 1);
        const limit = Math.min(100, parseInt(req.query.limit) || 50);
        const skip = (page - 1) * limit;
        
        const jobs = await Job.find({ status: 'pending' })
            .populate('postedBy', 'name email recruiterProfile')
            .sort('-createdAt')
            .skip(skip)
            .limit(limit)
            .lean();
        
        const total = await Job.countDocuments({ status: 'pending' });
        res.json({
            jobs,
            pagination: { page, limit, total, pages: Math.ceil(total / limit) }
        });
    } catch (error) {
        res.status(500).json({ error: 'Error fetching pending jobs' });
    }
});

// Approve/reject job
router.put('/jobs/:id/status', auth, authorize('admin'), async (req, res) => {
    try {
        const { status } = req.body;
        if (!['approved', 'rejected'].includes(status)) {
            return res.status(400).json({ error: 'Status must be approved or rejected' });
        }

        const job = await Job.findByIdAndUpdate(req.params.id, { status }, { new: true });
        if (!job) return res.status(404).json({ error: 'Job not found' });

        // Notify recruiter
        await new Notification({
            user: job.postedBy,
            title: `Job ${status.charAt(0).toUpperCase() + status.slice(1)}`,
            message: `Your job posting "${job.title}" has been ${status}`,
            type: status === 'approved' ? 'success' : 'warning',
            link: '/recruiter/my-jobs'
        }).save();

        // If approved, notify all students
        if (status === 'approved') {
            const students = await User.find({ role: 'student', isVerified: true });
            for (const student of students) {
                await new Notification({
                    user: student._id,
                    title: 'New Job Available',
                    message: `New job posted: ${job.title} at ${job.company}`,
                    type: 'info',
                    link: '/student/jobs'
                }).save();
            }
        }

        res.json(job);
    } catch (error) {
        res.status(500).json({ error: 'Error updating job status' });
    }
});

// ==================== Placement Drives ====================

router.get('/drives', auth, authorize('admin'), async (req, res) => {
    try {
        const hasPaginationParams = req.query.page || req.query.limit;
        
        if (hasPaginationParams) {
            // Return structured pagination object only when params provided
            const page = Math.max(1, parseInt(req.query.page) || 1);
            const limit = Math.min(100, parseInt(req.query.limit) || 20);
            const skip = (page - 1) * limit;
            
            const drives = await PlacementDrive.find()
                .sort('-date')
                .skip(skip)
                .limit(limit)
                .lean();
            
            const total = await PlacementDrive.countDocuments();
            return res.json({
                drives,
                pagination: { page, limit, total, pages: Math.ceil(total / limit) }
            });
        } else {
            // Return simple array for backward compatibility (no pagination params)
            const drives = await PlacementDrive.find()
                .sort('-date')
                .lean();
            
            return res.json(drives);
        }
    } catch (error) {
        console.error('[ADMIN] Error fetching drives:', error.message);
        res.status(500).json({ error: 'Error fetching drives: ' + error.message });
    }
});

router.post('/drives', auth, authorize('admin'), async (req, res) => {
    try {
        const drive = new PlacementDrive({ ...req.body, createdBy: req.user._id });
        await drive.save();
        res.status(201).json(drive);
    } catch (error) {
        res.status(500).json({ error: 'Error creating placement drive' });
    }
});

router.put('/drives/:id', auth, authorize('admin'), async (req, res) => {
    try {
        const drive = await PlacementDrive.findByIdAndUpdate(req.params.id, req.body, { new: true });
        if (!drive) return res.status(404).json({ error: 'Drive not found' });
        res.json(drive);
    } catch (error) {
        res.status(500).json({ error: 'Error updating drive' });
    }
});

router.delete('/drives/:id', auth, authorize('admin'), async (req, res) => {
    try {
        await PlacementDrive.findByIdAndDelete(req.params.id);
        res.json({ message: 'Drive deleted' });
    } catch (error) {
        res.status(500).json({ error: 'Error deleting drive' });
    }
});

// ==================== Announcements ====================

router.get('/announcements', auth, async (req, res) => {
    try {
        const hasPaginationParams = req.query.page || req.query.limit;
        
        if (hasPaginationParams) {
            // Return structured pagination object only when params provided
            const page = Math.max(1, parseInt(req.query.page) || 1);
            const limit = Math.min(100, parseInt(req.query.limit) || 20);
            const skip = (page - 1) * limit;
            
            const announcements = await Announcement.find({ isActive: true })
                .populate('createdBy', 'name')
                .sort('-createdAt')
                .skip(skip)
                .limit(limit)
                .lean();
            
            const total = await Announcement.countDocuments({ isActive: true });
            return res.json({
                announcements,
                pagination: { page, limit, total, pages: Math.ceil(total / limit) }
            });
        } else {
            // Return simple array for backward compatibility (no pagination params)
            const announcements = await Announcement.find({ isActive: true })
                .populate('createdBy', 'name')
                .sort('-createdAt')
                .lean();
            
            return res.json(announcements);
        }
    } catch (error) {
        console.error('[ADMIN] Error fetching announcements:', error.message);
        res.status(500).json({ error: 'Error fetching announcements: ' + error.message });
    }
});

router.post('/announcements', auth, authorize('admin'), async (req, res) => {
    try {
        // CRITICAL FIX: Validate targetAudience to prevent NoSQL injection
        const validAudiences = ['students', 'recruiters', 'all'];
        if (!req.body.targetAudience || !validAudiences.includes(String(req.body.targetAudience).toLowerCase())) {
            return res.status(400).json({ error: `Invalid target audience. Must be one of: ${validAudiences.join(', ')}` });
        }

        const announcement = new Announcement({ ...req.body, createdBy: req.user._id });
        await announcement.save();

        // Notify target audience - using allowlisted values only
        let query = {};
        const audience = String(req.body.targetAudience).toLowerCase();
        
        if (audience === 'students') {
            query.role = 'student';
        } else if (audience === 'recruiters') {
            query.role = 'recruiter';
        } else if (audience === 'all') {
            query.role = { $in: ['student', 'recruiter'] };
        }

        const users = await User.find(query);
        for (const user of users) {
            const announcementLink = user.role === 'admin' ? '/admin/announcements' : `/${user.role}/dashboard`;
            await new Notification({
                user: user._id,
                title: 'New Announcement',
                message: req.body.title,
                type: 'announcement',
                link: announcementLink
            }).save();
        }

        res.status(201).json(announcement);
    } catch (error) {
        res.status(500).json({ error: 'Error creating announcement' });
    }
});

router.delete('/announcements/:id', auth, authorize('admin'), async (req, res) => {
    try {
        await Announcement.findByIdAndDelete(req.params.id);
        res.json({ message: 'Announcement deleted' });
    } catch (error) {
        res.status(500).json({ error: 'Error deleting announcement' });
    }
});

// ==================== Reports ====================

router.get('/reports', auth, authorize('admin'), async (req, res) => {
    try {
        const totalStudents = await User.countDocuments({ role: 'student' });
        const verifiedStudents = await User.countDocuments({ role: 'student', isVerified: true });
        const placedStudents = await User.countDocuments({ role: 'student', 'studentProfile.isPlaced': true });
        const unplacedStudents = totalStudents - placedStudents;
        const totalRecruiters = await User.countDocuments({ role: 'recruiter' });
        const totalJobs = await Job.countDocuments();
        const approvedJobs = await Job.countDocuments({ status: 'approved' });
        const pendingJobs = await Job.countDocuments({ status: 'pending' });
        const totalApplications = await Application.countDocuments();

        // Branch-wise stats
        const branchStats = await User.aggregate([
            { $match: { role: 'student' } },
            {
                $group: {
                    _id: '$studentProfile.department',
                    total: { $sum: 1 },
                    placed: { $sum: { $cond: ['$studentProfile.isPlaced', 1, 0] } }
                }
            },
            { $sort: { _id: 1 } }
        ]);

        // Company-wise stats
        const companyStats = await User.aggregate([
            {
                $match: {
                    role: 'student',
                    'studentProfile.isPlaced': true,
                    'studentProfile.placedAt': { $nin: [null, '', 'N/A', 'undefined'] }
                }
            },
            {
                $group: {
                    _id: '$studentProfile.placedAt',
                    count: { $sum: 1 }
                }
            },
            { $sort: { count: -1 } }
        ]);

        // Application status breakdown
        const applicationStats = await Application.aggregate([
            { $group: { _id: '$status', count: { $sum: 1 } } }
        ]);

        // Granular Student Details for Export
        const studentDetails = await User.aggregate([
            { $match: { role: 'student' } },
            {
                $lookup: {
                    from: 'applications',
                    localField: '_id',
                    foreignField: 'student',
                    as: 'apps'
                }
            },
            {
                $project: {
                    name: 1,
                    email: 1,
                    'studentProfile.department': 1,
                    'studentProfile.cgpa': 1,
                    'studentProfile.isPlaced': 1,
                    'studentProfile.placedAt': 1,
                    applicationCount: { $size: '$apps' },
                    placedAt: '$studentProfile.placedAt',
                    status: {
                        $cond: ['$studentProfile.isPlaced', 'Placed', 'Unplaced']
                    }
                }
            }
        ]);

        // Recruiter Performance for Export
        const recruiterDetails = await User.aggregate([
            { $match: { role: 'recruiter' } },
            {
                $lookup: {
                    from: 'jobs',
                    localField: '_id',
                    foreignField: 'postedBy',
                    as: 'postedJobs'
                }
            },
            {
                $lookup: {
                    from: 'users',
                    let: { companyName: '$recruiterProfile.company' },
                    pipeline: [
                        {
                            $match: {
                                $expr: {
                                    $and: [
                                        { $eq: ['$role', 'student'] },
                                        { $eq: ['$studentProfile.isPlaced', true] },
                                        { $ne: ['$$companyName', null] },
                                        { $ne: ['$$companyName', ''] },
                                        { $ne: ['$$companyName', 'N/A'] },
                                        { $eq: ['$studentProfile.placedAt', '$$companyName'] }
                                    ]
                                }
                            }
                        }
                    ],
                    as: 'hires'
                }
            },
            {
                $project: {
                    name: 1,
                    email: 1,
                    company: '$recruiterProfile.company',
                    jobsPosted: { $size: '$postedJobs' },
                    totalHires: { $size: '$hires' }
                }
            }
        ]);

        res.json({
            overview: { totalStudents, verifiedStudents, placedStudents, unplacedStudents, totalRecruiters, totalJobs, approvedJobs, pendingJobs, totalApplications },
            branchStats,
            companyStats,
            applicationStats,
            studentDetails,
            recruiterDetails
        });
    } catch (error) {
        res.status(500).json({ error: 'Error generating reports' });
    }
});

// ==================== Dashboard Stats ====================

router.get('/dashboard', auth, authorize('admin'), async (req, res) => {
    try {
        const totalStudents = await User.countDocuments({ role: 'student' });
        const placedStudents = await User.countDocuments({ role: 'student', 'studentProfile.isPlaced': true });
        const totalJobs = await Job.countDocuments({ status: 'approved' });
        const pendingJobs = await Job.countDocuments({ status: 'pending' });
        const pendingRecruiters = await User.countDocuments({ role: 'recruiter', isApprovedByAdmin: false });
        const totalApplications = await Application.countDocuments();
        const recentApplications = await Application.find()
            .populate('student', 'name')
            .populate('job', 'title company')
            .sort('-createdAt')
            .limit(5)
            .lean();

        res.json({
            totalStudents, placedStudents, totalJobs, pendingJobs, pendingRecruiters, totalApplications, recentApplications
        });
    } catch (error) {
        res.status(500).json({ error: 'Server error' });
    }
});

// ==================== Messaging ====================

// Send message to student or recruiter
router.post('/message/:userId', auth, authorize('admin'), async (req, res) => {
    try {
        const { subject, message } = req.body;
        
        if (!subject || !message) {
            return res.status(400).json({ error: 'Subject and message are required' });
        }

        const user = await User.findById(req.params.userId);
        if (!user) {
            return res.status(404).json({ error: 'User not found' });
        }

        const notification = new Notification({
            user: req.params.userId,
            title: subject,
            message: message,
            type: 'admin_message',
            sentBy: req.user._id,
            link: user.role === 'student' ? '/student/notifications' : '/recruiter/notifications'
        });

        await notification.save();
        res.status(201).json({ message: 'Message sent successfully', notification });
    } catch (error) {
        res.status(500).json({ error: 'Error sending message' });
    }
});

// ==================== Demo Data Seeding ====================

router.post('/seed-demo-data', auth, authorize('admin'), async (req, res) => {
    try {
        const admin = await User.findOne({ role: 'admin' });
        const recruiter = await User.findOne({ role: 'recruiter', isApprovedByAdmin: true });
        const studentList = await User.find({ role: 'student' }).limit(10);

        if (!admin || !recruiter || studentList.length === 0) {
            return res.status(400).json({ error: 'Required seed users missing. Ensure at least one admin, one approved recruiter, and some students exist.' });
        }

        // 1. Seed Placement Drives
        const drives = [
            {
                title: 'Mega Tech Hiring Drive 2026',
                company: 'Google',
                date: new Date(Date.now() + 10 * 24 * 60 * 60 * 1000),
                description: 'Annual mega hiring drive for Software Engineering and Data Science roles.',
                venue: 'University Convention Center',
                eligibility: { minCGPA: 8.0, branches: ['CSE', 'IT'], batch: '2026' },
                createdBy: admin._id
            },
            {
                title: 'Core Engineering Internship Drive',
                company: 'Microsoft',
                date: new Date(Date.now() + 20 * 24 * 60 * 60 * 1000),
                description: 'Summer internship opportunities for core engineering branches.',
                venue: 'Seminar Hall 1',
                eligibility: { minCGPA: 7.0, branches: ['Mechanical', 'Electrical'], batch: '2027' },
                createdBy: admin._id
            }
        ];
        await PlacementDrive.insertMany(drives);

        // 2. Seed Announcements
        const announcements = [
            {
                title: 'New Resume Format Guidelines',
                content: 'All students are requested to update their resumes according to the new university template available in the portal.',
                targetAudience: 'students',
                createdBy: admin._id
            },
            {
                title: 'Upcoming Mock Interview Series',
                content: 'Register for the upcoming mock interview series with industry experts starting next Monday.',
                targetAudience: 'students',
                createdBy: admin._id
            }
        ];
        await Announcement.insertMany(announcements);

        // 3. Seed Job Approvals & Successful Hires
        const companyNames = ['Google', 'Microsoft', 'Amazon', 'Meta', 'Apple'];
        for (let i = 0; i < companyNames.length; i++) {
            const company = companyNames[i];
            const job = await Job.create({
                title: `Software Engineer - ${company}`,
                company: company,
                description: `Join the engineering team at ${company} to build scalable systems.`,
                location: 'Bangalore, India',
                type: 'Full-time',
                salary: `${15 + i * 2}-${25 + i * 2} LPA`,
                deadline: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
                eligibility: { minCGPA: 7.0, branches: ['CSE', 'IT'] },
                postedBy: recruiter._id,
                status: 'approved'
            });

            const student = studentList[i % studentList.length];
            await Application.create({
                job: job._id,
                student: student._id,
                status: 'selected',
                appliedAt: new Date(Date.now() - (i + 1) * 24 * 60 * 60 * 1000),
                aiEvaluation: { matchScore: 80 + i, recommendation: 'Strong' }
            });

            // Ensure profile exists
            if (!student.studentProfile) student.studentProfile = {};

            student.studentProfile.isPlaced = true;
            student.studentProfile.placedAt = company;
            student.markModified('studentProfile');
            await student.save();
        }

        res.json({ message: 'Demo data seeded successfully!' });
    } catch (error) {
        console.error('Seeding error:', error);
        res.status(500).json({ error: 'Error seeding demo data', details: error.message });
    }
});

// ==================== Maintenance ====================

// Manual trigger for expiry check
router.post('/maintenance/trigger-expiry-check', auth, authorize('admin'), async (req, res) => {
    try {
        const { runExpiryCheck } = require('../services/expiryService');
        const result = await runExpiryCheck();
        res.json({ 
            message: 'Expiry check completed',
            summary: result
        });
    } catch (error) {
        res.status(500).json({ error: 'Error triggering expiry check', details: error.message });
    }
});

// Get expired items summary
router.get('/maintenance/expired-items', auth, authorize('admin'), async (req, res) => {
    try {
        const now = new Date();
        
        const expiredJobs = await Job.find({
            deadline: { $lt: now },
            isActive: false
        }).select('title company deadline').sort('-deadline');
        
        const expiredAnnouncements = await Announcement.find({
            expiresAt: { $lt: now, $ne: null },
            isActive: false
        }).select('title expiresAt').sort('-expiresAt');
        
        const expiredDrives = await PlacementDrive.find({
            date: { $lt: now },
            isActive: false
        }).select('title company date').sort('-date');

        res.json({
            expiredJobs: {
                count: expiredJobs.length,
                items: expiredJobs
            },
            expiredAnnouncements: {
                count: expiredAnnouncements.length,
                items: expiredAnnouncements
            },
            expiredDrives: {
                count: expiredDrives.length,
                items: expiredDrives
            },
            totalExpired: expiredJobs.length + expiredAnnouncements.length + expiredDrives.length
        });
    } catch (error) {
        res.status(500).json({ error: 'Error fetching expired items', details: error.message });
    }
});

router.get('/export/raw', auth, authorize('admin'), async (req, res) => {
    try {
        const { dataTypes = 'students,placements,recruiters', format = 'json' } = req.query;
        const types = dataTypes.split(',').map(t => t.trim().toLowerCase());
        
        const exportData = {};

        // Students
        if (types.includes('students')) {
            const students = await User.find({ role: 'student' }).lean();
            exportData.students = students;
        }

        // Placements (extracted from applications where status = 'selected')
        if (types.includes('placements')) {
            const placements = await Application.find({ status: 'selected' })
                .populate('student', 'name email studentProfile')
                .populate('job', 'title description company salary')
                .lean();
            exportData.placements = placements;
        }

        // Recruiters
        if (types.includes('recruiters')) {
            const recruiters = await User.find({ role: 'recruiter' }).lean();
            exportData.recruiters = recruiters;
        }

        // Jobs
        if (types.includes('jobs')) {
            const jobs = await Job.find().populate('postedBy', 'name email').lean();
            exportData.jobs = jobs;
        }

        // Applications
        if (types.includes('applications')) {
            const applications = await Application.find()
                .populate('student', 'name email')
                .populate('job', 'title company')
                .lean();
            exportData.applications = applications;
        }

        // Placement Drives
        if (types.includes('drives')) {
            const drives = await PlacementDrive.find().lean();
            exportData.drives = drives;
        }

        // Announcements
        if (types.includes('announcements')) {
            const announcements = await Announcement.find().lean();
            exportData.announcements = announcements;
        }

        // Return as JSON (only format supported now)
        const exportWithMetadata = {
            metadata: {
                exportDate: new Date().toISOString(),
                exportedBy: req.user.email,
                dataTypes: Object.keys(exportData)
            },
            recordCounts: Object.fromEntries(
                Object.entries(exportData).map(([key, val]) => [key, Array.isArray(val) ? val.length : 0])
            ),
            data: exportData
        };
        
        res.setHeader('Content-Type', 'application/json');
        res.setHeader('Content-Disposition', `attachment;filename=raw_export_${new Date().toISOString().split('T')[0]}.json`);

        
        // Return with pretty-printing (indentation of 2 spaces)
        res.set('Content-Type', 'application/json');
        res.send(JSON.stringify(exportWithMetadata, null, 2));
    } catch (error) {
        // Log error but return safe message
        console.error('[EXPORT] Error:', error.message);
        res.status(500).json({ error: 'Export failed', details: error.message });
    }
});

// ==================== Mock Test Cleanup ====================

/**
 * Clean up all AI-generated mock tests
 */
router.post('/mock-tests/cleanup', auth, authorize('admin'), async (req, res) => {
    try {
        const result = await MockTest.deleteMany({ category: 'AI Generated' });

        
        res.json({
            message: `Successfully deleted ${result.deletedCount} AI-generated mock test(s)`,
            deletedCount: result.deletedCount
        });
    } catch (error) {
        console.error('[ADMIN] Mock test cleanup error:', error.message);
        res.status(500).json({ error: 'Failed to cleanup mock tests', details: error.message });
    }
});

/**
 * Get count of AI-generated mock tests
 */
router.get('/mock-tests/count', auth, authorize('admin'), async (req, res) => {
    try {
        const count = await MockTest.countDocuments({ category: 'AI Generated' });
        res.json({
            aiGeneratedCount: count,
            message: `${count} AI-generated mock test(s) in database`
        });
    } catch (error) {
        console.error('[ADMIN] Mock test count error:', error.message);
        res.status(500).json({ error: 'Failed to get mock test count', details: error.message });
    }
});

// ==================== PHASE 3: Real-Time Dashboard Updates ====================

/**
 * Get admin dashboard summary with real-time data
 * Client should poll this endpoint every 5-10 seconds for live updates
 * 
 * PHASE 3 & 4: Real-time admin dashboard implementation
 * Uses polling approach (safe, simple, reliable)
 * 
 * Response includes:
 * - Counts of students, recruiters, jobs, applications
 * - Pending approvals
 * - Upcoming drives
 * - Timestamp for cache invalidation
 */
router.get('/dashboard/summary', auth, authorize('admin'), async (req, res) => {
    try {
        const { getAdminDashboardSummary } = require('../services/realtimeService');
        const summary = await getAdminDashboardSummary();
        
        if (!summary) {
            return res.status(500).json({ error: 'Failed to retrieve dashboard summary' });
        }
        
        res.json({
            success: true,
            data: summary,
            cacheControl: 'no-cache, must-revalidate', // Force fresh data on each request
            pollingInterval: 5000 // Client should poll every 5 seconds
        });
    } catch (error) {
        console.error('[REAL-TIME] Dashboard error:', error.message);
        res.status(500).json({ error: 'Server error retrieving dashboard summary', details: error.message });
    }
});

// ==================== ADMIN SECTION OTP AUTHENTICATION ====================

/**
 * Send OTP to admin portal access email
 * Requires: admin role
 */
router.post('/admin-section-otp/send', auth, authorize('admin'), async (req, res) => {
    try {
        const ADMIN_SECTION_EMAIL = 'mohitbindal106@gmail.com'; // Hardcoded email
        const MAX_OTP_ATTEMPTS = 5;
        
        // Generate 6-digit OTP
        const otp = Math.floor(100000 + Math.random() * 900000).toString();
        
        // Delete any existing OTP for this email and type
        await OTP.deleteMany({ email: ADMIN_SECTION_EMAIL, type: 'admin-section' });
        
        // Create new OTP with optimistic locking
        const otpRecord = await OTP.create({
            email: ADMIN_SECTION_EMAIL,
            otp,
            type: 'admin-section',
            version: 1,
            attempts: 0,
            expiresAt: new Date(Date.now() + 5 * 60 * 1000) // 5 minutes
        });
        
        // Send OTP email
        await sendOTP(ADMIN_SECTION_EMAIL, otp);
        
        res.json({
            success: true,
            message: `OTP sent to ${ADMIN_SECTION_EMAIL}`,
            email: ADMIN_SECTION_EMAIL
        });
    } catch (error) {
        console.error('[ADMIN-OTP] Send OTP error:', error.message);
        res.status(500).json({ error: 'Failed to send OTP: ' + error.message });
    }
});

/**
 * Verify OTP and grant admin section access
 * Requires: admin role + valid OTP
 */
router.post('/admin-section-otp/verify', auth, authorize('admin'), async (req, res) => {
    try {
        const { otp } = req.body;
        const ADMIN_SECTION_EMAIL = 'mohitbindal106@gmail.com';
        
        if (!otp) {
            return res.status(400).json({ error: 'OTP is required' });
        }
        
        // Find OTP record
        const otpRecord = await OTP.findOne({
            email: ADMIN_SECTION_EMAIL,
            type: 'admin-section'
        });
        
        if (!otpRecord) {
            return res.status(400).json({ error: 'OTP expired or not found. Request a new OTP.' });
        }
        
        // Check if OTP is expired
        if (new Date() > otpRecord.expiresAt) {
            await OTP.deleteOne({ _id: otpRecord._id });
            return res.status(400).json({ error: 'OTP expired. Request a new OTP.' });
        }
        
        // Check failed attempts
        if (otpRecord.attempts >= 5) {
            return res.status(429).json({ error: 'Too many incorrect attempts. Request a new OTP.' });
        }
        
        // Verify OTP
        if (otpRecord.otp !== otp.trim()) {
            // Increment failed attempts
            otpRecord.attempts += 1;
            await otpRecord.save();
            
            const remainingAttempts = 5 - otpRecord.attempts;
            return res.status(400).json({ 
                error: `Invalid OTP. ${remainingAttempts} attempts remaining.`,
                attemptsRemaining: remainingAttempts
            });
        }
        
        // OTP verified - create admin section access record
        const accessRecord = await AdminSectionAccess.create({
            admin: req.user._id,
            email: ADMIN_SECTION_EMAIL,
            ipAddress: req.ip,
            userAgent: req.get('user-agent')
        });
        
        // Delete OTP record
        await OTP.deleteOne({ _id: otpRecord._id });
        
        res.json({
            success: true,
            message: 'OTP verified. Admin section access granted.',
            accessToken: accessRecord._id.toString() // Use this as proof of verification
        });
    } catch (error) {
        console.error('[ADMIN-OTP] Verify OTP error:', error.message);
        res.status(500).json({ error: 'Failed to verify OTP: ' + error.message });
    }
});

/**
 * Check if admin has active admin section access
 * Returns access status without requiring verification token in POST
 */
router.get('/admin-section/check-access', auth, authorize('admin'), async (req, res) => {
    try {
        // Check if admin has active access session
        const accessRecord = await AdminSectionAccess.findOne({
            admin: req.user._id
        });
        
        const hasAccess = !!accessRecord;
        
        res.json({
            success: true,
            hasAccess,
            accessExpiredAt: accessRecord?.verifiedAt
        });
    } catch (error) {
        console.error('[ADMIN-OTP] Check access error:', error.message);
        res.status(500).json({ error: 'Failed to check access status: ' + error.message });
    }
});

module.exports = router;
