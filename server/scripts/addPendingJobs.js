const mongoose = require('mongoose');
const User = require('../models/User');
const Job = require('../models/Job');

async function run() {
  if (!process.env.MONGODB_URI) {
    throw new Error('MONGODB_URI is missing');
  }

  await mongoose.connect(process.env.MONGODB_URI);
  const recruiters = await User.find({ role: 'recruiter' }).limit(4);
  if (!recruiters.length) throw new Error('No recruiters found');

  const pendingJobs = [
    {
      title: 'Junior Full Stack Developer',
      company: recruiters[0].recruiterProfile?.company || 'HireLoop Technologies',
      description: 'Build and maintain web applications with React and Node.js in an agile product team.',
      location: 'Bengaluru',
      type: 'Full-time',
      salary: '8-11 LPA',
      openings: 3,
      deadline: new Date(Date.now() + 22 * 24 * 60 * 60 * 1000),
      eligibility: {
        minCGPA: 6.8,
        branches: ['Computer Science', 'Information Technology'],
        skills: ['React', 'Node.js', 'MongoDB'],
        batch: '2025'
      },
      requirements: ['Strong JavaScript fundamentals', 'REST API knowledge'],
      responsibilities: ['Develop reusable frontend components', 'Implement backend endpoints'],
      postedBy: recruiters[0]._id,
      status: 'pending',
      isActive: true
    },
    {
      title: 'Data Analyst Trainee',
      company: recruiters[1]?.recruiterProfile?.company || 'Nexora Systems',
      description: 'Analyze business datasets and build dashboards for product and operations teams.',
      location: 'Hyderabad',
      type: 'Full-time',
      salary: '6-9 LPA',
      openings: 4,
      deadline: new Date(Date.now() + 18 * 24 * 60 * 60 * 1000),
      eligibility: {
        minCGPA: 7.0,
        branches: ['Computer Science', 'Information Technology', 'Electronics'],
        skills: ['SQL', 'Python', 'Power BI'],
        batch: '2025'
      },
      requirements: ['Comfort with statistics basics', 'Good communication'],
      responsibilities: ['Prepare weekly KPI reports', 'Support ad hoc data requests'],
      postedBy: (recruiters[1] || recruiters[0])._id,
      status: 'pending',
      isActive: true
    },
    {
      title: 'QA Automation Intern',
      company: recruiters[2]?.recruiterProfile?.company || 'ByteForge Labs',
      description: 'Create API/UI automation suites and support release quality checks.',
      location: 'Noida',
      type: 'Internship',
      salary: '30000/month',
      openings: 5,
      deadline: new Date(Date.now() + 15 * 24 * 60 * 60 * 1000),
      eligibility: {
        minCGPA: 6.5,
        branches: ['Computer Science', 'Information Technology', 'Electronics'],
        skills: ['Selenium', 'Postman', 'JavaScript'],
        batch: '2025'
      },
      requirements: ['Testing fundamentals', 'Basic scripting'],
      responsibilities: ['Automate smoke tests', 'Log and track defects'],
      postedBy: (recruiters[2] || recruiters[0])._id,
      status: 'pending',
      isActive: true
    },
    {
      title: 'Cloud Support Engineer',
      company: recruiters[3]?.recruiterProfile?.company || 'OrbitWorks Digital',
      description: 'Work with cloud ops team on monitoring, deployment support, and incident triage.',
      location: 'Pune',
      type: 'Full-time',
      salary: '7-10 LPA',
      openings: 2,
      deadline: new Date(Date.now() + 27 * 24 * 60 * 60 * 1000),
      eligibility: {
        minCGPA: 7.0,
        branches: ['Computer Science', 'Information Technology', 'Electrical'],
        skills: ['Linux', 'Networking', 'AWS'],
        batch: '2025'
      },
      requirements: ['Basic cloud exposure', 'Problem solving under pressure'],
      responsibilities: ['Monitor cloud alerts', 'Assist with deployment pipelines'],
      postedBy: (recruiters[3] || recruiters[0])._id,
      status: 'pending',
      isActive: true
    }
  ];

  const created = await Job.insertMany(pendingJobs);
  const pendingCount = await Job.countDocuments({ status: 'pending' });

  console.log('Added pending jobs:', created.length);
  console.log('Total pending jobs now:', pendingCount);

  await mongoose.disconnect();
}

run().catch(async (err) => {
  console.error('Add pending jobs failed:', err.message);
  try { await mongoose.disconnect(); } catch {}
  process.exit(1);
});
