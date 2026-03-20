const mongoose = require('mongoose');
const dotenv = require('dotenv');
const bcrypt = require('bcryptjs');
const User = require('./models/User');
const Job = require('./models/Job');
const Application = require('./models/Application');

dotenv.config();

const MONGODB_URI = process.env.MONGODB_URI;

const recruiters = [
    { name: 'Sundar Pichai', email: 'recruiter.google@uniplacements.com', company: 'Google', title: 'Software Engineer', location: 'Bangalore' },
    { name: 'Satya Nadella', email: 'recruiter.microsoft@uniplacements.com', company: 'Microsoft', title: 'Data Scientist', location: 'Hyderabad' },
    { name: 'Andy Jassy', email: 'recruiter.amazon@uniplacements.com', company: 'Amazon', title: 'Cloud Architect', location: 'Pune' },
    { name: 'Mark Zuckerberg', email: 'recruiter.meta@uniplacements.com', company: 'Meta', title: 'Frontend Engineer', location: 'Remote' },
    { name: 'Tim Cook', email: 'recruiter.apple@uniplacements.com', company: 'Apple', title: 'iOS Developer', location: 'Gurugram' },
];

const students = [
    { name: 'Aarav Sharma', email: 'student1@uniplacements.com' },
    { name: 'Vivaan Singh', email: 'student2@uniplacements.com' },
    { name: 'Aditya Patel', email: 'student3@uniplacements.com' },
    { name: 'Vihaan Kumar', email: 'student4@uniplacements.com' },
    { name: 'Arjun Gupta', email: 'student5@uniplacements.com' }
];

// A minimal valid PDF file in base64 format (Displays "Dummy Resume")
const dummyPdfBase64 = "JVBERi0xLjcKCjEgMCBvYmogICUgZW50cnkgcG9pbnQKPDwKICAvVHlwZSAvQ2F0YWxvZwogIC9QYWdlcyAyIDAgUgo+PgplbmRvYmoKCjIgMCBvYmoKPDwKICAvVHlwZSAvUGFnZXMKICAvTWVkaWFCb3ggWyAwIDAgMjAwIDIwMCBdCiAgL0NvdW50IDEKICAvS2lkcyBbIDMgMCBSIF0KPj4KZW5kb2JqCgozIDAgb2JqCjw8CiAgL1R5cGUgL1BhZ2UKICAvUGFyZW50IDIgMCBSCiAgL1Jlc291cmNlcyA8PAogICAgL0ZvbnQgPDwKICAgICAgL0YxIDQgMCBSCj4+Cj4+CiAgL0NvbnRlbnRzIDUgMCBSCj4+CmVuZG9iagoKNCAwIG9iago8PAogIC9UeXBlIC9Gb250CiAgL1N1YnR5cGUgL1R5cGUxCiAgL0Jhc2VGb250IC9UaW1lcy1Sb21hbgo+PgplbmRvYmoKCjUgMCBvYmoKPDwgL0xlbmd0aCA0NCA+PgpzdHJlYW0KQlQKNzAgNTAgVEQKL0YxIDEyIFRmCihEdW1teSBSZXN1bWUpIFRqCkVUCmVuZHN0cmVhbQplbmRvYmoKCnhyZWYKMCA2CjAwMDAwMDAwMDAgNjU1MzUgZiAKMDAwMDAwMDEwIDEwMDAwIG4gCjAwMDAwMDAwNjIgMDAwMDAgbiAKMDAwMDAwMDE0OCAwMDAwMCBuIAowMDAwMDAwMjU2IDAwMDAwIG4gCjAwMDAwMDAzNDQgMDAwMDAgbiAKdHJhaWxlcgo8PAogIC9TaXplIDYKICAvUm9vdCAxIDAgUgo+PgpzdGFydHhyZWYKNDM5CiUlRU9GCg==";

const seedDB = async () => {
    try {
        if (!MONGODB_URI) {
            throw new Error('MONGODB_URI is not set in environment.');
        }
        console.log('Connecting to MongoDB Production Cluster...');
        await mongoose.connect(MONGODB_URI);
        console.log('Connected.');

        console.log('Clearing existing data...');
        // Only clear if you want a fresh start. We might not want to clear real students.
        // Actually, let's just create them if they don't exist, rather than deleting everything.
        // Or perhaps delete only the dummy ones to prevent duplicates on multiple runs.

        await User.deleteMany({ email: { $in: ['admin@uniplacements.com', ...recruiters.map(r => r.email), ...students.map(s => s.email)] } });
        await Job.deleteMany({});
        await Application.deleteMany({});

        // Use a strong random password. In production, send password reset links to users instead.
        const demoPassword = process.env.DEMO_PASSWORD || require('crypto').randomBytes(16).toString('hex');

        // 1. Create Admin
        console.log('Creating Admin...');
        const admin = new User({
            name: 'System Admin',
            email: process.env.ADMIN_EMAIL || 'admin@uniplacements.com',
            password: demoPassword,
            role: 'admin',
            isVerified: true
        });
        await admin.save();

        // 2. Create Recruiters and Jobs
        console.log('Creating Recruiters and their Jobs...');
        const createdJobs = [];
        for (const data of recruiters) {
            const recruiter = new User({
                name: data.name,
                email: data.email,
                password: demoPassword,
                role: 'recruiter',
                isVerified: true,
                isApprovedByAdmin: true, // Phase 11 Bypass for Seeded Accounts
                recruiterProfile: {
                    company: data.company,
                    designation: 'Senior Recruiter',
                    industry: 'Information Technology'
                }
            });
            await recruiter.save();

            const job = new Job({
                title: data.title,
                company: data.company,
                description: `We are looking for a talented ${data.title} to join our core team at ${data.company}.`,
                location: data.location,
                type: 'Full-time',
                salary: '12 LPA - 24 LPA',
                openings: 5,
                deadline: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 days
                eligibility: { minCGPA: 7.0, branches: ['Computer Science', 'Information Technology'], skills: ['React', 'Node.js', 'Python'] },
                requirements: ['Strong problem-solving skills', 'Good communication'],
                responsibilities: ['Develop scalable systems', 'Collaborate with cross-functional teams'],
                postedBy: recruiter._id,
                status: 'approved',
                isActive: true
            });
            await job.save();
            createdJobs.push(job);
        }

        // 3. Create Students and Applications
        console.log('Creating Students and dummy applications...');
        for (let i = 0; i < students.length; i++) {
            const studentData = students[i];
            const studentId = new mongoose.Types.ObjectId();
            const student = new User({
                _id: studentId,
                name: studentData.name,
                email: studentData.email,
                password: passwordReset,
                role: 'student',
                isVerified: true,
                studentProfile: {
                    department: 'Computer Science',
                    cgpa: 8.5 + (i * 0.1),
                    skills: ['JavaScript', 'React', 'MongoDB', 'Node.js', 'Python'],
                    resumeUrl: `/api/students/resume/${studentId}`,
                    resumeBase64: dummyPdfBase64,
                    resumeContentType: 'application/pdf',
                    aiResumeAnalysis: {
                        resumeScore: 78 + i * 3,
                        technicalSkillsScore: 16,
                        projectsScore: 16,
                        experienceScore: 15,
                        atsScore: 15,
                        clarityScore: 16,
                        strengths: ['Strong foundation in web development', 'Good projects with React'],
                        weaknesses: ['Lack of cloud deployment experience (AWS/Azure)', 'Could quantify achievements'],
                        missingSkills: ['Docker', 'Kubernetes'],
                        suggestions: ['Add links to deployed projects', 'Include quantifiable metrics for your work']
                    }
                }
            });
            await student.save();

            // Apply to the first 3 jobs
            for (let j = 0; j < 3; j++) {
                const job = createdJobs[(i + j) % createdJobs.length];
                let status = 'applied';

                // Randomly set status
                const rand = Math.random();
                if (rand > 0.8) status = 'selected';
                else if (rand > 0.5) status = 'shortlisted';
                else if (rand > 0.3) status = 'interview';
                else if (rand > 0.1) status = 'rejected';

                const app = new Application({
                    job: job._id,
                    student: student._id,
                    status: status,
                    coverLetter: `I am very interested in the ${job.title} role at ${job.company}.`,
                    aiEvaluation: {
                        matchScore: 80 + Math.floor(Math.random() * 15),
                        skillMatchScore: 85,
                        experienceMatchScore: 78,
                        recommendation: 'Strong',
                        strengthSummary: `Strong alignment with ${job.title} core skills.`,
                        riskFactors: ['No previous major internship']
                    }
                });
                await app.save();
            }
        }

        console.log('Seeding Complete! 🎉');
        console.log('✅ Admin account created');
        console.log('✅ Recruiters created:', recruiters.map(r => r.name).join(', '));
        console.log('✅ Students created:', students.map(s => s.name).join(', '));
        console.log('\n⚠️  IMPORTANT: Send password reset emails to all seeded users instead of sharing passwords.');
        process.exit(0);
    } catch (err) {
        console.error(err);
        process.exit(1);
    }
}

seedDB();
