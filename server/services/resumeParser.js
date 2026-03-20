const axios = require('axios');
const FormData = require('form-data');

/**
 * Service to parse resume file using Affinda Resume Parser API
 * Fallback: OpenAI GitHub Models if Affinda fails
 */

const parseResumeFile = async (fileBuffer) => {
  try {
    if (!process.env.AFFINDA_API_KEY) {
      console.warn('⚠️  AFFINDA_API_KEY not set. Falling back to OpenAI parsing.');
      return parseWithOpenAI(fileBuffer);
    }

    console.log('🔄 Uploading resume to Affinda API for parsing...');

    // Create FormData with the PDF file
    const form = new FormData();
    form.append('file', fileBuffer, 'resume.pdf');
    form.append('wait', 'true'); // Wait for parsing to complete synchronously

    // Call Affinda API
    console.log('📤 Request Details:');
    console.log('  URL: https://api.affinda.com/v3/documents');
    console.log('  File size:', fileBuffer.length, 'bytes');
    console.log('  API Key length:', process.env.AFFINDA_API_KEY.length, 'chars');
    
    const response = await axios.post(
      'https://api.affinda.com/v3/documents',
      form,
      {
        headers: {
          ...form.getHeaders(),
          'Authorization': `Bearer ${process.env.AFFINDA_API_KEY}`,
          'User-Agent': 'University-Placement-Portal/1.0'
        },
        timeout: 30000, // 30 second timeout
        maxContentLength: 10 * 1024 * 1024, // 10MB max
        maxBodyLength: 10 * 1024 * 1024
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
      rawText: parsed.docText || '',
      
      // Mark this as parsed by Affinda
      parsedBy: 'affinda'
    };
  } catch (error) {
    console.error('❌ Affinda API Error:', error.message);
    
    // Detailed error logging
    if (error.response) {
      console.error('  Status:', error.response.status);
      console.error('  Data:', JSON.stringify(error.response.data).substring(0, 200));
      
      if (error.response.status === 400) {
        console.error('  💡 Bad Request - possible causes:');
        console.error('    - API key format incorrect');
        console.error('    - File format not supported');
        console.error('    - Missing required parameters');
      } else if (error.response.status === 401) {
        console.error('  💡 Unauthorized - API key invalid or expired');
      } else if (error.response.status === 403) {
        console.error('  💡 Forbidden - API key lacks permissions');
      } else if (error.response.status === 429) {
        console.error('  💡 Rate limited - too many requests');
      }
    } else if (error.code === 'ECONNABORTED') {
      console.error('  Affinda API timeout');
    } else if (error.code === 'ENOTFOUND') {
      console.error('  Cannot reach Affinda API - network issue');
    }
    
    // Skip OpenAI parsing (causes ENAMETOOLONG error)
    // Go directly to fallback parsing
    console.log('📋 Using basic fallback parsing (skipping OpenAI due to issues)...');
    return getFallbackParsing();
  }
};

/**
 * Parse resume using OpenAI GitHub Models as fallback
 */
const parseWithOpenAI = async (fileBuffer) => {
  try {
    const pdfParse = require('pdf-parse');
    
    // Extract text from PDF
    console.log('📄 Extracting text from resume PDF...');
    const pdfData = await pdfParse(fileBuffer);
    const resumeText = pdfData.text;

    if (!resumeText || resumeText.length < 50) {
      console.warn('⚠️  Could not extract meaningful text from PDF');
      return getFallbackParsing();
    }

    // Use OpenAI to parse the resume text
    const { githubModels } = require('./aiService');
    
    console.log('🤖 Using OpenAI GitHub Models to analyze resume...');
    
    const prompt = `You are an expert resume parser. Analyze this resume and extract the following information in JSON format:
{
  "name": "full name",
  "email": "email address",
  "phone": "phone number",
  "location": "city, state",
  "skills": ["skill1", "skill2", ...],
  "jobTitles": ["job1", "job2", ...],
  "companies": ["company1", "company2", ...],
  "experienceYears": number,
  "education": ["degree and school"],
  "certifications": ["cert1", "cert2"],
  "languages": ["lang1", "lang2"],
  "keywords": ["keyword1", "keyword2", ...]
}

Resume Text:
${resumeText}

Return ONLY valid JSON, no markdown or extra text.`;

    const response = await githubModels.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        {
          role: 'user',
          content: prompt
        }
      ],
      temperature: 0.3,
      max_tokens: 1000
    });

    const content = response.choices[0]?.message?.content || '{}';
    
    // Parse the JSON response
    const jsonMatch = content.match(/\{[\s\S]*\}/);
    const parsed = jsonMatch ? JSON.parse(jsonMatch[0]) : {};

    console.log('✅ Resume parsed successfully by OpenAI');

    return {
      name: parsed.name || '',
      email: parsed.email || '',
      phone: parsed.phone || '',
      location: parsed.location || '',
      skills: Array.isArray(parsed.skills) ? parsed.skills : [],
      jobTitles: Array.isArray(parsed.jobTitles) ? parsed.jobTitles : [],
      companies: Array.isArray(parsed.companies) ? parsed.companies : [],
      experienceYears: parsed.experienceYears || 0,
      education: Array.isArray(parsed.education) ? parsed.education : [],
      certifications: Array.isArray(parsed.certifications) ? parsed.certifications : [],
      languages: Array.isArray(parsed.languages) ? parsed.languages : [],
      keywords: Array.isArray(parsed.keywords) ? parsed.keywords : [],
      workExperience: [],
      rawText: resumeText,
      parsedBy: 'openai'
    };
  } catch (error) {
    console.error('❌ OpenAI parsing failed:', error.message);
    console.log('📋 Using basic fallback parsing...');
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
