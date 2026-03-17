import { useState, useEffect } from 'react';
import Layout from '../../components/Layout';
import { adminAPI, jobAPI } from '../../services/api';
import toast from 'react-hot-toast';

const statusColors = { pending: 'badge-warning', approved: 'badge-success', rejected: 'badge-danger' };

const AdminJobs = () => {
    const [jobs, setJobs] = useState([]);
    const [tab, setTab] = useState('pending');
    const [loading, setLoading] = useState(true);
    const [selectedJob, setSelectedJob] = useState(null);

    useEffect(() => { loadJobs(); }, []);

    const loadJobs = async () => {
        try { const res = await jobAPI.getAll(); setJobs(res.data); } catch { } finally { setLoading(false); }
    };

    const updateStatus = async (id, status) => {
        try {
            await adminAPI.updateJobStatus(id, status);
            setJobs(jobs.map(j => j._id === id ? { ...j, status } : j));
            setSelectedJob(null);
            toast.success(`Job ${status}`);
        } catch { toast.error('Error updating status'); }
    };

    const filtered = tab === 'all' ? jobs : jobs.filter(j => j.status === tab);

    if (loading) return <Layout title="Job Approvals"><div className="loading"><div className="spinner"></div></div></Layout>;

    return (
        <Layout title="Job Approvals">
            <div className="fade-in">
                <div className="tabs" style={{
                    display: 'flex',
                    overflowX: 'auto',
                    whiteSpace: 'nowrap',
                    paddingBottom: '0.5rem',
                    marginBottom: '1.5rem',
                    gap: '0.5rem'
                }}>
                    {['pending', 'approved', 'rejected', 'all'].map(t => (
                        <div key={t} className={`tab ${tab === t ? 'active' : ''}`} onClick={() => setTab(t)} style={{ flex: '1', textAlign: 'center', minWidth: '100px' }}>
                            {t.charAt(0).toUpperCase() + t.slice(1)} {t !== 'all' && `(${jobs.filter(j => j.status === t).length})`}
                        </div>
                    ))}
                </div>

                {filtered.length === 0 ? (
                    <div className="empty-state"><h3>No {tab} jobs</h3></div>
                ) : (
                    <div className="table-container">
                        <table className="responsive-table">
                            <thead>
                                <tr>
                                    <th>Title</th>
                                    <th>Company</th>
                                    <th>Recruiter</th>
                                    <th>Type</th>
                                    <th>Status</th>
                                    <th>Actions</th>
                                </tr>
                            </thead>
                            <tbody>
                                {filtered.map((job) => (
                                    <tr key={job._id}>
                                        <td data-label="Title" style={{ fontWeight: 600 }}>{job.title}</td>
                                        <td data-label="Company">{job.company}</td>
                                        <td data-label="Recruiter">{job.postedBy?.name || 'N/A'}</td>
                                        <td data-label="Type">{job.type}</td>
                                        <td data-label="Status">
                                            <span className={`badge ${statusColors[job.status]}`}>
                                                {job.status.toUpperCase()}
                                            </span>
                                        </td>
                                        <td data-label="Actions">
                                            <div className="flex gap-1 justify-end-mobile">
                                                <button className="btn btn-secondary btn-sm" onClick={() => setSelectedJob(job)}>Review</button>
                                                {job.status === 'pending' && (
                                                    <>
                                                        <button className="btn btn-success btn-sm" onClick={() => updateStatus(job._id, 'approved')}>✓</button>
                                                        <button className="btn btn-danger btn-sm" onClick={() => updateStatus(job._id, 'rejected')}>✖</button>
                                                    </>
                                                )}
                                            </div>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>

            {/* Job Approval Modal (The 'Separated Box') */}
            {selectedJob && (
                <div className="modal-overlay" onClick={() => setSelectedJob(null)}>
                    <div className="modal" onClick={(e) => e.stopPropagation()}>
                        <h2 style={{ marginBottom: '0.5rem' }}>Job Details</h2>
                        <div style={{ marginBottom: '1.5rem', paddingBottom: '1rem', borderBottom: '1px solid var(--border)' }}>
                            <h3 style={{ fontSize: '1.1rem', color: 'var(--primary)', marginBottom: '0.25rem' }}>{selectedJob.title}</h3>
                            <p style={{ fontWeight: 600, fontSize: '0.95rem' }}>{selectedJob.company}</p>
                            <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>Posted by: {selectedJob.postedBy?.name || 'N/A'}</p>
                        </div>

                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '1.5rem' }}>
                            <div>
                                <label style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase' }}>Type</label>
                                <p style={{ fontSize: '0.9rem' }}>{selectedJob.type}</p>
                            </div>
                            <div>
                                <label style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase' }}>Location</label>
                                <p style={{ fontSize: '0.9rem' }}>{selectedJob.location}</p>
                            </div>
                            <div>
                                <label style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase' }}>Deadline</label>
                                <p style={{ fontSize: '0.9rem' }}>{new Date(selectedJob.deadline).toLocaleDateString()}</p>
                            </div>
                            <div>
                                <label style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase' }}>Status</label>
                                <p><span className={`badge ${statusColors[selectedJob.status]}`}>{selectedJob.status}</span></p>
                            </div>
                        </div>

                        <div style={{ marginBottom: '1.5rem' }}>
                            <label style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase' }}>Description</label>
                            <p style={{ fontSize: '0.9rem', color: 'var(--text-secondary)', marginTop: '0.25rem' }}>{selectedJob.description}</p>
                        </div>

                        {selectedJob.attachmentFile && (
                            <div style={{ marginBottom: '1.5rem', padding: '0.75rem', backgroundColor: '#f0f9ff', borderRadius: '8px', border: '1px solid #0ea5e9' }}>
                                <p style={{ margin: '0 0 0.5rem 0', fontSize: '0.85rem', fontWeight: 600, color: '#0369a1' }}>📎 Job Attachment</p>
                                <button
                                    className="btn btn-secondary btn-sm"
                                    onClick={async () => {
                                        try {
                                            const blob = await jobAPI.getAttachment(selectedJob._id);
                                            const element = document.createElement('a');
                                            element.href = URL.createObjectURL(blob);
                                            element.download = selectedJob.attachmentFileName || 'attachment';
                                            document.body.appendChild(element);
                                            element.click();
                                            document.body.removeChild(element);
                                        } catch (err) {
                                            toast.error('Failed to download attachment');
                                        }
                                    }}
                                >
                                    ⬇ {selectedJob.attachmentFileName}
                                </button>
                            </div>
                        )}

                        <div className="modal-actions" style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
                            {selectedJob.status === 'pending' && (
                                <>
                                    <button className="btn btn-success flex-1" onClick={() => updateStatus(selectedJob._id, 'approved')}>Approve Job</button>
                                    <button className="btn btn-danger flex-1" onClick={() => updateStatus(selectedJob._id, 'rejected')}>Reject Job</button>
                                </>
                            )}
                            <button className="btn btn-secondary w-full" style={{ width: selectedJob.status !== 'pending' ? '100%' : 'auto' }} onClick={() => setSelectedJob(null)}>Close</button>
                        </div>
                    </div>
                </div>
            )}
        </Layout>
    );
};

export default AdminJobs;
