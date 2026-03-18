import { useState, useEffect } from 'react';
import Layout from '../../components/Layout';
import { jobAPI, applicationAPI } from '../../services/api';
import { FiMapPin, FiClock, FiDollarSign, FiUsers } from 'react-icons/fi';
import toast from 'react-hot-toast';
import { useAuth } from '../../context/AuthContext';
import { useNavigate } from 'react-router-dom';

const StudentJobs = () => {
    const { user } = useAuth();
    const navigate = useNavigate();
    const [jobs, setJobs] = useState([]);
    const [loading, setLoading] = useState(true);
    const [selectedJob, setSelectedJob] = useState(null);
    const [appliedJobs, setAppliedJobs] = useState([]);
    const [coverLetter, setCoverLetter] = useState('');
    const [applying, setApplying] = useState(false);

    useEffect(() => { loadData(); }, []);

    const loadData = async () => {
        try {
            const [jobsRes, appsRes] = await Promise.all([jobAPI.getAll(), applicationAPI.getMyApplications()]);
            setJobs(jobsRes.data);
            setAppliedJobs(appsRes.data.map(a => a.job?._id));
        } catch { } finally { setLoading(false); }
    };

    const getMissingProfileFields = () => {
        const profile = user?.studentProfile || {};
        const missing = [];
        const skills = Array.isArray(profile.skills)
            ? profile.skills.filter((s) => String(s || '').trim())
            : String(profile.skills || '')
                .split(',')
                .map((s) => s.trim())
                .filter(Boolean);

        if (!String(user?.name || '').trim()) missing.push('name');
        if (!String(profile.rollNumber || '').trim()) missing.push('roll number');
        if (skills.length === 0) missing.push('tech stack');
        if (!String(profile.resumeUrl || '').trim()) missing.push('resume');
        return missing;
    };

    const isEligibleToApply = getMissingProfileFields().length === 0;

    const showProfileRequiredMessage = () => {
        const missing = getMissingProfileFields();
        if (missing.length === 0) return;
        toast.error(`Complete profile before applying. Missing: ${missing.join(', ')}`);
    };

    const handleApply = async (jobId) => {
        const missing = getMissingProfileFields();
        if (missing.length > 0) {
            toast.error(`Complete profile before applying. Missing: ${missing.join(', ')}`);
            return;
        }

        setApplying(true);
        try {
            await applicationAPI.apply({ jobId, coverLetter });
            toast.success('Application submitted!');
            setAppliedJobs([...appliedJobs, jobId]);
            setSelectedJob(null);
            setCoverLetter('');
        } catch (err) { toast.error(err.response?.data?.error || 'Error applying'); }
        finally { setApplying(false); }
    };

    if (loading) return <Layout title="Job Listings"><div className="loading"><div className="spinner"></div></div></Layout>;

    return (
        <Layout title="Job Listings">
            <div className="fade-in">
                {!isEligibleToApply && (
                    <div className="card" style={{ marginBottom: '1rem', border: '1px solid #f59e0b', background: '#fffbeb' }}>
                        <p style={{ margin: 0, color: '#92400e', fontSize: '0.9rem' }}>
                            Complete required profile details before applying: <strong>{getMissingProfileFields().join(', ')}</strong>.
                        </p>
                        <div style={{ marginTop: '0.75rem' }}>
                            <button className="btn btn-secondary btn-sm" onClick={() => navigate('/student/profile')}>Go to Profile</button>
                        </div>
                    </div>
                )}

                <div className="jobs-grid" style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(auto-fill, minmax(var(--mobile-job-min, 300px), 1fr))',
                    gap: '1.5rem'
                }}>
                    {jobs.length === 0 ? (
                        <div className="empty-state"><h3>No jobs available</h3><p>Check back later for new openings</p></div>
                    ) : (
                        jobs.map((job) => (
                            <div key={job._id} className="job-card hover-lift" style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
                                <div style={{ flex: 1 }}>
                                    <h3 style={{ fontSize: '1.1rem', marginBottom: '0.25rem' }}>{job.title}</h3>
                                    <p className="company" style={{ color: 'var(--primary)', fontWeight: 600, fontSize: '0.9rem', marginBottom: '1rem' }}>{job.company}</p>
                                    <div className="meta" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem', marginBottom: '1rem', fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                                        <span className="flex items-center gap-1"><FiMapPin /> {job.location}</span>
                                        <span className="flex items-center gap-1"><FiClock /> {job.type}</span>
                                        {job.salary && <span className="flex items-center gap-1">₹ {job.salary}</span>}
                                        <span className="flex items-center gap-1"><FiUsers /> {job.openings} openings</span>
                                    </div>
                                    {job.eligibility?.skills?.length > 0 && (
                                        <div className="skills" style={{ display: 'flex', flexWrap: 'wrap', gap: '0.4rem', marginBottom: '1rem' }}>
                                            {job.eligibility.skills.slice(0, 3).map((s, i) => <span key={i} className="badge badge-primary" style={{ fontSize: '0.65rem' }}>{s}</span>)}
                                            {job.eligibility.skills.length > 3 && <span style={{ fontSize: '0.65rem', color: 'var(--text-muted)' }}>+{job.eligibility.skills.length - 3} more</span>}
                                        </div>
                                    )}
                                </div>
                                <div style={{ marginTop: 'auto', borderTop: '1px solid var(--border)', paddingTop: '1rem' }}>
                                    <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: '1rem' }}>
                                        CGPA: {job.eligibility?.minCGPA || 'N/A'} • Deadline: {new Date(job.deadline).toLocaleDateString()}
                                    </p>
                                    <div className="flex gap-2">
                                        {appliedJobs.includes(job._id) ? (
                                            <span className="btn btn-success btn-sm flex-1 disabled" style={{ opacity: 0.8 }}>✓ Applied</span>
                                        ) : (
                                            <button
                                                className="btn btn-primary btn-sm flex-1"
                                                onClick={() => {
                                                    if (!isEligibleToApply) {
                                                        showProfileRequiredMessage();
                                                        return;
                                                    }
                                                    setSelectedJob(job);
                                                }}
                                                disabled={!isEligibleToApply}
                                                title={!isEligibleToApply ? `Missing: ${getMissingProfileFields().join(', ')}` : 'Apply'}
                                            >
                                                Apply
                                            </button>
                                        )}
                                        <button className="btn btn-secondary btn-sm" onClick={() => setSelectedJob({ ...job, viewOnly: true })}>Details</button>
                                    </div>
                                </div>
                            </div>
                        ))
                    )}
                </div>
            </div>

            {selectedJob && (
                <div
                        style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem' }}
                        onClick={() => setSelectedJob(null)}
                    >
                        <div
                            style={{ background: 'var(--bg-card)', borderRadius: '12px', border: '1px solid var(--border)', maxWidth: '720px', width: '100%', maxHeight: '90vh', overflowY: 'auto', padding: '2rem', position: 'relative', boxShadow: '0 20px 60px rgba(0,0,0,0.3)' }}
                            onClick={(e) => e.stopPropagation()}
                        >
                            {/* Close Button */}
                            <button onClick={() => setSelectedJob(null)} style={{ position: 'absolute', top: '1rem', right: '1rem', background: 'none', border: 'none', fontSize: '1.6rem', cursor: 'pointer', color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', justifyContent: 'center', width: '32px', height: '32px' }}>✕</button>

                            {/* Header */}
                            <div style={{ marginBottom: '1.75rem', paddingRight: '2.5rem' }}>
                                <h1 style={{ margin: 0, fontSize: '1.5rem', fontWeight: 700 }}>{selectedJob.title}</h1>
                                <p style={{ margin: '0.35rem 0 0', color: 'var(--primary)', fontSize: '0.95rem', fontWeight: 600 }}>{selectedJob.company}</p>
                            </div>

                            {/* Quick Info Grid */}
                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: '0.75rem', marginBottom: '1.75rem', paddingBottom: '1.75rem', borderBottom: '1px solid var(--border)' }}>
                                {[
                                    ['📍 Location', selectedJob.location],
                                    ['💼 Type', selectedJob.type],
                                    ['💰 Salary', selectedJob.salary ? `₹ ${selectedJob.salary}` : 'Not disclosed'],
                                    ['👥 Openings', selectedJob.openings || 1],
                                    ['📅 Deadline', new Date(selectedJob.deadline).toLocaleDateString('en-IN')],
                                    ['🎓 Batch', selectedJob.eligibility?.batch || 'N/A'],
                                ].map(([label, value]) => (
                                    <div key={label} style={{ background: 'var(--bg-dark)', borderRadius: '8px', padding: '0.75rem 1rem', display: 'flex', flexDirection: 'column' }}>
                                        <p style={{ margin: 0, fontSize: '0.7rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.04em', fontWeight: 600 }}>{label}</p>
                                        <p style={{ margin: '0.4rem 0 0', fontWeight: 600, fontSize: '0.95rem' }}>{value || 'N/A'}</p>
                                    </div>
                                ))}
                            </div>

                            {/* Eligibility */}
                            {selectedJob.eligibility && (
                                <div style={{ marginBottom: '1.75rem', padding: '1rem', background: 'var(--bg-dark)', borderRadius: '8px', border: '1px solid rgba(99,102,241,0.15)' }}>
                                    <h4 style={{ marginTop: 0, marginBottom: '0.75rem', color: 'var(--primary)', fontSize: '0.95rem', fontWeight: 700 }}>📋 Eligibility Criteria</h4>
                                    <div style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', lineHeight: 1.9, display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '0.75rem' }}>
                                        {selectedJob.eligibility.minCGPA > 0 && (
                                            <div>
                                                <p style={{ margin: 0, fontWeight: 600 }}>Min CGPA: <span style={{ color: 'var(--primary)' }}>{selectedJob.eligibility.minCGPA}</span></p>
                                            </div>
                                        )}
                                        {selectedJob.eligibility.branches?.length > 0 && (
                                            <div style={{ gridColumn: 'span 1' }}>
                                                <p style={{ margin: 0, fontWeight: 600, marginBottom: '0.4rem' }}>Eligible Branches:</p>
                                                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.4rem' }}>
                                                    {selectedJob.eligibility.branches.map((b, i) => (
                                                        <span key={i} className="badge badge-secondary" style={{ fontSize: '0.75rem' }}>{b}</span>
                                                    ))}
                                                </div>
                                            </div>
                                        )}
                                        {selectedJob.eligibility.skills?.length > 0 && (
                                            <div style={{ gridColumn: 'span 1' }}>
                                                <p style={{ margin: 0, fontWeight: 600, marginBottom: '0.4rem' }}>Required Skills:</p>
                                                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.4rem' }}>
                                                    {selectedJob.eligibility.skills.map((s, i) => (
                                                        <span key={i} className="badge badge-primary" style={{ fontSize: '0.75rem' }}>{s}</span>
                                                    ))}
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            )}

                            {/* Description */}
                            {selectedJob.description && (
                                <div style={{ marginBottom: '1.5rem' }}>
                                    <h4 style={{ marginTop: 0, marginBottom: '0.75rem', color: 'var(--primary)', fontSize: '0.95rem', fontWeight: 700 }}>📝 About this Role</h4>
                                    <p style={{ color: 'var(--text-secondary)', lineHeight: 1.7, whiteSpace: 'pre-wrap', margin: 0, fontSize: '0.9rem' }}>{selectedJob.description}</p>
                                </div>
                            )}

                            {/* Requirements */}
                            {selectedJob.requirements?.length > 0 && (
                                <div style={{ marginBottom: '1.5rem' }}>
                                    <h4 style={{ marginTop: 0, marginBottom: '0.75rem', color: 'var(--primary)', fontSize: '0.95rem', fontWeight: 700 }}>✓ Requirements</h4>
                                    <ul style={{ paddingLeft: '1.25rem', color: 'var(--text-secondary)', lineHeight: 1.8, margin: 0, fontSize: '0.9rem' }}>
                                        {selectedJob.requirements.map((r, i) => <li key={i}>{r}</li>)}
                                    </ul>
                                </div>
                            )}

                            {/* Responsibilities */}
                            {selectedJob.responsibilities?.length > 0 && (
                                <div style={{ marginBottom: '1.5rem' }}>
                                    <h4 style={{ marginTop: 0, marginBottom: '0.75rem', color: 'var(--primary)', fontSize: '0.95rem', fontWeight: 700 }}>💪 Responsibilities</h4>
                                    <ul style={{ paddingLeft: '1.25rem', color: 'var(--text-secondary)', lineHeight: 1.8, margin: 0, fontSize: '0.9rem' }}>
                                        {selectedJob.responsibilities.map((r, i) => <li key={i}>{r}</li>)}
                                    </ul>
                                </div>
                            )}

                            {/* Perks */}
                            {selectedJob.perks?.length > 0 && (
                                <div style={{ marginBottom: '1.5rem' }}>
                                    <h4 style={{ marginTop: 0, marginBottom: '0.75rem', color: 'var(--primary)', fontSize: '0.95rem', fontWeight: 700 }}>🎁 Perks & Benefits</h4>
                                    <ul style={{ paddingLeft: '1.25rem', color: 'var(--text-secondary)', lineHeight: 1.8, margin: 0, fontSize: '0.9rem' }}>
                                        {selectedJob.perks.map((p, i) => <li key={i}>{p}</li>)}
                                    </ul>
                                </div>
                            )}

                            {/* Attachment */}
                            {selectedJob.attachmentFile && (
                                <div style={{ marginBottom: '1.75rem', padding: '1rem', background: 'var(--bg-dark)', borderRadius: '8px', border: '1px solid rgba(99,102,241,0.15)' }}>
                                    <p style={{ margin: '0 0 0.75rem 0', fontSize: '0.85rem', fontWeight: 700, color: 'var(--primary)' }}>📎 Job Attachment</p>
                                    <button
                                        className="btn btn-secondary btn-sm"
                                        onClick={async () => {
                                            try {
                                                const response = await jobAPI.getAttachment(selectedJob._id);
                                                const blob = response.data;
                                                
                                                if (!blob || blob.size === 0) {
                                                    toast.error('Downloaded file is empty');
                                                    return;
                                                }
                                                
                                                const url = URL.createObjectURL(blob);
                                                const link = document.createElement('a');
                                                link.href = url;
                                                link.download = selectedJob.attachmentFileName || 'attachment';
                                                document.body.appendChild(link);
                                                link.click();
                                                document.body.removeChild(link);
                                                URL.revokeObjectURL(url);
                                                toast.success('Attachment downloaded successfully');
                                            } catch (err) {
                                                console.error('Attachment download error:', err);
                                                let errorMsg = 'Failed to download attachment';
                                                
                                                if (err.response?.status === 404) {
                                                    errorMsg = 'Attachment not found';
                                                } else if (err.response?.data?.error) {
                                                    errorMsg = err.response.data.error;
                                                } else if (err.message) {
                                                    errorMsg = err.message;
                                                }
                                                
                                                toast.error(errorMsg);
                                            }
                                        }}
                                    >
                                        ⬇ Download {selectedJob.attachmentFileName}
                                    </button>
                                </div>
                            )}

                            {/* Cover Letter */}
                            {!selectedJob.viewOnly && !appliedJobs.includes(selectedJob._id) && (
                                <div style={{ marginBottom: '1.75rem', paddingBottom: '1.75rem', borderBottom: '1px solid var(--border)' }}>
                                    <h4 style={{ marginTop: 0, marginBottom: '0.75rem', color: 'var(--primary)', fontSize: '0.95rem', fontWeight: 700 }}>💌 Cover Letter (Optional)</h4>
                                    <textarea
                                        value={coverLetter}
                                        onChange={(e) => setCoverLetter(e.target.value)}
                                        rows="4"
                                        placeholder="Why are you interested in this role? What attracts you to this opportunity?"
                                        style={{
                                            width: '100%',
                                            padding: '0.75rem',
                                            borderRadius: '8px',
                                            border: '1px solid var(--border)',
                                            background: 'var(--bg-dark)',
                                            color: 'var(--text)',
                                            fontSize: '0.9rem',
                                            lineHeight: 1.5,
                                            fontFamily: 'inherit',
                                            resize: 'vertical',
                                            boxSizing: 'border-box'
                                        }}
                                    />
                                </div>
                            )}

                            {/* Action Buttons */}
                            <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'flex-end' }}>
                                <button className="btn btn-secondary" onClick={() => setSelectedJob(null)}>Close</button>
                                {!selectedJob.viewOnly && !appliedJobs.includes(selectedJob._id) && (
                                    <button
                                        className="btn btn-primary"
                                        onClick={() => handleApply(selectedJob._id)}
                                        disabled={applying || !isEligibleToApply}
                                    >
                                        {applying ? '⏳ Submitting...' : '✓ Submit Application'}
                                    </button>
                                )}
                            </div>
                        </div>
                    </div>
                )}
        </Layout>
    );
};

export default StudentJobs;
