import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import Layout from '../../components/Layout';
import { adminAPI, notificationAPI } from '../../services/api';
import { FiUsers, FiBriefcase, FiCheckCircle, FiFileText, FiClock, FiBell } from 'react-icons/fi';

const AdminDashboard = () => {
    const navigate = useNavigate();
    const [data, setData] = useState(null);
    const [loading, setLoading] = useState(true);
    const [notificationCount, setNotificationCount] = useState(0);

    useEffect(() => {
        const fetchData = async () => {
            try {
                setLoading(true);
                const [dashRes, notifRes] = await Promise.all([
                    adminAPI.getDashboard(),
                    notificationAPI.getUnreadCount()
                ]);
                setData(dashRes.data);
                setNotificationCount(notifRes.data.count);
            } catch (error) {
                console.error(error);
                adminAPI.getDashboard().then(res => setData(res.data)).catch(() => { });
            } finally {
                setLoading(false);
            }
        };
        fetchData();
    }, []);

    if (loading) return <Layout title="Admin Dashboard"><div className="loading"><div className="spinner"></div></div></Layout>;

    return (
        <Layout title="Admin Dashboard">
            <div className="fade-in">
                <h1 style={{ fontSize: '1.5rem', fontWeight: 700, marginBottom: '2rem' }}>Placement Overview 📊</h1>
                <div className="stats-grid">
                    <div className="stat-card clickable" onClick={() => navigate('/admin/students')}>
                        <div className="stat-icon blue"><FiUsers /></div>
                        <div className="stat-info"><h3>{data?.totalStudents || 0}</h3><p>Total Students</p></div>
                    </div>
                    <div className="stat-card clickable" onClick={() => navigate('/admin/reports')}>
                        <div className="stat-icon green"><FiCheckCircle /></div>
                        <div className="stat-info"><h3>{data?.placedStudents || 0}</h3><p>Placed Students</p></div>
                    </div>
                    <div className="stat-card clickable" onClick={() => navigate('/admin/jobs')}>
                        <div className="stat-icon cyan"><FiBriefcase /></div>
                        <div className="stat-info"><h3>{data?.totalJobs || 0}</h3><p>Active Jobs</p></div>
                    </div>
                    <div className="stat-card clickable" onClick={() => navigate('/admin/jobs')}>
                        <div className="stat-icon orange"><FiClock /></div>
                        <div className="stat-info"><h3>{data?.pendingJobs || 0}</h3><p>Job Approvals</p></div>
                    </div>
                    <div className="stat-card clickable" onClick={() => navigate('/admin/recruiters')}>
                        <div className="stat-icon purple" style={{ color: '#a855f7', backgroundColor: '#faf5ff' }}>
                            <FiUsers />
                        </div>
                        <div className="stat-info"><h3>{data?.pendingRecruiters || 0}</h3><p>Recruiter Approvals</p></div>
                    </div>
                    <div className="stat-card clickable" onClick={() => navigate('/admin/reports')}>
                        <div className="stat-icon red"><FiFileText /></div>
                        <div className="stat-info"><h3>{data?.totalApplications || 0}</h3><p>Total Applications</p></div>
                    </div>
                    <div className="stat-card clickable" onClick={() => navigate('/admin/notifications')}>
                        <div className="stat-icon purple" style={{ color: '#f59e0b', backgroundColor: '#fffbeb' }}>
                            <FiBell />
                        </div>
                        <div className="stat-info"><h3>{notificationCount}</h3><p>Notifications</p></div>
                    </div>
                </div>

                <div className="card">
                    <h3 className="card-title" style={{ marginBottom: '1rem' }}>Recent Applications</h3>
                    {data?.recentApplications?.length > 0 ? (
                        <div className="table-container">
                            <table className="responsive-table">
                                <thead><tr><th>Student</th><th>Job</th><th>Company</th></tr></thead>
                                <tbody>
                                    {data.recentApplications.map((app) => (
                                        <tr key={app._id}>
                                            <td data-label="Student">{app.student?.name || 'N/A'}</td>
                                            <td data-label="Job">{app.job?.title || 'N/A'}</td>
                                            <td data-label="Company">{app.job?.company || 'N/A'}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    ) : <p style={{ color: 'var(--text-muted)' }}>No recent applications</p>}
                </div>
            </div>
        </Layout>
    );
};

export default AdminDashboard;
