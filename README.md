# PriorityMail

> Your important emails, without the noise.

A personal email priority assistant with real Google OAuth login, multiple Gmail account connection, and a rule-based priority engine.

---

## Architecture

```
personal-email-priority-assistant/
  backend/            Node.js + Express API (auth, Gmail, DB)
  web/                React PWA (Vite)
  mobile/             Expo (React Native) — Android + iOS
  packages/
    types/            Shared TypeScript types
    priority-engine/  Shared priority classification engine
```

---

## Google Cloud Setup (Required)

### 1. Create a Google Cloud Project

1. Go to [console.cloud.google.com](https://console.cloud.google.com/)
2. Create a new project (e.g. `prioritymail-dev`)

### 2. Enable APIs

In your project, enable:
- **Gmail API** — [Enable it here](https://console.cloud.google.com/apis/library/gmail.googleapis.com)
- **Google People API** (optional, for richer profiles)

### 3. Configure OAuth Consent Screen

1. Go to **APIs & Services → OAuth consent screen**
2. Select **External** (for personal/testing use)
3. Fill in:
   - App name: `PriorityMail`
   - User support email: your email
   - Developer contact: your email
4. Add scopes:
   - `openid`
   - `email`
   - `profile`
   - `https://www.googleapis.com/auth/gmail.readonly`
   - `https://www.googleapis.com/auth/gmail.labels`
5. Add test users: add your own Gmail addresses
6. Save and continue

### 4. Create OAuth 2.0 Credentials

1. Go to **APIs & Services → Credentials**
2. Click **Create Credentials → OAuth client ID**
3. Application type: **Web application**
4. Name: `PriorityMail Local`
5. **Authorized redirect URIs** — add ALL of these exactly:
   ```
   http://localhost:4000/api/auth/google/callback
   http://localhost:4000/api/accounts/connect/callback
   ```
6. Click Create
7. Copy the **Client ID** and **Client Secret**

> ⚠️ The Client Secret must NEVER be in frontend code or committed to git.

---

## Environment Variables

### Backend (`backend/.env`)

Copy `backend/.env.example` to `backend/.env` and fill in:

```bash
# Generate encryption key:
openssl rand -hex 32

# Generate session secret:
openssl rand -hex 32
```

| Variable | Description |
|---|---|
| `PORT` | Backend port (default: 4000) |
| `DATABASE_PATH` | SQLite file path (default: `./data/prioritymail.db`) |
| `ENCRYPTION_KEY` | 64-char hex string for encrypting refresh tokens |
| `SESSION_SECRET` | Random string for signing session cookies |
| `GOOGLE_CLIENT_ID` | From Google Cloud Console |
| `GOOGLE_CLIENT_SECRET` | From Google Cloud Console (keep secret!) |
| `GOOGLE_REDIRECT_URI` | `http://localhost:4000/api/auth/google/callback` |
| `GMAIL_REDIRECT_URI` | `http://localhost:4000/api/accounts/connect/callback` |
| `WEB_APP_URL` | `http://localhost:5173` (your frontend URL) |

### Web (`web/.env`)

Copy `web/.env.example` to `web/.env`:

| Variable | Description |
|---|---|
| `VITE_API_BASE_URL` | Leave empty in dev (Vite proxy handles it). Set to backend URL in production. |

---

## Local Development

### Prerequisites

- Node.js 20+
- `openssl` (for key generation on Linux/Mac) or use [random.org](https://www.random.org/strings/) for Windows

### 1. Install Backend Dependencies

```bash
cd backend
npm install
```

### 2. Configure Backend

```bash
cp .env.example .env
# Edit .env with your Google credentials and generated secrets
```

### 3. Start the Backend

```bash
cd backend
npm run dev
```

Backend runs at `http://localhost:4000`. The SQLite DB is created automatically at `./data/prioritymail.db`.

Verify it works:
```bash
curl http://localhost:4000/health
# {"ok":true,"service":"priority-mail-backend","version":"2.0.0"}
```

### 4. Install Web Dependencies

```bash
cd web
npm install
```

### 5. Configure Web

```bash
cp .env.example .env
# Leave VITE_API_BASE_URL empty for local dev (Vite proxy handles /api)
```

### 6. Start the Web App

```bash
cd web
npm run dev
```

Web app at `http://localhost:5173`.

---

## First-Time Flow

### Connecting Your First Gmail Account

1. Open `http://localhost:5173`
2. You will see the **PriorityMail login page**
3. Click **"Continue with Google"** — you will be redirected to Google
4. Sign in with your Google account (this creates your PriorityMail profile)
5. You are redirected back to the app and signed in
6. Navigate to **Settings → Connected Gmail Accounts**
7. Click **"Add Gmail Account"**
8. Google will ask you to authorize Gmail read access
9. Choose the Gmail account you want to connect (can be different from login)
10. You are redirected back to Settings with the account listed

### Adding Additional Gmail Accounts

Repeat step 6–9 above. Each click of "Add Gmail Account" allows you to pick a **different** Google account. You can connect as many as you want.

### Fetching Real Emails

1. Go to **All Emails**
2. You will see "Fetch real emails from a connected account" buttons
3. Click the button for the account you want
4. Real emails from Gmail are fetched, classified by the priority engine, and displayed
5. Priority Inbox still uses the mock demo emails until you connect an account

---

## Redirect URIs to Register in Google Cloud

Add **exactly** these to your OAuth client's Authorized Redirect URIs:

```
http://localhost:4000/api/auth/google/callback
http://localhost:4000/api/accounts/connect/callback
```

For production (replace with your actual domain):
```
https://api.yourapp.com/api/auth/google/callback
https://api.yourapp.com/api/accounts/connect/callback
```

---

## Security Model

| What | Where | Protection |
|---|---|---|
| Google client secret | `backend/.env` only | Never in frontend code or git |
| Gmail refresh tokens | SQLite DB | AES-256-GCM encrypted at rest |
| User sessions | `express-session` + SQLite | httpOnly cookies, SameSite=lax |
| Access tokens | Backend memory + DB | Auto-refreshed, never sent to client |
| Scopes | Gmail read-only | No send, delete, or modify permissions |

---

## What Is Still Mocked

| Feature | Status |
|---|---|
| Priority Inbox | ✅ Mock emails (real classification engine) |
| All Emails — real Gmail | ✅ Real when a Gmail account is connected |
| Priority classification | ✅ Real (rule-based engine, no AI yet) |
| Google login | ✅ Real OAuth |
| Gmail account connection | ✅ Real OAuth |
| Email read/done/snooze state | ⚠️ Stored locally in browser (not synced to DB yet) |
| Push notifications | ⚠️ Mocked in-app |
| Mobile app auth | ⚠️ Not implemented (API interfaces ready) |

---

## API Endpoints

| Method | Path | Description |
|---|---|---|
| `GET` | `/health` | Health check |
| `GET` | `/api/auth/google/login` | Get Google OAuth URL |
| `GET` | `/api/auth/google/callback` | OAuth callback (from Google) |
| `POST` | `/api/auth/logout` | Destroy session |
| `GET` | `/api/auth/me` | Current user or 401 |
| `GET` | `/api/accounts` | List connected Gmail accounts |
| `POST` | `/api/accounts/connect/start` | Start Gmail OAuth |
| `GET` | `/api/accounts/connect/callback` | Gmail OAuth callback |
| `DELETE` | `/api/accounts/:id` | Disconnect account |
| `GET` | `/api/gmail/:accountId/messages` | Fetch + classify emails |
| `GET` | `/api/gmail/:accountId/labels` | List Gmail labels |
| `POST` | `/api/classify` | Legacy: classify a single email |

---

## Next Milestone Suggestions

1. **Persist email state** — sync read/done/snoozed state to backend DB per user
2. **Priority Inbox with real Gmail** — replace mock inbox with real emails
3. **Mobile auth** — implement the same backend OAuth flow in the Expo app
4. **Gmail push notifications** — use Gmail Pub/Sub watch for real-time updates
5. **AI classification** — feed emails to Gemini API for enhanced priority scoring
