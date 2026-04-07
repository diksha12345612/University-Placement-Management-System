const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const userSchema = new mongoose.Schema({
    name: { type: String, required: true, trim: true },
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    password: { type: String, required: true, minlength: 6 },
    role: { type: String, enum: ['student', 'recruiter', 'admin'], required: true },
    isVerified: { type: Boolean, default: false },
    isApprovedByAdmin: { type: Boolean, default: false }, // For Recruiter approval
    avatar: { type: String, default: '' },
    // Student specific fields
    studentProfile: {
        rollNumber: String,
        department: String,
        batch: String,
        cgpa: Number,
        phoneCountryCode: { type: String, default: '+91' },
        phone: String,
        address: String,
        dob: Date,
        gender: String,
        skills: [String],
        tenthPercentage: Number,
        twelfthPercentage: Number,
        resumeUrl: String,
        resumeBase64: String, // Added for Vercel Serverless storage
        resumeContentType: String,
        profileImage: String, // Profile photo stored as Base64
        profileImageContentType: String, // MIME type of profile image
        linkedIn: String,
        github: String,
        portfolio: String,
        isPlaced: { type: Boolean, default: false },
        placedAt: String,
        parsedResumeData: { type: mongoose.Schema.Types.Mixed }, // Structured data from ATS parsing API
        aiResumeAnalysis: {
            // Aggregate score
            resumeScore: { type: Number, default: 0 },
            // Per-category scores (new)
            technicalSkillsScore: { type: Number, default: 0 },
            projectsScore: { type: Number, default: 0 },
            experienceScore: { type: Number, default: 0 },
            atsScore: { type: Number, default: 0 },
            clarityScore: { type: Number, default: 0 },
            // Detailed feedback
            strengths: [String],
            weaknesses: [String],
            missingSkills: [String],
            suggestions: [String],
            // Per-criteria breakdown with grade + notes per category
            criteriaBreakdown: { type: Object, default: {} },
            // Legacy fields (kept for compatibility)
            score: { type: Number, default: 0 },
            summary: String,
            missingKeywords: [String],
            improvements: [String],
            keywords: [String],
            atsCompatibility: String,
            lastAnalyzed: Date
        },
        analyticsData: {
            careerGoals: {
                targetRoles: [String], // e.g., ["Frontend Engineer", "Data Scientist"]
                preferredLocations: [String], // e.g., ["Bangalore", "Remote"]
                expectedSalary: Number,
                preferredWorkMode: { type: String, enum: ['Remote', 'On-site', 'Hybrid', 'Any'], default: 'Any' }
            },
            performanceMetrics: {
                overallReadinessScore: { type: Number, default: 0 }, // Calculated 0-100 score
                topicProficiencies: [{
                    topic: String, // e.g., 'React', 'System Design', 'Algorithms'
                    score: Number, // Average score 0-100
                    testsTaken: { type: Number, default: 0 }
                }],
                mockInterviewsAverage: { type: Number, default: 0 },
                totalMockInterviews: { type: Number, default: 0 }
            },
            behavioralData: {
                jobsAppliedCount: { type: Number, default: 0 },
                shortlistCount: { type: Number, default: 0 },
                applicationSuccessRate: { type: Number, default: 0 }, // Derived metric: shortlists / jobsAppliedCount
                lastActiveDate: Date
            }
        },
        aiRecommendations: {
            targetRole: String,
            overallAssessment: String,
            skillGapAnalysis: [String],
            prioritySkills: [String],
            roadmap: [{
                phase: String,
                title: String,
                duration: String,
                focusArea: String,
                topics: [{
                    name: String,
                    completed: { type: Boolean, default: false }
                }],
                tasks: [{
                    name: String,
                    completed: { type: Boolean, default: false }
                }],
                strategy: String
            }],
            recommendedProjects: [String],
            recommendedResources: [String],
            interviewPreparationTips: [String],
            suggestedCompanies: [String],

            // Legacy / backward-compatible aliases
            recommendedTopics: [String],
            skillsToImprove: [String],
            studyPlan: [String],

            lastUpdated: Date
        }
    },
    // Recruiter specific fields
    recruiterProfile: {
        company: String,
        designation: String,
        phoneCountryCode: { type: String, default: '+91' },
        phone: String,
        companyWebsite: String,
        companyDescription: String,
        companyLogo: String,
        industry: String,
        profileImage: String, // Profile photo stored as Base64
        profileImageContentType: String // MIME type of profile image
    }
}, { timestamps: true });

userSchema.pre('save', async function () {
    if (!this.isModified('password')) return;
    const salt = await bcrypt.genSalt(12);
    this.password = await bcrypt.hash(this.password, salt);
});

userSchema.methods.comparePassword = async function (candidatePassword) {
    return bcrypt.compare(candidatePassword, this.password);
};

userSchema.methods.toJSON = function () {
    const obj = this.toObject();
    delete obj.password;
    return obj;
};

module.exports = mongoose.model('User', userSchema);
