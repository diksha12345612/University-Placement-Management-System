const mongoose = require('mongoose');
const User = require('./models/User'); // Adjust path if needed
require('dotenv').config();

// Connect to MongoDB
mongoose.connect(process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/placement_portal')
  .then(() => console.log('Connected to MongoDB for Seeding Analytics Data'))
  .catch(err => console.error('MongoDB connection error:', err));

// Topics for random proficiency seeding
const topics = ['React', 'Node.js', 'System Design', 'Algorithms', 'Data Structures', 'Database Management', 'Frontend Prep', 'Backend Dev'];
const roles = ['Frontend Engineer', 'Backend Developer', 'Full Stack Developer', 'Data Scientist', 'DevOps Engineer'];
const locations = ['Bangalore', 'Remote', 'Pune', 'Hyderabad', 'Pune', 'Any'];
const workModes = ['Remote', 'On-site', 'Hybrid', 'Any'];

const seedAnalytics = async () => {
    try {
        console.log('Starting Analytics Seeding Process...');
        
        // Find all student users
        const students = await User.find({ role: 'student' });
        console.log(`Found ${students.length} students to process.`);

        for (let student of students) {
            // Generate some random metrics
            
            // Randomly select 2-4 topics
            const shuffledTopics = [...topics].sort(() => 0.5 - Math.random());
            const selectedTopics = shuffledTopics.slice(0, Math.floor(Math.random() * 3) + 2);
            
            // Assign random scores per topic
            let totalTopicScore = 0;
            const topicProficiencies = selectedTopics.map(topic => {
                const score = Math.floor(Math.random() * 50) + 40; // 40 - 90
                totalTopicScore += score;
                return {
                    topic,
                    score,
                    testsTaken: Math.floor(Math.random() * 5) + 1
                };
            });

            // Random averages
            const mockInterviewsAverage = Math.floor(Math.random() * 50) + 40; // 40 - 90
            const totalMockInterviews = Math.floor(Math.random() * 4) + 1;
            
            // Combine them for the overall metric
            const overallReadinessScore = Math.floor(
                ((totalTopicScore / selectedTopics.length) * 0.6) + 
                (mockInterviewsAverage * 0.4)
            );

            // Job applications count
            const jobsAppliedCount = Math.floor(Math.random() * 15) + 2;
            // Ensure shortlists are <= jobs applied
            const shortlistCount = Math.floor(Math.random() * (jobsAppliedCount * 0.4)); // ~40% max shortlist rate
            
            const applicationSuccessRate = (shortlistCount / jobsAppliedCount).toFixed(2);

            // Update student document
            student.studentProfile.analyticsData = {
                careerGoals: {
                    targetRoles: [[...roles].sort(() => 0.5 - Math.random())[0]],
                    preferredLocations: [[...locations].sort(() => 0.5 - Math.random())[0]],
                    expectedSalary: Math.floor(Math.random() * 1000000) + 500000, // 5L - 15L
                    preferredWorkMode: [...workModes].sort(() => 0.5 - Math.random())[0]
                },
                performanceMetrics: {
                    overallReadinessScore,
                    topicProficiencies,
                    mockInterviewsAverage,
                    totalMockInterviews
                },
                behavioralData: {
                    jobsAppliedCount,
                    shortlistCount,
                    applicationSuccessRate: Number(applicationSuccessRate),
                    lastActiveDate: new Date()
                }
            };

            await student.save({ validateBeforeSave: false }); // skip validations for speed testing
        }

        console.log(`✅ Successfully seeded analytics data for ${students.length} students!`);
        process.exit(0);

    } catch (error) {
        console.error('❌ Error during seeding:', error);
        process.exit(1);
    }
};

// Start seeding
seedAnalytics();