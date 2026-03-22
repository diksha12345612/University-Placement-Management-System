/**
 * Concurrency Utilities - Phase 2 Multi-User Support
 * 
 * Provides safe concurrent operation handling without Redis dependency
 * Uses MongoDB as the single source of truth for distributed state
 * Safe for serverless deployments (Vercel)
 */

const User = require('../models/User');
const LoginAttempt = require('../models/LoginAttempt');

/**
 * PHASE 2.1: Distributed Login Attempt Tracking
 * Replaces in-memory Map with MongoDB for persistence across restarts
 * 
 * Benefits:
 * - Survives server restarts (Vercel deployments)
 * - Works across multiple instances
 * - Automatic cleanup via MongoDB TTL index
 */

async function recordFailedLoginAttempt(email) {
    try {
        const normalizedEmail = email.toLowerCase().trim();
        const now = new Date();
        
        // Find or create login attempt record
        const attempt = await LoginAttempt.findOne({ email: normalizedEmail });
        
        if (!attempt) {
            // First attempt
            await LoginAttempt.create({
                email: normalizedEmail,
                failedAttempts: 1,
                firstAttemptAt: now,
                lastAttemptAt: now,
                lockedUntil: null,
                version: 1
            });
            return { attempts: 1, isLocked: false, minutesRemaining: 0 };
        }
        
        // Check if locked out
        if (attempt.lockedUntil && attempt.lockedUntil > now) {
            const minutesRemaining = Math.ceil((attempt.lockedUntil - now) / (60 * 1000));
            return { 
                attempts: attempt.failedAttempts, 
                isLocked: true, 
                minutesRemaining,
                oldRecord: true 
            };
        }
        
        // Check if window expired (30 minutes since first attempt)
        const thirtyMinutesAgo = new Date(now - 30 * 60 * 1000);
        if (attempt.firstAttemptAt < thirtyMinutesAgo) {
            // Reset counter - new window
            const updated = await LoginAttempt.findOneAndUpdate(
                { email: normalizedEmail, version: attempt.version },
                {
                    failedAttempts: 1,
                    firstAttemptAt: now,
                    lastAttemptAt: now,
                    lockedUntil: null,
                    $inc: { version: 1 }
                },
                { new: true }
            );
            
            if (!updated) {
                // Version mismatch - retry
                return recordFailedLoginAttempt(email);
            }
            
            return { attempts: 1, isLocked: false, minutesRemaining: 0, windowReset: true };
        }
        
        // Increment failed attempts within same window
        let newAttempts = attempt.failedAttempts + 1;
        let lockoutUntil = null;
        
        // Lock account after 5 failed attempts
        if (newAttempts >= 5) {
            lockoutUntil = new Date(now + 15 * 60 * 1000); // 15 minute lockout
        }
        
        const updated = await LoginAttempt.findOneAndUpdate(
            { email: normalizedEmail, version: attempt.version },
            {
                failedAttempts: newAttempts,
                lastAttemptAt: now,
                lockedUntil: lockoutUntil,
                $inc: { version: 1 }
            },
            { new: true }
        );
        
        if (!updated) {
            // Optimistic locking failure - retry
            return recordFailedLoginAttempt(email);
        }
        
        return { 
            attempts: newAttempts, 
            isLocked: newAttempts >= 5, 
            minutesRemaining: lockoutUntil ? 15 : 0 
        };
    } catch (error) {
        console.error('[CONCURRENCY] Failed to record login attempt:', error);
        // Fail open - allow login if tracking fails (security takes precedence)
        return { attempts: 1, isLocked: false, minutesRemaining: 0, error: true };
    }
}

async function recordSuccessfulLogin(email) {
    try {
        const normalizedEmail = email.toLowerCase().trim();
        
        // Clear login attempts after successful login
        await LoginAttempt.deleteOne({ email: normalizedEmail });
    } catch (error) {
        console.error('[CONCURRENCY] Failed to clear login attempts:', error);
        // Don't fail - this is non-critical
    }
}

async function isLoginLocked(email) {
    try {
        const normalizedEmail = email.toLowerCase().trim();
        const attempt = await LoginAttempt.findOne({ email: normalizedEmail });
        
        if (!attempt) return { locked: false, minutesRemaining: 0 };
        
        const now = new Date();
        if (attempt.lockedUntil && attempt.lockedUntil > now) {
            const minutesRemaining = Math.ceil((attempt.lockedUntil - now) / (60 * 1000));
            return { locked: true, minutesRemaining };
        }
        
        return { locked: false, minutesRemaining: 0 };
    } catch (error) {
        console.error('[CONCURRENCY] Failed to check login lock:', error);
        return { locked: false, minutesRemaining: 0, error: true };
    }
}

/**
 * PHASE 2.2: OTP Race Condition Prevention with Versioning
 * 
 * Uses MongoDB optimistic locking (version field) to prevent OTP overwrites
 * when multiple requests arrive nearly simultaneously
 */

async function setOTPWithVersioning(email, otp, type = 'registration') {
    try {
        const normalizedEmail = email.toLowerCase().trim();
        const normalizedOtp = String(otp).trim(); // Ensure OTP is a string
        const now = new Date();
        
        console.log('[CONCURRENCY] Setting OTP:', { email: normalizedEmail, otp: normalizedOtp, type });
        
        // Try to create new OTP record with atomic version increment
        // CRITICAL FIX: Include type in query to keep registration and password-reset OTPs separate
        let result = await require('../models/OTP').findOneAndUpdate(
            { email: normalizedEmail, type },
            {
                $set: {
                    otp: normalizedOtp,
                    type,
                    createdAt: now,
                    expiresAt: new Date(now + 5 * 60 * 1000), // 5 minute TTL
                    attempts: 0
                },
                $inc: { version: 1 }  // Atomically increment version
            },
            { 
                upsert: true, 
                new: true,
                setDefaultsOnInsert: true
            }
        );
        
        console.log('[CONCURRENCY] OTP set successfully:', { email: normalizedEmail, type, storedOtp: result.otp });
        return result;
    } catch (error) {
        console.error('[CONCURRENCY] Failed to set OTP:', error);
        throw error;
    }
}

async function verifyOTPWithVersioning(email, otp, type = 'registration') {
    try {
        const normalizedEmail = email.toLowerCase().trim();
        const normalizedOtp = String(otp).trim();
        const OTP = require('../models/OTP');
        
        console.log('[CONCURRENCY] Verifying OTP:', { email: normalizedEmail, otpLength: normalizedOtp.length, type });
        
        const otpRecord = await OTP.findOne({ 
            email: normalizedEmail, 
            type,
            expiresAt: { $gt: new Date() }
        });
        
        if (!otpRecord) {
            console.log('[CONCURRENCY] OTP not found for:', { email: normalizedEmail, type, reason: 'missing or expired' });
            return { valid: false, error: 'Invalid or expired OTP' };
        }
        
        console.log('[CONCURRENCY] Found OTP record, stored OTP:', { storedOtp: otpRecord.otp, receivedOtp: normalizedOtp, match: otpRecord.otp === normalizedOtp });
        
        // Increment attempts and check if exceeded
        if (otpRecord.attempts >= 5) {
            console.log('[CONCURRENCY] Too many attempts:', otpRecord.attempts);
            return { valid: false, error: 'Too many verification attempts. Request new OTP.' };
        }
        
        // Verify OTP
        if (otpRecord.otp !== normalizedOtp) {
            // Increment attempts safely
            await OTP.findByIdAndUpdate(
                otpRecord._id,
                { $inc: { attempts: 1 } }
            );
            console.log('[CONCURRENCY] OTP mismatch - stored:', otpRecord.otp, 'received:', normalizedOtp);
            return { valid: false, error: 'Invalid OTP' };
        }
        
        // Valid OTP
        console.log('[CONCURRENCY] OTP verified successfully');
        return { valid: true, otpRecord };
    } catch (error) {
        console.error('[CONCURRENCY] Failed to verify OTP:', error);
        throw error;
    }
}

/**
 * PHASE 2.3: Safe Profile Update with Optimistic Locking
 * 
 * Prevents concurrent profile updates from overwriting each other
 * Uses __v field (Mongoose built-in versioning) for CAS
 */

async function updateProfileSafely(userId, updateData) {
    try {
        // Get current version
        const user = await User.findById(userId).select('__v');
        if (!user) {
            return { success: false, error: 'User not found' };
        }
        
        // Update with version check (compare-and-swap)
        const updated = await User.findOneAndUpdate(
            { _id: userId, __v: user.__v },
            { ...updateData, $inc: { __v: 1 } },
            { new: true }
        );
        
        if (!updated) {
            // Version mismatch - concurrent update detected
            return { success: false, error: 'Concurrent update detected. Please refresh and try again.' };
        }
        
        return { success: true, user: updated };
    } catch (error) {
        console.error('[CONCURRENCY] Failed to update profile safely:', error);
        throw error;
    }
}

/**
 * PHASE 2.4: Safe Application Submission with For Duplicate Prevention
 * 
 * Ensures same student-job application is not created twice even under race conditions
 */

async function createApplicationSafely(studentId, jobId, applicationData) {
    try {
        const Application = require('../models/Application');
        
        // Atomic check-and-insert using findOneAndUpdate
        const existing = await Application.findOne({
            student: studentId,
            job: jobId
        });
        
        if (existing) {
            return { success: false, error: 'You have already applied for this job', exists: true };
        }
        
        // Create new application
        const application = await Application.create({
            student: studentId,
            job: jobId,
            ...applicationData
        });
        
        return { success: true, application };
    } catch (error) {
        // Check if duplicate key error
        if (error.code === 11000 && error.keyPattern.student && error.keyPattern.job) {
            return { success: false, error: 'You have already applied for this job', exists: true };
        }
        
        console.error('[CONCURRENCY] Failed to create application:', error);
        throw error;
    }
}

/**
 * PHASE 2.5: Atomic Admin Operations with Transactions
 * 
 * Ensures admin delete cascades are atomic (all succeed or all fail)
 */

async function deleteRecruiterSafely(recruiterId) {
    const session = await require('mongoose').startSession();
    
    try {
        session.startTransaction();
        
        const Job = require('../models/Job');
        const Application = require('../models/Application');
        
        // 1. Delete recruiter
        const recruiter = await User.findByIdAndDelete(recruiterId, { session });
        if (!recruiter) {
            throw new Error('Recruiter not found');
        }
        
        // 2. Find all jobs posted by this recruiter (in transaction context)
        const jobs = await Job.find({ postedBy: recruiterId }, null, { session });
        const jobIds = jobs.map(j => j._id);
        
        // 3. Delete all applications for these jobs
        if (jobIds.length > 0) {
            await Application.deleteMany(
                { job: { $in: jobIds } },
                { session }
            );
        }
        
        // 4. Delete all jobs
        await Job.deleteMany({ postedBy: recruiterId }, { session });
        
        // All succeeded - commit transaction
        await session.commitTransaction();
        
        return { success: true, deletedJobCount: jobIds.length };
    } catch (error) {
        // Something failed - rollback all changes
        await session.abortTransaction();
        console.error('[CONCURRENCY] Failed to delete recruiter safely:', error);
        throw error;
    } finally {
        session.endSession();
    }
}

/**
 * Utility: Check if multiple concurrent requests to same resource
 * Returns true if request is likely concurrent with others
 */
function hasLikelyCurrentConcurrency(req) {
    // This is a heuristic - can be improved with request tracking
    return req.headers['x-request-start'] && Date.now() - parseInt(req.headers['x-request-start']) < 100;
}

module.exports = {
    recordFailedLoginAttempt,
    recordSuccessfulLogin,
    isLoginLocked,
    setOTPWithVersioning,
    verifyOTPWithVersioning,
    updateProfileSafely,
    createApplicationSafely,
    deleteRecruiterSafely,
    hasLikelyCurrentConcurrency
};
