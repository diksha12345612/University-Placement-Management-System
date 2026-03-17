const multer = require('multer');
const path = require('path');
const fs = require('fs');
// Use memory storage to avoid disk writes on Vercel Serverless
const storage = multer.memoryStorage();

const fileFilter = (req, file, cb) => {
    // Allow PDF, images, and MS Office documents (for job attachments and resumes)
    const allowedTypes = [
        'application/pdf',
        'image/jpeg',
        'image/png',
        'image/jpg',
        'application/msword',  // .doc
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document'  // .docx
    ];
    if (allowedTypes.includes(file.mimetype)) {
        cb(null, true);
    } else {
        cb(new Error(`File type not allowed. Allowed: PDF, Images, Word documents. Got: ${file.mimetype}`), false);
    }
};

const upload = multer({
    storage,
    fileFilter,
    limits: { fileSize: 5 * 1024 * 1024 }
});

module.exports = upload;
