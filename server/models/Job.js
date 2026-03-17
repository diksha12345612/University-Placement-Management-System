const mongoose = require('mongoose');

const jobSchema = new mongoose.Schema({
    title: { type: String, required: true, trim: true },
    company: { type: String, required: true, trim: true },
    description: { type: String, required: true },
    location: { type: String, required: true },
    type: { type: String, enum: ['Full-time', 'Part-time', 'Internship', 'Contract'], default: 'Full-time' },
    salary: { type: String },
    openings: { type: Number, default: 1 },
    deadline: { type: Date, required: true },
    eligibility: {
        minCGPA: { type: Number, default: 0 },
        branches: [String],
        skills: [String],
        batch: String
    },
    requirements: [String],
    responsibilities: [String],
    perks: [String],
    // Job attachment (PDF, DOCX, etc.)
    attachmentFile: String, // Base64 encoded file
    attachmentFileName: String,
    attachmentContentType: String,
    postedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    status: { type: String, enum: ['pending', 'approved', 'rejected'], default: 'pending' },
    isActive: { type: Boolean, default: true }
}, { timestamps: true });

module.exports = mongoose.model('Job', jobSchema);
