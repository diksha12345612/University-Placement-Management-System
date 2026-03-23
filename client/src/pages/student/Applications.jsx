import { useState, useEffect } from 'react';
import Layout from '../../components/Layout';
import { applicationAPI } from '../../services/api';
import ATSScoreCard from '../../components/ATSScoreCard';

const statusColors = { applied: 'badge-info', shortlisted: 'badge-warning', interview: 'badge-primary', selected: 'badge-success', rejected: 'badge-danger' };

const JobDetailModal = ({ app, onClose, onReEvaluate }) => {
    const job = app.job || {};
    const recruiter = job.postedBy || {};
    const recruiterEmail = recruiter.email || (recruiter.recruiterProfile?.contactEmail) || 'N/A';
    const [isReEvaluating, setIsReEvaluating] = useState(false);
    const [atsResult, setAtsResult] = useState(app.atsEvaluation || null);

    const handleReEvaluate = async () => {
        setIsReEvaluating(true);
        try {
            const response = await applicationAPI.reEvaluateResume(app._id);
            if (response.data.atsEvaluation) {
                setAtsResult(response.data.atsEvaluation);
                if (onReEvaluate) onReEvaluate(response.data.atsEvaluation);
            }
        } catch (error) {
            console.error('Re-evaluation failed:', error);
            alert('Failed to re-evaluate resume: ' + (error.response?.data?.error || error.message));
        } finally {
            setIsReEvaluating(false);
        }
    };

    return (
        <div
            style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem' }}
            onClick={onClose}
        >
            <div
                style={{ background: 'var(--bg-card)', borderRadius: '12px', border: '1px solid var(--border)', maxWidth: '720px', width: '100%', maxHeight: '90vh', overflowY: 'auto', padding: '2rem', position: 'relative', boxShadow: '0 20px 60px rgba(0,0,0,0.3)' }}
                onClick={e => e.stopPropagation()}
            >
                {/* Close Button */}
                <button onClick={onClose} style={{ position: 'absolute', top: '1rem', right: '1rem', background: 'none', border: 'none', fontSize: '1.6rem', cursor: 'pointer', color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', justifyContent: 'center', width: '32px', height: '32px' }}>✕</button>

                {/* Header with Title and Status */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '0.5rem', marginBottom: '1.75rem', paddingRight: '2.5rem' }}>
                    <div>
                        <h1 style={{ margin: 0, fontSize: '1.5rem', fontWeight: 700 }}>{job.title || 'N/A'}</h1>
                        <p style={{ margin: '0.35rem 0 0', color: 'var(--text-muted)', fontSize: '0.95rem', fontWeight: 500 }}>{job.company || 'N/A'}</p>
                    </div>
                    <span className={`badge ${statusColors[app.status] || 'badge-info'}`} style={{ alignSelf: 'flex-start', fontSize: '0.8rem', fontWeight: 700, padding: '0.4rem 0.8rem' }}>{app.status?.toUpperCase()}</span>
                </div>

                {/* Info Grid */}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: '0.75rem', marginBottom: '1.75rem', paddingBottom: '1.75rem', borderBottom: '1px solid var(--border)' }}>
                    {[
                        ['📍 Location', job.location],
                        ['💼 Type', job.type],
                        ['💰 Salary', job.salary ? `₹ ${job.salary}` : 'Not disclosed'],
                        ['👥 Openings', job.openings || 1],
                        ['📅 Deadline', job.deadline ? new Date(job.deadline).toLocaleDateString('en-IN') : 'N/A'],
                        ['📨 Applied', new Date(app.appliedAt).toLocaleDateString('en-IN')],
                    ].map(([label, value]) => (
                        <div key={label} style={{ background: 'var(--bg-dark)', borderRadius: '8px', padding: '0.75rem 1rem', display: 'flex', flexDirection: 'column' }}>
                            <p style={{ margin: 0, fontSize: '0.7rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.04em', fontWeight: 600 }}>{label}</p>
                            <p style={{ margin: '0.4rem 0 0', fontWeight: 600, fontSize: '0.95rem' }}>{value || 'N/A'}</p>
                        </div>
                    ))}
                </div>

                {/* Description */}
                {job.description && (
                    <div style={{ marginBottom: '1.5rem' }}>
                        <h4 style={{ marginTop: 0, marginBottom: '0.75rem', color: 'var(--primary)', fontSize: '0.95rem', fontWeight: 700 }}>📝 About this Role</h4>
                        <p style={{ color: 'var(--text-secondary)', lineHeight: 1.7, whiteSpace: 'pre-wrap', margin: 0, fontSize: '0.9rem' }}>{job.description}</p>
                    </div>
                )}

                {/* Requirements */}
                {(job.requirements || []).length > 0 && (
                    <div style={{ marginBottom: '1.5rem' }}>
                        <h4 style={{ marginTop: 0, marginBottom: '0.75rem', color: 'var(--primary)', fontSize: '0.95rem', fontWeight: 700 }}>✓ Requirements</h4>
                        <ul style={{ paddingLeft: '1.25rem', color: 'var(--text-secondary)', lineHeight: 1.8, margin: 0, fontSize: '0.9rem' }}>
                            {job.requirements.map((r, i) => <li key={i}>{r}</li>)}
                        </ul>
                    </div>
                )}

                {/* Responsibilities */}
                {(job.responsibilities || []).length > 0 && (
                    <div style={{ marginBottom: '1.5rem' }}>
                        <h4 style={{ marginTop: 0, marginBottom: '0.75rem', color: 'var(--primary)', fontSize: '0.95rem', fontWeight: 700 }}>💪 Responsibilities</h4>
                        <ul style={{ paddingLeft: '1.25rem', color: 'var(--text-secondary)', lineHeight: 1.8, margin: 0, fontSize: '0.9rem' }}>
                            {job.responsibilities.map((r, i) => <li key={i}>{r}</li>)}
                        </ul>
                    </div>
                )}

                {/* Perks */}
                {(job.perks || []).length > 0 && (
                    <div style={{ marginBottom: '1.5rem' }}>
                        <h4 style={{ marginTop: 0, marginBottom: '0.75rem', color: 'var(--primary)', fontSize: '0.95rem', fontWeight: 700 }}>🎁 Perks</h4>
                        <ul style={{ paddingLeft: '1.25rem', color: 'var(--text-secondary)', lineHeight: 1.8, margin: 0, fontSize: '0.9rem' }}>
                            {job.perks.map((p, i) => <li key={i}>{p}</li>)}
                        </ul>
                    </div>
                )}

                {/* Eligibility */}
                {job.eligibility && (
                    <div style={{ marginBottom: '1.75rem', padding: '1rem', background: 'var(--bg-dark)', borderRadius: '8px', border: '1px solid rgba(99,102,241,0.15)' }}>
                        <h4 style={{ marginTop: 0, marginBottom: '0.75rem', color: 'var(--primary)', fontSize: '0.95rem', fontWeight: 700 }}>📋 Eligibility</h4>
                        <div style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', lineHeight: 1.9, display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '0.75rem' }}>
                            {job.eligibility.minCGPA > 0 && (
                                <div>
                                    <p style={{ margin: 0, fontWeight: 600 }}>Min CGPA: <span style={{ color: 'var(--primary)' }}>{job.eligibility.minCGPA}</span></p>
                                </div>
                            )}
                            {job.eligibility.batch && (
                                <div>
                                    <p style={{ margin: 0, fontWeight: 600 }}>Batch: <span style={{ color: 'var(--primary)' }}>{job.eligibility.batch}</span></p>
                                </div>
                            )}
                            {(job.eligibility.branches || []).length > 0 && (
                                <div style={{ gridColumn: 'span 1' }}>
                                    <p style={{ margin: 0, fontWeight: 600 }}>Branches:</p>
                                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.4rem', marginTop: '0.4rem' }}>
                                        {job.eligibility.branches.map((b, i) => (
                                            <span key={i} className="badge badge-secondary" style={{ fontSize: '0.75rem' }}>{b}</span>
                                        ))}
                                    </div>
                                </div>
                            )}
                            {(job.eligibility.skills || []).length > 0 && (
                                <div style={{ gridColumn: 'span 1' }}>
                                    <p style={{ margin: 0, fontWeight: 600 }}>Required Skills:</p>
                                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.4rem', marginTop: '0.4rem' }}>
                                        {job.eligibility.skills.map((s, i) => (
                                            <span key={i} className="badge badge-primary" style={{ fontSize: '0.75rem' }}>{s}</span>
                                        ))}
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>
                )}

                {/* Recruiter Info */}
                <div style={{ marginTop: '1.75rem', paddingTop: '1.5rem', borderTop: '1px solid var(--border)' }}>
                    <h4 style={{ marginTop: 0, marginBottom: '1rem', color: 'var(--primary)', fontSize: '0.95rem', fontWeight: 700 }}>👤 Recruiter Information</h4>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '0.75rem' }}>
                        <div style={{ background: 'var(--bg-dark)', borderRadius: '8px', padding: '0.75rem 1rem', borderLeft: '4px solid var(--primary)' }}>
                            <p style={{ margin: 0, fontSize: '0.7rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.04em', fontWeight: 600 }}>Recruiter Name</p>
                            <p style={{ margin: '0.35rem 0 0', fontWeight: 600 }}>{recruiter.name || 'N/A'}</p>
                        </div>
                        <div style={{ background: 'var(--bg-dark)', borderRadius: '8px', padding: '0.75rem 1rem', borderLeft: '4px solid var(--primary)' }}>
                            <p style={{ margin: 0, fontSize: '0.7rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.04em', fontWeight: 600 }}>Email</p>
                            <a href={`mailto:${recruiterEmail}`} style={{ margin: '0.35rem 0 0', display: 'block', fontWeight: 600, color: 'var(--primary)', textDecoration: 'none', fontSize: '0.9rem' }}>{recruiterEmail}</a>
                        </div>
                    </div>
                </div>

                {/* ATS Evaluation ScoreCard if available */}
                {atsResult && (
                    <div style={{ marginTop: '1.75rem', paddingTop: '1.5rem', borderTop: '1px solid var(--border)' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                            <h4 style={{ margin: 0, color: 'var(--primary)', fontSize: '0.95rem', fontWeight: 700 }}>🤖 AI ATS Feedback</h4>
                            <button 
                                onClick={handleReEvaluate} 
                                disabled={isReEvaluating}
                                style={{
                                    padding: '0.4rem 0.8rem',
                                    fontSize: '0.8rem',
                                    background: isReEvaluating ? 'var(--text-muted)' : 'var(--primary)',
                                    color: '#fff',
                                    border: 'none',
                                    borderRadius: '4px',
                                    cursor: isReEvaluating ? 'not-allowed' : 'pointer',
                                    fontWeight: 600,
                                    opacity: isReEvaluating ? 0.6 : 1
                                }}
                            >
                                {isReEvaluating ? '⏳ Evaluating...' : '🔄 Re-evaluate'}
                            </button>
                        </div>
                        <ATSScoreCard result={atsResult} />
                    </div>
                )}

                {/* Close Button */}
                <div style={{ marginTop: '1.75rem', display: 'flex', gap: '0.75rem' }}>
                    <button onClick={onClose} className="btn btn-secondary" style={{ flex: 1 }}>Close</button>
                </div>
            </div>
        </div>
    );
};

const StudentApplications = () => {
    const [applications, setApplications] = useState([]);
    const [loading, setLoading] = useState(true);
    const [selected, setSelected] = useState(null);

    useEffect(() => {
        applicationAPI.getMyApplications()
            .then(res => setApplications(res.data))
            .catch(() => { })
            .finally(() => setLoading(false));
    }, []);

    if (loading) return <Layout title="My Applications"><div className="loading"><div className="spinner"></div></div></Layout>;

    return (
        <Layout title="My Applications">
            <div className="fade-in">
                {applications.length === 0 ? (
                    <div className="empty-state">
                        <h3>No applications yet</h3>
                        <p>Start applying for jobs to track them here</p>
                    </div>
                ) : (
                    <div className="table-container">
                        <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '0.75rem' }}>Click on any row to view full job details.</p>
                        <table className="responsive-table">
                            <thead>
                                <tr>
                                    <th>Job Title</th>
                                    <th>Company</th>
                                    <th>Applied On</th>
                                    <th>Status</th>
                                </tr>
                            </thead>
                            <tbody>
                                {applications.map((app) => (
                                    <tr key={app._id} onClick={() => setSelected(app)} style={{ cursor: 'pointer' }} title="Click to view job details">
                                        <td data-label="Job Title" style={{ fontWeight: 600 }}>{app.job?.title || 'N/A'}</td>
                                        <td data-label="Company">{app.job?.company || 'N/A'}</td>
                                        <td data-label="Applied On">{new Date(app.appliedAt).toLocaleDateString()}</td>
                                        <td data-label="Status">
                                            <span className={`badge ${statusColors[app.status] || 'badge-info'}`}>
                                                {app.status.toUpperCase()}
                                            </span>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>
            {selected && <JobDetailModal app={selected} onClose={() => setSelected(null)} />}
        </Layout>
    );
};

export default StudentApplications;
