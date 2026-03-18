import { useState, useEffect } from 'react';
import Layout from '../../components/Layout';
import { prepAPI } from '../../services/api';
import toast from 'react-hot-toast';
import Editor from '@monaco-editor/react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

const InterviewTips = () => {
    const [role, setRole] = useState('Software Engineer');
    const [questions, setQuestions] = useState([]);
    const [loading, setLoading] = useState(false);
    const [currentQuestionIndex, setCurrentQuestionIndex] = useState(null);
    const [answers, setAnswers] = useState({}); // format: { questionId: { plaintext: '...', javascript: '...' } }
    const [evaluating, setEvaluating] = useState(false);
    const [evaluation, setEvaluation] = useState(null);
    const [language, setLanguage] = useState('plaintext');
    const [questionCount, setQuestionCount] = useState(1);
    const [questionTypes, setQuestionTypes] = useState({ technical: true, behavioral: true, hr: true });

    const sampleTopics = {
        'Software Engineer': ['Data Structures & Algorithms', 'System Design', 'OOP Principles', 'REST APIs', 'Database Design', 'Concurrency'],
        'Frontend Developer': ['React/Vue Lifecycle', 'CSS Flexbox & Grid', 'Browser Rendering', 'State Management', 'Web Accessibility', 'Performance'],
        'Backend Developer': ['API Design', 'Database Indexing', 'Caching Strategies', 'Authentication/JWT', 'Microservices', 'Message Queues'],
        'Full Stack Developer': ['End-to-End Architecture', 'REST & GraphQL', 'CI/CD Pipelines', 'Docker/Containers', 'SSR vs CSR', 'WebSockets'],
        'Data Scientist': ['Statistical Analysis', 'Machine Learning Models', 'Feature Engineering', 'A/B Testing', 'SQL & Data Pipelines', 'Visualization'],
        'AI/ML Engineer': ['Neural Networks', 'NLP & Transformers', 'Model Training', 'MLOps & Deployment', 'Computer Vision', 'Reinforcement Learning'],
        'DevOps Engineer': ['CI/CD Automation', 'Kubernetes', 'Infrastructure as Code', 'Monitoring & Logging', 'Cloud Architecture', 'Security Practices'],
        'Product Manager': ['Product Strategy', 'User Research', 'Prioritization Frameworks', 'Metrics & KPIs', 'Go-to-Market Plans', 'Stakeholder Mgmt']
    };

    const toggleType = (type) => {
        setQuestionTypes(prev => {
            const updated = { ...prev, [type]: !prev[type] };
            if (!updated.technical && !updated.behavioral && !updated.hr) return prev;
            return updated;
        });
    };

    const activeQuestion = currentQuestionIndex !== null ? questions[currentQuestionIndex] : null;
    const activeQuestionKey = activeQuestion?._id || null;
    const activeAnswer = activeQuestionKey ? ((answers[activeQuestionKey] && answers[activeQuestionKey][language]) || '') : '';

    const generateQuestions = async () => {
        setLoading(true);
        setEvaluation(null);
        setCurrentQuestionIndex(null);
        setLanguage('plaintext');
        setAnswers({});
        try {
            const types = Object.entries(questionTypes).filter(([, v]) => v).map(([k]) => k);
            const res = await prepAPI.getInterviewQuestions(role, questionCount, types);
            setQuestions(res.data);
            if (res.data.length > 0) setCurrentQuestionIndex(0);
            toast.success(`${res.data.length} interview questions generated!`);
        } catch (err) {
            toast.error('Failed to generate questions. Try again.');
        } finally {
            setLoading(false);
        }
    };

    const submitAnswer = async () => {
        const activeCode = activeAnswer;
        if (!activeCode.trim()) return toast.error('Please provide an answer');
        setEvaluating(true);
        try {
            const currentQ = questions[currentQuestionIndex];
            const res = await prepAPI.evaluateInterviewAnswer({
                questionId: currentQ._id,
                studentAnswer: activeCode
            });
            setEvaluation(res.data || res); // Handle both wrapped and unwrapped data
            toast.success('Evaluation complete!');
        } catch (err) {
            toast.error(err.response?.data?.error || 'Evaluation failed. Please try again.');
        } finally {
            setEvaluating(false);
        }
    };

    const nextQuestion = () => {
        setEvaluation(null);
        setLanguage('plaintext'); // Defaulting back to plaintext for new questions
        setCurrentQuestionIndex(prev => prev + 1);
    };

    const endSession = () => {
        setQuestions([]);
        setCurrentQuestionIndex(null);
        setEvaluation(null);
        setLanguage('plaintext');
        setAnswers({});
    };

    const handleSkipQuestion = () => {
        if (evaluating) return;
        if (currentQuestionIndex < questions.length - 1) {
            nextQuestion();
            return;
        }
        endSession();
    };

    const clearCurrentAnswer = () => {
        if (!activeQuestionKey) return;
        setAnswers(prev => ({
            ...prev,
            [activeQuestionKey]: {
                ...(prev[activeQuestionKey] || {}),
                [language]: ''
            }
        }));
    };

    return (
        <Layout title="AI Interview Prep">
            <div className="fade-in" style={{ padding: '0.5rem 1rem', width: '100%', margin: '0 auto' }}>
                {!questions.length ? (
                    <div className="card text-center fade-in" style={{
                        margin: '1rem auto 3rem',
                        padding: '4rem 2rem',
                        borderRadius: '24px',
                        background: 'var(--bg-card)',
                        border: '1px solid var(--border)',
                        boxShadow: '0 20px 60px rgba(0, 0, 0, 0.08)',
                        width: '100%'
                    }}>
                        <div style={{
                            display: 'inline-flex',
                            padding: '1.5rem',
                            background: 'rgba(99, 102, 241, 0.1)',
                            borderRadius: '24px',
                            marginBottom: '1.5rem',
                            fontSize: '3.5rem',
                            color: 'var(--primary)',
                            boxShadow: '0 10px 25px rgba(99,102,241,0.2)'
                        }}>🎯</div>
                        <h2 style={{ fontSize: '2.5rem', fontWeight: 800, marginBottom: '1rem', color: 'var(--text-main)' }}>Simulation-Based AI Interview</h2>
                        <p style={{ color: 'var(--text-secondary)', fontSize: '1.1rem', marginBottom: '2.5rem', lineHeight: 1.7, maxWidth: '800px', margin: '0 auto 2.5rem auto' }}>
                            Master the art of technical interviews by practicing with our advanced AI. Receive instant, data-driven feedback on your content and delivery.
                        </p>

                        {/* Configuration Panel */}
                        <div style={{
                            margin: '0 auto',
                            textAlign: 'left',
                            background: 'var(--bg-dark)',
                            borderRadius: '20px',
                            padding: '2.5rem',
                            border: '1px solid var(--border)',
                            boxShadow: 'inset 0 2px 4px rgba(0,0,0,0.02)'
                        }}>
                            {/* Row 1: Role + Question Count */}
                            <div style={{ display: 'grid', gridTemplateColumns: '1.5fr 1fr', gap: '1.5rem', marginBottom: '1.5rem' }}>
                                <div>
                                    <label style={{ fontWeight: 800, color: 'var(--text-muted)', fontSize: '0.7rem', textTransform: 'uppercase', letterSpacing: '2px', display: 'block', marginBottom: '0.5rem' }}>Target Role</label>
                                    <select
                                        value={role}
                                        onChange={(e) => setRole(e.target.value)}
                                        style={{
                                            width: '100%',
                                            padding: '0.9rem 1.25rem',
                                            borderRadius: '14px',
                                            fontSize: '1rem',
                                            fontWeight: 700,
                                            border: '2px solid var(--border)',
                                            background: 'var(--bg-card)',
                                            cursor: 'pointer',
                                            boxShadow: '0 2px 4px rgba(0,0,0,0.05)'
                                        }}
                                    >
                                        <option>Software Engineer</option>
                                        <option>Frontend Developer</option>
                                        <option>Backend Developer</option>
                                        <option>Full Stack Developer</option>
                                        <option>Data Scientist</option>
                                        <option>AI/ML Engineer</option>
                                        <option>DevOps Engineer</option>
                                        <option>Product Manager</option>
                                    </select>
                                </div>
                                <div>
                                    <label style={{ fontWeight: 800, color: 'var(--text-muted)', fontSize: '0.7rem', textTransform: 'uppercase', letterSpacing: '2px', display: 'block', marginBottom: '0.5rem' }}>
                                        Questions: <span style={{ color: 'var(--primary)', fontSize: '1rem' }}>{questionCount}</span>
                                    </label>
                                    <input
                                        type="range"
                                        min="1"
                                        max="5"
                                        value={questionCount}
                                        onChange={(e) => setQuestionCount(Number(e.target.value))}
                                        style={{
                                            width: '100%',
                                            marginTop: '0.75rem',
                                            accentColor: 'var(--primary)',
                                            cursor: 'pointer',
                                            height: '6px'
                                        }}
                                    />
                                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.7rem', color: 'var(--text-muted)', marginTop: '0.25rem' }}>
                                        <span>3</span>
                                        <span>15</span>
                                    </div>
                                </div>
                            </div>

                            {/* Row 2: Question Types */}
                            <div style={{ marginBottom: '1.5rem' }}>
                                <label style={{ fontWeight: 800, color: 'var(--text-muted)', fontSize: '0.7rem', textTransform: 'uppercase', letterSpacing: '2px', display: 'block', marginBottom: '0.75rem' }}>Question Types</label>
                                <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
                                    {[
                                        { key: 'technical', label: '⚙️ Technical', color: '#6366f1' },
                                        { key: 'behavioral', label: '🧠 Behavioral', color: '#10b981' },
                                        { key: 'hr', label: '👔 HR / Culture Fit', color: '#f59e0b' }
                                    ].map(type => (
                                        <button
                                            key={type.key}
                                            onClick={() => toggleType(type.key)}
                                            style={{
                                                padding: '0.65rem 1.25rem',
                                                borderRadius: '12px',
                                                fontSize: '0.9rem',
                                                fontWeight: 700,
                                                border: `2px solid ${questionTypes[type.key] ? type.color : 'var(--border)'}`,
                                                background: questionTypes[type.key] ? `${type.color}15` : 'transparent',
                                                color: questionTypes[type.key] ? type.color : 'var(--text-muted)',
                                                cursor: 'pointer',
                                                transition: 'all 0.2s ease'
                                            }}
                                        >
                                            {type.label}
                                        </button>
                                    ))}
                                </div>
                            </div>

                            {/* Row 3: Sample Topics */}
                            <div style={{ marginBottom: '1.5rem' }}>
                                <label style={{ fontWeight: 800, color: 'var(--text-muted)', fontSize: '0.7rem', textTransform: 'uppercase', letterSpacing: '2px', display: 'block', marginBottom: '0.75rem' }}>
                                    Sample Topics for {role}
                                </label>
                                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
                                    {(sampleTopics[role] || []).map((topic, idx) => (
                                        <span key={idx} style={{
                                            padding: '0.4rem 0.9rem',
                                            borderRadius: '20px',
                                            fontSize: '0.8rem',
                                            fontWeight: 600,
                                            background: 'rgba(99, 102, 241, 0.08)',
                                            color: 'var(--primary)',
                                            border: '1px solid rgba(99, 102, 241, 0.15)'
                                        }}>
                                            {topic}
                                        </span>
                                    ))}
                                </div>
                            </div>

                            {/* Start Button */}
                            <button
                                onClick={generateQuestions}
                                className="btn btn-primary"
                                disabled={loading}
                                style={{
                                    width: '100%',
                                    padding: '1.1rem',
                                    fontWeight: 800,
                                    borderRadius: '16px',
                                    fontSize: '1.15rem',
                                    boxShadow: '0 10px 15px -3px rgba(99, 102, 241, 0.4)',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    gap: '0.5rem'
                                }}
                            >
                                {loading ? '⏳ Generating Questions...' : `🚀 Start Interview (${questionCount} Questions)`}
                            </button>
                        </div>

                        <div className="grid grid-3 gap-2 mt-4" style={{ textAlign: 'left' }}>
                            {[
                                { icon: '⚙️', title: 'Technical Depth', desc: 'Evaluate core coding & system concepts' },
                                { icon: '🚀', title: 'Behavioral Prep', desc: 'Refine your soft skills & confidence' },
                                { icon: '📈', title: 'Performance Stats', desc: 'Track scores across multiple sessions' }
                            ].map((item, idx) => (
                                <div key={idx} style={{ padding: '1.5rem', background: 'var(--bg-dark)', borderRadius: '20px', border: '1px solid rgba(255,255,255,0.03)' }}>
                                    <div style={{ fontSize: '1.8rem', marginBottom: '1rem' }}>{item.icon}</div>
                                    <strong style={{ display: 'block', fontSize: '1rem', marginBottom: '0.5rem', color: 'var(--text-main)' }}>{item.title}</strong>
                                    <p style={{ fontSize: '0.9rem', color: 'var(--text-muted)', margin: 0, lineHeight: 1.5 }}>{item.desc}</p>
                                </div>
                            ))}
                        </div>
                    </div>
                ) : (
                    <div className="interview-session fade-in">
                        <div className="flex justify-between items-center mb-15">
                            <div className="flex items-center gap-1.5">
                                <div style={{ background: 'var(--primary)', color: 'white', padding: '6px 14px', borderRadius: '12px', fontSize: '0.75rem', fontWeight: 800, textTransform: 'uppercase' }}>{role}</div>
                                <div style={{ background: 'var(--bg-dark)', color: 'var(--text-secondary)', padding: '6px 14px', borderRadius: '12px', fontSize: '0.75rem', fontWeight: 800, border: '1px solid var(--border)' }}>
                                    Progress: {currentQuestionIndex + 1} / {questions.length}
                                </div>
                            </div>
                            <button onClick={endSession} className="btn-text" style={{ color: 'var(--danger)', fontWeight: 700, opacity: 0.8 }}>End Session</button>
                        </div>

                        <div className="card mb-3" style={{
                            background: 'var(--bg-card)',
                            border: '1px solid var(--border)',
                            borderRadius: '24px',
                            padding: '3rem',
                            position: 'relative',
                            overflow: 'hidden',
                            boxShadow: '0 10px 15px -3px rgba(0,0,0,0.1)'
                        }}>
                            <div style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: '8px', background: 'var(--primary)' }}></div>
                            <div className="flex gap-1 mb-1.5">
                                <span style={{ fontSize: '0.8rem', fontWeight: 900, color: 'var(--primary)', textTransform: 'uppercase', letterSpacing: '1px' }}>
                                    {questions[currentQuestionIndex].type} Interview
                                </span>
                                <span style={{ color: 'var(--text-muted)', opacity: 0.5 }}>•</span>
                                <span style={{ color: 'var(--text-muted)', fontSize: '0.85rem', fontWeight: 600 }}>Level: {questions[currentQuestionIndex].difficulty}</span>
                            </div>
                            <div className="markdown-body" style={{ fontSize: '1.25rem', lineHeight: 1.5, margin: 0, color: 'var(--text-main)', fontWeight: 600, fontFamily: '"Inter", sans-serif' }}>
                                <ReactMarkdown remarkPlugins={[remarkGfm]}>
                                    {questions[currentQuestionIndex].questionText}
                                </ReactMarkdown>
                            </div>
                        </div>

                        <div className="grid-2-layout" style={{ display: 'grid', gridTemplateColumns: 'minmax(600px, 1.2fr) 1fr', gap: '3rem' }}>
                            <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
                                <div className="flex justify-between items-center mb-1">
                                    <h5 style={{ margin: 0, fontSize: '1rem', fontWeight: 800, color: 'var(--text-main)' }}>Your Response</h5>

                                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                        <label style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-muted)' }}>Respond in: </label>
                                        <select
                                            value={language}
                                            onChange={(e) => setLanguage(e.target.value)}
                                            style={{
                                                background: 'var(--bg-dark)',
                                                color: 'var(--text-main)',
                                                border: '1px solid var(--border)',
                                                padding: '4px 12px',
                                                borderRadius: '20px',
                                                fontSize: '0.75rem',
                                                fontWeight: 800,
                                                cursor: 'pointer',
                                                outline: 'none',
                                                fontFamily: '"Inter", sans-serif'
                                            }}
                                        >
                                            <option value="plaintext">Plain Text (Behavioral)</option>
                                            <option value="javascript">JavaScript (ES6+)</option>
                                            <option value="python">Python 3</option>
                                            <option value="java">Java 17</option>
                                            <option value="cpp">C++</option>
                                        </select>
                                    </div>
                                </div>
                                <div style={{
                                    flex: 1,
                                    minHeight: '600px',
                                    borderRadius: '24px',
                                    background: language === 'plaintext' ? 'var(--bg-card)' : '#1e1e1e',
                                    border: '2px solid var(--border)',
                                    overflow: 'hidden',
                                    display: 'flex',
                                    flexDirection: 'column',
                                    boxShadow: 'inset 0 4px 6px -1px rgba(0,0,0,0.05)',
                                    transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)'
                                }}>
                                    {language === 'plaintext' ? (
                                        <textarea
                                            value={activeAnswer}
                                            onChange={(e) => {
                                                const val = e.target.value;
                                                setAnswers(prev => ({
                                                    ...prev,
                                                    [activeQuestionKey]: {
                                                        ...(prev[activeQuestionKey] || {}),
                                                        [language]: val
                                                    }
                                                }));
                                            }}
                                            placeholder="Write your answer here. Use structure, bullet points, or the STAR-method for better AI analysis..."
                                            style={{
                                                flex: 1,
                                                width: '100%',
                                                padding: '1.5rem',
                                                fontSize: '1.1rem',
                                                lineHeight: 1.7,
                                                background: 'transparent',
                                                border: 'none',
                                                resize: 'none',
                                                outline: 'none',
                                                color: 'var(--text-main)',
                                                fontFamily: '"Inter", sans-serif'
                                            }}
                                        />
                                    ) : (
                                        <Editor
                                            height="100%"
                                            width="100%"
                                            language={language === 'csharp' ? 'csharp' : language === 'cpp' ? 'cpp' : language}
                                            theme="vs-dark"
                                            value={activeAnswer}
                                            onChange={(val) => {
                                                setAnswers(prev => ({
                                                    ...prev,
                                                    [activeQuestionKey]: {
                                                        ...(prev[activeQuestionKey] || {}),
                                                        [language]: val
                                                    }
                                                }));
                                            }}
                                            options={{
                                                minimap: { enabled: false },
                                                fontSize: 15,
                                                lineHeight: 26,
                                                fontFamily: '"JetBrains Mono", "Fira Code", monospace',
                                                scrollBeyondLastLine: false,
                                                roundedSelection: false,
                                                padding: { top: 16 }
                                            }}
                                        />
                                    )}
                                </div>
                                <div className="flex gap-1.5 mt-2">
                                    <button
                                        onClick={clearCurrentAnswer}
                                        disabled={evaluating || !activeAnswer.trim()}
                                        className="btn btn-secondary"
                                        style={{ padding: '1.25rem 1.4rem', fontWeight: 800, borderRadius: '18px', whiteSpace: 'nowrap' }}
                                    >
                                        Clear Answer
                                    </button>
                                    <button
                                        onClick={submitAnswer}
                                        disabled={evaluating || evaluation || !activeAnswer.trim()}
                                        className="btn btn-primary"
                                        style={{ flex: 1, padding: '1.25rem', fontWeight: 800, fontSize: '1.2rem', borderRadius: '18px', boxShadow: '0 10px 15px -3px rgba(99, 102, 241, 0.3)' }}
                                    >
                                        {evaluating ? 'Analyzing Presentation...' : 'Finalize & Submit'}
                                    </button>
                                    {!evaluation && (
                                        <button
                                            onClick={handleSkipQuestion}
                                            disabled={evaluating}
                                            className="btn btn-secondary"
                                            style={{ padding: '1.25rem 1.4rem', fontWeight: 800, borderRadius: '18px', whiteSpace: 'nowrap' }}
                                        >
                                            {currentQuestionIndex < questions.length - 1 ? 'Skip / Next Question' : 'Finish Interview'}
                                        </button>
                                    )}
                                </div>
                            </div>

                            <div className="evaluation-panel">
                                <h5 className="mb-1" style={{ fontSize: '1rem', fontWeight: 800, color: 'var(--text-main)' }}>AI Interview Coach</h5>
                                {!evaluation ? (
                                    <div className="card text-center p-4" style={{
                                        height: '100%',
                                        minHeight: '650px',
                                        borderRadius: '24px',
                                        border: '2px dashed var(--border)',
                                        background: 'transparent',
                                        display: 'flex',
                                        flexDirection: 'column',
                                        justifyContent: 'center',
                                        alignItems: 'center',
                                        opacity: 0.5
                                    }}>
                                        <div style={{ fontSize: '3.5rem', marginBottom: '1.5rem', opacity: 0.3 }}>💬</div>
                                        <p style={{ margin: 0, maxWidth: '280px', fontSize: '1.1rem', fontWeight: 600, lineHeight: 1.5 }}>
                                            The AI is listening. Your evaluation will appear here instantly after submission.
                                        </p>
                                    </div>
                                ) : (
                                    <div className="card fade-in" style={{
                                        height: '100%',
                                        background: 'white',
                                        borderRadius: '24px',
                                        padding: '2rem',
                                        border: '1px solid #e2e8f0',
                                        boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1)',
                                        overflowY: 'auto',
                                        maxHeight: '650px'
                                    }}>
                                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
                                            <div style={{ textAlign: 'left' }}>
                                                <div style={{ fontSize: '0.75rem', fontWeight: 800, textTransform: 'uppercase', color: '#64748b', marginBottom: '0.5rem', letterSpacing: '1px' }}>Interview Score</div>
                                                <div style={{ fontSize: '3.5rem', fontWeight: 900, color: evaluation.score >= 7 ? '#10b981' : evaluation.score >= 4 ? '#f59e0b' : '#ef4444', lineHeight: 1 }}>
                                                    {evaluation.score}<span style={{ fontSize: '1.2rem', opacity: 0.3 }}>/10</span>
                                                </div>
                                            </div>
                                            <div style={{
                                                width: '80px', height: '80px', borderRadius: '50%',
                                                border: `8px solid ${evaluation.score >= 7 ? '#10b981' : evaluation.score >= 4 ? '#f59e0b' : '#ef4444'}`,
                                                display: 'flex', alignItems: 'center', justifyContent: 'center',
                                                borderTopColor: '#f1f5f9'
                                            }}>
                                                <div style={{ fontSize: '1.5rem' }}>{evaluation.score >= 7 ? '🌟' : evaluation.score >= 4 ? '⚖️' : '📉'}</div>
                                            </div>
                                        </div>

                                        {/* Feedback */}
                                        {evaluation.feedback && (
                                            <div style={{ marginBottom: '1.25rem' }}>
                                                <h6 style={{ fontSize: '0.8rem', fontWeight: 900, textTransform: 'uppercase', color: '#475569', marginBottom: '0.75rem', letterSpacing: '0.5px' }}>Feedback</h6>
                                                <div style={{
                                                    background: '#f8fafc',
                                                    padding: '1.25rem',
                                                    borderRadius: '14px',
                                                    color: '#1e293b',
                                                    fontSize: '0.95rem',
                                                    lineHeight: 1.6,
                                                    border: '1px solid #e2e8f0'
                                                }}>
                                                    <ReactMarkdown remarkPlugins={[remarkGfm]}>{evaluation.feedback}</ReactMarkdown>
                                                </div>
                                            </div>
                                        )}

                                        {/* Strengths & Weaknesses */}
                                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem', marginBottom: '1.25rem' }}>
                                            <div style={{ background: '#f0fdf4', padding: '1rem', borderRadius: '14px', border: '1px solid #bbf7d0' }}>
                                                <strong style={{ display: 'block', fontSize: '0.7rem', textTransform: 'uppercase', color: '#16a34a', marginBottom: '0.5rem', letterSpacing: '1px' }}>✅ Strengths</strong>
                                                <p style={{ color: '#15803d', fontSize: '0.85rem', margin: 0, lineHeight: 1.5 }}>{evaluation.strengths || 'Answer addressed the question.'}</p>
                                            </div>
                                            <div style={{ background: '#fef2f2', padding: '1rem', borderRadius: '14px', border: '1px solid #fecaca' }}>
                                                <strong style={{ display: 'block', fontSize: '0.7rem', textTransform: 'uppercase', color: '#dc2626', marginBottom: '0.5rem', letterSpacing: '1px' }}>⚠️ Weaknesses</strong>
                                                <p style={{ color: '#b91c1c', fontSize: '0.85rem', margin: 0, lineHeight: 1.5 }}>{evaluation.weaknesses || 'Could benefit from more detail.'}</p>
                                            </div>
                                        </div>

                                        {/* Expert's Recommendation */}
                                        {evaluation.sampleAnswer && (
                                            <div style={{ background: '#eff6ff', padding: '1.25rem', borderRadius: '16px', border: '1px solid #bfdbfe', marginBottom: '1.25rem' }}>
                                                <strong style={{ display: 'block', fontSize: '0.7rem', textTransform: 'uppercase', color: '#2563eb', marginBottom: '0.75rem', letterSpacing: '1px' }}>💡 Model Answer</strong>
                                                <div style={{ color: '#1e3a8a', fontSize: '0.9rem', margin: 0, lineHeight: 1.6, fontWeight: 500, whiteSpace: 'pre-wrap' }}>
                                                    {evaluation.sampleAnswer}
                                                </div>
                                            </div>
                                        )}

                                        {/* Improvement Tips */}
                                        {evaluation.improvementTips && (
                                            <div style={{ background: '#fefce8', padding: '1.25rem', borderRadius: '16px', border: '1px solid #fde68a', marginBottom: '1.25rem' }}>
                                                <strong style={{ display: 'block', fontSize: '0.7rem', textTransform: 'uppercase', color: '#ca8a04', marginBottom: '0.75rem', letterSpacing: '1px' }}>🚀 How to Improve</strong>
                                                <div style={{ color: '#854d0e', fontSize: '0.9rem', margin: 0, lineHeight: 1.6, fontWeight: 500, whiteSpace: 'pre-wrap' }}>
                                                    {evaluation.improvementTips}
                                                </div>
                                            </div>
                                        )}

                                        <div style={{ display: 'flex', gap: '0.75rem' }}>
                                            {currentQuestionIndex < questions.length - 1 ? (
                                                <button onClick={nextQuestion} className="btn btn-primary w-100" style={{ padding: '1rem', borderRadius: '16px', fontWeight: 800, fontSize: '1rem' }}>
                                                    Next Question →
                                                </button>
                                            ) : (
                                                <button onClick={endSession} className="btn btn-success w-100" style={{ padding: '1rem', borderRadius: '16px', fontWeight: 800, fontSize: '1rem', background: '#10b981' }}>
                                                    Finish Interview
                                                </button>
                                            )}
                                        </div>
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                )}
            </div>
            <style>{`
                .grid-2-layout { display: grid; grid-template-columns: 1.2fr 1fr; gap: 3rem; }
                .grid-3 { display: grid; grid-template-columns: repeat(3, 1fr); gap: 1.5rem; }
                @media (max-width: 1024px) { 
                    .grid-2-layout { grid-template-columns: 1fr; } 
                }
                @media (max-width: 768px) {
                    .grid-3 { grid-template-columns: 1fr; }
                }
                .w-100 { width: 100%; }
                .btn-text { background: none; border: none; font-weight: 600; cursor: pointer; padding: 0.5rem; transition: opacity 0.3s; }
                .btn-text:hover { opacity: 1 !important; color: var(--danger-dark) !important; }
            `}</style>
        </Layout>
    );
};

export default InterviewTips;
