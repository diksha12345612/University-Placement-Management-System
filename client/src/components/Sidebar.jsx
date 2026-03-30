import { Link, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { FiHome, FiUser, FiBriefcase, FiFileText, FiBook, FiUsers, FiCheckSquare, FiBarChart2, FiCalendar, FiBell, FiLogOut, FiCode, FiHelpCircle, FiEdit, FiClipboard, FiX, FiSettings } from 'react-icons/fi';

const Sidebar = ({ isOpen, onClose }) => {
    const { user, logout } = useAuth();
    const location = useLocation();

    const isActive = (path) => location.pathname === path ? 'sidebar-link active' : 'sidebar-link';

    // Auto-close sidebar on mobile when a link is clicked
    const handleLinkClick = () => {
        if (window.innerWidth <= 768) {
            onClose();
        }
    };

    const studentLinks = [
        { path: '/student/dashboard', icon: <FiHome />, label: 'Dashboard' },
        { path: '/student/profile', icon: <FiUser />, label: 'My Profile' },
        { path: '/student/jobs', icon: <FiBriefcase />, label: 'Job Listings' },
        { path: '/student/applications', icon: <FiFileText />, label: 'My Applications' },
        { path: '/student/preparation', icon: <FiBook />, label: 'Preparation' },
        { path: '/student/notifications', icon: <FiBell />, label: 'Notifications' },
    ];

    const recruiterLinks = [
        { path: '/recruiter/dashboard', icon: <FiHome />, label: 'Dashboard' },
        { path: '/recruiter/profile', icon: <FiUser />, label: 'Profile' },
        { path: '/recruiter/post-job', icon: <FiEdit />, label: 'Post Job' },
        { path: '/recruiter/my-jobs', icon: <FiBriefcase />, label: 'My Jobs' },
        { path: '/recruiter/notifications', icon: <FiBell />, label: 'Notifications' },
    ];

    const adminLinks = [
        { path: '/admin/dashboard', icon: <FiHome />, label: 'Dashboard' },
        { path: '/admin/students', icon: <FiUsers />, label: 'Students' },
        { path: '/admin/recruiters', icon: <FiBriefcase />, label: 'Recruiters' },
        { path: '/admin/jobs', icon: <FiCheckSquare />, label: 'Job Approvals' },
        { path: '/admin/drives', icon: <FiCalendar />, label: 'Placement Drives' },
        { path: '/admin/announcements', icon: <FiBell />, label: 'Announcements' },
        { path: '/admin/admins', icon: <FiUser />, label: 'Admin Management' },
        { path: '/admin/reports', icon: <FiBarChart2 />, label: 'Reports' },
        { path: '/admin/ats-settings', icon: <FiSettings />, label: 'Resume Scoring' },
        { path: '/admin/notifications', icon: <FiBell />, label: 'Notifications' },
    ];

    const links = user?.role === 'admin' ? adminLinks : user?.role === 'recruiter' ? recruiterLinks : studentLinks;

    return (
        <div className={`sidebar ${isOpen ? 'open' : ''}`}>
            <div className="sidebar-header">
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                    <div className="logo-container" style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                        <img src="/logo.png" alt="UniPlacements Logo" style={{ width: '48px', height: '48px', borderRadius: '10px', objectFit: 'cover' }} />
                        <h1 style={{ fontSize: '1.5rem', fontWeight: '800', margin: 0 }}>UniPlacements</h1>
                    </div>
                    {window.innerWidth <= 768 && (
                        <button onClick={onClose} style={{ background: 'none', border: 'none', fontSize: '1.5rem', cursor: 'pointer', color: 'var(--text-secondary)' }}>
                            <FiX />
                        </button>
                    )}
                </div>
                <p style={{ marginLeft: '3.75rem', fontSize: '0.75rem', opacity: 0.8 }}>{user?.role === 'admin' ? 'Placement Officer' : user?.role}</p>
            </div>
            <nav className="sidebar-nav">
                <div className="sidebar-section">
                    <div className="sidebar-section-title">Navigation</div>
                    {links.map((link) => (
                        <Link
                            key={link.path}
                            to={link.path}
                            className={isActive(link.path)}
                            onClick={handleLinkClick}
                        >
                            {link.icon}
                            <span>{link.label}</span>
                        </Link>
                    ))}
                </div>
                {user?.role === 'student' && (
                    <div className="sidebar-section">
                        <div className="sidebar-section-title">Prep Resources</div>
                        <Link to="/student/preparation/mock-test" className={isActive('/student/preparation/mock-test')} onClick={handleLinkClick}>
                            <FiCheckSquare /> <span>Mock Tests</span>
                        </Link>
                        <Link to="/student/preparation/tips" className={isActive('/student/preparation/tips')} onClick={handleLinkClick}>
                            <FiHelpCircle /> <span>Interview Prep</span>
                        </Link>
                    </div>
                )}
            </nav>
            <div className="sidebar-footer">
                <button className="logout-btn" onClick={logout}>
                    <FiLogOut /> <span>Log Out</span>
                </button>
            </div>
        </div>
    );
};

export default Sidebar;
