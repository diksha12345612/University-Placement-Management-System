# 🚀 Production Environment Variables

Copy and paste these into your hosting provider settings (Render, Railway, Vercel).

## 🖥️ Backend (Render/Railway)
Set these in your Web Service settings:

| Key | Value | Notes |
| :--- | :--- | :--- |
| `PORT` | `5051` | Or leave empty (Render assigns automatically) |
| `MONGODB_URI` | `mongodb+srv://username:password@cluster.mongodb.net/dbname` | **IMPORTANT: Generate and store securely in your provider's secrets manager** |
| `JWT_SECRET` | `<generate-a-strong-random-string>` | **CRITICAL: Keep this secret! Generate with: `crypto.randomBytes(32).toString('hex')`** |
| `JWT_EXPIRE` | `7d` | |
| `NODE_ENV` | `production` | |
| `FRONTEND_URL` | `https://your-app.vercel.app` | Your Vercel frontend URL |
| `EMAIL_USER` | `your-email@gmail.com` | **Store securely in secrets manager** |
| `ADMIN_EMAIL` | `admin-email@gmail.com` | Admin contact shown to recruiters |
| `EMAIL_PASS` | `<gmail-app-password>` | **Store securely in secrets manager - NOT the Gmail password!** |
| `OPENROUTER_API_KEY` | `sk-or-v1-xxxxxxxx...` | **Store securely in secrets manager** |
| `AFFINDA_API_KEY` | `aff_xxxxxxxx...` | **Store securely in secrets manager** |
| `GITHUB_TOKEN` | `ghp_xxxxxxxx...` | **Store securely in secrets manager** |

---

## 🎨 Frontend (Vercel)
Set these in your Vercel Project Settings **Environment Variables**:

| Key | Value | Notes |
| :--- | :--- | :--- |
| `VITE_API_URL` | `https://your-api.domain.com/api` | Your Backend URL + `/api` |
| `NODE_ENV` | `production` | |

---

### ⚠️ SECURITY BEST PRACTICES

1. **Never commit `.env` files to Git**
2. **Never hardcode secrets in source code**
3. **Always use your hosting provider's native secrets management:**
   - **Vercel:** Project Settings → Environment Variables
   - **Render:** Service Settings → Environment Variables
   - **Railway:** Variables tab
4. **Rotate secrets regularly**
5. **Use GitHub Secrets for CI/CD deployments**
6. **Audit who has access to production secrets**

---

### 🛠️ Post-Deployment Step
Once your Backend is live and environment variables are set, run the seed script to populate your production database:
```bash
cd server
npm run seed:prod
```
**Note:** Only run seed scripts once. Store all credentials in your hosting provider's environment variable manager, never in `.env` files.
