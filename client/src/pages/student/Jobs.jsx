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

                {selectedJob && (
                    <div className="modal-overlay" onClick={() => setSelectedJob(null)}>
                        <div className="modal modal-lg" onClick={(e) => e.stopPropagation()}>
                            <h2>{selectedJob.title}</h2>
                            <p style={{ color: 'var(--primary-light)', fontWeight: 500 }}>{selectedJob.company}</p>
                            <div className="meta" style={{ margin: '1rem 0', display: 'flex', gap: '1rem', color: 'var(--text-muted)', fontSize: '0.9rem' }}>
                                <span><FiMapPin /> {selectedJob.location}</span>
                                <span><FiClock /> {selectedJob.type}</span>
                                {selectedJob.salary && <span>₹ {selectedJob.salary}</span>}
                            </div>
                            {selectedJob.attachmentFile && (
                                <div style={{ marginBottom: '1rem', padding: '0.75rem', backgroundColor: '#f0f9ff', borderRadius: '8px', border: '1px solid #0ea5e9' }}>
                                    <p style={{ margin: '0 0 0.5rem 0', fontSize: '0.85rem', fontWeight: 600, color: '#0369a1' }}>📎 Job Attachment</p>
                                    <button
                                        className="btn btn-secondary btn-sm"
                                        onClick={() => {
                                            const element = document.createElement('a');
                                            const file = new Blob([Buffer.from(selectedJob.attachmentFile, 'base64')], { type: selectedJob.attachmentContentType });
                                            element.href = URL.createObjectURL(file);
                                            element.download = selectedJob.attachmentFileName || 'attachment';
                                            document.body.appendChild(element);
                                            element.click();
                                            document.body.removeChild(element);
                                        }}
                                    >
                                        ⬇ {selectedJob.attachmentFileName}
                                    </button>
                                </div>
                            )}
                            <div style={{ marginBottom: '1rem' }}>
                                <h4 style={{ fontSize: '0.9rem', marginBottom: '0.5rem' }}>Description</h4>
                                <p style={{ fontSize: '0.9rem', color: 'var(--text-secondary)' }}>{selectedJob.description}</p>
                            </div>
                            {selectedJob.requirements?.length > 0 && (
                                <div style={{ marginBottom: '1rem' }}>
                                    <h4 style={{ fontSize: '0.9rem', marginBottom: '0.5rem' }}>Requirements</h4>
                                    <ul style={{ paddingLeft: '1.5rem', color: 'var(--text-secondary)', fontSize: '0.9rem' }}>
                                        {selectedJob.requirements.map((r, i) => <li key={i}>{r}</li>)}
                                    </ul>
                                </div>
                            )}
                            {!selectedJob.viewOnly && !appliedJobs.includes(selectedJob._id) && (
                                <div style={{ marginTop: '1rem' }}>
                                    <div className="form-group">
                                        <label>Cover Letter (optional)</label>
                                        <textarea value={coverLetter} onChange={(e) => setCoverLetter(e.target.value)} rows="3" placeholder="Why are you interested in this role?" />
                                    </div>
                                </div>
                            )}
                            <div className="modal-actions">
                                <button className="btn btn-secondary" onClick={() => setSelectedJob(null)}>Close</button>
                                {!selectedJob.viewOnly && !appliedJobs.includes(selectedJob._id) && (
                                    <button className="btn btn-primary" onClick={() => handleApply(selectedJob._id)} disabled={applying || !isEligibleToApply}>
                                        {applying ? 'Submitting...' : 'Submit Application'}
                                    </button>
                                )}
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </Layout>
    );
};

export default StudentJobs;
