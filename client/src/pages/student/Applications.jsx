import { useState, useEffect } from 'react';
import Layout from '../../components/Layout';
import { applicationAPI } from '../../services/api';

const statusColors = { applied: 'badge-info', shortlisted: 'badge-warning', interview: 'badge-primary', selected: 'badge-success', rejected: 'badge-danger' };

const JobDetailModal = ({ app, onClose }) => {
    const job = app.job || {};
    const recruiter = job.postedBy || {};
    const recruiterEmail = recruiter.email || (recruiter.recruiterProfile?.contactEmail) || 'N/A';

    return (
        <div
            style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem' }}
            onClick={onClose}
        >
            <div
                style={{ background: 'var(--bg-card)', borderRadius: '16px', border: '1px solid var(--border)', maxWidth: '680px', width: '100%', maxHeight: '90vh', overflowY: 'auto', padding: '2rem', position: 'relative' }}
                onClick={e => e.stopPropagation()}
            >
                <button onClick={onClose} style={{ position: 'absolute', top: '1rem', right: '1rem', background: 'none', border: 'none', fontSize: '1.4rem', cursor: 'pointer', color: 'var(--text-secondary)' }}>×</button>

                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '0.5rem', marginBottom: '1.5rem' }}>
                    <div>
                        <h2 style={{ margin: 0 }}>{job.title || 'N/A'}</h2>
                        <p style={{ margin: '0.25rem 0 0', color: 'var(--text-secondary)', fontSize: '1rem' }}>{job.company || 'N/A'}</p>
                    </div>
                    <span className={`badge ${statusColors[app.status] || 'badge-info'}`} style={{ alignSelf: 'flex-start' }}>{app.status?.toUpperCase()}</span>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '0.75rem', marginBottom: '1.5rem' }}>
                    {[
                        ['Location', job.location],
                        ['Type', job.type],
                        ['Salary', job.salary || 'Not disclosed'],
                        ['Openings', job.openings],
                        ['Deadline', job.deadline ? new Date(job.deadline).toLocaleDateString() : 'N/A'],
                        ['Applied On', new Date(app.appliedAt).toLocaleDateString()],
                    ].map(([label, value]) => (
                        <div key={label} style={{ background: 'var(--bg)', borderRadius: '8px', padding: '0.75rem 1rem' }}>
                            <p style={{ margin: 0, fontSize: '0.75rem', color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{label}</p>
                            <p style={{ margin: '0.2rem 0 0', fontWeight: 600 }}>{value || 'N/A'}</p>
                        </div>
                    ))}
                </div>

                <div style={{ marginBottom: '1.25rem' }}>
                    <h4 style={{ marginBottom: '0.5rem' }}>Description</h4>
                    <p style={{ color: 'var(--text-secondary)', lineHeight: 1.7, whiteSpace: 'pre-wrap' }}>{job.description || 'N/A'}</p>
                </div>

                {(job.requirements || []).length > 0 && (
                    <div style={{ marginBottom: '1.25rem' }}>
                        <h4 style={{ marginBottom: '0.5rem' }}>Requirements</h4>
                        <ul style={{ paddingLeft: '1.25rem', color: 'var(--text-secondary)', lineHeight: 1.8 }}>
                            {job.requirements.map((r, i) => <li key={i}>{r}</li>)}
                        </ul>
                    </div>
                )}

                {(job.responsibilities || []).length > 0 && (
                    <div style={{ marginBottom: '1.25rem' }}>
                        <h4 style={{ marginBottom: '0.5rem' }}>Responsibilities</h4>
                        <ul style={{ paddingLeft: '1.25rem', color: 'var(--text-secondary)', lineHeight: 1.8 }}>
                            {job.responsibilities.map((r, i) => <li key={i}>{r}</li>)}
                        </ul>
                    </div>
                )}

                {(job.perks || []).length > 0 && (
                    <div style={{ marginBottom: '1.25rem' }}>
                        <h4 style={{ marginBottom: '0.5rem' }}>Perks</h4>
                        <ul style={{ paddingLeft: '1.25rem', color: 'var(--text-secondary)', lineHeight: 1.8 }}>
                            {job.perks.map((p, i) => <li key={i}>{p}</li>)}
                        </ul>
                    </div>
                )}

                {job.eligibility && (
                    <div style={{ marginBottom: '1.25rem' }}>
                        <h4 style={{ marginBottom: '0.5rem' }}>Eligibility</h4>
                        <div style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', lineHeight: 1.8 }}>
                            {job.eligibility.minCGPA > 0 && <p style={{ margin: 0 }}>Min CGPA: <strong>{job.eligibility.minCGPA}</strong></p>}
                            {job.eligibility.batch && <p style={{ margin: 0 }}>Batch: <strong>{job.eligibility.batch}</strong></p>}
                            {(job.eligibility.branches || []).length > 0 && <p style={{ margin: 0 }}>Branches: <strong>{job.eligibility.branches.join(', ')}</strong></p>}
                            {(job.eligibility.skills || []).length > 0 && <p style={{ margin: 0 }}>Required Skills: <strong>{job.eligibility.skills.join(', ')}</strong></p>}
                        </div>
                    </div>
                )}

                <div style={{ marginTop: '1.5rem', paddingTop: '1.25rem', borderTop: '1px solid var(--border)', display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap' }}>
                    <div style={{ background: 'var(--primary-glow)', borderRadius: '8px', padding: '0.6rem 1rem' }}>
                        <p style={{ margin: 0, fontSize: '0.75rem', color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Recruiter</p>
                        <p style={{ margin: '0.15rem 0 0', fontWeight: 600 }}>{recruiter.name || 'N/A'}</p>
                    </div>
                    <div style={{ background: 'var(--primary-glow)', borderRadius: '8px', padding: '0.6rem 1rem' }}>
                        <p style={{ margin: 0, fontSize: '0.75rem', color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Recruiter Email</p>
                        <a href={`mailto:${recruiterEmail}`} style={{ margin: '0.15rem 0 0', display: 'block', fontWeight: 600, color: 'var(--primary)' }}>{recruiterEmail}</a>
                    </div>
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
