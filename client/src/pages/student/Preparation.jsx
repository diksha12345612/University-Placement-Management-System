import { Link, useLocation } from 'react-router-dom';
import Layout from '../../components/Layout';
import { FiCode, FiClipboard, FiCheckSquare, FiHelpCircle } from 'react-icons/fi';

const Preparation = () => {
    const location = useLocation();
    const jobPrep = location.state?.jobPrep || null;

    const cards = [
        { to: '/student/preparation/mock-test', icon: '📝', title: 'Mock Tests', desc: 'Proctored AI-generated technical & aptitude tests', color: '#10b981' },
        { to: '/student/preparation/tips', icon: '🤖', title: 'Interview Resources', desc: 'Read AI generated tips and common questions', color: '#f59e0b' },
        { to: '/student/preparation/ai-mock', icon: '🎤', title: 'Live AI Interview', desc: 'Interactive voice & text interview customized to your resume', color: '#3b82f6' },
    ];

    return (
        <Layout title="Placement Preparation">
            <div className="fade-in">
                {jobPrep ? (
                    <div style={{ marginBottom: '2rem', padding: '1.5rem', background: 'rgba(59, 130, 246, 0.1)', borderRadius: '8px', border: '1px solid rgba(59, 130, 246, 0.3)' }}>
                        <h3 style={{ margin: '0 0 0.5rem', color: 'var(--primary)' }}>🎯 Customizing Preparation For:</h3>
                        <h2 style={{ margin: 0, fontSize: '1.2rem' }}>{jobPrep.title} at {jobPrep.company}</h2>
                        <p style={{ margin: '0.5rem 0 0', color: 'var(--text-secondary)' }}>Select a module below to start practicing with customized scenarios and questions tailored to this role.</p>
                    </div>
                ) : (
                    <p style={{ color: 'var(--text-muted)', marginBottom: '2rem' }}>Prepare for your dream placement with these resources</p>
                )}
                <div className="prep-cards">
                    {cards.map((card) => (
                        <Link key={card.to} to={card.to} state={{ jobPrep }} style={{ textDecoration: 'none', color: 'inherit' }}>
                            <div className="prep-card">
                                <div className="icon">{card.icon}</div>
                                <h3>{card.title}</h3>
                                <p>{card.desc}</p>
                            </div>
                        </Link>
                    ))}
                </div>
            </div>
        </Layout>
    );
};

export default Preparation;
