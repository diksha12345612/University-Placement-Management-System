import { useState, useEffect } from 'react';
import Layout from '../../components/Layout';
import { useAuth } from '../../context/AuthContext';
import { recruiterAPI } from '../../services/api';
import toast from 'react-hot-toast';
import { getProfileCompletion } from '../../services/profileCompletion';

const RecruiterProfile = () => {
    const { user, updateUser } = useAuth();
    const [form, setForm] = useState({ name: '', company: '', designation: '', phoneCountryCode: '+91', phone: '', companyWebsite: '', companyDescription: '', industry: '' });
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        if (user) {
            const rp = user.recruiterProfile || {};
            setForm({ name: user.name || '', company: rp.company || '', designation: rp.designation || '', phoneCountryCode: rp.phoneCountryCode || '+91', phone: rp.phone || '', companyWebsite: rp.companyWebsite || '', companyDescription: rp.companyDescription || '', industry: rp.industry || '' });
        }
    }, [user]);

    const handleChange = (e) => {
        const { name, value } = e.target;
        if (name === 'phone') {
            return setForm((prev) => ({ ...prev, phone: value.replace(/\D/g, '').slice(0, 10) }));
        }
        if (name === 'phoneCountryCode') {
            return setForm((prev) => ({ ...prev, phoneCountryCode: value.replace(/[^\d+]/g, '') }));
        }
        setForm((prev) => ({ ...prev, [name]: value }));
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!/^\+\d{1,4}$/.test(String(form.phoneCountryCode || '').trim())) {
            return toast.error('Enter a valid country code (example: +91).');
        }
        if (!/^\d{10}$/.test(String(form.phone || ''))) {
            return toast.error('Mobile number must be exactly 10 digits.');
        }
        const profilePreview = {
            ...user,
            name: form.name,
            recruiterProfile: {
                ...(user?.recruiterProfile || {}),
                ...form,
            }
        };
        const completion = getProfileCompletion(profilePreview);
        if (!completion.isComplete) {
            return toast.error(`Complete all required fields. Missing: ${completion.missingFields.join(', ')}`);
        }

        setLoading(true);
        try {
            const res = await recruiterAPI.updateProfile(form);
            updateUser(res.data);
            toast.success('Profile updated!');
        } catch { toast.error('Error updating profile'); }
        finally { setLoading(false); }
    };

    return (
        <Layout title="Recruiter Profile">
            <div className="fade-in">
                <div className="card" style={{ maxWidth: '700px' }}>
                    <h2 style={{ marginBottom: '1.5rem' }}>Company Profile</h2>
                    <form onSubmit={handleSubmit}>
                        <div className="form-row">
                            <div className="form-group"><label>Your Name</label><input name="name" value={form.name} onChange={handleChange} required /></div>
                            <div className="form-group"><label>Designation</label><input name="designation" value={form.designation} onChange={handleChange} required /></div>
                        </div>
                        <div className="form-row">
                            <div className="form-group"><label>Company Name</label><input name="company" value={form.company} onChange={handleChange} required /></div>
                            <div className="form-group"><label>Industry</label><input name="industry" value={form.industry} onChange={handleChange} required /></div>
                        </div>
                        <div className="form-row">
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
                            <div className="form-group"><label>Website</label><input name="companyWebsite" value={form.companyWebsite} onChange={handleChange} required /></div>
                        </div>
                        <div className="form-group"><label>Company Description</label><textarea name="companyDescription" value={form.companyDescription} onChange={handleChange} rows="3" required /></div>
                        <button type="submit" className="btn btn-primary" disabled={loading}>{loading ? 'Saving...' : 'Save Profile'}</button>
                    </form>
                </div>
            </div>
        </Layout>
    );
};

export default RecruiterProfile;
