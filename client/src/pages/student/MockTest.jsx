import { useState, useEffect, useRef } from 'react';
import Layout from '../../components/Layout';
import { prepAPI } from '../../services/api';
import toast from 'react-hot-toast';

const DIFFICULTIES = ['Easy', 'Medium', 'Hard'];
const TOPICS = ['DSA', 'Aptitude', 'DBMS', 'Operating Systems', 'Web Development', 'System Design', 'Java OOP', 'Python', 'SQL'];

const ScoreBar = ({ label, score, max, color }) => (
    <div style={{ marginBottom: '0.5rem' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem', marginBottom: '2px' }}>
            <span style={{ color: 'var(--text-secondary)' }}>{label}</span>
            <span style={{ fontWeight: 700, color }}>{score}/{max}</span>
        </div>
        <div style={{ height: '6px', background: 'var(--bg-dark)', borderRadius: '99px', overflow: 'hidden' }}>
            <div style={{ height: '100%', width: `${(score / max) * 100}%`, background: color, borderRadius: '99px', transition: 'width 0.6s ease' }} />
        </div>
    </div>
);

const MockTest = () => {
    const [tests, setTests] = useState([]);
    const [activeTest, setActiveTest] = useState(null);
    const [answers, setAnswers] = useState({});
    const [results, setResults] = useState(null);
    const [submitting, setSubmitting] = useState(false);
    const [timeLeft, setTimeLeft] = useState(0);
    const [violations, setViolations] = useState(0);
    const [selectedTestId, setSelectedTestId] = useState(null);
    const [loading, setLoading] = useState(false);
    const testContainerRef = useRef(null);

    // AI Generator state
    const [generating, setGenerating] = useState(false);
    const [aiTopic, setAiTopic] = useState('');
    const [aiDifficulty, setAiDifficulty] = useState('Medium');
    const [aiCount, setAiCount] = useState(5);
    const [aiQuestionType, setAiQuestionType] = useState('mix');

    useEffect(() => {
        prepAPI.getMockTests()
            .then(res => setTests(res.data))
            .catch(() => toast.error('Failed to load tests'));
    }, []);

    // Timer & Proctoring
    useEffect(() => {
        if (!activeTest || results) return;

        const timer = setInterval(() => {
            setTimeLeft((t) => {
                if (t <= 1) { handleSubmit(); return 0; }
                return t - 1;
            });
        }, 1000);

        // Visibility Change (Tab switching)
        const handleVisibility = () => {
            if (document.hidden) {
                handleViolation('Tab switching or leaving the browser is not allowed!');
            }
        };

        // Fullscreen Change
        const handleFullscreen = () => {
            // Only warn if they exit FS WHILE a test is active and not submitted
            if (!document.fullscreenElement && activeTest && !results) {
                handleViolation('Exiting full-screen is not allowed during the test!');
            }
        };

        // Navigation Prevention
        const handleBeforeUnload = (e) => {
            if (activeTest && !results) {
                e.preventDefault();
                e.returnValue = '';
            }
        };

        document.addEventListener('visibilitychange', handleVisibility);
        document.addEventListener('fullscreenchange', handleFullscreen);
        window.addEventListener('beforeunload', handleBeforeUnload);

        return () => {
            clearInterval(timer);
            document.removeEventListener('visibilitychange', handleVisibility);
            document.removeEventListener('fullscreenchange', handleFullscreen);
            window.removeEventListener('beforeunload', handleBeforeUnload);
        };
    }, [activeTest, results, violations]);

    const handleViolation = (msg) => {
        setViolations(v => {
            const next = v + 1;
            if (next >= 3) {
                toast.error('Too many proctoring violations! Auto-submitting test...');
                handleSubmit();
            } else {
                toast.error(`${msg} (Warning ${next}/3)`);
                // Re-enter fullscreen if they left
                if (!document.fullscreenElement && testContainerRef.current) {
                    testContainerRef.current.requestFullscreen().catch(() => { });
                }
            }
            return next;
        });
    };

    const startTest = (testId) => {
        setSelectedTestId(testId);
    };

    const confirmStartTest = async () => {
        if (!selectedTestId) return;

        // 1. Trigger Fullscreen IMMEDIATELY (Synchronously) on the persistent container
        if (testContainerRef.current && testContainerRef.current.requestFullscreen) {
            try {
                await testContainerRef.current.requestFullscreen();
            } catch (err) {
                console.error('Fullscreen blocked:', err);
                return toast.error('Browser blocked full-screen. Please allow it to start the proctored test.');
            }
        }

        setLoading(true);
        // 2. Load Test Data (Asynchronously)
        try {
            const res = await prepAPI.getMockTestById(selectedTestId);
            setActiveTest(res.data);
            setAnswers({});
            setResults(null);
            setViolations(0);
            setTimeLeft(res.data.duration * 60);
            setSelectedTestId(null);
        } catch (err) {
            if (document.fullscreenElement) document.exitFullscreen().catch(() => { });
            toast.error('Failed to start test');
        } finally {
            setLoading(false);
        }
    };

    const handleSubmit = async () => {
        if (!activeTest || submitting) return;
        setSubmitting(true);

        // Exit Fullscreen on submit
        if (document.fullscreenElement) {
            document.exitFullscreen().catch(() => { });
        }

        try {
            const answerArray = activeTest.questions.map((_, i) => ({
                questionIndex: i,
                answer: answers[i] !== undefined ? String(answers[i]) : ""
            }));
            const res = await prepAPI.submitMockTest(activeTest._id, answerArray);
            setResults(res.data);
            toast.success('Test submitted successfully!');
        } catch (err) {
            toast.error('Failed to submit test');
        } finally {
            setSubmitting(false);
        }
    };

    const generateAITest = async (e) => {
        e.preventDefault();
        if (!aiTopic.trim()) return toast.error('Enter a topic');
        setGenerating(true);
        try {
            const res = await prepAPI.generateTest(aiTopic.trim(), aiDifficulty, aiCount, aiQuestionType);
            setTests([res.data, ...tests]);
            toast.success(`✨ AI Test Generated! (${res.data.questions?.length || aiCount} questions)`);
            startTest(res.data._id);
        } catch (err) {
            toast.error(err.response?.data?.error || 'Failed to generate test. Try another topic.');
        } finally {
            setGenerating(false);
        }
    };

    const formatTime = (s) => `${Math.floor(s / 60).toString().padStart(2, '0')}:${(s % 60).toString().padStart(2, '0')}`;

    const getRubricColor = (score, max) => {
        const pct = score / max;
        return pct >= 0.7 ? 'var(--success)' : pct >= 0.4 ? 'var(--warning)' : 'var(--danger)';
    };

    return (
        <Layout title={results ? "Test Results" : activeTest ? activeTest.title : "Mock Tests"}>
            <div
                ref={testContainerRef}
                className="mock-test-localized-container"
                style={{
                    minHeight: '80vh',
                    background: 'var(--bg-dark)',
                    borderRadius: '12px',
                    overflowY: 'auto',
                    padding: '1px', // Prevents margin collapse
                    position: 'relative'
                }}
            >

                {/* 1. Results View */}
                {results && (
                    <div className="fade-in p-2">
                        <div className="card" style={{ textAlign: 'center', marginBottom: '2rem' }}>
                            <h2>{results.testTitle}</h2>
                            <div style={{ fontSize: '3.5rem', fontWeight: 800, margin: '1rem 0', color: results.percentage >= 70 ? 'var(--success)' : results.percentage >= 40 ? 'var(--warning)' : 'var(--danger)' }}>
                                {results.percentage}%
                            </div>
                            <p style={{ color: 'var(--text-muted)' }}>Score: {results.score} / {results.maxScore}</p>
                            <div className="flex gap-2 justify-center mt-1">
                                <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                                    ✅ {results.results?.filter(r => r.isCorrect).length || 0} Correct &nbsp;|&nbsp;
                                    ❌ {results.results?.filter(r => !r.isCorrect).length || 0} Incorrect
                                </span>
                            </div>
                        </div>

                        <div className="results-container">
                            {results.results.map((r, i) => {
                                const q = activeTest?.questions[i];
                                if (!q) return null;
                                const hasRubric = r.aiFeedback?.accuracyScore !== undefined;
                                return (
                                    <div key={i} className="card mb-2" style={{ borderLeft: `4px solid ${r.isCorrect ? 'var(--success)' : 'var(--danger)'}` }}>
                                        <div className="flex justify-between items-start mb-1">
                                            <h4 style={{ margin: 0, flex: 1, paddingRight: '1rem' }}>Q{i + 1}: {q.question}</h4>
                                            <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', flexShrink: 0 }}>
                                                <span className={`badge badge-${q.type === 'mcq' ? 'primary' : q.type === 'coding' ? 'warning' : 'info'}`} style={{ fontSize: '0.65rem' }}>
                                                    {q.type?.toUpperCase()}
                                                </span>
                                                <span className={`badge badge-${r.isCorrect ? 'success' : 'danger'}`}>{Math.round(r.pointsAwarded || 0)} pts</span>
                                            </div>
                                        </div>

                                        <div className="p-1 mb-1" style={{ background: 'var(--bg-dark)', borderRadius: '6px', fontSize: '0.88rem' }}>
                                            <strong>Your Answer:</strong> {r.answer || <span style={{ color: 'var(--text-muted)' }}>(No response)</span>}
                                        </div>

                                        {q.type === 'mcq' && !r.isCorrect && q.explanation && (
                                            <div style={{ padding: '0.5rem 0.75rem', background: 'rgba(16,185,129,0.07)', borderRadius: '6px', borderLeft: '2px solid var(--success)', fontSize: '0.82rem', marginBottom: '0.5rem' }}>
                                                <strong style={{ color: 'var(--success)' }}>Explanation:</strong> {q.explanation}
                                            </div>
                                        )}

                                        {r.aiFeedback && (
                                            <div className="ai-feedback-box mt-1">
                                                <div style={{ color: 'var(--primary-light)', fontWeight: 700, fontSize: '0.78rem', marginBottom: '0.75rem', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                                                    ✨ AI EVALUATION
                                                    {hasRubric && <span style={{ marginLeft: '0.4rem', color: 'var(--text-muted)', fontWeight: 400 }}>Total: {r.aiFeedback.totalScore}/15</span>}
                                                </div>

                                                {hasRubric && (
                                                    <div style={{ marginBottom: '0.75rem' }}>
                                                        <ScoreBar label="Accuracy" score={r.aiFeedback.accuracyScore} max={5} color={getRubricColor(r.aiFeedback.accuracyScore, 5)} />
                                                        <ScoreBar label="Concept Understanding" score={r.aiFeedback.conceptScore} max={5} color={getRubricColor(r.aiFeedback.conceptScore, 5)} />
                                                        <ScoreBar label="Clarity" score={r.aiFeedback.clarityScore} max={5} color={getRubricColor(r.aiFeedback.clarityScore, 5)} />
                                                    </div>
                                                )}

                                                <p style={{ fontSize: '0.83rem', marginBottom: '0.4rem' }}>
                                                    <span style={{ color: 'var(--success)', fontWeight: 600 }}>✓ Strengths:</span> {r.aiFeedback.strengths || r.aiFeedback.analysis}
                                                </p>
                                                {r.aiFeedback.weaknesses && (
                                                    <p style={{ fontSize: '0.83rem', marginBottom: '0.4rem' }}>
                                                        <span style={{ color: 'var(--danger)', fontWeight: 600 }}>✗ Weaknesses:</span> {r.aiFeedback.weaknesses}
                                                    </p>
                                                )}
                                                {(r.aiFeedback.improvementAdvice || r.aiFeedback.improvementSuggestion) && (
                                                    <div style={{ padding: '0.6rem 0.75rem', background: 'rgba(99,102,241,0.08)', borderRadius: '6px', borderLeft: '2px solid var(--primary)' }}>
                                                        <p style={{ fontSize: '0.8rem', margin: 0 }}>
                                                            <strong>💡 Tip:</strong> {r.aiFeedback.improvementAdvice || r.aiFeedback.improvementSuggestion}
                                                        </p>
                                                    </div>
                                                )}
                                            </div>
                                        )}
                                    </div>
                                );
                            })}
                        </div>
                        <button className="btn btn-primary mt-2" onClick={() => { setActiveTest(null); setResults(null); }}>
                            ← Back to Tests
                        </button>
                    </div>
                )}

                {/* 2. Loading State (FS Placeholder) */}
                {loading && (
                    <div className="fade-in" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '80vh', color: 'white' }}>
                        <div style={{ width: '50px', height: '50px', border: '4px solid rgba(255,255,255,0.1)', borderTopColor: 'var(--primary)', borderRadius: '50%', animation: 'spin 1s linear infinite', marginBottom: '1.5rem' }}></div>
                        <h3>Initializing Secure Environment</h3>
                        <p style={{ color: 'var(--text-muted)' }}>Loading test questions and activating proctoring sensors...</p>
                        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
                    </div>
                )}

                {/* 3. Active Test View */}
                {activeTest && !results && !loading && (
                    <div className="fade-in p-2">
                        <div className="flex items-center justify-between mb-2 sticky-header" style={{ position: 'sticky', top: '0', zIndex: 10, background: 'var(--bg-dark)', padding: '1rem 0', borderBottom: '1px solid var(--border)' }}>
                            <div>
                                <h2 style={{ margin: 0 }}>{activeTest.title}</h2>
                                <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Progress: {Object.keys(answers).length} / {activeTest.questions.length}</p>
                            </div>
                            <div style={{ background: timeLeft < 60 ? 'var(--danger)' : 'var(--bg-card)', padding: '0.5rem 1rem', borderRadius: '8px', fontWeight: 700, fontSize: '1.2rem', boxShadow: '0 4px 12px rgba(0,0,0,0.2)' }}>
                                ⏱ {formatTime(timeLeft)}
                            </div>
                        </div>

                        <div className="questions-container" style={{ paddingBottom: '8rem' }}>
                            {activeTest.questions.map((q, qi) => (
                                <div key={qi} className="card mb-3">
                                    <div className="flex justify-between items-center mb-2">
                                        <h4 style={{ margin: 0 }}>Question {qi + 1}</h4>
                                        <div className="flex gap-1">
                                            <span className={`badge badge-${q.type === 'mcq' ? 'primary' : q.type === 'coding' ? 'warning' : 'info'}`}>{q.type?.toUpperCase()}</span>
                                            <span className="badge">{q.points || (q.type === 'mcq' ? 5 : q.type === 'coding' ? 15 : 10)} pts</span>
                                        </div>
                                    </div>
                                    <p style={{ fontSize: '1.05rem', marginBottom: '1.5rem' }}>{q.question}</p>
                                    {q.type === 'coding' && q.inputExample && (
                                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem', marginBottom: '1rem' }}>
                                            <div style={{ background: 'var(--bg-dark)', padding: '0.5rem 0.75rem', borderRadius: '6px', fontSize: '0.82rem' }}>
                                                <div style={{ color: 'var(--text-muted)', fontWeight: 600, marginBottom: '0.25rem' }}>INPUT EXAMPLE</div>
                                                <code>{q.inputExample}</code>
                                            </div>
                                            <div style={{ background: 'var(--bg-dark)', padding: '0.5rem 0.75rem', borderRadius: '6px', fontSize: '0.82rem' }}>
                                                <div style={{ color: 'var(--text-muted)', fontWeight: 600, marginBottom: '0.25rem' }}>OUTPUT EXAMPLE</div>
                                                <code>{q.outputExample}</code>
                                            </div>
                                        </div>
                                    )}

                                    {q.type === 'mcq' ? (
                                        <div className="test-options">
                                            {q.options?.map((opt, oi) => (
                                                <div key={oi} className={`test-option ${answers[qi] === opt ? 'selected' : ''}`} onClick={() => setAnswers({ ...answers, [qi]: opt })}>
                                                    <span className="radio-circle">{answers[qi] === opt && <span className="radio-inner" />}</span>
                                                    {opt}
                                                </div>
                                            ))}
                                        </div>
                                    ) : (
                                        <textarea
                                            className="form-control"
                                            rows={q.type === 'coding' ? 10 : 5}
                                            placeholder={q.type === 'coding' ? "// Write your code here..." : "Explain your answer in detail..."}
                                            value={answers[qi] || ""}
                                            onChange={(e) => setAnswers({ ...answers, [qi]: e.target.value })}
                                            style={{ fontFamily: q.type === 'coding' ? 'monospace' : 'inherit', fontSize: '0.95rem' }}
                                        />
                                    )}
                                </div>
                            ))}
                        </div>
                    </div>
                )}

                {activeTest && !results && !loading && (
                    <div className="test-footer" style={{ position: 'fixed', bottom: '1.5rem', left: '1.5rem', right: '1.5rem', padding: '1.5rem', background: 'var(--bg-card)', borderRadius: '16px', border: '1px solid var(--border)', display: 'flex', justifyContent: 'center', zIndex: 100, boxShadow: '0 -10px 40px rgba(0,0,0,0.3)' }}>
                        <button className="btn btn-primary btn-lg" onClick={handleSubmit} disabled={submitting} style={{ minWidth: '350px' }}>
                            {submitting ? '✨ Evaluating with AI...' : 'Submit Test'}
                        </button>
                    </div>
                )}

                {/* 4. Default Test List View */}
                {!activeTest && !results && !loading && (
                    <div className="fade-in p-2">
                        <div className="flex justify-between items-center mb-1">
                            <div>
                                <h2 className="gradient-text">Preparation Hub</h2>
                                <p style={{ color: 'var(--text-muted)' }}>Train with AI-integrated mock tests and coding challenges.</p>
                            </div>
                        </div>

                        <div className="card mb-3 ai-banner" style={{ border: '1px solid var(--primary-light)', background: 'rgba(99, 102, 241, 0.05)', overflow: 'hidden', padding: 0 }}>
                            <div style={{ display: 'flex', flexWrap: 'wrap' }}>
                                <div style={{ padding: '1.5rem', flex: '1 1 300px' }}>
                                    <h3 style={{ margin: 0, color: 'var(--primary-light)', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>✨ AI Test Generator</h3>
                                    <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', margin: '0.5rem 0 1rem' }}>Generate custom, balanced tests for any topic instantly.</p>
                                    <form onSubmit={generateAITest}>
                                        <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', marginBottom: '0.75rem' }}>
                                            <input type="text" className="form-control" placeholder="e.g. DSA, React, SQL..." value={aiTopic} onChange={(e) => setAiTopic(e.target.value)} disabled={generating} style={{ flex: '1 1 180px' }} list="ai-topics" />
                                            <datalist id="ai-topics">{TOPICS.map(t => <option key={t} value={t} />)}</datalist>
                                            <select className="form-control" value={aiDifficulty} onChange={(e) => setAiDifficulty(e.target.value)} disabled={generating} style={{ flex: '0 0 120px' }}>{DIFFICULTIES.map(d => <option key={d} value={d}>{d}</option>)}</select>
                                            <select className="form-control" value={aiCount} onChange={(e) => setAiCount(Number(e.target.value))} disabled={generating} style={{ flex: '0 0 100px' }}>
                                                {[3, 4, 5, 6, 7, 8, 9, 10].map(n => <option key={n} value={n}>{n} Qs</option>)}
                                            </select>
                                        </div>
                                        <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', marginBottom: '0.75rem', alignItems: 'center' }}>
                                            <label style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 0 }}>Question Type:</label>
                                            {['mcq', 'written', 'coding', 'mix'].map(type => (
                                                <button
                                                    key={type}
                                                    type="button"
                                                    disabled={generating}
                                                    onClick={() => setAiQuestionType(type)}
                                                    style={{
                                                        padding: '0.4rem 0.8rem',
                                                        borderRadius: '6px',
                                                        border: aiQuestionType === type ? '2px solid var(--primary)' : '1px solid var(--border)',
                                                        background: aiQuestionType === type ? 'rgba(99,102,241,0.1)' : 'transparent',
                                                        color: aiQuestionType === type ? 'var(--primary)' : 'var(--text-secondary)',
                                                        cursor: generating ? 'not-allowed' : 'pointer',
                                                        fontSize: '0.82rem',
                                                        fontWeight: 500,
                                                        transition: 'all 0.2s',
                                                        opacity: generating ? 0.5 : 1
                                                    }}
                                                >
                                                    {type === 'mcq' ? '⭕ MCQ' : type === 'written' ? '📝 Written' : type === 'coding' ? '💻 Coding' : '🔀 Mix'}
                                                </button>
                                            ))}
                                        </div>
                                        <button type="submit" className="btn btn-primary" disabled={generating || !aiTopic.trim()} style={{ width: '100%' }}>{generating ? '✨ Generating...' : `Generate ${aiDifficulty} Test →`}</button>
                                    </form>
                                </div>
                                <div style={{ flex: '0 0 100px', background: 'var(--primary-light)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '3rem', opacity: 0.08 }}>🤖</div>
                            </div>
                        </div>

                        <div className="prep-cards">
                            {tests.map((test) => (
                                <div key={test._id} className="prep-card">
                                    <div className="prep-card-content">
                                        <div className="icon">{test.category === 'Coding' ? '💻' : test.category === 'Aptitude' ? '🔢' : '📋'}</div>
                                        <h3>{test.title}</h3>
                                        <div className="badge mb-1">{test.category}</div>
                                        <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>{test.questions?.length} Questions • {test.duration} min</p>
                                    </div>
                                    <button className="btn btn-primary btn-sm mt-1" onClick={() => startTest(test._id)}>Start Test</button>
                                </div>
                            ))}
                        </div>
                    </div>
                )}
            </div>

            {/* 5. Start Confirmation Modal (Moved outside localized container) */}
            {selectedTestId && !loading && (
                <div 
                    className="modal-overlay" 
                    style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.85)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 2000, backdropFilter: 'blur(10px)' }}
                    onClick={() => setSelectedTestId(null)}
                >
                    <div 
                        className="card" 
                        style={{ maxWidth: '450px', width: '90%', textAlign: 'center', padding: '2.5rem', border: '1px solid var(--primary-light)', boxShadow: '0 20px 60px rgba(0,0,0,0.5)', background: 'var(--bg-card)', borderRadius: '16px' }}
                        onClick={(e) => e.stopPropagation()}
                    >
                        <div style={{ fontSize: '3.5rem', marginBottom: '1.5rem' }}>🛡️</div>
                        <h2 style={{ marginBottom: '1rem', fontSize: '1.5rem', fontWeight: 'bold' }}>Enter Proctoring Mode</h2>
                        <p style={{ color: 'var(--text-muted)', marginBottom: '2rem', lineHeight: '1.6' }}>The test will run in <strong>mandatory full-screen mode</strong>. Leaving or switching tabs will be recorded as a violation.</p>
                        <div className="flex gap-1">
                            <button className="btn btn-secondary" onClick={() => setSelectedTestId(null)} style={{ flex: 1 }}>Cancel</button>
                            <button className="btn btn-primary" onClick={confirmStartTest} style={{ flex: 2 }}>Confirm & Start</button>
                        </div>
                    </div>
                </div>
            )}
        </Layout>
    );
};

export default MockTest;
