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
            const allStudents = await User.find({ role: 'student' }).select('-studentProfile.resumeBase64').lean();
            
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
                const backendUrl = process.env.VITE_API_URL || 'https://university-placement-management-system.onrender.com/api'; // Or just your full production URL! 
                const hasResume = (p.resumeUrl || p.resumeBase64) ? `Yes (Link: [View Resume](https://university-placement-management-system-phi.vercel.app/api/students/resume/${s._id}))` : 'No Resume';

                return `Name: ${s.name} | Status: ${p.isPlaced ? 'Placed at ' + p.placedAt : 'Not Placed'} | Readiness: ${m.overallReadinessScore || 'N/A'}/100 | Roles Wanted: ${rolesStr} | Topic Scores: ${topicsStr} | Resume: ${hasResume}`;
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
1. You have access to aggregate data above. If the admin asks "which topic students are weak the most" or "which tech job students want the most", answer directly using the aggregate context provided.
2. If the admin asks "show me the resume of [Student Name]", find the student in the COMPLETE LIST above and output their exact Markdown Resume Link (e.g. [View Resume](https://...)). Never say you cannot provide documents because you have the direct link above.
3. ⚠️ AUTONOMOUS DATABASE QUERY CAPABILITY ⚠️
If the admin asks to "list all jobs", "show me job postings", "find jobs", or "list unplaced students", YOU MUST TRIGGER A DATABASE QUERY.
To trigger a query, output EXACTLY THIS JSON FORMAT and NOTHING ELSE (no markdown, no backticks):
{"_query": true, "collection": "Job", "query": {}}

Available collections for queries:
- "Job": Use this for any question asking to list, show, or detail job postings.
  - Fields available for querying: isActive (boolean), status (string: 'pending', 'approved', 'rejected'), type (string: 'Full-time', 'Internship', etc.), company (string).
  - IMPORTANT: If they ask for jobs "waiting for approval", query for "status": "pending". If they ask for "approved jobs", query for "status": "approved".
- "Application": Use this to find who applied.
  - Fields: status (string: 'applied', 'shortlisted', 'interview', 'selected', 'rejected').
- "User": Use this to list students or find specific ones.

Example Scenario:
Admin: "list all job postings"
Your First Output: {"_query": true, "collection": "Job", "query": {}}

Admin: "give me jobs waiting for approvals"
Your First Output: {"_query": true, "collection": "Job", "query": {"status": "pending"}}

If a question can be answered by the aggregate stats, answer normally in text. IF IT REQUIRES LISTING JOBS/APPLICATIONS NOT SHOWN ABOVE, OUTPUT THE JSON QUERY.
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

        // 4. Call the LLM (First Pass)
        let aiResponseText = await callAI(messages, 0, 1000); // 1000 max tokens

        // 5. Handle agentic DB queries if triggered by the AI
        try {
            // If AI returned JSON proposing a query
            let cleanText = aiResponseText.replace(/```json/g, '').replace(/```/g, '').trim();
            
            // Extract JSON if it's mixed with text
            const firstBracket = cleanText.indexOf('{');
            const lastBracket = cleanText.lastIndexOf('}');
            
            if (firstBracket !== -1 && lastBracket !== -1 && cleanText.includes('"_query"')) {
                cleanText = cleanText.substring(firstBracket, lastBracket + 1);
            }

            if (cleanText.startsWith('{') && cleanText.includes('"_query"')) {
                const aiQuery = JSON.parse(cleanText);
                
                if (aiQuery.collection) {
                    console.log(`[AI] autonomous DB search on: ${aiQuery.collection}`, aiQuery.query);
                    let dbResults = [];

                    if (aiQuery.collection === 'Job') {
                        const Job = require('../models/Job');
                        dbResults = await Job.find(aiQuery.query || {}).select('title company type status openings location').limit(20).lean();
                    } else if (aiQuery.collection === 'Application') {
                        const Application = require('../models/Application');
                        dbResults = await Application.find(aiQuery.query || {}).populate('job', 'title company').limit(20).lean();
                    } else if (aiQuery.collection === 'User') {
                        dbResults = await User.find({ role: 'student', ...(typeof aiQuery.query === 'object' ? aiQuery.query : {}) }).select('name email studentProfile.isPlaced').limit(30).lean();
                    }
                    
                    console.log(`[AI] Auto query returned ${dbResults.length} records`);

                    // Inject the db results into the context and run AI AGAIN!
                    messages.push({ role: 'assistant', content: aiResponseText });
                    messages.push({ 
                        role: 'system', 
                        content: `Autonomous DB Engine returned these exact records:\n${JSON.stringify(dbResults)}\n\nRead this data PERFECTLY and generate a final human-readable response for the user. Summarize or list them gracefully. DO NOT OUTPUT JSON.` 
                    });

                    // Second Pass
                    const finalResponse = await callAI(messages, 0, 1500);
                    return res.json({ reply: finalResponse });
                }
            }
        } catch (err) {
            console.error('[AI] Autonomous query processing failed:', err);
            return res.json({ reply: "I attempted to fetch that data from the database, but encountered an error processing the results. " + (aiResponseText.includes('_query') ? '' : aiResponseText) });
        }

        res.json({ reply: aiResponseText });

    } catch (error) {
        console.error('Insights Chatbot Error:', error);
        res.status(500).json({ error: 'Failed to generate AI insight.' });
    }
});

module.exports = router;