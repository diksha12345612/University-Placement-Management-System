import { useState, useEffect } from 'react';
import Layout from '../../components/Layout';
import { jobAPI, applicationAPI, FILE_BASE_URL } from '../../services/api';
import toast from 'react-hot-toast';
import ATSScoreCard from '../../components/ATSScoreCard';

const statusColors = { pending: 'badge-warning', approved: 'badge-success', rejected: 'badge-danger' };
const appStatusColors = { applied: 'badge-info', shortlisted: 'badge-warning', interview: 'badge-primary', selected: 'badge-success', rejected: 'badge-danger' };

const recommendationColors = {
    Strong: { bg: 'rgba(16,185,129,0.12)', color: 'var(--success)', border: 'rgba(16,185,129,0.3)' },
    Moderate: { bg: 'rgba(234,179,8,0.12)', color: 'var(--warning)', border: 'rgba(234,179,8,0.3)' },
    Weak: { bg: 'rgba(239,68,68,0.12)', color: 'var(--danger)', border: 'rgba(239,68,68,0.3)' },
};

const MiniBar = ({ value, color }) => (
    <div style={{ height: '4px', background: 'var(--bg-dark)', borderRadius: '99px', overflow: 'hidden', width: '60px', display: 'inline-block', verticalAlign: 'middle', marginLeft: '4px' }}>
        <div style={{ height: '100%', width: `${value}%`, background: color, borderRadius: '99px' }} />
    </div>
);

const MyJobs = () => {
    const [jobs, setJobs] = useState([]);
    const [loading, setLoading] = useState(true);
    const [selectedJob, setSelectedJob] = useState(null);
    const [applicants, setApplicants] = useState([]);
    const [ranking, setRanking] = useState(false);
    const [selectedCandidate, setSelectedCandidate] = useState(null);
    const [reEvaluating, setReEvaluating] = useState(false);

    useEffect(() => { loadJobs(); }, []);

    const loadJobs = async () => {
        try { const res = await jobAPI.getMyJobs(); setJobs(res.data); } catch { } finally { setLoading(false); }
    };

    const viewApplicants = async (job) => {
        setSelectedJob(job);
        setSelectedCandidate(null);
        try { const res = await applicationAPI.getJobApplicants(job._id); setApplicants(res.data); } catch { }
    };

    const handleAIRank = async () => {
        if (!selectedJob || ranking) return;
        setRanking(true);
        const toastId = toast.loading('✨ AI is analyzing and ranking candidates...');
        try {
            const res = await applicationAPI.aiRank(selectedJob._id);
            setApplicants(res.data);
            toast.success(`Candidates ranked! ${res.data.length} analysed.`, { id: toastId });
        } catch (err) {
            toast.error(err.response?.data?.error || 'AI Ranking failed', { id: toastId });
        } finally {
            setRanking(false);
        }
    };

    const updateAppStatus = async (appId, status) => {
        try {
            await applicationAPI.updateStatus(appId, status);
            setApplicants(applicants.map(app => app._id === appId ? { ...app, status } : app));
            toast.success(`Status updated to ${status}`);
        } catch {
            toast.error('Failed to update status');
        }
    };

    const handleReEvaluate = async (candidateId) => {
        setReEvaluating(true);
        const toastId = toast.loading('Re-evaluating resume...');
        try {
            const res = await applicationAPI.reEvaluateResume(candidateId);
            setApplicants(applicants.map(app => 
                app._id === candidateId 
                    ? { ...app, atsEvaluation: res.data.atsEvaluation, aiEvaluation: res.data.aiEvaluation }
                    : app
            ));
            setSelectedCandidate(prev => ({ 
                ...prev, 
                atsEvaluation: res.data.atsEvaluation,
                aiEvaluation: res.data.aiEvaluation 
            }));
            toast.success('Resume re-evaluated with fresh ATS scoring!', { id: toastId });
        } catch (err) {
            toast.error(err.response?.data?.error || 'Re-evaluation failed', { id: toastId });
        } finally {
            setReEvaluating(false);
        }
    };

    const deleteJob = async (id) => {
        if (!window.confirm('Delete this job?')) return;
        try { await jobAPI.delete(id); setJobs(jobs.filter(j => j._id !== id)); toast.success('Job deleted'); } catch { toast.error('Failed to delete'); }
    };

    if (loading) return <Layout title="My Jobs"><div className="loading"><div className="spinner"></div></div></Layout>;

    return (
        <Layout title="My Jobs">
            <div className="fade-in">
                {jobs.length === 0 ? (
                    <div className="empty-state"><h3>No jobs posted yet</h3></div>
                ) : (
                    <div className="table-container">
                        <table className="responsive-table">
                            <thead>
                                <tr>
                                    <th>Title</th>
                                    <th>Company</th>
                                    <th>Type</th>
                                    <th>Status</th>
                                    <th>Deadline</th>
                                    <th>Actions</th>
                                </tr>
                            </thead>
                            <tbody>
                                {jobs.map((job) => (
                                    <tr key={job._id}>
                                        <td data-label="Title" style={{ fontWeight: 600 }}>{job.title}</td>
                                        <td data-label="Company">{job.company}</td>
                                        <td data-label="Type">{job.type}</td>
                                        <td data-label="Status">
                                            <span className={`badge ${statusColors[job.status]}`}>
                                                {job.status.toUpperCase()}
                                            </span>
                                        </td>
                                        <td data-label="Deadline">{new Date(job.deadline).toLocaleDateString()}</td>
                                        <td data-label="Actions">
                                            <div className="flex gap-1 justify-end-mobile">
                                                <button className="btn btn-secondary btn-sm" onClick={() => viewApplicants(job)}>Applicants</button>
                                                <button className="btn btn-danger btn-sm" onClick={() => deleteJob(job._id)}>Delete</button>
                                            </div>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>

            {/* Applicants Modal */}
            {selectedJob && !selectedCandidate && (
                <div className="modal-overlay" onClick={() => setSelectedJob(null)}>
                    <div className="modal modal-lg" onClick={(e) => e.stopPropagation()} style={{ width: '95vw' }}>
                        <div className="flex flex-col md-flex-row justify-between items-start md-items-center mb-4 gap-3">
                            <div>
                                <h2 style={{ margin: 0 }}>Applicants — {selectedJob.title}</h2>
                                <p style={{ color: 'var(--text-muted)', fontSize: '0.8rem', margin: '0.25rem 0 0' }}>
                                    {applicants.length} total •{' '}
                                    {applicants.filter(a => a.aiEvaluation?.matchScore > 0).length} AI-ranked
                                </p>
                            </div>
                            <button
                                className="btn btn-primary btn-sm w-full-mobile"
                                onClick={handleAIRank}
                                disabled={ranking || applicants.length === 0}
                                style={{ background: 'linear-gradient(135deg, #6366f1, #0ea5e9)', minWidth: '160px' }}
                            >
                                {ranking ? '✨ Ranking...' : '✨ AI Rank Candidates'}
                            </button>
                        </div>

                        {applicants.length === 0 ? (
                            <p style={{ color: 'var(--text-muted)' }}>No applicants yet</p>
                        ) : (
                            <div className="table-container">
                                <table className="responsive-table">
                                    <thead>
                                        <tr>
                                            <th>Candidate</th>
                                            <th style={{ textAlign: 'center' }}>AI Match</th>
                                            <th className="hidden-mobile">Skills</th>
                                            <th>Resume</th>
                                            <th>Status</th>
                                            <th>Actions</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {applicants.map((app) => {
                                            const ai = app.aiEvaluation;
                                            const matchScore = ai?.matchScore || ai?.matchPercentage || 0;
                                            const hasAI = matchScore > 0;
                                            const recStyle = hasAI && ai.recommendation ? recommendationColors[ai.recommendation] : null;

                                            return (
                                                <tr key={app._id} onClick={() => hasAI && setSelectedCandidate(app)} style={{ cursor: hasAI ? 'pointer' : 'default' }}>
                                                    <td data-label="Candidate">
                                                        <div style={{ fontWeight: 600 }}>{app.student?.name}</div>
                                                        <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }} className="hidden-mobile">{app.student?.email}</div>
                                                        {hasAI && recStyle && (
                                                            <span style={{ fontSize: '0.64rem', fontWeight: 700, padding: '1px 6px', borderRadius: '99px', background: recStyle.bg, color: recStyle.color, border: `1px solid ${recStyle.border}`, display: 'inline-block', marginTop: '2px' }}>
                                                                {ai.recommendation}
                                                            </span>
                                                        )}
                                                    </td>
                                                    <td data-label="AI Match" style={{ textAlign: 'center' }}>
                                                        {hasAI ? (
                                                            <div className="flex items-center justify-center-mobile gap-1">
                                                                <span style={{ fontWeight: 800, fontSize: '0.95rem', color: matchScore >= 75 ? 'var(--success)' : matchScore >= 50 ? 'var(--warning)' : 'var(--danger)' }}>
                                                                    {matchScore}%
                                                                </span>
                                                                <div className="hidden-mobile">
                                                                    <MiniBar value={matchScore} color={matchScore >= 75 ? 'var(--success)' : matchScore >= 50 ? 'var(--warning)' : 'var(--danger)'} />
                                                                </div>
                                                            </div>
                                                        ) : (
                                                            <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>—</span>
                                                        )}
                                                    </td>
                                                    <td data-label="Skills" className="hidden-mobile">
                                                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.2rem' }}>
                                                            {(app.student?.studentProfile?.skills || []).slice(0, 2).map((s, i) => (
                                                                <span key={i} className="badge badge-primary" style={{ fontSize: '0.63rem' }}>{s}</span>
                                                            ))}
                                                        </div>
                                                    </td>
                                                    <td data-label="Resume" onClick={e => e.stopPropagation()}>
                                                        {app.student?.studentProfile?.resumeUrl ? (
                                                            <a href={`${FILE_BASE_URL}${app.student.studentProfile.resumeUrl}`} target="_blank" rel="noreferrer" className="btn btn-secondary btn-sm" style={{ padding: '0.2rem 0.5rem', fontSize: '0.72rem' }}>PDF</a>
                                                        ) : (
                                                            <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>—</span>
                                                        )}
                                                    </td>
                                                    <td data-label="Status">
                                                        <span className={`badge ${appStatusColors[app.status]}`} style={{ fontSize: '0.65rem' }}>
                                                            {app.status.toUpperCase()}
                                                        </span>
                                                    </td>
                                                    <td data-label="Actions" onClick={e => e.stopPropagation()}>
                                                        <div className="flex gap-1 justify-end-mobile">
                                                            <button className="btn btn-secondary btn-sm" title="View Profile" onClick={() => setSelectedCandidate(app)}>👤</button>
                                                            {app.status === 'applied' && <button className="btn btn-success btn-sm" title="Shortlist" onClick={() => updateAppStatus(app._id, 'shortlisted')}>✔️</button>}
                                                            {app.status === 'shortlisted' && <button className="btn btn-primary btn-sm" title="Select" onClick={() => updateAppStatus(app._id, 'selected')}>🎯</button>}
                                                            <button className="btn btn-danger btn-sm" title="Reject" onClick={() => updateAppStatus(app._id, 'rejected')}>✖️</button>
                                                        </div>
                                                    </td>
                                                </tr>
                                            );
                                        })}
                                    </tbody>
                                </table>
                            </div>
                        )}

                        <div className="modal-actions">
                            <span className="hidden-mobile" style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>💡 Click a ranked candidate row to view AI detail</span>
                            <button className="btn btn-secondary w-full-mobile" onClick={() => setSelectedJob(null)}>Close</button>
                        </div>
                    </div>
                </div>
            )}

            {/* Candidate Detail Modal - Full Profile */}
            {selectedCandidate && (
                <div className="modal-overlay" onClick={() => setSelectedCandidate(null)}>
                    <div className="modal modal-lg" onClick={(e) => e.stopPropagation()} style={{ width: '95vw', maxHeight: '90vh', overflowY: 'auto', position: 'relative' }}>
                        {/* Close button */}
                        <button onClick={() => setSelectedCandidate(null)} style={{ position: 'absolute', top: '1rem', right: '1rem', background: 'none', border: 'none', fontSize: '1.5rem', cursor: 'pointer' }}>✕</button>
                        
                        <div style={{ marginBottom: '1.5rem', paddingRight: '2rem' }}>
                            <h2 style={{ margin: 0 }}>📋 Applicant Profile</h2>
                            <p style={{ color: 'var(--text-muted)', fontSize: '0.82rem', marginTop: '0.25rem' }}>
                                Applied: {selectedCandidate.appliedAt ? new Date(selectedCandidate.appliedAt).toLocaleDateString('en-IN') : 'N/A'} • Status: <span className={`badge ${appStatusColors[selectedCandidate.status]}`} style={{ fontSize: '0.65rem' }}>{selectedCandidate.status.toUpperCase()}</span>
                            </p>
                        </div>

                        <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr)', gap: '1.5rem' }}>
                            {/* Personal Information */}
                            <div style={{ background: 'var(--bg-dark)', borderRadius: '10px', padding: '1.25rem' }}>
                                <h4 style={{ marginTop: 0, marginBottom: '1rem', color: 'var(--primary)' }}>Personal Information</h4>
                                
                                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem' }}>
                                    <div>
                                        <label style={{ fontSize: '0.75rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', display: 'block', marginBottom: '0.25rem' }}>Full Name</label>
                                        <p style={{ margin: 0, fontWeight: 600 }}>{selectedCandidate.student?.name || 'N/A'}</p>
                                    </div>
                                    
                                    <div>
                                        <label style={{ fontSize: '0.75rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', display: 'block', marginBottom: '0.25rem' }}>Email</label>
                                        <a href={`mailto:${selectedCandidate.student?.email}`} style={{ color: 'var(--primary)', fontWeight: 600, wordBreak: 'break-all' }}>{selectedCandidate.student?.email || 'N/A'}</a>
                                    </div>

                                    <div>
                                        <label style={{ fontSize: '0.75rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', display: 'block', marginBottom: '0.25rem' }}>Roll Number</label>
                                        <p style={{ margin: 0, fontWeight: 600 }}>{selectedCandidate.student?.studentProfile?.rollNumber || 'N/A'}</p>
                                    </div>

                                    <div>
                                        <label style={{ fontSize: '0.75rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', display: 'block', marginBottom: '0.25rem' }}>Department</label>
                                        <p style={{ margin: 0, fontWeight: 600 }}>{selectedCandidate.student?.studentProfile?.department || 'N/A'}</p>
                                    </div>

                                    <div>
                                        <label style={{ fontSize: '0.75rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', display: 'block', marginBottom: '0.25rem' }}>Batch</label>
                                        <p style={{ margin: 0, fontWeight: 600 }}>{selectedCandidate.student?.studentProfile?.batch || 'N/A'}</p>
                                    </div>

                                    <div>
                                        <label style={{ fontSize: '0.75rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', display: 'block', marginBottom: '0.25rem' }}>CGPA</label>
                                        <p style={{ margin: 0, fontWeight: 600 }}>{selectedCandidate.student?.studentProfile?.cgpa || 'N/A'}</p>
                                    </div>

                                    <div>
                                        <label style={{ fontSize: '0.75rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', display: 'block', marginBottom: '0.25rem' }}>Mobile Number</label>
                                        <p style={{ margin: 0, fontWeight: 600 }}>{(selectedCandidate.student?.studentProfile?.phoneCountryCode || '+91') + ' ' + (selectedCandidate.student?.studentProfile?.phone || 'N/A')}</p>
                                    </div>

                                    <div>
                                        <label style={{ fontSize: '0.75rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', display: 'block', marginBottom: '0.25rem' }}>Gender</label>
                                        <p style={{ margin: 0, fontWeight: 600 }}>{selectedCandidate.student?.studentProfile?.gender || 'N/A'}</p>
                                    </div>
                                </div>
                            </div>

                            {/* Academic Performance */}
                            <div style={{ background: 'var(--bg-dark)', borderRadius: '10px', padding: '1.25rem' }}>
                                <h4 style={{ marginTop: 0, marginBottom: '1rem', color: 'var(--primary)' }}>Academic Performance</h4>
                                
                                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem' }}>
                                    <div>
                                        <label style={{ fontSize: '0.75rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', display: 'block', marginBottom: '0.25rem' }}>10th %</label>
                                        <p style={{ margin: 0, fontWeight: 600 }}>{selectedCandidate.student?.studentProfile?.tenthPercentage ? `${selectedCandidate.student.studentProfile.tenthPercentage}%` : 'N/A'}</p>
                                    </div>

                                    <div>
                                        <label style={{ fontSize: '0.75rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', display: 'block', marginBottom: '0.25rem' }}>12th %</label>
                                        <p style={{ margin: 0, fontWeight: 600 }}>{selectedCandidate.student?.studentProfile?.twelfthPercentage ? `${selectedCandidate.student.studentProfile.twelfthPercentage}%` : 'N/A'}</p>
                                    </div>
                                </div>
                            </div>

                            {/* Skills */}
                            {selectedCandidate.student?.studentProfile?.skills?.length > 0 && (
                                <div style={{ background: 'var(--bg-dark)', borderRadius: '10px', padding: '1.25rem' }}>
                                    <h4 style={{ marginTop: 0, marginBottom: '1rem', color: 'var(--primary)' }}>Skills</h4>
                                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
                                        {selectedCandidate.student.studentProfile.skills.map((skill, i) => (
                                            <span key={i} className="badge badge-primary">{skill}</span>
                                        ))}
                                    </div>
                                </div>
                            )}

                            {/* Professional Links */}
                            {(selectedCandidate.student?.studentProfile?.linkedIn || selectedCandidate.student?.studentProfile?.github || selectedCandidate.student?.studentProfile?.portfolio) && (
                                <div style={{ background: 'var(--bg-dark)', borderRadius: '10px', padding: '1.25rem' }}>
                                    <h4 style={{ marginTop: 0, marginBottom: '1rem', color: 'var(--primary)' }}>Professional Links</h4>
                                    
                                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem' }}>
                                        {selectedCandidate.student?.studentProfile?.linkedIn && (
                                            <div>
                                                <label style={{ fontSize: '0.75rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', display: 'block', marginBottom: '0.25rem' }}>LinkedIn</label>
                                                <a href={selectedCandidate.student.studentProfile.linkedIn} target="_blank" rel="noreferrer" style={{ color: 'var(--primary)', wordBreak: 'break-all', fontWeight: 600 }}>
                                                    View Profile
                                                </a>
                                            </div>
                                        )}

                                        {selectedCandidate.student?.studentProfile?.github && (
                                            <div>
                                                <label style={{ fontSize: '0.75rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', display: 'block', marginBottom: '0.25rem' }}>GitHub</label>
                                                <a href={selectedCandidate.student.studentProfile.github} target="_blank" rel="noreferrer" style={{ color: 'var(--primary)', wordBreak: 'break-all', fontWeight: 600 }}>
                                                    View Profile
                                                </a>
                                            </div>
                                        )}

                                        {selectedCandidate.student?.studentProfile?.portfolio && (
                                            <div>
                                                <label style={{ fontSize: '0.75rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', display: 'block', marginBottom: '0.25rem' }}>Portfolio</label>
                                                <a href={selectedCandidate.student.studentProfile.portfolio} target="_blank" rel="noreferrer" style={{ color: 'var(--primary)', wordBreak: 'break-all', fontWeight: 600 }}>
                                                    Visit Portfolio
                                                </a>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            )}

                            {/* Address */}
                            {selectedCandidate.student?.studentProfile?.address && (
                                <div style={{ background: 'var(--bg-dark)', borderRadius: '10px', padding: '1.25rem' }}>
                                    <h4 style={{ marginTop: 0, marginBottom: '1rem', color: 'var(--primary)' }}>Address</h4>
                                    <p style={{ margin: 0 }}>{selectedCandidate.student.studentProfile.address}</p>
                                </div>
                            )}

                            {/* Resume */}
                            {selectedCandidate.student?.studentProfile?.resumeUrl && (
                                <div style={{ background: 'var(--bg-dark)', borderRadius: '10px', padding: '1.25rem' }}>
                                    <h4 style={{ marginTop: 0, marginBottom: '1rem', color: 'var(--primary)' }}>Resume</h4>
                                    <a href={`${FILE_BASE_URL}${selectedCandidate.student.studentProfile.resumeUrl}`} target="_blank" rel="noreferrer" className="btn btn-primary btn-sm">
                                        📄 Download Resume
                                    </a>
                                </div>
                            )}

                            {/* ATS Match / AI Evaluation (if available) */}
                            {selectedCandidate.atsEvaluation ? (
                                <div style={{ marginTop: '1.5rem' }}>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                                        <h4 style={{ margin: 0, color: 'var(--primary)', fontSize: '0.95rem', fontWeight: 700 }}>🤖 ATS Evaluation</h4>
                                        <button 
                                            onClick={() => handleReEvaluate(selectedCandidate._id)} 
                                            disabled={reEvaluating}
                                            className="btn btn-secondary btn-sm"
                                            style={{
                                                padding: '0.4rem 0.8rem',
                                                fontSize: '0.8rem',
                                                cursor: reEvaluating ? 'not-allowed' : 'pointer',
                                                opacity: reEvaluating ? 0.6 : 1
                                            }}
                                        >
                                            {reEvaluating ? '⏳ Re-evaluating...' : '🔄 Re-evaluate'}
                                        </button>
                                    </div>
                                    <ATSScoreCard result={selectedCandidate.atsEvaluation} />
                                    {selectedCandidate.aiEvaluation?.recommendation && (() => {
                                        const recStyle = recommendationColors[selectedCandidate.aiEvaluation.recommendation];
                                        return (
                                            <div style={{ display: 'flex', justifyContent: 'center', marginTop: '1rem' }}>
                                                <span style={{ padding: '0.4rem 1rem', borderRadius: '99px', fontWeight: 700, fontSize: '0.85rem', background: recStyle.bg, color: recStyle.color, border: `1px solid ${recStyle.border}` }}>
                                                    {selectedCandidate.aiEvaluation.recommendation} Candidate
                                                </span>
                                            </div>
                                        );
                                    })()}
                                </div>
                            ) : selectedCandidate.aiEvaluation?.matchScore > 0 && (
                                <div style={{ background: 'linear-gradient(135deg, rgba(99,102,241,0.08), rgba(14,165,233,0.08))', borderRadius: '10px', padding: '1.25rem', border: '1px solid rgba(99,102,241,0.2)' }}>
                                    <h4 style={{ marginTop: 0, marginBottom: '1rem', color: 'var(--primary)' }}>🤖 AI Evaluation</h4>
                                    
                                    <div className="grid-cols-1-mobile" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '0.75rem', marginBottom: '1.25rem' }}>
                                        {(() => {
                                            const ai = selectedCandidate.aiEvaluation;
                                            const matchScore = ai.matchScore || ai.matchPercentage || 0;
                                            const skillScore = ai.skillMatchScore || 0;
                                            const expScore = ai.experienceMatchScore || 0;

                                            return [
                                                { label: 'Overall Match', value: matchScore, color: matchScore >= 75 ? 'var(--success)' : matchScore >= 50 ? 'var(--warning)' : 'var(--danger)' },
                                                { label: 'Skills Match', value: skillScore, color: 'var(--secondary)' },
                                                { label: 'Experience Match', value: expScore, color: 'var(--primary-light)' }
                                            ].map(({ label, value, color }) => (
                                                <div key={label} style={{ textAlign: 'center', padding: '0.75rem', background: 'var(--bg-dark)', borderRadius: '8px' }}>
                                                    <div style={{ fontSize: '1.25rem', fontWeight: 800, color }}>{value}%</div>
                                                    <div style={{ fontSize: '0.65rem', color: 'var(--text-muted)' }}>{label}</div>
                                                </div>
                                            ));
                                        })()}
                                    </div>

                                    {selectedCandidate.aiEvaluation.recommendation && (() => {
                                        const recStyle = recommendationColors[selectedCandidate.aiEvaluation.recommendation];
                                        return (
                                            <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '1rem' }}>
                                                <span style={{ padding: '0.4rem 1rem', borderRadius: '99px', fontWeight: 700, fontSize: '0.85rem', background: recStyle.bg, color: recStyle.color, border: `1px solid ${recStyle.border}` }}>
                                                    {selectedCandidate.aiEvaluation.recommendation} Candidate
                                                </span>
                                            </div>
                                        );
                                    })()}

                                    {selectedCandidate.aiEvaluation.strengthSummary && (
                                        <div style={{ padding: '0.75rem', background: 'rgba(16,185,129,0.06)', borderRadius: '8px', border: '1px solid rgba(16,185,129,0.15)', marginBottom: '0.75rem' }}>
                                            <p style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--success)', marginBottom: '0.25rem' }}>✓ Strengths</p>
                                            <p style={{ fontSize: '0.84rem', margin: 0 }}>{selectedCandidate.aiEvaluation.strengthSummary}</p>
                                        </div>
                                    )}

                                    {selectedCandidate.aiEvaluation.riskFactors?.length > 0 && (
                                        <div style={{ padding: '0.75rem', background: 'rgba(239,68,68,0.06)', borderRadius: '8px', border: '1px solid rgba(239,68,68,0.15)' }}>
                                            <p style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--danger)', marginBottom: '0.5rem' }}>⚠️ Risk Factors</p>
                                            <ul style={{ paddingLeft: '1.25rem', margin: 0 }}>
                                                {selectedCandidate.aiEvaluation.riskFactors.slice(0, 3).map((r, i) => <li key={i} style={{ fontSize: '0.82rem', marginBottom: '0.25rem' }}>{r}</li>)}
                                            </ul>
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>

                        {/* Actions */}
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem', marginTop: '1.5rem' }}>
                            {selectedCandidate.status === 'applied' && (
                                <button className="btn btn-success btn-sm flex-1" onClick={() => { updateAppStatus(selectedCandidate._id, 'shortlisted'); setSelectedCandidate(null); }}>✔️ Shortlist</button>
                            )}
                            {selectedCandidate.status === 'shortlisted' && (
                                <button className="btn btn-primary btn-sm flex-1" onClick={() => { updateAppStatus(selectedCandidate._id, 'selected'); setSelectedCandidate(null); }}>🎯 Select for Interview</button>
                            )}
                            {selectedCandidate.status !== 'rejected' && (
                                <button className="btn btn-danger btn-sm flex-1" onClick={() => { updateAppStatus(selectedCandidate._id, 'rejected'); setSelectedCandidate(null); }}>✖️ Reject</button>
                            )}
                            <button className="btn btn-secondary btn-sm w-full-mobile" onClick={() => setSelectedCandidate(null)}>Close</button>
                        </div>
                    </div>
                </div>
            )}
        </Layout>
    );
};

export default MyJobs;
