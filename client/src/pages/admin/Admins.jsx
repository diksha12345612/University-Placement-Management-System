import { useState, useEffect } from 'react';
import Layout from '../../components/Layout';
import AdminSectionOTPModal from '../../components/AdminSectionOTPModal';
import { adminAPI, studentAPI, recruiterAPI } from '../../services/api';
import toast from 'react-hot-toast';

const AdminManagement = () => {
    const [admins, setAdmins] = useState([]);
    const [loading, setLoading] = useState(true);
    const [showAddModal, setShowAddModal] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');
    const [searchResults, setSearchResults] = useState([]);
    const [searching, setSearching] = useState(false);
    const [selectedUser, setSelectedUser] = useState(null);
    const [promoting, setProfessional] = useState(false);
    
    // OTP State
    const [otpModalOpen, setOtpModalOpen] = useState(false);
    const [hasAccess, setHasAccess] = useState(false);
    const [accessExpiresAt, setAccessExpiresAt] = useState(null);
    const [checkingAccess, setCheckingAccess] = useState(true);

    useEffect(() => {
        checkAdminSectionAccess();
    }, []);

    const checkAdminSectionAccess = async () => {
        try {
            setCheckingAccess(true);
            const res = await adminAPI.checkAdminSectionAccess();
            if (res.data.hasAccess) {
                setHasAccess(true);
                if (res.data.accessExpiresAt) {
                    setAccessExpiresAt(new Date(res.data.accessExpiresAt));
                }
                fetchAdmins();
            } else {
                setHasAccess(false);
                setOtpModalOpen(true);
            }
        } catch (error) {
            // If no access, show OTP modal
            if (error.response?.status === 403) {
                setHasAccess(false);
                setOtpModalOpen(true);
            } else {
                console.error('Error checking access:', error);
                toast.error('Error verifying access');
            }
        } finally {
            setCheckingAccess(false);
            setLoading(false);
        }
    };

    const fetchAdmins = async () => {
        try {
            setLoading(true);
            const res = await adminAPI.getAdmins();
            setAdmins(res.data);
        } catch (error) {
            // If 403, OTP session expired
            if (error.response?.status === 403) {
                toast.error('Your verification session has expired. Please verify again.');
                setHasAccess(false);
                setOtpModalOpen(true);
            } else {
                toast.error('Error loading admins');
            }
            console.error(error);
        } finally {
            setLoading(false);
        }
    };

    const handleSearch = async (query) => {
        setSearchQuery(query);
        
        if (query.trim().length < 2) {
            setSearchResults([]);
            return;
        }

        try {
            setSearching(true);
            // Search in both students and recruiters
            const [studentsRes, recruitersRes] = await Promise.all([
                studentAPI.getAll(),
                recruiterAPI.getAll()
            ]);

            const allUsers = [
                ...studentsRes.data.map(s => ({ ...s, userType: 'student' })),
                ...recruitersRes.data.map(r => ({ ...r, userType: 'recruiter' }))
            ];

            // Filter out admins from search results
            const results = allUsers.filter(user => 
                user.role !== 'admin' && (
                    user.name.toLowerCase().includes(query.toLowerCase()) ||
                    user.email.toLowerCase().includes(query.toLowerCase())
                )
            );

            setSearchResults(results.slice(0, 10)); // Limit to 10 results
        } catch (error) {
            console.error('Error searching users:', error);
        } finally {
            setSearching(false);
        }
    };

    const handlePromoteAdmin = async () => {
        if (!selectedUser) {
            toast.error('Please select a user');
            return;
        }

        try {
            setProfessional(true);
            await adminAPI.promoteToAdmin(selectedUser._id);
            toast.success(`${selectedUser.name} has been promoted to admin`);
            
            // Refresh admins list
            await fetchAdmins();
            
            // Reset modal
            setSelectedUser(null);
            setSearchQuery('');
            setSearchResults([]);
            setShowAddModal(false);
        } catch (error) {
            if (error.response?.status === 403) {
                toast.error('Your verification session has expired. Please verify again.');
                setHasAccess(false);
                setOtpModalOpen(true);
            } else {
                toast.error('Error promoting user to admin');
            }
            console.error(error);
        } finally {
            setProfessional(false);
        }
    };

    const handleRemoveAdmin = async (adminId, adminName) => {
        if (!window.confirm(`Are you sure you want to remove admin privileges from ${adminName}?`)) {
            return;
        }

        try {
            await adminAPI.removeAdmin(adminId);
            toast.success(`Admin privileges revoked for ${adminName}`);
            await fetchAdmins();
        } catch (error) {
            if (error.response?.status === 403) {
                toast.error('Your verification session has expired. Please verify again.');
                setHasAccess(false);
                setOtpModalOpen(true);
            } else {
                toast.error('Error removing admin privileges');
            }
            console.error(error);
        }
    };

    const handleOTPVerified = async () => {
        setOtpModalOpen(false);
        setHasAccess(true);
        toast.success('Verified! You can now access admin management.');
        await checkAdminSectionAccess();
    };

    if (checkingAccess) {
        return (
            <Layout title="Admin Management">
                <div className="loading"><div className="spinner"></div></div>
            </Layout>
        );
    }

    if (!hasAccess) {
        return (
            <Layout title="Admin Management">
                <AdminSectionOTPModal isOpen={otpModalOpen} onVerified={handleOTPVerified} />
                <div style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-muted)' }}>
                    <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>🔐</div>
                    <h2>Access Restricted</h2>
                    <p>You need to verify your identity to access the admin management section.</p>
                </div>
            </Layout>
        );
    }

    if (loading) return <Layout title="Admin Management"><div className="loading"><div className="spinner"></div></div></Layout>;

    return (
        <Layout title="Admin Management">
            <AdminSectionOTPModal isOpen={otpModalOpen} onVerified={handleOTPVerified} />
            <div className="fade-in" style={{ maxWidth: '1000px', margin: '0 auto' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem', gap: '1rem', flexWrap: 'wrap' }}>
                    <div>
                        <h2 style={{ margin: '0 0 0.25rem 0' }}>Admin Management</h2>
                        <p style={{ color: 'var(--text-muted)', margin: 0, fontSize: '0.95rem' }}>Manage administrators who have full access to the portal</p>
                        {accessExpiresAt && (
                            <p style={{ color: 'var(--warning)', margin: '0.5rem 0 0 0', fontSize: '0.85rem' }}>
                                ⏱️ Access expires at {accessExpiresAt.toLocaleTimeString()}
                            </p>
                        )}
                    </div>
                    <button onClick={() => setShowAddModal(true)} className="btn btn-primary" style={{ padding: '0.5rem 1.25rem' }}>
                        + Add Admin
                    </button>
                </div>

                {/* Admins List */}
                <div className="card" style={{ marginBottom: '1rem' }}>
                    <h3 style={{ marginBottom: '1.5rem' }}>Current Admins ({admins.length})</h3>
                    
                    {admins.length === 0 ? (
                        <div style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-muted)' }}>
                            <p>No admins found</p>
                        </div>
                    ) : (
                        <div style={{ overflowX: 'auto' }}>
                            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                                <thead>
                                    <tr style={{ borderBottom: '2px solid var(--border)' }}>
                                        <th style={{ padding: '1rem', textAlign: 'left' }}>Name</th>
                                        <th style={{ padding: '1rem', textAlign: 'left' }}>Email</th>
                                        <th style={{ padding: '1rem', textAlign: 'left' }}>Added</th>
                                        <th style={{ padding: '1rem', textAlign: 'center' }}>Actions</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {admins.map((admin) => (
                                        <tr key={admin._id} style={{ borderBottom: '1px solid var(--border)' }}>
                                            <td style={{ padding: '1rem' }}><strong>{admin.name}</strong></td>
                                            <td style={{ padding: '1rem' }}>{admin.email}</td>
                                            <td style={{ padding: '1rem', fontSize: '0.9rem', color: 'var(--text-muted)' }}>
                                                {new Date(admin.createdAt).toLocaleDateString()}
                                            </td>
                                            <td style={{ padding: '1rem', textAlign: 'center' }}>
                                                {admins.length > 1 && (
                                                    <button
                                                        onClick={() => handleRemoveAdmin(admin._id, admin.name)}
                                                        className="btn btn-danger btn-sm"
                                                        style={{ padding: '0.25rem 0.75rem', fontSize: '0.85rem' }}
                                                    >
                                                        Remove
                                                    </button>
                                                )}
                                                {admins.length === 1 && (
                                                    <span style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>Cannot remove last admin</span>
                                                )}
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}
                </div>

                {/* Add Admin Modal */}
                {showAddModal && (
                    <div style={{
                        position: 'fixed',
                        top: 0,
                        left: 0,
                        right: 0,
                        bottom: 0,
                        backgroundColor: 'rgba(0, 0, 0, 0.5)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        zIndex: 1000
                    }}>
                        <div className="card" style={{ width: '90%', maxWidth: '500px' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
                                <h3 style={{ margin: 0 }}>Add New Admin</h3>
                                <button
                                    onClick={() => {
                                        setShowAddModal(false);
                                        setSearchQuery('');
                                        setSearchResults([]);
                                        setSelectedUser(null);
                                    }}
                                    style={{ fontSize: '1.5rem', background: 'none', border: 'none', cursor: 'pointer' }}
                                >
                                    ✕
                                </button>
                            </div>

                            <div style={{ marginBottom: '1.5rem' }}>
                                <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 'bold' }}>Search User</label>
                                <input
                                    type="text"
                                    value={searchQuery}
                                    onChange={(e) => handleSearch(e.target.value)}
                                    placeholder="Search by name or email..."
                                    style={{
                                        width: '100%',
                                        padding: '0.75rem',
                                        borderRadius: '8px',
                                        border: '1px solid var(--border-color)',
                                        fontSize: '1rem',
                                        boxSizing: 'border-box'
                                    }}
                                />
                            </div>

                            {searching && <p style={{ textAlign: 'center', color: 'var(--text-muted)' }}>Searching...</p>}

                            {searchResults.length > 0 && (
                                <div style={{ marginBottom: '1.5rem', maxHeight: '300px', overflowY: 'auto' }}>
                                    <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: '0.75rem' }}>Select a user:</p>
                                    {searchResults.map((user) => (
                                        <div
                                            key={user._id}
                                            onClick={() => setSelectedUser(user)}
                                            style={{
                                                padding: '0.75rem',
                                                borderRadius: '8px',
                                                border: selectedUser?._id === user._id ? '2px solid var(--primary)' : '1px solid var(--border)',
                                                backgroundColor: selectedUser?._id === user._id ? 'rgba(37, 99, 235, 0.1)' : 'transparent',
                                                cursor: 'pointer',
                                                marginBottom: '0.5rem',
                                                transition: 'all 0.2s'
                                            }}
                                        >
                                            <div style={{ fontWeight: 600 }}>{user.name}</div>
                                            <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>{user.email}</div>
                                            <div style={{ fontSize: '0.75rem', color: 'var(--primary)', marginTop: '0.25rem', textTransform: 'capitalize' }}>
                                                {user.userType} {user.role === 'recruiter' ? `(${user.recruiterProfile?.companyName || 'N/A'})` : '(Student)'}
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}

                            {searchQuery.trim().length > 0 && searchResults.length === 0 && !searching && (
                                <p style={{ textAlign: 'center', color: 'var(--text-muted)', marginBottom: '1.5rem' }}>No users found</p>
                            )}

                            {selectedUser && (
                                <div style={{
                                    padding: '1rem',
                                    backgroundColor: 'rgba(37, 99, 235, 0.1)',
                                    borderRadius: '8px',
                                    marginBottom: '1.5rem',
                                    border: '1px solid var(--primary)'
                                }}>
                                    <p style={{ margin: '0 0 0.5rem 0', fontSize: '0.85rem', color: 'var(--text-muted)' }}>Selected User:</p>
                                    <div style={{ fontWeight: 600 }}>{selectedUser.name}</div>
                                    <div style={{ fontSize: '0.9rem', color: 'var(--text-muted)' }}>{selectedUser.email}</div>
                                </div>
                            )}

                            <div style={{ display: 'flex', gap: '1rem', justifyContent: 'flex-end' }}>
                                <button
                                    onClick={() => {
                                        setShowAddModal(false);
                                        setSearchQuery('');
                                        setSearchResults([]);
                                        setSelectedUser(null);
                                    }}
                                    className="btn btn-secondary"
                                    disabled={promoting}
                                    style={{ padding: '0.5rem 1rem' }}
                                >
                                    Cancel
                                </button>
                                <button
                                    onClick={handlePromoteAdmin}
                                    className="btn btn-primary"
                                    disabled={!selectedUser || promoting}
                                    style={{ padding: '0.5rem 1rem' }}
                                >
                                    {promoting ? 'Adding...' : 'Make Admin'}
                                </button>
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </Layout>
    );
};

export default AdminManagement;
