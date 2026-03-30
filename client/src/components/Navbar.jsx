import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { notificationAPI } from '../services/api';
import { FiBell } from 'react-icons/fi';

const Navbar = ({ title }) => {
    const { user } = useAuth();
    const navigate = useNavigate();
    const [notifications, setNotifications] = useState([]);
    const [unreadCount, setUnreadCount] = useState(0);
    const [showDropdown, setShowDropdown] = useState(false);
    const dropdownRef = useRef(null);

    useEffect(() => {
        fetchUnreadCount();
        const interval = setInterval(fetchUnreadCount, 30000);
        return () => clearInterval(interval);
    }, []);

    useEffect(() => {
        const handleClick = (e) => {
            if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
                setShowDropdown(false);
            }
        };
        document.addEventListener('mousedown', handleClick);
        return () => document.removeEventListener('mousedown', handleClick);
    }, []);

    const fetchUnreadCount = async () => {
        try {
            const res = await notificationAPI.getUnreadCount();
            setUnreadCount(res.data.count);
        } catch { }
    };

    const handleBellClick = async () => {
        setShowDropdown(!showDropdown);
        if (!showDropdown) {
            try {
                const res = await notificationAPI.getAll();
                setNotifications(res.data.slice(0, 10));
            } catch { }
        }
    };

    const markAsRead = async (id) => {
        try {
            await notificationAPI.markRead(id);
            setNotifications(notifications.map(n => n._id === id ? { ...n, isRead: true } : n));
            setUnreadCount(Math.max(0, unreadCount - 1));
        } catch { }
    };

    const resolveNotificationRoute = (notification) => {
        if (notification?.link) return notification.link;

        const text = `${notification?.title || ''} ${notification?.message || ''}`.toLowerCase();

        if (user?.role === 'student') {
            if (text.includes('job')) return '/student/jobs';
            if (text.includes('application')) return '/student/applications';
            if (text.includes('profile')) return '/student/profile';
            if (text.includes('interview') || text.includes('prep')) return '/student/preparation/tips';
            return '/student/notifications';
        }

        if (user?.role === 'recruiter') {
            if (text.includes('application') || text.includes('job')) return '/recruiter/my-jobs';
            if (text.includes('profile') || text.includes('approval')) return '/recruiter/profile';
            return '/recruiter/notifications';
        }

        if (user?.role === 'admin') {
            if (text.includes('job')) return '/admin/jobs';
            if (text.includes('report') || text.includes('shortlisted')) return '/admin/reports';
            if (text.includes('student')) return '/admin/students';
            if (text.includes('recruiter')) return '/admin/recruiters';
            if (text.includes('announcement')) return '/admin/announcements';
            return '/admin/notifications';
        }

        return '/';
    };

    const handleNotificationClick = async (notification) => {
        if (!notification.isRead) {
            await markAsRead(notification._id);
        }
        setShowDropdown(false);
        navigate(resolveNotificationRoute(notification));
    };

    const timeAgo = (date) => {
        const seconds = Math.floor((new Date() - new Date(date)) / 1000);
        if (seconds < 60) return 'just now';
        if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
        if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
        return `${Math.floor(seconds / 86400)}d ago`;
    };

    const handleProfileClick = () => {
        if (user?.role === 'student') navigate('/student/profile');
        else if (user?.role === 'recruiter') navigate('/recruiter/profile');
        else if (user?.role === 'admin') navigate('/admin/profile');
    };

    return (
        <div className="navbar">
            <h2>{title}</h2>
            <div className="navbar-actions">
                <div ref={dropdownRef} style={{ position: 'relative' }}>
                    <button className="notification-btn" onClick={handleBellClick}>
                        <FiBell />
                        {unreadCount > 0 && <span className="notification-badge">{unreadCount}</span>}
                    </button>
                    {showDropdown && (
                        <div className="notification-dropdown">
                            <div style={{ padding: '0.75rem 1rem', borderBottom: '1px solid var(--border)', fontWeight: 600, fontSize: '0.9rem' }}>
                                Notifications
                            </div>
                            {notifications.length === 0 ? (
                                <div style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-muted)' }}>No notifications</div>
                            ) : (
                                notifications.map((n) => (
                                    <div key={n._id} className={`notification-item ${!n.isRead ? 'unread' : ''}`} onClick={() => handleNotificationClick(n)}>
                                        <h4>{n.title}</h4>
                                        <p>{n.message}</p>
                                        <div className="time">{timeAgo(n.createdAt)}</div>
                                    </div>
                                ))
                            )}
                        </div>
                    )}
                </div>
                <div className="user-menu clickable-profile" onClick={handleProfileClick} title="View Profile">
                    <div className="user-avatar">{user?.name?.[0]?.toUpperCase()}</div>
                    <span className="user-name">{user?.name}</span>
                </div>
            </div>
        </div>
    );
};

export default Navbar;
