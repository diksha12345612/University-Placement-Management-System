import { useState, useEffect } from 'react';
import Layout from '../../components/Layout';
import { useAuth } from '../../context/AuthContext';
import { studentAPI, FILE_BASE_URL } from '../../services/api';
import toast from 'react-hot-toast';
import { getProfileCompletion } from '../../services/profileCompletion';

const StudentProfile = () => {
    const { user, updateUser } = useAuth();
    const [form, setForm] = useState({
        name: '', rollNumber: '', department: '', batch: '', cgpa: '', phoneCountryCode: '+91', phone: '', gender: '',
        skills: '', tenthPercentage: '', twelfthPercentage: '', linkedIn: '', github: '', portfolio: '', address: ''
    });
    const [loading, setLoading] = useState(false);
    const [resumeFile, setResumeFile] = useState(null);
    const [photoFile, setPhotoFile] = useState(null);
    const [photoPreview, setPhotoPreview] = useState(null);

    useEffect(() => {
        if (user) {
            const sp = user.studentProfile || {};
            setForm({
                name: user.name || '', rollNumber: sp.rollNumber || '', department: sp.department || '',
                batch: sp.batch || '', cgpa: sp.cgpa || '', phoneCountryCode: sp.phoneCountryCode || '+91', phone: sp.phone || '', gender: sp.gender || '',
                skills: (sp.skills || []).join(', '), tenthPercentage: sp.tenthPercentage || '',
                twelfthPercentage: sp.twelfthPercentage || '', linkedIn: sp.linkedIn || '',
                github: sp.github || '', portfolio: sp.portfolio || '', address: sp.address || ''
            });
            // Set photo preview if profile photo exists
            if (sp.profileImage) {
                setPhotoPreview(`data:${sp.profileImageContentType};base64,${sp.profileImage}`);
            }
        }
    }, [user]);

    const handleChange = (e) => {
        const { name, value } = e.target;
        if (name === 'phone') {
            const digitsOnly = value.replace(/\D/g, '').slice(0, 10);
            return setForm({ ...form, phone: digitsOnly });
        }
        if (name === 'phoneCountryCode') {
            const normalized = value.replace(/[^\d+]/g, '');
            return setForm({ ...form, phoneCountryCode: normalized });
        }
        setForm({ ...form, [name]: value });
    };

    const handlePhotoChange = (e) => {
        const file = e.target.files[0];
        if (!file) return;

        // Validate file type
        if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) {
            toast.error('Only JPEG, PNG, and WebP images are supported');
            return;
        }

        // Validate file size (5MB limit)
        if (file.size > 5 * 1024 * 1024) {
            toast.error('Image size must be less than 5MB');
            return;
        }

        setPhotoFile(file);

        // Create preview
        const reader = new FileReader();
        reader.onloadend = () => {
            setPhotoPreview(reader.result);
        };
        reader.readAsDataURL(file);
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (resumeFile && resumeFile.type !== 'application/pdf') {
            return toast.error('Only PDF resumes are supported');
        }
        if (!/^\+\d{1,4}$/.test(String(form.phoneCountryCode || '').trim())) {
            return toast.error('Enter a valid country code (example: +91).');
        }
        if (!/^\d{10}$/.test(String(form.phone || ''))) {
            return toast.error('Mobile number must be exactly 10 digits.');
        }

        const profilePreview = {
            ...user,
            name: form.name,
            studentProfile: {
                ...(user?.studentProfile || {}),
                ...form,
                skills: form.skills.split(',').map((s) => s.trim()).filter(Boolean)
            }
        };
        const completion = getProfileCompletion(profilePreview);
        if (!completion.isComplete && !(resumeFile && resumeFile.type === 'application/pdf' && completion.missingFields.length === 1 && completion.missingFields[0] === 'Resume')) {
            return toast.error(`Complete all required fields. Missing: ${completion.missingFields.join(', ')}`);
        }

        setLoading(true);
        try {
            if (resumeFile) {
                const formData = new FormData();
                formData.append('resume', resumeFile);
                await studentAPI.uploadResume(formData);
            }

            if (photoFile) {
                const photoFormData = new FormData();
                photoFormData.append('photo', photoFile);
                await studentAPI.uploadProfilePhoto(photoFormData);
            }

            const data = { ...form, skills: form.skills.split(',').map(s => s.trim()).filter(Boolean), cgpa: parseFloat(form.cgpa) || 0, tenthPercentage: parseFloat(form.tenthPercentage) || 0, twelfthPercentage: parseFloat(form.twelfthPercentage) || 0 };
            const res = await studentAPI.updateProfile(data);
            updateUser(res.data);

            if (resumeFile) {
                const profileRes = await studentAPI.getProfile();
                updateUser(profileRes.data);
                setResumeFile(null);
            }

            if (photoFile) {
                const profileRes = await studentAPI.getProfile();
                updateUser(profileRes.data);
                setPhotoFile(null);
            }

            toast.success('Profile saved!');
        } catch (err) {
            toast.error(err.response?.data?.error || 'Error saving profile');
        } finally {
            setLoading(false);
        }
    };

    const handleLinkedInUpload = async (e) => {
        const file = e.target.files[0];
        if (!file) return;

        if (file.type !== 'application/pdf') {
            return toast.error('Please upload a PDF file');
        }

        setLoading(true);
        const toastId = toast.loading('AI is analyzing your LinkedIn profile...');
        try {
            const formData = new FormData();
            formData.append('linkedinPdf', file);
            const res = await studentAPI.parseLinkedIn(formData);
            const data = res.data;

            // Pre-fill the form
            setForm(prev => ({
                ...prev,
                name: data.name || prev.name,
                skills: Array.isArray(data.skills) ? data.skills.join(', ') : (data.skills || prev.skills),
                linkedIn: data.linkedIn || prev.linkedIn,
                github: data.github || prev.github,
                portfolio: data.portfolio || prev.portfolio,
                address: data.address || prev.address
            }));

            toast.success('Profile details imported! Please review and fill in missing fields.', { id: toastId });
        } catch (err) {
            toast.error(err.response?.data?.error || 'Error parsing LinkedIn PDF', { id: toastId });
        } finally {
            setLoading(false);
            // Reset input
            e.target.value = '';
        }
    };

    return (
        <Layout title="My Profile">
            <div className="fade-in">
                <div className="card" style={{ maxWidth: '800px' }}>
                    <h2 style={{ marginBottom: '1.5rem' }}>Profile Information</h2>

                    {/* Quick Setup Section */}
                    <div style={{ 
                        marginBottom: '2rem', 
                        padding: '1.25rem', 
                        background: 'rgba(37, 99, 235, 0.05)', 
                        borderRadius: '12px', 
                        border: '1px solid rgba(37, 99, 235, 0.2)', 
                        display: 'flex', 
                        justifyContent: 'space-between', 
                        alignItems: 'center',
                        gap: '1rem',
                        flexWrap: 'wrap'
                    }}>
                        <div style={{ flex: 1, minWidth: '200px' }}>
                            <h4 style={{ margin: '0 0 0.25rem 0', color: 'var(--primary)', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                <span>Γ£¿</span> Quick Setup with LinkedIn
                            </h4>
                            <p style={{ margin: 0, fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                                Save time by importing your details from a LinkedIn Profile PDF.
                            </p>
                        </div>
                        <button 
                            type="button" 
                            className="btn btn-secondary" 
                            style={{ 
                                display: 'flex', 
                                alignItems: 'center', 
                                gap: '0.5rem',
                                whiteSpace: 'nowrap'
                            }}
                            onClick={() => document.getElementById('linkedin-upload').click()} 
                            disabled={loading}
                        >
                            {loading ? 'Analyzing...' : 'Upload LinkedIn PDF'}
                        </button>
                        <input 
                            id="linkedin-upload" 
                            type="file" 
                            accept=".pdf" 
                            style={{ display: 'none' }} 
                            onChange={handleLinkedInUpload} 
                        />
                    </div>

                    <form onSubmit={handleSubmit}>
                        {/* Profile Photo Section */}
                        <div style={{ marginBottom: '2rem', paddingBottom: '1.5rem', borderBottom: '1px solid var(--border)' }}>
                            <h3 style={{ marginBottom: '1rem' }}>Profile Photo</h3>
                            <div style={{ display: 'flex', gap: '2rem', alignItems: 'flex-start' }}>
                                {/* Photo Display */}
                                <div style={{ flex: '0 0 120px', textAlign: 'center' }}>
                                    {photoPreview ? (
                                        <img src={photoPreview} alt="Profile" style={{ width: '120px', height: '120px', borderRadius: '8px', objectFit: 'cover', border: '2px solid var(--primary)' }} />
                                    ) : (
                                        <div style={{ width: '120px', height: '120px', borderRadius: '8px', backgroundColor: 'rgba(37, 99, 235, 0.1)', border: '2px dashed var(--primary)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-secondary)', fontSize: '0.9rem' }}>
                                            No photo
                                        </div>
                                    )}
                                </div>

                                {/* Upload Input */}
                                <div style={{ flex: 1 }}>
                                    <p style={{ fontSize: '0.9rem', color: 'var(--text-secondary)', marginBottom: '0.5rem' }}>
                                        Upload a clear profile photo (JPEG, PNG, or WebP). Max 5MB. Optional.
                                    </p>
                                    <input
                                        type="file"
                                        accept="image/jpeg,image/png,image/webp"
                                        onChange={handlePhotoChange}
                                        style={{ width: '100%' }}
                                    />
                                    {photoFile && (
                                        <p style={{ fontSize: '0.85rem', color: 'var(--success)', margin: '0.5rem 0 0 0' }}>
                                            ✓ Selected: {photoFile.name} — will be uploaded on Save
                                        </p>
                                    )}
                                </div>
                            </div>
                        </div>

                        <div className="form-row">
                            <div className="form-group"><label>Full Name</label><input name="name" value={form.name} onChange={handleChange} required /></div>
                            <div className="form-group"><label>Roll Number</label><input name="rollNumber" value={form.rollNumber} onChange={handleChange} required /></div>
                        </div>
                        <div className="form-row">
                            <div className="form-group">
                                <label>Department</label>
                                <select name="department" value={form.department} onChange={handleChange} required>
                                    <option value="">Select</option>
                                    <option>Computer Science</option><option>Information Technology</option>
                                    <option>Electronics</option><option>Electrical</option><option>Mechanical</option>
                                    <option>Civil</option><option>Mathematics</option>
                                </select>
                            </div>
                            <div className="form-group"><label>Batch</label><input name="batch" value={form.batch} onChange={handleChange} placeholder="e.g., 2025" required /></div>
                        </div>
                        <div className="form-row">
                            <div className="form-group"><label>CGPA</label><input name="cgpa" type="number" step="0.01" min="0" max="10" value={form.cgpa} onChange={handleChange} required /></div>
                            <div className="form-group">
                                <label>Mobile Number</label>
                                <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'stretch' }}>
                                    <div style={{ flex: '0 0 76px' }}>
                                        <input name="phoneCountryCode" value={form.phoneCountryCode} onChange={handleChange} placeholder="+91" required />
                                    </div>
                                    <div style={{ flex: 1 }}>
                                        <input name="phone" value={form.phone} onChange={handleChange} inputMode="numeric" maxLength={10} placeholder="10-digit mobile" required />
                                    </div>
                                </div>
                            </div>
                        </div>
                        <div className="form-row">
                            <div className="form-group"><label>10th %</label><input name="tenthPercentage" type="number" min="0" max="100" value={form.tenthPercentage} onChange={handleChange} required /></div>
                            <div className="form-group"><label>12th %</label><input name="twelfthPercentage" type="number" min="0" max="100" value={form.twelfthPercentage} onChange={handleChange} required /></div>
                        </div>
                        <div className="form-group"><label>Gender</label>
                            <select name="gender" value={form.gender} onChange={handleChange} required>
                                <option value="">Select</option><option>Male</option><option>Female</option><option>Other</option>
                            </select>
                        </div>
                        <div className="form-group"><label>Skills (comma separated)</label><input name="skills" value={form.skills} onChange={handleChange} placeholder="JavaScript, React, Node.js" required /></div>
                        <div className="form-row">
                            <div className="form-group"><label>LinkedIn</label><input name="linkedIn" value={form.linkedIn} onChange={handleChange} required /></div>
                            <div className="form-group"><label>GitHub</label><input name="github" value={form.github} onChange={handleChange} required /></div>
                        </div>
                        <div className="form-group"><label>Portfolio (optional)</label><input name="portfolio" value={form.portfolio} onChange={handleChange} /></div>
                        <div className="form-group"><label>Address (optional)</label><textarea name="address" value={form.address} onChange={handleChange} rows="2" /></div>
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
                                <input type="file" accept=".pdf" className="w-full-mobile" onChange={(e) => setResumeFile(e.target.files[0])} required={!user?.studentProfile?.resumeUrl} />
                                {resumeFile && <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', margin: 0 }}>Selected: {resumeFile.name} — will be uploaded on Save</p>}
                            </div>

                            {user?.studentProfile?.aiResumeAnalysis?.resumeScore > 0 && (
                                <div style={{ marginTop: '2rem', background: 'var(--bg-card)', padding: '1.5rem', borderRadius: '8px', border: '1px solid var(--border)' }}>
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
                            {loading ? 'Saving...' : 'Save Profile'}
                        </button>
                    </form>
                </div>
            </div>
        </Layout>
    );
};

export default StudentProfile;
