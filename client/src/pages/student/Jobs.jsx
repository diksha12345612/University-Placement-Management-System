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
    const [externalJobs, setExternalJobs] = useState([]);
    const [activeTab, setActiveTab] = useState('internal');
    const [loading, setLoading] = useState(true);
    const [loadingExternal, setLoadingExternal] = useState(false);
    const [selectedJob, setSelectedJob] = useState(null);
    const [appliedJobs, setAppliedJobs] = useState([]);
    const [coverLetter, setCoverLetter] = useState('');
    const [applying, setApplying] = useState(false);

    useEffect(() => { loadData(); }, []);

    useEffect(() => {
        if (activeTab === 'external' && externalJobs.length === 0) {
            loadExternalJobs();
        }
    }, [activeTab]);

    const loadData = async () => {
        try {
            const [jobsRes, appsRes] = await Promise.all([jobAPI.getAll(), applicationAPI.getMyApplications()]);
            setJobs(jobsRes.data);
            setAppliedJobs(appsRes.data.map(a => a.job?._id));
        } catch { } finally { setLoading(false); }
    };

    const loadExternalJobs = async () => {
        setLoadingExternal(true);
        try {
            const res = await jobAPI.getExternalJobs();
            setExternalJobs(res.data);
        } catch (error) {
            toast.error("Failed to fetch external jobs.");
        } finally {
            setLoadingExternal(false);
        }
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
                {!isEligibleToApply && activeTab === 'internal' && (
                    <div className="card" style={{ marginBottom: '1rem', border: '1px solid #f59e0b', background: '#fffbeb' }}>
                        <p style={{ margin: 0, color: '#92400e', fontSize: '0.9rem' }}>
                            Complete required profile details before applying: <strong>{getMissingProfileFields().join(', ')}</strong>.
                        </p>
                        <div style={{ marginTop: '0.75rem' }}>
                            <button className="btn btn-secondary btn-sm" onClick={() => navigate('/student/profile')}>Go to Profile</button>
                        </div>
                    </div>
                )}

                <div className="tabs" style={{ display: 'flex', gap: '1rem', marginBottom: '1.5rem', borderBottom: '1px solid var(--border)' }}>
                    <button 
                        className={`tab ${activeTab === 'internal' ? 'active' : ''}`} 
                        onClick={() => setActiveTab('internal')}
                        style={{ padding: '0.75rem 1.5rem', borderBottom: activeTab === 'internal' ? '2px solid var(--primary)' : 'none', background: 'none', border: 'none', fontWeight: activeTab === 'internal' ? 600 : 400, color: activeTab === 'internal' ? 'var(--primary)' : 'var(--text-muted)', cursor: 'pointer' }}
                    >
                        Campus Jobs
                    </button>
                    <button 
                        className={`tab ${activeTab === 'external' ? 'active' : ''}`} 
                        onClick={() => setActiveTab('external')}
                        style={{ padding: '0.75rem 1.5rem', borderBottom: activeTab === 'external' ? '2px solid var(--primary)' : 'none', background: 'none', border: 'none', fontWeight: activeTab === 'external' ? 600 : 400, color: activeTab === 'external' ? 'var(--primary)' : 'var(--text-muted)', cursor: 'pointer' }}
                    >
                        Global Jobs (Recommended)
                    </button>
                    <button 
                        className={`tab ${activeTab === 'whatsapp' ? 'active' : ''}`} 
                        onClick={() => setActiveTab('whatsapp')}
                        style={{ padding: '0.75rem 1.5rem', borderBottom: activeTab === 'whatsapp' ? '2px solid var(--primary)' : 'none', background: 'none', border: 'none', fontWeight: activeTab === 'whatsapp' ? 600 : 400, color: activeTab === 'whatsapp' ? 'var(--primary)' : 'var(--text-muted)', cursor: 'pointer' }}
                    >
                        Community / WhatsApp Jobs
                    </button>
                </div>

                {activeTab === 'internal' ? (
                    <div className="jobs-grid" style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(auto-fill, minmax(var(--mobile-job-min, 300px), 1fr))',
                    gap: '1.5rem'
                }}>
                    {jobs.filter(j => !j.source || !j.source.toLowerCase().includes('whatsapp')).length === 0 ? (
                        <div className="empty-state"><h3>No jobs available</h3><p>Check back later for new openings</p></div>
                    ) : (
                        jobs.filter(j => !j.source || !j.source.toLowerCase().includes('whatsapp')).map((job) => (
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
                                        <button className="btn btn-secondary btn-sm" onClick={(e) => { e.stopPropagation(); navigate('/student/preparation', { state: { jobPrep: { title: job.title, company: job.company, description: job.description, skills: job.eligibility?.skills || [job.title] } } }); }}>🚀 Prepare</button>
                                        <button className="btn btn-secondary btn-sm" onClick={() => setSelectedJob({ ...job, viewOnly: true })}>Details</button>
                                    </div>
                                </div>
                            </div>
                        ))
                    )}
                </div>
                ) : activeTab === 'whatsapp' ? (
                    <div className="jobs-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(var(--mobile-job-min, 300px), 1fr))', gap: '1.5rem' }}>
                        {jobs.filter(j => j.source && j.source.toLowerCase().includes('whatsapp')).length === 0 ? (
                             <div className="empty-state"><h3>No Community Jobs available</h3><p>Jobs imported from WhatsApp/Admin will show here.</p></div>
                        ) : jobs.filter(j => j.source && j.source.toLowerCase().includes('whatsapp')).map((job) => (
                            <div key={job._id} className="job-card hover-lift" style={{ height: '100%', display: 'flex', flexDirection: 'column', border: '1px solid #10b981', boxShadow: '0 4px 6px rgba(16, 185, 129, 0.1)' }}>
                                <div style={{ flex: 1 }}>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.25rem' }}>
                                        <h3 style={{ fontSize: '1.1rem', margin: 0 }}>{job.title}</h3>
                                        <span className="badge" style={{ background: '#ecfdf5', color: '#059669', fontSize: '0.65rem' }}>WhatsApp</span>
                                    </div>
                                    <p className="company" style={{ color: 'var(--primary)', fontWeight: 600, fontSize: '0.9rem', marginBottom: '1rem' }}>{job.company}</p>
                                    <div className="meta" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem', marginBottom: '1rem', fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                                        <span className="flex items-center gap-1"><FiMapPin /> {job.location}</span>
                                        <span className="flex items-center gap-1"><FiClock /> {job.type}</span>
                                        {job.salary && <span className="flex items-center gap-1">₹ {job.salary}</span>}
                                        <span className="flex items-center gap-1"><FiUsers /> {job.openings} openings</span>
                                    </div>
                                </div>
                                <div style={{ marginTop: 'auto', borderTop: '1px solid var(--border)', paddingTop: '1rem' }}>
                                    <div className="flex gap-2">
                                        <button className="btn btn-secondary btn-sm flex-1" onClick={(e) => { e.stopPropagation(); navigate('/student/preparation', { state: { jobPrep: { title: job.title, company: job.company, description: job.description, skills: job.eligibility?.skills || [job.title] } } }); }}>🚀 Prepare</button>
                                        <button className="btn btn-secondary btn-sm" onClick={() => setSelectedJob({ ...job, viewOnly: true, isWhatsApp: true })}>Details</button>
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
                        {loadingExternal ? (
                            <div className="empty-state"><div className="spinner"></div><p>Searching web for jobs matching your profile...</p></div>
                        ) : externalJobs.length === 0 ? (
                            <div className="empty-state"><h3>No external jobs found</h3><p>Update your skills in the profile to see matches.</p></div>
                        ) : (
                            <>
                                {/* --- Jobs In India --- */}
                                <div>
                                    <h2 style={{ fontSize: '1.25rem', marginBottom: '1rem', color: 'var(--text)', borderBottom: '2px solid var(--border)', paddingBottom: '0.5rem' }}>
                                        🇮🇳 Available to Apply from India (Local & Global Remote)
                                    </h2>
                                    <div className="jobs-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(var(--mobile-job-min, 300px), 1fr))', gap: '1.5rem' }}>
                                        {externalJobs.filter(j => j.isIndia).length === 0 ? (
                                            <p style={{ color: 'var(--text-muted)' }}>No matches currently available in India.</p>
                                        ) : externalJobs.filter(j => j.isIndia).map((job) => (
                                            <div key={job.id} className="job-card hover-lift" style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
                                                <div style={{ flex: 1 }}>
                                                    <h3 style={{ fontSize: '1.1rem', marginBottom: '0.25rem' }}>{job.title}</h3>
                                                    <p className="company" style={{ color: 'var(--primary)', fontWeight: 600, fontSize: '0.9rem', marginBottom: '1rem' }}>{job.company}</p>
                                                    <div className="meta" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem', marginBottom: '1rem', fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                                                        <span className="flex items-center gap-1"><FiMapPin /> {job.location || 'Remote'}</span>
                                                        <span className="flex items-center gap-1"><FiClock /> {job.type || 'Full-time'}</span>
                                                        {job.salary && <span className="flex items-center gap-1">💰 {job.salary}</span>}
                                                    </div>
                                                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.4rem', marginBottom: '1rem' }}>
                                                        <span className="badge badge-secondary" style={{ fontSize: '0.65rem' }}>Source: {job.source}</span>
                                                    </div>
                                                </div>
                                                <div style={{ marginTop: 'auto', borderTop: '1px solid var(--border)', paddingTop: '1rem' }}>
                                                    <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: '1rem' }}>
                                                        Posted: {new Date(job.postedAt).toLocaleDateString()}
                                                    </p>
                                                    <div style={{ display: 'flex', gap: '0.5rem', flexDirection: 'column' }}>
                                                        <a href={job.applyUrl} target="_blank" rel="noreferrer" className="btn btn-primary" style={{ display: 'block', textAlign: 'center', width: '100%' }}>
                                                            Apply on {job.source.split(' ')[0]}
                                                        </a>
                                                        <button 
                                                            className="btn btn-secondary" 
                                                            style={{ border: '1px solid var(--primary)', color: 'var(--primary)', width: '100%' }}
                                                            onClick={() => navigate('/student/preparation', { state: { jobPrep: { title: job.title, company: job.company, description: job.description, skills: job.searchKeywords || [job.title] } } })}
                                                        >
                                                            🚀 Prepare for this Role
                                                        </button>
                                                    </div>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </div>

                                {/* --- Global / Remote Jobs --- */}
                                <div>
                                    <h2 style={{ fontSize: '1.25rem', marginBottom: '1rem', color: 'var(--text)', borderBottom: '2px solid var(--border)', paddingBottom: '0.5rem' }}>
                                        🌍 Restricted Location (Outside India / Visa Needed)
                                    </h2>
                                    <div className="jobs-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(var(--mobile-job-min, 300px), 1fr))', gap: '1.5rem' }}>
                                        {externalJobs.filter(j => !j.isIndia).length === 0 ? (
                                            <p style={{ color: 'var(--text-muted)' }}>No international matches right now.</p>
                                        ) : externalJobs.filter(j => !j.isIndia).map((job) => (
                                            <div key={job.id} className="job-card hover-lift" style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
                                                <div style={{ flex: 1 }}>
                                                    <h3 style={{ fontSize: '1.1rem', marginBottom: '0.25rem' }}>{job.title}</h3>
                                                    <p className="company" style={{ color: 'var(--primary)', fontWeight: 600, fontSize: '0.9rem', marginBottom: '1rem' }}>{job.company}</p>
                                                    <div className="meta" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem', marginBottom: '1rem', fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                                                        <span className="flex items-center gap-1"><FiMapPin /> {job.location || 'Remote'}</span>
                                                        <span className="flex items-center gap-1"><FiClock /> {job.type || 'Full-time'}</span>
                                                        {job.salary && <span className="flex items-center gap-1">💰 {job.salary}</span>}
                                                    </div>
                                                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.4rem', marginBottom: '1rem' }}>
                                                        <span className="badge badge-secondary" style={{ fontSize: '0.65rem' }}>Source: {job.source}</span>
                                                    </div>
                                                </div>
                                                <div style={{ marginTop: 'auto', borderTop: '1px solid var(--border)', paddingTop: '1rem' }}>
                                                    <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: '1rem' }}>
                                                        Posted: {new Date(job.postedAt).toLocaleDateString()}
                                                    </p>
                                                    <a href={job.applyUrl} target="_blank" rel="noreferrer" className="btn btn-primary" style={{ display: 'block', textAlign: 'center', width: '100%' }}>
                                                        Apply on {job.source.split(' ')[0]}
                                                    </a>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            </>
                        )}
                    </div>
                )}
            </div>

            {selectedJob && (
                <div
                        style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem' }}
                        onClick={() => setSelectedJob(null)}
                    >
                        <div
                            style={{ background: 'var(--bg-card)', borderRadius: '8px', border: '1px solid var(--border)', maxWidth: '720px', width: '100%', maxHeight: '90vh', overflowY: 'auto', padding: '2rem', position: 'relative', boxShadow: '0 20px 60px rgba(0,0,0,0.3)' }}
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
                            {!selectedJob.viewOnly && !selectedJob.isWhatsApp && !appliedJobs.includes(selectedJob._id) && (
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
                                <button 
                                    className="btn btn-primary" 
                                    style={{ background: 'var(--bg-card)', border: '1px solid var(--primary)', color: 'var(--primary)' }}
                                    onClick={() => navigate('/student/preparation', { state: { jobPrep: { title: selectedJob.title, company: selectedJob.company, description: selectedJob.description, skills: selectedJob.eligibility?.skills || selectedJob.searchKeywords || [selectedJob.title] } } })}
                                >
                                    🚀 Prepare for this Role
                                </button>
                                {!selectedJob.viewOnly && !appliedJobs.includes(selectedJob._id) && (
                                    <button 
                                        className="btn btn-primary"
                                        onClick={() => handleApply(selectedJob._id)}
                                        disabled={applying || !isEligibleToApply}
                                    >
                                        {applying ? '⏳ Submitting...' : '✓ Submit Application'}
                                    </button>
                                )}
                                {selectedJob.isWhatsApp && selectedJob.applyUrl && (
                                    <a
                                        href={selectedJob.applyUrl}
                                        target="_blank"
                                        rel="noreferrer"
                                        className="btn btn-primary"
                                        style={{ background: '#10b981', borderColor: '#10b981', color: '#fff' }}
                                    >
                                        🔗 Open Apply Link
                                    </a>
                                )}
                            </div>
                        </div>
                    </div>
                )}
        </Layout>
    );
};

export default StudentJobs;
