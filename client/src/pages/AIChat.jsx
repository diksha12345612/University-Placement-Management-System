import { useState, useRef, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { FiSend, FiUser, FiCpu, FiArrowLeft } from 'react-icons/fi';
import { useNavigate } from 'react-router-dom';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import api from '../services/api';

const AIChat = () => {
    const { user } = useAuth();
    const navigate = useNavigate();
    const [messages, setMessages] = useState([
        {
            role: 'assistant',
            content: `Hello ${user?.name?.split(' ')[0] || ''}! I am your AI Placement Assistant. Ask me anything about your analytics, resume, or how to improve your chances.`,
        }
    ]);
    const [input, setInput] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const messagesEndRef = useRef(null);

    const scrollToBottom = () => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    };

    useEffect(() => {
        scrollToBottom();
    }, [messages]);

    useEffect(() => {
    AI Agent
    Hello Admin Mohit. I'm your AI Director. Ask me for data-driven insights about university placements, student averages, and performance metrics.
    You
    give me the list of all the students
    AI Agent
    {"_query": true, "collection": "User", "query": {}}
    
    
        if (user?.role === 'admin') {
            setMessages([
                {
                    role: 'assistant',
                    content: `Hello Admin ${user?.name?.split(' ')[0] || ''}. I'm your AI Director. Ask me for data-driven insights about university placements, student averages, and performance metrics.`,
                }
            ]);
        }
    }, [user?.role, user?.name]);

    const sendMessage = async (e) => {
        e.preventDefault();
        if (!input.trim() || isLoading) return;

        const userMessage = input.trim();
        setInput('');
        
        const newMessages = [...messages, { role: 'user', content: userMessage }];
        setMessages(newMessages);
        setIsLoading(true);

        try {
            // Include recent context
            const chatHistory = newMessages.slice(-5);
            
            const response = await api.post('/insights/chat', {
                message: userMessage,
                chatHistory
            });

            setMessages([...newMessages, { role: 'assistant', content: response.data.reply }]);
        } catch (error) {
            console.error('Chat Error:', error);
            setMessages([...newMessages, { role: 'assistant', content: 'Sorry, I am having trouble connecting to my servers right now. Please try again later.' }]);
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div style={styles.pageContainer}>
            <div style={styles.topBar}>
                <button onClick={() => navigate(-1)} style={styles.backButton}>
                    <FiArrowLeft style={{ marginRight: '8px' }} /> Back to Dashboard
                </button>
            </div>
            <div style={styles.container}>
                <div style={styles.header}>
                    <div style={styles.headerTitle}>
                        <FiCpu style={styles.icon} />
                        <h2>AI Insights Assistant {user?.role === 'admin' ? '(Admin Mode)' : ''}</h2>
                    </div>
                    <span style={styles.badge}>Powered by RAG & GenAI</span>
                </div>

                <div style={styles.chatBox}>
                    <div style={styles.chatBoxInner}>
                        {messages.map((msg, idx) => (
                            <div
                                key={idx}
                                style={{
                                    ...styles.messageWrapper,
                                    justifyContent: msg.role === 'user' ? 'flex-end' : 'flex-start'
                                }}
                            >
                                <div style={{
                                    ...styles.messageBubble,
                                    backgroundColor: msg.role === 'user' ? '#4F46E5' : '#F3F4F6',
                                    color: msg.role === 'user' ? 'white' : '#1F2937',
                                    borderBottomRightRadius: msg.role === 'user' ? '4px' : '16px',
                                    borderBottomLeftRadius: msg.role === 'user' ? '16px' : '4px',
                                }}>
                                    <div style={styles.messageHeader}>
                                        {msg.role === 'user' ? <FiUser /> : <FiCpu />}
                                        <strong>{msg.role === 'user' ? 'You' : 'AI Agent'}</strong>
                                    </div>
                                    <div style={styles.messageContent} className={msg.role === 'assistant' ? 'markdown-body' : ''}>
                                        {msg.role === 'user' ? (
                                            msg.content.split('\n').map((line, i) => (
                                                <span key={i}>
                                                    {line}
                                                    <br />
                                                </span>
                                            ))
                                        ) : (
                                            <ReactMarkdown 
                                                remarkPlugins={[remarkGfm]}
                                                components={{
                                                    a: ({node, ...props}) => <a {...props} target="_blank" rel="noopener noreferrer" style={{color: '#2563EB', textDecoration: 'underline'}}/>,
                                                    p: ({node, ...props}) => <p style={{marginBottom: '0.75rem'}} {...props} />,
                                                }}
                                            >
                                                {msg.content}
                                            </ReactMarkdown>
                                        )}
                                    </div>
                                </div>
                            </div>
                        ))}
                        
                        {isLoading && (
                            <div style={{...styles.messageWrapper, justifyContent: 'flex-start'}}>
                                <div style={{...styles.messageBubble, backgroundColor: '#F3F4F6', color: '#6B7280'}}>
                                    <i>Analyzing your data...</i>
                                </div>
                            </div>
                        )}
                        <div ref={messagesEndRef} />
                    </div>
                </div>

                <form onSubmit={sendMessage} style={styles.inputArea}>
                <input
                    type="text"
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    placeholder="Ask about your analytics or mock test performance..."
                    style={styles.input}
                    disabled={isLoading}
                />
                <button type="submit" disabled={!input.trim() || isLoading} style={{...styles.sendButton, opacity: (!input.trim() || isLoading) ? 0.6 : 1}}>
                    <FiSend style={{ fontSize: '1.2rem' }} />
                </button>
            </form>
            </div>
        </div>
    );
};

const styles = {
    pageContainer: {
        padding: '24px',
        maxWidth: '1200px',
        margin: '0 auto',
        display: 'flex',
        flexDirection: 'column',
        gap: '16px'
    },
    topBar: {
        display: 'flex',
        justifyContent: 'flex-start',
    },
    backButton: {
        display: 'flex',
        alignItems: 'center',
        padding: '8px 16px',
        backgroundColor: 'white',
        border: '1px solid #E5E7EB',
        borderRadius: '8px',
        color: '#4B5563',
        fontSize: '0.9rem',
        fontWeight: '500',
        cursor: 'pointer',
        boxShadow: '0 1px 2px rgba(0,0,0,0.05)',
        transition: 'all 0.2s ease',
    },
    container: {
        display: 'flex',
        flexDirection: 'column',
        height: 'calc(100vh - 120px)',
        backgroundColor: '#ffffff',
        borderRadius: '12px',
        boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)',
        overflow: 'hidden',
        width: '100%',
    },
    header: {
        padding: '20px 24px',
        borderBottom: '1px solid #E5E7EB',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        backgroundColor: '#FAFAF9'
    },
    headerTitle: {
        display: 'flex',
        alignItems: 'center',
        gap: '12px',
        color: '#111827'
    },
    icon: {
        fontSize: '1.5rem',
        color: '#4F46E5'
    },
    badge: {
        backgroundColor: '#E0E7FF',
        color: '#4338CA',
        padding: '4px 12px',
        borderRadius: '999px',
        fontSize: '0.8rem',
        fontWeight: '600'
    },
    chatBox: {
        flex: 1,
        padding: '24px',
        overflowY: 'auto',
        display: 'flex',
        flexDirection: 'column',
        backgroundColor: '#F9FAFB'
    },
    chatBoxInner: {
        display: 'flex',
        flexDirection: 'column',
        gap: '20px',
        width: '100%',
        maxWidth: '800px',
        margin: '0 auto'
    },
    messageWrapper: {
        display: 'flex',
        width: '100%'
    },
    messageBubble: {
        maxWidth: '80%',
        padding: '16px',
        borderRadius: '16px',
        boxShadow: '0 1px 2px rgba(0,0,0,0.05)'
    },
    messageHeader: {
        display: 'flex',
        alignItems: 'center',
        gap: '8px',
        marginBottom: '8px',
        fontSize: '0.85rem',
        opacity: 0.9
    },
    messageContent: {
        lineHeight: 1.5,
        fontSize: '0.95rem'
    },
    inputArea: {
        display: 'flex',
        padding: '20px',
        borderTop: '1px solid #E5E7EB',
        backgroundColor: 'white',
        gap: '12px',
        maxWidth: '800px',
        width: '100%',
        margin: '0 auto'
    },
    input: {
        flex: 1,
        padding: '14px 20px',
        borderRadius: '999px',
        border: '1px solid #D1D5DB',
        outline: 'none',
        fontSize: '1rem',
        transition: 'all 0.2s',
        boxShadow: 'inset 0 1px 2px rgba(0,0,0,0.05)'
    },
    sendButton: {
        backgroundColor: '#4F46E5',
        color: 'white',
        border: 'none',
        borderRadius: '50%',
        width: '52px',
        height: '52px',
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        cursor: 'pointer',
        transition: '0.2s',
        boxShadow: '0 4px 6px rgba(79, 70, 229, 0.3)'
    }
};

export default AIChat;