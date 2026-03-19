import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import { AuthProvider } from './context/AuthContext';
import ErrorBoundary from './components/ErrorBoundary';
import ProtectedRoute from './components/ProtectedRoute';

// Public Pages
import Landing from './pages/Landing';
import Login from './pages/Login';
import Register from './pages/Register';
import ForgotPassword from './pages/ForgotPassword';

// Student Pages
import StudentDashboard from './pages/student/Dashboard';
import StudentProfile from './pages/student/Profile';
import StudentJobs from './pages/student/Jobs';
import StudentApplications from './pages/student/Applications';
import Preparation from './pages/student/Preparation';
import MockTest from './pages/student/MockTest';
import InterviewTips from './pages/student/InterviewTips';

// Recruiter Pages
import RecruiterDashboard from './pages/recruiter/Dashboard';
import RecruiterProfile from './pages/recruiter/Profile';
import PostJob from './pages/recruiter/PostJob';
import MyJobs from './pages/recruiter/MyJobs';

// Admin Pages
import AdminDashboard from './pages/admin/Dashboard';
import AdminStudents from './pages/admin/Students';
import AdminStudentDetail from './pages/admin/StudentDetail';
import AdminRecruiters from './pages/admin/Recruiters';
import AdminRecruiterDetail from './pages/admin/RecruiterDetail';
import AdminJobs from './pages/admin/Jobs';
import AdminDrives from './pages/admin/Drives';
import AdminAnnouncements from './pages/admin/Announcements';
import AdminReports from './pages/admin/Reports';
import AdminProfile from './pages/admin/Profile';
import AdminManagement from './pages/admin/Admins';
import AdminATSPanel from './components/AdminATSPanel';

// Shared
import Notifications from './pages/Notifications';

function App() {
  return (
    <ErrorBoundary>
      <Router>
        <AuthProvider>
          <Toaster position="top-right" toastOptions={{
            style: { background: '#1e1e2e', color: '#f0f0f5', border: '1px solid rgba(255,255,255,0.1)' },
            success: { iconTheme: { primary: '#10b981', secondary: '#f0f0f5' } },
            error: { iconTheme: { primary: '#ef4444', secondary: '#f0f0f5' } }
          }} />
          <Routes>
            {/* Public Routes */}
            <Route path="/" element={<Landing />} />
            <Route path="/login" element={<Login />} />
            <Route path="/register" element={<Register />} />
            <Route path="/forgot-password" element={<ForgotPassword />} />

            {/* Student Routes */}
            <Route path="/student/dashboard" element={<ProtectedRoute roles={['student']}><StudentDashboard /></ProtectedRoute>} />
            <Route path="/student/profile" element={<ProtectedRoute roles={['student']}><StudentProfile /></ProtectedRoute>} />
            <Route path="/student/jobs" element={<ProtectedRoute roles={['student']}><StudentJobs /></ProtectedRoute>} />
            <Route path="/student/applications" element={<ProtectedRoute roles={['student']}><StudentApplications /></ProtectedRoute>} />
            <Route path="/student/preparation" element={<ProtectedRoute roles={['student']}><Preparation /></ProtectedRoute>} />
            <Route path="/student/preparation/mock-test" element={<ProtectedRoute roles={['student']}><MockTest /></ProtectedRoute>} />
            <Route path="/student/preparation/tips" element={<ProtectedRoute roles={['student']}><InterviewTips /></ProtectedRoute>} />
            <Route path="/student/notifications" element={<ProtectedRoute roles={['student']}><Notifications /></ProtectedRoute>} />

            {/* Recruiter Routes */}
            <Route path="/recruiter/dashboard" element={<ProtectedRoute roles={['recruiter']}><RecruiterDashboard /></ProtectedRoute>} />
            <Route path="/recruiter/profile" element={<ProtectedRoute roles={['recruiter']}><RecruiterProfile /></ProtectedRoute>} />
            <Route path="/recruiter/post-job" element={<ProtectedRoute roles={['recruiter']}><PostJob /></ProtectedRoute>} />
            <Route path="/recruiter/my-jobs" element={<ProtectedRoute roles={['recruiter']}><MyJobs /></ProtectedRoute>} />
            <Route path="/recruiter/notifications" element={<ProtectedRoute roles={['recruiter']}><Notifications /></ProtectedRoute>} />

            {/* Admin Routes */}
            <Route path="/admin/dashboard" element={<ProtectedRoute roles={['admin']}><AdminDashboard /></ProtectedRoute>} />
            <Route path="/admin/students" element={<ProtectedRoute roles={['admin']}><AdminStudents /></ProtectedRoute>} />
            <Route path="/admin/students/:id" element={<ProtectedRoute roles={['admin']}><AdminStudentDetail /></ProtectedRoute>} />
            <Route path="/admin/recruiters" element={<ProtectedRoute roles={['admin']}><AdminRecruiters /></ProtectedRoute>} />
            <Route path="/admin/recruiters/:id" element={<ProtectedRoute roles={['admin']}><AdminRecruiterDetail /></ProtectedRoute>} />
            <Route path="/admin/jobs" element={<ProtectedRoute roles={['admin']}><AdminJobs /></ProtectedRoute>} />
            <Route path="/admin/drives" element={<ProtectedRoute roles={['admin']}><AdminDrives /></ProtectedRoute>} />
            <Route path="/admin/announcements" element={<ProtectedRoute roles={['admin']}><AdminAnnouncements /></ProtectedRoute>} />
            <Route path="/admin/admins" element={<ProtectedRoute roles={['admin']}><AdminManagement /></ProtectedRoute>} />
            <Route path="/admin/reports" element={<ProtectedRoute roles={['admin']}><AdminReports /></ProtectedRoute>} />
            <Route path="/admin/profile" element={<ProtectedRoute roles={['admin']}><AdminProfile /></ProtectedRoute>} />
            <Route path="/admin/ats-settings" element={<ProtectedRoute roles={['admin']}><AdminATSPanel /></ProtectedRoute>} />
            <Route path="/admin/notifications" element={<ProtectedRoute roles={['admin']}><Notifications /></ProtectedRoute>} />

            {/* Catch-all */}
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </AuthProvider>
      </Router>
    </ErrorBoundary>
  );
}

export default App;
