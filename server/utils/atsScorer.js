/**
 * Extract keywords from job description - normalized and deduplicated
 */
const extractKeywords = (jobDescription) => {
  const stopwords = new Set(['the', 'a', 'an', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for', 'of', 'with', 'by', 'from', 'as', 'is', 'was', 'be', 'have', 'has', 'had', 'do', 'does', 'did', 'will', 'would', 'should', 'could', 'may', 'might', 'must', 'can', 'that', 'this', 'what', 'which', 'who', 'when', 'where', 'why', 'how', 'are', 'your', 'you', 'we', 'us', 'our']);
  
  const words = jobDescription
    .toLowerCase()
    .match(/\b[a-z+#.]+\b/gi) || [];
  
  const keywordMap = {};
  words.forEach(word => {
    if (word.length > 2 && !stopwords.has(word)) {
      keywordMap[word] = (keywordMap[word] || 0) + 1;
    }
  });

  // Return top 50 keywords by frequency
  return Object.entries(keywordMap)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 50)
    .map(([keyword]) => keyword);
};

/**
 * Extract skills from resume text
 */
const extractResumeSkills = (resumeText) => {
  const skillPatterns = {
    'technical': ['python', 'javascript', 'java', 'cpp', 'c#', 'ruby', 'php', 'go', 'rust', 'kotlin', 'swift', 'typescript'],
    'frameworks': ['react', 'vue', 'angular', 'express', 'django', 'flask', 'spring', 'asp.net', 'node.js', 'spring boot', 'fastapi'],
    'databases': ['mongodb', 'postgresql', 'mysql', 'redis', 'elasticsearch', 'cassandra', 'dynamodb', 'oracle', 'sql server'],
    'devops': ['docker', 'kubernetes', 'jenkins', 'gitlab', 'github', 'azure', 'aws', 'gcp', 'terraform', 'ansible', 'ci/cd'],
    'tools': ['git', 'jira', 'confluence', 'slack', 'postman', 'figma', 'webpack', 'yarn', 'npm', 'maven', 'gradle'],
    'methodologies': ['agile', 'scrum', 'kanban', 'tdd', 'bdd', 'devops', 'microservices', 'rest', 'graphql', 'soap']
  };

  const resumeLower = resumeText.toLowerCase();
  const foundSkills = new Set();

  Object.values(skillPatterns).forEach(skillGroup => {
    skillGroup.forEach(skill => {
      if (resumeLower.includes(skill.toLowerCase())) {
        foundSkills.add(skill);
      }
    });
  });

  return Array.from(foundSkills);
};

/**
 * Calculate keyword match score (40% weight)
 * Extracts keywords from JD and matches against resume
 */
const calculateKeywordScore = (resumeText, jobDescription) => {
  const keywords = extractKeywords(jobDescription);
  const resumeLower = resumeText.toLowerCase();
  
  let matched = 0;
  const missingKeywords = [];

  keywords.forEach(keyword => {
    if (resumeLower.includes(keyword)) {
      matched++;
    } else {
      missingKeywords.push(keyword);
    }
  });

  const score = keywords.length > 0 ? (matched / keywords.length) * 100 : 50;
  return { score: Math.round(score), matched, total: keywords.length, missingKeywords: missingKeywords.slice(0, 10) };
};

/**
 * Calculate skills match score (25% weight)
 * ENHANCED: Uses Affinda-extracted skills + pattern matching for comprehensive coverage
 * Compares extracted skills from resume and JD
 */
const calculateSkillsScore = (resumeText, jobDescription, affindaSkills = []) => {
  // Combine Affinda's extracted skills with pattern-based extraction for comprehensive matching
  const affindaSkillsList = Array.isArray(affindaSkills) ? affindaSkills : [];
  const patternBasedSkills = extractResumeSkills(resumeText);
  
  // Merge both lists, using Affinda as primary source
  const resumeSkills = new Set([...affindaSkillsList, ...patternBasedSkills]);
  const jdSkills = extractResumeSkills(jobDescription);

  if (jdSkills.length === 0) return { score: 70, matched: resumeSkills.size, total: 0 };

  let matched = 0;
  resumeSkills.forEach(skill => {
    if (jdSkills.includes(skill)) matched++;
  });

  const score = (matched / jdSkills.length) * 100;
  return { score: Math.round(score), matched, total: jdSkills.length, missingSkills: jdSkills.filter(s => !resumeSkills.has(s)).slice(0, 5) };
};

/**
 * Calculate experience match score (15% weight)
 * Heuristic: check for experience indicators
 */
const calculateExperienceScore = (resumeText, jobDescription) => {
  const resumeLower = resumeText.toLowerCase();
  const jdLower = jobDescription.toLowerCase();

  // Check for years requirement in JD
  const yearsMatch = jdLower.match(/(\d+)\+?\s*years?/i);
  const requiredYears = yearsMatch ? parseInt(yearsMatch[1]) : 2;

  // Check resume for experience indicators
  let experienceScore = 50;

  // Look for internship, work experience, project
  if (resumeLower.includes('internship') || resumeLower.includes('intern')) experienceScore += 15;
  if (resumeLower.includes('experience') || resumeLower.includes('worked')) experienceScore += 15;
  if (resumeLower.includes('project') || resumeLower.includes('developed')) experienceScore += 10;
  if (resumeLower.includes('led') || resumeLower.includes('managed') || resumeLower.includes('lead')) experienceScore += 10;

  // Look for specific company names or achievements
  if (/[a-z0-9]+ (inc|corp|limited|llc|ltd)/i.test(resumeText)) experienceScore += 10;

  return { score: Math.min(100, experienceScore) };
};

/**
 * Calculate relevance score (10% weight)
 * Check for job title similarity and domain relevance
 */
const calculateRelevanceScore = (resumeText, jobTitle) => {
  const resumeLower = resumeText.toLowerCase();
  const jobTitleLower = jobTitle.toLowerCase();

  let relevanceScore = 40;

  // Extract job titles from resume (common patterns)
  const titlePatterns = [jobTitleLower, ...jobTitleLower.split(/\s+/)];
  
  titlePatterns.forEach(pattern => {
    if (pattern.length > 3 && resumeLower.includes(pattern)) {
      relevanceScore += 20;
    }
  });

  // Domain relevance check
  if ((jobTitleLower.includes('developer') || jobTitleLower.includes('engineer')) && 
      (resumeLower.includes('github') || resumeLower.includes('code') || resumeLower.includes('development'))) {
    relevanceScore += 15;
  }

  return { score: Math.min(100, relevanceScore) };
};

/**
 * Calculate formatting and completeness score (10% weight)
 * Check for structure, sections, and ATS-friendly format
 */
const calculateFormattingScore = (resumeText) => {
  let formattingScore = 50;

  // Check for key sections
  const hasContactInfo = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}|(\d{10})|(\d{3}-\d{3}-\d{4})/.test(resumeText);
  const hasEducation = /education|bachelor|master|degree|university|college/i.test(resumeText);
  const hasExperience = /experience|work|employment|internship/i.test(resumeText);
  const hasSkills = /skills|technical|programming|languages/i.test(resumeText);
  const hasProjects = /project|built|developed|created/i.test(resumeText);

  if (hasContactInfo) formattingScore += 10;
  if (hasEducation) formattingScore += 10;
  if (hasExperience) formattingScore += 10;
  if (hasSkills) formattingScore += 10;
  if (hasProjects) formattingScore += 10;

  // Check for reasonable length (200-5000 words)
  const wordCount = resumeText.split(/\s+/).length;
  if (wordCount >= 100 && wordCount <= 5000) {
    formattingScore += 5;
  }

  return { score: Math.min(100, formattingScore) };
};

/**
 * Calculate the ATS Score based on job description, resume text, and weights.
 * Industry-standard weighted algorithm with 5 factors.
 * 
 * @param {Object} parsedResume { skills, experienceYears, keywords, jobTitles }
 * @param {String} jobDescription 
 * @param {Object} matchSettings { weights, customKeywords, roleBasedSkills }
 * @param {String} jobRole E.g. "Software Engineer"
 * @param {String} resumeText Full resume text for better extraction
 * @returns {Object} Score details Breakdown
 */
const calculateScore = (parsedResume, jobDescription, matchSettings, jobRole, resumeText = '') => {
  const { weights } = matchSettings;

  // Use provided resume text or fallback to extracted keywords
  const resumeTextToUse = resumeText || (parsedResume.keywords || []).join(' ') + ' ' + (parsedResume.skills || []).join(' ');

  // Get Affinda-extracted skills (priority) or empty array
  const affindaSkills = Array.isArray(parsedResume.skills) ? parsedResume.skills : [];

  // 1. Keyword Match Score (40%)
  const keywordResult = calculateKeywordScore(resumeTextToUse, jobDescription);
  const keywordContribution = (keywordResult.score * (weights.keywordWeight || 40)) / 100;

  // 2. Skills Match Score (25%) - NOW USING AFFINDA SKILLS
  const skillsResult = calculateSkillsScore(resumeTextToUse, jobDescription, affindaSkills);
  const skillsContribution = (skillsResult.score * (weights.skillsWeight || 25)) / 100;

  // 3. Experience Match Score (15%)
  const experienceResult = calculateExperienceScore(resumeTextToUse, jobDescription);
  const experienceContribution = (experienceResult.score * (weights.experienceWeight || 15)) / 100;

  // 4. Relevance Score (10%)
  const relevanceResult = calculateRelevanceScore(resumeTextToUse, jobRole);
  const relevanceContribution = (relevanceResult.score * (weights.relevanceWeight || 10)) / 100;

  // 5. Formatting Score (10%)
  const formattingResult = calculateFormattingScore(resumeTextToUse);
  const formattingContribution = (formattingResult.score * (weights.formattingWeight || 10)) / 100;

  // Final Compilation - Proper weighted calculation
  const finalScore = Math.round(
    keywordContribution +
    skillsContribution +
    experienceContribution +
    relevanceContribution +
    formattingContribution
  );

  // Generate suggestions based on weak areas
  const suggestions = [];
  if (keywordResult.score < 60) {
    suggestions.push(`Add more industry keywords like: ${keywordResult.missingKeywords.slice(0, 3).join(', ')}`);
  }
  if (skillsResult.score < 50 && skillsResult.missingSkills?.length > 0) {
    suggestions.push(`Consider learning these in-demand skills: ${skillsResult.missingSkills.join(', ')}`);
  }
  if (experienceResult.score < 60) {
    suggestions.push('Highlight internship/work experience with measurable outcomes');
  }
  if (formattingResult.score < 70) {
    suggestions.push('Ensure clear section headings (Education, Experience, Skills) for better ATS parsing');
  }

  return {
    atsScore: finalScore,
    keywordMatch: keywordResult.score,
    skillsMatch: skillsResult.score,
    experienceMatch: experienceResult.score,
    relevanceScore: relevanceResult.score,
    formattingScore: formattingResult.score,
    missingKeywords: keywordResult.missingKeywords,
    suggestions: suggestions.length > 0 ? suggestions : ['Your resume is well-optimized for this position!']
  };
};

module.exports = {
  calculateScore,
  extractKeywords,
  extractResumeSkills,
  calculateKeywordScore,
  calculateSkillsScore,
  calculateExperienceScore,
  calculateRelevanceScore,
  calculateFormattingScore
};
