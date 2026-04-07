require('dotenv').config();
const mongoose = require('mongoose');
const User = require('./models/User'); 
const { callAI } = require('./services/aiService');

// Connect
mongoose.connect(process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/placement_portal')
  .then(() => console.log('Connected to MongoDB for Chatbot Test'))
  .catch(err => console.error('MongoDB connection error:', err));

const testChatbot = async () => {
    try {
        console.log('--- Testing RAG Chatbot as STUDENT ---');
        const student = await User.findOne({ role: 'student', 'studentProfile.analyticsData': { $exists: true } });
        
        if (!student) {
             console.log('No student found with analytics data.');
             return process.exit(1);
        }

        const profile = student.studentProfile;
        const analytics = profile.analyticsData || {};
        const goals = analytics.careerGoals || {};
        const targetRoles = (goals.targetRoles || []).join(', ') || 'Not specified';
        const performance = analytics.performanceMetrics || {};
        const proficiencies = (performance.topicProficiencies || [])
            .map(t => `${t.topic} (${t.score}%)`)
            .join(', ') || 'No topics tested yet';

        const systemContext = `
You are the AI "Smart Placement Assistant" for a University Placement Portal. You are talking to a student named ${student.name}.

STUDENT CONTEXT:
- Target Roles: ${targetRoles}
- Overall Readiness: ${performance.overallReadinessScore || 0}/100
- Topic Scores: ${proficiencies}
- Jobs Applied: ${analytics.behavioralData?.jobsAppliedCount || 0}
- Shortlists: ${analytics.behavioralData?.shortlistCount || 0}

GUIDELINES: Answer based strictly on this data. Do not mention the word "database". Be concise.
`;
        
        const message = "Based on my scores, what should I study this week to improve my chances?";
        console.log(`User Ask: "${message}"`);
        
        const messages = [
            { role: 'system', content: systemContext },
            { role: 'user', content: message }
        ];

        console.log('Calling AI API...');
        const reply = await callAI(messages, 0, 500);
        console.log(`\n🤖 Chatbot Reply:\n${reply}`);

        console.log('\n--- Testing RAG Chatbot as ADMIN ---');
        console.log('User Ask: "Give me an overview of how my students are doing in mock interviews."');
        
        const total = await User.countDocuments({ role: 'student' });
        const stats = await User.aggregate([
            { $match: { role: 'student', 'studentProfile.analyticsData': { $exists: true } } },
            { $group: { _id: null, avgMock: { $avg: '$studentProfile.analyticsData.performanceMetrics.mockInterviewsAverage' } } }
        ]);
        
        const adminSystemContext = `
You are an Admin Advisor. 
DATA: 
- Total Students: ${total}
- Average Mock Interview Score: ${stats[0]?.avgMock || 0}/100.
`;
        const adminReply = await callAI([
            { role: 'system', content: adminSystemContext },
            { role: 'user', content: 'Give me an overview of how my students are doing in mock interviews. Be concise.' }
        ], 0, 500);

        console.log(`\n🤖 Admin Chatbot Reply:\n${adminReply}`);
        
        process.exit(0);
    } catch (error) {
        console.error('Test Error:', error);
        process.exit(1);
    }
};

testChatbot();