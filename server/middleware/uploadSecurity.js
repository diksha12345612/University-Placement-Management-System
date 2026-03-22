/**
 * Upload Security Middleware
 * Validates files before storage - MIME type, size, dangerous file checks
 */

const crypto = require('crypto');
const path = require('path');

/**
 * Validate resume file
 * Ensures it's a legitimate PDF or DOCX file
 * @param {object} file - Multer file object
 * @returns {object} {valid: boolean, error?: string, safeFilename?: string}
 */
const validateResumeFile = (file) => {
    if (!file) {
        return { valid: false, error: 'No file uploaded' };
    }

    // Whitelist allowed MIME types
    const allowedMimes = [
        'application/pdf',
        'application/msword',
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
    ];

    if (!allowedMimes.includes(file.mimetype)) {
        return {
            valid: false,
            error: `Invalid file type: ${file.mimetype}. Only PDF and DOCX files are allowed.`
        };
    }

    // Max file size: 25MB
    const MAX_FILE_SIZE = 25 * 1024 * 1024;
    if (file.size > MAX_FILE_SIZE) {
        return {
            valid: false,
            error: `File too large: ${Math.ceil(file.size / 1024 / 1024)}MB. Maximum allowed: 25MB`
        };
    }

    // Min file size: 10KB (prevent empty files)
    const MIN_FILE_SIZE = 10 * 1024;
    if (file.size < MIN_FILE_SIZE) {
        return {
            valid: false,
            error: 'File is too small. Minimum size: 10KB'
        };
    }

    // Check for dangerous filename patterns
    const filename = file.originalname;
    if (filename.includes('..') || filename.includes('/') || filename.includes('\\')) {
        return {
            valid: false,
            error: 'Invalid filename'
        };
    }

    // Generate safe filename
    const ext = path.extname(file.originalname).toLowerCase();
    const safeFilename = `resume_${Date.now()}_${crypto.randomBytes(4).toString('hex')}${ext}`;

    return {
        valid: true,
        safeFilename
    };
};

/**
 * Validate profile image file
 * Ensures JPEG, PNG, GIF, WebP images with reasonable size
 * @param {object} file - Multer file object
 * @returns {object} {valid: boolean, error?: string}
 */
const validateProfileImage = (file) => {
    if (!file) {
        return { valid: false, error: 'No image uploaded' };
    }

    // Whitelist image MIME types
    const allowedMimes = [
        'image/jpeg',
        'image/png',
        'image/gif',
        'image/webp'
    ];

    if (!allowedMimes.includes(file.mimetype)) {
        return {
            valid: false,
            error: `Invalid image type: ${file.mimetype}. Only JPEG, PNG, GIF, and WebP are allowed.`
        };
    }

    // Max file size: 5MB
    const MAX_FILE_SIZE = 5 * 1024 * 1024;
    if (file.size > MAX_FILE_SIZE) {
        return {
            valid: false,
            error: `Image too large: ${Math.ceil(file.size / 1024 / 1024)}MB. Maximum allowed: 5MB`
        };
    }

    // Min file size: 1KB
    const MIN_FILE_SIZE = 1 * 1024;
    if (file.size < MIN_FILE_SIZE) {
        return {
            valid: false,
            error: 'Image is too small. Minimum size: 1KB'
        };
    }

    return { valid: true };
};

/**
 * Validate file magic bytes to prevent spoofed files
 * Checks actual file header instead of just extension
 * @param {Buffer} fileBuffer - File contents
 * @param {string} declaredMime - MIME type from upload
 * @returns {boolean} True if magic bytes match MIME type
 */
const validateMagicBytes = (fileBuffer, declaredMime) => {
    if (fileBuffer.length < 4) {
        return false; // File too small to have valid magic bytes
    }

    // PDF files start with %PDF
    if (declaredMime === 'application/pdf') {
        return fileBuffer.toString('utf8', 0, 4) === '%PDF';
    }

    // JPEG files start with FF D8 FF
    if (declaredMime === 'image/jpeg') {
        return (
            fileBuffer[0] === 0xFF &&
            fileBuffer[1] === 0xD8 &&
            fileBuffer[2] === 0xFF
        );
    }

    // PNG files start with 89 50 4E 47
    if (declaredMime === 'image/png') {
        return (
            fileBuffer[0] === 0x89 &&
            fileBuffer[1] === 0x50 &&
            fileBuffer[2] === 0x4E &&
            fileBuffer[3] === 0x47
        );
    }

    // GIF files start with GIF87a or GIF89a
    if (declaredMime === 'image/gif') {
        return (
            fileBuffer.toString('utf8', 0, 3) === 'GIF' &&
            (fileBuffer.toString('utf8', 3, 6) === '  87a' ||
             fileBuffer.toString('utf8', 3, 6) === '89a ')
        );
    }

    // WebP files contain "WEBP" signature
    if (declaredMime === 'image/webp') {
        return fileBuffer.toString('utf8', 8, 12) === 'WEBP';
    }

    return true; // Unknown type, allow if MIME check passed
};

/**
 * Check for dangerous file extensions
 * Prevents execution of scripts even if uploaded as attachment
 * @param {string} filename - Original filename
 * @returns {boolean} True if file extension is dangerous
 */
const isDangerousFile = (filename) => {
    const dangerousExtensions = [
        '.exe', '.bat', '.cmd', '.com', '.pif', '.scr', // Windows executables
        '.sh', '.bash', '.zsh', // Unix shells
        '.js', '.jsx', '.ts', '.tsx', '.mjs', // JavaScript
        '.jar', '.class', // Java
        '.py', '.pyc', '.pyo', // Python
        '.asp', '.aspx', '.jsp', '.php', // Server-side scripts
        '.zip', '.rar', '.7z', // Archives
        '.dmg', '.pkg', '.app' // macOS
    ];

    const ext = path.extname(filename).toLowerCase();
    return dangerousExtensions.includes(ext);
};

/**
 * Create multer file filter for uploads
 * Used as multer option: upload.single('file', {fileFilter: createFileFilter()})
 * @returns {function} Multer fileFilter function
 */
const createFileFilter = (fileType = 'resume') => {
    return (req, file, cb) => {
        // Validate based on file type
        let validation;
        if (fileType === 'resume') {
            validation = validateResumeFile(file);
        } else if (fileType === 'image') {
            validation = validateProfileImage(file);
        } else {
            validation = { valid: false, error: 'Unknown file type' };
        }

        if (!validation.valid) {
            return cb(new Error(validation.error));
        }

        // Check for dangerous extensions
        if (isDangerousFile(file.originalname)) {
            return cb(new Error('File type not allowed'));
        }

        cb(null, true);
    };
};

/**
 * Create multer filename function
 * Generates secure filenames to prevent path traversal
 * @returns {function} Multer filename function
 */
const createFilenameFunction = () => {
    return (req, file, cb) => {
        const ext = path.extname(file.originalname).toLowerCase();
        const safeFilename = `file_${Date.now()}_${crypto.randomBytes(4).toString('hex')}${ext}`;
        cb(null, safeFilename);
    };
};

/**
 * Rate limit file uploads per user
 * Prevents upload spam/DoS attacks
 * @returns {object} {current: number, limit: number, valid: boolean}
 */
const uploadRateLimitTracker = (() => {
    const userUploads = new Map();
    const windowMs = 60 * 60 * 1000; // 1 hour
    const maxUploads = 10; // 10 uploads per hour per user

    return {
        check: (userId) => {
            const now = Date.now();

            if (!userUploads.has(userId)) {
                userUploads.set(userId, {
                    count: 1,
                    firstUploadTime: now
                });
                return { current: 1, limit: maxUploads, valid: true };
            }

            const record = userUploads.get(userId);

            // Reset counter if window expired
            if (now - record.firstUploadTime > windowMs) {
                record.count = 1;
                record.firstUploadTime = now;
                return { current: 1, limit: maxUploads, valid: true };
            }

            // Check if limit exceeded
            if (record.count >= maxUploads) {
                return {
                    current: record.count,
                    limit: maxUploads,
                    valid: false,
                    error: `Upload limit exceeded. Maximum ${maxUploads} uploads per hour.`
                };
            }

            record.count++;
            return { current: record.count, limit: maxUploads, valid: true };
        },

        reset: (userId) => {
            userUploads.delete(userId);
        }
    };
})();

module.exports = {
    validateResumeFile,
    validateProfileImage,
    validateMagicBytes,
    isDangerousFile,
    createFileFilter,
    createFilenameFunction,
    uploadRateLimitTracker
};
