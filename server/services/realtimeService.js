/**
 * Real-Time Dashboard Service - PHASE 3 & 4
 * 
 * Provides real-time updates for admin and user dashboards
 * Uses polling approach (safe, simple, reliable) instead of WebSockets
 * 
 * Benefits:
 * - No additional infrastructure (WebSocket servers)
 * - Works on serverless platforms (Vercel)
 * - Survives connection drops
 * - Simple to debug and monitor
 * - Works behind proxies and firewalls
 * 
 * Client polls every 5-10 seconds for updated dashboard data
 */

const User = require('../models/User');
const Job = require('../models/Job');
const Application = require('../models/Application');
const PlacementDrive = require('../models/PlacementDrive');

/**
 * Get admin dashboard summary for real-time updates
 * Returns counts that change frequently and would benefit from live refresh
 */
async function getAdminDashboardSummary() {
    try {
        const [
            totalStudents,
            totalRecruiters,
            pendingRecruiters,
            totalJobs,
            activeJobs,
            totalApplications,
            pendingApplications,
            totalPlacementDrives,
            upcomingDrives
        ] = await Promise.all([
            // Student counts
            User.countDocuments({ role: 'student', isVerified: true }),
            
            // Recruiter counts
            User.countDocuments({ role: 'recruiter', isVerified: true }),
            User.countDocuments({ role: 'recruiter', isVerified: true, isApprovedByAdmin: false }),
            
            // Job counts
            Job.countDocuments({ isActive: true }),
            Job.countDocuments({ isActive: true, expiresAt: { $gt: new Date() } }),
            
            // Application counts
            Application.countDocuments({}),
            Application.countDocuments({ status: 'pending' }),
            
            // Placement drive counts
            PlacementDrive.countDocuments({}),
            PlacementDrive.countDocuments({ date: { $gte: new Date() } })
        ]);

        return {
            students: {
                total: totalStudents
            },
            recruiters: {
                total: totalRecruiters,
                pendingApproval: pendingRecruiters
            },
            jobs: {
                total: totalJobs,
                active: activeJobs
            },
            applications: {
                total: totalApplications,
                pending: pendingApplications
            },
            placementDrives: {
                total: totalPlacementDrives,
                upcoming: upcomingDrives
            },
            timestamp: new Date(),
            version: 1
        };
    } catch (error) {
        console.error('[REAL-TIME] Failed to get admin dashboard summary:', error);
        return null;
    }
}

/**
 * Get student dashboard summary for real-time updates
 */
async function getStudentDashboardSummary(studentId) {
    try {
        const [
            applications,
            pendingApplications,
            rejectedApplications,
            selectedApplications,
            recentJobs,
            profileCompletion
        ] = await Promise.all([
            Application.countDocuments({ student: studentId }),
            Application.countDocuments({ student: studentId, status: 'pending' }),
            Application.countDocuments({ student: studentId, status: 'rejected' }),
            Application.countDocuments({ student: studentId, status: 'selected' }),
            Job.countDocuments({ isActive: true, expiresAt: { $gt: new Date() } }),
            getProfileCompletion(studentId)
        ]);

        return {
            applications: {
                total: applications,
                pending: pendingApplications,
                rejected: rejectedApplications,
                selected: selectedApplications
            },
            availableJobs: recentJobs,
            profileCompletion,
            timestamp: new Date(),
            version: 1
        };
    } catch (error) {
        console.error('[REAL-TIME] Failed to get student dashboard summary:', error);
        return null;
    }
}

/**
 * Get recruiter dashboard summary for real-time updates
 */
async function getRecruiterDashboardSummary(recruiterId) {
    try {
        const [
            jobs,
            activeJobs,
            totalApplications,
            pendingApplications,
            recentApplications
        ] = await Promise.all([
            Job.countDocuments({ postedBy: recruiterId }),
            Job.countDocuments({ postedBy: recruiterId, isActive: true, expiresAt: { $gt: new Date() } }),
            Application.countDocuments({ 'job': { $in: await Job.find({ postedBy: recruiterId }).select('_id').then(j => j.map(x => x._id)) } }),
            Application.countDocuments({ 'job': { $in: await Job.find({ postedBy: recruiterId }).select('_id').then(j => j.map(x => x._id)), status: 'pending' } }),
            getRecentApplications(recruiterId, 5)
        ]);

        return {
            jobs: {
                total: jobs,
                active: activeJobs
            },
            applications: {
                total: totalApplications,
                pending: pendingApplications
            },
            recentApplications,
            timestamp: new Date(),
            version: 1
        };
    } catch (error) {
        console.error('[REAL-TIME] Failed to get recruiter dashboard summary:', error);
        return null;
    }
}

/**
 * Helper: Calculate profile completion percentage
 */
async function getProfileCompletion(studentId) {
    try {
        const user = await User.findById(studentId).select('studentProfile');
        if (!user) return 0;

        const profile = user.studentProfile || {};
        const requiredFields = ['rollNumber', 'department', 'batch', 'cgpa', 'phone', 'skills', 'resumeUrl'];
        const completedFields = requiredFields.filter(field => profile[field] && profile[field] !== '').length;
        
        return Math.round((completedFields / requiredFields.length) * 100);
    } catch (error) {
        console.error('[REAL-TIME] Failed to calculate profile completion:', error);
        return 0;
    }
}

/**
 * Helper: Get recent applications for a recruiter
 */
async function getRecentApplications(recruiterId, limit = 5) {
    try {
        const jobs = await Job.find({ postedBy: recruiterId }).select('_id');
        const jobIds = jobs.map(j => j._id);
        
        if (jobIds.length === 0) return [];
        
        const applications = await Application.find({ job: { $in: jobIds } })
            .sort({ createdAt: -1 })
            .limit(limit)
            .populate('student', 'name email')
            .populate('job', 'title');
        
        return applications.map(app => ({
            id: app._id,
            studentName: app.student?.name || 'Unknown',
            jobTitle: app.job?.title || 'Unknown Job',
            status: app.status,
            submittedAt: app.createdAt
        }));
    } catch (error) {
        console.error('[REAL-TIME] Failed to get recent applications:', error);
        return [];
    }
}

/**
 * Notification service for real-time events
 * Emits events that clients can poll for or receive via SSE
 */
class RealtimeEventBus {
    constructor() {
        this.listeners = new Map();
        this.eventQueue = [];
        this.maxQueueSize = 100;
    }

    /**
     * Subscribe to events of a specific type
     * Returns an async iterator for polling
     */
    subscribe(eventType, userId = null) {
        const key = userId ? `${eventType}:${userId}` : eventType;
        
        if (!this.listeners.has(key)) {
            this.listeners.set(key, []);
        }
        
        const listener = {
            id: Math.random().toString(36),
            events: [],
            lastPoll: Date.now()
        };
        
        this.listeners.get(key).push(listener);
        
        return {
            id: listener.id,
            key,
            getEvents: () => {
                const events = listener.events;
                listener.events = [];
                listener.lastPoll = Date.now();
                return events;
            },
            unsubscribe: () => {
                const listeners = this.listeners.get(key);
                if (listeners) {
                    const index = listeners.findIndex(l => l.id === listener.id);
                    if (index > -1) listeners.splice(index, 1);
                }
            }
        };
    }

    /**
     * Emit an event to all interested listeners
     */
    emit(eventType, data, userId = null) {
        const key = userId ? `${eventType}:${userId}` : eventType;
        const event = {
            type: eventType,
            data,
            timestamp: new Date(),
            id: Math.random().toString(36)
        };
        
        // Add to global queue
        this.eventQueue.push(event);
        if (this.eventQueue.length > this.maxQueueSize) {
            this.eventQueue.shift();
        }
        
        // Notify all listeners for this event type
        if (this.listeners.has(key)) {
            this.listeners.get(key).forEach(listener => {
                listener.events.push(event);
            });
        }
    }

    /**
     * Get all events since a certain timestamp
     */
    getEventsSince(timestamp, eventType = null) {
        return this.eventQueue.filter(e => {
            const eventMatches = !eventType || e.type === eventType;
            const timeMatches = e.timestamp > timestamp;
            return eventMatches && timeMatches;
        });
    }
}

// Singleton event bus
const eventBus = new RealtimeEventBus();

/**
 * Events that should trigger real-time updates
 */
const REALTIME_EVENTS = {
    // User events
    USER_REGISTERED: 'user.registered',
    USER_VERIFIED: 'user.verified',
    RECRUITER_APPROVED: 'recruiter.approved',
    RECRUITER_REVOKED: 'recruiter.revoked',
    
    // Job events
    JOB_POSTED: 'job.posted',
    JOB_UPDATED: 'job.updated',
    JOB_CLOSED: 'job.closed',
    
    // Application events
    APPLICATION_SUBMITTED: 'application.submitted',
    APPLICATION_REVIEWED: 'application.reviewed',
    APPLICATION_SELECTED: 'application.selected',
    APPLICATION_REJECTED: 'application.rejected',
    
    // Drive events
    DRIVE_SCHEDULED: 'drive.scheduled',
    DRIVE_STARTED: 'drive.started',
    DRIVE_COMPLETED: 'drive.completed'
};

module.exports = {
    getAdminDashboardSummary,
    getStudentDashboardSummary,
    getRecruiterDashboardSummary,
    getProfileCompletion,
    getRecentApplications,
    eventBus,
    REALTIME_EVENTS
};
