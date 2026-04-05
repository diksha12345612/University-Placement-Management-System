import React, { useState, useEffect, useRef } from 'react';
import Layout from '../../components/Layout';
import api from '../../services/api';
import { FiMic, FiSend, FiPlay, FiSquare, FiCheckCircle } from 'react-icons/fi';
import { toast } from 'react-hot-toast';

const AIMockInterview = () => {
    const [step, setStep] = useState('setup'); // 'setup', 'interview', 'evaluation'
    const [jobRole, setJobRole] = useState('Software Engineer');
    const [questionType, setQuestionType] = useState('technical');
    const [resume, setResume] = useState(null);
    const [isLoading, setIsLoading] = useState(false);
    
    const [chatHistory, setChatHistory] = useState([]);
    const [userInput, setUserInput] = useState('');
    const [evaluation, setEvaluation] = useState(null);
    const [candidateProfile, setCandidateProfile] = useState(null);
    
    // For voice output
    const [isSpeaking, setIsSpeaking] = useState(false);
    const chatEndRef = useRef(null);

    // For voice input (Web Speech API)
    const [isListening, setIsListening] = useState(false);
    const recognitionRef = useRef(null);
    const silenceTimerRef = useRef(null);
    const userInputRef = useRef(userInput);
    
    // To sync state and refs inside event listeners
    useEffect(() => {
        userInputRef.current = userInput;
    }, [userInput]);

    // Load better voices
    const [voices, setVoices] = useState([]);
    useEffect(() => {
        const loadVoices = () => {
            setVoices(window.speechSynthesis.getVoices());
        };
        loadVoices();
        if (window.speechSynthesis.onvoiceschanged !== undefined) {
             window.speechSynthesis.onvoiceschanged = loadVoices;
        }
    }, []);

    // Function to submit chat dynamically
    const submitChat = async (textToSubmit) => {
        // Stop listening if active
        if (recognitionRef.current) {
            recognitionRef.current.stop();
            setIsListening(false);
        }
        
        if (silenceTimerRef.current) clearTimeout(silenceTimerRef.current);

        if (!textToSubmit.trim()) {
            textToSubmit = "(Candidate did not provide a response)";
        }

        stopSpeaking();
        const newMessage = { role: 'user', content: textToSubmit };
        const updatedChat = [...chatHistory, newMessage];
        setChatHistory(updatedChat);
        setUserInput('');
        setIsLoading(true);

        try {
            const res = await api.post('/preparation/mock-interview/chat', {
                candidateProfile,
                jobRole,
                questionType,
                chatHistory: updatedChat
            });
            
            const reply = res.data.reply;
            setChatHistory([...updatedChat, { role: 'assistant', content: reply }]);
            speakText(reply);
        } catch (err) {
            toast.error('Failed to send message.');
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        // Initialize Speech Recognition
        const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
        if (SpeechRecognition) {
            const recognition = new SpeechRecognition();
            recognition.continuous = true;
            recognition.interimResults = true;
            recognition.lang = 'en-US';

            recognition.onresult = (event) => {
                let currentTranscript = '';
                for (let i = 0; i < event.results.length; i++) {
                    currentTranscript += event.results[i][0].transcript;
                }
                setUserInput(currentTranscript);
                
                // Clear and reset the 10-second silence timer because user is speaking
                if (silenceTimerRef.current) clearTimeout(silenceTimerRef.current);
                silenceTimerRef.current = setTimeout(() => {
                     submitChat(userInputRef.current);
                }, 10000); 
            };

            recognition.onerror = (event) => {
                console.error("Speech recognition error", event.error);
                setIsListening(false);
            };

            recognition.onend = () => {
                setIsListening(false);
            };

            recognitionRef.current = recognition;
        }

        return () => {
            if (recognitionRef.current) {
                recognitionRef.current.stop();
            }
            if (silenceTimerRef.current) clearTimeout(silenceTimerRef.current);
        };
    }, [chatHistory]); // depend on chatHistory so submitChat uses latest state

    const toggleListening = () => {
        if (isListening) {
            recognitionRef.current?.stop();
            setIsListening(false);
            if (silenceTimerRef.current) clearTimeout(silenceTimerRef.current);
        } else {
            if (!recognitionRef.current) {
                toast.error('Your browser does not support Voice Recognition.');
                return;
            }
            setUserInput('');
            recognitionRef.current.start();
            setIsListening(true);
            
            // Start the initial 10-second timer
            if (silenceTimerRef.current) clearTimeout(silenceTimerRef.current);
            silenceTimerRef.current = setTimeout(() => {
                 submitChat("");
            }, 10000);
        }
    };

    useEffect(() => {
        if (chatEndRef.current) {
            chatEndRef.current.scrollIntoView({ behavior: 'smooth' });
        }
    }, [chatHistory]);

    const speakText = (text) => {
        if (!('speechSynthesis' in window)) return;
        window.speechSynthesis.cancel(); // Stop any current speech
        const utterance = new SpeechSynthesisUtterance(text);
        
        // Find best English professional voice
        if (voices.length > 0) {
            const desiredVoice = voices.find(v => v.name.includes("Google US English") || v.name.includes("Zira") || v.lang === "en-US");
            if (desiredVoice) utterance.voice = desiredVoice;
        }
        
        utterance.rate = 1.0;
        utterance.pitch = 1.05;

        utterance.onstart = () => setIsSpeaking(true);
        utterance.onend = () => {
            setIsSpeaking(false);
            // Once AI finishes speaking, auto-start mic (if un-muted logic allows)
            setTimeout(() => {
                 toggleListening();
            }, 500);
        };
        window.speechSynthesis.speak(utterance);
    };

    const stopSpeaking = () => {
        if ('speechSynthesis' in window) {
            window.speechSynthesis.cancel();
            setIsSpeaking(false);
        }
    };

    const handleFileChange = (e) => {
        setResume(e.target.files[0]);
    };

    const startInterview = async (e) => {
        e.preventDefault();

        try {
            // Request Mic permission immediately
            await navigator.mediaDevices.getUserMedia({ audio: true });
        } catch(err) {
            toast.error('Microphone access is required for the AI Mock Interview.');
            return;
        }

        setIsLoading(true);
        const formData = new FormData();
        formData.append('jobRole', jobRole);
        formData.append('questionType', questionType);
        if (resume) {
            formData.append('resume', resume);
        }

        try {
            const res = await api.post('/preparation/mock-interview/start', formData, {
                headers: { 'Content-Type': 'multipart/form-data' }
            });
            const firstReply = res.data.initialReply;
            setCandidateProfile(res.data.candidateProfile);
            setChatHistory([{ role: 'assistant', content: firstReply }]);
            setStep('interview');
            speakText(firstReply);
        } catch (err) {
            toast.error(err.response?.data?.error || 'Failed to start interview.');
        } finally {
            setIsLoading(false);
        }
    };

    const sendMessage = async (e) => {
        e?.preventDefault();
        
        // Stop listening if active
        if (isListening && recognitionRef.current) {
            recognitionRef.current.stop();
            setIsListening(false);
        }

        if (!userInput.trim()) return;
        
        stopSpeaking();
        const newMessage = { role: 'user', content: userInput };
        const updatedChat = [...chatHistory, newMessage];
        setChatHistory(updatedChat);
        setUserInput('');
        setIsLoading(true);

        try {
            const res = await api.post('/preparation/mock-interview/chat', {
                candidateProfile,
                jobRole,
                questionType,
                chatHistory: updatedChat
            });
            
            const reply = res.data.reply;
            setChatHistory([...updatedChat, { role: 'assistant', content: reply }]);
            speakText(reply);
        } catch (err) {
            toast.error('Failed to send message.');
        } finally {
            setIsLoading(false);
        }
    };

    const endInterview = async () => {
        stopSpeaking();
        setIsLoading(true);
        try {
            const res = await api.post('/preparation/mock-interview/evaluate', {
                jobRole,
                questionType,
                chatHistory
            });
            setEvaluation(res.data.evaluation);
            setStep('evaluation');
        } catch (err) {
             toast.error('Failed to generate evaluation.');
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <Layout title="AI Mock Interview">
            <div className="fade-in max-w-4xl mx-auto mt-8 mb-12">
                {step === 'setup' && (
                    <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-8 text-left">
                        <div className="mb-8">
                            <h2 className="text-3xl font-extrabold text-gray-900 tracking-tight">Voice-Enabled AI Interview</h2>
                            <p className="text-gray-600 mt-2">Simulate a live interview based on your resume</p>
                        </div>

                        <form onSubmit={startInterview} className="space-y-6">  
                            <div>
                                <label className="block text-sm font-bold text-gray-800 mb-2">Target Job Role</label>
                                <input 
                                    type="text"
                                    value={jobRole}
                                    onChange={(e) => setJobRole(e.target.value)}
                                    className="w-full p-3.5 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all outline-none"
                                    required
                                    placeholder="e.g. Frontend Developer, Data Scientist..."
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-bold text-gray-800 mb-2">Interview Type</label>
                                <select
                                    value={questionType}
                                    onChange={(e) => setQuestionType(e.target.value)}
                                    className="w-full p-3.5 border border-gray-200 rounded-xl bg-white focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all outline-none"
                                >
                                    <option value="technical">Technical (Coding & Arch)</option>
                                    <option value="behavioral">Behavioral (Leadership & Teamwork)</option>
                                    <option value="hr">HR (General Fit)</option>
                                    <option value="system-design">System Design</option>
                                </select>
                            </div>
                            <div>
                                <label className="block text-sm font-bold text-gray-800 mb-2">Upload Resume (PDF - Strongly Recommended)</label>
                                <div className="p-2 border border-gray-200 rounded-xl bg-gray-50/50">
                                    <input
                                        type="file"
                                        accept="application/pdf"
                                        onChange={handleFileChange}
                                        className="w-full text-sm text-gray-600 file:mr-4 file:py-2.5 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-semibold file:bg-gray-200 file:text-gray-800 hover:file:bg-gray-300 cursor-pointer transition-colors"
                                    />
                                </div>
                                <p className="text-xs text-gray-500 mt-3 ml-1">      
                                    We use <strong>GitHub Models</strong> to extract your skills and personalize the conversation just like a real recruiter.   
                                </p>
                            </div>

                            <button
                                type="submit"
                                disabled={isLoading}
                                className="w-full mt-6 bg-blue-600 text-white py-4 rounded-xl font-bold text-lg hover:bg-blue-700 transition shadow-sm flex items-center justify-center disabled:opacity-70 disabled:cursor-not-allowed"
                            >
                                {isLoading ? (
                                    <>
                                        <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                        </svg>
                                        Analyzing Resume & Starting Engine...
                                    </>
                                ) : 'Start AI Interview'}
                            </button>
                        </form>
                    </div>
                )}

                {step === 'interview' && (
                    <div className="bg-white rounded-2xl shadow-sm border border-gray-100 flex flex-col h-[75vh] overflow-hidden text-left">
                        <div className="bg-blue-600 text-white p-5 flex justify-between items-center z-10">
                            <div>
                                <h3 className="font-bold text-xl flex items-center gap-2">
                                    AI Interviewer
                                    <div className={`w-2.5 h-2.5 rounded-full ml-2 ${isSpeaking ? 'bg-green-400 animate-pulse' : 'bg-white/50'}`}></div>
                                </h3>
                                <p className="text-sm text-blue-100 mt-1 font-medium">{jobRole} | {questionType.charAt(0).toUpperCase() + questionType.slice(1)} Focus</p>
                            </div>
                            <button
                                onClick={endInterview}
                                className="text-sm border border-white/30 hover:bg-white/10 px-4 py-2 rounded-lg font-semibold text-white flex items-center gap-2 transition"   
                            >
                                <FiSquare className="w-4 h-4" /> End Interview  
                            </button>
                        </div>

                        <div className="flex-1 overflow-y-auto p-6 space-y-6 bg-gray-50/50">
                            {chatHistory.map((msg, idx) => (
                                <div key={idx} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                                    {msg.role === 'assistant' ? (
                                        <div className="max-w-[85%] bg-white border border-gray-100 p-5 rounded-2xl shadow-sm rounded-tl-sm text-gray-800">
                                            <div className="text-xs font-bold mb-2 text-gray-900">
                                                Interviewer
                                            </div>
                                            <p className="whitespace-pre-wrap leading-relaxed text-gray-700">{msg.content}</p>
                                        </div>
                                    ) : (
                                        <div className="max-w-[85%] bg-[#8fb3fc] p-5 rounded-2xl shadow-sm rounded-tr-sm text-white">
                                            <div className="text-xs font-semibold mb-2 text-blue-50">
                                                You
                                            </div>
                                            <p className="whitespace-pre-wrap leading-relaxed">{msg.content}</p>
                                        </div>
                                    )}
                                </div>
                            ))}
                            {isLoading && (
                                <div className="flex justify-start">
                                    <div className="max-w-[85%] bg-white border border-gray-100 p-5 rounded-2xl rounded-tl-sm shadow-sm flex items-center">      
                                       <div className="text-xs font-bold mr-4 text-gray-900">Interviewer</div>
                                       <span className="flex space-x-1.5">        
                                         <span className="w-2 h-2 bg-gray-300 rounded-full animate-bounce" style={{animationDelay: '-0.3s'}}></span>
                                         <span className="w-2 h-2 bg-gray-300 rounded-full animate-bounce" style={{animationDelay: '-0.15s'}}></span>
                                         <span className="w-2 h-2 bg-gray-300 rounded-full animate-bounce" style={{animationDelay: '0s'}}></span>
                                       </span>
                                    </div>
                                </div>
                            )}
                            <div ref={chatEndRef} />
                        </div>

                        <div className="p-5 bg-white border-t border-gray-100 z-10">
                            <form onSubmit={sendMessage} className="flex gap-4 items-center">
                                <button
                                    type="button"
                                    onClick={toggleListening}
                                    title={isListening ? "Stop Listening" : "Start Voice Input"}
                                    disabled={isLoading}
                                    className={`w-14 h-14 shrink-0 rounded-2xl flex items-center justify-center transition border ${
                                        isListening
                                        ? 'bg-red-50 border-red-100 text-red-500 animate-pulse'
                                        : 'bg-white border-gray-200 text-gray-600 hover:bg-gray-50'
                                    } disabled:opacity-50`}
                                >
                                    <FiMic className="w-6 h-6" />
                                </button>
                                <input
                                    value={userInput}
                                    onChange={(e) => setUserInput(e.target.value)}
                                    placeholder={isListening ? "Listening... Speak now..." : "Type your answer... (or click the Mic icon)"}
                                    className="flex-1 h-14 px-6 border border-gray-200 rounded-2xl focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white transition text-gray-700 shadow-sm"
                                    disabled={isLoading || isListening}
                                />
                                <button
                                    type="submit"
                                    disabled={isLoading || (!userInput.trim() && !isListening)}
                                    className="w-14 h-14 shrink-0 bg-[#8fb3fc] hover:bg-blue-400 text-white rounded-2xl flex items-center justify-center disabled:opacity-50 transition shadow-sm"
                                >
                                    <FiSend className="w-6 h-6" />
                                </button>
                            </form>
                            <p className="text-center text-xs text-gray-900 mt-4 font-semibold tracking-wide">
                            </p>
                        </div>
                    </div>
                )}

                {step === 'evaluation' && evaluation && (
                    <div className="bg-white rounded-lg shadow-lg p-8 text-left border">
                        <div className="text-center mb-10 pb-6 border-b">
                            <FiCheckCircle className="w-20 h-20 text-green-500 mx-auto mb-4" />
                            <h2 className="text-3xl font-bold text-gray-800">Interview Completed</h2>
                            <p className="text-gray-500 mt-2">Here is your comprehensive AI performance report.</p>
                        </div>

                        <div className="mb-10 text-center">
                            <div className="inline-block bg-blue-50 p-6 rounded-2xl border border-blue-100 shadow-sm w-48">
                                <h3 className="text-blue-800 font-bold mb-2 uppercase tracking-wide text-sm">Overall Score</h3>
                                <div className="text-6xl font-black text-blue-600">{evaluation.score || 0}<span className="text-2xl text-blue-400">/100</span></div>
                            </div>
                        </div>

                        <div className="mb-10">
                            <h3 className="text-xl font-bold text-gray-800 border-b-2 border-gray-100 pb-3 mb-4">Detailed Feedback</h3>
                            <p className="text-gray-700 bg-gray-50 p-6 rounded-lg leading-relaxed shadow-inner border border-gray-100 text-lg">
                                {evaluation.feedback}
                            </p>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                            <div className="bg-green-50 border border-green-200 p-6 rounded-xl shadow-sm">
                                <h3 className="text-green-800 font-bold mb-4 flex items-center gap-2 text-lg">
                                    <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20" xmlns="http://www.w3.org/2000/svg"><path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd"></path></svg>
                                    Core Strengths
                                </h3>
                                <ul className="list-disc list-inside space-y-2 text-green-800 pl-2">
                                    {(evaluation.strengths || []).map((s, i) => <li key={i} className="leading-snug">{s}</li>)}
                                </ul>
                            </div>
                            <div className="bg-red-50 border border-red-200 p-6 rounded-xl shadow-sm">
                                <h3 className="text-red-800 font-bold mb-4 flex items-center gap-2 text-lg">
                                    <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20" xmlns="http://www.w3.org/2000/svg"><path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd"></path></svg>
                                    Areas for Improvement
                                </h3>
                                <ul className="list-disc list-inside space-y-2 text-red-800 pl-2">
                                    {(evaluation.improvements || []).map((s, i) => <li key={i} className="leading-snug">{s}</li>)}
                                </ul>
                            </div>
                        </div>
                        
                        <div className="mt-12 text-center border-t pt-8">
                             <button 
                                onClick={() => {
                                    setStep('setup');
                                    setChatHistory([]);
                                    setEvaluation(null);
                                }}
                                className="bg-gray-800 hover:bg-gray-900 shadow-md text-white px-8 py-3 rounded-lg font-bold text-lg transition"
                             >
                                Start New Interview
                             </button>
                        </div>
                    </div>
                )}
            </div>
        </Layout>
    );
};

export default AIMockInterview;
