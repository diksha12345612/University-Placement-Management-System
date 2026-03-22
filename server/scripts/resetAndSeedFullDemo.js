const mongoose = require('mongoose');
const dotenv = require('dotenv');
const crypto = require('crypto');

dotenv.config();

const User = require('../models/User');
const Job = require('../models/Job');
const Application = require('../models/Application');
const Notification = require('../models/Notification');
const Announcement = require('../models/Announcement');
const PlacementDrive = require('../models/PlacementDrive');
const MockTest = require('../models/MockTest');
const MockTestAttempt = require('../models/MockTestAttempt');
const ResumeAnalysis = require('../models/ResumeAnalysis');
const RecommendationPlan = require('../models/RecommendationPlan');
const InterviewQuestion = require('../models/InterviewQuestion');
const InterviewEvaluation = require('../models/InterviewEvaluation');
const OTP = require('../models/OTP');

const MONGODB_URI = process.env.MONGODB_URI;
const DEMO_PASSWORD = process.env.DEMO_PASSWORD || crypto.randomBytes(8).toString('hex');

// Minimal valid dummy PDF that opens in browser viewers
const dummyPdfBase64 =
  'JVBERi0xLjcKMSAwIG9iago8PCAvVHlwZSAvQ2F0YWxvZyAvUGFnZXMgMiAwIFIgPj4KZW5kb2JqCjIgMCBvYmoKPDwgL1R5cGUgL1BhZ2VzIC9Db3VudCAxIC9LaWRzIFsgMyAwIFIgXSA+PgplbmRvYmoKMyAwIG9iago8PCAvVHlwZSAvUGFnZSAvUGFyZW50IDIgMCBSIC9NZWRpYUJveCBbMCAwIDU5NSA4NDJdIC9Db250ZW50cyA0IDAgUiAvUmVzb3VyY2VzIDw8IC9Gb250IDw8IC9GMSA1IDAgUiA+PiA+PiA+PgplbmRvYmoKNCAwIG9iago8PCAvTGVuZ3RoIDEwMyA+PgpzdHJlYW0KQlQKL0YxIDIwIFRmCjEwMCA3NTAgVGQKKERlbW8gUmVzdW1lKSBUagovRjEgMTIgVGYKMTAwIDcyNSBUZAooVGhpcyBpcyBhIHNlZWRlZCBkdW1teSByZXN1bWUgZm9yIHRlc3RpbmcuKSBUagpFVAplbmRzdHJlYW0KZW5kb2JqCjUgMCBvYmoKPDwgL1R5cGUgL0ZvbnQgL1N1YnR5cGUgL1R5cGUxIC9CYXNlRm9udCAvSGVsdmV0aWNhID4+CmVuZG9iagp4cmVmCjAgNgowMDAwMDAwMDAwIDY1NTM1IGYgCjAwMDAwMDAwMTUgMDAwMDAgbiAKMDAwMDAwMDA2NCAwMDAwMCBuIAowMDAwMDAwMTIxIDAwMDAwIG4gCjAwMDAwMDAyNjEgMDAwMDAgbiAKMDAwMDAwMDQxNCAwMDAwMCBuIAp0cmFpbGVyCjw8IC9Sb290IDEgMCBSIC9TaXplIDYgPj4Kc3RhcnR4cmVmCjUwMQolJUVPRgo=';

const recruitersSeed = [
  {
    name: 'Aditi Malhotra',
    email: 'aditi.hr@hireloop.demo',
    company: 'HireLoop Technologies',
    designation: 'Senior Talent Partner',
    phone: '9876500011',
    website: 'https://hireloop.demo',
    description: 'Product engineering company focused on SaaS and data platforms.',
    industry: 'Software Product'
  },
  {
    name: 'Rohan Verma',
    email: 'rohan.ta@nexora.demo',
    company: 'Nexora Systems',
    designation: 'Campus Hiring Lead',
    phone: '9876500012',
    website: 'https://nexora.demo',
    description: 'Cloud-native enterprise solutions and platform engineering.',
    industry: 'Cloud and Enterprise'
  },
  {
    name: 'Meera Iyer',
    email: 'meera.jobs@byteforge.demo',
    company: 'ByteForge Labs',
    designation: 'People Operations Manager',
    phone: '9876500013',
    website: 'https://byteforge.demo',
    description: 'AI tooling startup building automation solutions for business workflows.',
    industry: 'AI and Automation'
  },
  {
    name: 'Kunal Sinha',
    email: 'kunal.hiring@orbitworks.demo',
    company: 'OrbitWorks Digital',
    designation: 'Lead Recruiter',
    phone: '9876500014',
    website: 'https://orbitworks.demo',
    description: 'Digital consulting firm delivering full-stack products for global clients.',
    industry: 'IT Services and Consulting'
  }
];

const studentsSeed = [
  {
    name: 'Aarav Khanna',
    email: 'aarav.khanna@student.demo',
    rollNumber: 'CS2025-001',
    department: 'Computer Science',
    batch: '2025',
    cgpa: 8.9,
    phone: '9000000101',
    address: 'Sector 45, Gurgaon',
    gender: 'Male',
    tenth: 92,
    twelfth: 89,
    skills: ['JavaScript', 'TypeScript', 'React', 'Node.js', 'MongoDB', 'Docker'],
    linkedIn: 'https://linkedin.com/in/aaravkhanna',
    github: 'https://github.com/aaravkhanna',
    portfolio: 'https://aarav.dev',
    score: 82,
    placed: true,
    placedAt: 'HireLoop Technologies'
  },
  {
    name: 'Ishita Roy',
    email: 'ishita.roy@student.demo',
    rollNumber: 'IT2025-002',
    department: 'Information Technology',
    batch: '2025',
    cgpa: 9.1,
    phone: '9000000102',
    address: 'Salt Lake, Kolkata',
    gender: 'Female',
    tenth: 95,
    twelfth: 93,
    skills: ['Python', 'Django', 'PostgreSQL', 'AWS', 'REST APIs', 'CI/CD'],
    linkedIn: 'https://linkedin.com/in/ishitaroy',
    github: 'https://github.com/ishitaroy',
    portfolio: 'https://ishitaroy.dev',
    score: 86,
    placed: false,
    placedAt: ''
  },
  {
    name: 'Ritvik Sharma',
    email: 'ritvik.sharma@student.demo',
    rollNumber: 'CS2025-003',
    department: 'Computer Science',
    batch: '2025',
    cgpa: 8.3,
    phone: '9000000103',
    address: 'Vaishali, Ghaziabad',
    gender: 'Male',
    tenth: 90,
    twelfth: 87,
    skills: ['Java', 'Spring Boot', 'MySQL', 'Redis', 'Kafka'],
    linkedIn: 'https://linkedin.com/in/ritviksharma',
    github: 'https://github.com/ritviksharma',
    portfolio: 'https://ritvik.dev',
    score: 74,
    placed: false,
    placedAt: ''
  },
  {
    name: 'Sneha Menon',
    email: 'sneha.menon@student.demo',
    rollNumber: 'EC2025-004',
    department: 'Electronics',
    batch: '2025',
    cgpa: 8.6,
    phone: '9000000104',
    address: 'Indiranagar, Bengaluru',
    gender: 'Female',
    tenth: 91,
    twelfth: 90,
    skills: ['C++', 'Embedded C', 'IoT', 'Linux', 'Python'],
    linkedIn: 'https://linkedin.com/in/snehamenon',
    github: 'https://github.com/snehamenon',
    portfolio: 'https://snehamenon.dev',
    score: 71,
    placed: false,
    placedAt: ''
  },
  {
    name: 'Dev Patel',
    email: 'dev.patel@student.demo',
    rollNumber: 'CS2025-005',
    department: 'Computer Science',
    batch: '2025',
    cgpa: 7.8,
    phone: '9000000105',
    address: 'Navrangpura, Ahmedabad',
    gender: 'Male',
    tenth: 86,
    twelfth: 84,
    skills: ['React', 'Next.js', 'Tailwind CSS', 'Node.js', 'Prisma'],
    linkedIn: 'https://linkedin.com/in/devpatel',
    github: 'https://github.com/devpatel',
    portfolio: 'https://devpatel.dev',
    score: 68,
    placed: false,
    placedAt: ''
  },
  {
    name: 'Ananya Das',
    email: 'ananya.das@student.demo',
    rollNumber: 'IT2025-006',
    department: 'Information Technology',
    batch: '2025',
    cgpa: 9.0,
    phone: '9000000106',
    address: 'Banjara Hills, Hyderabad',
    gender: 'Female',
    tenth: 94,
    twelfth: 92,
    skills: ['Data Structures', 'Python', 'Pandas', 'SQL', 'Power BI'],
    linkedIn: 'https://linkedin.com/in/ananyadas',
    github: 'https://github.com/ananyadas',
    portfolio: 'https://ananyadas.dev',
    score: 79,
    placed: true,
    placedAt: 'Nexora Systems'
  },
  {
    name: 'Yash Bhatia',
    email: 'yash.bhatia@student.demo',
    rollNumber: 'ME2025-007',
    department: 'Mechanical',
    batch: '2025',
    cgpa: 7.4,
    phone: '9000000107',
    address: 'Rohini, Delhi',
    gender: 'Male',
    tenth: 82,
    twelfth: 79,
    skills: ['AutoCAD', 'SolidWorks', 'MATLAB', 'Project Management'],
    linkedIn: 'https://linkedin.com/in/yashbhatia',
    github: 'https://github.com/yashbhatia',
    portfolio: 'https://yashbhatia.dev',
    score: 60,
    placed: false,
    placedAt: ''
  },
  {
    name: 'Naina Kapoor',
    email: 'naina.kapoor@student.demo',
    rollNumber: 'CS2025-008',
    department: 'Computer Science',
    batch: '2025',
    cgpa: 8.7,
    phone: '9000000108',
    address: 'Model Town, Ludhiana',
    gender: 'Female',
    tenth: 93,
    twelfth: 90,
    skills: ['JavaScript', 'React', 'Node.js', 'GraphQL', 'Testing'],
    linkedIn: 'https://linkedin.com/in/nainakapoor',
    github: 'https://github.com/nainakapoor',
    portfolio: 'https://nainakapoor.dev',
    score: 81,
    placed: false,
    placedAt: ''
  }
];

const jobsSeed = [
  {
    title: 'Frontend Developer',
    company: 'HireLoop Technologies',
    location: 'Bengaluru',
    type: 'Full-time',
    salary: '10-14 LPA',
    openings: 4,
    minCGPA: 7.0,
    branches: ['Computer Science', 'Information Technology'],
    skills: ['React', 'JavaScript', 'CSS'],
    deadlineOffsetDays: 28
  },
  {
    title: 'Backend Engineer',
    company: 'HireLoop Technologies',
    location: 'Pune',
    type: 'Full-time',
    salary: '12-16 LPA',
    openings: 3,
    minCGPA: 7.2,
    branches: ['Computer Science', 'Information Technology'],
    skills: ['Node.js', 'MongoDB', 'API Design'],
    deadlineOffsetDays: 35
  },
  {
    title: 'Data Analyst Intern',
    company: 'Nexora Systems',
    location: 'Hyderabad',
    type: 'Internship',
    salary: '35000/month',
    openings: 6,
    minCGPA: 7.0,
    branches: ['Computer Science', 'Information Technology', 'Electronics'],
    skills: ['Python', 'SQL', 'Analytics'],
    deadlineOffsetDays: 20
  },
  {
    title: 'SDE 1',
    company: 'Nexora Systems',
    location: 'Gurgaon',
    type: 'Full-time',
    salary: '14-20 LPA',
    openings: 5,
    minCGPA: 8.0,
    branches: ['Computer Science', 'Information Technology'],
    skills: ['Java', 'Spring Boot', 'System Design'],
    deadlineOffsetDays: 40
  },
  {
    title: 'AI Engineer',
    company: 'ByteForge Labs',
    location: 'Remote',
    type: 'Full-time',
    salary: '15-22 LPA',
    openings: 2,
    minCGPA: 8.2,
    branches: ['Computer Science', 'Information Technology'],
    skills: ['Python', 'Machine Learning', 'MLOps'],
    deadlineOffsetDays: 32
  },
  {
    title: 'QA Automation Engineer',
    company: 'OrbitWorks Digital',
    location: 'Noida',
    type: 'Full-time',
    salary: '8-12 LPA',
    openings: 4,
    minCGPA: 6.8,
    branches: ['Computer Science', 'Information Technology', 'Electronics'],
    skills: ['Selenium', 'API Testing', 'JavaScript'],
    deadlineOffsetDays: 25
  }
];

function makeResumeAnalysis(score, skills) {
  const technicalSkillsScore = Math.max(10, Math.min(20, Math.round((score * 0.22) / 1.0)));
  const projectsScore = Math.max(10, Math.min(20, Math.round((score * 0.20) / 1.0)));
  const experienceScore = Math.max(8, Math.min(20, Math.round((score * 0.18) / 1.0)));
  const atsScore = Math.max(8, Math.min(20, Math.round((score * 0.19) / 1.0)));
  const clarityScore = Math.max(8, Math.min(20, Math.round((score * 0.21) / 1.0)));

  const toGrade = (v) => {
    if (v >= 17) return 'A';
    if (v >= 14) return 'B';
    if (v >= 11) return 'C';
    if (v >= 8) return 'D';
    return 'F';
  };

  return {
    resumeScore: score,
    technicalSkillsScore,
    projectsScore,
    experienceScore,
    atsScore,
    clarityScore,
    criteriaBreakdown: {
      technicalSkills: { grade: toGrade(technicalSkillsScore), notes: `Skills section is relevant and includes ${skills.slice(0, 3).join(', ')}. Add one advanced framework to improve depth.` },
      projects: { grade: toGrade(projectsScore), notes: 'Projects show practical work. Add stronger quantified outcomes and production links.' },
      experience: { grade: toGrade(experienceScore), notes: 'Experience section is good for student level. Emphasize measurable impact in bullet points.' },
      ats: { grade: toGrade(atsScore), notes: 'Format is readable and ATS-friendly. Improve keyword distribution across bullets.' },
      clarity: { grade: toGrade(clarityScore), notes: 'Content is mostly clear and structured. Tighten wording and action verbs for better impact.' }
    },
    strengths: [
      'Clear role-aligned technical stack',
      'Consistent project and internship narrative',
      'Profile sections are complete and readable'
    ],
    weaknesses: [
      'Needs more quantified achievements in experience bullets',
      'Could improve keyword density in project descriptions'
    ],
    missingSkills: ['Cloud deployment', 'System design fundamentals'],
    suggestions: [
      'Add metrics to each major project (users, latency, or throughput)',
      'Include one deployed project URL and one architecture diagram link',
      'Align project bullets with target role keywords'
    ],
    score,
    missingKeywords: ['Cloud deployment', 'System design fundamentals'],
    improvements: [
      'Quantify impact',
      'Add deployment link',
      'Use stronger action verbs'
    ],
    lastAnalyzed: new Date()
  };
}

function makeRoadmap(targetRole) {
  return {
    targetRole,
    overallAssessment: `You have a solid baseline for ${targetRole}. Focus on depth in core tools, interview readiness, and stronger project impact narratives.`,
    skillGapAnalysis: ['System design fundamentals', 'Production-grade deployment practices'],
    prioritySkills: ['Problem solving under time constraints', 'Architecture communication', 'Debugging strategy'],
    roadmap: [
      {
        phase: 'Phase 1',
        title: 'Core Strengthening',
        duration: '2 weeks',
        focusArea: 'Role-specific fundamentals',
        topics: [{ name: 'Core CS revision', completed: false }, { name: 'Role-specific frameworks', completed: false }],
        tasks: [{ name: 'Solve 20 curated questions', completed: false }],
        strategy: 'Build daily momentum with short revision and practical implementation.'
      },
      {
        phase: 'Phase 2',
        title: 'Project Depth',
        duration: '3 weeks',
        focusArea: 'Portfolio quality',
        topics: [{ name: 'Project architecture', completed: false }, { name: 'Performance optimization', completed: false }],
        tasks: [{ name: 'Ship one production-ready project', completed: false }],
        strategy: 'Focus on measurable outcomes and deployment confidence.'
      },
      {
        phase: 'Phase 3',
        title: 'Interview Preparation',
        duration: '2 weeks',
        focusArea: 'Communication and problem solving',
        topics: [{ name: 'Behavioral answers', completed: false }, { name: 'Whiteboard explanations', completed: false }],
        tasks: [{ name: 'Complete 5 mock interviews', completed: false }],
        strategy: 'Practice concise explanations and evidence-backed answers.'
      }
    ],
    recommendedProjects: ['Real-time analytics dashboard', 'Role-based collaboration platform'],
    recommendedResources: ['LeetCode', 'System Design Primer', 'Official framework docs'],
    interviewPreparationTips: ['Use STAR method for behavioral questions', 'Discuss trade-offs clearly'],
    suggestedCompanies: ['HireLoop Technologies', 'Nexora Systems', 'ByteForge Labs'],
    recommendedTopics: ['Core CS revision', 'System design', 'Mock interviews'],
    skillsToImprove: ['System design fundamentals', 'Production-grade deployment practices'],
    studyPlan: ['Phase 1: Core Strengthening', 'Phase 2: Project Depth', 'Phase 3: Interview Preparation'],
    lastUpdated: new Date()
  };
}

async function seed() {
  if (!MONGODB_URI) {
    throw new Error('MONGODB_URI is not configured.');
  }

  await mongoose.connect(MONGODB_URI);
  console.log('Connected to MongoDB');

  console.log('Wiping existing data...');
  await Promise.all([
    Application.deleteMany({}),
    Job.deleteMany({}),
    Notification.deleteMany({}),
    Announcement.deleteMany({}),
    PlacementDrive.deleteMany({}),
    MockTest.deleteMany({}),
    MockTestAttempt.deleteMany({}),
    ResumeAnalysis.deleteMany({}),
    RecommendationPlan.deleteMany({}),
    InterviewQuestion.deleteMany({}),
    InterviewEvaluation.deleteMany({}),
    OTP.deleteMany({}),
    User.deleteMany({})
  ]);

  console.log('Creating admin account...');
  const admin = await User.create({
    name: 'Kriti Sharma',
    email: 'kumarmohit78774@gmail.com',
    password: DEMO_PASSWORD,
    role: 'admin',
    isVerified: true,
    isApprovedByAdmin: true
  });

  console.log('Creating recruiter accounts...');
  const recruiters = [];
  for (const r of recruitersSeed) {
    const recruiter = await User.create({
      name: r.name,
      email: r.email,
      password: DEMO_PASSWORD,
      role: 'recruiter',
      isVerified: true,
      isApprovedByAdmin: true,
      recruiterProfile: {
        company: r.company,
        designation: r.designation,
        phone: r.phone,
        companyWebsite: r.website,
        companyDescription: r.description,
        companyLogo: '',
        industry: r.industry
      }
    });
    recruiters.push(recruiter);
  }

  console.log('Creating student accounts with complete profiles and resumes...');
  const students = [];
  for (let i = 0; i < studentsSeed.length; i++) {
    const s = studentsSeed[i];
    const analysis = makeResumeAnalysis(s.score, s.skills);
    const recommendations = makeRoadmap(i % 2 === 0 ? 'Software Engineer' : 'Data Analyst');

    const student = new User({
      name: s.name,
      email: s.email,
      password: DEMO_PASSWORD,
      role: 'student',
      isVerified: true,
      studentProfile: {
        rollNumber: s.rollNumber,
        department: s.department,
        batch: s.batch,
        cgpa: s.cgpa,
        phone: s.phone,
        address: s.address,
        dob: new Date(2003, (i % 12), 10 + i),
        gender: s.gender,
        skills: s.skills,
        tenthPercentage: s.tenth,
        twelfthPercentage: s.twelfth,
        resumeBase64: dummyPdfBase64,
        resumeContentType: 'application/pdf',
        linkedIn: s.linkedIn,
        github: s.github,
        portfolio: s.portfolio,
        isPlaced: s.placed,
        placedAt: s.placedAt,
        aiResumeAnalysis: analysis,
        aiRecommendations: recommendations
      }
    });

    student.studentProfile.resumeUrl = `/api/students/resume/${student._id}`;
    await student.save();
    students.push(student);

    await ResumeAnalysis.create({
      studentId: student._id,
      resumeScore: analysis.resumeScore,
      technicalSkillsScore: analysis.technicalSkillsScore,
      projectsScore: analysis.projectsScore,
      experienceScore: analysis.experienceScore,
      atsScore: analysis.atsScore,
      clarityScore: analysis.clarityScore,
      strengths: analysis.strengths,
      weaknesses: analysis.weaknesses,
      missingSkills: analysis.missingSkills,
      suggestions: analysis.suggestions,
      createdAt: new Date()
    });

    await RecommendationPlan.create({
      studentId: student._id,
      targetRole: recommendations.targetRole,
      overallAssessment: recommendations.overallAssessment,
      skillGapAnalysis: recommendations.skillGapAnalysis,
      prioritySkills: recommendations.prioritySkills,
      roadmap: recommendations.roadmap,
      recommendedProjects: recommendations.recommendedProjects,
      recommendedResources: recommendations.recommendedResources,
      interviewPreparationTips: recommendations.interviewPreparationTips,
      suggestedCompanies: recommendations.suggestedCompanies,
      createdAt: new Date()
    });
  }

  console.log('Creating approved jobs...');
  const jobs = [];
  for (let i = 0; i < jobsSeed.length; i++) {
    const j = jobsSeed[i];
    const recruiter = recruiters[i % recruiters.length];
    const job = await Job.create({
      title: j.title,
      company: j.company,
      description: `${j.title} role at ${j.company}. Build real-world products, collaborate with experienced teams, and deliver measurable impact.`,
      location: j.location,
      type: j.type,
      salary: j.salary,
      openings: j.openings,
      deadline: new Date(Date.now() + j.deadlineOffsetDays * 24 * 60 * 60 * 1000),
      eligibility: {
        minCGPA: j.minCGPA,
        branches: j.branches,
        skills: j.skills,
        batch: '2025'
      },
      requirements: ['Strong communication', 'Problem solving', 'Team collaboration'],
      responsibilities: ['Feature delivery', 'Code reviews', 'Testing and quality improvements'],
      perks: ['Flexible hours', 'Mentorship', 'Learning stipend'],
      postedBy: recruiter._id,
      status: 'approved',
      isActive: true
    });
    jobs.push(job);
  }

  console.log('Creating application history with mixed outcomes...');
  const statuses = ['applied', 'shortlisted', 'interview', 'selected', 'rejected'];
  let createdApplications = 0;

  for (let i = 0; i < students.length; i++) {
    const student = students[i];
    for (let k = 0; k < 3; k++) {
      const job = jobs[(i + k) % jobs.length];
      const status = statuses[(i + k) % statuses.length];

      await Application.create({
        job: job._id,
        student: student._id,
        status,
        coverLetter: `I am excited to apply for ${job.title} at ${job.company}. My profile aligns strongly with your requirements and I am ready to contribute from day one.`,
        resumeUrl: student.studentProfile.resumeUrl,
        notes: status === 'selected' ? 'Offer released' : '',
        aiEvaluation: {
          matchScore: status === 'selected' ? 89 : status === 'shortlisted' ? 78 : status === 'interview' ? 72 : status === 'applied' ? 66 : 49,
          skillMatchScore: status === 'selected' ? 90 : 76,
          experienceMatchScore: status === 'selected' ? 84 : 68,
          matchPercentage: status === 'selected' ? 89 : status === 'shortlisted' ? 78 : status === 'interview' ? 72 : status === 'applied' ? 66 : 49,
          strengthSummary: 'Good technical fit with relevant coursework and projects.',
          riskFactors: ['Needs deeper system design discussion for senior interviews'],
          recommendation: status === 'selected' || status === 'shortlisted' ? 'Strong' : status === 'interview' || status === 'applied' ? 'Moderate' : 'Weak',
          lastEvaluated: new Date()
        }
      });
      createdApplications += 1;

      if (status === 'selected') {
        await User.findByIdAndUpdate(student._id, {
          'studentProfile.isPlaced': true,
          'studentProfile.placedAt': job.company
        });
      }
    }
  }

  console.log('Creating notifications, announcements and drives...');
  const notifications = [];
  students.slice(0, 5).forEach((student, idx) => {
    notifications.push({
      user: student._id,
      title: 'Application Status Updated',
      message: `Your application for ${jobs[idx % jobs.length].title} has moved to ${statuses[(idx + 1) % statuses.length]}.`,
      type: 'application',
      link: '/student/applications',
      isRead: idx % 2 === 0
    });
  });

  recruiters.forEach((recruiter) => {
    notifications.push({
      user: recruiter._id,
      title: 'New Applications Received',
      message: 'You have new student applications awaiting review.',
      type: 'info',
      link: '/recruiter/applications'
    });
  });

  notifications.push({
    user: admin._id,
    title: 'Demo Data Seed Complete',
    message: 'All demo users, jobs and applications were seeded successfully.',
    type: 'success',
    link: '/admin/dashboard'
  });

  await Notification.insertMany(notifications);

  await Announcement.insertMany([
    {
      title: 'Campus Placement Week',
      content: 'Placement Week starts Monday. Students should keep resumes updated and track announcements daily.',
      priority: 'high',
      targetAudience: 'students',
      createdBy: admin._id,
      isActive: true
    },
    {
      title: 'Recruiter Coordination Desk',
      content: 'Recruiters can use the coordination desk for interview slot planning and candidate updates.',
      priority: 'medium',
      targetAudience: 'recruiters',
      createdBy: admin._id,
      isActive: true
    }
  ]);

  await PlacementDrive.insertMany([
    {
      title: 'Product Engineering Drive',
      company: 'HireLoop Technologies',
      date: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      venue: 'Main Auditorium',
      description: 'Aptitude screening, technical round and HR discussion for product roles.',
      eligibility: { minCGPA: 7.0, branches: ['Computer Science', 'Information Technology'], batch: '2025' },
      schedule: [
        { time: '09:30 AM', activity: 'Pre-placement talk' },
        { time: '11:00 AM', activity: 'Online assessment' },
        { time: '02:00 PM', activity: 'Technical interviews' }
      ],
      status: 'upcoming',
      createdBy: admin._id
    }
  ]);

  await MockTest.insertMany([
    {
      title: 'Aptitude Mega Test',
      category: 'Aptitude',
      duration: 45,
      totalQuestions: 3,
      questions: [
        { type: 'mcq', question: 'If a train covers 120 km in 2 hours, what is speed?', options: ['40', '50', '60', '70'], correctAnswer: '60', explanation: 'Speed = distance/time', points: 5 },
        { type: 'mcq', question: 'What is 25% of 240?', options: ['40', '50', '60', '70'], correctAnswer: '60', explanation: '0.25 x 240', points: 5 },
        { type: 'subjective', question: 'Explain how you approach time management in competitive tests.', correctAnswer: 'Discuss prioritization, elimination and checkpoint strategy.', explanation: 'A structured approach improves consistency.', points: 10 }
      ],
      isPublished: true,
      createdBy: admin._id
    }
  ]);

  const counts = {
    users: await User.countDocuments(),
    students: await User.countDocuments({ role: 'student' }),
    recruiters: await User.countDocuments({ role: 'recruiter' }),
    admins: await User.countDocuments({ role: 'admin' }),
    jobs: await Job.countDocuments(),
    applications: await Application.countDocuments(),
    notifications: await Notification.countDocuments()
  };

  console.log('Seed complete.');
  console.log(counts);
  console.log('Admin login email: kumarmohit78774@gmail.com');
  console.log('Admin login password:', DEMO_PASSWORD);

  await mongoose.disconnect();
}

seed()
  .then(() => process.exit(0))
  .catch(async (err) => {
    console.error('Seed failed:', err.message);
    await mongoose.disconnect().catch(() => {});
    process.exit(1);
  });
