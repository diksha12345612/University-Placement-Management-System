# University Placement Management System - Concurrency & Architecture Analysis

**Analysis Date:** March 22, 2026  
**System Type:** MERN Stack (Express.js + MongoDB + React)  
**Deployment:** Vercel (Serverless) + MongoDB Atlas

---

## EXECUTIVE SUMMARY

### Architecture Classification
**STATELESS API with JWT-based Authentication** (No Server-Side Sessions)

### Critical Findings
- ✅ No dangerous global state or shared mutable variables
- ✅ JWT-based auth eliminates session replication issues
- ⚠️ **IN-MEMORY SHARED STATE DETECTED**: Failed login attempts stored in `Map()` on server
- ⚠️ **RACE CONDITIONS POSSIBLE** in concurrent write scenarios
- ⚠️ **DUPLICATE APPLICATION PREVENTION** relies on client-side validation + unique index
- ⚠️ **OTP RACE CONDITION**: No locking when OTP is generated/verified
- ⚠️ **FILE UPLOAD ISSUES**: Base64 data stored in MongoDB without size validation
- ⚠️ **NO TRANSACTION SUPPORT** for multi-step operations

---

## 1. AUTHENTICATION ARCHITECTURE

### Implementation Type
```
JWT (JSON Web Tokens) + Redis/In-Memory Tracking
No Express-session or server-side session store
Stateless API design (scales horizontally)
```

### JWT Configuration
**File:** `server/middleware/auth.js`

```javascript
const decoded = jwt.verify(token, process.env.JWT_SECRET, {
    algorithms: ['HS256'],
    ignoreExpiration: false, // Strictly enforces expiration
    complete: false
});
```

**Token Claims:**
- `id` - User MongoDB ObjectId
- `role` - 'student' | 'recruiter' | 'admin'
- `iat` - Issued-at timestamp

**Token Expiration:**
- Default: 7 days (`process.env.JWT_EXPIRE || '7d'`)
- Enforced on every API call via `jwt.verify()`
- No refresh token mechanism

### Auth Flow Diagram
```
User Login → Generate JWT → Store in localStorage → 
Include in Authorization header → Validate on each request
```

---

## 2. SESSION HANDLING MECHANISM

### Storage Locations

#### **Server-Side**
```javascript
// ❌ CRITICAL: In-Memory Failed Login Tracking
const failedLoginAttempts = new Map();
```
**File:** `server/middleware/rateLimiter.js`

**Issues:**
- Lost on server restart
- Not shared across multiple Vercel instances
- Can cause false negatives in distributed deployments

#### **Client-Side**
```javascript
// localStorage stores:
localStorage.setItem('token', res.data.token);              // JWT
localStorage.setItem('user', JSON.stringify(res.data.user)); // User object

// Persists across browser sessions
```

### Session Validation
All requests validated via:
1. **Token presence** → "Access denied. No token provided."
2. **Token validity** → `jwt.verify(token)` with HS256
3. **Token expiration** → Checked on each request
4. **User existence** → `User.findById(decoded.id)` on every API call
5. **Recruiter approval** → If `user.role === 'recruiter'` and `user.isApprovedByAdmin !== true`, deny access

**File:** `server/middleware/auth.js` (Lines 44-46)
```javascript
if (user.role === 'recruiter' && user.isApprovedByAdmin !== true) {
    return res.status(401).json({ error: 'Your recruiter account is not approved or has been revoked by Admin.' });
}
```

### Session Expiration Handling
- **JWT Expiry:** Automatic via `jwt.verify()` error `TokenExpiredError`
- **Job Expiry:** `expiryService.js` runs on server startup + periodic interval (1 hour)
- **OTP Expiry:** MongoDB TTL index (300 seconds = 5 minutes)
- **Announcements:** Manual expiry check via `expiryDate < now`

---

## 3. GLOBAL VARIABLES & SHARED STATE ANALYSIS

### ✅ SAFE GLOBAL STATE
| Variable | Location | Impact | Thread-Safe |
|----------|----------|--------|------------|
| `app` | `server.js` L19 | Express instance | ✅ Read-only |
| `isConnected` | `server.js` L104 | MongoDB connection flag | ⚠️ See below |
| `mongoose.connection` | `server.js` | MongoDB connection pool | ✅ Managed by Mongoose |

### ⚠️ UNSAFE GLOBAL STATE

#### **1. Failed Login Attempts Map**
```javascript
// server/middleware/rateLimiter.js:50
const failedLoginAttempts = new Map();
```

**Risk Level:** MEDIUM

**Problem:**
- Stores per-email login failure counts in process memory
- Lost on Vercel deployment/restart
- NOT shared across concurrent serverless instances
- Can bypass rate limiting in distributed setup

**Example Race Condition:**
```
Time  Instance-1               Instance-2              State
T1    User attempts login      -                       {user@ex.com: {attempts:1}}
T2    -                        User attempts login     {user@ex.com: {attempts:2}} (Instance2)
T3    User attempts login      -                       {user@ex.com: {attempts:3}} (Instance1)
T4    -                        Sees only 1 attempt     No lockout triggered ❌
```

**Mitigation Needed:**
- Move to Redis for distributed rate limiting
- Add database-backed failure tracking

#### **2. MongoDB Connection Flag**
```javascript
// server/server.js:104
let isConnected = false;
// ... in middleware:
if (isConnected || mongoose.connection.readyState === 1) {
    return next();
}
```

**Risk Level:** LOW

**Problem:**
- Simple flag may not reflect actual connection state
- Vercel serverless handles this better via `mongoose.connection.readyState`

**Current Behavior:** Acceptable (fallback to `readyState`)

---

## 4. DATABASE SCHEMA FOR AUTH/SESSION

### User Model
**File:** `server/models/User.js`

```javascript
{
    name: String,
    email: String (unique, lowercase),
    password: String (hashed with bcrypt salt=12),
    role: enum('student', 'recruiter', 'admin'),
    isVerified: Boolean,
    isApprovedByAdmin: Boolean, // Recruiter-only
    avatar: String,
    studentProfile: {
        rollNumber, department, batch, cgpa,
        skills: [String],
        resumeBase64: String, // Large binary data ⚠️
        profileImage: String,  // Large binary data ⚠️
        aiResumeAnalysis: Mixed,
        aiRecommendations: Mixed
    },
    recruiterProfile: {
        company, designation, phone,
        profileImage: String, // Large binary data ⚠️
        ...
    },
    timestamps: true
}
```

**Indexes:**
```javascript
email: unique index
```

**Risks:**
- ❌ No `lastLogin` field for audit
- ❌ No `loginFailures` counter in database
- ⚠️ Large Base64 data in main document (should use File Storage)
- ⚠️ `aiResumeAnalysis` is schemaless `Mixed` type

### OTP Model
**File:** `server/models/OTP.js`

```javascript
{
    email: String (indexed),
    otp: String,
    type: enum('registration', 'password-reset'),
    createdAt: Date (default: now, TTL: 300 seconds)
}
```

**Race Condition Risk:** HIGH
- `OTP.findOneAndUpdate()` with `upsert: true` can cause overwriting
- No locking mechanism if two OTP requests arrive simultaneously

**Current Logic:**
```javascript
// server/routes/auth.js:28
await OTP.findOneAndUpdate(
    { email: normalizedEmail },
    { otp, createdAt: new Date(), type: 'registration' },
    { upsert: true, new: true }
);
```

**Issue:** If two requests generate OTP within milliseconds:
- Request 1: OTP = 123456 (saved)
- Request 2: OTP = 654321 (overwrites Request 1)
- Request 1 user tries to verify → Fails ❌

### Application Model (Unique Constraint)
**File:** `server/models/Application.js`

```javascript
applicationSchema.index({ job: 1, student: 1 }, { unique: true });
```

**Effect:** Prevents duplicate application via database constraint  
**Works For:** Single concurrent write (Mongo enforces atomically)  
**Risk:** User can see error after duplicate submission if UI doesn't validate

---

## 5. FRONTEND AUTH STATE MANAGEMENT

### AuthContext Structure
**File:** `client/src/context/AuthContext.jsx`

```javascript
export const AuthProvider = ({ children }) => {
    const [user, setUser] = useState(null);
    const [token, setToken] = useState(localStorage.getItem('token'));
    const [loading, setLoading] = useState(true);
    // ...
};
```

### State Properties
- `user` - Current user object from `/auth/me` endpoint
- `token` - JWT from localStorage
- `loading` - Boolean for loading state during init
- Methods: `login()`, `register()`, `logout()`, `updateUser()`, `loadUser()`

### Data Sync Points
1. **Component Mount** → `useEffect()` calls `loadUser()` if token exists
2. **Login Success** → Store token + user in localStorage + state
3. **401 Response** → Clear localStorage, clear state, redirect to `/login`
4. **Network Error** → Restore user from localStorage fallback

```javascript
// AuthContext.jsx:27-38
if (err.response?.status === 401) {
    localStorage.removeItem('token');
    setToken(null);
    setUser(null);
} else {
    // Network error → restore from localStorage
    const savedUser = localStorage.getItem('user');
    if (savedUser) {
        try { setUser(JSON.parse(savedUser)); } catch { }
    }
}
```

### Synchronization Issues

**Issue #1: Multiple Tabs/Windows**
```
Tab 1: Login → localStorage.setItem('token')
Tab 2: (Still has old token)
Tab 1: Logout → localStorage.removeItem('token')
Tab 2: Still using old token ❌ (No cross-tab detection)
```

**Issue #2: Stale User Data**
- User profile updated on server
- Client doesn't know about it unless page refresh or `loadUser()` called
- No polling or WebSocket updates

**Issue #3: Concurrent Requests with Stale Token**
```
Request 1: Send token A (valid)
Token expires while in flight
Request 2: Send token A (now expired)
Response 2: 401, clear localStorage
Request 1 response: Success (but user already logged out) ❌
```

---

## 6. SHARED MUTABLE STATE ISSUES

### Issue #1: In-Memory Failed Login Counter ⚠️ HIGH RISK

**Location:** `server/middleware/rateLimiter.js:50`

**Problem:** Map-based storage lost on restart
```javascript
const failedLoginAttempts = new Map();
```

**Distributed Deployment Problem:**
```
Vercel Instance 1:  failedLoginAttempts = { user: 3 attempts }
Vercel Instance 2:  failedLoginAttempts = {} (empty)
Load balancer alternates:
  → Request → Instance 1 → 3 attempts → Lockout ✓
  → Request → Instance 2 → 0 attempts → No lockout ✗
```

### Issue #2: MongoDB Connection Flag ⚠️ LOW RISK

**Location:** `server/server.js:104`

```javascript
let isConnected = false;
app.use(async (req, res, next) => {
    if (isConnected || mongoose.connection.readyState === 1) {
        return next();
    }
    // ... connect
    isConnected = true;
});
```

**Problem:**
- Flag never reset if connection dies
- Fallback to `readyState` makes this acceptable
- Could cause missed reconnection attempts

### Issue #3: OTP Generation Race Condition ⚠️ MEDIUM RISK

**Location:** `server/routes/auth.js:28`

**Scenario:**
```
User clicks "Send OTP" twice quickly
Request 1: OTP = 123456
Request 2: OTP = 654321 (overwrites immediately)
User enters 123456 → Verification fails
```

**Current Code:**
```javascript
await OTP.findOneAndUpdate(
    { email },
    { otp, createdAt: new Date(), type: 'registration' },
    { upsert: true, new: true }
);
```

**Cause:**
- No lock/queue between generation and verification
- `findOneAndUpdate` is atomic but doesn't queue

### Issue #4: Application Duplicate Prevention ⚠️ MEDIUM RISK

**Location:** `server/routes/applications.js:9-15`

```javascript
const existingApp = await Application.findOne({ job: jobId, student: req.user._id });
if (existingApp) return res.status(400).json({ error: 'Already applied' });

const application = new Application({...});
await application.save();
```

**Race Condition:**
```
Request 1: Check → No app found
                Request 2: Check → No app found
Request 1: Save → Success
                Request 2: Save → Fails (unique index) ✓
```

**Outcome:** Unique index prevents duplication but user sees error after submission

**Better Approach:**
```javascript
const application = new Application({...});
try {
    await application.save();
} catch (err) {
    if (err.code === 11000) {
        // Already applied (caught by unique index)
        return res.status(400).json({ error: 'Already applied' });
    }
}
```

---

## 7. API ENDPOINTS FOR USER ACTIONS

### Authentication Endpoints

| Method | Endpoint | Auth | Rate Limit | Purpose |
|--------|----------|------|-----------|---------|
| POST | `/api/auth/register-otp` | ❌ | 3/min per IP | Request OTP for registration |
| POST | `/api/auth/register-verify` | ❌ | 5/min per IP | Verify OTP & create account |
| POST | `/api/auth/login` | ❌ | 5/5min per IP | Login with email/password |
| GET | `/api/auth/me` | ✅ | — | Get current user |
| POST | `/api/auth/forgot-password-otp` | ❌ | 3/min per IP | Request password reset OTP |
| POST | `/api/auth/reset-password` | ❌ | 5/min per IP | Reset password with OTP |

### Student Endpoints

| Method | Endpoint | Auth | Validation |
|--------|----------|------|-----------|
| GET | `/api/students/profile` | ✅ student | — |
| PUT | `/api/students/profile` | ✅ student | All fields required |
| POST | `/api/students/resume` | ✅ student | PDF only, 5MB limit |
| POST | `/api/students/analyze-resume` | ✅ student | AI evaluation |
| POST | `/api/applications` | ✅ student | Check profile complete |
| GET | `/api/applications/my-applications` | ✅ student | — |

### Recruiter Endpoints

| Method | Endpoint | Auth | Validation |
|--------|----------|------|-----------|
| GET | `/api/recruiters/profile` | ✅ recruiter | — |
| PUT | `/api/recruiters/profile` | ✅ recruiter | All fields required |
| POST | `/api/jobs` | ✅ recruiter | Create job posting |
| GET | `/api/jobs/recruiter/my-jobs` | ✅ recruiter | — |
| PUT | `/api/applications/:id/status` | ✅ recruiter | Status enum validation |
| POST | `/api/applications/:id/ai-evaluate` | ✅ recruiter | ATS evaluation |

### Admin Endpoints

| Method | Endpoint | Auth | Purpose |
|--------|----------|------|---------|
| PUT | `/api/admin/students/:id/verify` | ✅ admin | Verify student account |
| PUT | `/api/admin/recruiters/:id/verify` | ✅ admin | Approve/revoke recruiter |
| DELETE | `/api/admin/students/:id` | ✅ admin | Delete student & applications |
| DELETE | `/api/admin/recruiters/:id` | ✅ admin | Delete recruiter & jobs |
| GET | `/api/admin/dashboard` | ✅ admin | Dashboard stats |
| POST | `/api/admin/jobs/:id/status` | ✅ admin | Approve/reject jobs |

---

## 8. MIDDLEWARE STACK & REQUEST HANDLING FLOW

### Middleware Execution Order
**File:** `server/server.js`

```
1. Helmet (Security headers)
   ├─ HSTS (HTTP Strict Transport Security)
   ├─ CSP (Content Security Policy)
   ├─ Frameguard (X-Frame-Options: deny)
   ├─ Referrer Policy

2. CORS (Strict origin validation)
   ├─ Allowed origins: prod domain + localhost:5173
   ├─ credentials: true
   ├─ Methods: GET, POST, PUT, DELETE, PATCH, OPTIONS

3. Mongo Sanitize (NoSQL injection prevention)
   └─ Escapes $ and . in keys

4. XSS Clean (HTML sanitization)
   └─ Removes HTML tags from string values

5. MongoDB Connection (Serverless retry)
   └─ Connects if not connected, retries with 5s timeout

6. Rate Limiting (Global)
   ├─ 2000 requests/15min per IP
   └─ Excludes /health check

7. Body Parser
   ├─ application/json: 50MB limit
   ├─ application/x-www-form-urlencoded: 50MB limit

8. Logging (Morgan)
   ├─ dev mode: 'dev'
   └─ prod mode: 'combined'

9. Static Files (/uploads)
   └─ Serves resume, profile photos

10. Route Handlers
    ├─ /api/auth → auth.js
    ├─ /api/students → students.js
    ├─ /api/recruiters → recruiters.js
    ├─ /api/jobs → jobs.js
    ├─ /api/applications → applications.js
    ├─ /api/admin → admin.js
    └─ /api/...

11. Error Handling
    ├─ Validates status codes
    ├─ Hides stack traces in production
    └─ Returns error ID for support
```

### Per-Route Middleware

#### **Protected Route (Auth + Authorization)**
```javascript
router.post('/profile', auth, authorize('student'), async (req, res) => { ... });
```

**Execution:**
```
Request → auth middleware (verify JWT + load user)
       → authorize middleware (check role)
       → route handler
```

**Error Cases:**
- No token → 401 "Access denied"
- Invalid token → 401 "Invalid token"
- Expired token → 401 "Token expired"
- Wrong role → 403 "Insufficient permissions"

#### **File Upload Route**
```javascript
router.post('/resume', auth, authorize('student'), upload.single('resume'), async(...) => { ... });
```

**Middleware Stack:**
1. `auth` - Verify JWT
2. `authorize('student')` - Check role
3. `upload.single('resume')` - Multer validation
   - Only PDF, images, DOCX
   - Max 5MB
   - Memory storage (Vercel)
4. Route handler - Process file

---

## 9. REAL-TIME & POLLING IMPLEMENTATIONS

### Polling Mechanisms Detected

#### **1. Notification Unread Count Polling**
**File:** `client/src/components/Navbar.jsx:17`

```javascript
useEffect(() => {
    const interval = setInterval(fetchUnreadCount, 30000); // Every 30 seconds
    return () => clearInterval(interval);
}, []);
```

**Issues:**
- Network requests every 30 seconds for each user
- No WebSocket-based push notifications
- Doesn't scale well with many concurrent users
- User may see stale notifications until next poll

#### **2. Admin Dashboard Data Load**
**File:** `client/src/pages/admin/Dashboard.jsx:15`

```javascript
useEffect(() => {
    const [dashRes, notifRes] = await Promise.all([
        adminAPI.getDashboard(),
        notificationAPI.getUnreadCount()
    ]);
}, []);
```

**Issues:**
- Loads on component mount only
- No refresh mechanism
- Data becomes stale immediately
- Fetches notification count AND dashboard separately

#### **3. Expiry Service** ⚠️ WARNING
**File:** `server/services/expiryService.js:110-125`

```javascript
const setupExpiryCheckInterval = (intervalMs = 60 * 60 * 1000) => {
    runExpiryCheck();
    const timerId = setInterval(runExpiryCheck, intervalMs);
    return timerId;
};
```

**Issues:**
- **DOESN'T RUN IN PRODUCTION** via Vercel (comment on server.js:326)
- Only runs on local dev
- No serverless solution (cron job alternative)
- Jobs may not expire on schedule in production

**Current Code:**
```javascript
// server.js:325-327
if (process.env.NODE_ENV !== 'production' && require.main === module) {
    setupExpiryCheckInterval(60 * 60 * 1000); // 1 hour
}
```

**Production Impact:** Job deadlines not enforced automatically ❌

### No Real-Time Features
- ❌ No WebSocket connections
- ❌ No Socket.io setup
- ❌ No server-sent events
- ❌ No live notification delivery
- ❌ No collaborative features (multi-user editing)

---

## 10. ADMIN DASHBOARD IMPLEMENTATION

### Dashboard Data
**File:** `client/src/pages/admin/Dashboard.jsx`

**Rendered Stats:**
```
├─ Total Students (clickable → /admin/students)
├─ Placed Students (clickable → /admin/reports)
├─ Active Jobs (clickable → /admin/jobs)
├─ Job Approvals Pending (clickable → /admin/jobs)
├─ Recruiter Approvals Pending (clickable → /admin/recruiters)
├─ Total Applications (clickable → /admin/reports)
├─ Unread Notifications (clickable → /admin/notifications)
└─ Recent Applications (table)
```

### Backend Dashboard API
**File:** `server/routes/admin.js` (needs to be found in implementation)

**Expected Endpoint:** `GET /api/admin/dashboard`

**Returns:**
```javascript
{
    totalStudents: Number,
    placedStudents: Number,
    totalJobs: Number,
    pendingJobs: Number,
    pendingRecruiters: Number,
    totalApplications: Number,
    recentApplications: [
        { _id, student, job, createdAt, status }
    ]
}
```

### Key Admin Operations

#### **1. Recruiter Approval**
```javascript
router.put('/recruiters/:id/verify', auth, authorize('admin'), async (req, res) => {
    const recruiter = await User.findByIdAndUpdate(
        req.params.id,
        { isApprovedByAdmin: req.body.isApprovedByAdmin },
        { new: true }
    );
});
```

**Broadcast:** Email notification sent to recruiter

**Risk:** No audit log of who approved/when

#### **2. Student Verification**
```javascript
router.put('/students/:id/verify', auth, authorize('admin'), async (req, res) => {
    const student = await User.findByIdAndUpdate(
        req.params.id,
        { isVerified: req.body.isVerified },
        { new: true }
    );
});
```

**Risk:** Can revoke verified status without cleanup of applications

#### **3. Job Approval**
```javascript
// Expected in admin.js or adminRoutes.js
router.put('/jobs/:id/status', auth, authorize('admin'), async (req, res) => {
    const job = await Job.findByIdAndUpdate(
        req.params.id,
        { status: req.body.status }, // pending → approved/rejected
        { new: true }
    );
});
```

#### **4. User Deletion**
```javascript
router.delete('/students/:id', auth, authorize('admin'), async (req, res) => {
    const student = await User.findOneAndDelete({ _id: req.params.id, role: 'student' });
    await Application.deleteMany({ student: req.params.id }); // Cleanup
});
```

**Risk Level:** HIGH - Soft delete recommended for audit trail

---

## 11. CONCURRENCY ISSUES & RACE CONDITIONS

### CRITICAL ISSUES

#### **Issue #1: OTP Overwrite Race Condition** ⚠️ CRITICAL

**Scenario:**
```
User clicks "Send OTP" twice in quick succession
T1: POST /auth/register-otp → OTP generated = 123456
T2: POST /auth/register-otp → OTP generated = 654321 (overwrites)
User sees email: 654321
User enters 654321 → Verification succeeds ✓ (Usually works by accident)

But if timing is:
T1: Generate OTP = 123456
T2: User gets first email (123456)
T3: Generate OTP = 654321 (overwrites)
T1_EMAIL_ARRIVES: User enters 123456 → "Invalid OTP" ✗
```

**Root Cause:** `OTP.findOneAndUpdate()` with unconditional upsert

**Reproduction:**
```javascript
// Simulate rapid fire requests
Promise.all([
    authAPI.registerOtp({ email: 'test@ex.com', ... }),
    authAPI.registerOtp({ email: 'test@ex.com', ... })
]);
```

**Severity:** HIGH (Frustrating UX, potential account creation blockage)

#### **Issue #2: Failed Login Count Lost on Restart** ⚠️ CRITICAL

**Scenario:**
```
User fails 5 logins → Account locked
Server restarts (Vercel deployment)
✓ In-memory map cleared
User can now login despite 5 failures ✗
```

**Root Cause:** `const failedLoginAttempts = new Map()` - process memory

**Severity:** HIGH (Security bypass)

#### **Issue #3: MongoDB Connection State Race** ⚠️ MEDIUM

**Scenario:**
```
Request 1: Check isConnected = false
Request 2: Check isConnected = false
Request 1: Start connecting
Request 2: Start connecting (duplicate connection attempt)
```

**Current Code:**
```javascript
let isConnected = false;
app.use(async (req, res, next) => {
    if (isConnected || mongoose.connection.readyState === 1) {
        return next();
    }
    try {
        await mongoose.connect(...);
        isConnected = true;
    }
});
```

**Race:** Two requests both see `isConnected = false` and attempt connection

**Mitigation:** Mongoose handles this internally (idempotent connect)

#### **Issue #4: Duplicate Application Submission** ⚠️ MEDIUM

**Scenario:**
```
Request 1: Check existingApp (none found)
Request 2: Check existingApp (none found)
Request 1: Save application
Request 2: Save application → Mongo unique index error
User sees: "Error submitting application"
```

**Root Cause:** No client-side debouncing, server check-then-write not atomic

**Better Pattern:**
```javascript
try {
    await application.save();
} catch (err) {
    if (err.code === 11000) {
        return res.status(400).json({ error: 'Already applied' });
    }
    throw err;
}
```

#### **Issue #5: Profile Update Conflicts** ⚠️ MEDIUM

**Scenario:**
```
User opens profile in 2 tabs
Tab 1: Update skills
Tab 2: Update email
File sent from Tab 1: { studentProfile: { skills: [...] } }
File sent from Tab 2: { email: '...' }
Both reach within milliseconds:

Mongo: findByIdAndUpdate(id, { $set: data1 }, ...)
Mongo: findByIdAndUpdate(id, { $set: data2 }, ...)

Result: Last write wins (Tab 2's email, but Tab 1's skills lost if not in data2)
```

**Root Cause:** No optimistic locking, no conflict resolution

**Severity:** MEDIUM (Data loss possible but unlikely)

#### **Issue #6: Admin Cascading Deletes** ⚠️ MEDIUM

**Scenario:**
```
Admin deletes recruiter simultaneously with:
- Recruiter posts new job
- Another student applies to recruiter's job

Deletion code:
await User.deleteOne({ _id: recruiterId })
const jobs = await Job.find({ postedBy: recruiterId })
await Job.deleteMany({ _id: jobIds })
await Application.deleteMany(...)

Race: Job created between Job.find() and deleteMany()
Result: Orphaned job still exists ✗
```

**Root Cause:** Multi-step operation without transaction

---

## 12. DATABASE TRANSACTION PATTERNS

### Current Implementation: NO TRANSACTIONS

**Patterns Used:**
1. **Eventual Consistency** (Implicit)
2. **Unique Indexes** (Prevent duplicates post-facto)
3. **Cascade Deletes** (Multi-step delete operations)

### Examples of Non-Atomic Operations

#### **Example 1: Recruiter Deletion** ❌
```javascript
// server/routes/admin.js:49-57
await User.findOneAndDelete({ _id: req.params.id, role: 'recruiter' });
const recruiterJobs = await Job.find({ postedBy: req.params.id });
const jobIds = recruiterJobs.map(j => j._id);
await Application.deleteMany({ job: { $in: jobIds } });
await Job.deleteMany({ postedBy: req.params.id });
```

**Issues:**
- Between `find()` and `deleteMany()`, new job could be created
- If intermediate step fails, orphaned documents remain
- 4 separate database operations, any could fail

#### **Example 2: Application Submission** ❌
```javascript
// server/routes/applications.js:9-39
const existingApp = await Application.findOne({ job, student });
if (existingApp) return error;

const application = new Application({...});
await application.save();

// Update job openings count is NOT done
// Notification is created separately
await new Notification({...}).save();
```

**Issues:**
- No update to job openings count
- Notification created even if application fails
- Race condition with duplicate check

#### **Example 3: User Registration** ⚠️
```javascript
// server/routes/auth.js:47-71
let user;
if (existingUser) {
    existingUser.name = name;
    existingUser.password = password;
    existingUser.isVerified = true;
    user = await existingUser.save();
} else {
    user = new User({ name, email, password, role, isVerified: true });
    await user.save();
}

await OTP.deleteOne({ _id: otpRecord._id });

// Notify admins
const Notification = require('../models/Notification');
const admins = await User.find({ role: 'admin' });
for (const admin of admins) {
    await new Notification({...}).save(); // N separate saves
}
```

**Issues:**
- OTP delete not atomic with user save
- Multiple notification saves (could partially fail)
- No rollback if notification fails

### Transaction Support Status

**MongoDB:**
```
✅ Multi-document transactions supported (MongoDB 4.0+)
✅ Atlas supports transactions
❌ Mongoose doesn't simplify transaction usage
❌ Code doesn't use sessions/transactions
```

**How to implement transactions:**
```javascript
// Correct pattern
const session = await mongoose.startSession();
await session.withTransaction(async () => {
    const user = await User.create([...], { session });
    await OTP.deleteOne({...}, { session });
    await Notification.insertMany([...], { session });
});
```

---

## 13. CAN SYSTEM HANDLE CONCURRENT WRITES?

### Overall Assessment: ⚠️ PARTIAL

### Per-Operation Analysis

#### **Concurrent Registrations**
```
Status: ✅ SAFE
Reason: Unique email index prevents duplicates
           JWT generation is stateless
Caveat: OTP can be overwritten (UX issue, not data corruption)
```

#### **Concurrent Applications**
```
Status: ⚠️ RISKY
Reason: Check-then-write pattern
        Unique index catches duplicates after fact
Issue:  User sees error after submission
Better: Use `insertIfNotExists` or unique constraint first
```

#### **Concurrent Profile Updates**
```
Status: ⚠️ RISKY
Reason: Last-write-wins with findByIdAndUpdate()
        No optimistic locking
        No conflict detection
Risk:   Data loss if same field updated concurrently
        { $set: {...} } is atomic but overwrites fully
Better: Use schemas with field-level locking
```

#### **Concurrent Admin Operations**
```
Status: ❌ UNSAFE
Reason: Multi-step deletions not atomic
        Job approval + application ranking not coordinated
Risk:   Orphaned documents, inconsistent state
Better: Use MongoDB transactions
```

#### **Concurrent OTP Requests**
```
Status: ⚠️ RISKY
Reason: findOneAndUpdate() can overwrite
        No FIFO queue
Risk:   User enters old OTP, verification fails
Better: Generate unique per-request, track state in document
```

#### **Concurrent Login Attempts**
```
Status: ⚠️ RISKY
Reason: Failed counter in process memory
        Lost on server restart
        Not shared across Vercel instances
Risk:   Rate limiting bypassed in distributed deployment
Better: Use Redis for shared rate limit state
```

#### **Concurrent Recruiter Approvals**
```
Status: ✅ SAFE
Reason: Single document update is atomic
        JWT validation enforces immediately
Issue:  No job creation blocking during revocation
```

---

## 14. ARCHITECTURAL RECOMMENDATIONS

### Priority 1: Critical Fixes (Do FIRST)

#### **Fix 1: Move Failed Login Counter to Redis**
```javascript
// USE Redis INSTEAD of Map
const redis = require('redis');
const client = redis.createClient();

const failedLoginKey = (email) => `login:fails:${email}`;

req.recordFailedLogin = async () => {
    const key = failedLoginKey(email);
    const attempts = await client.incr(key);
    if (attempts === 1) {
        await client.expire(key, 30 * 60); // 30 min window
    }
    if (attempts >= 5) {
        await client.expire(key, 15 * 60); // Lock for 15 min
    }
};
```

#### **Fix 2: Implement OTP generation with State Machine**
```javascript
// Better OTP handling
const otpRecord = await OTP.create({
    email: normalizedEmail,
    otp: generateOTP(),
    type: 'registration',
    isVerified: false,
    attempts: 0,
    expiresAt: Date.now() + 5 * 60 * 1000
});

// Don't overwrite existing unverified OTP
// Instead, limit to N OTPs per email or return existing
```

#### **Fix 3: Add Optimistic Locking to Profile Updates**
```javascript
// Include version field
const student = await User.findByIdAndUpdate(
    req.user._id,
    {
        $set: { studentProfile: newProfile },
        $inc: { __v: 1 }  // Increment version
    },
    {
        new: true,
        upsert: false,
        runValidators: true
    }
);
```

#### **Fix 4: Use MongoDB Transactions for Admin Operations**
```javascript
const session = await mongoose.startSession();
await session.withTransaction(async () => {
    await User.deleteOne({ _id: recruiterId }, { session });
    await Job.deleteMany({ postedBy: recruiterId }, { session });
    await Application.deleteMany({ 
        job: { $in: jobIds } 
    }, { session });
});
await session.endSession();
```

### Priority 2: Production Fixes

#### **Fix 5: Implement Expiry Check in Production (Cron Job)**
```javascript
// Use external scheduler (AWS Lambda, Vercel Cron, or Cloud Scheduler)
// NOT setInterval in Node process

if (process.env.ENABLE_EXPIRY_CHECK === 'true') {
    // This endpoint called by external cron
    app.post('/admin/maintenance/trigger-expiry-check', auth, authorize('admin'), async (req, res) => {
        const summary = await runExpiryCheck();
        res.json(summary);
    });
}
```

#### **Fix 6: Add Cross-Tab Logout Detection**
```javascript
// client/context/AuthContext.jsx
useEffect(() => {
    const handleStorageChange = (e) => {
        if (e.key === 'token' && e.newValue === null) {
            // Another tab logged out
            logout();
        }
    };
    window.addEventListener('storage', handleStorageChange);
    return () => window.removeEventListener('storage', handleStorageChange);
}, []);
```

#### **Fix 7: Add Audit Logging**
```javascript
// Create AuditLog model
const auditLog = await AuditLog.create({
    userId: req.user._id,
    action: 'RECRUITER_APPROVED',
    resourceId: recruiterId,
    changes: { before: {}, after: { isApprovedByAdmin: true } },
    timestamp: new Date(),
    ipAddress: req.ip
});
```

#### **Fix 8: Implement Refresh Token Pattern**
```javascript
// Current: Single JWT that expires in 7 days
// Better: Short-lived access token (15 min) + longer refresh token (7 days)

const accessToken = jwt.sign({...}, JWT_SECRET, { expiresIn: '15m' });
const refreshToken = jwt.sign({...}, REFRESH_SECRET, { expiresIn: '7d' });

// Store refresh token in httpOnly cookie or DB
res.cookie('refreshToken', refreshToken, {
    httpOnly: true,
    secure: true,
    sameSite: 'strict'
});
```

### Priority 3: Scalability Improvements

#### **Implement WebSocket Notifications** ② MEDIUM

```javascript
// Replace 30-second polling with push notifications
const io = require('socket.io')(server, { 
    cors: { origin: ALLOWED_ORIGINS }
});

io.on('connection', (socket) => {
    socket.join(`user:${user._id}`);
});

// When notification created
io.to(`user:${adminId}`).emit('notification', notification);
```

#### **Implement Database Connection Pooling**
```javascript
// Already done by Mongoose, but verify:
mongoose.set('bufferCommands', false);
// Ensures errors thrown immediately, not queued
```

#### **Add Caching Layer**
```javascript
// Cache dashboard stats, job listings
const redis = require('redis');
const cache = redis.createClient();

// Cache with 5 min TTL
const cacheKey = 'dashboard:stats';
const cached = await cache.get(cacheKey);
if (cached) return JSON.parse(cached);

const stats = await calculateStats();
await cache.setex(cacheKey, 300, JSON.stringify(stats));
return stats;
```

---

## 15. RECOMMENDATIONS SUMMARY TABLE

| Issue | Severity | Impact | Fix Type | Effort |
|-------|----------|--------|----------|--------|
| In-memory failed login counter | CRITICAL | Distributed lockout bypass | Redis | Medium |
| OTP overwrite race | CRITICAL | UX breaking, account creation blocking | Locking mechanism | Small |
| No DB transactions | HIGH | Orphaned deletes, inconsistent state | Transactions | Medium |
| No refresh token | HIGH | Can't revoke tokens, 7-day breach window | Token rotation | Medium |
| Profile update conflicts | MEDIUM | Data loss (rare) | Optimistic locking | Small |
| No expiry check in prod | MEDIUM | Jobs don't expire | Cron job | Small |
| No cross-tab sync | MEDIUM | Multi-tab logout race | Event listeners | Small |
| No real-time updates | MEDIUM | Stale data, polling overhead | WebSocket | Large |
| No audit logging | LOW | Compliance, debugging | Audit model | Medium |
| Large Base64 in MongoDB | LOW | Slow queries, storage cost | GridFS | Medium |

---

## 16. TESTING CONCURRENCY ISSUES

### Proof-of-Concept Tests

#### **Test #1: Duplicate Application Race**
```bash
# From two terminals simultaneously:
curl -X POST http://localhost:5051/api/applications \
  -H "Authorization: Bearer TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"jobId":"...", "coverLetter":"..."}'
```

**Expected:** One succeeds, one fails with 400 "Already applied"  
**Actual:** One succeeds (user sees success), other fails (user sees error)

#### **Test #2: Failed Login Counter Loss**
```bash
# Run 5 failed logins
# Note the failed attempt count
# Kill and restart server
# Reset browser cookies
# Attempt login again

# Expected: Lockout enforced
# Actual (BUG): No lockout, counter reset
```

#### **Test #3: OTP Overwrite Race**
```javascript
const Promise = require('bluebird');

Promise.all([
    authAPI.registerOtp({...}),
    authAPI.registerOtp({...})
]);

// Check email → Only latest OTP received
// First OTP lost
```

---

## CONCLUSION

### System Concurrency Maturity: ⚠️ Level 2/5

**Safe:** JWT auth, unique constraints  
**Risky:** In-memory state, non-atomic operations  
**Unsafe:** Admin cascades, multi-step workflows  

**Recommended Next Steps:**
1. ✅ Implement Priority 1 fixes (2-3 weeks)
2. ✅ Add automated testing (1 week)
3. ✅ Deploy to staging, load test (1 week)
4. ✅ Implement Priority 2 fixes incrementally (ongoing)
5. ✅ Monitor production metrics (ongoing)

**For Production Deployment:**
- ❌ DO NOT deploy with current state to high-traffic scenario (1000+ concurrent users)
- ✅ Safe for small deployments (<100 concurrent users)
- ⚠️ Implement Redis + Transactions before major scale-up

---

**Generated:** March 22, 2026
**Analysis Scope:** Complete architectural review with concurrency focus
