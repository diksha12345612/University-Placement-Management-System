import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import toast from 'react-hot-toast';

const Login = () => {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [loading, setLoading] = useState(false);
    const { login } = useAuth();
    const navigate = useNavigate();

    const handleSubmit = async (e) => {
        e.preventDefault();
        setLoading(true);
        try {
            const data = await login(email, password);
            toast.success('Login successful!');
            const role = data.user.role;
            navigate(role === 'admin' ? '/admin/dashboard' : role === 'recruiter' ? '/recruiter/dashboard' : '/student/dashboard');
        } catch (err) {
            toast.error(err.response?.data?.error || 'Login failed');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="auth-page">
            {/* Floating back button — top-left of the page */}
            <Link
                to="/"
                style={{
                    position: 'fixed',
                    top: '1.25rem',
                    left: '1.5rem',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '0.4rem',
                    padding: '0.5rem 1rem',
                    background: 'var(--bg-card)',
                    border: '1px solid var(--border)',
                    borderRadius: '999px',
                    fontSize: '0.85rem',
                    fontWeight: 500,
                    color: 'var(--text-primary)',
                    textDecoration: 'none',
                    boxShadow: '0 2px 8px rgba(0,0,0,0.08)',
                    transition: 'transform 0.15s ease, box-shadow 0.15s ease',
                    zIndex: 100,
                }}
                onMouseEnter={e => { e.currentTarget.style.transform = 'translateY(-2px)'; e.currentTarget.style.boxShadow = '0 4px 16px rgba(0,0,0,0.12)'; }}
                onMouseLeave={e => { e.currentTarget.style.transform = 'translateY(0)'; e.currentTarget.style.boxShadow = '0 2px 8px rgba(0,0,0,0.08)'; }}
            >
                ← Home
            </Link>

            <div className="auth-card fade-in">
                <h1>Welcome Back</h1>
                <p className="subtitle">Sign in to your account</p>
                <form onSubmit={handleSubmit}>
                    <div className="form-group">
                        <label>Email Address</label>
                        <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="Enter your email" required />
                    </div>
                    <div className="form-group">
                        <label>Password</label>
                        <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Enter your password" required />
                    </div>
                    <button type="submit" className="btn btn-primary" disabled={loading}>
                        {loading ? 'Signing in...' : 'Sign In'}
                    </button>
                </form>

                {/* Forgot Password Link */}
                <div style={{ 
                    marginTop: '1rem', 
                    textAlign: 'center',
                    paddingTop: '1rem',
                    borderTop: '1px solid var(--border)'
                }}>
                    <Link to="/forgot-password" style={{ 
                        color: 'var(--primary)',
                        textDecoration: 'none',
                        fontSize: '0.9rem',
                        fontWeight: 500
                    }}>
                        Forgot Password?
                    </Link>
                </div>

                <div className="auth-footer">
                    Don't have an account? <Link to="/register">Register</Link>
                </div>

            </div>
        </div>
    );
};

export default Login;
