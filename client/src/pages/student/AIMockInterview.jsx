import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useLocation } from 'react-router-dom';
import Layout from '../../components/Layout';
import api from '../../services/api';
import { FiMic, FiSend, FiSquare, FiCheckCircle, FiUpload, FiClock, FiChevronDown, FiChevronUp } from 'react-icons/fi';
import { toast } from 'react-hot-toast';
// eslint-disable-next-line no-unused-vars
import { motion } from 'framer-motion';

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
                <circle cx={size/2} cy={size/2} r={radius} stroke="rgba(37,99,235,0.15)" strokeWidth={strokeWidth} fill="none" />
                <circle cx={size/2} cy={size/2} r={radius} stroke={scoreColor} strokeWidth={strokeWidth} fill="none"
                    strokeDasharray={circumference} strokeDashoffset={offset} strokeLinecap="round"
                    style={{ transition: 'stroke-dashoffset 1.5s ease-out' }} />
            </svg>
            <div className="absolute inset-0 flex flex-col items-center justify-center">
                <span className="text-4xl font-black" style={{ color: scoreColor }}>{animatedScore}</span>
                <span className="text-xs text-gray-500">/ {max}</span>
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
                <span className="text-gray-700 font-medium">{label}</span>
                <span className="text-gray-900 font-bold">{score}/{max}</span>
            </div>
            <div className="h-2.5 bg-gray-200 rounded-full overflow-hidden">
                <motion.div initial={{ width: 0 }} animate={{ width: `${pct}%` }} transition={{ duration: 1.2, ease: 'easeOut' }}
                    className="h-full rounded-full" style={{ backgroundColor: barColor }} />
            </div>
            {feedback && <p className="text-xs text-gray-600 mt-1">{feedback}</p>}
        </div>
    );
};

// ─── Waveform Visualizer with memoized random heights ───
const WaveformVisualizer = ({ isActive, color = '#3b82f6' }) => {
    // Generate random heights once and memoize them
    const [heights] = useState(() => 
        Array.from({ length: 12 }, () => 12 + Math.random() * 20)
    );
    
    return (
    <div className="flex items-center gap-[3px] h-8">
        {heights.map((height, i) => (
            <div key={i} className="w-[3px] rounded-full transition-all duration-150" style={{
                backgroundColor: color, opacity: isActive ? 0.8 : 0.3,
                height: isActive ? `${height}px` : '6px',
                animation: isActive ? `waveform 0.4s ease-in-out ${i * 0.05}s infinite alternate` : 'none',
            }} />
        ))}
    </div>
);
};

// ─── AI Avatar ───
const AIAvatar = ({ isSpeaking }) => (
    <div className="relative">
        <div className={`w-28 h-28 rounded-full bg-gradient-to-br from-blue-500 to-blue-600 flex items-center justify-center shadow-xl ${isSpeaking ? 'ring-4 ring-blue-400/50 animate-pulse' : ''}`}>
            <svg viewBox="0 0 80 80" className="w-16 h-16" fill="none">
                <circle cx="40" cy="28" r="14" fill="white" opacity="0.95"/>
                <path d="M18 65c0-12 10-22 22-22s22 10 22 22" stroke="white" strokeWidth="3" fill="white" opacity="0.85"/>
                <circle cx="34" cy="26" r="2" fill="#1d4ed8"/><circle cx="46" cy="26" r="2" fill="#1d4ed8"/>
                <path d="M35 34 Q40 38 45 34" stroke="#1d4ed8" strokeWidth="1.5" fill="none" strokeLinecap="round"/>
            </svg>
        </div>
        {isSpeaking && <div className="absolute -bottom-1 left-1/2 -translate-x-1/2"><WaveformVisualizer isActive={true} /></div>}
    </div>
);

const AIMockInterview = () => {
    const location = useLocation();
    const jobPrep = location.state?.jobPrep || null;

    // Job roles with tech and management options
    const ObjectRoles = [
        'Software Engineer',
        'Frontend Developer',
        'Backend Developer',
        'Full Stack Developer',
        'Data Scientist',
        'AI/ML Engineer',
        'DevOps Engineer',
        'Product Manager',
        'Engineering Manager',
        'Technical Lead',
        'Solutions Architect',
        'QA Engineer',
        'Custom Role'
    ];
    
    // Add dynamically chosen role to list if it doesn't exist
    const jobRoles = jobPrep ? [jobPrep.title, ...ObjectRoles.filter(r => r !== jobPrep.title)] : ObjectRoles;

    const [step, setStep] = useState('setup');
    const [jobRole, setJobRole] = useState(jobPrep ? `${jobPrep.title} at ${jobPrep.company}` : 'Software Engineer');
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
    const [videoStream, setVideoStream] = useState(null);
    const [gazeWarnings, setGazeWarnings] = useState(0);
    const videoRef = useRef(null);
    const chatEndRef = useRef(null);
    const recognitionRef = useRef(null);
    const silenceTimerRef = useRef(null);
    const speakingTimeoutRef = useRef(null);
    const isInterviewActiveRef = useRef(false);
    const userInputRef = useRef(userInput);
    const timerRef = useRef(null);
    const autoEndTriggeredRef = useRef(false);
    const endInterviewRef = useRef(null);
    const [voices, setVoices] = useState([]);

    const isListeningRef = useRef(false);

    useEffect(() => { userInputRef.current = userInput; }, [userInput]);
    useEffect(() => { isListeningRef.current = isListening; }, [isListening]);

    // Cleanup
    useEffect(() => {
        return () => {
            isInterviewActiveRef.current = false;
            if ('speechSynthesis' in window) window.speechSynthesis.cancel();
            [speakingTimeoutRef, silenceTimerRef, timerRef].forEach(r => r.current && clearTimeout(r.current));
            if (recognitionRef.current) {
                try { recognitionRef.current.stop(); } catch {
                    // Ignore errors when stopping recognition
                }
            }
            if (timerRef.current) clearInterval(timerRef.current);
            if (videoStream) {
                videoStream.getTracks().forEach(t => t.stop());
            }
        };
    }, [videoStream]);

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

    const questionsAsked = chatHistory.filter(m => m.role === 'assistant' && !m.isWrapUp).length;
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
            // Schedule automatic listening after AI finishes speaking
            speakingTimeoutRef.current = setTimeout(() => { 
                if (isInterviewActiveRef.current && !isListeningRef.current) {
                    setIsListening(true);
                    if (recognitionRef.current) {
                        try { recognitionRef.current.start(); } catch { /* ignore */ }
                    }
                }
            }, 500);
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
        const newUserAnswerCount = updatedChat.filter(m => m.role === 'user').length;
        setChatHistory(updatedChat);
        setUserInput('');
        setIsLoading(true);
        try {
            if (newUserAnswerCount >= questionCount) {
                const wrapUpMessage = {
                    role: 'assistant',
                    content: "Thank you for completing this interview! You've demonstrated great effort and answered all the questions thoughtfully. Your interview has been recorded and will be evaluated shortly. This session will end now, and you'll see your detailed performance report.",
                    isWrapUp: true
                };
                setChatHistory([...updatedChat, wrapUpMessage]);
                speakText(wrapUpMessage.content);
                setTimeout(() => {
                    if (isInterviewActiveRef.current && endInterviewRef.current) {
                        endInterviewRef.current();
                    }
                }, 3000);
            } else {
                const res = await api.post('/preparation/mock-interview/chat', {
                    candidateProfile, jobRole: getEnhancedJobRole(), questionType, chatHistory: updatedChat, difficulty, questionCount
                });
                setChatHistory([...updatedChat, { role: 'assistant', content: res.data.reply }]);
                speakText(res.data.reply);
            }
        } catch (err) { 
            console.error('Failed to send message', err);
            toast.error('Failed to send message.'); 
        }
        finally { setIsLoading(false); }
    }, [chatHistory, candidateProfile, questionType, difficulty, questionCount, speakText, getEnhancedJobRole]);

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
                silenceTimerRef.current = setTimeout(() => submitChat(userInputRef.current), 5000);
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
            silenceTimerRef.current = setTimeout(() => submitChat(""), 5000);
        }
    }, [isListening, submitChat]);

    useEffect(() => { chatEndRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [chatHistory]);

    // ─── Actions ───
    const startInterview = async (e) => {
        if (e) e.preventDefault();

        // 1. MUST go fullscreen instantly to avoid the browser blocking it
        try {
            if (document.documentElement.requestFullscreen) {
                document.documentElement.requestFullscreen().catch(err => console.warn('Fullscreen failed:', err));
            }
        } catch (err) {
            console.warn('Fullscreen request failed:', err);
        }

        try {
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: true });
            setVideoStream(stream);
        } catch { 
            toast.error('Microphone and Camera access required.'); 
            return; 
        }
        setIsLoading(true);
        const formData = new FormData();
        
        let enhancedJobRole = jobRole;
        if (jobPrep) {
            enhancedJobRole = `${jobRole} | Job Description: ${jobPrep.description ? jobPrep.description.substring(0, 100) + '...' : 'N/A'} | Required Skills: ${jobPrep.skills?.join(', ') || 'N/A'}`;
        }
        
        formData.append('jobRole', enhancedJobRole); formData.append('questionType', questionType);
        formData.append('difficulty', difficulty); formData.append('questionCount', questionCount);
        if (resume) formData.append('resume', resume);
        try {
            const res = await api.post('/preparation/mock-interview/start', formData, { headers: { 'Content-Type': 'multipart/form-data' } });
            setCandidateProfile(res.data.candidateProfile);
            setChatHistory([{ role: 'assistant', content: res.data.initialReply }]);
            autoEndTriggeredRef.current = false;
            isInterviewActiveRef.current = true; setStep('interview'); setInterviewTime(0);

            speakText(res.data.initialReply);
        } catch (err) { toast.error(err.response?.data?.error || 'Failed to start.'); }
        finally { setIsLoading(false); }
    };

    const getEnhancedJobRole = useCallback(() => {
        if (!jobPrep) return jobRole;
        return `${jobRole} | Job Description: ${jobPrep.description ? jobPrep.description.substring(0, 150) + '...' : 'N/A'} | Required Skills: ${jobPrep.skills?.join(', ') || 'N/A'}`;
    }, [jobPrep, jobRole]);

    const sendMessage = async (e) => {
        e?.preventDefault();
        if (!isInterviewActiveRef.current || !userInput.trim()) return;
        if (isListening && recognitionRef.current) { recognitionRef.current.stop(); setIsListening(false); }
        stopSpeaking();
        const updatedChat = [...chatHistory, { role: 'user', content: userInput }];
        const newUserAnswerCount = updatedChat.filter(m => m.role === 'user').length;
        setChatHistory(updatedChat); setUserInput(''); setIsLoading(true);
        try {
            // Check if user just answered the final question
            if (newUserAnswerCount >= questionCount) {
                // Send wrap-up message
                const wrapUpMessage = {
                    role: 'assistant',
                    content: "Thank you for completing this interview! You've demonstrated great effort and answered all the questions thoughtfully. Your interview has been recorded and will be evaluated shortly. This session will end now, and you'll see your detailed performance report.",
                    isWrapUp: true
                };
                setChatHistory([...updatedChat, wrapUpMessage]);
                speakText(wrapUpMessage.content);
                // Auto-evaluate after a short delay
                setTimeout(() => {
                    if (isInterviewActiveRef.current) {
                        endInterview();
                    }
                }, 3000);
            } else {
                // Continue with next question
                const res = await api.post('/preparation/mock-interview/chat', {
                    candidateProfile, jobRole, questionType, chatHistory: updatedChat, difficulty, questionCount
                });
                setChatHistory([...updatedChat, { role: 'assistant', content: res.data.reply }]);
                speakText(res.data.reply);
            }
        } catch { toast.error('Failed to send message.'); }
        finally { setIsLoading(false); }
    };

    const endInterview = useCallback(async () => {
        isInterviewActiveRef.current = false; stopSpeaking();
        [silenceTimerRef, timerRef].forEach(r => { if (r.current) { clearTimeout(r.current); clearInterval(r.current); } });
        if (recognitionRef.current) recognitionRef.current.stop();
        setIsListening(false); setIsLoading(true);
        try {
            if (document.exitFullscreen && document.fullscreenElement) {
                await document.exitFullscreen();
            }
        } catch (err) {
            console.warn('Exit fullscreen failed:', err);
        }
        try {
            const res = await api.post('/preparation/mock-interview/evaluate', { jobRole: getEnhancedJobRole(), questionType, chatHistory, difficulty });
            setEvaluation(res.data.evaluation); setStep('evaluation');
        } catch { toast.error('Failed to generate evaluation.'); }
        finally { setIsLoading(false); }
    }, [questionType, chatHistory, difficulty, getEnhancedJobRole]);

    useEffect(() => { endInterviewRef.current = endInterview; }, [endInterview]);

    // Snapshot interval for checking attention
    useEffect(() => {
        let interval;
        if (step === 'interview' && videoRef.current && videoStream) {
            videoRef.current.srcObject = videoStream;
            interval = setInterval(async () => {
                try {
                    const canvas = document.createElement('canvas');
                    const video = videoRef.current;
                    if (!video) return;
                    canvas.width = video.videoWidth;
                    canvas.height = video.videoHeight;
                    const ctx = canvas.getContext('2d');
                    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
                    const dataUrl = canvas.toDataURL('image/jpeg');
                    const base64Image = dataUrl.split(',')[1];
                    const response = await fetch("https://models.inference.ai.azure.com/chat/completions", {
                        method: "POST",
                        headers: {
                            "Content-Type": "application/json",
                            "Authorization": `Bearer ${import.meta.env.VITE_GITHUB_TOKEN}`
                        },
                        body: JSON.stringify({
                            model: "gpt-4o",
                            messages: [
                                {
                                    role: "user",
                                    content: [
                                        { type: "text", text: "Look at the person in this image. Are they directly looking at the camera/screen? Reply with only a single word: YES or NO." },
                                        { type: "image_url", image_url: { url: `data:image/jpeg;base64,${base64Image}` } }
                                    ]
                                }
                            ]
                        })
                    });
                    const data = await response.json();
                    const answer = data.choices?.[0]?.message?.content?.trim().toUpperCase();
                    if (answer === 'NO' || answer?.includes('NO')) {
                        setGazeWarnings(prev => prev + 1);
                        toast.error("Please look at the screen!", { icon: '👀' });
                    }
                } catch (e) {
                    console.error("Gaze check failed", e);
                }
            }, 10000); // Check every 10 seconds
        }
        return () => {
            if (interval) clearInterval(interval);
        };
    }, [step, videoStream]);

    const resetInterview = () => { 
        setStep('setup'); 
        setChatHistory([]); 
        setEvaluation(null); 
        setInterviewTime(0); 
        setGazeWarnings(0);
        autoEndTriggeredRef.current = false;
    };

    // ─── RENDER ───
    // Conditional rendering: Layout only for setup, plain fullscreen for interview/evaluation
    if (step === 'interview' || step === 'evaluation') {
        return (
            <>
                <style>{`
                    @keyframes waveform { from { transform: scaleY(0.4); } to { transform: scaleY(1); } }
                    body { overflow: hidden; }
                `}</style>
                
                {/* ═══ INTERVIEW ═══ */}
                {step === 'interview' && (
                    <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, width: '100%', height: '100vh', zIndex: 9999, background: 'white', display: 'flex', flexDirection: 'column', margin: 0, padding: 0, overflow: 'hidden' }}>
                        {/* Top bar */}
                        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 bg-white shadow-sm">
                            <div className="flex items-center gap-4">
                                <motion.div animate={{ scale: [1, 1.2, 1] }} transition={{ duration: 2, repeat: Infinity }}
                                    className="w-3 h-3 rounded-full bg-emerald-500 shadow-lg" />
                                <span className="text-gray-900 font-bold tracking-wide">Live Interview</span>
                                <span className="text-gray-400">•</span>
                                <span className="text-gray-600 font-medium">{jobRole} • {questionType}</span>
                            </div>
                            <div className="flex items-center gap-5">
                                <div className="flex items-center gap-2 text-gray-700 text-sm font-mono bg-gray-100 px-3 py-1.5 rounded-lg border border-gray-200">
                                    <FiClock className="w-4 h-4 text-blue-600" />
                                    {formatTime(interviewTime)}
                                </div>
                                <span className="text-xs font-bold bg-blue-100 text-blue-700 px-3 py-1.5 rounded-full border border-blue-200">
                                    Q{questionsAsked}/{questionCount}
                                </span>
                                <button onClick={endInterview} data-interview-end-button className="text-sm font-semibold border border-red-300 hover:bg-red-50 hover:border-red-400 px-4 py-1.5 rounded-lg text-red-600 flex items-center gap-2 transition-all">
                                    <FiSquare className="w-3.5 h-3.5" /> End Session
                                </button>
                            </div>
                        </div>

                        {/* Main area */}
                        <div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>
                            {/* AI Panel */}
                            <div className="relative lg:w-1/3 flex flex-col items-center justify-center p-8 border-b lg:border-b-0 lg:border-r border-gray-200 bg-gradient-to-b from-blue-50 to-white">
                                {/* Local Video PiP */}
                                <div className="absolute top-4 left-4 w-32 h-24 rounded-lg overflow-hidden border-2 border-white shadow-lg bg-black z-10">
                                    <video ref={videoRef} autoPlay muted className="w-full h-full object-cover transform -scale-x-100" />
                                </div>
                                <AIAvatar isSpeaking={isSpeaking} />
                                <h3 className="text-gray-900 font-bold text-xl mt-5">Sarah Chen</h3>
                                <p className="text-gray-600 text-sm font-medium">Senior AI Interviewer</p>
                                <motion.div initial={{ scale: 0.95 }} animate={{ scale: 1 }} className="mt-5 glass-card rounded-xl px-5 py-3">
                                    <span className={`text-sm font-semibold transition-colors ${isSpeaking ? 'text-blue-600' : isLoading ? 'text-amber-600' : 'text-green-600'}`}>
                                        {isSpeaking ? '🎙️ Speaking...' : isLoading ? '🤔 Thinking...' : '👂 Listening'}
                                    </span>
                                </motion.div>
                            </div>

                            {/* Chat / Transcript */}
                            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', background: 'white' }}>
                                <div style={{ flex: 1, overflowY: 'auto', padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                                    {chatHistory.map((msg, idx) => (
                                        <motion.div key={idx} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
                                            className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                                            <div className={`max-w-[80%] p-4 rounded-2xl transition-all ${msg.role === 'assistant'
                                                ? 'glass-card text-gray-800 rounded-tl-sm shadow-sm border border-blue-100' : 'bg-blue-600 text-white rounded-tr-sm shadow-md'}`}>
                                                <span className="text-[10px] font-bold uppercase tracking-widest block mb-1.5" style={{ color: msg.role === 'assistant' ? '#2563eb' : 'white' }}>
                                                    {msg.role === 'assistant' ? '🤖 Sarah' : '👤 You'}
                                                </span>
                                                <p className="whitespace-pre-wrap leading-relaxed text-sm">{msg.content}</p>
                                            </div>
                                        </motion.div>
                                    ))}
                                    {isLoading && (
                                        <div className="flex justify-start"><div className="glass-card p-4 rounded-2xl rounded-tl-sm flex items-center gap-3 shadow-sm border border-blue-100">
                                            <span className="text-[10px] font-bold text-blue-600 uppercase">Sarah</span>
                                            <span className="flex gap-1.5">{[0,1,2].map(i => <motion.span key={i} className="w-2 h-2 bg-blue-600 rounded-full" animate={{ y: [-4, 4, -4] }} transition={{ duration: 0.6, repeat: Infinity, delay: i*0.1 }} />)}</span>
                                        </div></div>
                                    )}
                                    <div ref={chatEndRef} />
                                </div>

                                {/* Input bar */}
                                <div className="p-4 border-t border-gray-200 bg-white shadow-sm">
                                    <form onSubmit={sendMessage} className="flex gap-3 items-center">
                                        <motion.button type="button" onClick={toggleListening} disabled={isLoading}
                                            whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}
                                            className={`w-14 h-14 shrink-0 rounded-2xl flex items-center justify-center transition-all font-bold ${isListening
                                                ? 'bg-red-100 border-2 border-red-500 text-red-600 shadow-md' : 'glass-card text-gray-600 hover:text-blue-600 border border-gray-300 hover:border-blue-300'} disabled:opacity-50`}>
                                            <FiMic className="w-6 h-6" />
                                        </motion.button>
                                        <input value={userInput} onChange={e => setUserInput(e.target.value)} disabled={isLoading || isListening}
                                            placeholder={isListening ? "Listening... speak now" : "Type your answer..."} 
                                            className="input-field flex-1 h-14 px-5 rounded-2xl focus:ring-2 focus:ring-blue-500/50 focus:ring-opacity-50 outline-none" />
                                        <motion.button type="submit" disabled={isLoading || !userInput.trim()}
                                            whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}
                                            className="w-14 h-14 shrink-0 gradient-btn rounded-2xl flex items-center justify-center disabled:opacity-30 transition-all shadow-md">
                                            <FiSend className="w-5 h-5" />
                                        </motion.button>
                                    </form>
                                </div>
                            </div>
                        </div>
                    </div>
                )}

                {/* ═══ EVALUATION ═══ */}
                {step === 'evaluation' && evaluation && (
                    <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, width: '100%', height: '100vh', zIndex: 9999, background: 'var(--bg-primary)', overflowY: 'auto', overflowX: 'hidden', margin: 0, padding: 0 }}>
                        <div style={{ width: '100%', maxWidth: '1000px', margin: '0 auto', padding: '3rem 2rem 4rem' }}>
                            {/* Header with Success */}
                            <div style={{ textAlign: 'center', marginBottom: '3rem' }}>
                                <div style={{
                                    width: '100px',
                                    height: '100px',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    background: 'rgba(34, 197, 94, 0.1)',
                                    borderRadius: 'var(--radius-sm)',
                                    fontSize: '3.5rem',
                                    margin: '0 auto 1.5rem',
                                    boxShadow: '0 10px 30px rgba(34, 197, 94, 0.2)'
                                }}>✨</div>
                                <h1 style={{ fontSize: '2.5rem', fontWeight: 800, margin: '0 0 0.5rem', color: 'var(--text-primary)' }}>Interview Complete!</h1>
                                <p style={{ color: 'var(--text-secondary)', fontSize: '1.1rem', margin: 0, marginTop: '0.5rem' }}>
                                    {jobRole} • {questionType} • {difficulty} • {formatTime(interviewTime)}
                                </p>
                            </div>

                            {/* Score Card */}
                            <div style={{
                                background: 'var(--bg-card)',
                                borderRadius: 'var(--radius-sm)',
                                padding: '3rem',
                                border: '1px solid var(--border)',
                                boxShadow: 'var(--shadow)',
                                marginBottom: '2rem'
                            }}>
                                <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '2rem' }}>
                                    <ScoreRing score={evaluation.score || 0} size={180} />
                                </div>
                            </div>

                            {/* Rest of evaluation content... */}
                            {evaluation.criteria && (
                                <div style={{
                                    background: 'var(--bg-card)',
                                    borderRadius: 'var(--radius-sm)',
                                    padding: '2.5rem',
                                    border: '1px solid var(--border)',
                                    boxShadow: 'var(--shadow)',
                                    marginBottom: '2rem'
                                }}>
                                    <h2 style={{ fontSize: '1.5rem', fontWeight: 800, margin: '0 0 2rem', color: 'var(--text-primary)' }}>Performance Breakdown</h2>
                                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '2rem' }}>
                                        {[
                                            { label: 'Technical Accuracy', key: 'technicalAccuracy', color: '#22c55e' },
                                            { label: 'Communication', key: 'communicationClarity', color: '#3b82f6' },
                                            { label: 'Problem Solving', key: 'problemSolving', color: '#f59e0b' },
                                            { label: 'Confidence & Delivery', key: 'confidenceDelivery', color: '#ec4899' }
                                        ].map(item => (
                                            <div key={item.key}>
                                                <div style={{ fontWeight: 700, color: 'var(--text-primary)', marginBottom: '0.5rem', fontSize: '0.9rem' }}>{item.label}</div>
                                                <div style={{ height: '8px', background: 'var(--border)', borderRadius: '9999px', overflow: 'hidden' }}>
                                                    <div style={{ height: '100%', width: `${((evaluation.criteria[item.key]?.score || 0) / 20) * 100}%`, background: item.color, transition: 'width 1.5s ease-out' }} />
                                                </div>
                                                <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '0.5rem', fontSize: '0.85rem' }}>
                                                    <span style={{ color: 'var(--text-secondary)' }}>Score</span>
                                                    <span style={{ fontWeight: 700, color: 'var(--text-primary)' }}>{evaluation.criteria[item.key]?.score || 0}/20</span>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}

                            {/* Feedback & Action */}
                            <div style={{
                                background: 'var(--bg-card)',
                                borderRadius: 'var(--radius-sm)',
                                padding: '2.5rem',
                                border: '1px solid var(--border)',
                                boxShadow: 'var(--shadow)',
                                marginBottom: '2rem'
                            }}>
                                <h2 style={{ fontSize: '1.3rem', fontWeight: 800, margin: '0 0 1.5rem', color: 'var(--text-primary)' }}>💡 Overall Feedback</h2>
                                <p style={{ color: 'var(--text-body)', lineHeight: 1.8, margin: 0, fontSize: '1rem' }}>{evaluation.feedback}</p>
                            </div>

                            {/* Strengths & Improvements */}
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '2rem', marginBottom: '2rem' }}>
                                <div style={{
                                    background: 'var(--bg-card)',
                                    borderRadius: 'var(--radius-sm)',
                                    padding: '2rem',
                                    border: '1px solid var(--border)',
                                    boxShadow: 'var(--shadow)'
                                }}>
                                    <h3 style={{ fontSize: '1.1rem', fontWeight: 800, marginBottom: '1.5rem', color: 'var(--text-primary)' }}>✨ Strengths</h3>
                                    <ul style={{ margin: 0, padding: 0, listStyle: 'none', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                                        {(evaluation.strengths || []).map((s, i) => (
                                            <li key={i} style={{ color: 'var(--text-body)', fontSize: '0.95rem', display: 'flex', gap: '0.75rem' }}>
                                                <span style={{ color: '#22c55e', fontWeight: 700, flexShrink: 0 }}>✓</span>
                                                <span>{s}</span>
                                            </li>
                                        ))}
                                    </ul>
                                </div>
                                <div style={{
                                    background: 'var(--bg-card)',
                                    borderRadius: 'var(--radius-sm)',
                                    padding: '2rem',
                                    border: '1px solid var(--border)',
                                    boxShadow: 'var(--shadow)'
                                }}>
                                    <h3 style={{ fontSize: '1.1rem', fontWeight: 800, marginBottom: '1.5rem', color: 'var(--text-primary)' }}>🎯 Areas to Improve</h3>
                                    <ul style={{ margin: 0, padding: 0, listStyle: 'none', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                                        {gazeWarnings > 0 && (
                                            <li style={{ color: 'var(--text-body)', fontSize: '0.95rem', display: 'flex', gap: '0.75rem' }}>
                                                <span style={{ color: '#ef4444', fontWeight: 700, flexShrink: 0 }}>👀</span>
                                                <span>You looked away from the screen {gazeWarnings} times. Try to maintain consistent eye contact.</span>
                                            </li>
                                        )}
                                        {(evaluation.improvements || []).map((s, i) => (
                                            <li key={i} style={{ color: 'var(--text-body)', fontSize: '0.95rem', display: 'flex', gap: '0.75rem' }}>
                                                <span style={{ color: '#f59e0b', fontWeight: 700, flexShrink: 0 }}>→</span>
                                                <span>{s}</span>
                                            </li>
                                        ))}
                                    </ul>
                                </div>
                            </div>

                            {/* Action Button */}
                            <div style={{ display: 'flex', justifyContent: 'center', gap: '1rem' }}>
                                <button onClick={resetInterview} style={{
                                    padding: '1.1rem 2.5rem',
                                    fontWeight: 800,
                                    borderRadius: 'var(--radius-sm)',
                                    fontSize: '1.1rem',
                                    background: 'var(--primary)',
                                    color: 'white',
                                    border: 'none',
                                    boxShadow: '0 10px 25px -5px rgba(37, 99, 235, 0.4)',
                                    cursor: 'pointer',
                                    transition: 'all 0.2s ease'
                                }}>
                                    🚀 Try Another Interview
                                </button>
                            </div>
                        </div>
                    </div>
                )}
            </>
        );
    }

    // For setup, use Layout normally
    return (
        <Layout title="AI Mock Interview">
                <div className="fade-in" style={{ width: '100%', padding: '2rem 0 3rem 0' }}>
                    <div style={{ width: '100%', paddingBottom: '1rem', textAlign: 'left' }}>
                        {/* Header */}
                        <div style={{ display: 'flex', alignItems: 'center', gap: '1.5rem', marginBottom: '2rem' }}>
                            <div style={{
                                width: '80px',
                                height: '80px',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                background: 'rgba(37, 99, 235, 0.1)',
                                borderRadius: 'var(--radius-sm)',
                                fontSize: '2.5rem',
                                color: 'var(--primary)',
                                boxShadow: '0 10px 25px rgba(37, 99, 235, 0.2)'
                            }}>🤖</div>
                            <div>
                                <h2 style={{ fontSize: '2.5rem', fontWeight: 800, margin: 0, color: 'var(--text-primary)' }}>AI Mock Interview</h2>
                                <p style={{ color: 'var(--text-secondary)', fontSize: '1.1rem', marginTop: '0.5rem', lineHeight: 1.6, maxWidth: '800px' }}>
                                    Experience real-time voice-powered interviews with AI. Get instant feedback on your technical knowledge, communication, and problem-solving.
                                </p>
                            </div>
                        </div>

                        {/* Configuration Panel */}
                        <div style={{
                            width: '100%',
                            background: 'var(--bg-card)',
                            borderRadius: 'var(--radius-sm)',
                            padding: '3rem',
                            border: '1px solid var(--border)',
                            boxShadow: 'var(--shadow)'
                        }}>
                            {/* Row 1: Role + Difficulty */}
                            <div style={{ display: 'grid', gridTemplateColumns: '1.5fr 1fr', gap: '1.5rem', marginBottom: '1.5rem' }}>
                                <div>
                                    <label style={{ fontWeight: 800, color: 'var(--text-muted)', fontSize: '0.7rem', textTransform: 'uppercase', letterSpacing: '2px', display: 'block', marginBottom: '0.5rem' }}>Target Role</label>
                                    <select value={jobRole} onChange={e => setJobRole(e.target.value)} required
                                        style={{
                                            width: '100%',
                                            padding: '0.9rem 1.25rem',
                                            borderRadius: 'var(--radius-sm)',
                                            fontSize: '1rem',
                                            fontWeight: 700,
                                            border: '2px solid var(--border)',
                                            background: 'var(--bg-card)',
                                            color: 'var(--text-primary)',
                                            cursor: 'pointer',
                                            boxShadow: 'var(--shadow-sm)',
                                            appearance: 'none',
                                            backgroundImage: 'url("data:image/svg+xml;charset=UTF-8,%3csvg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 24 24%22 fill=%27none%27 stroke=%27%23666%27 stroke-width=%272%27 stroke-linecap=%27round%27 stroke-linejoin=%27round%27%3e%3cpolyline points=%276 9 12 15 18 9%27%3e%3c/polyline%3e%3c/svg%3e")',
                                            backgroundRepeat: 'no-repeat',
                                            backgroundPosition: 'right 1rem center',
                                            backgroundSize: '1.25rem',
                                            paddingRight: '3rem'
                                        }}>
                                        {jobRoles.map(role => (
                                            <option key={role} value={role}>{role}</option>
                                        ))}
                                    </select>
                                </div>
                                <div>
                                    <label style={{ fontWeight: 800, color: 'var(--text-muted)', fontSize: '0.7rem', textTransform: 'uppercase', letterSpacing: '2px', display: 'block', marginBottom: '0.5rem' }}>Difficulty</label>
                                    <div style={{ display: 'flex', gap: '0.5rem' }}>
                                        {['Easy', 'Medium', 'Hard'].map(d => (
                                            <button key={d} type="button" onClick={() => setDifficulty(d)}
                                                style={{
                                                    flex: 1,
                                                    padding: '0.65rem 1.25rem',
                                                    borderRadius: 'var(--radius-sm)',
                                                    fontSize: '0.9rem',
                                                    fontWeight: 700,
                                                    border: `2px solid ${difficulty === d ? 'var(--primary)' : 'var(--border)'}`,
                                                    background: difficulty === d ? 'rgba(37, 99, 235, 0.15)' : 'transparent',
                                                    color: difficulty === d ? 'var(--primary)' : 'var(--text-muted)',
                                                    cursor: 'pointer',
                                                    transition: 'all 0.2s ease'
                                                }}>
                                                {d}
                                            </button>
                                        ))}
                                    </div>
                                </div>
                            </div>

                            {/* Row 2: Interview Type */}
                            <div style={{ marginBottom: '1.5rem' }}>
                                <label style={{ fontWeight: 800, color: 'var(--text-muted)', fontSize: '0.7rem', textTransform: 'uppercase', letterSpacing: '2px', display: 'block', marginBottom: '0.75rem' }}>Interview Type</label>
                                <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
                                    {[
                                        { value: 'technical', label: '⚙️ Technical' },
                                        { value: 'behavioral', label: '🧠 Behavioral' },
                                        { value: 'hr', label: '👔 HR' },
                                        { value: 'system-design', label: '🏛️ System Design' }
                                    ].map(type => (
                                        <button key={type.value} type="button" onClick={() => setQuestionType(type.value)}
                                            style={{
                                                padding: '0.65rem 1.25rem',
                                                borderRadius: 'var(--radius-sm)',
                                                fontSize: '0.9rem',
                                                fontWeight: 700,
                                                border: `2px solid ${questionType === type.value ? 'var(--primary)' : 'var(--border)'}`,
                                                background: questionType === type.value ? 'rgba(37, 99, 235, 0.15)' : 'transparent',
                                                color: questionType === type.value ? 'var(--primary)' : 'var(--text-muted)',
                                                cursor: 'pointer',
                                                transition: 'all 0.2s ease'
                                            }}>
                                            {type.label}
                                        </button>
                                    ))}
                                </div>
                            </div>

                            {/* Row 3: Question Count */}
                            <div style={{ marginBottom: '1.5rem' }}>
                                <label style={{ fontWeight: 800, color: 'var(--text-muted)', fontSize: '0.7rem', textTransform: 'uppercase', letterSpacing: '2px', display: 'block', marginBottom: '0.75rem' }}>
                                    Number of Questions: <span style={{ color: 'var(--primary)', fontSize: '1rem', fontWeight: 900 }}>{questionCount}</span>
                                </label>
                                <input type="range" min="3" max="10" value={questionCount} onChange={e => setQuestionCount(Number(e.target.value))}
                                    style={{
                                        width: '100%',
                                        marginTop: '0.75rem',
                                        accentColor: 'var(--primary)',
                                        cursor: 'pointer',
                                        height: '6px'
                                    }} />
                                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.7rem', color: 'var(--text-muted)', marginTop: '0.25rem' }}>
                                    <span>3 (Quick)</span>
                                    <span>10 (Full)</span>
                                </div>
                            </div>

                            {/* Resume Upload */}
                            <div style={{ marginBottom: '1.5rem' }}>
                                <label style={{ fontWeight: 800, color: 'var(--text-muted)', fontSize: '0.7rem', textTransform: 'uppercase', letterSpacing: '2px', display: 'block', marginBottom: '0.75rem' }}>Resume (Optional)</label>
                                <div style={{
                                    width: '100%',
                                    padding: '2rem',
                                    border: '2px dashed rgba(37, 99, 235, 0.3)',
                                    borderRadius: 'var(--radius-sm)',
                                    background: 'rgba(37, 99, 235, 0.05)',
                                    textAlign: 'center',
                                    cursor: 'pointer',
                                    transition: 'all 0.2s ease'
                                }}
                                    onClick={() => document.getElementById('resume-input').click()}
                                    onMouseEnter={(e) => e.currentTarget.style.borderColor = 'var(--primary)'}
                                    onMouseLeave={(e) => e.currentTarget.style.borderColor = 'rgba(37, 99, 235, 0.3)'}
                                >
                                    <FiUpload style={{ fontSize: '1.5rem', color: 'var(--primary)', marginBottom: '0.5rem', display: 'block', margin: '0 auto 0.5rem' }} />
                                    <p style={{ color: 'var(--text-primary)', fontWeight: 600, margin: '0.25rem 0' }}>
                                        {resume ? resume.name : 'Choose PDF resume'}
                                    </p>
                                    <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', margin: 0 }}>or drag and drop</p>
                                    <input id="resume-input" type="file" accept="application/pdf" onChange={e => setResume(e.target.files[0])} style={{ display: 'none' }} />
                                </div>
                            </div>

                            {/* Start Button */}
                            <button type="button" onClick={startInterview} disabled={isLoading}
                                style={{
                                    width: '100%',
                                    padding: '1.1rem',
                                    fontWeight: 800,
                                    borderRadius: 'var(--radius-sm)',
                                    fontSize: '1.15rem',
                                    background: 'var(--primary)',
                                    color: 'white',
                                    border: 'none',
                                    boxShadow: '0 10px 25px -5px rgba(37, 99, 235, 0.4)',
                                    cursor: isLoading ? 'not-allowed' : 'pointer',
                                    opacity: isLoading ? 0.6 : 1,
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    gap: '0.5rem',
                                    transition: 'all 0.2s ease'
                                }}>
                                {isLoading ? (
                                    <>
                                        <svg className="animate-spin" width="20" height="20" viewBox="0 0 24 24" fill="none">
                                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
                                        </svg>
                                        Starting Interview...
                                    </>
                                ) : '🎤 Start Interview'}
                            </button>
                        </div>
                    </div>
                </div>
        </Layout>
    );
};

export default AIMockInterview;
