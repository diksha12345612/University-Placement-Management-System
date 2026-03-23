# ATS (Applicant Tracking System) - Comprehensive Analysis

## Executive Summary
The University Placement Management System includes a complete ATS that evaluates resumes against job descriptions using both AI-powered analysis and keyword matching. The system scores resumes across 5 dimensions and ranks candidates for job positions.

---

## 1. ATS-RELATED FILES FOUND

### Backend Models
1. **[server/models/ATSSettings.js](server/models/ATSSettings.js)** - Configuration for ATS scoring weights and thresholds
2. **[server/models/Application.js](server/models/Application.js)** - Application scoring data (aiEvaluation + atsEvaluation)
3. **[server/models/ResumeAnalysis.js](server/models/ResumeAnalysis.js)** - Historical resume analysis records
4. **[server/models/User.js](server/models/User.js)** - Student profiles with aiResumeAnalysis
5. **[server/models/Job.js](server/models/Job.js)** - Job descriptions used for matching

### Backend Routes
1. **[server/routes/applications.js](server/routes/applications.js)** - ATS evaluation endpoints
   - `POST /api/applications/:id/ai-evaluate` - Evaluate single application
   - `POST /api/applications/job/:jobId/ai-rank` - Rank all applicants for a job
2. **[server/routes/adminRoutes.js](server/routes/adminRoutes.js)** - ATS settings management
   - `GET /admin/ats-settings` - Retrieve current ATS configuration
   - `POST /admin/ats-settings` - Update ATS weights and threshold
3. **[server/routes/resumeRoutes.js](server/routes/resumeRoutes.js)** - Resume scanning
   - `POST /api/resume/scan` - Single resume ATS scan with job description
4. **[server/routes/students.js](server/routes/students.js)** - Resume upload and analysis

### Backend Services
1. **[server/services/aiService.js](server/services/aiService.js)** (Lines 517-760)
   - `analyzeResume()` - AI-powered 5-dimension scoring
   - `rankCandidateForJob()` - Candidate-to-job matching
   - `evaluateCandidateForJob()` - Legacy wrapper
2. **[server/services/resumeParser.js](server/services/resumeParser.js)** - Resume text extraction and parsing

### Backend Utils
1. **[server/utils/atsScorer.js](server/utils/atsScorer.js)** - Core ATS scoring logic
   - `calculateScore()` - Keyword, skills, experience, formatting matching

### Frontend Components
1. **[client/src/components/ATSScoreCard.jsx](client/src/components/ATSScoreCard.jsx)** - Displays ATS scores in a card format
2. **[client/src/components/AdminATSPanel.jsx](client/src/components/AdminATSPanel.jsx)** - Admin panel for weight configuration

### Frontend Pages
1. **[client/src/pages/student/Dashboard.jsx](client/src/pages/student/Dashboard.jsx)** (Lines 194-250)
   - Displays AI Resume Insights with 5-category radar chart
2. **[client/src/pages/student/Applications.jsx](client/src/pages/student/Applications.jsx)** (Lines 137-160)
   - Shows ATS feedback modal for each application
3. **[client/src/pages/recruiter/MyJobs.jsx](client/src/pages/recruiter/MyJobs.jsx)** (Lines 361-420)
   - Application detail modal with ATS and AI evaluation scores

---

## 2. SCORING IMPLEMENTATION DETAILS

### A. Resume Analysis (AI Service) - 5 Dimensions
**File:** `server/services/aiService.js` (Line 517-670)

Uses OpenAI API with strict evaluation rubric. Each dimension scored 0-20, total 0-100.

```
1. Technical Skills Score (0-20)
   - Deductions for outdated frameworks, missing industry tools
   - Bonuses for advanced certifications
   
2. Projects Score (0-20)
   - Evaluates complexity, quantified outcomes, production links
   - Deductions for vague descriptions
   
3. Experience Score (0-20)
   - Assessment of internships, co-ops, open-source, achievements
   - Deductions for low compensation experience
   
4. ATS Optimization Score (0-20)
   - Checks formatting, headers, contact info, keyword distribution
   - Deductions for ATS-hostile formatting (tables, columns, graphics)
   - Starts at 20, deducts up to -8 for missing headers
   
5. Clarity & Impact Score (0-20)
   - Action verbs, quantification, professional tone
   - Deductions for vague responsibilities, weak verbs, grammar issues
```

**Fallback Scoring (when AI unavailable):**
- Base score: `10 + (presenceRatio * 7)` 
- Resume score: `Math.min(100, baseScore * 5)`
- All categories: hardcoded to 12-13 with grade 'C'
- Message: "Fallback analysis only. Re-analyze resume for full AI scoring."

### B. ATS Keyword Matching - 4 Components
**File:** `server/utils/atsScorer.js` (Line 10-90)

Weighted scoring of resume against job description keywords:

```
1. Keyword Match Score        (Weight: 40%) ← Largest factor
   - Compares resume keywords vs job description top 50 words
   - Custom keywords from admin configuration
   - Score: (matches / total keywords) * 100
   
2. Skills Match Score         (Weight: 30%)
   - Checks for role-based required skills
   - Extract from job title and required skills list
   - Score: (matches / required skills) * 100
   
3. Experience Match Score     (Weight: 20%)
   - Simple heuristic: experienceYears >= 2 ? 100 : 50
   
4. Formatting Score           (Weight: 10%)
   - Checks if job titles extracted successfully
   - Score: (jobTitles.length > 0) ? 100 : 60
```

**Final Score Calculation:**
```
finalScore = Round(
  (keyword% * 40/100) + 
  (skills% * 30/100) + 
  (experience% * 20/100) + 
  (formatting% * 10/100)
)
```

**Suggestion Generation:**
- If keywordPercentage < 60: "Try using more industry-specific words from the job description."
- If skillsPercentage < 50: "Missing key role skills like: [top 3 required skills]."
- If formattingPercentage < 80: "Ensure section headings are clear for better ATS parsing."

### C. Candidate Ranking (Job Fit Scoring)
**File:** `server/services/aiService.js` (Line 665-760)

Compares candidate profile against job requirements:

```
Scoring Brackets:
- 0-25%:   Totally unrelated background/skills
- 26-50%:  Tangentially related but lacks core tech stack
- 51-75%:  Good match, some core skills but lacks depth
- 76-90%:  Strong match, has most core skills and relevant projects
- 91-100%: Exceptionally rare perfect alignment

Penalties Applied:
- -40% if department totally unrelated to role (unless massive projects)
- -30% if missing 2+ "Must Have" skills from JD
- Cap at 60% if Resume Quality < 50
```

**Fallback Formula (when AI unavailable):**
```javascript
const skillRatio = candSkills.length > 0 ? (match / candSkills.length) : 0;
matchScore = Round(skillRatio * 100 * 0.5 + resumeScore * 0.2);

// Department penalty
if (!isTechDept) matchScore = Round(matchScore * 0.6);

// Final: clamp to 0-100
matchScore = Min(100, matchScore)
```

---

## 3. HARDCODED VALUES & FALLBACKS

### Default ATS Settings (Database)
- **Keyword Weight:** 40%
- **Skills Weight:** 30%
- **Experience Weight:** 20%
- **Formatting Weight:** 10%
- **Threshold Score:** 60 (used for "Strong" recommendation cutoff)

### Demo Seeding Values
**File:** `server/scripts/resetAndSeedFullDemo.js` (Line 587)

```javascript
// Based on application status:
matchScore: 
  - selected:     89%
  - shortlisted:  78%
  - interview:    72%
  - applied:      66%
  - rejected:     49%

skillMatchScore:
  - selected:     90%
  - others:       76%

experienceMatchScore:
  - selected:     84%
  - others:       68%
```

### Resume Analysis Fallback Scores
**File:** `server/services/aiService.js` (Line 636)

```javascript
baseScore = Round(10 + (presenceRatio * 7))  // 10-17
resumeScore = Min(100, baseScore * 5)        // 50-85
technicalSkillsScore = 12
projectsScore = 12
experienceScore = 10
atsScore = 13
clarityScore = 13
```

### Candidate Ranking Thresholds
```javascript
Strong:    matchScore > 70
Moderate:  matchScore > 40
Weak:      matchScore ≤ 40
```

### Color Coding Standards
- **Green (Success):** Score ≥ 80%
- **Amber (Warning):** Score 60-79%
- **Red (Danger):** Score < 60%

---

## 4. API ENDPOINTS

### ATS Evaluation Endpoints
```
POST /api/applications/:id/ai-evaluate
├─ Auth: recruiter role required
├─ Input: Application ID
├─ Output: Application with populated atsEvaluation + aiEvaluation
└─ Flow: Parse resume → Score against JD → Save evaluation

POST /api/applications/job/:jobId/ai-rank
├─ Auth: recruiter role required
├─ Input: Job ID
├─ Output: All applications for job with scores
├─ Flow: Fetch all applicants → Parse resumes → Calculate scores
└─ Note: Silently skips applicants without resume
```

### ATS Settings Management
```
GET /api/admin-ats/ats-settings
├─ Returns: Current weights, threshold, custom keywords
└─ Default: Creates new ATSSettings if none exists

POST /api/admin-ats/ats-settings
├─ Accepts: weights, customKeywords, roleBasedSkills, thresholdScore
├─ Validates: Total weights must equal 100
└─ Updates: Stores in database for all evaluations
```

### Resume Scanning
```
POST /api/resume/scan
├─ Auth: None (public endpoint)
├─ Input: resume file + jobDescription + jobRole
├─ Output: ATS scoring result
└─ Flow: Parse resume → Score against JD → Return scores
```

### Application Routes (Mounted)
**File:** `server/server.js` (Line 175-187)
```javascript
app.use('/api/auth', require('./routes/auth'));
app.use('/api/students', require('./routes/students'));
app.use('/api/jobs', require('./routes/jobs'));
app.use('/api/applications', require('./routes/applications'));
app.use('/api/admin', require('./routes/admin'));
app.use('/api/admin-ats', require('./routes/adminRoutes')); // ATS custom routes
app.use('/api/resume', require('./routes/resumeRoutes'));   // Resume scanning
```

---

## 5. FRONTEND COMPONENTS

### ATSScoreCard Component
**File:** `client/src/components/ATSScoreCard.jsx`

**Purpose:** Display ATS match scores in a comprehensive card format

**Props:**
```javascript
result = {
  atsScore: Number (0-100),
  keywordMatch: Number (%),
  skillsMatch: Number (%),
  experienceMatch: Number (%),
  formattingScore: Number (%),
  missingKeywords: [String],
  suggestions: [String]
}
```

**Display Elements:**
- Large circular progress: Overall ATS score with color coding
- 4 breakdown bars: Keywords, Skills, Experience, Formatting (each with progress bar)
- Missing Keywords box: Lists top 10 missing priority keywords
- Suggestions box: Actionable improvements for resume

**Integration Points:**
- MyJobs.jsx: Displays in recruiter's application detail modal
- Applications.jsx: Displays in student's application detail modal

### AdminATSPanel Component
**File:** `client/src/components/AdminATSPanel.jsx`

**Purpose:** Allow admins to configure ATS scoring weights

**Features:**
- Input fields for each weight (keyword, skills, experience, formatting)
- Threshold score slider
- Custom keywords textarea
- Save button with validation
- Displays current values from `/admin-ats/ats-settings`
- Validates total weights = 100 before saving

---

## 6. APPLICATION SCORING FLOW

### When Resume is Uploaded (Student)
```
1. Student uploads resume → students.js route handler
2. Extract text from PDF/DOCX
3. AI Analysis on resume text:
   - Call aiService.analyzeResume()
   - Get 5 dimension scores
4. Create ResumeAnalysis record
5. Store in User.studentProfile.aiResumeAnalysis
6. Display on Dashboard with radar chart
```

### When Application is Submitted (Student)
```
1. Student applies to job
2. Create Application record with status: 'applied'
3. NO AUTOMATIC EVALUATION - must be triggered by recruiter
```

### When Recruiter Evaluates Single Application
```
1. Recruiter clicks "Evaluate" on Application detail
2. POST /api/applications/:id/ai-evaluate
3. Backend:
   - Fetch Application with Job details
   - Get ATSSettings from database
   - Parse student resume (base64 or URL)
   - Call calculateScore(parsedResume, jobDescription, settings)
   - Save atsEvaluation to Application
   - Map atsScore to aiEvaluation.matchScore
   - Determine recommendation: Strong/Moderate/Weak based on threshold
   - Persist Application
4. Frontend:
   - Display ATSScoreCard with breakdown
   - Show AI recommendation label
   - Highlight strengths/weaknesses
```

### When Recruiter Ranks All Applicants
```
1. Recruiter clicks "Rank All" on Job list
2. POST /api/applications/job/:jobId/ai-rank
3. Backend:
   - Fetch all applications for job
   - For each application:
     a) Get resume (skip if missing)
     b) Call calculateScore() 
     c) Save atsEvaluation + aiEvaluation
   - Return all ranked applications
4. Results: Sorted by matchScore descending
```

---

## 7. DATA MODELS

### Application Schema (ATS Fields)
```javascript
{
  job: ObjectId,
  student: ObjectId,
  status: 'applied'|'shortlisted'|'interview'|'selected'|'rejected',
  
  // AI Evaluation (from rankCandidateForJob)
  aiEvaluation: {
    matchScore: Number,           // Overall fit %
    skillMatchScore: Number,      // Skill alignment %
    experienceMatchScore: Number, // Experience fit %
    matchPercentage: Number,      // Legacy field (same as matchScore)
    strengthSummary: String,      // 1-2 sentence summary
    riskFactors: [String],        // 2-3 specific risks
    recommendation: 'Strong'|'Moderate'|'Weak',
    lastEvaluated: Date
  },
  
  // ATS Evaluation (from calculateScore)
  atsEvaluation: {
    atsScore: Number,             // Final weighted score 0-100
    keywordMatch: Number,         // Keyword % 0-100
    skillsMatch: Number,          // Skills % 0-100
    experienceMatch: Number,      // Experience % 0-100
    formattingScore: Number,      // Formatting % 0-100
    missingKeywords: [String],    // Top 10 missing keywords
    suggestions: [String]         // Improvement suggestions
  }
}
```

### ATSSettings Schema
```javascript
{
  weights: {
    keywordWeight: 40,      // Default
    skillsWeight: 30,       // Default
    experienceWeight: 20,   // Default
    formattingWeight: 10    // Default
    // Must sum to 100
  },
  customKeywords: [String],      // Admin-configured keywords
  roleBasedSkills: {             // Map: jobRole -> [skills]
    "Software Engineer": ["JavaScript", "React", ...],
    "Data Analyst": ["Python", "SQL", ...],
    ...
  },
  thresholdScore: 60             // Below = "Moderate"/"Weak"
}
```

### ResumeAnalysis Schema
```javascript
{
  studentId: ObjectId,
  resumeScore: Number (0-100),
  technicalSkillsScore: Number (0-20),
  projectsScore: Number (0-20),
  experienceScore: Number (0-20),
  atsScore: Number (0-20),
  clarityScore: Number (0-20),
  strengths: [String],
  weaknesses: [String],
  missingSkills: [String],
  suggestions: [String],
  criteriaBreakdown: {
    technicalSkills: { grade: 'A-F', notes: String },
    projects: { grade: 'A-F', notes: String },
    experience: { grade: 'A-F', notes: String },
    ats: { grade: 'A-F', notes: String },
    clarity: { grade: 'A-F', notes: String }
  }
}
```

---

## 8. SCORING DECISION TREE

```
┌─ Resume Uploaded by Student
└─ AI Analysis Triggered
   ├─ AI Available?
   │  ├─ YES → Call OpenAI API with rubric
   │  │        Extract scores for 5 dimensions
   │  │        Validate range 0-20 each
   │  │        Total = Sum of all 5
   │  │
   │  └─ NO → Fallback Keyword Matching
   │          baseScore = Round(10 + (presenceRatio * 7))
   │          resumeScore = Min(100, baseScore * 5)
   │          All categories = 12-13 (hardcoded)
   │          Grade = 'C' (fallback indicator)
   │
   └─ Store in ResumeAnalysis + User.aiResumeAnalysis
      
┌─ Application Submitted to Job
└─ Awaiting Recruiter Evaluation

┌─ Recruiter Calls AI-Evaluate
└─ ATS Scoring
   ├─ Fetch Job Description + Resume
   ├─ Keyword Matching Scorer:
   │  ├─ Extract 50 most frequent words from JD
   │  ├─ Compare with resume keywords
   │  ├─ Score = (matches / total) * weight(40)
   │  │
   │  ├─ Skills Matching:
   │  │  ├─ Get role-based required skills
   │  │  ├─ Check resume for each skill
   │  │  ├─ Score = (matches / required) * weight(30)
   │  │
   │  ├─ Experience Check:
   │  │  ├─ experienceYears >= 2? (100) : (50)
   │  │  ├─ Score = result * weight(20)
   │  │
   │  ├─ Formatting Check:
   │  │  ├─ jobTitles extracted? (100) : (60)
   │  │  ├─ Score = result * weight(10)
   │  │
   │  └─ Final = Sum all 4 scores above
   │
   └─ Store atsEvaluation + map to aiEvaluation.matchScore

┌─ Display to Recruiter
├─ ATSScoreCard shows breakdown
├─ AI Recommendation badge (Strong/Moderate/Weak)
└─ Suggestion list for resume improvements
```

---

## 9. CURRENT LIMITATIONS & NOTES

1. **Resume Parser Dependencies:**
   - Affinda API (primary) or OpenAI GitHub Models (fallback)
   - If both unavailable: Returns `getFallbackParsing()` with hardcoded structure

2. **AI Analysis Limitations:**
   - Optional feature - works with fallback if unavailable
   - Rate limited to 10 requests/minute for `/api/applications/*/ai-evaluate`
   - OpenAI API key required in environment

3. **Experience Detection:**
   - Simple heuristic: Looks for "2+ years" threshold
   - Doesn't parse exact years from work history

4. **Keyword Weighting:**
   - Basic frequency counting (no semantic analysis)
   - Top 50 words from JD used
   - Custom keywords from admin configuration

5. **Department Penalties:**
   - Only applies in fallback mode
   - Hardcoded list: cs, it, computer, software, ece, electronics
   - 60% penalty multiplier for non-tech departments

6. **Production Deployment:**
   - AI evaluation endpoints NOT rate-limited in current code (uses general limiter)
   - Consider stricter limits for production workloads

---

## 10. INTEGRATION SUMMARY

### Student Experience
1. Upload resume → AI analyzes across 5 dimensions
2. View insights on Dashboard → Radar chart + detailed feedback
3. Apply to job → See ATS feedback in application detail modal
4. Get improvement suggestions → Update resume

### Recruiter Experience
1. View job applications → Option to evaluate or rank all
2. See ATS breakdown → Keywords, skills, experience, formatting
3. View strengths/weaknesses → Make shortlisting decisions
4. Configure ATS → Adjust weights and threshold (→ Admin only)

### Admin Experience
1. Navigate to /admin/ats-settings
2. Adjust scoring weights (must sum to 100)
3. Configure custom keywords and role-based skills
4. Set minimum threshold score for recommendations

---

## 11. KEY FILES QUICK REFERENCE

| Component | File | Purpose |
|-----------|------|---------|
| **Scoring Logic** | `server/utils/atsScorer.js` | Keyword/Skills/Experience/Formatting matching |
| **AI Analysis** | `server/services/aiService.js:517-670` | 5-dimension resume analysis |
| **Candidate Ranking** | `server/services/aiService.js:661-760` | Job-to-candidate fit scoring |
| **App Evaluation** | `server/routes/applications.js:163-250` | Trigger ATS for applications |
| **ATS Config** | `server/routes/adminRoutes.js:1-70` | Manage settings |
| **Resume Scan** | `server/routes/resumeRoutes.js` | Public resume scanning |
| **Frontend Display** | `client/src/components/ATSScoreCard.jsx` | Score visualization |
| **Admin Panel** | `client/src/components/AdminATSPanel.jsx` | Weight configuration |
| **Student View** | `client/src/pages/student/Dashboard.jsx:194-250` | Resume insights radar |
| **Recruiter View** | `client/src/pages/recruiter/MyJobs.jsx:361-420` | Application modal |
| **DB Schema** | `server/models/Application.js:1-30` | Score storage |

---

## 12. DEPLOYMENT ENDPOINTS

**Production URL:** https://uniplacements.vercel.app

**API Base:** `https://uniplacements.vercel.app/api`

**Key Routes:**
- `/api/applications/:id/ai-evaluate` - Recruiter evaluation
- `/api/applications/job/:jobId/ai-rank` - Bulk ranking
- `/api/admin-ats/ats-settings` - ATS configuration (mounted at `/admin-ats`)
- `/api/resume/scan` - Public resume scanning

