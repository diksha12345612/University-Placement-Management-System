const axios = require('axios');
const FormData = require('form-data');

/**
 * Service to parse resume file using Affinda Resume Parser API
 * Affinda extracts structured resume data including skills, experience, education, etc.
 */

const parseResumeFile = async (fileBuffer) => {
  try {
    if (!process.env.AFFINDA_API_KEY) {
      console.warn('⚠️  AFFINDA_API_KEY not set. Using fallback parsing.');
      return getFallbackParsing();
    }

    console.log('🔄 Uploading resume to Affinda API for parsing...');

    // Create FormData with the PDF file
    const form = new FormData();
    form.append('file', fileBuffer, 'resume.pdf');
    form.append('wait', 'true'); // Wait for parsing to complete synchronously

    // Call Affinda API
    const response = await axios.post(
      'https://api.affinda.com/v3/documents',
      form,
      {
        headers: {
          ...form.getHeaders(),
          'Authorization': `Bearer ${process.env.AFFINDA_API_KEY}`
        },
        timeout: 30000 // 30 second timeout
      }
    );

    console.log('✅ Resume parsed successfully by Affinda');

    // Extract and structure the parsed data
    const parsed = response.data.data || response.data;
    
    return {
      // Basic info
      name: parsed.name || '',
      email: parsed.email || '',
      phone: parsed.phoneNumber || '',
      location: parsed.location?.raw || '',
      
      // Skills extracted by Affinda
      skills: (parsed.skills || []).map(s => s.name || s).filter(Boolean),
      
      // Work experience
      experienceYears: calculateExperienceYears(parsed.workExperience),
      jobTitles: (parsed.workExperience || []).map(w => w.jobTitle).filter(Boolean),
      companies: (parsed.workExperience || []).map(w => w.company).filter(Boolean),
      
      // Education
      education: (parsed.education || []).map(e => e.schoolName || e).filter(Boolean),
      
      // Raw parsed data for additional analysis
      workExperience: parsed.workExperience || [],
      certifications: parsed.certifications || [],
      languages: parsed.languages || [],
      
      // Keywords/raw text for ATS matching
      keywords: extractKeywords(parsed),
      
      // Raw text for AI analysis
      rawText: parsed.docText || ''
    };
  } catch (error) {
    console.error('❌ Affinda API Error:', error.message);
    
    // Fallback to basic parsing if Affinda fails
    if (error.response?.status === 401) {
      console.error('Invalid Affinda API Key');
    } else if (error.code === 'ECONNABORTED') {
      console.error('Affinda API timeout');
    }
    
    return getFallbackParsing();
  }
};

/**
 * Calculate years of experience from work history
 */
const calculateExperienceYears = (workExperience) => {
  if (!workExperience || workExperience.length === 0) return 0;
  
  let totalMonths = 0;
  workExperience.forEach(job => {
    if (job.startDate && job.endDate) {
      const start = new Date(job.startDate);
      const end = new Date(job.endDate);
      totalMonths += (end - start) / (1000 * 60 * 60 * 24 * 30.44);
    }
  });
  
  return Math.round(totalMonths / 12);
};

/**
 * Extract keywords from resume for ATS matching
 */
const extractKeywords = (parsed) => {
  const keywords = new Set();
  
  // Add skills
  (parsed.skills || []).forEach(s => keywords.add((s.name || s).toLowerCase()));
  
  // Add job titles
  (parsed.workExperience || []).forEach(w => {
    if (w.jobTitle) keywords.add(w.jobTitle.toLowerCase());
  });
  
  // Add education
  (parsed.education || []).forEach(e => {
    if (e.schoolName) keywords.add(e.schoolName.toLowerCase());
    if (e.fieldOfStudy) keywords.add(e.fieldOfStudy.toLowerCase());
  });
  
  // Add certifications
  (parsed.certifications || []).forEach(c => keywords.add(c.toLowerCase()));
  
  return Array.from(keywords);
};

/**
 * Fallback parsing if Affinda API is unavailable
 * Returns mock data structure
 */
const getFallbackParsing = () => {
  console.log('📋 Using fallback resume parsing...');
  return {
    name: '',
    email: '',
    phone: '',
    location: '',
    skills: ["JavaScript", "React", "Node.js", "MongoDB", "Express", "Git"],
    experienceYears: 3,
    jobTitles: ["Software Engineer", "Full Stack Developer"],
    companies: [],
    education: ["B.S. Computer Science"],
    certifications: [],
    languages: [],
    keywords: ["web development", "full stack", "agile", "REST API"],
    rawText: '',
    workExperience: [],
    languages: []
  };
};

module.exports = {
  parseResumeFile
};
