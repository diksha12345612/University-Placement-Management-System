const express = require('express');
const mongoose = require('mongoose');
const router = express.Router();
const { auth } = require('../middleware/auth');
const InterviewQuestion = require('../models/InterviewQuestion');
const InterviewEvaluation = require('../models/InterviewEvaluation');
const MockTest = require('../models/MockTest');
const MockTestAttempt = require('../models/MockTestAttempt');
const {
    evaluateTestAnswer,
    generateMockTest,
    generateInterviewQuestions,
    evaluateInterviewAnswer,
    saveGeneratedQuestions,
    calculateTestDuration
} = require('../services/aiService');

// ─── Database Cleanup Migration ────────────────────────────────────────────
// This runs once to fix old tests without createdBy field
let migrationDone = false;
const cleanupOldTests = async () => {
    if (migrationDone) return;
    try {
        // Only hide AI-generated tests without a creator
        // Keep existing pre-loaded tests (like "Aptitude Mega Test") as published
        const updated = await MockTest.updateMany(
            { 
                category: 'AI Generated',
                createdBy: { $exists: false }
            },
            { $set: { isPublished: false } }
        );
        if (updated.modifiedCount > 0) {
            console.log(`[PREP MIGRATION] Updated ${updated.modifiedCount} AI-generated tests without creator to isPublished: false`);
        }
        migrationDone = true;
    } catch (err) {
        console.error('[PREP MIGRATION] Error cleaning up old tests:', err);
    }
};

// Run cleanup on first route access
cleanupOldTests();

// ─── Interview Preparation ──────────────────────────────────────────────────

router.get('/interview/questions', auth, async (req, res) => {
    try {
        const { role, count = 5, types = 'technical,behavioral,hr' } = req.query;
        if (!role) return res.status(400).json({ error: 'Role is required' });

        const questionCount = Math.min(5, Math.max(1, parseInt(count) || 5));
        const requestedTypes = types.split(',').map(t => t.trim().toLowerCase());

        // Always generate fresh questions with the AI
        const aiGenerated = await generateInterviewQuestions(role, questionCount, requestedTypes);

        const toSave = [];
        if (requestedTypes.includes('technical') && aiGenerated.technicalQuestions) {
            aiGenerated.technicalQuestions.forEach(q => toSave.push({ role, category: 'Technical', questionText: q, difficulty: 'Medium' }));
        }
        if (requestedTypes.includes('behavioral') && aiGenerated.behavioralQuestions) {
            aiGenerated.behavioralQuestions.forEach(q => toSave.push({ role, category: 'Behavioral', questionText: q, difficulty: 'Medium' }));
        }
        if (requestedTypes.includes('hr') && aiGenerated.hrQuestions) {
            aiGenerated.hrQuestions.forEach(q => toSave.push({ role, category: 'HR', questionText: q, difficulty: 'Easy' }));
        }

        const questions = await InterviewQuestion.insertMany(toSave);
        res.json(questions.slice(0, questionCount));
    } catch (err) {
        console.error('Interview questions error:', err);
        res.status(500).json({ error: 'Failed to generate interview questions' });
    }
});

router.post('/interview/evaluate', auth, async (req, res) => {
    try {
        const { questionId, studentAnswer } = req.body;
        if (!questionId) {
            return res.status(400).json({ error: 'questionId is required' });
        }

        if (!studentAnswer || !String(studentAnswer).trim()) {
            return res.status(400).json({ error: 'studentAnswer is required' });
        }

        const question = await InterviewQuestion.findById(questionId);
        if (!question) return res.status(404).json({ error: 'Question not found' });

        const evaluation = await evaluateInterviewAnswer(
            question.questionText,
            studentAnswer,
            question.category || 'Technical'
        );

        const asText = (value, fallback) => {
            if (Array.isArray(value)) return value.join('\n');
            if (value && typeof value === 'object') return JSON.stringify(value);
            const text = String(value || '').trim();
            return text || fallback;
        };

        const normalizedEvaluation = {
            ...evaluation,
            score: Math.min(10, Math.max(1, Number(evaluation?.score) || 5)),
            feedback: asText(evaluation?.feedback, 'Your answer was evaluated.'),
            sampleAnswer: asText(evaluation?.sampleAnswer, 'Please try again for a detailed model answer.'),
            strengths: asText(evaluation?.strengths, 'Answer addressed key parts of the question.'),
            weaknesses: asText(evaluation?.weaknesses, 'Add more specifics and examples to improve clarity.'),
            improvementTips: asText(evaluation?.improvementTips, 'Use a structured answer with concrete examples.'),
        };

        try {
            const record = new InterviewEvaluation({
                studentId: req.user.id,
                questionId,
                studentAnswer: String(studentAnswer),
                score: normalizedEvaluation.score,
                strengths: normalizedEvaluation.strengths,
                weaknesses: normalizedEvaluation.weaknesses,
                improvementTips: normalizedEvaluation.improvementTips,
                aiAnalysis: normalizedEvaluation
            });

            await record.save();
        } catch (saveErr) {
            console.error('Interview evaluation save warning:', saveErr.message);
        }

        // Always return evaluation even if persistence has an intermittent issue.
        res.json(normalizedEvaluation);
    } catch (err) {
        console.error('Interview evaluation error:', err);
        res.status(500).json({ error: 'Failed to evaluate interview answer' });
    }
});

// ─── AI Test Generator (Existing) ───────────────────────────────────────────

router.post('/generate-test', auth, async (req, res) => {
    try {
        const { topic, difficulty = 'Medium', count = 5, questionTypes = 'mix' } = req.body;
        if (!topic) return res.status(400).json({ error: 'Topic is required' });
        if (!['mcq', 'written', 'coding', 'mix'].includes(questionTypes)) {
            return res.status(400).json({ error: 'Invalid question type. Must be: mcq, written, coding, or mix' });
        }

        // Get userId as ObjectId for consistency
        const userId = req.user._id || req.user.id;
        const userObjectId = new mongoose.Types.ObjectId(userId);

        // Remove ALL previously generated AI tests for THIS STUDENT only (published or unpublished)
        await MockTest.deleteMany({ 
            category: 'AI Generated', 
            $or: [
                { createdBy: userObjectId },
                { createdBy: userId.toString() } // In case userId is stored as string
            ]
        });
        console.log(`[PREP] Cleared old AI-generated mock tests for student: ${userId}`);

        const questionCount = Math.min(10, Math.max(3, parseInt(count) || 5));
        // Pass userId to generateMockTest for student-specific deduplication
        const testData = await generateMockTest(topic, difficulty, questionCount, questionTypes, userId);

        const title = `${topic} — ${difficulty} (AI Generated)`;
        // Calculate duration based on question types
        const duration = calculateTestDuration(testData.questions);

        const newTest = new MockTest({
            title,
            category: 'AI Generated',
            duration,
            totalQuestions: testData.questions.length,
            questions: testData.questions,
            isPublished: false,
            createdBy: userObjectId
        });

        await newTest.save();
        console.log(`[PREP] Created new test for student ${userId}: ${newTest._id}`);

        // Save generated questions to QuestionBank with userId for isolation
        await saveGeneratedQuestions(topic, difficulty, testData.questions, newTest._id, userId);

        res.status(201).json(newTest);
    } catch (err) {
        console.error('AI Test Generation Error:', err);
        res.status(500).json({ error: 'Failed to generate AI test: ' + err.message });
    }
});

// ─── Mock Tests (Existing) ──────────────────────────────────────────────────

router.get('/mock-tests', auth, async (req, res) => {
    try {
        const userId = new mongoose.Types.ObjectId(req.user._id || req.user.id);
        // Show published tests + tests created by this student
        const tests = await MockTest.find({
            $or: [
                { isPublished: true },
                { createdBy: userId }
            ]
        }).select('-questions.correctAnswer');
        res.json(tests);
    } catch (err) {
        console.error('[PREP] GET mock-tests error:', err);
        res.status(500).json({ error: 'Failed to fetch mock tests: ' + err.message });
    }
});

router.get('/mock-tests/:id', auth, async (req, res) => {
    try {
        const userId = req.user._id || req.user.id; // Get MongoDB ObjectId
        const userObjectId = new mongoose.Types.ObjectId(userId);
        const test = await MockTest.findById(req.params.id);
        
        if (!test) return res.status(404).json({ error: 'Test not found' });
        
        // Check if student is the creator
        // Old tests might not have createdBy field - treat them as published
        const isCreator = test.createdBy && test.createdBy.equals(userObjectId);
        
        // Access logic:
        // - Creator can always access (published or not)
        // - Non-creators can only access if published
        // - If createdBy is undefined (old test), only allow if isPublished is true
        if (!isCreator) {
            const isPublished = test.isPublished === true;
            const hasNoCreator = !test.createdBy;
            const allowAccess = isPublished || (hasNoCreator && isPublished);
            
            if (!allowAccess) {
                return res.status(403).json({ error: 'Access denied: This test is not available to you' });
            }
        }
        
        // Convert to plain object and hide correct answers from non-creators
        const testObj = test.toObject();
        if (!isCreator && testObj.questions) {
            // Remove correct answers for non-creators
            testObj.questions = testObj.questions.map(q => {
                const questionCopy = { ...q };
                delete questionCopy.correctAnswer;
                return questionCopy;
            });
        }
        
        res.json(testObj);
    } catch (err) {
        console.error('[PREP] GET mock-test/:id error:', err);
        res.status(500).json({ error: 'Server error: ' + err.message });
    }
});

router.post('/mock-tests/:id/submit', auth, async (req, res) => {
    try {
        const userId = new mongoose.Types.ObjectId(req.user._id || req.user.id);
        const test = await MockTest.findById(req.params.id);
        if (!test) return res.status(404).json({ error: 'Test not found' });

        // ✅ PERMISSION CHECK: Student can only submit tests they created or published tests
        const isCreator = test.createdBy && test.createdBy.equals(userId);
        const isPublished = test.isPublished === true;
        
        if (!isCreator && !isPublished) {
            return res.status(403).json({ error: 'Access denied: You cannot submit this test' });
        }

        const { answers } = req.body;
        if (!answers || !Array.isArray(answers)) {
            return res.status(400).json({ error: 'Answers array is required' });
        }

        let totalScore = 0;
        const evaluationResults = [];

        for (let i = 0; i < test.questions.length; i++) {
            const q = test.questions[i];
            const studentAns = answers.find(a => a.questionIndex === i)?.answer;

            let result = {
                questionIndex: i,
                answer: studentAns || "",
                isCorrect: false,
                pointsAwarded: 0
            };

            if (studentAns === undefined || studentAns === null || (typeof studentAns === 'string' && studentAns.trim() === "")) {
                result.isCorrect = false;
                result.pointsAwarded = 0;
            } else if (q.type === 'mcq') {
                const isCorrect = studentAns === q.correctAnswer;
                result.isCorrect = isCorrect;
                result.pointsAwarded = isCorrect ? q.points : 0;
            } else {
                const aiEval = await evaluateTestAnswer(q.question, studentAns, q.correctAnswer);
                result.aiFeedback = {
                    accuracyScore: aiEval.accuracyScore,
                    conceptScore: aiEval.conceptScore,
                    clarityScore: aiEval.clarityScore,
                    totalScore: aiEval.totalScore,
                    strengths: aiEval.strengths,
                    weaknesses: aiEval.weaknesses,
                    improvementAdvice: aiEval.improvementAdvice,
                    score: Math.round((aiEval.totalScore / 15) * 10),
                    analysis: aiEval.strengths,
                    improvementSuggestion: aiEval.improvementAdvice
                };
                result.pointsAwarded = Math.round((aiEval.totalScore / 15) * q.points);
                result.isCorrect = aiEval.totalScore >= 10;
            }

            totalScore += result.pointsAwarded;
            evaluationResults.push(result);
        }

        const maxScore = test.questions.reduce((sum, q) => sum + q.points, 0);
        const percentage = Math.round((totalScore / maxScore) * 100);

        const attempt = new MockTestAttempt({
            student: req.user.id,
            test: test._id,
            answers: evaluationResults,
            totalScore,
            percentage,
            status: 'evaluated'
        });

        await attempt.save();

        res.json({
            id: attempt._id,
            testTitle: test.title,
            score: totalScore,
            maxScore,
            percentage,
            results: evaluationResults
        });
    } catch (err) {
        console.error('Submission Error:', err);
        res.status(500).json({ error: 'Failed to process submission' });
    }
});

module.exports = router;
