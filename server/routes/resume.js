const express = require('express');
const multer = require('multer');
const router = express.Router();
const { parseResumeFile } = require('../services/resumeParser');
const { calculateScore } = require('../utils/atsScorer');
const ATSSettings = require('../models/ATSSettings');

// Use memory storage for Vercel serverless (read-only filesystem)
const upload = multer({ storage: multer.memoryStorage() });

/**
 * POST /api/resume/scan 
 * Accept resume file and job description to get an ATS Score.
 */
router.post('/scan', upload.single('resume'), async (req, res) => {
  try {
    const { jobDescription, jobRole } = req.body;
    const file = req.file;

    if (!file || !jobDescription) {
      return res.status(400).json({ error: 'Resume file and job description are required.' });
    }

    // Parse the file (use buffer instead of path for serverless compatibility)
    const parsedData = await parseResumeFile(file.buffer || file.path);
    
    // Get ATS settings
    let settings = await ATSSettings.findOne({});
    if (!settings) settings = new ATSSettings(); // Provide defaults

    // Score the resume
    const scoringResult = calculateScore(parsedData, jobDescription, settings, jobRole);

    return res.status(200).json({
      message: 'ATS Score generated successfully',
      data: scoringResult
    });

  } catch (error) {
    console.error('Error scanning resume:', error.message);
    return res.status(500).json({ error: 'Internal Server Error scanning resume' });
  }
});

module.exports = router;
