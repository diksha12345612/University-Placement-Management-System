const express = require('express');
const router = express.Router();
const { auth } = require('../middleware/auth');
const User = require('../models/User');
const Application = require('../models/Application');
const { callAI } = require('../services/aiService');

router.post('/chat', auth, async (req, res) => {
    try {
        const { message, chatHistory = [] } = req.body;

        if (!message) {
            return res.status(400).json({ error: 'Message is required' });
        }

        const user = await User.findById(req.user._id);
        if (!user) {
            return res.status(404).json({ error: 'User not found' });
        }

        let systemContext = '';

        // 1. Context Injection for Students
        if (user.role === 'student') {
            const profile = user.studentProfile || {};
            const analytics = profile.analyticsData || {};
            
            // Format their goals
            const goals = analytics.careerGoals || {};
            const targetRoles = (goals.targetRoles || []).join(', ') || 'Not specified';
            
            // Format performance
            const performance = analytics.performanceMetrics || {};
            const overallScore = performance.overallReadinessScore || 0;
            const mockInterviewsAverage = performance.mockInterviewsAverage || 0;
            
            const proficiencies = (performance.topicProficiencies || [])
                .map(t => `${t.topic} (${t.score}%)`)
                .join(', ') || 'No topics tested yet';

            // Format behavioral
            const behavior = analytics.behavioralData || {};
            const applicationsCount = behavior.jobsAppliedCount || 0;
            const shortlistsCount = behavior.shortlistCount || 0;
            const successRate = behavior.applicationSuccessRate || 0;

            const skills = (profile.skills || []).join(', ') || 'No skills listed';
            
            // Format Resume Data
            const aiResumeAnalysis = profile.aiResumeAnalysis || {};
            const resumeScore = aiResumeAnalysis.resumeScore || aiResumeAnalysis.score || 'Not evaluated yet';
            const atsScore = aiResumeAnalysis.atsScore || 'Not evaluated yet';

            // Format Applied Jobs List
            const applications = await Application.find({ student: user._id }).populate('job', 'title company').lean();
            const appliedJobsList = applications.length > 0 
                ? applications.map(app => `- ${app.job?.title || 'Unknown Role'} at ${app.job?.company || 'Unknown Company'} (Status: ${app.status || 'Applied'})`).join('\n')
                : 'No job applications sent yet.';

            systemContext = `
You are the AI "Smart Placement Assistant" for a University Placement Portal. You are talking to a student named ${user.name}.
Your job is to provide extremely personalized, data-driven career advice and insights based on their exact analytics in the database.

STUDENT DATA CONTEXT:
- Target Roles: ${targetRoles}
- Current Skills: ${skills}
- AI Resume Score: ${resumeScore}/100
- ATS Compatibility Score: ${atsScore}/100
- Overall Readiness Score: ${overallScore}/100
- Topic Proficiencies: ${proficiencies}
- Mock Interview Average: ${mockInterviewsAverage}/100
- Total Applications Sent: ${applicationsCount}
- Total Shortlists: ${shortlistsCount} (Success Rate: ${successRate * 100}%)

RECENT APPLIED JOBS:
${appliedJobsList}

GUIDELINES:
1. Use the data above directly to answer their questions. If they ask "what should I improve", look at their lowest Topic Proficiency or Resume Score.
2. If they ask about applying to jobs, compare their Success Rate and suggest whether they need to upskill or fix their resume. If they ask for their jobs list, provide the list from recent applied jobs.
3. Be encouraging, concise, and professional. Use formatting (bullet points, bold) to make reading easy.
4. Do NOT mention "database", "analyticsData", or "system context". Just act as if you intelligently know their profile.
`;
        } 
        
        // 2. Context Injection for Admins
        else if (user.role === 'admin') {
            // Aggregation pipeline to get real-time insights
            const totalStudents = await User.countDocuments({ role: 'student' });
            const placedStudents = await User.countDocuments({ role: 'student', 'studentProfile.isPlaced': true });
            
            // Average scores across all students (from the analytics data we seeded)
            const stats = await User.aggregate([
                { $match: { role: 'student', 'studentProfile.analyticsData': { $exists: true } } },
                {
                    $group: {
                        _id: null,
                        avgReadiness: { $avg: '$studentProfile.analyticsData.performanceMetrics.overallReadinessScore' },
                        avgMockInterview: { $avg: '$studentProfile.analyticsData.performanceMetrics.mockInterviewsAverage' },
                        avgSuccessRate: { $avg: '$studentProfile.analyticsData.behavioralData.applicationSuccessRate' },
                        totalApps: { $sum: '$studentProfile.analyticsData.behavioralData.jobsAppliedCount' }
                    }
                }
            ]);

            const globalStats = stats[0] || { avgReadiness: 0, avgMockInterview: 0, avgSuccessRate: 0, totalApps: 0 };
            
            // Full Database Access: Iterate over all students to compile exhaustive details
            const allStudents = await User.find({ role: 'student' }).select('name email studentProfile').lean();
            
            let topicStats = {};
            let roleStats = {};

            const studentsList = allStudents.map(s => {
                const p = s.studentProfile || {};
                const m = p.analyticsData?.performanceMetrics || {};
                const g = p.analyticsData?.careerGoals || {};
                
                // Aggregate Topics
                if (m.topicProficiencies && Array.isArray(m.topicProficiencies)) {
                    m.topicProficiencies.forEach(t => {
                        if (!topicStats[t.topic]) topicStats[t.topic] = { totalScore: 0, count: 0 };
                        topicStats[t.topic].totalScore += t.score;
                        topicStats[t.topic].count += 1;
                    });
                }
                
                // Aggregate Target Roles
                if (g.targetRoles && Array.isArray(g.targetRoles)) {
                    g.targetRoles.forEach(role => {
                        roleStats[role] = (roleStats[role] || 0) + 1;
                    });
                }
                
                const rolesStr = (g.targetRoles || []).join(', ') || 'None';
                const topicsStr = (m.topicProficiencies || []).map(t => `${t.topic}(${t.score}%)`).join(', ') || 'None';

                return `Name: ${s.name} | Status: ${p.isPlaced ? 'Placed at ' + p.placedAt : 'Not Placed'} | Readiness: ${m.overallReadinessScore || 'N/A'}/100 | Roles Wanted: ${rolesStr} | Topic Scores: ${topicsStr}`;
            }).join('\n');

            // Format Topic Averages
            const avgTopics = Object.keys(topicStats).map(topic => {
                return `${topic}: ${Math.round(topicStats[topic].totalScore / topicStats[topic].count)}%`;
            }).join(', ');
            
            // Format Role Popularity
            const popularRoles = Object.keys(roleStats).map(role => {
                return `${role} (Wanted by ${roleStats[role]} students)`;
            }).join(', ');

            systemContext = `
You are the AI "Placement Director Assistant" for a University Placement Portal. You are talking to an Admin.
Your job is to provide factual, data-driven insights and directly answer questions about specific students in the university.

AGGREGATED ENTIRE UNIVERSITY DATABASE CONTEXT:
- Total Students Enrolled: ${totalStudents}
- Total Placed Students: ${placedStudents} / ${totalStudents}
- Average Student Readiness Score: ${Math.round(globalStats.avgReadiness)}/100
- Average Mock Interview Score: ${Math.round(globalStats.avgMockInterview)}/100
- Average Application Success (Shortlist) Rate: ${Math.round(globalStats.avgSuccessRate * 100)}%
- Total Global Job Applications Sent: ${globalStats.totalApps}

UNIVERSITY TOPICS PERFORMANCE (Average Scores):
${avgTopics || 'Not enough data yet'}

MOST WANTED JOB ROLES BY STUDENTS:
${popularRoles || 'Not enough data yet'}

COMPLETE LIST OF ALL STUDENTS IN DATABASE:
${studentsList}

GUIDELINES:
1. YOU NOW HAVE FULL ACCESS TO ALL STUDENT NAMES, STATUSES, TOPICS, AND ROLES.
2. If the admin asks "which topic students are weak the most", read the "UNIVERSITY TOPICS PERFORMANCE" above and explicitly state the topic with the lowest percentage.
3. If they ask "which tech job students want the most", read the "MOST WANTED JOB ROLES" and explicitly state the jobs with the highest counts.
4. If they ask about specific student names, read the "COMPLETE LIST OF ALL STUDENTS" and give them the exact names.
5. NEVER say "I don't have access to specific data." You absolutely have it in the text above. Read it and answer precisely.
6. Do NOT mention "database aggregation" or how you got the data. Act as a strategic advisor.
`;
        } else {
            return res.status(403).json({ error: 'AI Insights are currently available for students and admins only.' });
        }

        // 3. Format messages for OpenAI/OpenRouter
        const normalizedHistory = chatHistory.map(msg => ({
            role: msg.role === 'user' ? 'user' : 'assistant',
            content: msg.content
        }));

        const messages = [
            { role: 'system', content: systemContext },
            ...normalizedHistory,
            { role: 'user', content: message }
        ];

        // 4. Call the LLM
        const aiResponseText = await callAI(messages, 0, 1000); // 1000 max tokens

        res.json({ reply: aiResponseText });

    } catch (error) {
        console.error('Insights Chatbot Error:', error);
        res.status(500).json({ error: 'Failed to generate AI insight.' });
    }
});

module.exports = router;