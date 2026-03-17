import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import Layout from '../../components/Layout';
import { adminAPI, applicationAPI, jobAPI } from '../../services/api';
import toast from 'react-hot-toast';

const RecruiterDetail = () => {
    const { id } = useParams();
    const navigate = useNavigate();
    const [recruiter, setRecruiter] = useState(null);
    const [jobs, setJobs] = useState([]);
    const [applications, setApplications] = useState([]);
    const [loading, setLoading] = useState(true);
    const [expandedJob, setExpandedJob] = useState(null);

    useEffect(() => {
        const fetchData = async () => {
            try {
                setLoading(true);
                // Fetch recruiter
                const recruitersRes = await adminAPI.getRecruiters();
                const foundRecruiter = recruitersRes.data.find(r => r._id === id);
                if (foundRecruiter) {
                    setRecruiter(foundRecruiter);
                } else {
                    toast.error('Recruiter not found');
                    navigate('/admin/recruiters');
                }

                // Fetch all applications
                const allApps = await applicationAPI.getAll();
                setApplications(allApps.data);
            } catch (err) {
                toast.error('Error loading recruiter details');
                console.error(err);
            } finally {
                setLoading(false);
            }
        };

        if (id) fetchData();
    }, [id, navigate]);

    // Filter jobs posted by this recruiter
    useEffect(() => {
        if (recruiter) {
            const fetchJobs = async () => {
                try {
                    // Fetch all jobs for admin
                    const jobsRes = await jobAPI.getAllForAdmin();
                    // Filter by recruiter's ID (postedBy is populated object, so use _id)
                    const recruiterJobs = jobsRes.data.filter(job => job.postedBy._id === recruiter._id);
                    setJobs(recruiterJobs);
                } catch (err) {
                    console.error(err);
                    toast.error('Error loading jobs');
                }
            };
            fetchJobs();
        }
    }, [recruiter]);

    const getJobStatusCounts = (jobId) => {
        const jobApps = applications.filter(app => app.job?._id === jobId);
        return {
            total: jobApps.length,
            applied: jobApps.filter(a => a.status === 'applied').length,
            shortlisted: jobApps.filter(a => a.status === 'shortlisted').length,
            interview: jobApps.filter(a => a.status === 'interview').length,
            selected: jobApps.filter(a => a.status === 'selected').length,
            rejected: jobApps.filter(a => a.status === 'rejected').length,
        };
    };

    const getJobApplications = (jobId) => {
        return applications.filter(app => app.job?._id === jobId).sort((a, b) => new Date(b.appliedAt) - new Date(a.appliedAt));
    };

    const getTotalSelectedStudents = () => {
        return applications.filter(app => app.job?.postedBy === recruiter?._id && app.status === 'selected');
    };

    const getStatusBadgeClass = (status) => {
        switch (status) {
            case 'selected': return 'badge-success';
            case 'rejected': return 'badge-danger';
            case 'shortlisted': return 'badge-info';
            case 'interview': return 'badge-warning';
            default: return 'badge-secondary';
        }
    };

    const getJobStatusBadgeClass = (status) => {
        switch (status) {
            case 'approved': return 'badge-success';
            case 'pending': return 'badge-warning';
            case 'rejected': return 'badge-danger';
            default: return 'badge-secondary';
        }
    };

    if (loading) return <Layout title="Recruiter Profile"><div className="loading"><div className="spinner"></div></div></Layout>;

    if (!recruiter) return <Layout title="Recruiter Profile"><div style={{ padding: '2rem', textAlign: 'center' }}>Recruiter not found</div></Layout>;

    const rp = recruiter.recruiterProfile || {};
    const jobCounts = {
        total: jobs.length,
        approved: jobs.filter(j => j.status === 'approved').length,
        pending: jobs.filter(j => j.status === 'pending').length,
        rejected: jobs.filter(j => j.status === 'rejected').length,
    };
    const selectedStudents = getTotalSelectedStudents();

    return (
        <Layout title="Recruiter Profile">
            <div className="fade-in" style={{ maxWidth: '1200px', margin: '0 auto' }}>
                {/* Header with back button */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '2rem' }}>
                    <button onClick={() => navigate('/admin/recruiters')} className="btn btn-secondary" style={{ padding: '0.5rem 1rem' }}>
                        ← Back to Recruiters
                    </button>
                </div>

                {/* Profile Section */}
                <div className="card" style={{ marginBottom: '2rem' }}>
                    <div style={{ display: 'flex', gap: '2rem', alignItems: 'flex-start', flexWrap: 'wrap' }}>
                        {/* Profile Photo */}
                        <div style={{ flex: '0 0 150px', textAlign: 'center' }}>
                            {rp.profileImage ? (
                                <img
                                    src={`data:${rp.profileImageContentType};base64,${rp.profileImage}`}
                                    alt={recruiter.name}
                                    style={{
                                        width: '150px',
                                        height: '150px',
                                        borderRadius: '16px',
                                        objectFit: 'cover',
                                        border: '3px solid var(--primary)',
                                        boxShadow: '0 4px 12px rgba(37, 99, 235, 0.2)'
                                    }}
                                />
                            ) : (
                                <div style={{
                                    width: '150px',
                                    height: '150px',
                                    borderRadius: '16px',
                                    backgroundColor: 'rgba(37, 99, 235, 0.1)',
                                    border: '2px dashed var(--primary)',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    color: 'var(--text-secondary)',
                                    fontSize: '0.9rem'
                                }}>
                                    No Photo
                                </div>
                            )}
                        </div>

                        {/* Basic Info */}
                        <div style={{ flex: 1, minWidth: '250px' }}>
                            <h2 style={{ margin: '0 0 0.5rem 0', color: 'var(--primary)' }}>{recruiter.name}</h2>
                            <p style={{ margin: '0.25rem 0', color: 'var(--text-secondary)', fontSize: '0.95rem' }}>
                                <strong>Email:</strong> {recruiter.email}
                            </p>
                            <p style={{ margin: '0.25rem 0', fontSize: '0.95rem' }}>
                                <strong>Company:</strong> {rp.company || 'N/A'}
                            </p>
                            <p style={{ margin: '0.25rem 0', fontSize: '0.95rem' }}>
                                <strong>Designation:</strong> {rp.designation || 'N/A'} | <strong>Industry:</strong> {rp.industry || 'N/A'}
                            </p>
                            <p style={{ margin: '0.25rem 0', fontSize: '0.95rem' }}>
                                <strong>Phone:</strong> {rp.phoneCountryCode || '+91'} {rp.phone || 'N/A'}
                            </p>
                            <div style={{ marginTop: '1rem', display: 'flex', gap: '1rem', flexWrap: 'wrap' }}>
                                <span className={`badge ${recruiter.isApprovedByAdmin ? 'badge-success' : 'badge-warning'}`}>
                                    {recruiter.isApprovedByAdmin ? '✓ APPROVED' : 'PENDING'}
                                </span>
                            </div>
                        </div>
                    </div>

                    {/* Detailed Company Info */}
                    <div style={{ marginTop: '2rem', paddingTop: '2rem', borderTop: '1px solid var(--border)' }}>
                        <h3 style={{ marginBottom: '1rem', color: 'var(--primary)' }}>Company Information</h3>
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: '1.5rem' }}>
                            <div>
                                <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', margin: '0 0 0.5rem 0' }}>Company Name</p>
                                <p style={{ margin: 0, fontWeight: 600 }}>{rp.company || 'N/A'}</p>
                            </div>
                            <div>
                                <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', margin: '0 0 0.5rem 0' }}>Website</p>
                                {rp.companyWebsite ? (
                                    <a href={rp.companyWebsite} target="_blank" rel="noreferrer" style={{ margin: 0, fontWeight: 600, color: 'var(--primary)' }}>
                                        Visit Website →
                                    </a>
                                ) : (
                                    <p style={{ margin: 0, fontWeight: 600 }}>N/A</p>
                                )}
                            </div>
                        </div>

                        {/* Company Description */}
                        <div style={{ marginTop: '1.5rem' }}>
                            <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', margin: '0 0 0.5rem 0' }}>Company Description</p>
                            <p style={{ margin: 0, lineHeight: 1.6 }}>{rp.companyDescription || 'N/A'}</p>
                        </div>
                    </div>
                </div>

                {/* Job Statistics */}
                <div className="card" style={{ marginBottom: '2rem' }}>
                    <h3 style={{ marginBottom: '1.5rem', color: 'var(--primary)' }}>Job Posting Summary</h3>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: '1rem', marginBottom: '1.5rem' }}>
                        <div style={{ background: 'rgba(59, 130, 246, 0.1)', padding: '1rem', borderRadius: '8px', border: '1px solid rgba(59, 130, 246, 0.2)' }}>
                            <p style={{ margin: 0, fontSize: '0.85rem', color: 'var(--text-secondary)' }}>Total Jobs Posted</p>
                            <p style={{ margin: '0.5rem 0 0 0', fontSize: '1.8rem', fontWeight: 700, color: '#3b82f6' }}>{jobCounts.total}</p>
                        </div>
                        <div style={{ background: 'rgba(16, 185, 129, 0.1)', padding: '1rem', borderRadius: '8px', border: '1px solid rgba(16, 185, 129, 0.2)' }}>
                            <p style={{ margin: 0, fontSize: '0.85rem', color: 'var(--text-secondary)' }}>Approved</p>
                            <p style={{ margin: '0.5rem 0 0 0', fontSize: '1.8rem', fontWeight: 700, color: '#10b981' }}>{jobCounts.approved}</p>
                        </div>
                        <div style={{ background: 'rgba(245, 158, 11, 0.1)', padding: '1rem', borderRadius: '8px', border: '1px solid rgba(245, 158, 11, 0.2)' }}>
                            <p style={{ margin: 0, fontSize: '0.85rem', color: 'var(--text-secondary)' }}>Pending</p>
                            <p style={{ margin: '0.5rem 0 0 0', fontSize: '1.8rem', fontWeight: 700, color: '#f59e0b' }}>{jobCounts.pending}</p>
                        </div>
                        <div style={{ background: 'rgba(239, 68, 68, 0.1)', padding: '1rem', borderRadius: '8px', border: '1px solid rgba(239, 68, 68, 0.2)' }}>
                            <p style={{ margin: 0, fontSize: '0.85rem', color: 'var(--text-secondary)' }}>Rejected</p>
                            <p style={{ margin: '0.5rem 0 0 0', fontSize: '1.8rem', fontWeight: 700, color: '#ef4444' }}>{jobCounts.rejected}</p>
                        </div>
                    </div>

                    {/* Selected Students Summary */}
                    <div style={{ background: 'rgba(16, 185, 129, 0.08)', padding: '1.5rem', borderRadius: '8px', border: '1px solid rgba(16, 185, 129, 0.2)' }}>
                        <h4 style={{ margin: '0 0 1rem 0', color: '#10b981' }}>✓ Total Students Selected: {selectedStudents.length}</h4>
                        {selectedStudents.length > 0 ? (
                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '0.75rem' }}>
                                {selectedStudents.map((app, i) => (
                                    <div key={i} style={{ background: 'rgba(16, 185, 129, 0.1)', padding: '0.75rem', borderRadius: '6px', fontSize: '0.9rem' }}>
                                        <p style={{ margin: 0, fontWeight: 600 }}>{app.student?.name || 'Unknown'}</p>
                                        <p style={{ margin: '0.25rem 0 0 0', fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                                            {app.job?.title || 'Job Removed'}
                                        </p>
                                    </div>
                                ))}
                            </div>
                        ) : (
                            <p style={{ margin: 0, color: 'var(--text-secondary)', fontSize: '0.9rem' }}>No students selected yet</p>
                        )}
                    </div>
                </div>

                {/* Jobs List */}
                <div className="card">
                    <h3 style={{ marginBottom: '1.5rem', color: 'var(--primary)' }}>All Job Postings ({jobCounts.total})</h3>
                    {jobCounts.total === 0 ? (
                        <p style={{ textAlign: 'center', color: 'var(--text-secondary)', padding: '2rem' }}>
                            No job postings yet.
                        </p>
                    ) : (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
                            {jobs.map((job) => {
                                const stats = getJobStatusCounts(job._id);
                                const jobApps = getJobApplications(job._id);
                                const isExpanded = expandedJob === job._id;

                                return (
                                    <div key={job._id} style={{
                                        border: '1px solid var(--border)',
                                        borderRadius: '8px',
                                        padding: '1rem',
                                        background: 'rgba(37, 99, 235, 0.02)'
                                    }}>
                                        {/* Job Header */}
                                        <div style={{
                                            display: 'flex',
                                            justifyContent: 'space-between',
                                            alignItems: 'flex-start',
                                            cursor: 'pointer',
                                            gap: '1rem'
                                        }} onClick={() => setExpandedJob(isExpanded ? null : job._id)}>
                                            <div style={{ flex: 1 }}>
                                                <h4 style={{ margin: '0 0 0.5rem 0', color: 'var(--primary)' }}>{job.title}</h4>
                                                <p style={{ margin: '0.25rem 0', fontSize: '0.9rem', color: 'var(--text-secondary)' }}>
                                                    <strong>Location:</strong> {job.location}
                                                </p>
                                                <p style={{ margin: '0.25rem 0', fontSize: '0.9rem', color: 'var(--text-secondary)' }}>
                                                    <strong>Type:</strong> {job.type} | <strong>Openings:</strong> {job.openings}
                                                </p>
                                            </div>
                                            <span className={`badge ${getJobStatusBadgeClass(job.status)}`}>
                                                {job.status ? job.status.charAt(0).toUpperCase() + job.status.slice(1) : 'Pending'}
                                            </span>
                                        </div>

                                        {/* Job Stats */}
                                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(100px, 1fr))', gap: '0.75rem', marginTop: '1rem' }}>
                                            <div style={{ background: 'rgba(59, 130, 246, 0.1)', padding: '0.75rem', borderRadius: '6px', textAlign: 'center', fontSize: '0.85rem' }}>
                                                <p style={{ margin: 0, fontWeight: 600, color: '#3b82f6' }}>{stats.total}</p>
                                                <p style={{ margin: 0, fontSize: '0.75rem', color: 'var(--text-secondary)' }}>Applications</p>
                                            </div>
                                            <div style={{ background: 'rgba(16, 185, 129, 0.1)', padding: '0.75rem', borderRadius: '6px', textAlign: 'center', fontSize: '0.85rem' }}>
                                                <p style={{ margin: 0, fontWeight: 600, color: '#10b981' }}>{stats.selected}</p>
                                                <p style={{ margin: 0, fontSize: '0.75rem', color: 'var(--text-secondary)' }}>Selected</p>
                                            </div>
                                            <div style={{ background: 'rgba(59, 130, 246, 0.1)', padding: '0.75rem', borderRadius: '6px', textAlign: 'center', fontSize: '0.85rem' }}>
                                                <p style={{ margin: 0, fontWeight: 600, color: '#3b82f6' }}>{stats.shortlisted}</p>
                                                <p style={{ margin: 0, fontSize: '0.75rem', color: 'var(--text-secondary)' }}>Shortlisted</p>
                                            </div>
                                            <div style={{ background: 'rgba(245, 158, 11, 0.1)', padding: '0.75rem', borderRadius: '6px', textAlign: 'center', fontSize: '0.85rem' }}>
                                                <p style={{ margin: 0, fontWeight: 600, color: '#f59e0b' }}>{stats.interview}</p>
                                                <p style={{ margin: 0, fontSize: '0.75rem', color: 'var(--text-secondary)' }}>Interview</p>
                                            </div>
                                            <div style={{ background: 'rgba(239, 68, 68, 0.1)', padding: '0.75rem', borderRadius: '6px', textAlign: 'center', fontSize: '0.85rem' }}>
                                                <p style={{ margin: 0, fontWeight: 600, color: '#ef4444' }}>{stats.rejected}</p>
                                                <p style={{ margin: 0, fontSize: '0.75rem', color: 'var(--text-secondary)' }}>Rejected</p>
                                            </div>
                                        </div>

                                        {/* Collapsible Applicants Section */}
                                        {isExpanded && (
                                            <div style={{ marginTop: '1.5rem', paddingTop: '1.5rem', borderTop: '1px solid var(--border)' }}>
                                                <h5 style={{ margin: '0 0 1rem 0', color: 'var(--text-secondary)' }}>Applicants ({jobApps.length})</h5>
                                                {jobApps.length === 0 ? (
                                                    <p style={{ textAlign: 'center', color: 'var(--text-secondary)', padding: '1rem' }}>No applications yet</p>
                                                ) : (
                                                    <div style={{ overflowX: 'auto' }}>
                                                        <table className="responsive-table" style={{ width: '100%', borderCollapse: 'collapse' }}>
                                                            <thead>
                                                                <tr>
                                                                    <th>Student Name</th>
                                                                    <th className="hidden-mobile">Department</th>
                                                                    <th className="hidden-mobile">CGPA</th>
                                                                    <th>Applied Date</th>
                                                                    <th>Status</th>
                                                                </tr>
                                                            </thead>
                                                            <tbody>
                                                                {jobApps.map((app) => (
                                                                    <tr key={app._id}>
                                                                        <td data-label="Student" style={{ fontWeight: 600 }}>
                                                                            {app.student?.name || 'Unknown'}
                                                                        </td>
                                                                        <td data-label="Department" className="hidden-mobile">
                                                                            {app.student?.studentProfile?.department || 'N/A'}
                                                                        </td>
                                                                        <td data-label="CGPA" className="hidden-mobile">
                                                                            {app.student?.studentProfile?.cgpa || 'N/A'}
                                                                        </td>
                                                                        <td data-label="Applied Date">
                                                                            {new Date(app.appliedAt).toLocaleDateString('en-IN', { dateStyle: 'short' })}
                                                                        </td>
                                                                        <td data-label="Status">
                                                                            <span className={`badge ${getStatusBadgeClass(app.status)}`}>
                                                                                {app.status ? app.status.charAt(0).toUpperCase() + app.status.slice(1) : 'Applied'}
                                                                            </span>
                                                                        </td>
                                                                    </tr>
                                                                ))}
                                                            </tbody>
                                                        </table>
                                                    </div>
                                                )}
                                            </div>
                                        )}
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </div>
            </div>
        </Layout>
    );
};

export default RecruiterDetail;
