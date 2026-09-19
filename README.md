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
2. Create a new project (e.g. `prioritymail-prod`)

### 2. Enable APIs
In your project, enable:
- **Gmail API** — [Enable here](https://console.cloud.google.com/apis/library/gmail.googleapis.com)
- **Cloud Pub/Sub API** (for real-time email push notifications) — [Enable here](https://console.cloud.google.com/apis/library/pubsub.googleapis.com)

### 3. Configure OAuth Consent Screen & Fix 403 access_denied
If you see `403 access_denied: "app has not completed Google verification"`, your app is in "Testing" mode and the target Gmail address must be added to Test Users:
1. Go to **APIs & Services → OAuth consent screen**
2. User type: **External**
3. Add scopes:
   - `openid`
   - `email`
   - `profile`
   - `https://www.googleapis.com/auth/gmail.readonly`
   - `https://www.googleapis.com/auth/gmail.labels`
4. Under **Test users**, click **+ Add users**:
   - Enter your login email AND any additional Gmail account you want to connect.
   - Click **Save**. (Only added test users can authorize while the app is unverified).

### 4. Create OAuth 2.0 Credentials
1. Go to **APIs & Services → Credentials**
2. Click **Create Credentials → OAuth client ID** (Application type: **Web application**)
3. Authorized redirect URIs:
   ```
   # Local Development:
   http://localhost:4000/api/auth/google/callback
   http://localhost:4000/api/accounts/google/callback

   # Production (Same-Origin Vercel Proxy):
   https://priority-mail-zeta.vercel.app/api/auth/google/callback
   https://priority-mail-zeta.vercel.app/api/accounts/google/callback
   ```
4. Copy `Client ID` and `Client Secret` to your backend environment (`GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`).

---

## Real-Time Gmail Watch & Google Cloud Pub/Sub Setup

To automatically detect incoming emails in real-time without polling:

### 1. Create Pub/Sub Topic
1. Go to [Google Cloud Pub/Sub Topics](https://console.cloud.google.com/cloudpubsub/topic/list).
2. Click **Create Topic**.
3. Topic ID: `priority-mail-watch` (full topic path will look like `projects/<your-project-id>/topics/priority-mail-watch`).
4. Click **Create**.

### 2. Grant Gmail Publisher Permission on the Topic
Google's Gmail push system requires permission to publish messages to your topic:
1. Open your new `priority-mail-watch` topic.
2. Go to the **Permissions** tab on the right side.
3. Click **Add Principal**.
4. In **New principals**, enter:
   ```
   serviceAccount:gmail-api-push@system.gserviceaccount.com
   ```
5. Select Role: **Pub/Sub Publisher** (`roles/pubsub.publisher`).
6. Click **Save**.

### 3. Create Pub/Sub Push Subscription (Webhook Delivery)
1. In your `priority-mail-watch` topic, click **Create Subscription**.
2. Subscription ID: `priority-mail-push-sub`.
3. Delivery type: Select **Push**.
4. Endpoint URL:
   ```
   https://priority-mail-zeta.vercel.app/api/webhooks/gmail-pubsub
   ```
   *(Or direct Render backend: `https://prioritymail-ovda.onrender.com/api/webhooks/gmail-pubsub`)*
5. Set **Acknowledgment deadline** to `30` seconds.
6. Click **Create**.

### 4. Add Environment Variable
In your Render backend dashboard:
```env
PUBSUB_TOPIC_NAME=projects/<your-project-id>/topics/priority-mail-watch
```
PriorityMail will automatically call `users.watch` when Gmail accounts connect and renew them daily via its background scheduler.

---

## Persistent Database (PostgreSQL)

Render free instances have ephemeral storage (SQLite resets if the server restarts). PriorityMail supports seamless PostgreSQL persistence:

1. Provision a free managed PostgreSQL instance (e.g., [Render PostgreSQL](https://render.com/docs/databases), [Neon](https://neon.tech), or [Supabase](https://supabase.com)).
2. Copy the connection string (format: `postgres://user:password@host:port/dbname?sslmode=require`).
3. Set in Render Environment:
   ```env
   DATABASE_URL=postgres://user:password@host:port/dbname?sslmode=require
   ```
4. PriorityMail automatically connects via `pg.Pool`, creates all tables, and uses persistent `connect-pg-simple` session storage. SQLite is used automatically as fallback when `DATABASE_URL` is omitted.

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

## Production Deployment & Architecture

| Layer | Host | URL |
|---|---|---|
| **Web Frontend / PWA** | Vercel | [https://priority-mail-zeta.vercel.app](https://priority-mail-zeta.vercel.app) |
| **Backend API** | Render | [https://prioritymail-ovda.onrender.com](https://prioritymail-ovda.onrender.com) |

### Same-Origin API Architecture (iOS PWA & Safari ITP Compliance)
To prevent cross-site 3rd-party cookie blocking on iOS Safari and installed PWAs:
- Browser requests hit `https://priority-mail-zeta.vercel.app/api/...`
- Vercel's Edge network rewrites and proxies `/api/*` to `https://prioritymail-ovda.onrender.com/api/*`
- Session cookies (`pm.sid`) are stored as **1st-party cookies** on `priority-mail-zeta.vercel.app`, allowing seamless login and persistent authentication on iPhone Home Screen PWAs.

---

## iPhone PWA Installation

PriorityMail is built as an installable Progressive Web App (PWA) with full offline support, app icons, and safe-area inset adaptation for iPhone:

1. Open **Safari** on your iPhone.
2. Navigate to: **`https://priority-mail-zeta.vercel.app`**
3. Tap the **Share** button (the square with an arrow pointing up at the bottom bar).
4. Scroll down in the share sheet and tap **Add to Home Screen**.
5. Confirm the name **PriorityMail** and tap **Add** in the top right.
6. Open PriorityMail from your Home Screen — it launches as a full standalone app without browser URL bars!

---

## Android APK Build (No Play Store Required)

PriorityMail includes an installable Android build configuration using Expo EAS Build:

1. Install EAS CLI (if not already installed):
   ```bash
   npm install -g eas-cli
   ```
2. Navigate to the mobile directory:
   ```bash
   cd mobile
   ```
3. Run the preview APK build:
   ```bash
   eas build --platform android --profile preview
   ```
4. EAS Build generates a standalone `.apk` package (`com.tiesha.prioritymail`).
5. Download the `.apk` directly to your Android device and install it (enable "Install unknown apps" in Android settings if prompted).

---

## Google Cloud OAuth Redirect URIs

Add both sets of URIs to your Google Cloud Console Web Application credentials:

**Local Development:**
```
http://localhost:4000/api/auth/google/callback
http://localhost:4000/api/accounts/google/callback
```

**Production (Same-Origin Vercel Proxy):**
```
https://priority-mail-zeta.vercel.app/api/auth/google/callback
https://priority-mail-zeta.vercel.app/api/accounts/google/callback
```

*(Direct Render URLs can also be registered as backup: `https://prioritymail-ovda.onrender.com/api/auth/google/callback` and `https://prioritymail-ovda.onrender.com/api/accounts/google/callback`)*

---

## API Endpoints

| Method | Path | Description |
|---|---|---|
| `GET` | `/api/health` | Service health check (`{"status":"ok"}`) |
| `GET` | `/api/auth/google` | Direct browser navigation for Google login |
| `GET` | `/api/auth/google/callback` | OAuth login callback from Google |
| `GET` | `/api/auth/me` | Current authenticated user profile |
| `POST` | `/api/auth/logout` | Destroy session and clear cookies |
| `GET` | `/api/accounts` | List connected Gmail accounts (`/api/accounts/connected`) |
| `GET` | `/api/accounts/google/connect` | Connect a new Gmail account via OAuth |
| `GET` | `/api/accounts/google/callback` | Gmail OAuth connection callback |
| `DELETE` | `/api/accounts/:id` | Disconnect Gmail account and revoke token |
| `GET` | `/api/gmail/messages` | Fetch & classify emails across all connected accounts (`/api/emails/priority`) |
| `GET` | `/api/gmail/:accountId/messages` | Fetch & classify emails for a specific account |
| `POST` | `/api/gmail/:accountId/sync` | Manually trigger message sync for an account |
| `GET` | `/api/gmail/:accountId/labels` | List Gmail labels for an account |

---

## Security Model

| Component | Location | Implementation |
|---|---|---|
| **OAuth Credentials** | Render Environment | `GOOGLE_CLIENT_ID` & `GOOGLE_CLIENT_SECRET` never bundled in frontend code |
| **Gmail Refresh Tokens** | SQLite DB | AES-256-GCM encrypted with `TOKEN_ENCRYPTION_KEY` |
| **Session Cookies** | Browser & Server | `httpOnly: true`, `secure: true`, `sameSite: 'none'` (with `trust proxy: 1`) |
| **Access Tokens** | Server-side Memory | Auto-refreshed before expiration, never exposed to client |
| **Permissions** | Google OAuth | Read-only Gmail (`gmail.readonly`, `gmail.labels`) — zero send/delete access |

---

## Database & Render Free Tier Notes

- PriorityMail uses Node.js 22 built-in `node:sqlite` module without native C++ compilation dependencies.
- **Render Free Tier Storage**: Render free web services have an ephemeral filesystem (the SQLite file resets if the service restarts or redeploys). For persistent SQLite, attach a Render Persistent Disk mounted at `/var/data` and set `DATABASE_PATH=/var/data/prioritymail.db`.
- **Recommended Next Production Step**: Migrate database layer to managed PostgreSQL (e.g. Neon or Supabase free tier) for multi-instance scaling and persistence.
