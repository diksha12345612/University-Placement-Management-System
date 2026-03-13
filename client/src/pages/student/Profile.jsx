import { useState, useEffect } from 'react';
import Layout from '../../components/Layout';
import { useAuth } from '../../context/AuthContext';
import { studentAPI, FILE_BASE_URL } from '../../services/api';
import toast from 'react-hot-toast';

const StudentProfile = () => {
    const { user, updateUser } = useAuth();
    const [form, setForm] = useState({
        name: '', rollNumber: '', department: '', batch: '', cgpa: '', phone: '', gender: '',
        skills: '', tenthPercentage: '', twelfthPercentage: '', linkedIn: '', github: '', portfolio: '', address: ''
    });
    const [loading, setLoading] = useState(false);
    const [uploading, setUploading] = useState(false);
    const [resumeFile, setResumeFile] = useState(null);

    useEffect(() => {
        if (user) {
            const sp = user.studentProfile || {};
            setForm({
                name: user.name || '', rollNumber: sp.rollNumber || '', department: sp.department || '',
                batch: sp.batch || '', cgpa: sp.cgpa || '', phone: sp.phone || '', gender: sp.gender || '',
                skills: (sp.skills || []).join(', '), tenthPercentage: sp.tenthPercentage || '',
                twelfthPercentage: sp.twelfthPercentage || '', linkedIn: sp.linkedIn || '',
                github: sp.github || '', portfolio: sp.portfolio || '', address: sp.address || ''
            });
        }
    }, [user]);

    const handleChange = (e) => setForm({ ...form, [e.target.name]: e.target.value });

    const handleSubmit = async (e) => {
        e.preventDefault();
        setLoading(true);
        try {
            const data = { ...form, skills: form.skills.split(',').map(s => s.trim()).filter(Boolean), cgpa: parseFloat(form.cgpa) || 0, tenthPercentage: parseFloat(form.tenthPercentage) || 0, twelfthPercentage: parseFloat(form.twelfthPercentage) || 0 };
            const res = await studentAPI.updateProfile(data);
            updateUser(res.data);
            toast.success('Profile updated!');
        } catch (err) {
            toast.error(err.response?.data?.error || 'Error updating profile');
        }
        finally { setLoading(false); }
    };

    const handleResumeUpload = async () => {
        if (!resumeFile) return toast.error('Select a file first');
        if (resumeFile.type !== 'application/pdf') return toast.error('Only PDF resumes are supported');
        const formData = new FormData();
        formData.append('resume', resumeFile);
        setUploading(true);
        try {
            await studentAPI.uploadResume(formData);
            const profileRes = await studentAPI.getProfile();
            updateUser(profileRes.data);
            setResumeFile(null);
            toast.success('Resume uploaded!');
        } catch (err) {
            toast.error(err.response?.data?.error || 'Error uploading resume');
        } finally {
            setUploading(false);
        }
    };

    return (
        <Layout title="My Profile">
            <div className="fade-in">
                <div className="card" style={{ maxWidth: '800px' }}>
                    <h2 style={{ marginBottom: '1.5rem' }}>Profile Information</h2>
                    <form onSubmit={handleSubmit}>
                        <div className="form-row">
                            <div className="form-group"><label>Full Name</label><input name="name" value={form.name} onChange={handleChange} required /></div>
                            <div className="form-group"><label>Roll Number</label><input name="rollNumber" value={form.rollNumber} onChange={handleChange} /></div>
                        </div>
                        <div className="form-row">
                            <div className="form-group">
                                <label>Department</label>
                                <select name="department" value={form.department} onChange={handleChange}>
                                    <option value="">Select</option>
                                    <option>Computer Science</option><option>Information Technology</option>
                                    <option>Electronics</option><option>Electrical</option><option>Mechanical</option>
                                    <option>Civil</option><option>Mathematics</option>
                                </select>
                            </div>
                            <div className="form-group"><label>Batch</label><input name="batch" value={form.batch} onChange={handleChange} placeholder="e.g., 2025" /></div>
                        </div>
                        <div className="form-row">
                            <div className="form-group"><label>CGPA</label><input name="cgpa" type="number" step="0.01" value={form.cgpa} onChange={handleChange} /></div>
                            <div className="form-group"><label>Phone</label><input name="phone" value={form.phone} onChange={handleChange} /></div>
                        </div>
                        <div className="form-row">
                            <div className="form-group"><label>10th %</label><input name="tenthPercentage" type="number" value={form.tenthPercentage} onChange={handleChange} /></div>
                            <div className="form-group"><label>12th %</label><input name="twelfthPercentage" type="number" value={form.twelfthPercentage} onChange={handleChange} /></div>
                        </div>
                        <div className="form-group"><label>Gender</label>
                            <select name="gender" value={form.gender} onChange={handleChange}>
                                <option value="">Select</option><option>Male</option><option>Female</option><option>Other</option>
                            </select>
                        </div>
                        <div className="form-group"><label>Skills (comma separated)</label><input name="skills" value={form.skills} onChange={handleChange} placeholder="JavaScript, React, Node.js" /></div>
                        <div className="form-row">
                            <div className="form-group"><label>LinkedIn</label><input name="linkedIn" value={form.linkedIn} onChange={handleChange} /></div>
                            <div className="form-group"><label>GitHub</label><input name="github" value={form.github} onChange={handleChange} /></div>
                        </div>
                        <div className="form-group"><label>Portfolio</label><input name="portfolio" value={form.portfolio} onChange={handleChange} /></div>
                        <div className="form-group"><label>Address</label><textarea name="address" value={form.address} onChange={handleChange} rows="2" /></div>
                        {/* Resume Section integrated into the form layout */}
                        <div style={{ marginTop: '2rem', paddingTop: '1.5rem', borderTop: '1px solid var(--border)', marginBottom: '2rem' }}>
                            <h3 style={{ marginBottom: '1rem' }}>Resume</h3>

                            {user?.studentProfile?.resumeUrl && (
                                <div className="mb-2 flex flex-col-mobile items-start gap-2">
                                    <p style={{ fontSize: '0.9rem', color: 'var(--success)', margin: 0 }}>Resume uploaded successfully.</p>
                                    <a
                                        href={`${FILE_BASE_URL}${user.studentProfile.resumeUrl}`}
                                        target="_blank"
                                        rel="noreferrer"
                                        className="btn btn-secondary btn-sm w-full-mobile flex justify-center"
                                    >
                                        View Current Resume
                                    </a>
                                </div>
                            )}

                            <div className="flex flex-col-mobile gap-2 items-start">
                                <input type="file" accept=".pdf" className="w-full-mobile" onChange={(e) => setResumeFile(e.target.files[0])} />
                                <button type="button" className="btn btn-secondary btn-sm w-full-mobile flex justify-center" onClick={handleResumeUpload} disabled={uploading}>{uploading ? 'Uploading...' : 'Upload New Resume'}</button>
                            </div>

                            {user?.studentProfile?.aiResumeAnalysis?.resumeScore > 0 && (
                                <div style={{ marginTop: '2rem', background: 'var(--bg-card)', padding: '1.5rem', borderRadius: '12px', border: '1px solid var(--border)' }}>
                                    <h4 style={{ marginBottom: '1rem', color: 'var(--primary)' }}>Full AI Resume Analysis</h4>

                                    <div className="grid-cols-1-mobile" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1.5rem', marginBottom: '1.5rem' }}>
                                        <div>
                                            <h5 style={{ color: 'var(--success)', marginBottom: '0.5rem' }}>Strengths</h5>
                                            <ul style={{ fontSize: '0.9rem', paddingLeft: '1.2rem', color: 'var(--text-secondary)' }}>
                                                {(user.studentProfile.aiResumeAnalysis.strengths || []).map((s, i) => <li key={i}>{s}</li>)}
                                            </ul>
                                        </div>
                                        <div>
                                            <h5 style={{ color: 'var(--error)', marginBottom: '0.5rem' }}>Areas for Improvement</h5>
                                            <ul style={{ fontSize: '0.9rem', paddingLeft: '1.2rem', color: 'var(--text-secondary)' }}>
                                                {(user.studentProfile.aiResumeAnalysis.weaknesses || []).map((w, i) => <li key={i}>{w}</li>)}
                                            </ul>
                                        </div>
                                    </div>

                                    {(user.studentProfile.aiResumeAnalysis.suggestions || user.studentProfile.aiResumeAnalysis.improvements || []).length > 0 && (
                                        <div style={{ marginBottom: '1.5rem' }}>
                                            <h5 style={{ color: 'var(--warning)', marginBottom: '0.5rem' }}>Recommended Actions</h5>
                                            <ul style={{ fontSize: '0.9rem', paddingLeft: '1.2rem', color: 'var(--text-secondary)' }}>
                                                {(user.studentProfile.aiResumeAnalysis.suggestions || user.studentProfile.aiResumeAnalysis.improvements).map((s, i) => <li key={i}>{s}</li>)}
                                            </ul>
                                        </div>
                                    )}

                                    {(user.studentProfile.aiResumeAnalysis.missingSkills || []).length > 0 && (
                                        <div>
                                            <h5 style={{ color: 'var(--secondary)', marginBottom: '0.5rem', fontSize: '14px' }}>Missing Skills / Keywords</h5>
                                            <div className="flex flex-wrap gap-1">
                                                {user.studentProfile.aiResumeAnalysis.missingSkills.map((k, i) => (
                                                    <span key={i} className="skill-tag" style={{ background: 'var(--primary-glow)', color: 'var(--primary)', fontSize: '0.8rem' }}>{k}</span>
                                                ))}
                                            </div>
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>

                        {/* Save Profile Button moved at the absolute bottom */}
                        <button type="submit" className="btn btn-primary btn-lg" style={{ width: '100%' }} disabled={loading}>
                            {loading ? 'Saving Changes...' : 'Save Complete Profile'}
                        </button>
                    </form>
                </div>
            </div>
        </Layout>
    );
};

export default StudentProfile;
