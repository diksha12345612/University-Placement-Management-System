const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const crypto = require('crypto');
require('dotenv').config();

const User = require('./models/User');
const Job = require('./models/Job');
const Application = require('./models/Application');
const Notification = require('./models/Notification');
const Announcement = require('./models/Announcement');
const PlacementDrive = require('./models/PlacementDrive');
const MockTest = require('./models/MockTest');

// Generate secure demo password from environment or random value
const DEMO_PASSWORD = process.env.DEMO_PASSWORD || crypto.randomBytes(8).toString('hex');

console.log('[SEED] Using demo password:', DEMO_PASSWORD);

const seedData = async () => {
    try {
        await mongoose.connect(process.env.MONGODB_URI);
        console.log('Connected to MongoDB');

        // Clear existing data
        await User.deleteMany({});
        await Job.deleteMany({});
        await Application.deleteMany({});
        await Notification.deleteMany({});
        await Announcement.deleteMany({});
        await PlacementDrive.deleteMany({});
        await MockTest.deleteMany({});
        console.log('Cleared existing data');

        // Create Admin
        const admin = await User.create({
            name: 'Placement Officer',
            email: 'kumarmohit78774@gmail.com',
            password: DEMO_PASSWORD,
            role: 'admin',
            isVerified: true
        });
        console.log('Admin created');

        // Create Sample Students (10+)
        const students = await User.create([
            {
                name: 'Rahul Sharma', email: 'rahul@student.com', password: DEMO_PASSWORD, role: 'student', isVerified: true,
                studentProfile: { rollNumber: 'CS2021001', department: 'Computer Science', batch: '2025', cgpa: 8.5, phone: '9876543210', skills: ['JavaScript', 'React', 'Node.js', 'Python'], tenthPercentage: 92, twelfthPercentage: 88, gender: 'Male' }
            },
            {
                name: 'Priya Patel', email: 'priya@student.com', password: DEMO_PASSWORD, role: 'student', isVerified: true,
                studentProfile: { rollNumber: 'EC2021015', department: 'Electronics', batch: '2025', cgpa: 9.0, phone: '9876543211', skills: ['C++', 'IoT', 'MATLAB'], tenthPercentage: 95, twelfthPercentage: 91, gender: 'Female' }
            },
            {
                name: 'Amit Kumar', email: 'amit@student.com', password: DEMO_PASSWORD, role: 'student', isVerified: true,
                studentProfile: { rollNumber: 'IT2021008', department: 'Information Technology', batch: '2025', cgpa: 7.8, phone: '9876543212', skills: ['Java', 'Spring Boot', 'MySQL'], tenthPercentage: 85, twelfthPercentage: 82, gender: 'Male' }
            },
            {
                name: 'Sneha Reddy', email: 'sneha@student.com', password: DEMO_PASSWORD, role: 'student', isVerified: true,
                studentProfile: { rollNumber: 'CS2021042', department: 'Computer Science', batch: '2025', cgpa: 9.2, phone: '9876543213', skills: ['Python', 'Machine Learning', 'Data Science'], tenthPercentage: 94, twelfthPercentage: 93, gender: 'Female' }
            },
            {
                name: 'Vikram Singh', email: 'vikram@student.com', password: DEMO_PASSWORD, role: 'student', isVerified: true,
                studentProfile: { rollNumber: 'ME2021021', department: 'Mechanical', batch: '2025', cgpa: 8.1, phone: '9876543214', skills: ['AutoCAD', 'SolidWorks', 'Thermodynamics'], tenthPercentage: 88, twelfthPercentage: 84, gender: 'Male' }
            },
            {
                name: 'Anjali Gupta', email: 'anjali@student.com', password: DEMO_PASSWORD, role: 'student', isVerified: true,
                studentProfile: { rollNumber: 'EE2021005', department: 'Electrical', batch: '2025', cgpa: 8.7, phone: '9876543215', skills: ['Circuit Design', 'PLC', 'Control Systems'], tenthPercentage: 91, twelfthPercentage: 89, gender: 'Female' }
            },
            {
                name: 'Rohan Mehra', email: 'rohan@student.com', password: DEMO_PASSWORD, role: 'student', isVerified: true,
                studentProfile: { rollNumber: 'CE2021033', department: 'Civil Engineering', batch: '2025', cgpa: 7.5, phone: '9876543216', skills: ['Staad Pro', 'Surveying', 'Project Management'], tenthPercentage: 82, twelfthPercentage: 80, gender: 'Male' }
            }
        ]);
        console.log('Students created');

        // Create Recruiters
        const recruiters = await User.create([
            {
                name: 'HR Manager - TechCorp', email: 'recruiter@techcorp.com', password: DEMO_PASSWORD, role: 'recruiter', isVerified: true,
                recruiterProfile: { company: 'TechCorp Solutions', designation: 'HR Manager', phone: '9876543220', companyWebsite: 'https://techcorp.com', industry: 'Information Technology' }
            },
            {
                name: 'Sarah Wilson - InnovateTech', email: 'sarah@innovatetech.com', password: DEMO_PASSWORD, role: 'recruiter', isVerified: true,
                recruiterProfile: { company: 'InnovateTech Inc', designation: 'Talent Acquisition Lead', phone: '9876543221', companyWebsite: 'https://innovatetech.com', industry: 'Software Development' }
            },
            {
                name: 'Deepak Raj - GlobalSystems', email: 'deepak@globalsystems.com', password: DEMO_PASSWORD, role: 'recruiter', isVerified: true,
                recruiterProfile: { company: 'Global Systems', designation: 'Recruitment Lead', phone: '9876543222', companyWebsite: 'https://globalsystems.com', industry: 'Consulting' }
            }
        ]);
        console.log('Recruiters created');

        // Create Jobs
        const jobs = await Job.create([
            {
                title: 'Software Development Engineer', company: 'TechCorp Solutions', description: 'Join our core engineering team.', location: 'Bangalore', type: 'Full-time', salary: '12-18 LPA', openings: 5, deadline: new Date('2025-06-30'),
                eligibility: { minCGPA: 7.0, branches: ['Computer Science', 'Information Technology'], skills: ['JavaScript', 'React'], batch: '2025' },
                postedBy: recruiters[0]._id, status: 'approved', isActive: true
            },
            {
                title: 'Machine Learning Engineer', company: 'TechCorp Solutions', description: 'Work on our AI platform.', location: 'Hyderabad', type: 'Full-time', salary: '15-22 LPA', openings: 2, deadline: new Date('2025-07-15'),
                eligibility: { minCGPA: 8.5, branches: ['Computer Science'], skills: ['Python', 'TensorFlow'], batch: '2025' },
                postedBy: recruiters[0]._id, status: 'approved', isActive: true
            },
            {
                title: 'Frontend Intern', company: 'InnovateTech Inc', description: 'Help us build beautiful UIs.', location: 'Remote', type: 'Internship', salary: '30,000/month', openings: 8, deadline: new Date('2025-05-31'),
                eligibility: { minCGPA: 6.5, branches: ['Computer Science', 'Information Technology'], skills: ['HTML', 'CSS', 'React'], batch: '2025' },
                postedBy: recruiters[1]._id, status: 'approved', isActive: true
            },
            {
                title: 'Cybersecurity Analyst', company: 'Global Systems', description: 'Join our security operations center.', location: 'Delhi NCR', type: 'Full-time', salary: '10-14 LPA', openings: 4, deadline: new Date('2025-08-20'),
                eligibility: { minCGPA: 7.5, branches: ['Computer Science', 'Information Technology'], skills: ['Networking', 'Linux'], batch: '2025' },
                postedBy: recruiters[2]._id, status: 'approved', isActive: true
            }
        ]);
        console.log('Jobs created');

        // Create Announcements
        await Announcement.create([
            { title: 'TCS Placement Drive', content: 'TCS will be visiting our campus on 15th March. Register soon!', priority: 'high', targetAudience: 'students', createdBy: admin._id },
            { title: 'Resume Workshop', content: 'A workshop on building ATS-friendly resumes will be held on Friday.', priority: 'medium', targetAudience: 'students', createdBy: admin._id },
            { title: 'New Recruiter Guidelines', content: 'Updated guidelines for recruiter registration are now available.', priority: 'low', targetAudience: 'recruiters', createdBy: admin._id }
        ]);
        console.log('Announcements created');

        // Create Placement Drives
        await PlacementDrive.create([
            {
                title: 'Annual Tech Hiring 2025', company: 'TechCorp Solutions', date: new Date('2025-03-20'), venue: 'Conference Hall A',
                description: 'Full-day hiring drive for multiple technical roles.',
                eligibility: { minCGPA: 7.0, branches: ['CS', 'IT', 'EC'], batch: '2025' },
                schedule: [{ time: '09:00 AM', activity: 'Pre-placement Talk' }, { time: '11:00 AM', activity: 'Aptitude Test' }],
                status: 'upcoming', createdBy: admin._id
            }
        ]);
        console.log('Placement Drives created');

        // Create Applications
        await Application.create([
            { job: jobs[0]._id, student: students[0]._id, status: 'shortlisted', coverLetter: 'I am a strong candidate for SDE role.' },
            { job: jobs[0]._id, student: students[3]._id, status: 'applied', coverLetter: 'Excited to apply for this position.' },
            { job: jobs[2]._id, student: students[0]._id, status: 'applied', coverLetter: 'Looking for an internship opportunity.' }
        ]);
        console.log('Applications created');

        // Create Mock Tests
        await MockTest.create([
            {
                title: 'General Aptitude Test 1', category: 'Aptitude', duration: 30, totalQuestions: 3,
                questions: [
                    { type: 'mcq', question: 'What is 2 + 2?', options: ['3', '4', '5'], correctAnswer: 1, points: 5 },
                    { type: 'mcq', question: 'Capitol of France?', options: ['London', 'Paris', 'Berlin'], correctAnswer: 1, points: 5 },
                    { type: 'coding', question: 'Write a function to add two numbers.', correctAnswer: 'function add(a, b) { return a + b; }', points: 10 }
                ],
                isPublished: true, createdBy: admin._id
            }
        ]);
        console.log('Mock Tests created');

        console.log('\n✅ Seed data created successfully!');
        process.exit(0);
    } catch (error) {
        console.error('Seed error:', error);
        process.exit(1);
    }
};

seedData();
