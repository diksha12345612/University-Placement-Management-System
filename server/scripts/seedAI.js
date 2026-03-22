require('dotenv').config({ path: require('path').join(__dirname, '../.env') });
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const crypto = require('crypto');
const User = require('../models/User');
const Job = require('../models/Job');
const Application = require('../models/Application');
const MockTest = require('../models/MockTest');

const DEMO_PASSWORD = process.env.DEMO_PASSWORD || crypto.randomBytes(8).toString('hex');

const seedData = async () => {
    try {
        await mongoose.connect(process.env.MONGODB_URI);
        console.log('Connected to MongoDB for seeding AI data...');

        // Clear existing data (Optional - handle with care)
        // await User.deleteMany({ email: /@test.com/ });
        // await Job.deleteMany({ company: 'AI Innovations Inc.' });

        const salt = await bcrypt.genSalt(10);
        const hashedPassword = await bcrypt.hash('password123', salt);

        // 1. Create Recruiter
        await User.findOneAndUpdate(
            { email: 'recruiter@techcorp.com' },
            {
                name: 'TechCorp Recruiter',
                email: 'recruiter@techcorp.com',
                password: await bcrypt.hash('recruiter123', salt),
                role: 'recruiter',
                isVerified: true
            },
            { upsert: true, new: true }
        );
        console.log('Recruiter seeded');

        // 2. Create Admin
        await User.findOneAndUpdate(
            { email: 'mohittttttt48@gmail.com' },
            {
                name: 'Placement Officer',
                email: 'mohittttttt48@gmail.com',
                password: await bcrypt.hash('admin123', salt),
                role: 'admin',
                isVerified: true
            },
            { upsert: true, new: true }
        );
        console.log('Admin seeded');

        // 3. Create Students
        const studentData = [
            { name: 'Rahul Kumar', email: 'rahul@student.com', password: DEMO_PASSWORD, skills: ['React', 'Node.js', 'MongoDB', 'Python'], cgpa: 9.2 },
            { name: 'Priya Singh', email: 'priya@student.com', password: DEMO_PASSWORD, skills: ['UI/UX', 'Figma', 'CSS', 'HTML'], cgpa: 8.5 }
        ];

        const students = [];
        for (const s of studentData) {
            const student = await User.findOneAndUpdate(
                { email: s.email },
                {
                    name: s.name,
                    email: s.email,
                    password: await bcrypt.hash(s.password, salt),
                    role: 'student',
                    isVerified: true,
                    studentProfile: {
                        skills: s.skills,
                        cgpa: s.cgpa,
                        aiResumeAnalysis: {
                            score: 85,
                            summary: 'Strong technical profile with solid foundation in MERN stack.',
                            strengths: ['Frontend Development', 'JavaScript', 'Database Design'],
                            weaknesses: ['Cloud Infrastructure', 'Unit Testing'],
                            missingKeywords: ['Docker', 'AWS', 'Jest'],
                            improvements: ['Add projects related to cloud deployment', 'Include more specific metrics in your work experience']
                        },
                        aiRecommendations: {
                            improvementTips: [
                                'Focus on learning Docker and Kubernetes for modern backend development.',
                                'Strengthen your portfolio with a React Native project to show mobile versatility.',
                                'Prepare for system design interviews by focusing on scalability patterns.'
                            ],
                            suggestedRoadmap: ['Docker Mastery', 'System Design Basics', 'TypeScript Advanced', 'AWS Cloud Practitioner']
                        }
                    }
                },
                { upsert: true, new: true }
            );
            console.log(`Student ${s.name} seeded`);
            students.push(student);
        }

        // 3. Create a Job
        let job = await Job.findOne({ title: 'Full Stack Developer (AI Team)', company: 'AI Innovations Inc.' });
        if (!job) {
            job = await Job.create({
                title: 'Full Stack Developer (AI Team)',
                company: 'AI Innovations Inc.',
                description: 'We are looking for a developer skilled in React, Node.js, and MongoDB with an interest in AI integration.',
                requirements: ['3+ years experience in MERN stack', 'Knowledge of OpenAI API is a plus'],
                location: 'Remote',
                salary: '15-25 LPA',
                type: 'Full-time',
                postedBy: recruiter._id,
                status: 'approved',
                deadline: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)
            });
            console.log('Job created');
        }

        // 4. Create Applications
        for (const student of students) {
            const existingApp = await Application.findOne({ student: student._id, job: job._id });
            if (!existingApp) {
                await Application.create({
                    student: student._id,
                    job: job._id,
                    status: 'applied',
                    appliedAt: new Date()
                });
                console.log(`Application for ${student.name} created`);
            }
        }

        // 5. Create Mock Tests
        const mockTestData = [
            {
                title: 'Frontend Development Challenge',
                category: 'Coding',
                duration: 45,
                totalQuestions: 3,
                questions: [
                    {
                        question: 'Explain the Virtual DOM in React and why it is used.',
                        type: 'subjective',
                        correctAnswer: 'The Virtual DOM is a lightweight copy of the real DOM. React uses it to efficiently update UI by comparing changes and only re-rendering what is necessary.',
                        points: 10
                    },
                    {
                        question: 'Write a function to flatten a nested array in JavaScript.',
                        type: 'coding',
                        correctAnswer: 'function flatten(arr) { return arr.reduce((acc, val) => Array.isArray(val) ? acc.concat(flatten(val)) : acc.concat(val), []); }',
                        points: 20
                    },
                    {
                        question: 'Which Hook is used for side effects in React?',
                        type: 'mcq',
                        options: ['useState', 'useEffect', 'useMemo', 'useContext'],
                        correctAnswer: '1', // index 1
                        points: 5
                    }
                ]
            },
            {
                title: 'Aptitude & Logic Test',
                category: 'Aptitude',
                duration: 30,
                totalQuestions: 1,
                questions: [
                    {
                        question: 'If 3 people can build 3 houses in 3 days, how many days does it take 1 person to build 1 house?',
                        type: 'mcq',
                        options: ['1 day', '3 days', '9 days', 'None'],
                        correctAnswer: '1',
                        points: 10
                    }
                ]
            }
        ];

        for (const mt of mockTestData) {
            let test = await MockTest.findOne({ title: mt.title });
            if (!test) {
                await MockTest.create(mt);
                console.log(`Mock Test ${mt.title} created`);
            }
        }

        console.log('Seeding completed successfully!');
        process.exit(0);
    } catch (err) {
        console.error('Seeding failed:', err);
        process.exit(1);
    }
};

seedData();
