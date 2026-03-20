# 🔒 Developer Security Guidelines

**This document outlines security best practices for the University Placement Portal project.**

---

## ⚡ TL;DR - Quick Rules

1. ✅ **NEVER commit secrets to Git**
2. ✅ **NEVER hardcode credentials in code**
3. ✅ **ALWAYS use environment variables**
4. ✅ **ALWAYS use hosting provider's secrets management**
5. ✅ **ALWAYS rotate credentials regularly**

---

## 1. Local Development Setup

### Step 1: Create Local .env File
```bash
# Create .env.local (never commit this)
cp .env.example .env.local
```

### Step 2: Fill with Your Local Credentials
```bash
# .env.local
MONGODB_URI=mongodb://localhost:27017/placement_portal_dev
JWT_SECRET=develop-secret-key-here
EMAIL_USER=your-email@gmail.com
EMAIL_PASS=your-gmail-app-password
OPENROUTER_API_KEY=your-key
AFFINDA_API_KEY=your-key
GITHUB_TOKEN=your-token
NODE_ENV=development
PORT=5051
FRONTEND_URL=http://localhost:5173
```

### Step 3: Never Commit It
```bash
# Already in .gitignore - verify:
git status  # Should NOT show .env.local
```

---

## 2. Environment Variables Reference

### Backend (.env.local or .env.production)
```
MONGODB_URI          → Local: mongodb://localhost:27017/db | Prod: Atlas URI
JWT_SECRET          → Development secret (change for production)
JWT_EXPIRE          → Token expiry (7d, 30d, etc)
NODE_ENV            → development | production | staging
FRONTEND_URL        → http://localhost:3000 | https://app.vercel.app
EMAIL_USER          → Your Gmail account
EMAIL_PASS          → Gmail app password (NOT account password)
ADMIN_EMAIL         → Admin contact
OPENROUTER_API_KEY → SK key from OpenRouter dashboard
AFFINDA_API_KEY     → API key from Affinda dashboard
GITHUB_TOKEN        → PAT from GitHub settings
```

### Frontend (.env.local or build-time)
```
VITE_API_URL  → http://localhost:5051/api | https://api.domain.com/api
NODE_ENV      → development | production
```

### Server (.env.local or .env.production)
```
# Same as backend
```

---

## 3. Using Secrets in Code

### ❌ WRONG - Never Do This
```javascript
// ❌ WRONG - Hardcoded credential
const API_KEY = "[REDACTED-AFFINDA-KEY]";
const DB_URL = "mongodb+srv://admin:password@cluster.mongodb.net/db";
const JWT_SECRET = "super_secret_key";

// ❌ WRONG - In configuration files
const config = {
  apiKey: "sk-or-v1-xxxxx",
  password: "password123"
};
```

### ✅ RIGHT - Always Do This
```javascript
// ✅ RIGHT - Use environment variables
const API_KEY = process.env.AFFINDA_API_KEY;
const DB_URL = process.env.MONGODB_URI;
const JWT_SECRET = process.env.JWT_SECRET;

// With validation
if (!process.env.JWT_SECRET) {
  throw new Error('JWT_SECRET environment variable is required');
}

// In config files
const config = {
  apiKey: process.env.OPENROUTER_API_KEY,
  jwtSecret: process.env.JWT_SECRET
};
```

### Frontend (Vite)
```javascript
// ✅ Frontend variables are exposed - only non-secret data
const API_URL = import.meta.env.VITE_API_URL;

// ❌ Never put secrets here
// import.meta.env.VITE_SECRET_KEY is visible in browser!
```

---

## 4. Git Security Setup

### Install Pre-commit Hook (Recommended)
```bash
# Install git-secrets to prevent accidental commits
npm install --save-dev husky

# Initialize husky
npx husky install

# Create pre-commit hook to detect secrets
npx husky add .husky/pre-commit "npm run security-check"

# Add to package.json:
"security-check": "git-secrets --scan"
```

### Alternative: Install git-secrets
```bash
# macOS
brew install git-secrets

# Linux
git clone https://github.com/awslabs/git-secrets.git
cd git-secrets
make install

# Windows - use git-secrets via npm
npm install --save-dev git-secrets

# Scan before committing
git secrets --scan
```

---

## 5. Production Deployment

### Vercel Deployment
```bash
# Set secrets in Vercel Dashboard:
# 1. Go to Project Settings
# 2. Go to Environment Variables
# 3. Add variables with scope: Production, Preview, Development

# Do NOT use:
vercel env add KEY value  # This is for local preview

# Use Vercel Console instead:
# Settings → Environment Variables → Add
```

### Vercel CLI Setup
```bash
# Login to Vercel
vercel login --token $VERCEL_TOKEN

# Pull production secrets (for local preview)
vercel env pull

# This creates .env.local with production secrets - ADD TO .GITIGNORE!
```

### Manual Deployment
```bash
# Create .env.production locally (never commit)
cp .env.example .env.production

# Fill with production secrets
nano .env.production
# or
code .env.production

# Deploy
npm run build
npm run deploy

# Then delete .env.production
rm .env.production
```

### GitHub Actions Setup
```yaml
# .github/workflows/deploy.yml
name: Deploy

on:
  push:
    branches: [main, production]

jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      
      # Use GitHub Secrets, NOT .env files
      - name: Deploy
        env:
          MONGODB_URI: ${{ secrets.PROD_MONGODB_URI }}
          JWT_SECRET: ${{ secrets.PROD_JWT_SECRET }}
          # ... more secrets
        run: npm run deploy
```

---

## 6. Rotating Secrets

### When to Rotate
- [ ] After every developer leaves the team
- [ ] Quarterly (3 months)
- [ ] After a security incident
- [ ] When credentials are exposed
- [ ] When moving to a new provider

### How to Rotate

#### Step 1: Generate New Secret
```bash
# New JWT secret
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"

# New API key: Regenerate from provider dashboard
```

#### Step 2: Update Old Secret
```bash
# Update in Vercel
vercel env update JWT_SECRET [new-secret] production

# Or through Vercel dashboard
# Settings → Environment Variables → Update
```

#### Step 3: Force Password Reset
```javascript
// For user sessions, consider:
// - Logout all users
// - Invalidate all session tokens
// - Force re-authentication
```

#### Step 4: Revoke Old Secret
```bash
# GitHub: Settings → Developer Settings → Personal access tokens → Delete
# MongoDB: Users → Delete old user
# API Providers: Delete old key
```

---

## 7. Incident Response

### If You Accidentally Commit a Secret

```bash
# 1. IMMEDIATELY revoke that credential
#    (Do this first, before anything else!)

# 2. Remove from current commit
git reset HEAD~1  # Undo last commit
rm .env           # Remove the file
git add -A
git commit -m "Remove credentials (will clean history)"

# 3. Force push (⚠️ only if possible)
git push --force-with-lease

# 4. Clean Git history
#    Use BFG Repo-Cleaner or git filter-branch
#    (This is complex, contact security team)

# 5. Notify team immediately
#    Post-incident review
#    Update processes to prevent recurrence
```

### If You Suspect a Breach
```bash
# 1. Immediately revoke all credentials
# 2. Rotate all passwords
# 3. Check access logs for unauthorized access
# 4. Notify stakeholders
# 5. Enable MFA everywhere
# 6. Force password reset for all users
```

---

## 8. Security Checklist

### Before Committing Code
- [ ] No `.env` files in staging area (`git status`)
- [ ] No hardcoded API keys or passwords
- [ ] All secrets use `process.env.VAR_NAME`
- [ ] `.gitignore` has `.env*` entries
- [ ] No credentials in comments or debug logs
- [ ] No sensitive data in error messages

### Before Deploying to Production
- [ ] All `.env.production` secrets updated in provider
- [ ] `.env.production` file locally deleted
- [ ] Database migration credentials are different
- [ ] API keys are valid and have correct scopes
- [ ] JWT secret is strong (32+ chars, random)
- [ ] Email credentials tested
- [ ] All environment variables are defined
- [ ] Logging doesn't leak secrets

### After Deployment
- [ ] Monitor logs for errors (without exposing secrets)
- [ ] Check for unauthorized access attempts
- [ ] Verify all services are running
- [ ] Test critical functionality
- [ ] Update runbooks with new information
- [ ] Notify team of changes

---

## 9. Tools & Resources

### Recommended Tools
- **Vercel Secrets** - https://vercel.com/docs/concepts/projects/environment-variables
- **git-secrets** - https://github.com/awslabs/git-secrets
- **detect-secrets** - https://github.com/Yelp/detect-secrets
- **Husky** - https://typicode.github.io/husky/ (Git hooks)
- **BFG Repo-Cleaner** - https://rtyley.github.io/bfg-repo-cleaner/
- **OWASP Cheat Sheets** - https://cheatsheetseries.owasp.org/

### Learning Resources
- [OWASP: Secrets Management](https://cheatsheetseries.owasp.org/cheatsheets/Secrets_Management_Cheat_Sheet.html)
- [Vercel: Environment Variables](https://vercel.com/docs/concepts/projects/environment-variables)
- [GitHub: Protecting Credentials](https://docs.github.com/en/code-security/secret-scanning)
- [MongoDB: Security Checklist](https://docs.mongodb.com/manual/security/)

---

## 10. FAQ

**Q: Can I commit .env.example?**  
A: Yes! But only with PLACEHOLDER values, no real credentials.

**Q: What about email passwords?**  
A: Use Gmail App Passwords, not your main password. Treat as secret!

**Q: How do I test locally?**  
A: Use .env.local (ignored by Git) with test credentials.

**Q: Can I share .env files?**  
A: Never via email/chat. Use your hosting provider's secrets manager or 1Password.

**Q: What scopes should GitHub PAT have?**  
A: Minimum required. For CI/CD, use `repo` scope only.

**Q: How often to rotate?**  
A: Minimum quarterly, or immediately if exposed.

**Q: What if team member leaves?**  
A: Immediately rotate all shared credentials and update access controls.

---

## 11. Questions?

If you have security questions:
1. Check this document first
2. Review SECURITY_AUDIT.md for context
3. Consult with team lead
4. Review OWASP resources

Remember: **Security is everyone's responsibility!**

---

*Last Updated: March 21, 2026*
