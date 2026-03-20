import { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import Layout from '../../components/Layout';
import { adminAPI, studentAPI, jobAPI, applicationAPI } from '../../services/api';
import toast from 'react-hot-toast';

const AdminReports = () => {
    const [data, setData] = useState(null);
    const [loading, setLoading] = useState(true);
    const [selectedView, setSelectedView] = useState(null);
    const [viewData, setViewData] = useState([]);
    const [viewTitle, setViewTitle] = useState('');
    const [viewLoading, setViewLoading] = useState(false);
    
    // Export modal state
    const [showExportModal, setShowExportModal] = useState(false);
    const [exportFormat, setExportFormat] = useState('json');
    const [selectedDataTypes, setSelectedDataTypes] = useState({
        students: true,
        placements: true,
        recruiters: true,
        jobs: false,
        applications: false,
        drives: false,
        announcements: false
    });
    const [exporting, setExporting] = useState(false);

    useEffect(() => { adminAPI.getReports().then(res => setData(res.data)).catch(() => { }).finally(() => setLoading(false)); }, []);

    const handleViewTotalStudents = async () => {
        try {
            setViewLoading(true);
            const res = await studentAPI.getAll();
            setViewData(res.data);
            setViewTitle('All Students');
            setSelectedView('students');
        } catch (error) {
            console.error(error);
        } finally {
            setViewLoading(false);
        }
    };

    const handleViewPlacedStudents = async () => {
        try {
            setViewLoading(true);
            const res = await studentAPI.getAll();
            const placed = res.data.filter(s => s.studentProfile?.isPlaced);
            setViewData(placed);
            setViewTitle('Placed Students');
            setSelectedView('students');
        } catch (error) {
            console.error(error);
        } finally {
            setViewLoading(false);
        }
    };

    const handleViewUnplacedStudents = async () => {
        try {
            setViewLoading(true);
            const res = await studentAPI.getAll();
            const unplaced = res.data.filter(s => !s.studentProfile?.isPlaced);
            setViewData(unplaced);
            setViewTitle('Unplaced Students');
            setSelectedView('students');
        } catch (error) {
            console.error(error);
        } finally {
            setViewLoading(false);
        }
    };

    const handleViewActiveJobs = async () => {
        try {
            setViewLoading(true);
            const res = await jobAPI.getAll();
            const active = res.data.filter(j => j.status === 'approved');
            setViewData(active);
            setViewTitle('Active Jobs');
            setSelectedView('jobs');
        } catch (error) {
            console.error(error);
        } finally {
            setViewLoading(false);
        }
    };

    const handleViewApplications = async () => {
        try {
            setViewLoading(true);
            const res = await applicationAPI.getAll();
            setViewData(res.data);
            setViewTitle('All Applications');
            setSelectedView('applications');
        } catch (error) {
            console.error(error);
        } finally {
            setViewLoading(false);
        }
    };

    const handleDataTypeToggle = (type) => {
        setSelectedDataTypes(prev => ({ ...prev, [type]: !prev[type] }));
    };

    const handleRawExport = async () => {
        try {
            setExporting(true);
            const selectedTypes = Object.keys(selectedDataTypes).filter(k => selectedDataTypes[k]).join(',');
            if (!selectedTypes) {
                toast.error('Please select at least one data type to export');
                return;
            }

            // Fetch with proper authentication header
            const response = await fetch(`/api/admin/export/raw?dataTypes=${selectedTypes}&format=${exportFormat}`, {
                method: 'GET',
                headers: {
                    'Authorization': `Bearer ${localStorage.getItem('token')}`
                }
            });

            if (!response.ok) {
                if (response.status === 401) {
                    toast.error('⚠️ Session expired. Please login again.');
                    localStorage.removeItem('token');
                    localStorage.removeItem('user');
                    window.location.href = '/login';
                    return;
                }
                const errorData = await response.json();
                throw new Error(errorData.error || `HTTP ${response.status}`);
            }

            // Get the blob and download it
            const blob = await response.blob();
            const blobUrl = window.URL.createObjectURL(blob);
            const link = document.createElement('a');
            link.href = blobUrl;
            link.download = `raw_export_${new Date().toISOString().split('T')[0]}.${exportFormat === 'csv' ? 'csv' : 'json'}`;
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            window.URL.revokeObjectURL(blobUrl);
            
            toast.success(`✅ ${exportFormat.toUpperCase()} export downloaded!`);
            setShowExportModal(false);
        } catch (error) {
            console.error('Export error:', error);
            toast.error('Export failed: ' + error.message);
        } finally {
            setExporting(false);
        }
    };

    const exportToCSV = () => {
        if (!data) return;

        const lines = [];

        // --- Section 1: Placement Summary ---
        lines.push("--- PLACEMENT SUMMARY ---");
        lines.push("Branch,Total Students,Placed Students,Placement Rate (%)");
        (data.branchStats || []).forEach(b => {
            lines.push(`${b._id || 'N/A'},${b.total},${b.placed},${Math.round((b.placed / Math.max(b.total, 1)) * 100)}%`);
        });
        lines.push("\n");

        // --- Section 2: Student Master List ---
        lines.push("--- STUDENT MASTER LIST ---");
        lines.push("Name,Email,Department,CGPA,Status,Placement Company,Applications Sent");
        (data.studentDetails || []).forEach(s => {
            lines.push(`"${s.name}","${s.email}","${s.studentProfile?.department || 'N/A'}",${s.studentProfile?.cgpa || 0},${s.status},"${s.placedAt || 'N/A'}",${s.applicationCount || 0}`);
        });
        lines.push("\n");

        // --- Section 3: Recruiter Performance ---
        lines.push("--- RECRUITER PERFORMANCE ---");
        lines.push("Name,Email,Company,Jobs Posted,Successful Hires");
        (data.recruiterDetails || []).forEach(r => {
            lines.push(`"${r.name}","${r.email}","${r.company || 'N/A'}",${r.jobsPosted || 0},${r.totalHires || 0}`);
        });

        const csvContent = "data:text/csv;charset=utf-8," + lines.join("\n");
        const encodedUri = encodeURI(csvContent);
        const link = document.createElement("a");
        link.setAttribute("href", encodedUri);
        link.setAttribute("download", `detailed_placement_report_${new Date().toLocaleDateString()}.csv`);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };

    if (loading) return <Layout title="Reports"><div className="loading"><div className="spinner"></div></div></Layout>;
    if (!data) return <Layout title="Reports"><p>Error loading reports</p></Layout>;

    const maxBranch = Math.max(...(data.branchStats || []).map(b => b.total), 1);
    const maxCompany = Math.max(...(data.companyStats || []).map(c => c.count), 1);

    return (
        <Layout title="Analytics & Reports">
            <div className="fade-in">
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem', gap: '1rem', flexWrap: 'wrap' }}>
                    <p style={{ color: 'var(--text-muted)', margin: 0, flex: 1 }}>Comprehensive placement analytics and performance tracking.</p>
                    <div style={{ display: 'flex', gap: '0.75rem' }}>
                        <button className="btn btn-primary btn-sm" onClick={() => setShowExportModal(true)}>📥 Export Data</button>
                        <button className="btn btn-secondary btn-sm" onClick={exportToCSV}>📋 Quick Export (CSV)</button>
                    </div>
                </div>

                {/* Overview Row */}
                <div className="stats-grid">
                    <div className="stat-card" onClick={handleViewTotalStudents} style={{ cursor: 'pointer', transition: 'transform 0.2s' }} onMouseEnter={(e) => e.currentTarget.style.transform = 'translateY(-4px)'} onMouseLeave={(e) => e.currentTarget.style.transform = 'none'}>
                        <div className="stat-icon blue"><span>👥</span></div><div className="stat-info"><h3>{data.overview.totalStudents}</h3><p>Total Students</p></div>
                    </div>
                    <div className="stat-card" onClick={handleViewPlacedStudents} style={{ cursor: 'pointer', transition: 'transform 0.2s' }} onMouseEnter={(e) => e.currentTarget.style.transform = 'translateY(-4px)'} onMouseLeave={(e) => e.currentTarget.style.transform = 'none'}>
                        <div className="stat-icon green"><span>✅</span></div><div className="stat-info"><h3>{data.overview.placedStudents}</h3><p>Placed</p></div>
                    </div>
                    <div className="stat-card" onClick={handleViewUnplacedStudents} style={{ cursor: 'pointer', transition: 'transform 0.2s' }} onMouseEnter={(e) => e.currentTarget.style.transform = 'translateY(-4px)'} onMouseLeave={(e) => e.currentTarget.style.transform = 'none'}>
                        <div className="stat-icon orange"><span>⏳</span></div><div className="stat-info"><h3>{data.overview.unplacedStudents}</h3><p>Unplaced</p></div>
                    </div>
                    <div className="stat-card" onClick={handleViewActiveJobs} style={{ cursor: 'pointer', transition: 'transform 0.2s' }} onMouseEnter={(e) => e.currentTarget.style.transform = 'translateY(-4px)'} onMouseLeave={(e) => e.currentTarget.style.transform = 'none'}>
                        <div className="stat-icon cyan"><span>💼</span></div><div className="stat-info"><h3>{data.overview.approvedJobs}</h3><p>Active Jobs</p></div>
                    </div>
                    <div className="stat-card" onClick={handleViewApplications} style={{ cursor: 'pointer', transition: 'transform 0.2s' }} onMouseEnter={(e) => e.currentTarget.style.transform = 'translateY(-4px)'} onMouseLeave={(e) => e.currentTarget.style.transform = 'none'}>
                        <div className="stat-icon red"><span>📋</span></div><div className="stat-info"><h3>{data.overview.totalApplications}</h3><p>Applications</p></div>
                    </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(var(--chart-min, 300px), 1fr))', gap: '1.5rem', marginTop: '2rem' }}>
                    {/* Placement Ratio Circular Chart */}
                    <div className="card" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '350px' }}>
                        <h3 className="card-title" style={{ alignSelf: 'flex-start', marginBottom: '2rem' }}>Overall Placement Ratio</h3>
                        <div style={{ position: 'relative', width: '220px', height: '220px' }}>
                            <div style={{
                                width: '100%', height: '100%', borderRadius: '50%',
                                background: `conic-gradient(var(--success) ${(data.overview.placedStudents / Math.max(data.overview.totalStudents, 1)) * 360}deg, var(--bg-body) 0deg)`,
                                border: '4px solid var(--border)',
                                boxShadow: '0 0 20px var(--success-glow)'
                            }}></div>
                            <div style={{
                                position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)',
                                width: '160px', height: '160px', borderRadius: '50%', background: 'var(--bg-card)',
                                display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
                                border: '1px solid var(--border)'
                            }}>
                                <span style={{ fontSize: '2.5rem', fontWeight: 800, color: 'var(--success)' }}>
                                    {Math.round((data.overview.placedStudents / Math.max(data.overview.totalStudents, 1)) * 100)}%
                                </span>
                                <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Placed</span>
                            </div>
                        </div>
                        <div style={{ marginTop: '2rem', display: 'flex', gap: '2rem' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                <div style={{ width: '12px', height: '12px', background: 'var(--success)', borderRadius: '2px' }}></div>
                                <span style={{ fontSize: '0.9rem' }}>Placed ({data.overview.placedStudents})</span>
                            </div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                <div style={{ width: '12px', height: '12px', background: 'var(--bg-body)', borderRadius: '2px', border: '1px solid var(--border)' }}></div>
                                <span style={{ fontSize: '0.9rem' }}>Unplaced ({data.overview.unplacedStudents})</span>
                            </div>
                        </div>
                    </div>

                    {/* Branch-wise Bar Chart */}
                    <div className="card" style={{ minHeight: '350px' }}>
                        <h3 className="card-title" style={{ marginBottom: '1.5rem' }}>Branch wise Distribution</h3>
                        <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-around', height: '240px', paddingTop: '2rem' }}>
                            {data.branchStats.map((b, i) => (
                                <div key={i} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', width: '50px' }}>
                                    <div style={{ marginBottom: '0.5rem', fontSize: '0.8rem', fontWeight: 600 }}>{b.total}</div>
                                    <div style={{
                                        height: `${(b.total / maxBranch) * 160}px`,
                                        width: '30px',
                                        background: 'linear-gradient(180deg, var(--primary), var(--secondary))',
                                        borderRadius: '6px 6px 0 0',
                                        position: 'relative'
                                    }}>
                                        <div style={{
                                            position: 'absolute', bottom: 0, width: '100%',
                                            height: `${(b.placed / Math.max(b.total, 1)) * 100}%`,
                                            background: 'var(--success)',
                                            borderRadius: '2px 2px 0 0',
                                            opacity: 0.8
                                        }} title={`Placed: ${b.placed}`}></div>
                                    </div>
                                    <div style={{
                                        marginTop: '0.75rem', fontSize: '0.7rem', color: 'var(--text-muted)',
                                        textAlign: 'center', writingMode: 'vertical-rl', height: '60px', transform: 'rotate(180deg)'
                                    }}>{b._id || 'Unknown'}</div>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '1.5rem', marginTop: '1.5rem' }}>
                    {/* Top Companies */}
                    <div className="card">
                        <h3 className="card-title" style={{ marginBottom: '1.5rem' }}>Top Recruiting Companies</h3>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
                            {data.companyStats.slice(0, 5).map((c, i) => (
                                <div key={i}>
                                    <div className="flex justify-between items-center mb-1">
                                        <span style={{ fontSize: '0.95rem', fontWeight: 500 }}>{c._id || 'Standard Hire'}</span>
                                        <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>{c.count} Hires</span>
                                    </div>
                                    <div style={{ height: '8px', background: 'var(--bg-body)', borderRadius: '10px', overflow: 'hidden' }}>
                                        <div style={{ height: '100%', width: `${(c.count / maxCompany) * 100}%`, background: 'var(--primary)', borderRadius: '10px' }}></div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* Application Funnel */}
                    <div className="card">
                        <h3 className="card-title" style={{ marginBottom: '1.5rem' }}>Application Funnel</h3>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                            {data.applicationStats.map((s, i) => (
                                <div key={i} style={{
                                    padding: '1rem', background: 'var(--bg-body)', borderRadius: '10px',
                                    border: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center'
                                }}>
                                    <div>
                                        <div style={{ fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.5px', color: 'var(--text-muted)', marginBottom: '0.25rem' }}>{s._id}</div>
                                        <div style={{ fontSize: '1.25rem', fontWeight: 700 }}>{s.count}</div>
                                    </div>
                                    <div style={{ fontSize: '2rem', opacity: 0.1 }}>📄</div>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>

                {/* Data View Modal - Rendered via Portal for full screen centering */}
            </div>

            {/* Modal Portal - Renders outside the Layout hierarchy */}
            {selectedView && createPortal(
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
                    <div className="card" style={{ width: '95%', maxWidth: '1000px', maxHeight: '90vh', overflowY: 'auto' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
                            <h3>{viewTitle}</h3>
                            <button onClick={() => setSelectedView(null)} style={{ fontSize: '1.5rem', background: 'none', border: 'none', cursor: 'pointer' }}>✕</button>
                        </div>

                        {viewLoading ? (
                            <div style={{ textAlign: 'center', padding: '2rem' }}>
                                <div className="spinner"></div>
                                <p>Loading data...</p>
                            </div>
                        ) : (
                            <>
                                {/* Students View */}
                                {selectedView === 'students' && (
                                    <div style={{ overflowX: 'auto' }}>
                                        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                                            <thead>
                                                <tr style={{ borderBottom: '2px solid var(--border)' }}>
                                                    <th style={{ padding: '1rem', textAlign: 'left' }}>Name</th>
                                                    <th style={{ padding: '1rem', textAlign: 'left' }}>Email</th>
                                                    <th style={{ padding: '1rem', textAlign: 'left' }}>Department</th>
                                                    <th style={{ padding: '1rem', textAlign: 'left' }}>CGPA</th>
                                                    <th style={{ padding: '1rem', textAlign: 'left' }}>Status</th>
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {viewData.length === 0 ? (
                                                    <tr>
                                                        <td colSpan="5" style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-muted)' }}>No students found</td>
                                                    </tr>
                                                ) : (
                                                    viewData.map((student, idx) => (
                                                        <tr key={idx} style={{ borderBottom: '1px solid var(--border)' }}>
                                                            <td style={{ padding: '1rem' }}><strong>{student.name}</strong></td>
                                                            <td style={{ padding: '1rem' }}>{student.email}</td>
                                                            <td style={{ padding: '1rem' }}>{student.studentProfile?.department || 'N/A'}</td>
                                                            <td style={{ padding: '1rem' }}>{student.studentProfile?.cgpa || 'N/A'}</td>
                                                            <td style={{ padding: '1rem' }}>
                                                                <span style={{
                                                                    padding: '0.25rem 0.75rem',
                                                                    borderRadius: '20px',
                                                                    fontSize: '0.85rem',
                                                                    fontWeight: 600,
                                                                    backgroundColor: student.studentProfile?.isPlaced ? '#10b98140' : '#ef444440',
                                                                    color: student.studentProfile?.isPlaced ? '#10b981' : '#ef4444'
                                                                }}>
                                                                    {student.studentProfile?.isPlaced ? 'Placed' : 'Unplaced'}
                                                                </span>
                                                            </td>
                                                        </tr>
                                                    ))
                                                )}
                                            </tbody>
                                        </table>
                                    </div>
                                )}

                                {/* Jobs View */}
                                {selectedView === 'jobs' && (
                                    <div style={{ overflowX: 'auto' }}>
                                        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                                            <thead>
                                                <tr style={{ borderBottom: '2px solid var(--border)' }}>
                                                    <th style={{ padding: '1rem', textAlign: 'left' }}>Job Title</th>
                                                    <th style={{ padding: '1rem', textAlign: 'left' }}>Company</th>
                                                    <th style={{ padding: '1rem', textAlign: 'left' }}>Posted By</th>
                                                    <th style={{ padding: '1rem', textAlign: 'left' }}>Salary</th>
                                                    <th style={{ padding: '1rem', textAlign: 'left' }}>Status</th>
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {viewData.length === 0 ? (
                                                    <tr>
                                                        <td colSpan="5" style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-muted)' }}>No jobs found</td>
                                                    </tr>
                                                ) : (
                                                    viewData.map((job, idx) => (
                                                        <tr key={idx} style={{ borderBottom: '1px solid var(--border)' }}>
                                                            <td style={{ padding: '1rem' }}><strong>{job.title}</strong></td>
                                                            <td style={{ padding: '1rem' }}>{job.company}</td>
                                                            <td style={{ padding: '1rem' }}>{typeof job.postedBy === 'object' ? job.postedBy.name : 'N/A'}</td>
                                                            <td style={{ padding: '1rem' }}>{job.salary ? `₹ ${job.salary}` : 'Negotiable'}</td>
                                                            <td style={{ padding: '1rem' }}>
                                                                <span style={{
                                                                    padding: '0.25rem 0.75rem',
                                                                    borderRadius: '20px',
                                                                    fontSize: '0.85rem',
                                                                    fontWeight: 600,
                                                                    backgroundColor: job.status === 'approved' ? '#10b98140' : job.status === 'pending' ? '#f59e0b40' : '#ef444440',
                                                                    color: job.status === 'approved' ? '#10b981' : job.status === 'pending' ? '#f59e0b' : '#ef4444'
                                                                }}>
                                                                    {job.status.charAt(0).toUpperCase() + job.status.slice(1)}
                                                                </span>
                                                            </td>
                                                        </tr>
                                                    ))
                                                )}
                                            </tbody>
                                        </table>
                                    </div>
                                )}

                                {/* Applications View */}
                                {selectedView === 'applications' && (
                                    <div style={{ overflowX: 'auto' }}>
                                        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                                            <thead>
                                                <tr style={{ borderBottom: '2px solid var(--border)' }}>
                                                    <th style={{ padding: '1rem', textAlign: 'left' }}>Student</th>
                                                    <th style={{ padding: '1rem', textAlign: 'left' }}>Job</th>
                                                    <th style={{ padding: '1rem', textAlign: 'left' }}>Company</th>
                                                    <th style={{ padding: '1rem', textAlign: 'left' }}>Applied Date</th>
                                                    <th style={{ padding: '1rem', textAlign: 'left' }}>Status</th>
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {viewData.length === 0 ? (
                                                    <tr>
                                                        <td colSpan="5" style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-muted)' }}>No applications found</td>
                                                    </tr>
                                                ) : (
                                                    viewData.map((app, idx) => (
                                                        <tr key={idx} style={{ borderBottom: '1px solid var(--border)' }}>
                                                            <td style={{ padding: '1rem' }}><strong>{app.student?.name || 'N/A'}</strong></td>
                                                            <td style={{ padding: '1rem' }}>{app.job?.title || 'N/A'}</td>
                                                            <td style={{ padding: '1rem' }}>{app.job?.company || 'N/A'}</td>
                                                            <td style={{ padding: '1rem' }}>{new Date(app.appliedAt).toLocaleDateString()}</td>
                                                            <td style={{ padding: '1rem' }}>
                                                                <span style={{
                                                                    padding: '0.25rem 0.75rem',
                                                                    borderRadius: '20px',
                                                                    fontSize: '0.85rem',
                                                                    fontWeight: 600,
                                                                    backgroundColor: app.status === 'selected' ? '#10b98140' : app.status === 'rejected' ? '#ef444440' : app.status === 'shortlisted' ? '#3b82f640' : '#f59e0b40',
                                                                    color: app.status === 'selected' ? '#10b981' : app.status === 'rejected' ? '#ef4444' : app.status === 'shortlisted' ? '#3b82f6' : '#f59e0b'
                                                                }}>
                                                                    {app.status.charAt(0).toUpperCase() + app.status.slice(1)}
                                                                </span>
                                                            </td>
                                                        </tr>
                                                    ))
                                                )}
                                            </tbody>
                                        </table>
                                    </div>
                                )}
                            </>
                        )}
                    </div>
                </div>,
                document.body
            )}

            {/* Export Modal */}
            {showExportModal && createPortal(
                <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 9999, backdropFilter: 'blur(5px)' }} onClick={() => setShowExportModal(false)}>
                    <div className="card" style={{ maxWidth: '500px', width: '90%', maxHeight: '80vh', overflowY: 'auto', padding: '2rem' }} onClick={e => e.stopPropagation()}>
                        <h2 style={{ marginTop: 0, marginBottom: '1.5rem' }}>📥 Export Dataset</h2>
                        
                        <div style={{ marginBottom: '1.5rem' }}>
                            <label style={{ fontWeight: 600, marginBottom: '0.75rem', display: 'block', color: 'var(--primary)' }}>Select Data Types:</label>
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
                                {Object.keys(selectedDataTypes).map(type => (
                                    <label key={type} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer', padding: '0.5rem', borderRadius: '6px', background: 'var(--bg-dark)', transition: 'background 0.2s' }} onMouseEnter={e => e.currentTarget.style.background = 'var(--bg-light)'} onMouseLeave={e => e.currentTarget.style.background = 'var(--bg-dark)'}>
                                        <input type="checkbox" checked={selectedDataTypes[type]} onChange={() => handleDataTypeToggle(type)} style={{ cursor: 'pointer' }} />
                                        <span style={{ fontSize: '0.9rem', textTransform: 'capitalize' }}>{type.replace(/([A-Z])/g, ' $1').trim()}</span>
                                    </label>
                                ))}
                            </div>
                        </div>

                        <div style={{ marginBottom: '1.5rem' }}>
                            <label style={{ fontWeight: 600, marginBottom: '0.75rem', display: 'block', color: 'var(--primary)' }}>Export Format:</label>
                            <div style={{ display: 'flex', gap: '0.75rem' }}>
                                <label style={{ flex: 1, padding: '0.75rem', borderRadius: '6px', border: exportFormat === 'json' ? '2px solid var(--primary)' : '1px solid var(--border)', background: exportFormat === 'json' ? 'rgba(99,102,241,0.1)' : 'var(--bg-dark)', cursor: 'pointer', textAlign: 'center', transition: 'all 0.2s' }}>
                                    <input type="radio" value="json" checked={exportFormat === 'json'} onChange={e => setExportFormat(e.target.value)} style={{ marginRight: '0.5rem', cursor: 'pointer' }} />
                                    JSON (Raw)
                                </label>
                                <label style={{ flex: 1, padding: '0.75rem', borderRadius: '6px', border: exportFormat === 'csv' ? '2px solid var(--primary)' : '1px solid var(--border)', background: exportFormat === 'csv' ? 'rgba(99,102,241,0.1)' : 'var(--bg-dark)', cursor: 'pointer', textAlign: 'center', transition: 'all 0.2s' }}>
                                    <input type="radio" value="csv" checked={exportFormat === 'csv'} onChange={e => setExportFormat(e.target.value)} style={{ marginRight: '0.5rem', cursor: 'pointer' }} />
                                    CSV (Tabular)
                                </label>
                            </div>
                        </div>

                        <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: '1.5rem' }}>
                            📊 <strong>JSON Format:</strong> Complete MongoDB documents as-is with all nested fields. Perfect for data analysis, archiving, or importing to other systems.<br/>
                            📋 <strong>CSV Format:</strong> Tabular format for Excel/spreadsheet viewing. Nested objects will be stringified.
                        </p>

                        <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'flex-end' }}>
                            <button className="btn btn-secondary" onClick={() => setShowExportModal(false)} disabled={exporting}>Cancel</button>
                            <button className="btn btn-primary" onClick={handleRawExport} disabled={exporting || Object.values(selectedDataTypes).every(v => !v)}>
                                {exporting ? '⏳ Exporting...' : '📥 Export'}
                            </button>
                        </div>
                    </div>
                </div>,
                document.body
            )}
        </Layout>
    );
};

export default AdminReports;
