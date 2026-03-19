import axios from 'axios';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5051/api';    
export const FILE_BASE_URL = API_URL.replace('/api', '');

const api = axios.create({
    baseURL: API_URL,
    headers: { 'Content-Type': 'application/json' }
});

api.interceptors.request.use((config) => {
    const token = localStorage.getItem('token');
    if (token) config.headers.Authorization = Bearer ;
    if (config.responseType === 'blob' || config.headers['Content-Type'] === 'multipart/form-data') {
        delete config.headers['Content-Type'];
    }
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

        // Vercel Serverless Crash Detector
        if (err.response && err.response.data) {
            // Vercel raw HTML 500 error
            if (typeof err.response.data === 'string' && err.response.data.includes('A server error has occurred')) {
                err.response.data = { error: 'Vercel Server Crash (Check Vercel Logs): ' + err.message };
            } 
            // Vercel raw string (exact match)
            else if (typeof err.response.data === 'string') {
                // If it's pure string, we cannot do .error on it, wrap it:
                err.response.data = { error: err.response.data.substring(0, 150) };
            }
            // Objects incorrectly parsed
            else if (typeof err.response.data.error === 'object') {
                err.response.data.error = err.response.data.error.message || JSON.stringify(err.response.data.error);
            }
            // If the exact backend string matches Vercel's generic error
            else if (err.response.data.error === 'A server error has occurred' || err.response.data.error === 'A server error has occurred.') {
                 err.response.data.error = 'Vercel Serverless Error! Node crashed on boot. Please check Vercel Dashboard -> Logs.';
            }
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

export const studentAPI = { getProfile: () => api.get('/students/profile'), updateProfile: (data) => api.put('/students/profile', data), uploadResume: (formData) => api.post('/students/resume', formData, { headers: { 'Content-Type': 'multipart/form-data' } }), uploadProfilePhoto: (formData) => api.post('/students/profile-photo', formData, { headers: { 'Content-Type': 'multipart/form-data' } }), analyzeResume: () => api.post('/students/analyze-resume'), getRecommendations: (targetRole) => api.post('/students/recommendations', { targetRole }), getRecommendationHistory: () => api.get('/students/recommendations/history'), updateRecommendationProgress: (data) => api.put('/students/recommendations/progress', data), getAll: () => api.get('/students') };

export const recruiterAPI = { getProfile: () => api.get('/recruiters/profile'), updateProfile: (data) => api.put('/recruiters/profile', data), uploadProfilePhoto: (formData) => api.post('/recruiters/profile-photo', formData, { headers: { 'Content-Type': 'multipart/form-data' } }), getAll: () => api.get('/recruiters') };

export const jobAPI = { getAll: () => api.get('/jobs'), getById: (id) => api.get(/jobs/), create: (data) => api.post('/jobs', data), createWithAttachment: (formData) => api.post('/jobs', formData, { headers: { 'Content-Type': 'multipart/form-data' } }), update: (id, data) => api.put(/jobs/, data), delete: (id) => api.delete(/jobs/), getMyJobs: () => api.get('/jobs/recruiter/my-jobs'), getAllForAdmin: () => api.get('/admin/jobs'), getAttachment: (jobId) => api.get(/jobs//attachment, { responseType: 'blob' }) };

export const applicationAPI = { apply: (data) => api.post('/applications', data), getMyApplications: () => api.get('/applications/my-applications'), getJobApplicants: (jobId) => api.get(/applications/job/), updateStatus: (id, status) => api.put(/applications//status, { status }), aiEvaluate: (id) => api.post(/applications//ai-evaluate), aiRank: (jobId) => api.post(/applications/job//ai-rank), getAll: () => api.get('/applications') };

export const adminAPI = { verifyStudent: (id, isVerified) => api.put(/admin/students//verify, { isVerified }), getRecruiters: () => api.get('/recruiters'), verifyRecruiter: (id, isApprovedByAdmin) => api.put(/admin/recruiters//verify, { isApprovedByAdmin }), deleteStudent: (id) => api.delete(/admin/students/), deleteRecruiter: (id) => api.delete(/admin/recruiters/), seedDemoData: () => api.post('/admin/seed-demo-data'), getPendingJobs: () => api.get('/admin/jobs/pending'), updateJobStatus: (id, status) => api.put(/admin/jobs//status, { status }), getDrives: () => api.get('/admin/drives'), createDrive: (data) => api.post('/admin/drives', data), updateDrive: (id, data) => api.put(/admin/drives/, data), deleteDrive: (id) => api.delete(/admin/drives/), getAnnouncements: () => api.get('/admin/announcements'), createAnnouncement: (data) => api.post('/admin/announcements', data), deleteAnnouncement: (id) => api.delete(/admin/announcements/), getReports: () => api.get('/admin/reports'), getDashboard: () => api.get('/admin/dashboard'), sendMessage: (userId, subject, message) => api.post(/admin/message/, { subject, message }), getAdmins: () => api.get('/admin/admins'), promoteToAdmin: (userId) => api.post(/admin/promote/), removeAdmin: (adminId) => api.delete(/admin/admins/), triggerExpiryCheck: () => api.post('/admin/maintenance/trigger-expiry-check'), getExpiredItems: () => api.get('/admin/maintenance/expired-items') };

export const notificationAPI = { getAll: () => api.get('/notifications'), markRead: (id) => api.put(/notifications//read), markAllRead: () => api.put('/notifications/read-all'), getUnreadCount: () => api.get('/notifications/unread-count') };

export const prepAPI = { getMockTests: () => api.get('/preparation/mock-tests'), getMockTestById: (id) => api.get(/preparation/mock-tests/), submitMockTest: (id, answers) => api.post(/preparation/mock-tests//submit, { answers }), getInterviewTips: () => api.get('/preparation/interview-tips'), generateTest: (topic, difficulty = 'Medium', count = 5) => api.post('/preparation/generate-test', { topic, difficulty, count }), getInterviewQuestions: (role, count = 5, types = ['technical', 'behavioral', 'hr']) => api.get('/preparation/interview/questions', { params: { role, count, types: types.join(',') } }), evaluateInterviewAnswer: (data) => api.post('/preparation/interview/evaluate', data) };

export default api;
