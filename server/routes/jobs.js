const express = require('express');
const router = express.Router();
const { auth, authorize } = require('../middleware/auth');
const upload = require('../middleware/upload');
const Job = require('../models/Job');
const Notification = require('../models/Notification');
const User = require('../models/User');

// Get all approved jobs (for students)
router.get('/', auth, async (req, res) => {
    try {
        const query = req.user.role === 'admin' ? {} : { status: 'approved', isActive: true };
        const jobs = await Job.find(query).populate('postedBy', 'name email recruiterProfile').sort('-createdAt');
        res.json(jobs);
    } catch (error) {
        res.status(500).json({ error: 'Server error' });
    }
});

// Get job attachment (MUST be before /:id route)
router.get('/:id/attachment', auth, async (req, res) => {
    try {
        console.log('Downloading attachment for job:', req.params.id);
        const job = await Job.findById(req.params.id);
        if (!job) {
            console.log('Job not found:', req.params.id);
            return res.status(404).json({ error: 'Job not found' });
        }
        
        if (!job.attachmentFile) {
            console.log('No attachment found for job:', req.params.id);
            return res.status(404).json({ error: 'No attachment found for this job' });
        }
        
        console.log('Found attachment, converting from base64');
        const buffer = Buffer.from(job.attachmentFile, 'base64');
        const contentType = job.attachmentContentType || 'application/octet-stream';
        const filename = job.attachmentFileName || 'attachment';
        
        res.set('Content-Type', contentType);
        res.set('Content-Disposition', `attachment; filename="${filename}"`);
        res.set('Content-Length', buffer.length);
        return res.send(buffer);
    } catch (error) {
        console.error('Attachment download error:', error);
        return res.status(500).json({ error: 'Error downloading attachment: ' + error.message });
    }
});

// Get job by id
router.get('/:id', auth, async (req, res) => {
    try {
        const job = await Job.findById(req.params.id).populate('postedBy', 'name email recruiterProfile');
        if (!job) return res.status(404).json({ error: 'Job not found' });
        res.json(job);
    } catch (error) {
        res.status(500).json({ error: 'Server error' });
    }
});

// Create job posting (recruiter)
router.post('/', auth, authorize('recruiter'), upload.single('attachment'), async (req, res) => {
    try {
        const jobData = { ...req.body, postedBy: req.user._id, company: req.user.recruiterProfile?.company || req.body.company };
        
        // Handle file attachment if provided
        if (req.file) {
            console.log('File uploaded:', req.file.originalname, 'Type:', req.file.mimetype, 'Size:', req.file.size);
            const base64 = req.file.buffer.toString('base64');
            jobData.attachmentFile = base64;
            jobData.attachmentFileName = req.file.originalname;
            jobData.attachmentContentType = req.file.mimetype;
        }
        
        const job = new Job(jobData);
        await job.save();

        // Notify admin
        const admins = await User.find({ role: 'admin' });
        for (const admin of admins) {
            await new Notification({
                user: admin._id,
                title: 'New Job Posting',
                message: `${req.user.name} posted a new job: ${job.title}`,
                type: 'info',
                link: '/admin/jobs'
            }).save();
        }

        res.status(201).json(job);
    } catch (error) {
        console.error('Error creating job posting:', error);
        res.status(500).json({ error: error.message || 'Error creating job posting' });
    }
});

// Update job (recruiter who posted it)
router.put('/:id', auth, authorize('recruiter'), async (req, res) => {
    try {
        const job = await Job.findOne({ _id: req.params.id, postedBy: req.user._id });
        if (!job) return res.status(404).json({ error: 'Job not found or unauthorized' });

        Object.assign(job, req.body);
        await job.save();
        res.json(job);
    } catch (error) {
        res.status(500).json({ error: 'Error updating job' });
    }
});

// Delete job
router.delete('/:id', auth, authorize('recruiter', 'admin'), async (req, res) => {
    try {
        const query = req.user.role === 'admin' ? { _id: req.params.id } : { _id: req.params.id, postedBy: req.user._id };
        const job = await Job.findOneAndDelete(query);
        if (!job) return res.status(404).json({ error: 'Job not found or unauthorized' });
        res.json({ message: 'Job deleted successfully' });
    } catch (error) {
        res.status(500).json({ error: 'Error deleting job' });
    }
});

// Get jobs posted by recruiter
router.get('/recruiter/my-jobs', auth, authorize('recruiter'), async (req, res) => {
    try {
        const jobs = await Job.find({ postedBy: req.user._id }).sort('-createdAt');
        res.json(jobs);
    } catch (error) {
        res.status(500).json({ error: 'Server error' });
    }
});

module.exports = router;
