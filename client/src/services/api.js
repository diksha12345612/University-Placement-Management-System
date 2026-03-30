import axios from 'axios';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5051/api';
export const FILE_BASE_URL = API_URL.replace('/api', '');

const api = axios.create({
    baseURL: API_URL,
    headers: { 'Content-Type': 'application/json' }
});

const isDev = import.meta.env.MODE === 'development';

api.interceptors.request.use((config) => {
    const token = localStorage.getItem('token');
    if (token) config.headers.Authorization = `Bearer ${token}`;
    
    // Don't set Content-Type for blob requests or file uploads
    if (config.responseType === 'blob' || config.headers['Content-Type'] === 'multipart/form-data') {
        delete config.headers['Content-Type'];
    }

    if (isDev) {
        console.log(`[API Request] ${config.method.toUpperCase()} ${config.url}`, config.data || '');
    }
    
    return config;
});

api.interceptors.response.use(
    (res) => {
        if (isDev) {
            console.log(`[API Response] ${res.config.method.toUpperCase()} ${res.config.url}`, res.data);
        }
        return res;
    },
    (err) => {
        const status = err.response?.status;
        const url = err.config?.url;

        if (status === 401) {
            localStorage.removeItem('token');
            localStorage.removeItem('user');
            if (window.location.pathname !== '/login') {
                console.warn(`[API] Unauthorized access to ${url}. Redirecting to login.`);
                window.location.href = '/login';
            }
        }

        // Normalize serverless / gateway error objects
        if (err.response && err.response.data) {
            const data = err.response.data;

            // Handle Vercel/Gateway specific string errors
            if (typeof data === 'string') {
                if (data.includes('A server error has occurred')) {
                    err.response.data = { error: 'Node.js runtime error (Vercel). Check server logs.' };
                } else {
                    err.response.data = { error: data.substring(0, 200) };
                }
            } 
            // Handle error objects
            else if (data.error && typeof data.error === 'object') {
                err.response.data.error = data.error.message || JSON.stringify(data.error);
            }
            // Fallback for missing error field but having message (new standard)
            else if (!data.error && data.message && !data.success) {
                err.response.data.error = data.message;
            }
        }

        if (isDev) {
            console.error(`[API Error] ${err.config?.method?.toUpperCase()} ${url}`, status, err.response?.data || err.message);
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
    forgotPasswordOtp: (data) => api.post('/auth/forgot-password-otp', data),
    resetPassword: (data) => api.post('/auth/reset-password', data),
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
    reEvaluateResume: (id) => api.post(`/applications/${id}/re-evaluate`),
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
    triggerExpiryCheck: () => api.post('/admin/maintenance/trigger-expiry-check'),
    getExpiredItems: () => api.get('/admin/maintenance/expired-items'),
    sendAdminSectionOTP: () => api.post('/admin/admin-section-otp/send'),
    verifyAdminSectionOTP: (otp) => api.post('/admin/admin-section-otp/verify', { otp }),
    checkAdminSectionAccess: () => api.get('/admin/admin-section/check-access'),
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
    generateTest: (topic, difficulty = 'Medium', count = 5, questionTypes = 'mix') => api.post('/preparation/generate-test', { topic, difficulty, count, questionTypes }),
    getInterviewQuestions: (role, count = 5, types = ['technical', 'behavioral', 'hr']) => api.get('/preparation/interview/questions', { params: { role, count, types: types.join(',') } }),
    evaluateInterviewAnswer: (data) => api.post('/preparation/interview/evaluate', data),
};

export default api;
