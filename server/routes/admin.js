const express = require('express');
const router = express.Router();
const { auth, authorize } = require('../middleware/auth');
const User = require('../models/User');
const Job = require('../models/Job');
const Application = require('../models/Application');
const PlacementDrive = require('../models/PlacementDrive');
const Announcement = require('../models/Announcement');
const Notification = require('../models/Notification');
const { sendRecruiterConfirmationEmail } = require('../services/emailService');

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
router.delete('/students/:id', auth, authorize('admin'), async (req, res) => {
    try {
        const student = await User.findOneAndDelete({ _id: req.params.id, role: 'student' });
        if (!student) return res.status(404).json({ error: 'Student not found' });

        // Cleanup applications
        await Application.deleteMany({ student: req.params.id });

        res.json({ message: 'Student account and data deleted successfully' });
    } catch (error) {
        res.status(500).json({ error: 'Error deleting student' });
    }
});

// Delete recruiter account
router.delete('/recruiters/:id', auth, authorize('admin'), async (req, res) => {
    try {
        const recruiter = await User.findOneAndDelete({ _id: req.params.id, role: 'recruiter' });
        if (!recruiter) return res.status(404).json({ error: 'Recruiter not found' });

        // Cleanup jobs and their applications
        const recruiterJobs = await Job.find({ postedBy: req.params.id });
        const jobIds = recruiterJobs.map(j => j._id);
        await Application.deleteMany({ job: { $in: jobIds } });
        await Job.deleteMany({ postedBy: req.params.id });

        res.json({ message: 'Recruiter account and related job data deleted successfully' });
    } catch (error) {
        res.status(500).json({ error: 'Error deleting recruiter' });
    }
});

// ==================== Admin Management ====================

// Get all admins
router.get('/admins', auth, authorize('admin'), async (req, res) => {
    try {
        const admins = await User.find({ role: 'admin' }).select('name email createdAt').sort('-createdAt');
        res.json(admins);
    } catch (error) {
        res.status(500).json({ error: 'Error fetching admins' });
    }
});

// Promote user to admin
router.post('/promote/:userId', auth, authorize('admin'), async (req, res) => {
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
router.delete('/admins/:id', auth, authorize('admin'), async (req, res) => {
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

// Get all jobs (for admin)
router.get('/jobs', auth, authorize('admin'), async (req, res) => {
    try {
        const jobs = await Job.find().populate('postedBy', 'name email recruiterProfile').sort('-createdAt');
        res.json(jobs);
    } catch (error) {
        res.status(500).json({ error: 'Server error' });
    }
});

// Get pending jobs
router.get('/jobs/pending', auth, authorize('admin'), async (req, res) => {
    try {
        const jobs = await Job.find({ status: 'pending' }).populate('postedBy', 'name email recruiterProfile').sort('-createdAt');
        res.json(jobs);
    } catch (error) {
        res.status(500).json({ error: 'Server error' });
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
        const drives = await PlacementDrive.find().sort('-date');
        res.json(drives);
    } catch (error) {
        res.status(500).json({ error: 'Server error' });
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
        const announcements = await Announcement.find({ isActive: true })
            .populate('createdBy', 'name')
            .sort('-createdAt');
        res.json(announcements);
    } catch (error) {
        res.status(500).json({ error: 'Server error' });
    }
});

router.post('/announcements', auth, authorize('admin'), async (req, res) => {
    try {
        const announcement = new Announcement({ ...req.body, createdBy: req.user._id });
        await announcement.save();

        // Notify target audience
        let query = {};
        if (req.body.targetAudience === 'students') query.role = 'student';
        else if (req.body.targetAudience === 'recruiters') query.role = 'recruiter';

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
            .limit(5);

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

// ==================== Data Export (Raw Format) ====================

/**
 * Export raw data from MongoDB
 * Query params: dataTypes (comma-separated: students,placements,recruiters,jobs,applications,drives,announcements)
 * Format: json or csv
 */
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

        // Return as JSON or CSV
        if (format === 'csv') {
            // Convert to CSV format
            let csv = '';
            for (const [dataType, records] of Object.entries(exportData)) {
                if (!records || records.length === 0) continue;
                
                csv += `\n\n--- ${dataType.toUpperCase()} (${records.length} records) ---\n`;
                
                // Get headers from first record
                const headers = Object.keys(records[0]);
                csv += headers.map(h => `"${h}"`).join(',') + '\n';
                
                // Add data rows
                records.forEach(record => {
                    csv += headers.map(h => {
                        const val = record[h];
                        if (val === null || val === undefined) return '';
                        if (typeof val === 'object') return `"${JSON.stringify(val).replace(/"/g, '\\"')}"`;
                        if (typeof val === 'string') return `"${val.replace(/"/g, '\\"')}"`;
                        return val;
                    }).join(',') + '\n';
                });
            }
            
            res.setHeader('Content-Type', 'text/csv;charset=utf-8');
            res.setHeader('Content-Disposition', `attachment;filename=raw_export_${new Date().toISOString().split('T')[0]}.csv`);
            res.send(csv);
        } else {
            // JSON format (default)
            res.setHeader('Content-Type', 'application/json');
            res.setHeader('Content-Disposition', `attachment;filename=raw_export_${new Date().toISOString().split('T')[0]}.json`);
            res.json(exportData);
        }
    } catch (error) {
        console.error('Export error:', error);
        res.status(500).json({ error: 'Export failed', details: error.message });
    }
});

module.exports = router;
