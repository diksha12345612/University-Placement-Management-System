import { useState } from 'react';
import toast from 'react-hot-toast';
import { adminAPI } from '../services/api';

const AdminSectionOTPModal = ({ isOpen, onVerified, adminEmail = 'mohitbindal106@gmail.com' }) => {
    const [otp, setOtp] = useState('');
    const [loading, setLoading] = useState(false);
    const [otpSent, setOtpSent] = useState(false);
    const [sending, setSending] = useState(false);
    const [attemptsRemaining, setAttemptsRemaining] = useState(5);

    const handleSendOTP = async () => {
        setSending(true);
        try {
            const res = await adminAPI.sendAdminSectionOTP();
            setOtpSent(true);
            toast.success(`OTP sent to ${adminEmail}`);
        } catch (error) {
            const errorMsg = error.response?.data?.error || error.message || 'Failed to send OTP';
            toast.error('Error sending OTP: ' + errorMsg);
            console.error('Send OTP error:', error);
        } finally {
            setSending(false);
        }
    };

    const handleVerifyOTP = async () => {
        if (!otp.trim()) {
            toast.error('Please enter the OTP');
            return;
        }

        setLoading(true);
        try {
            const res = await adminAPI.verifyAdminSectionOTP(otp);
            toast.success('OTP verified! Access granted.');
            setOtp('');
            setOtpSent(false);
            onVerified();
        } catch (error) {
            const errorMsg = error.response?.data?.error || error.message || 'OTP verification failed';
            if (error.response?.data?.attemptsRemaining !== undefined) {
                setAttemptsRemaining(error.response.data.attemptsRemaining);
            }
            toast.error(errorMsg);
            console.error('Verify OTP error:', error);
        } finally {
            setLoading(false);
        }
    };

    const handleKeyPress = (e) => {
        if (e.key === 'Enter' && otpSent && otp) {
            handleVerifyOTP();
        }
    };

    if (!isOpen) return null;

    return (
        <div style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: 'rgba(0, 0, 0, 0.6)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 2000
        }}>
            <div style={{
                backgroundColor: 'var(--bg-card)',
                borderRadius: '12px',
                padding: '2rem',
                maxWidth: '420px',
                width: '90%',
                border: '1px solid var(--border)',
                boxShadow: '0 20px 60px rgba(0, 0, 0, 0.3)'
            }}>
                <div style={{ textAlign: 'center', marginBottom: '1.5rem' }}>
                    <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>🔐</div>
                    <h2 style={{ margin: '0 0 0.5rem 0' }}>Admin Section Access</h2>
                    <p style={{ color: 'var(--text-muted)', margin: 0, fontSize: '0.95rem' }}>
                        This section requires OTP verification
                    </p>
                </div>

                {!otpSent ? (
                    <div>
                        <p style={{ color: 'var(--text-muted)', marginBottom: '1.5rem', textAlign: 'center', fontSize: '0.9rem' }}>
                            An OTP will be sent to {adminEmail}
                        </p>
                        <button
                            onClick={handleSendOTP}
                            disabled={sending}
                            style={{
                                width: '100%',
                                padding: '0.75rem',
                                backgroundColor: 'var(--primary)',
                                color: 'white',
                                border: 'none',
                                borderRadius: '8px',
                                fontSize: '1rem',
                                fontWeight: 600,
                                cursor: sending ? 'not-allowed' : 'pointer',
                                opacity: sending ? 0.7 : 1,
                                transition: 'all 0.2s'
                            }}
                        >
                            {sending ? '⏳ Sending OTP...' : '📧 Send OTP'}
                        </button>
                    </div>
                ) : (
                    <div>
                        <p style={{ color: 'var(--text-muted)', marginBottom: '1rem', fontSize: '0.9rem' }}>
                            ✓ OTP sent. Check your email.
                        </p>
                        <input
                            type="text"
                            value={otp}
                            onChange={(e) => setOtp(e.target.value.replace(/\D/g, '').slice(0, 6))}
                            onKeyPress={handleKeyPress}
                            placeholder="Enter 6-digit OTP"
                            maxLength="6"
                            style={{
                                width: '100%',
                                padding: '0.75rem',
                                borderRadius: '8px',
                                border: '2px solid var(--border)',
                                fontSize: '1.2rem',
                                textAlign: 'center',
                                letterSpacing: '0.5rem',
                                marginBottom: '1rem',
                                boxSizing: 'border-box'
                            }}
                        />
                        <div style={{ marginBottom: '1rem', textAlign: 'center', fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                            Attempts remaining: <strong style={{ color: attemptsRemaining <= 2 ? 'var(--danger)' : 'var(--text-secondary)' }}>{attemptsRemaining}</strong>
                        </div>
                        <button
                            onClick={handleVerifyOTP}
                            disabled={loading || !otp}
                            style={{
                                width: '100%',
                                padding: '0.75rem',
                                backgroundColor: 'var(--success)',
                                color: 'white',
                                border: 'none',
                                borderRadius: '8px',
                                fontSize: '1rem',
                                fontWeight: 600,
                                cursor: loading || !otp ? 'not-allowed' : 'pointer',
                                opacity: loading || !otp ? 0.7 : 1,
                                transition: 'all 0.2s',
                                marginBottom: '0.75rem'
                            }}
                        >
                            {loading ? '⏳ Verifying...' : '✓ Verify OTP'}
                        </button>
                        <button
                            onClick={() => {
                                setOtpSent(false);
                                setOtp('');
                                setAttemptsRemaining(5);
                            }}
                            style={{
                                width: '100%',
                                padding: '0.5rem',
                                backgroundColor: 'transparent',
                                border: '1px solid var(--border)',
                                color: 'var(--text-secondary)',
                                borderRadius: '8px',
                                fontSize: '0.9rem',
                                cursor: 'pointer',
                                transition: 'all 0.2s'
                            }}
                        >
                            Send OTP Again
                        </button>
                    </div>
                )}

                <div style={{
                    marginTop: '1.5rem',
                    padding: '1rem',
                    backgroundColor: 'rgba(37, 99, 235, 0.08)',
                    borderRadius: '8px',
                    fontSize: '0.85rem',
                    color: 'var(--text-secondary)',
                    border: '1px solid rgba(37, 99, 235, 0.2)'
                }}>
                    <strong>ℹ️ Security Note:</strong> This verification session will expire in 1 hour.
                </div>
            </div>
        </div>
    );
};

export default AdminSectionOTPModal;
