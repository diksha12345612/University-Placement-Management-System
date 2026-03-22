import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { authAPI } from '../services/api';
import toast from 'react-hot-toast';

const Register = () => {
    const [form, setForm] = useState({ name: '', email: '', password: '', confirmPassword: '', role: 'student' });
    const [otp, setOtp] = useState('');
    const [step, setStep] = useState(1); // 1: Details, 2: OTP Verification
    const [loading, setLoading] = useState(false);
    const navigate = useNavigate();

    const handleChange = (e) => setForm({ ...form, [e.target.name]: e.target.value });

    const handleSendOTP = async (e) => {
        e.preventDefault();
        if (form.password !== form.confirmPassword) return toast.error('Passwords do not match');
        if (form.password.length < 6) return toast.error('Password must be at least 6 characters');

        setLoading(true);
        try {
            const res = await authAPI.registerOtp({
                name: form.name,
                email: form.email,
                password: form.password,
                role: form.role
            });

            if (res.data?.emailSent === true) {
                toast.success('OTP sent to your email!');
            } else {
                toast.error('Failed to send OTP. Please try again.');
                return;
            }

            setStep(2);
        } catch (err) {
            toast.error(err.response?.data?.error || 'Failed to send OTP. Please try again.');
        } finally {
            setLoading(false);
        }
    };

    const handleVerifyOTP = async (e) => {
        e.preventDefault();
        if (otp.length !== 6) return toast.error('Please enter a valid 6-digit OTP');

        setLoading(true);
        try {
            const res = await authAPI.registerVerify({
                name: form.name,
                email: form.email,
                password: form.password,
                role: form.role,
                otp: otp
            });

            if (!res.data.token) {
                const adminEmail = res.data.adminEmail || import.meta.env.VITE_ADMIN_EMAIL || 'admin@university.edu';
                toast.success(
                    `Your recruiter account request is under review. Please email your documents to ${adminEmail}: Aadhaar/ID proof, resume, company details, contact details, and the job roles you plan to offer.`,
                    { duration: 12000 }
                );
                navigate('/login');
                return;
            }

            // Log user in directly using the response from verify
            localStorage.setItem('token', res.data.token);
            localStorage.setItem('user', JSON.stringify(res.data.user));

            toast.success('Account verified and created!');
            window.location.href = res.data.user.role === 'recruiter' ? '/recruiter/dashboard' : '/student/dashboard';
        } catch (err) {
            toast.error(err.response?.data?.error || 'Verification failed. Invalid OTP?');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="auth-page">
            <div className="auth-card fade-in">
                <h1>{step === 1 ? 'Create Account' : 'Verify Email'}</h1>
                <p className="subtitle">
                    {step === 1 ? 'Join the placement portal' : `Enter the 6-digit code sent to ${form.email}`}
                </p>

                {step === 1 ? (
                    <>
                        <div className="role-tabs">
                            <div className={`role-tab ${form.role === 'student' ? 'active' : ''}`} onClick={() => setForm({ ...form, role: 'student' })}>🎓 Student</div>
                            <div className={`role-tab ${form.role === 'recruiter' ? 'active' : ''}`} onClick={() => setForm({ ...form, role: 'recruiter' })}>🏢 Recruiter</div>
                        </div>
                        <form onSubmit={handleSendOTP}>
                            <div className="form-group">
                                <label>Full Name</label>
                                <input name="name" value={form.name} onChange={handleChange} placeholder="Enter your name" required />
                            </div>
                            <div className="form-group">
                                <label>Email Address</label>
                                <input name="email" type="email" value={form.email} onChange={handleChange} placeholder="Enter your email" required />
                            </div>
                            <div className="form-group">
                                <label>Password</label>
                                <input name="password" type="password" value={form.password} onChange={handleChange} placeholder="Min 6 characters" required />
                            </div>
                            <div className="form-group">
                                <label>Confirm Password</label>
                                <input name="confirmPassword" type="password" value={form.confirmPassword} onChange={handleChange} placeholder="Confirm password" required />
                            </div>
                            <button type="submit" className="btn btn-primary" disabled={loading}>
                                {loading ? 'Sending OTP...' : 'Send Verification OTP'}
                            </button>
                        </form>
                    </>
                ) : (
                    <form onSubmit={handleVerifyOTP}>
                        <div className="form-group">
                            <label>One-Time Password (OTP)</label>
                            <input
                                type="text"
                                value={otp}
                                onChange={(e) => setOtp(e.target.value.replace(/\D/g, '').slice(0, 6))}
                                placeholder="Enter 6-digit OTP"
                                required
                                autoFocus
                            />
                        </div>
                        <button type="submit" className="btn btn-primary" disabled={loading}>
                            {loading ? 'Verifying...' : 'Verify & Create Account'}
                        </button>
                        <button type="button" className="btn btn-text" onClick={() => setStep(1)} disabled={loading}>
                            Back to Signup
                        </button>
                    </form>
                )}

                <div className="auth-footer">
                    Already have an account? <Link to="/login">Sign In</Link>
                </div>
            </div>
        </div>
    );
};

export default Register;
