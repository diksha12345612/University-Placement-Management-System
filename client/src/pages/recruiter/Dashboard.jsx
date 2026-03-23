import { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import Layout from '../../components/Layout';
import { useAuth } from '../../context/AuthContext';
import { jobAPI, applicationAPI } from '../../services/api';
import { FiBriefcase, FiUsers, FiCheckCircle, FiExternalLink } from 'react-icons/fi';
import { Link } from 'react-router-dom';
import { getProfileCompletion } from '../../services/profileCompletion';
import toast from 'react-hot-toast';

const RecruiterDashboard = () => {
    const { user } = useAuth();
    const [stats, setStats] = useState({ totalJobs: 0, totalApplicants: 0, approved: 0 });
    const [showProfilePopup, setShowProfilePopup] = useState(true);
    const [showApplicantsModal, setShowApplicantsModal] = useState(false);
    const [applicants, setApplicants] = useState([]);
    const [loadingApplicants, setLoadingApplicants] = useState(false);
    const profileCompletion = getProfileCompletion(user);

    useEffect(() => {
        fetchDashboardStats();
    }, []);

    const fetchDashboardStats = async () => {
        try {
            const res = await jobAPI.getMyJobs();
            const jobs = res.data;
            
            // Calculate total applicants across all jobs
            let totalApplicants = 0;
            for (const job of jobs) {
                const appRes = await applicationAPI.getJobApplicants(job._id);
                totalApplicants += appRes.data.length;
            }

            setStats({
                totalJobs: jobs.length,
                approved: jobs.filter(j => j.status === 'approved').length,
                totalApplicants
            });
        } catch (error) {
            console.error('Error fetching dashboard stats:', error);
            toast.error('Error loading dashboard stats');
        }
    };

    const handleApplicantsClick = async () => {
        setShowApplicantsModal(true);
        setLoadingApplicants(true);
        try {
            const jobsRes = await jobAPI.getMyJobs();
            const jobs = jobsRes.data;
            
            // Fetch applicants for all jobs
            let allApplicants = [];
            for (const job of jobs) {
                const appRes = await applicationAPI.getJobApplicants(job._id);
                const applicantsWithJobInfo = appRes.data.map(app => ({
                    ...app,
                    jobTitle: job.title,
                    jobId: job._id
                }));
                allApplicants = [...allApplicants, ...applicantsWithJobInfo];
            }
            
            setApplicants(allApplicants);
        } catch (error) {
            console.error('Error fetching applicants:', error);
            toast.error('Error loading applicants');
        } finally {
            setLoadingApplicants(false);
        }
    };

    return (
        <>
        <Layout title="Recruiter Dashboard">
            <div className="fade-in">
                <header style={{ marginBottom: '2rem' }}>
                    <h1 style={{ fontSize: '1.5rem', fontWeight: 700, marginBottom: '0.25rem' }}>Welcome back, {user?.name} 👋</h1>
                    <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>{user?.recruiterProfile?.company || 'Company profile pending'}</p>
                </header>

                {!profileCompletion.isComplete && showProfilePopup && (
                    <div className="card" style={{ marginBottom: '1.5rem', borderLeft: '4px solid var(--warning)', background: 'linear-gradient(90deg, rgba(245,158,11,0.08), transparent 55%)' }}>
                        <h3 style={{ marginBottom: '0.4rem', fontSize: '1rem' }}>Complete Your Profile</h3>
                        <p style={{ marginBottom: '0.8rem', color: 'var(--text-muted)', fontSize: '0.9rem' }}>
                            Your profile is {profileCompletion.percentage}% complete. Complete it to fully enable recruiter workflow.
                        </p>
                        <div style={{ height: '8px', background: 'var(--bg-dark)', borderRadius: '99px', overflow: 'hidden', marginBottom: '0.9rem' }}>
                            <div style={{ height: '100%', width: `${profileCompletion.percentage}%`, background: 'var(--warning)' }} />
                        </div>
                        <p style={{ margin: 0, fontSize: '0.82rem', color: 'var(--text-muted)' }}>
                            Missing: {profileCompletion.missingFields.join(', ')}
                        </p>
                        <div className="flex gap-1 mt-1.5">
                            <Link to="/recruiter/profile" className="btn btn-primary btn-sm">Complete Profile</Link>
                            <button className="btn btn-secondary btn-sm" onClick={() => setShowProfilePopup(false)}>Remind Me Later</button>
                        </div>
                    </div>
                )}

                <div className="stats-grid">
                    <Link 
                        to="/recruiter/my-jobs"
                        className="stat-card" 
                        style={{ 
                            cursor: 'pointer', 
                            transition: 'all 0.2s',
                            textDecoration: 'none',
                            color: 'inherit'
                        }}
                        onMouseEnter={(e) => e.currentTarget.style.transform = 'translateY(-2px)'}
                        onMouseLeave={(e) => e.currentTarget.style.transform = 'translateY(0)'}
                    >
                        <div className="stat-icon blue"><FiBriefcase /></div>
                        <div className="stat-info"><h3>{stats.totalJobs}</h3><p>Jobs Posted</p></div>
                    </Link>
                    <div 
                        className="stat-card"
                        onClick={() => {
                            // Navigate to my jobs filtered by approved status
                            window.location.href = '/recruiter/my-jobs?filter=approved';
                        }}
                        style={{ 
                            cursor: 'pointer', 
                            transition: 'all 0.2s'
                        }}
                        onMouseEnter={(e) => e.currentTarget.style.transform = 'translateY(-2px)'}
                        onMouseLeave={(e) => e.currentTarget.style.transform = 'translateY(0)'}
                    >
                        <div className="stat-icon green"><FiCheckCircle /></div>
                        <div className="stat-info"><h3>{stats.approved}</h3><p>Approved</p></div>
                    </div>
                    <div 
                        className="stat-card" 
                        onClick={handleApplicantsClick}
                        style={{ cursor: 'pointer', transition: 'all 0.2s' }}
                        onMouseEnter={(e) => e.currentTarget.style.transform = 'translateY(-2px)'}
                        onMouseLeave={(e) => e.currentTarget.style.transform = 'translateY(0)'}
                    >
                        <div className="stat-icon orange"><FiUsers /></div>
                        <div className="stat-info"><h3>{stats.totalApplicants}</h3><p>Applicants</p></div>
                    </div>
                </div>

                <div className="flex flex-col-mobile gap-3 mt-3">
                    <Link to="/recruiter/post-job" className="btn btn-primary w-full-mobile flex justify-center">+ Post New Job</Link>
                    <Link to="/recruiter/my-jobs" className="btn btn-secondary w-full-mobile flex justify-center">View My Jobs</Link>
                </div>
            </div>
        </Layout>

        {/* Applicants Modal - Rendered at document root using Portal */}
        {showApplicantsModal && createPortal(
                    <div style={{
                        position: 'fixed',
                        inset: 0,
                        backgroundColor: 'rgba(0, 0, 0, 0.6)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        zIndex: 2000,
                        padding: '1rem'
                    }}
                    onClick={(e) => {
                        // Close modal when clicking outside the card
                        if (e.target === e.currentTarget) {
                            setShowApplicantsModal(false);
                        }
                    }}>
                        <div className="card" style={{ 
                            width: '100%', 
                            maxWidth: '1000px', 
                            maxHeight: '85vh', 
                            overflow: 'auto',
                            position: 'relative',
                            overflowY: 'auto'
                        }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
                                <h2 style={{ margin: 0 }}>All Applicants ({applicants.length})</h2>
                                <button
                                    onClick={() => setShowApplicantsModal(false)}
                                    style={{
                                        background: 'none',
                                        border: 'none',
                                        fontSize: '1.5rem',
                                        cursor: 'pointer',
                                        color: 'var(--text-muted)',
                                        padding: '0.5rem',
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                        borderRadius: '8px',
                                        transition: 'all 0.2s',
                                        minWidth: '36px'
                                    }}
                                    onMouseEnter={(e) => e.currentTarget.style.background = 'var(--bg-dark)'}
                                    onMouseLeave={(e) => e.currentTarget.style.background = 'none'}
                                >
                                    ✕
                                </button>
                            </div>

                            {loadingApplicants ? (
                                <div style={{ textAlign: 'center', padding: '2rem' }}>
                                    <div className="spinner"></div>
                                    <p style={{ marginTop: '1rem', color: 'var(--text-muted)' }}>Loading applicants...</p>
                                </div>
                            ) : applicants.length === 0 ? (
                                <div style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-muted)' }}>
                                    <p>No applicants yet. Keep posting jobs to attract talent!</p>
                                </div>
                            ) : (
                                <div style={{ overflowX: 'auto' }}>
                                    <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                                        <thead>
                                            <tr style={{ borderBottom: '2px solid var(--border)' }}>
                                                <th style={{ padding: '1rem', textAlign: 'left', fontWeight: '600' }}>Student Name</th>
                                                <th style={{ padding: '1rem', textAlign: 'left', fontWeight: '600' }}>Email</th>
                                                <th style={{ padding: '1rem', textAlign: 'left', fontWeight: '600' }}>Applied For</th>
                                                <th style={{ padding: '1rem', textAlign: 'left', fontWeight: '600' }}>Status</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {applicants.map((app) => (
                                                <tr key={app._id} style={{ borderBottom: '1px solid var(--border)' }}>
                                                    <td style={{ padding: '1rem' }}>
                                                        <strong>{app.student?.name || 'N/A'}</strong>
                                                    </td>
                                                    <td style={{ padding: '1rem' }}>
                                                        {app.student?.email || 'N/A'}
                                                    </td>
                                                    <td style={{ padding: '1rem' }}>
                                                        <span style={{ 
                                                            background: 'rgba(37, 99, 235, 0.1)', 
                                                            color: 'var(--primary)',
                                                            padding: '0.25rem 0.75rem',
                                                            borderRadius: '20px',
                                                            fontSize: '0.85rem'
                                                        }}>
                                                            {app.jobTitle}
                                                        </span>
                                                    </td>
                                                    <td style={{ padding: '1rem' }}>
                                                        <span style={{
                                                            padding: '0.25rem 0.75rem',
                                                            borderRadius: '20px',
                                                            fontSize: '0.85rem',
                                                            background: app.status === 'applied' ? 'rgba(59, 130, 246, 0.1)' :
                                                                       app.status === 'shortlisted' ? 'rgba(34, 197, 94, 0.1)' :
                                                                       app.status === 'rejected' ? 'rgba(239, 68, 68, 0.1)' : 'rgba(107, 114, 128, 0.1)',
                                                            color: app.status === 'applied' ? 'var(--primary)' :
                                                                   app.status === 'shortlisted' ? 'var(--success)' :
                                                                   app.status === 'rejected' ? 'var(--danger)' : 'var(--text-secondary)'
                                                        }}>
                                                            {app.status?.charAt(0).toUpperCase() + app.status?.slice(1)}
                                                        </span>
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            )}
                        </div>
                    </div>
                , document.body
            )}
        </>
    );
};

export default RecruiterDashboard;
