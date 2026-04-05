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
        };
    }, []);

    const toggleListening = () => {
        if (isListening) {
            recognitionRef.current?.stop();
            setIsListening(false);
        } else {
            if (!recognitionRef.current) {
                toast.error('Your browser does not support Voice Recognition.');
                return;
            }
            setUserInput('');
            recognitionRef.current.start();
            setIsListening(true);
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
        utterance.onstart = () => setIsSpeaking(true);
        utterance.onend = () => setIsSpeaking(false);
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
            <div className="fade-in max-w-4xl mx-auto mt-6">
                {step === 'setup' && (
                    <div className="bg-white rounded-lg shadow-md p-8 text-left border">
                        <div className="mb-6 flex justify-between items-center">
                            <div>
                                <h2 className="text-2xl font-bold text-gray-800">Voice-Enabled AI Interview</h2>
                                <p className="text-gray-500 text-sm mt-1">Simulate a live interview based on your resume</p>
                            </div>
                        </div>

                        <form onSubmit={startInterview} className="space-y-5">
                            <div>
                                <label className="block text-sm font-semibold text-gray-700 mb-1">Target Job Role</label>
                                <input 
                                    type="text" 
                                    value={jobRole} 
                                    onChange={(e) => setJobRole(e.target.value)}
                                    className="w-full p-3 border rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-shadow"
                                    required
                                    placeholder="e.g. Frontend Developer, Data Scientist..."
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-semibold text-gray-700 mb-1">Interview Type</label>
                                <select 
                                    value={questionType} 
                                    onChange={(e) => setQuestionType(e.target.value)}
                                    className="w-full p-3 border rounded-md bg-white focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                                >
                                    <option value="technical">Technical (Coding & Arch)</option>
                                    <option value="behavioral">Behavioral (Leadership & Teamwork)</option>
                                    <option value="hr">HR (General Fit)</option>
                                    <option value="system-design">System Design</option>
                                </select>
                            </div>
                            <div>
                                <label className="block text-sm font-semibold text-gray-700 mb-2">Upload Resume (PDF - Strongly Recommended)</label>
                                <div className="p-4 border-2 border-dashed border-gray-300 rounded-md bg-gray-50 flex items-center justify-center">
                                    <input 
                                        type="file" 
                                        accept="application/pdf"
                                        onChange={handleFileChange}
                                        className="w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-md file:border-0 file:text-sm file:font-semibold file:bg-blue-100 file:text-blue-700 hover:file:bg-blue-200 cursor-pointer"
                                    />
                                </div>
                                <p className="text-xs text-gray-500 mt-2">
                                    We use <strong>GitHub Models</strong> to extract your skills and personalize the conversation just like a real recruiter.
                                </p>
                            </div>
                            
                            <button 
                                type="submit" 
                                disabled={isLoading}
                                className="w-full mt-8 bg-blue-600 text-white py-3 rounded-md font-bold text-lg hover:bg-blue-700 transition flex items-center justify-center disabled:opacity-70 disabled:cursor-not-allowed"
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
                    <div className="bg-white rounded-lg shadow-md h-[75vh] flex flex-col border overflow-hidden text-left">
                        <div className="bg-blue-600 text-white p-4 flex justify-between items-center shadow z-10">
                            <div>
                                <h3 className="font-bold text-lg flex items-center gap-2">
                                    <div className={`w-3 h-3 rounded-full ${isSpeaking ? 'bg-green-400 animate-pulse' : 'bg-red-400'}`}></div> 
                                    AI Interviewer
                                </h3>
                                <p className="text-xs text-blue-100 mt-0.5">{jobRole} | {questionType.charAt(0).toUpperCase() + questionType.slice(1)} Focus</p>
                            </div>
                            <button 
                                onClick={endInterview}
                                className="text-sm bg-red-600 hover:bg-red-700 px-4 py-2 rounded font-semibold text-white flex items-center gap-2 transition"
                            >
                                <FiSquare className="w-4 h-4" /> End Interview
                            </button>
                        </div>
                        
                        <div className="flex-1 overflow-y-auto p-6 space-y-6 bg-gray-50">
                            {chatHistory.map((msg, idx) => (
                                <div key={idx} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                                    <div className={`max-w-[80%] p-4 rounded-xl shadow-sm ${msg.role === 'user' ? 'bg-blue-600 text-white rounded-br-sm' : 'bg-white border rounded-bl-sm text-gray-800'}`}>
                                        <div className="text-xs font-semibold mb-1 opacity-75">
                                            {msg.role === 'user' ? 'You' : 'Interviewer'}
                                        </div>
                                        <p className="whitespace-pre-wrap leading-relaxed">{msg.content}</p>
                                    </div>
                                </div>
                            ))}
                            {isLoading && (
                                <div className="flex justify-start">
                                    <div className="bg-white border text-gray-800 p-4 rounded-xl rounded-bl-sm shadow-sm text-sm flex gap-2 items-center">
                                       <span className="flex space-x-1">
                                         <span className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{animationDelay: '0ms'}}></span>
                                         <span className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{animationDelay: '150ms'}}></span>
                                         <span className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{animationDelay: '300ms'}}></span>
                                       </span>
                                    </div>
                                </div>
                            )}
                            <div ref={chatEndRef} />
                        </div>
                        
                        <div className="p-4 bg-white border-t z-10 shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.05)]">
                            <form onSubmit={sendMessage} className="flex gap-3">
                                <button
                                    type="button"
                                    onClick={toggleListening}
                                    title={isListening ? "Stop Listening" : "Start Voice Input"}
                                    disabled={isLoading}
                                    className={`p-4 rounded-lg flex items-center justify-center transition shadow-sm ${
                                        isListening 
                                        ? 'bg-red-500 hover:bg-red-600 text-white animate-pulse' 
                                        : 'bg-gray-200 hover:bg-gray-300 text-gray-700'
                                    } disabled:opacity-50`}
                                >
                                    <FiMic className="w-5 h-5" />
                                </button>
                                <input 
                                    value={userInput}
                                    onChange={(e) => setUserInput(e.target.value)}
                                    placeholder={isListening ? "Listening... Speak now..." : "Type your answer... (or click the Mic icon)"}
                                    className="flex-1 p-4 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-gray-50 transition"
                                    disabled={isLoading || isListening}
                                />
                                <button 
                                    type="submit"
                                    disabled={isLoading || (!userInput.trim() && !isListening)}
                                    className="bg-blue-600 hover:bg-blue-700 text-white px-6 rounded-lg flex items-center justify-center disabled:opacity-50 transition shadow-sm"
                                >
                                    <FiSend className="w-5 h-5" />
                                </button>
                            </form>
                            <p className="text-center text-xs text-gray-400 mt-3 font-medium">
                                Pro Tip: Click the microphone icon to answer using your voice directly in the browser natively!
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