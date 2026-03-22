/**
 * Joi Validation Schemas for all API Endpoints
 * Ensures type safety, prevents injection attacks, and enforces data integrity
 */

const Joi = require('joi');

// Common reusable schemas
const schemas = {
  // Email validation
  email: Joi.string()
    .email({ tlds: { allow: false } })
    .lowercase()
    .trim()
    .required()
    .max(255)
    .messages({
      'string.email': 'Please provide a valid email address',
      'string.max': 'Email must be less than 255 characters',
      'any.required': 'Email is required'
    }),

  // Password validation (min 6 chars, no special requirements to not break existing users)
  password: Joi.string()
    .min(6)
    .max(128)
    .required()
    .messages({
      'string.min': 'Password must be at least 6 characters',
      'string.max': 'Password must not exceed 128 characters',
      'any.required': 'Password is required'
    }),

  // Name validation (no HTML tags)
  name: Joi.string()
    .trim()
    .min(2)
    .max(100)
    .required()
    .pattern(/^[a-zA-Z\s'-]+$/)
    .messages({
      'string.pattern.base': 'Name can only contain letters, spaces, hyphens, and apostrophes',
      'string.min': 'Name must be at least 2 characters',
      'string.max': 'Name must not exceed 100 characters',
      'any.required': 'Name is required'
    }),

  // Phone validation (10 digits, numeric only)
  phone: Joi.string()
    .pattern(/^\d{10}$/)
    .required()
    .messages({
      'string.pattern.base': 'Phone number must be exactly 10 digits',
      'any.required': 'Phone number is required'
    }),

  // Roll number validation
  rollNumber: Joi.string()
    .trim()
    .max(20)
    .pattern(/^[a-zA-Z0-9-]+$/)
    .messages({
      'string.pattern.base': 'Roll number contains invalid characters'
    }),

  // URL validation
  url: Joi.string()
    .uri()
    .max(500)
    .messages({
      'string.uri': 'Please provide a valid URL',
      'string.max': 'URL must not exceed 500 characters'
    }),

  // CGPA validation (0-10)
  cgpa: Joi.number()
    .min(0)
    .max(10)
    .precision(2)
    .messages({
      'number.min': 'CGPA must be at least 0',
      'number.max': 'CGPA must not exceed 10'
    }),

  // Percentage validation (0-100)
  percentage: Joi.number()
    .min(0)
    .max(100)
    .precision(2)
    .messages({
      'number.min': 'Percentage must be at least 0',
      'number.max': 'Percentage must not exceed 100'
    }),

  // OTP validation (6 digits)
  otp: Joi.string()
    .length(6)
    .pattern(/^\d{6}$/)
    .required()
    .messages({
      'string.length': 'OTP must be exactly 6 digits',
      'string.pattern.base': 'OTP must contain only digits',
      'any.required': 'OTP is required'
    }),

  // Role validation
  role: Joi.string()
    .valid('student', 'recruiter', 'admin')
    .required()
    .messages({
      'any.only': 'Role must be student, recruiter, or admin',
      'any.required': 'Role is required'
    }),

  // MongoDB ObjectId validation
  objectId: Joi.string()
    .pattern(/^[0-9a-fA-F]{24}$/)
    .messages({
      'string.pattern.base': 'Invalid ID format'
    }),

  // Text field (max 5000 chars, no dangerous patterns)
  textField: Joi.string()
    .max(5000)
    .trim()
    .messages({
      'string.max': 'Text must not exceed 5000 characters'
    }),

  // Textarea field (max 20000 chars)
  longText: Joi.string()
    .max(20000)
    .trim()
    .messages({
      'string.max': 'Text must not exceed 20000 characters'
    })
};

// ============================================
// AUTH ENDPOINTS
// ============================================

const authSchemas = {
  // POST /api/auth/register-otp
  registerOtp: Joi.object({
    name: schemas.name,
    email: schemas.email,
    password: schemas.password,
    role: schemas.role
  }).unknown(false),

  // POST /api/auth/register-verify
  registerVerify: Joi.object({
    name: schemas.name,
    email: schemas.email,
    password: schemas.password,
    role: schemas.role,
    otp: schemas.otp
  }).unknown(false),

  // POST /api/auth/login
  login: Joi.object({
    email: schemas.email,
    password: schemas.password
  }).unknown(false),

  // POST /api/auth/refresh-token
  refreshToken: Joi.object({
    token: Joi.string().required()
  }).unknown(false),

  // POST /api/auth/forgot-password
  forgotPassword: Joi.object({
    email: schemas.email
  }).unknown(false),

  // POST /api/auth/reset-password
  resetPassword: Joi.object({
    otp: schemas.otp,
    email: schemas.email,
    newPassword: schemas.password
  }).unknown(false)
};

// ============================================
// STUDENT PROFILE ENDPOINTS
// ============================================

const studentSchemas = {
  // PUT /api/students/profile/update
  updateProfile: Joi.object({
    name: Joi.string().trim().min(2).max(100),
    rollNumber: schemas.rollNumber,
    department: Joi.string().trim().max(50),
    batch: Joi.string().trim().max(10),
    phone: schemas.phone,
    gender: Joi.string().valid('Male', 'Female', 'Other'),
    dob: Joi.date().iso().max('now'),
    cgpa: schemas.cgpa,
    tenthPercentage: schemas.percentage,
    twelfthPercentage: schemas.percentage,
    skills: Joi.array().items(Joi.string().trim().max(100)).max(20),
    address: Joi.string().trim().max(200),
    linkedIn: schemas.url,
    github: schemas.url,
    portfolio: schemas.url
  }).unknown(false).min(1),

  // POST /api/students/applications
  submitApplication: Joi.object({
    jobId: schemas.objectId.required(),
    coverLetter: schemas.longText
  }).unknown(false)
};

// ============================================
// RECRUITER PROFILE ENDPOINTS
// ============================================

const recruiterSchemas = {
  // PUT /api/recruiters/profile/update
  updateProfile: Joi.object({
    company: Joi.string().trim().min(2).max(100),
    designation: Joi.string().trim().max(100),
    phone: schemas.phone,
    companyWebsite: schemas.url,
    companyDescription: schemas.longText,
    industry: Joi.string().trim().max(50)
  }).unknown(false).min(1)
};

// ============================================
// JOB POSTING ENDPOINTS
// ============================================

const jobSchemas = {
  // POST /api/jobs/create
  createJob: Joi.object({
    title: Joi.string().trim().min(5).max(100).required(),
    description: schemas.longText.required(),
    location: Joi.string().trim().max(100).required(),
    salary: Joi.string().trim().max(50),
    jobType: Joi.string().valid('Full-time', 'Part-time', 'Contract', 'Internship').required(),
    skills: Joi.array().items(Joi.string().trim().max(100)).min(1).max(20).required(),
    experience: Joi.number().min(0).max(60),
    deadline: Joi.date().iso().min('now').required(),
    ctc: Joi.string().trim().max(50)
  }).unknown(false),

  // PUT /api/jobs/:id/update
  updateJob: Joi.object({
    title: Joi.string().trim().min(5).max(100),
    description: schemas.longText,
    location: Joi.string().trim().max(100),
    salary: Joi.string().trim().max(50),
    jobType: Joi.string().valid('Full-time', 'Part-time', 'Contract', 'Internship'),
    skills: Joi.array().items(Joi.string().trim().max(100)).max(20),
    experience: Joi.number().min(0).max(60),
    deadline: Joi.date().iso().min('now'),
    ctc: Joi.string().trim().max(50)
  }).unknown(false).min(1)
};

// ============================================
// MOCK TEST ENDPOINTS
// ============================================

const mockTestSchemas = {
  // POST /api/preparation/mock-tests - Create test
  createMockTest: Joi.object({
    title: Joi.string().trim().min(5).max(200).required(),
    category: Joi.string().trim().max(100).required(),
    totalQuestions: Joi.number().min(1).max(200).required(),
    duration: Joi.number().min(1).max(480).required(), // in minutes, max 8 hours
    difficulty: Joi.string().valid('Easy', 'Medium', 'Hard').required(),
    questions: Joi.array().items(
      Joi.object({
        type: Joi.string().valid('mcq', 'coding', 'subjective').required(),
        question: Joi.string().trim().max(5000).required(),
        options: Joi.array().items(Joi.string().trim().max(500)),
        correctAnswer: Joi.string().max(5000),
        points: Joi.number().min(1).max(100)
      })
    ).min(1).required()
  }).unknown(false),

  // POST /api/preparation/mock-tests/:id/submit - Submit test
  submitMockTest: Joi.object({
    answers: Joi.object().required(),
    timeSpent: Joi.number().min(0),
    submittedAt: Joi.date().iso()
  }).unknown(false)
};

// ============================================
// ANNOUNCEMENT ENDPOINTS
// ============================================

const announcementSchemas = {
  // POST /api/admin/announcements
  createAnnouncement: Joi.object({
    title: Joi.string().trim().min(5).max(200).required(),
    content: schemas.longText.required(),
    priority: Joi.string().valid('low', 'medium', 'high').required(),
    targetAudience: Joi.string().valid('student', 'recruiter', 'all').required()
  }).unknown(false),

  // PUT /api/admin/announcements/:id
  updateAnnouncement: Joi.object({
    title: Joi.string().trim().min(5).max(200),
    content: schemas.longText,
    priority: Joi.string().valid('low', 'medium', 'high'),
    targetAudience: Joi.string().valid('student', 'recruiter', 'all')
  }).unknown(false).min(1)
};

// ============================================
// PAGINATION & QUERY PARAMETERS
// ============================================

const querySchemas = {
  pagination: Joi.object({
    page: Joi.number().integer().min(1).default(1),
    limit: Joi.number().integer().min(1).max(100).default(10),
    sort: Joi.string().pattern(/^-?[a-zA-Z_][a-zA-Z0-9_]*$/),
    search: Joi.string().trim().max(200)
  }).unknown(true) // Allow other query params
};

// ============================================
// VALIDATION MIDDLEWARE FUNCTION
// ============================================

/**
 * Create validation middleware for a given schema
 * @param {Joi.Schema} schema - Joi schema to validate against
 * @param {string} source - 'body', 'query', or 'params'
 * @returns {function} Express middleware
 */
const validateSchema = (schema, source = 'body') => {
  return (req, res, next) => {
    const dataToValidate = req[source];
    const { error, value } = schema.validate(dataToValidate, {
      abortEarly: false,
      stripUnknown: true,
      convert: true
    });

    if (error) {
      // Format validation errors
      const errors = error.details.map(detail => ({
        field: detail.path.join('.'),
        message: detail.message
      }));

      return res.status(400).json({
        error: 'Validation failed',
        details: errors
      });
    }

    // Replace request data with validated data
    req[source] = value;
    next();
  };
};

module.exports = {
  schemas,
  authSchemas,
  studentSchemas,
  recruiterSchemas,
  jobSchemas,
  mockTestSchemas,
  announcementSchemas,
  querySchemas,
  validateSchema
};
