const express = require('express');
const router = express.Router();
const axios = require('axios');
const { auth, authorize } = require('../middleware/auth');
const upload = require('../middleware/upload');
const Job = require('../models/Job');
const Notification = require('../models/Notification');
const User = require('../models/User');
const ExternalJob = require('../models/ExternalJob');
const aiService = require('../services/aiService');

// Helper to save external jobs to cache in MongoDB
async function cacheExternalJobs(jobsArray, searchKeywords) {
    if (!jobsArray || jobsArray.length === 0) return;
    try {
        const ops = jobsArray.map(job => {
            const locLow = (job.location || '').toLowerCase();
            const isLocalIndia = locLow.includes('india') || locLow.includes(', in') || 
                locLow.includes('bengaluru') || locLow.includes('bangalore') || 
                locLow.includes('delhi') || locLow.includes('mumbai') || 
                locLow.includes('pune') || locLow.includes('hyderabad') || 
                locLow.includes('chennai') || locLow.includes('noida') || 
                locLow.includes('gurgaon') || locLow.includes('gurugram');
                
            const isGlobalRemote = locLow.includes('global') || locLow.includes('anywhere') || locLow.includes('worldwide');
            
            const isIndia = isLocalIndia || isGlobalRemote;
            
            return {
                updateOne: {
                    filter: { jobId: job.id },
                    update: {
                        $set: {
                            title: job.title,
                            company: job.company,
                            location: job.location || 'Remote',
                            type: job.type || 'Full-time',
                            applyUrl: job.applyUrl,
                            source: job.source,
                            postedAt: job.postedAt || new Date(),
                            salary: job.salary,
                            isIndia: isIndia
                        },
                        $addToSet: { searchKeywords: { $each: searchKeywords } }
                    },
                    upsert: true
                }
            };
        });
        await ExternalJob.bulkWrite(ops, { ordered: false });
    } catch (e) {
        console.error("Error caching external jobs:", e.message);
    }
}

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

// Get external jobs from public APIs and JSearch (Cached to MongoDB)
router.get('/external', auth, async (req, res) => {
    try {
        let queryStr = 'Software Developer';
        let skills = [];
        
        const user = await User.findById(req.user._id);
        const profile = user?.studentProfile || {};

        if (Array.isArray(profile.skills) && profile.skills.length > 0) {
            skills = profile.skills.slice(0, 3);
        } else if (typeof profile.skills === 'string' && profile.skills.trim()) {
            skills = profile.skills.split(',').map(s => s.trim()).slice(0, 3);
        }

        if (skills.length > 0) {
            queryStr = skills.join(' ');
        } else {
            skills = ['Software Developer']; // Fallback
        }
        
        let fetchedJobs = [];

        // 1. Fetch from JSearch APIs (Removed restricting 'in' country so it finds jobs properly)
        const rapidApiKeys = [
            process.env.RAPIDAPI_KEY_1,
            process.env.RAPIDAPI_KEY_2,
            process.env.RAPIDAPI_KEY_3,
            process.env.RAPIDAPI_KEY_4,
            process.env.RAPIDAPI_KEY_5
        ].filter(Boolean);

        if (rapidApiKeys.length > 0) {
            const randomKey = rapidApiKeys[Math.floor(Math.random() * rapidApiKeys.length)];
            const jsearchOptions = {
                method: 'GET',
                url: 'https://jsearch.p.rapidapi.com/search',
                params: { query: queryStr, page: '1', num_pages: '1' }, // Generic query, lets JSearch find what it finds best
                headers: {
                    'X-RapidAPI-Key': randomKey,
                    'X-RapidAPI-Host': 'jsearch.p.rapidapi.com'
                }
            };
            
            try {
                const jsearchRes = await axios.request(jsearchOptions);
                if (jsearchRes.data && jsearchRes.data.data) {
                    const jobsFound = jsearchRes.data.data.map(j => ({
                        id: j.job_id,
                        title: j.job_title,
                        company: j.employer_name,
                        location: j.job_city ? `${j.job_city}, ${j.job_country}` : 'Remote',
                        type: j.job_employment_type || 'Full-time',
                        applyUrl: j.job_apply_link || j.job_google_link,
                        source: 'LinkedIn / Indeed (JSearch)',
                        postedAt: j.job_posted_at_datetime_utc || new Date(),
                        salary: j.job_min_salary ? `$${j.job_min_salary} - $${j.job_max_salary}` : null
                    }));
                    fetchedJobs = [...fetchedJobs, ...jobsFound];
                }
            } catch(e) {
                console.error("JSearch API error:", e.response?.data || e.message);
            }
        }

        // 2. Fetch from Arbeitnow (Free, Global/Remote tech jobs)
        try {
            const arbeitRes = await axios.get('https://www.arbeitnow.com/api/job-board-api?page=1');
            if (arbeitRes.data && arbeitRes.data.data) {
                let filteredArbeit = arbeitRes.data.data;
               
                if (skills.length > 0) {
                    filteredArbeit = arbeitRes.data.data.filter(j => {
                        const titleLower = j.title.toLowerCase();
                        return titleLower.includes(skills[0].toLowerCase()) || 
                               (skills[1] && titleLower.includes(skills[1].toLowerCase()));
                    });
                }
                
                filteredArbeit = (filteredArbeit.length > 0 ? filteredArbeit : arbeitRes.data.data).slice(0, 8);

                const formattedArbeit = filteredArbeit.map(j => ({
                    id: j.slug,
                    title: j.title,
                    company: j.company_name,
                    location: j.location,
                    type: j.remote ? 'Remote' : 'On-site',
                    applyUrl: j.url,
                    source: 'Arbeitnow',
                    postedAt: new Date(j.created_at * 1000).toISOString(),
                    salary: null
                }));
                fetchedJobs = [...fetchedJobs, ...formattedArbeit];
            }
        } catch(e) {
            console.error("Arbeitnow API error:", e.message);
        }

        // 3. Fetch from Remotive (Free, mostly Global & Remote Programming jobs)
        try {
            const remotiveQuery = skills.length > 0 ? encodeURIComponent(skills[0]) : 'Software dev';
            
            // Standard query
            const remotiveRes = await axios.get(`https://remotive.com/api/remote-jobs?search=${remotiveQuery}&limit=10`);
            
            // Extra: Forces Indian/Global Remote jobs to be populated in cache
            let remotiveIndiaRes = { data: { jobs: [] } };
            try {
                remotiveIndiaRes = await axios.get(`https://remotive.com/api/remote-jobs?category=software-dev&search=India&limit=5`);
            } catch (err) {}
            
            let combinedRemotiveJobs = [];
            if (remotiveRes.data && remotiveRes.data.jobs) {
                combinedRemotiveJobs = [...combinedRemotiveJobs, ...remotiveRes.data.jobs.slice(0, 8)];
            }
            if (remotiveIndiaRes.data && remotiveIndiaRes.data.jobs) {
                combinedRemotiveJobs = [...combinedRemotiveJobs, ...remotiveIndiaRes.data.jobs];
            }

            if (combinedRemotiveJobs.length > 0) {
                const formattedRemotive = combinedRemotiveJobs.map(j => ({
                    id: String(j.id),
                    title: j.title,
                    company: j.company_name,
                    location: j.candidate_required_location || 'Global',
                    type: j.job_type,
                    applyUrl: j.url,
                    source: 'Remotive',
                    postedAt: j.publication_date,
                    salary: j.salary || null
                }));
                fetchedJobs = [...fetchedJobs, ...formattedRemotive];
            }
        } catch(e) {
            console.error("Remotive API error:", e.message);
        }

        // 4. Fetch from GraphQL Jobs (Global niche web dev)
        try {
            const gqlRes = await axios.get('https://graphql.jobs/api');
            if (gqlRes.data && Array.isArray(gqlRes.data)) {
                const formattedGql = gqlRes.data.slice(0, 4).map(j => ({
                    id: j.id,
                    title: j.title,
                    company: j.company?.name || 'Unknown',
                    location: (j.cities && j.cities.map(c=>c.name).join(', ')) || 'Remote',
                    type: j.commitment?.title || 'Full-time',
                    applyUrl: j.applyUrl || j.websiteUrl,
                    source: 'GraphQL Jobs',
                    postedAt: j.publishedAt || new Date(),
                    salary: null
                }));
                fetchedJobs = [...fetchedJobs, ...formattedGql];
            }
        } catch(e) {
            console.error("GraphQL Jobs API error:", e.message);
        }

        // --- CACHING & FETCHING FROM DB ---
        // Save the newly fetched jobs into our MongoDB collection.
        // It upserts them to prevent duplicates and links them to the current search keywords
        if (fetchedJobs.length > 0) {
            await cacheExternalJobs(fetchedJobs, skills);
        }

        // Now, regardless of whether the external APIs failed or succeeded,
        // we pull the jobs mapping these skills directly from OUR MongoDB cache.
        // This completely satisfies the cross-student sharing mechanism!
        
        // Build a regex pattern out of the skills to fuzzy search the DB
        const matchRegexes = skills.map(skill => new RegExp(skill, 'i'));
        
        const cachedResults = await ExternalJob.find({
            $or: [
                { searchKeywords: { $in: skills } },
                { title: { $in: matchRegexes } }
            ]
        }).sort({ postedAt: -1 }).limit(100);

        // Normalize DB records back to frontend format
        let allJobs = cachedResults.map(j => ({
            id: j.jobId,
            title: j.title,
            company: j.company,
            location: j.location,
            type: j.type,
            applyUrl: j.applyUrl,
            source: j.source,
            postedAt: j.postedAt,
            salary: j.salary,
            isIndia: j.isIndia // New field added for frontend sections!
        }));

        // Shuffle securely to make results dynamic
        allJobs = allJobs.sort(() => 0.5 - Math.random());
        res.json(allJobs);
        
    } catch (error) {
        console.error('External Jobs Endpoint Error:', error);
        res.status(500).json({ error: 'Server error while fetching external jobs' });
    }
});

// Get job attachment (MUST be before /:id route)
router.get('/:id/attachment', auth, async (req, res) => {
    try {
        const job = await Job.findById(req.params.id);
        if (!job) {
            return res.status(404).json({ error: 'Job not found' });
        }
        
        if (!job.attachmentFile) {
            return res.status(404).json({ error: 'No attachment found for this job' });
        }
        
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

// Import job from WhatsApp string (admin/recruiter)
router.post('/import-whatsapp', auth, authorize('admin', 'recruiter'), async (req, res) => {
    try {
        const { text } = req.body;
        if (!text) return res.status(400).json({ error: 'Text is required' });

        const extractedData = await aiService.extractJobFromWhatsApp(text);
        
        let dDate = extractedData.deadline ? new Date(extractedData.deadline) : new Date();
        if (isNaN(dDate.getTime())) {
            dDate = new Date();
            dDate.setDate(dDate.getDate() + 14);
        }

        const jobData = { 
            ...extractedData, 
            postedBy: req.user._id, 
            status: 'pending',
            source: 'WhatsApp',
            company: extractedData.company || 'Unknown Company',
            title: extractedData.title || 'Unknown Title',
            description: extractedData.description || text,
            deadline: dDate,
            location: extractedData.location || 'Remote'
        };
        
        const job = new Job(jobData);
        await job.save();
        res.status(201).json(job);
    } catch (error) {
        console.error('Import Error:', error);
        res.status(400).json({ error: error.message || 'Failed to extract and save job' });
    }
});

// Create job posting (recruiter)
router.post('/', auth, authorize('recruiter'), upload.single('attachment'), async (req, res) => {
    try {
        const jobData = { ...req.body, postedBy: req.user._id, company: req.user.recruiterProfile?.company || req.body.company };
        
        // Handle file attachment if provided
        if (req.file) {
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

// ==================== WhatsApp Cloud API Integration ====================

// 1. Webhook Verification (Required by Meta/WhatsApp API to set up the connection)
router.get('/webhook/whatsapp', (req, res) => {
    const verify_token = process.env.WHATSAPP_VERIFY_TOKEN || 'my_super_secret_university_token';
    const mode = req.query['hub.mode'];
    const token = req.query['hub.verify_token'];
    const challenge = req.query['hub.challenge'];

    if (mode && token) {
        if (mode === 'subscribe' && token === verify_token) {
            console.log('WEBHOOK_VERIFIED');
            res.status(200).send(challenge);
        } else {
            res.sendStatus(403);
        }
    } else {
        res.sendStatus(400);
    }
});

// 2. Receive Incoming Messages from WhatsApp
router.post('/webhook/whatsapp', async (req, res) => {
    try {
        const body = req.body;

        // Check if this is an event from the WhatsApp API
        if (body.object === 'whatsapp_business_account') {
            
            // Return a 200 OK immediately to WhatsApp (prevents retries/timeouts)
            res.status(200).send('EVENT_RECEIVED');

            if (body.entry && body.entry[0].changes && body.entry[0].changes[0] && 
                body.entry[0].changes[0].value.messages && body.entry[0].changes[0].value.messages[0]) {
                
                const message = body.entry[0].changes[0].value.messages[0];
                
                // Only process text messages
                if (message.type === 'text') {
                    const text = message.text.body;
                    
                    // Run the import async in the background
                    // Ensure we have an admin user to assign the job to
                    const adminUser = await User.findOne({ role: 'admin' });
                    if (!adminUser) {
                        console.error('No admin user found to assign the webhook job');
                        return;
                    }

                    console.log('[WhatsApp Webhook] Processing incoming job text...');
                    const extractedData = await aiService.extractJobFromWhatsApp(text);
                    
                    let dDate = extractedData.deadline ? new Date(extractedData.deadline) : new Date();
                    if (isNaN(dDate.getTime())) {
                        dDate = new Date();
                        dDate.setDate(dDate.getDate() + 14); // Default to 2 weeks
                    }

                    const jobData = { 
                        ...extractedData, 
                        postedBy: adminUser._id, 
                        status: 'pending',
                        source: 'WhatsApp',
                        applyUrl: extractedData.applyUrl || '',
                        company: extractedData.company || 'Unknown Company',
                        title: extractedData.title || 'Unknown Title',
                        description: extractedData.description || text,
                        deadline: dDate,
                        location: extractedData.location || 'Remote'
                    };
                    
                    const job = new Job(jobData);
                    await job.save();
                    console.log('[WhatsApp Webhook] Job saved to pending queue successfully!');
                }
            }
        } else {
            // Not a WhatsApp API event
            res.sendStatus(404);
        }
    } catch (error) {
        console.error('[WhatsApp Webhook] Import Error:', error.message);
        // Error handling normally omitted in webhooks since we already sent 200 OK
    }
});

// ==================== Twilio WhatsApp Sandbox ====================
// A much simpler alternative to the official Meta Cloud API. 
// Go to twilio.com/console -> Messaging -> Try it out -> Send a WhatsApp Message
// Connect your number to the Sandbox, then set the Webhook URL to: /api/jobs/webhook/twilio
router.post('/webhook/twilio', async (req, res) => {
    try {
        const text = req.body.Body; // Twilio sends the message body here
        
        if (!text) {
            return res.status(200).send('<Response></Response>'); 
        }
        
        const adminUser = await User.findOne({ role: 'admin' });
        if (!adminUser) return res.status(200).send('<Response></Response>');

        console.log('[Twilio Webhook] Processing incoming job text...');
        const extractedData = await aiService.extractJobFromWhatsApp(text);
        
        let dDate = extractedData.deadline ? new Date(extractedData.deadline) : new Date();
        if (isNaN(dDate.getTime())) {
            dDate = new Date();
            dDate.setDate(dDate.getDate() + 14);
        }

        const jobData = { 
            ...extractedData, 
            postedBy: adminUser._id, 
            status: 'pending',
            source: 'WhatsApp (Twilio)',
            applyUrl: extractedData.applyUrl || '',
            company: extractedData.company || 'Unknown Company',
            title: extractedData.title || 'Unknown Title',
            description: extractedData.description || text,
            deadline: dDate,
            location: extractedData.location || 'Remote'
        };
        
        const job = new Job(jobData);
        await job.save();
        console.log('[Twilio Webhook] Job saved to pending queue successfully!');
        
        // Respond to Twilio so it knows the webhook was received
        res.set('Content-Type', 'text/xml');
        res.status(200).send('<Response></Response>');
    } catch (error) {
        console.error('[Twilio Webhook] Import Error:', error.message);
        res.set('Content-Type', 'text/xml');
        res.status(200).send('<Response></Response>');
    }
});

module.exports = router;
