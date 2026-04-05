import React, { useState, useEffect, useRef, useCallback } from 'react';
import Layout from '../../components/Layout';
import api from '../../services/api';
import { FiMic, FiSend, FiSquare, FiCheckCircle, FiUpload, FiClock, FiChevronDown, FiChevronUp } from 'react-icons/fi';
import { toast } from 'react-hot-toast';
import { motion, AnimatePresence } from 'framer-motion';

// ─── Animated Score Ring ───
const ScoreRing = ({ score, max = 100, size = 160, strokeWidth = 10, color }) => {
    const radius = (size - strokeWidth) / 2;
    const circumference = 2 * Math.PI * radius;
    const [animatedScore, setAnimatedScore] = useState(0);
    useEffect(() => {
        const timer = setTimeout(() => setAnimatedScore(score), 300);
        return () => clearTimeout(timer);
    }, [score]);
    const offset = circumference - (animatedScore / max) * circumference;
    const scoreColor = color || (score >= 70 ? '#10b981' : score >= 45 ? '#f59e0b' : '#ef4444');
    return (
        <div className="relative" style={{ width: size, height: size }}>
            <svg width={size} height={size} className="transform -rotate-90">
                <circle cx={size/2} cy={size/2} r={radius} stroke="rgba(255,255,255,0.1)" strokeWidth={strokeWidth} fill="none" />
                <circle cx={size/2} cy={size/2} r={radius} stroke={scoreColor} strokeWidth={strokeWidth} fill="none"
                    strokeDasharray={circumference} strokeDashoffset={offset} strokeLinecap="round"
                    style={{ transition: 'stroke-dashoffset 1.5s ease-out' }} />
            </svg>
            <div className="absolute inset-0 flex flex-col items-center justify-center">
                <span className="text-4xl font-black text-white">{animatedScore}</span>
                <span className="text-xs text-gray-400">/ {max}</span>
            </div>
        </div>
    );
};

// ─── Criteria Bar ───
const CriteriaBar = ({ label, score, max = 20, feedback }) => {
    const pct = (score / max) * 100;
    const barColor = pct >= 70 ? '#10b981' : pct >= 45 ? '#f59e0b' : '#ef4444';
    return (
        <div className="mb-4">
            <div className="flex justify-between text-sm mb-1">
                <span className="text-gray-300 font-medium">{label}</span>
                <span className="text-white font-bold">{score}/{max}</span>
            </div>
            <div className="h-2.5 bg-white/10 rounded-full overflow-hidden">
                <motion.div initial={{ width: 0 }} animate={{ width: `${pct}%` }} transition={{ duration: 1.2, ease: 'easeOut' }}
                    className="h-full rounded-full" style={{ backgroundColor: barColor }} />
            </div>
            {feedback && <p className="text-xs text-gray-500 mt-1">{feedback}</p>}
        </div>
    );
};

// ─── Audio Waveform Visualizer ───
const WaveformVisualizer = ({ isActive, color = '#818cf8' }) => (
    <div className="flex items-center gap-[3px] h-8">
        {[...Array(12)].map((_, i) => (
            <div key={i} className="w-[3px] rounded-full transition-all duration-150" style={{
                backgroundColor: color, opacity: isActive ? 0.9 : 0.2,
                height: isActive ? `${12 + Math.random() * 20}px` : '6px',
                animation: isActive ? `waveform 0.4s ease-in-out ${i * 0.05}s infinite alternate` : 'none',
            }} />
        ))}
    </div>
);

// ─── AI Avatar ───
const AIAvatar = ({ isSpeaking }) => (
    <div className="relative">
        <div className={`w-28 h-28 rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center shadow-2xl ${isSpeaking ? 'ring-4 ring-indigo-400/50 animate-pulse' : ''}`}>
            <svg viewBox="0 0 80 80" className="w-16 h-16" fill="none">
                <circle cx="40" cy="28" r="14" fill="white" opacity="0.9"/>
                <path d="M18 65c0-12 10-22 22-22s22 10 22 22" stroke="white" strokeWidth="3" fill="white" opacity="0.7"/>
                <circle cx="34" cy="26" r="2" fill="#4338ca"/><circle cx="46" cy="26" r="2" fill="#4338ca"/>
                <path d="M35 34 Q40 38 45 34" stroke="#4338ca" strokeWidth="1.5" fill="none" strokeLinecap="round"/>
            </svg>
        </div>
        {isSpeaking && <div className="absolute -bottom-1 left-1/2 -translate-x-1/2"><WaveformVisualizer isActive={true} /></div>}
    </div>
);

const AIMockInterview = () => {
    const [step, setStep] = useState('setup');
    const [jobRole, setJobRole] = useState('Software Engineer');
    const [questionType, setQuestionType] = useState('technical');
    const [difficulty, setDifficulty] = useState('Medium');
    const [questionCount, setQuestionCount] = useState(8);
    const [resume, setResume] = useState(null);
    const [isLoading, setIsLoading] = useState(false);
    const [chatHistory, setChatHistory] = useState([]);
    const [userInput, setUserInput] = useState('');
    const [evaluation, setEvaluation] = useState(null);
    const [candidateProfile, setCandidateProfile] = useState(null);
    const [isSpeaking, setIsSpeaking] = useState(false);
    const [isListening, setIsListening] = useState(false);
    const [interviewTime, setInterviewTime] = useState(0);
    const [showTranscript, setShowTranscript] = useState(false);
    const [expandedQ, setExpandedQ] = useState(null);
    const chatEndRef = useRef(null);
    const recognitionRef = useRef(null);
    const silenceTimerRef = useRef(null);
    const speakingTimeoutRef = useRef(null);
    const isInterviewActiveRef = useRef(false);
    const userInputRef = useRef(userInput);
    const timerRef = useRef(null);
    const [voices, setVoices] = useState([]);

    useEffect(() => { userInputRef.current = userInput; }, [userInput]);

    // Cleanup
    useEffect(() => {
        return () => {
            isInterviewActiveRef.current = false;
            if ('speechSynthesis' in window) window.speechSynthesis.cancel();
            [speakingTimeoutRef, silenceTimerRef, timerRef].forEach(r => r.current && clearTimeout(r.current));
            if (recognitionRef.current) try { recognitionRef.current.stop(); } catch(e) {}
            if (timerRef.current) clearInterval(timerRef.current);
        };
    }, []);

    // Load voices
    useEffect(() => {
        const load = () => setVoices(window.speechSynthesis.getVoices());
        load();
        if (window.speechSynthesis.onvoiceschanged !== undefined) window.speechSynthesis.onvoiceschanged = load;
    }, []);

    // Timer
    useEffect(() => {
        if (step === 'interview') {
            timerRef.current = setInterval(() => setInterviewTime(t => t + 1), 1000);
        } else {
            if (timerRef.current) clearInterval(timerRef.current);
        }
        return () => { if (timerRef.current) clearInterval(timerRef.current); };
    }, [step]);

    const formatTime = (s) => `${String(Math.floor(s/60)).padStart(2,'0')}:${String(s%60).padStart(2,'0')}`;

    const questionsAsked = chatHistory.filter(m => m.role === 'assistant').length;

    // ─── Speech ───
    const speakText = useCallback((text) => {
        if (!('speechSynthesis' in window)) return;
        window.speechSynthesis.cancel();
        const utterance = new SpeechSynthesisUtterance(text);
        if (voices.length > 0) {
            const v = voices.find(v => v.name.includes("Google US English") || v.name.includes("Zira") || v.lang === "en-US");
            if (v) utterance.voice = v;
        }
        utterance.rate = 1.0; utterance.pitch = 1.05;
        utterance.onstart = () => setIsSpeaking(true);
        utterance.onend = () => {
            setIsSpeaking(false);
            if (!isInterviewActiveRef.current) return;
            speakingTimeoutRef.current = setTimeout(() => { if (isInterviewActiveRef.current) toggleListening(); }, 500);
        };
        window.speechSynthesis.speak(utterance);
    }, [voices]);

    const stopSpeaking = () => {
        if ('speechSynthesis' in window) { window.speechSynthesis.cancel(); setIsSpeaking(false); }
        if (speakingTimeoutRef.current) clearTimeout(speakingTimeoutRef.current);
    };

    // ─── Chat Submission ───
    const submitChat = useCallback(async (textToSubmit) => {
        if (!isInterviewActiveRef.current) return;
        if (recognitionRef.current) { recognitionRef.current.stop(); setIsListening(false); }
        if (silenceTimerRef.current) clearTimeout(silenceTimerRef.current);
        if (!textToSubmit.trim()) textToSubmit = "(Candidate did not provide a response)";
        stopSpeaking();
        const newMessage = { role: 'user', content: textToSubmit };
        const updatedChat = [...chatHistory, newMessage];
        setChatHistory(updatedChat);
        setUserInput('');
        setIsLoading(true);
        try {
            const res = await api.post('/preparation/mock-interview/chat', {
                candidateProfile, jobRole, questionType, chatHistory: updatedChat, difficulty, questionCount
            });
            setChatHistory([...updatedChat, { role: 'assistant', content: res.data.reply }]);
            speakText(res.data.reply);
        } catch (err) { toast.error('Failed to send message.'); }
        finally { setIsLoading(false); }
    }, [chatHistory, candidateProfile, jobRole, questionType, difficulty, questionCount, speakText]);

    // ─── Speech Recognition ───
    useEffect(() => {
        const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
        if (SR) {
            const recognition = new SR();
            recognition.continuous = true; recognition.interimResults = true; recognition.lang = 'en-US';
            recognition.onresult = (event) => {
                let t = '';
                for (let i = 0; i < event.results.length; i++) t += event.results[i][0].transcript;
                setUserInput(t);
                if (silenceTimerRef.current) clearTimeout(silenceTimerRef.current);
                silenceTimerRef.current = setTimeout(() => submitChat(userInputRef.current), 10000);
            };
            recognition.onerror = () => setIsListening(false);
            recognition.onend = () => setIsListening(false);
            recognitionRef.current = recognition;
        }
        return () => {
            if (recognitionRef.current) recognitionRef.current.stop();
            if (silenceTimerRef.current) clearTimeout(silenceTimerRef.current);
        };
    }, [chatHistory, submitChat]);

    const toggleListening = useCallback(() => {
        if (isListening) {
            recognitionRef.current?.stop(); setIsListening(false);
            if (silenceTimerRef.current) clearTimeout(silenceTimerRef.current);
        } else {
            if (!recognitionRef.current) { toast.error('Voice Recognition not supported.'); return; }
            setUserInput(''); recognitionRef.current.start(); setIsListening(true);
            if (silenceTimerRef.current) clearTimeout(silenceTimerRef.current);
            silenceTimerRef.current = setTimeout(() => submitChat(""), 10000);
        }
    }, [isListening, submitChat]);

    useEffect(() => { chatEndRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [chatHistory]);

    // ─── Actions ───
    const startInterview = async (e) => {
        e.preventDefault();
        try { await navigator.mediaDevices.getUserMedia({ audio: true }); } catch { toast.error('Microphone access required.'); return; }
        setIsLoading(true);
        const formData = new FormData();
        formData.append('jobRole', jobRole); formData.append('questionType', questionType);
        formData.append('difficulty', difficulty); formData.append('questionCount', questionCount);
        if (resume) formData.append('resume', resume);
        try {
            const res = await api.post('/preparation/mock-interview/start', formData, { headers: { 'Content-Type': 'multipart/form-data' } });
            setCandidateProfile(res.data.candidateProfile);
            setChatHistory([{ role: 'assistant', content: res.data.initialReply }]);
            isInterviewActiveRef.current = true; setStep('interview'); setInterviewTime(0);
            speakText(res.data.initialReply);
        } catch (err) { toast.error(err.response?.data?.error || 'Failed to start.'); }
        finally { setIsLoading(false); }
    };

    const sendMessage = async (e) => {
        e?.preventDefault();
        if (!isInterviewActiveRef.current || !userInput.trim()) return;
        if (isListening && recognitionRef.current) { recognitionRef.current.stop(); setIsListening(false); }
        stopSpeaking();
        const updatedChat = [...chatHistory, { role: 'user', content: userInput }];
        setChatHistory(updatedChat); setUserInput(''); setIsLoading(true);
        try {
            const res = await api.post('/preparation/mock-interview/chat', {
                candidateProfile, jobRole, questionType, chatHistory: updatedChat, difficulty, questionCount
            });
            setChatHistory([...updatedChat, { role: 'assistant', content: res.data.reply }]);
            speakText(res.data.reply);
        } catch { toast.error('Failed to send message.'); }
        finally { setIsLoading(false); }
    };

    const endInterview = async () => {
        isInterviewActiveRef.current = false; stopSpeaking();
        [silenceTimerRef, timerRef].forEach(r => { if (r.current) { clearTimeout(r.current); clearInterval(r.current); } });
        if (recognitionRef.current) recognitionRef.current.stop();
        setIsListening(false); setIsLoading(true);
        try {
            const res = await api.post('/preparation/mock-interview/evaluate', { jobRole, questionType, chatHistory, difficulty });
            setEvaluation(res.data.evaluation); setStep('evaluation');
        } catch { toast.error('Failed to generate evaluation.'); }
        finally { setIsLoading(false); }
    };

    const resetInterview = () => { setStep('setup'); setChatHistory([]); setEvaluation(null); setInterviewTime(0); };

    // ─── RENDER ───
    return (
        <Layout title="AI Mock Interview">
            <style>{`
                @keyframes waveform { from { transform: scaleY(0.4); } to { transform: scaleY(1); } }
                @keyframes shimmer { 0% { backgroundPosition: -1000px 0; } 100% { backgroundPosition: 1000px 0; } }
                @keyframes float { 0%, 100% { transform: translateY(0px); } 50% { transform: translateY(-8px); } }
                .interview-bg { background: linear-gradient(135deg, #0a0e27 0%, #16213e 25%, #0f3460 50%, #1a1f35 75%, #0d1620 100%); }
                .interview-bg-alt { background: linear-gradient(135deg, #1a1f35 0%, #16213e 50%, #0a0e27 100%); }
                .glass-card { background: rgba(255,255,255,0.06); backdrop-filter: blur(16px) saturate(180%); border: 1px solid rgba(255,255,255,0.12); }
                .glass-card-sm { background: rgba(255,255,255,0.04); backdrop-filter: blur(12px); border: 1px solid rgba(255,255,255,0.08); }
                .glow-btn { box-shadow: 0 0 30px rgba(99,102,241,0.5), 0 0 60px rgba(99,102,241,0.2); transition: box-shadow 0.3s ease; }
                .gradient-btn { background: linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%); }
                .gradient-btn:hover { background: linear-gradient(135deg, #818cf8 0%, #a78bfa 100%); box-shadow: 0 0 30px rgba(99,102,241,0.6); }
                .input-field { background: rgba(255,255,255,0.05); border: 1px solid rgba(255,255,255,0.1); transition: all 0.3s ease; }
                .input-field:focus { background: rgba(255,255,255,0.08); border-color: rgba(99,102,241,0.5); box-shadow: inset 0 0 20px rgba(99,102,241,0.1); }
                .input-field::placeholder { color: rgba(226,232,240,0.4); }
                .float-animation { animation: float 3s ease-in-out infinite; }
            `}</style>

            {/* ═══ SETUP ═══ */}
            {step === 'setup' && (
                <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="min-h-screen interview-bg-alt py-12 px-4">
                    <div className="max-w-2xl mx-auto">
                        <motion.div initial={{ scale: 0.95 }} animate={{ scale: 1 }} className="interview-bg rounded-3xl p-8 shadow-2xl border border-white/8">
                            <div className="text-center mb-10">
                                <motion.div initial={{ scale: 0, rotate: -10 }} animate={{ scale: 1, rotate: 0 }} transition={{ type: 'spring', delay: 0.1 }}
                                    className="mx-auto w-24 h-24 rounded-full bg-gradient-to-br from-indigo-500 via-purple-500 to-pink-500 flex items-center justify-center mb-6 shadow-2xl float-animation">
                                    <svg viewBox="0 0 40 40" className="w-12 h-12" fill="none">
                                        <circle cx="20" cy="14" r="7" fill="white" opacity="0.95"/>
                                        <path d="M9 33c0-6 5-11 11-11s11 5 11 11" fill="white" opacity="0.85"/>
                                        <circle cx="13" cy="12" r="1.5" fill="#6366f1" opacity="0.8"/><circle cx="27" cy="12" r="1.5" fill="#6366f1" opacity="0.8"/>
                                    </svg>
                                </motion.div>
                                <h1 className="text-4xl font-extrabold text-white tracking-tight bg-clip-text text-transparent bg-gradient-to-r from-white via-gray-200 to-gray-400">
                                    AI Mock Interview
                                </h1>
                                <p className="text-gray-400 mt-3 text-lg">Practice with AI-powered realistic interviews powered by advanced language models</p>
                            </div>

                            <form onSubmit={startInterview} className="space-y-6">
                                {/* Job Role */}
                                <div className="group">
                                    <label className="block text-sm font-semibold text-gray-300 mb-2.5 uppercase tracking-wider">
                                        🎯 Target Role *
                                    </label>
                                    <input type="text" value={jobRole} onChange={e => setJobRole(e.target.value)} required placeholder="e.g. Senior Frontend Engineer"
                                        className="input-field w-full px-4 py-3.5 rounded-xl text-white focus:ring-2 focus:ring-indigo-500 focus:ring-opacity-50 outline-none" />
                                </div>

                                {/* Interview Type & Difficulty */}
                                <div className="grid grid-cols-2 gap-5">
                                    <div className="group">
                                        <label className="block text-sm font-semibold text-gray-300 mb-2.5 uppercase tracking-wider">
                                            📚 Interview Type
                                        </label>
                                        <select value={questionType} onChange={e => setQuestionType(e.target.value)}
                                            className="input-field w-full px-4 py-3.5 rounded-xl text-white focus:ring-2 focus:ring-indigo-500 focus:ring-opacity-50 outline-none appearance-none cursor-pointer">
                                            <option value="technical" className="bg-gray-900">Technical</option>
                                            <option value="behavioral" className="bg-gray-900">Behavioral</option>
                                            <option value="hr" className="bg-gray-900">HR</option>
                                            <option value="system-design" className="bg-gray-900">System Design</option>
                                        </select>
                                    </div>
                                    <div className="group">
                                        <label className="block text-sm font-semibold text-gray-300 mb-2.5 uppercase tracking-wider">
                                            ⚡ Difficulty
                                        </label>
                                        <div className="flex gap-2">
                                            {['Easy','Medium','Hard'].map(d => (
                                                <button key={d} type="button" onClick={() => setDifficulty(d)}
                                                    className={`flex-1 py-3 rounded-lg text-sm font-bold transition-all ${difficulty === d
                                                        ? 'gradient-btn text-white shadow-lg shadow-indigo-500/50' : 'glass-card text-gray-400 hover:text-gray-300 hover:bg-white/10'}`}>
                                                    {d}
                                                </button>
                                            ))}
                                        </div>
                                    </div>
                                </div>

                                {/* Question Count */}
                                <div className="glass-card rounded-2xl p-5">
                                    <div className="flex items-center justify-between mb-3">
                                        <label className="text-sm font-semibold text-gray-300 uppercase tracking-wider">
                                            📝 Number of Questions
                                        </label>
                                        <span className="text-lg font-bold gradient-text text-transparent bg-clip-text bg-gradient-to-r from-indigo-400 to-purple-400">
                                            {questionCount}
                                        </span>
                                    </div>
                                    <input type="range" min="3" max="10" value={questionCount} onChange={e => setQuestionCount(Number(e.target.value))}
                                        className="w-full accent-indigo-500 h-2 bg-white/10 rounded-full cursor-pointer" />
                                    <div className="flex justify-between text-xs text-gray-500 mt-2"><span>3 (Quick)</span><span>10 (Full)</span></div>
                                </div>

                                {/* Resume Upload */}
                                <div className="group">
                                    <label className="block text-sm font-semibold text-gray-300 mb-2.5 uppercase tracking-wider">
                                        📄 Resume (PDF - Optional)
                                    </label>
                                    <div className="border-2 border-dashed border-indigo-500/30 hover:border-indigo-500/60 rounded-xl p-8 text-center transition-all cursor-pointer backdrop-blur-sm"
                                        onClick={() => document.getElementById('resume-input').click()}>
                                        <div className="flex justify-center mb-3">
                                            <FiUpload className="w-10 h-10 text-indigo-400/60" />
                                        </div>
                                        <p className="text-sm font-semibold text-gray-300">{resume ? resume.name : 'Upload your resume'}</p>
                                        <p className="text-xs text-gray-500 mt-1">PDF format • Max 5MB</p>
                                        <input id="resume-input" type="file" accept="application/pdf" onChange={e => setResume(e.target.files[0])} className="hidden" />
                                    </div>
                                </div>

                                {/* Start Button */}
                                <button type="submit" disabled={isLoading}
                                    className="gradient-btn w-full text-white py-4 rounded-xl font-bold text-lg hover:shadow-lg glow-btn disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-3 transition-all mt-8">
                                    {isLoading ? (
                                        <>
                                            <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24">
                                                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none"/>
                                                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
                                            </svg>
                                            Preparing Your Interview...
                                        </>
                                    ) : (
                                        <>
                                            <span>🚀</span> Start Interview
                                        </>
                                    )}
                                </button>
                            </form>
                        </motion.div>
                    </div>
                </motion.div>
            )}

            {/* ═══ INTERVIEW ═══ */}
            {step === 'interview' && (
                <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="interview-bg fixed inset-0 z-50 flex flex-col" style={{ marginTop: 0 }}>
                    {/* Top bar */}
                    <div className="flex items-center justify-between px-6 py-4 border-b border-white/10 bg-gradient-to-r from-black/40 to-transparent backdrop-blur-lg">
                        <div className="flex items-center gap-4">
                            <motion.div animate={{ scale: [1, 1.2, 1] }} transition={{ duration: 2, repeat: Infinity }}
                                className="w-3 h-3 rounded-full bg-gradient-to-r from-green-400 to-emerald-400 shadow-lg shadow-green-500/50" />
                            <span className="text-white font-bold tracking-wide">Live Interview</span>
                            <span className="text-gray-500">•</span>
                            <span className="text-gray-400 font-medium">{jobRole} • {questionType}</span>
                        </div>
                        <div className="flex items-center gap-5">
                            <div className="flex items-center gap-2 text-gray-300 text-sm font-mono bg-white/5 px-3 py-1.5 rounded-lg">
                                <FiClock className="w-4 h-4 text-indigo-400" />
                                {formatTime(interviewTime)}
                            </div>
                            <span className="text-xs font-bold bg-gradient-to-r from-indigo-500/20 to-purple-500/20 text-indigo-300 px-3 py-1.5 rounded-full border border-indigo-500/30">
                                Q{questionsAsked}/{questionCount}
                            </span>
                            <button onClick={endInterview} className="text-sm font-semibold border border-red-500/40 hover:bg-red-500/15 hover:border-red-500/60 px-4 py-1.5 rounded-lg text-red-400 flex items-center gap-2 transition-all">
                                <FiSquare className="w-3.5 h-3.5" /> End Session
                            </button>
                        </div>
                    </div>

                    {/* Main area */}
                    <div className="flex-1 flex flex-col lg:flex-row overflow-hidden">
                        {/* AI Panel */}
                        <div className="lg:w-1/3 flex flex-col items-center justify-center p-8 border-b lg:border-b-0 lg:border-r border-white/5 bg-gradient-to-br from-black/20 to-transparent">
                            <AIAvatar isSpeaking={isSpeaking} />
                            <h3 className="text-white font-bold text-xl mt-5">Sarah Chen</h3>
                            <p className="text-gray-500 text-sm font-medium">Senior AI Interviewer</p>
                            <motion.div initial={{ scale: 0.95 }} animate={{ scale: 1 }} className="mt-5 glass-card rounded-xl px-5 py-3">
                                <span className={`text-sm font-semibold transition-colors ${isSpeaking ? 'text-indigo-300' : isLoading ? 'text-amber-300' : 'text-emerald-300'}`}>
                                    {isSpeaking ? '🎙️ Speaking...' : isLoading ? '🤔 Thinking...' : '👂 Listening'}
                                </span>
                            </motion.div>
                        </div>

                        {/* Chat / Transcript */}
                        <div className="flex-1 flex flex-col bg-gradient-to-b from-black/10 to-transparent">
                            <div className="flex-1 overflow-y-auto p-6 space-y-4 scrollbar-hide">
                                {chatHistory.map((msg, idx) => (
                                    <motion.div key={idx} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
                                        className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                                        <div className={`max-w-[80%] p-4 rounded-2xl transition-all ${msg.role === 'assistant'
                                            ? 'glass-card text-gray-100 rounded-tl-sm shadow-lg border border-indigo-500/20' : 'bg-gradient-to-br from-indigo-600/80 to-purple-600/60 text-white rounded-tr-sm shadow-lg'}`}>
                                            <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest block mb-1.5">
                                                {msg.role === 'assistant' ? '🤖 Sarah' : '👤 You'}
                                            </span>
                                            <p className="whitespace-pre-wrap leading-relaxed text-sm">{msg.content}</p>
                                        </div>
                                    </motion.div>
                                ))}
                                {isLoading && (
                                    <div className="flex justify-start"><div className="glass-card p-4 rounded-2xl rounded-tl-sm flex items-center gap-3 border border-indigo-500/20">
                                        <span className="text-[10px] font-bold text-gray-400 uppercase">Sarah</span>
                                        <span className="flex gap-1.5">{[0,1,2].map(i => <motion.span key={i} className="w-2 h-2 bg-indigo-400 rounded-full" animate={{ y: [-4, 4, -4] }} transition={{ duration: 0.6, repeat: Infinity, delay: i*0.1 }} />)}</span>
                                    </div></div>
                                )}
                                <div ref={chatEndRef} />
                            </div>

                            {/* Input bar */}
                            <div className="p-4 border-t border-white/10 bg-gradient-to-t from-black/40 to-transparent backdrop-blur-sm">
                                <form onSubmit={sendMessage} className="flex gap-3 items-center">
                                    <motion.button type="button" onClick={toggleListening} disabled={isLoading}
                                        whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}
                                        className={`w-14 h-14 shrink-0 rounded-2xl flex items-center justify-center transition-all font-bold ${isListening
                                            ? 'bg-gradient-to-br from-red-500/30 to-red-600/20 border-2 border-red-500/60 text-red-400 shadow-lg shadow-red-500/40 glow-btn' : 'glass-card text-gray-400 hover:text-white border border-indigo-500/30 hover:border-indigo-500/60'} disabled:opacity-50`}>
                                        <FiMic className="w-6 h-6" />
                                    </motion.button>
                                    <input value={userInput} onChange={e => setUserInput(e.target.value)} disabled={isLoading || isListening}
                                        placeholder={isListening ? "Listening... speak now" : "Type your answer..."} 
                                        className="input-field flex-1 h-14 px-5 rounded-2xl text-white focus:ring-2 focus:ring-indigo-500/50 focus:ring-opacity-50 outline-none" />
                                    <motion.button type="submit" disabled={isLoading || !userInput.trim()}
                                        whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}
                                        className="w-14 h-14 shrink-0 gradient-btn text-white rounded-2xl flex items-center justify-center disabled:opacity-30 transition-all shadow-lg">
                                        <FiSend className="w-5 h-5" />
                                    </motion.button>
                                </form>
                            </div>
                        </div>
                    </div>
                </motion.div>
            )}

            {/* ═══ EVALUATION ═══ */}
            {step === 'evaluation' && evaluation && (
                <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="min-h-screen interview-bg-alt py-12 px-4">
                    <div className="max-w-4xl mx-auto">
                        {/* Header */}
                        <motion.div initial={{ scale: 0.95 }} animate={{ scale: 1 }} className="interview-bg rounded-3xl p-8 shadow-2xl border border-white/8 mb-6">
                            <div className="text-center mb-8">
                                <motion.div initial={{ scale: 0, rotate: -20 }} animate={{ scale: 1, rotate: 0 }} transition={{ type: 'spring', delay: 0.1 }}>
                                    <div className="inline-block p-4 rounded-full bg-gradient-to-br from-emerald-400/20 to-green-500/20 border border-green-500/30 mb-4">
                                        <FiCheckCircle className="w-12 h-12 text-green-400" />
                                    </div>
                                </motion.div>
                                <h1 className="text-4xl font-extrabold text-white mb-2">Interview Complete! 🎉</h1>
                                <p className="text-gray-400">{jobRole} • {questionType} • {difficulty} • {formatTime(interviewTime)}</p>
                            </div>

                            {/* Score Ring */}
                            <div className="flex justify-center mb-8">
                                <ScoreRing score={evaluation.score || 0} />
                            </div>
                        </motion.div>

                        {/* Criteria Breakdown */}
                        {evaluation.criteria && (
                            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}
                                className="interview-bg rounded-3xl p-8 shadow-2xl border border-white/8 mb-6">
                                <h2 className="text-2xl font-bold text-white mb-6 flex items-center gap-3">
                                    <span className="w-2 h-2 rounded-full bg-gradient-to-r from-indigo-400 to-purple-400"></span>
                                    Performance Breakdown
                                </h2>
                                <div className="space-y-5">
                                    <CriteriaBar label="Technical Accuracy" score={evaluation.criteria.technicalAccuracy?.score || 0} feedback={evaluation.criteria.technicalAccuracy?.feedback} />
                                    <CriteriaBar label="Communication Clarity" score={evaluation.criteria.communicationClarity?.score || 0} feedback={evaluation.criteria.communicationClarity?.feedback} />
                                    <CriteriaBar label="Problem Solving" score={evaluation.criteria.problemSolving?.score || 0} feedback={evaluation.criteria.problemSolving?.feedback} />
                                    <CriteriaBar label="Confidence & Delivery" score={evaluation.criteria.confidenceDelivery?.score || 0} feedback={evaluation.criteria.confidenceDelivery?.feedback} />
                                    <CriteriaBar label="Role Relevance" score={evaluation.criteria.roleRelevance?.score || 0} feedback={evaluation.criteria.roleRelevance?.feedback} />
                                </div>
                            </motion.div>
                        )}

                        {/* Feedback */}
                        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }}
                            className="interview-bg rounded-3xl p-8 shadow-2xl border border-white/8 mb-6">
                            <h2 className="text-2xl font-bold text-white mb-4 flex items-center gap-3">
                                <span className="text-2xl">💡</span> Overall Feedback
                            </h2>
                            <p className="text-gray-300 leading-relaxed text-lg">{evaluation.feedback}</p>
                        </motion.div>

                        {/* Strengths & Improvements */}
                        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.4 }}
                            className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
                            <div className="interview-bg rounded-3xl p-8 shadow-2xl border border-emerald-500/20">
                                <h3 className="text-xl font-bold text-emerald-400 mb-4 flex items-center gap-2">
                                    <span>✨</span> Strengths
                                </h3>
                                <ul className="space-y-3">
                                    {(evaluation.strengths || []).map((s,i) => (
                                        <li key={i} className="text-gray-300 text-sm flex gap-3">
                                            <span className="text-emerald-400 shrink-0 font-bold">✓</span>
                                            <span>{s}</span>
                                        </li>
                                    ))}
                                </ul>
                            </div>
                            <div className="interview-bg rounded-3xl p-8 shadow-2xl border border-amber-500/20">
                                <h3 className="text-xl font-bold text-amber-400 mb-4 flex items-center gap-2">
                                    <span>🎯</span> Areas to Improve
                                </h3>
                                <ul className="space-y-3">
                                    {(evaluation.improvements || []).map((s,i) => (
                                        <li key={i} className="text-gray-300 text-sm flex gap-3">
                                            <span className="text-amber-400 shrink-0 font-bold">→</span>
                                            <span>{s}</span>
                                        </li>
                                    ))}
                                </ul>
                            </div>
                        </motion.div>

                        {/* Per-Question */}
                        {evaluation.perQuestion && evaluation.perQuestion.length > 0 && (
                            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.5 }}
                                className="interview-bg rounded-3xl p-8 shadow-2xl border border-white/8 mb-6">
                                <h2 className="text-2xl font-bold text-white mb-4 flex items-center gap-3">
                                    <span className="text-2xl">📋</span> Question-by-Question Review
                                </h2>
                                <div className="space-y-2">
                                    {evaluation.perQuestion.map((q, i) => (
                                        <div key={i} className="border border-white/10 rounded-2xl overflow-hidden">
                                            <button onClick={() => setExpandedQ(expandedQ === i ? null : i)}
                                                className="w-full flex justify-between items-center py-4 px-5 hover:bg-white/5 transition-colors text-left">
                                                <span className="text-gray-300 text-sm flex-1 pr-4 font-medium">
                                                    <span className="text-indigo-400 font-bold">Q{i+1}</span>: {q.question?.substring(0, 80)}{q.question?.length > 80 ? '...' : ''}
                                                </span>
                                                <div className="flex items-center gap-3">
                                                    <span className={`text-sm font-bold px-3 py-1 rounded-lg ${q.score >= 7 ? 'bg-green-500/20 text-green-400' : q.score >= 4 ? 'bg-amber-500/20 text-amber-400' : 'bg-red-500/20 text-red-400'}`}>
                                                        {q.score}/10
                                                    </span>
                                                    {expandedQ === i ? <FiChevronUp className="text-gray-500" /> : <FiChevronDown className="text-gray-500" />}
                                                </div>
                                            </button>
                                            <AnimatePresence>
                                                {expandedQ === i && (
                                                    <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }}
                                                        className="overflow-hidden border-t border-white/10 bg-white/5 px-5 py-4">
                                                        <p className="text-gray-400 text-sm leading-relaxed">{q.feedback}</p>
                                                    </motion.div>
                                                )}
                                            </AnimatePresence>
                                        </div>
                                    ))}
                                </div>
                            </motion.div>
                        )}

                        {/* Actions */}
                        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.6 }}
                            className="flex gap-4 justify-center">
                            <button onClick={resetInterview} className="gradient-btn text-white px-10 py-4 rounded-xl font-bold text-lg hover:shadow-lg glow-btn transition-all">
                                🚀 Try Another Interview
                            </button>
                        </motion.div>
                    </div>
                </motion.div>
            )}
        </Layout>
    );
};

export default AIMockInterview;
