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
                .interview-bg { background: linear-gradient(135deg, #0f0b1e 0%, #1a1333 40%, #0d1b2a 100%); }
                .glass-card { background: rgba(255,255,255,0.05); backdrop-filter: blur(20px); border: 1px solid rgba(255,255,255,0.08); }
                .glow-btn { box-shadow: 0 0 20px rgba(99,102,241,0.4), 0 0 60px rgba(99,102,241,0.1); }
            `}</style>

            {/* ═══ SETUP ═══ */}
            {step === 'setup' && (
                <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="max-w-2xl mx-auto mt-6 mb-12 px-4">
                    <div className="interview-bg rounded-3xl p-8 shadow-2xl border border-white/5">
                        <div className="text-center mb-8">
                            <div className="mx-auto w-20 h-20 rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center mb-4 shadow-lg">
                                <svg viewBox="0 0 40 40" className="w-10 h-10" fill="none">
                                    <circle cx="20" cy="14" r="7" fill="white" opacity="0.9"/>
                                    <path d="M9 33c0-6 5-11 11-11s11 5 11 11" fill="white" opacity="0.7"/>
                                </svg>
                            </div>
                            <h2 className="text-3xl font-extrabold text-white tracking-tight">AI Mock Interview</h2>
                            <p className="text-gray-400 mt-2">Realistic voice-powered interview with Sarah Chen, your AI interviewer</p>
                        </div>

                        <form onSubmit={startInterview} className="space-y-5">
                            <div>
                                <label className="block text-sm font-semibold text-gray-300 mb-2">Target Role</label>
                                <input type="text" value={jobRole} onChange={e => setJobRole(e.target.value)} required placeholder="e.g. Frontend Developer"
                                    className="w-full p-3.5 bg-white/5 border border-white/10 rounded-xl text-white placeholder-gray-500 focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none transition" />
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-sm font-semibold text-gray-300 mb-2">Interview Type</label>
                                    <select value={questionType} onChange={e => setQuestionType(e.target.value)}
                                        className="w-full p-3.5 bg-white/5 border border-white/10 rounded-xl text-white focus:ring-2 focus:ring-indigo-500 outline-none transition appearance-none">
                                        <option value="technical" className="bg-gray-900">Technical</option>
                                        <option value="behavioral" className="bg-gray-900">Behavioral</option>
                                        <option value="hr" className="bg-gray-900">HR</option>
                                        <option value="system-design" className="bg-gray-900">System Design</option>
                                    </select>
                                </div>
                                <div>
                                    <label className="block text-sm font-semibold text-gray-300 mb-2">Difficulty</label>
                                    <div className="flex gap-2">
                                        {['Easy','Medium','Hard'].map(d => (
                                            <button key={d} type="button" onClick={() => setDifficulty(d)}
                                                className={`flex-1 py-3 rounded-xl text-sm font-bold transition ${difficulty === d
                                                    ? 'bg-indigo-500 text-white shadow-lg' : 'bg-white/5 text-gray-400 hover:bg-white/10 border border-white/10'}`}>
                                                {d}
                                            </button>
                                        ))}
                                    </div>
                                </div>
                            </div>

                            <div>
                                <label className="block text-sm font-semibold text-gray-300 mb-2">Questions: {questionCount}</label>
                                <input type="range" min="3" max="10" value={questionCount} onChange={e => setQuestionCount(Number(e.target.value))}
                                    className="w-full accent-indigo-500" />
                                <div className="flex justify-between text-xs text-gray-500 mt-1"><span>3 (Quick)</span><span>10 (Full)</span></div>
                            </div>

                            <div>
                                <label className="block text-sm font-semibold text-gray-300 mb-2">Resume (PDF)</label>
                                <div className="border-2 border-dashed border-white/10 rounded-xl p-6 text-center hover:border-indigo-500/40 transition cursor-pointer"
                                    onClick={() => document.getElementById('resume-input').click()}>
                                    <FiUpload className="w-8 h-8 text-gray-500 mx-auto mb-2" />
                                    <p className="text-sm text-gray-400">{resume ? resume.name : 'Click to upload your resume'}</p>
                                    <input id="resume-input" type="file" accept="application/pdf" onChange={e => setResume(e.target.files[0])} className="hidden" />
                                </div>
                            </div>

                            <button type="submit" disabled={isLoading}
                                className="w-full mt-4 bg-gradient-to-r from-indigo-600 to-purple-600 text-white py-4 rounded-xl font-bold text-lg hover:from-indigo-500 hover:to-purple-500 transition shadow-lg glow-btn disabled:opacity-50 flex items-center justify-center gap-3">
                                {isLoading ? (<><svg className="animate-spin h-5 w-5" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none"/><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/></svg>Preparing Interview...</>) : 'Start Interview'}
                            </button>
                        </form>
                    </div>
                </motion.div>
            )}

            {/* ═══ INTERVIEW ═══ */}
            {step === 'interview' && (
                <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="interview-bg fixed inset-0 z-50 flex flex-col" style={{ marginTop: 0 }}>
                    {/* Top bar */}
                    <div className="flex items-center justify-between px-6 py-3 border-b border-white/10 bg-black/30 backdrop-blur-sm">
                        <div className="flex items-center gap-4">
                            <div className="w-2.5 h-2.5 rounded-full bg-green-400 animate-pulse" />
                            <span className="text-white font-semibold text-sm">Live Interview</span>
                            <span className="text-gray-400 text-sm">•</span>
                            <span className="text-gray-400 text-sm">{jobRole} — {questionType}</span>
                        </div>
                        <div className="flex items-center gap-4">
                            <div className="flex items-center gap-2 text-gray-400 text-sm"><FiClock className="w-4 h-4" />{formatTime(interviewTime)}</div>
                            <span className="text-xs text-indigo-400 font-bold bg-indigo-500/10 px-3 py-1 rounded-full">Q{questionsAsked}/{questionCount}</span>
                            <button onClick={endInterview} className="text-sm border border-red-500/30 hover:bg-red-500/10 px-4 py-1.5 rounded-lg text-red-400 flex items-center gap-2 transition">
                                <FiSquare className="w-3.5 h-3.5" /> End
                            </button>
                        </div>
                    </div>

                    {/* Main area */}
                    <div className="flex-1 flex flex-col lg:flex-row overflow-hidden">
                        {/* AI Panel */}
                        <div className="lg:w-1/3 flex flex-col items-center justify-center p-8 border-b lg:border-b-0 lg:border-r border-white/5">
                            <AIAvatar isSpeaking={isSpeaking} />
                            <h3 className="text-white font-bold text-lg mt-4">Sarah Chen</h3>
                            <p className="text-gray-500 text-sm">Senior Interviewer</p>
                            <div className="mt-4 glass-card rounded-xl px-4 py-2">
                                <span className="text-xs text-gray-400">{isSpeaking ? '🎙️ Speaking...' : isLoading ? '🤔 Thinking...' : '👂 Listening'}</span>
                            </div>
                        </div>

                        {/* Chat / Transcript */}
                        <div className="flex-1 flex flex-col">
                            <div className="flex-1 overflow-y-auto p-6 space-y-4">
                                {chatHistory.map((msg, idx) => (
                                    <motion.div key={idx} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
                                        className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                                        <div className={`max-w-[80%] p-4 rounded-2xl ${msg.role === 'assistant'
                                            ? 'glass-card text-gray-200 rounded-tl-sm' : 'bg-indigo-600/80 text-white rounded-tr-sm'}`}>
                                            <span className="text-[10px] font-bold text-gray-500 uppercase tracking-wider block mb-1">
                                                {msg.role === 'assistant' ? 'Sarah' : 'You'}
                                            </span>
                                            <p className="whitespace-pre-wrap leading-relaxed text-sm">{msg.content}</p>
                                        </div>
                                    </motion.div>
                                ))}
                                {isLoading && (
                                    <div className="flex justify-start"><div className="glass-card p-4 rounded-2xl rounded-tl-sm flex items-center gap-3">
                                        <span className="text-[10px] font-bold text-gray-500 uppercase">Sarah</span>
                                        <span className="flex gap-1">{[0,1,2].map(i => <span key={i} className="w-2 h-2 bg-indigo-400 rounded-full animate-bounce" style={{ animationDelay: `${i*0.15}s` }} />)}</span>
                                    </div></div>
                                )}
                                <div ref={chatEndRef} />
                            </div>

                            {/* Input bar */}
                            <div className="p-4 border-t border-white/10 bg-black/20">
                                <form onSubmit={sendMessage} className="flex gap-3 items-center">
                                    <button type="button" onClick={toggleListening} disabled={isLoading}
                                        className={`w-14 h-14 shrink-0 rounded-2xl flex items-center justify-center transition-all ${isListening
                                            ? 'bg-red-500/20 border-2 border-red-500 text-red-400 animate-pulse glow-btn' : 'glass-card text-gray-400 hover:text-white'} disabled:opacity-50`}>
                                        <FiMic className="w-6 h-6" />
                                    </button>
                                    <input value={userInput} onChange={e => setUserInput(e.target.value)} disabled={isLoading || isListening}
                                        placeholder={isListening ? "Listening... speak now" : "Type your answer..."} 
                                        className="flex-1 h-14 px-5 bg-white/5 border border-white/10 rounded-2xl text-white placeholder-gray-600 focus:ring-2 focus:ring-indigo-500 outline-none transition" />
                                    <button type="submit" disabled={isLoading || !userInput.trim()}
                                        className="w-14 h-14 shrink-0 bg-indigo-600 hover:bg-indigo-500 text-white rounded-2xl flex items-center justify-center disabled:opacity-30 transition">
                                        <FiSend className="w-5 h-5" />
                                    </button>
                                </form>
                            </div>
                        </div>
                    </div>
                </motion.div>
            )}

            {/* ═══ EVALUATION ═══ */}
            {step === 'evaluation' && evaluation && (
                <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="max-w-3xl mx-auto mt-6 mb-12 px-4">
                    <div className="interview-bg rounded-3xl p-8 shadow-2xl border border-white/5">
                        {/* Header */}
                        <div className="text-center mb-8">
                            <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ type: 'spring', delay: 0.2 }}>
                                <FiCheckCircle className="w-16 h-16 text-green-400 mx-auto mb-3" />
                            </motion.div>
                            <h2 className="text-3xl font-extrabold text-white">Interview Complete</h2>
                            <p className="text-gray-400 mt-1">{jobRole} • {questionType} • {difficulty} • {formatTime(interviewTime)}</p>
                        </div>

                        {/* Score */}
                        <div className="flex justify-center mb-8">
                            <ScoreRing score={evaluation.score || 0} />
                        </div>

                        {/* Criteria Breakdown */}
                        {evaluation.criteria && (
                            <div className="glass-card rounded-2xl p-6 mb-6">
                                <h3 className="text-white font-bold text-lg mb-4">Performance Breakdown</h3>
                                <CriteriaBar label="Technical Accuracy" score={evaluation.criteria.technicalAccuracy?.score || 0} feedback={evaluation.criteria.technicalAccuracy?.feedback} />
                                <CriteriaBar label="Communication Clarity" score={evaluation.criteria.communicationClarity?.score || 0} feedback={evaluation.criteria.communicationClarity?.feedback} />
                                <CriteriaBar label="Problem Solving" score={evaluation.criteria.problemSolving?.score || 0} feedback={evaluation.criteria.problemSolving?.feedback} />
                                <CriteriaBar label="Confidence & Delivery" score={evaluation.criteria.confidenceDelivery?.score || 0} feedback={evaluation.criteria.confidenceDelivery?.feedback} />
                                <CriteriaBar label="Role Relevance" score={evaluation.criteria.roleRelevance?.score || 0} feedback={evaluation.criteria.roleRelevance?.feedback} />
                            </div>
                        )}

                        {/* Feedback */}
                        <div className="glass-card rounded-2xl p-6 mb-6">
                            <h3 className="text-white font-bold mb-2">Overall Feedback</h3>
                            <p className="text-gray-300 leading-relaxed">{evaluation.feedback}</p>
                        </div>

                        {/* Strengths & Improvements */}
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
                            <div className="glass-card rounded-2xl p-5 border-l-4 border-green-500">
                                <h3 className="text-green-400 font-bold mb-3">Strengths</h3>
                                <ul className="space-y-2">{(evaluation.strengths || []).map((s,i) => (
                                    <li key={i} className="text-gray-300 text-sm flex gap-2"><span className="text-green-400 shrink-0">✓</span>{s}</li>
                                ))}</ul>
                            </div>
                            <div className="glass-card rounded-2xl p-5 border-l-4 border-amber-500">
                                <h3 className="text-amber-400 font-bold mb-3">Areas to Improve</h3>
                                <ul className="space-y-2">{(evaluation.improvements || []).map((s,i) => (
                                    <li key={i} className="text-gray-300 text-sm flex gap-2"><span className="text-amber-400 shrink-0">→</span>{s}</li>
                                ))}</ul>
                            </div>
                        </div>

                        {/* Per-Question */}
                        {evaluation.perQuestion && evaluation.perQuestion.length > 0 && (
                            <div className="glass-card rounded-2xl p-5 mb-6">
                                <h3 className="text-white font-bold mb-3">Question-by-Question</h3>
                                {evaluation.perQuestion.map((q, i) => (
                                    <div key={i} className="border-b border-white/5 last:border-0">
                                        <button onClick={() => setExpandedQ(expandedQ === i ? null : i)}
                                            className="w-full flex justify-between items-center py-3 text-left">
                                            <span className="text-gray-300 text-sm flex-1 pr-4">Q{i+1}: {q.question?.substring(0, 80)}{q.question?.length > 80 ? '...' : ''}</span>
                                            <div className="flex items-center gap-2">
                                                <span className={`text-sm font-bold ${q.score >= 7 ? 'text-green-400' : q.score >= 4 ? 'text-amber-400' : 'text-red-400'}`}>{q.score}/10</span>
                                                {expandedQ === i ? <FiChevronUp className="text-gray-500" /> : <FiChevronDown className="text-gray-500" />}
                                            </div>
                                        </button>
                                        <AnimatePresence>{expandedQ === i && (
                                            <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }}
                                                className="overflow-hidden"><p className="text-gray-400 text-sm pb-3 pl-4">{q.feedback}</p></motion.div>
                                        )}</AnimatePresence>
                                    </div>
                                ))}
                            </div>
                        )}

                        {/* Actions */}
                        <div className="flex gap-4 justify-center">
                            <button onClick={resetInterview} className="bg-gradient-to-r from-indigo-600 to-purple-600 text-white px-8 py-3 rounded-xl font-bold hover:from-indigo-500 hover:to-purple-500 transition shadow-lg">
                                Try Another Interview
                            </button>
                        </div>
                    </div>
                </motion.div>
            )}
        </Layout>
    );
};

export default AIMockInterview;
