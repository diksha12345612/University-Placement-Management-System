import axios from 'axios';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5051/api';
export const FILE_BASE_URL = API_URL.replace('/api', '');

const api = axios.create({
    baseURL: API_URL,
    headers: { 'Content-Type': 'application/json' }
});

api.interceptors.request.use((config) => {
    const token = localStorage.getItem('token');
    if (token) config.headers.Authorization = `Bearer ${token}`;
    return config;
});

api.interceptors.response.use(
    (res) => res,
    (err) => {
        if (err.response?.status === 401) {
            localStorage.removeItem('token');
            localStorage.removeItem('user');
            if (window.location.pathname !== '/login') window.location.href = '/login';
        }
        return Promise.reject(err);
    }
);

// Auth
export const authAPI = {
    register: (data) => api.post('/auth/register', data),
    registerOtp: (data) => api.post('/auth/register-otp', data),
    registerVerify: (data) => api.post('/auth/register-verify', data),
    login: (data) => api.post('/auth/login', data),
    getMe: () => api.get('/auth/me'),
};

// Students
export const studentAPI = {
    getProfile: () => api.get('/students/profile'),
    updateProfile: (data) => api.put('/students/profile', data),
    uploadResume: (formData) => api.post('/students/resume', formData, { headers: { 'Content-Type': 'multipart/form-data' } }),
    uploadProfilePhoto: (formData) => api.post('/students/profile-photo', formData, { headers: { 'Content-Type': 'multipart/form-data' } }),
    analyzeResume: () => api.post('/students/analyze-resume'),
    getRecommendations: (targetRole) => api.post('/students/recommendations', { targetRole }),
    getRecommendationHistory: () => api.get('/students/recommendations/history'),
    updateRecommendationProgress: (data) => api.put('/students/recommendations/progress', data),
    getAll: () => api.get('/students'),
};

// Recruiters
export const recruiterAPI = {
    getProfile: () => api.get('/recruiters/profile'),
    updateProfile: (data) => api.put('/recruiters/profile', data),
    uploadProfilePhoto: (formData) => api.post('/recruiters/profile-photo', formData, { headers: { 'Content-Type': 'multipart/form-data' } }),
    getAll: () => api.get('/recruiters'),
};

// Jobs
export const jobAPI = {
    getAll: () => api.get('/jobs'),
    getById: (id) => api.get(`/jobs/${id}`),
    create: (data) => api.post('/jobs', data),
    createWithAttachment: (formData) => api.post('/jobs', formData, { headers: { 'Content-Type': 'multipart/form-data' } }),
    update: (id, data) => api.put(`/jobs/${id}`, data),
    delete: (id) => api.delete(`/jobs/${id}`),
    getMyJobs: () => api.get('/jobs/recruiter/my-jobs'),
    getAllForAdmin: () => api.get('/admin/jobs'), // Get all jobs for admin
    getAttachment: (jobId) => api.get(`/jobs/${jobId}/attachment`, { responseType: 'blob' }),
};

// Applications
export const applicationAPI = {
    apply: (data) => api.post('/applications', data),
    getMyApplications: () => api.get('/applications/my-applications'),
    getJobApplicants: (jobId) => api.get(`/applications/job/${jobId}`),
    updateStatus: (id, status) => api.put(`/applications/${id}/status`, { status }),
    aiEvaluate: (id) => api.post(`/applications/${id}/ai-evaluate`),
    aiRank: (jobId) => api.post(`/applications/job/${jobId}/ai-rank`),
    getAll: () => api.get('/applications'),
};

// Admin
export const adminAPI = {
    verifyStudent: (id, isVerified) => api.put(`/admin/students/${id}/verify`, { isVerified }),
    getRecruiters: () => api.get('/recruiters'),
    verifyRecruiter: (id, isApprovedByAdmin) => api.put(`/admin/recruiters/${id}/verify`, { isApprovedByAdmin }),
    deleteStudent: (id) => api.delete(`/admin/students/${id}`),
    deleteRecruiter: (id) => api.delete(`/admin/recruiters/${id}`),
    seedDemoData: () => api.post('/admin/seed-demo-data'),
    getPendingJobs: () => api.get('/admin/jobs/pending'),
    updateJobStatus: (id, status) => api.put(`/admin/jobs/${id}/status`, { status }),
    getDrives: () => api.get('/admin/drives'),
    createDrive: (data) => api.post('/admin/drives', data),
    updateDrive: (id, data) => api.put(`/admin/drives/${id}`, data),
    deleteDrive: (id) => api.delete(`/admin/drives/${id}`),
    getAnnouncements: () => api.get('/admin/announcements'),
    createAnnouncement: (data) => api.post('/admin/announcements', data),
    deleteAnnouncement: (id) => api.delete(`/admin/announcements/${id}`),
    getReports: () => api.get('/admin/reports'),
    getDashboard: () => api.get('/admin/dashboard'),
    sendMessage: (userId, subject, message) => api.post(`/admin/message/${userId}`, { subject, message }),
    getAdmins: () => api.get('/admin/admins'),
    promoteToAdmin: (userId) => api.post(`/admin/promote/${userId}`),
    removeAdmin: (adminId) => api.delete(`/admin/admins/${adminId}`),
};

// Notifications
export const notificationAPI = {
    getAll: () => api.get('/notifications'),
    markRead: (id) => api.put(`/notifications/${id}/read`),
    markAllRead: () => api.put('/notifications/read-all'),
    getUnreadCount: () => api.get('/notifications/unread-count'),
};

// Preparation
export const prepAPI = {
    getMockTests: () => api.get('/preparation/mock-tests'),
    getMockTestById: (id) => api.get(`/preparation/mock-tests/${id}`),
    submitMockTest: (id, answers) => api.post(`/preparation/mock-tests/${id}/submit`, { answers }),
    getInterviewTips: () => api.get('/preparation/interview-tips'),
    generateTest: (topic, difficulty = 'Medium', count = 5) => api.post('/preparation/generate-test', { topic, difficulty, count }),
    getInterviewQuestions: (role, count = 5, types = ['technical', 'behavioral', 'hr']) => api.get('/preparation/interview/questions', { params: { role, count, types: types.join(',') } }),
    evaluateInterviewAnswer: (data) => api.post('/preparation/interview/evaluate', data),
};

export default api;
