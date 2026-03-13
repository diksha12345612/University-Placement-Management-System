const express = require('express');
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
    evaluateInterviewAnswer
} = require('../services/aiService');

// ─── Interview Preparation ──────────────────────────────────────────────────

router.get('/interview/questions', auth, async (req, res) => {
    try {
        const { role, count = 5, types = 'technical,behavioral,hr' } = req.query;
        if (!role) return res.status(400).json({ error: 'Role is required' });

        const questionCount = Math.min(15, Math.max(3, parseInt(count) || 5));
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
        const { topic, difficulty = 'Medium', count = 5 } = req.body;
        if (!topic) return res.status(400).json({ error: 'Topic is required' });

        const questionCount = Math.min(20, Math.max(3, parseInt(count) || 5));
        const testData = await generateMockTest(topic, difficulty, questionCount);

        const title = `${topic} — ${difficulty} (AI Generated)`;
        const duration = questionCount * 3;

        const newTest = new MockTest({
            title,
            category: 'AI Generated',
            duration,
            totalQuestions: testData.questions.length,
            questions: testData.questions,
            isPublished: true,
            createdBy: req.user.id
        });

        await newTest.save();
        res.status(201).json(newTest);
    } catch (err) {
        console.error('AI Test Generation Error:', err);
        res.status(500).json({ error: 'Failed to generate AI test: ' + err.message });
    }
});

// ─── Mock Tests (Existing) ──────────────────────────────────────────────────

router.get('/mock-tests', auth, async (req, res) => {
    try {
        const tests = await MockTest.find({ isPublished: true }).select('-questions.correctAnswer');
        res.json(tests);
    } catch (err) {
        res.status(500).json({ error: 'Failed to fetch mock tests' });
    }
});

router.get('/mock-tests/:id', auth, async (req, res) => {
    try {
        const test = await MockTest.findById(req.params.id).select('-questions.correctAnswer');
        if (!test) return res.status(404).json({ error: 'Test not found' });
        res.json(test);
    } catch (err) {
        res.status(500).json({ error: 'Server error' });
    }
});

router.post('/mock-tests/:id/submit', auth, async (req, res) => {
    try {
        const test = await MockTest.findById(req.params.id);
        if (!test) return res.status(404).json({ error: 'Test not found' });

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
