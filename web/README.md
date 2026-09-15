# PriorityMail — Progressive Web App (PWA)

PriorityMail is a Progressive Web App (PWA) personal email priority assistant designed mobile-first for **iPhone 16** (with Dynamic Island and Home Indicator safe-area handling) and modern Android smartphones.

---

## 1. Quick Start (Running Locally)

### Prerequisites
- **Node.js**: `v20.0.0` or higher (validated with Node `v22.10.0`)
- **npm**: `v9.x` or `v10.x`

### Commands
Navigate to the `web` folder:

```bash
cd web
npm install
```

#### Start Local Development Server
```bash
npm run dev
```
- By default, Vite starts on `http://localhost:5173/` and binds to `0.0.0.0` so it is accessible over your local network.

#### Run TypeScript Checks
```bash
npm run typecheck
```

#### Run Unit Tests
```bash
npm test
```
- Runs automated tests for Gmail deep-linking, the Priority scoring engine, and Notification mock heuristics using Node's native test runner.

#### Build for Production
```bash
npm run build
```
- Compiles TypeScript, bundles assets with Vite into `dist/`, and automatically executes `scripts/build-sw.mjs` to generate a content-hashed precache offline service worker (`dist/sw.js`).

#### Preview Production Build Locally
```bash
npm run preview
```
- Serves the compiled production bundle with service worker support on `http://localhost:5173/` (and local network IP).

---

## 2. How to Test on iPhone Safari (Same Wi-Fi)

To test the mobile experience directly on your physical iPhone 16 or any iOS device:

1. **Connect both devices to the same Wi-Fi network**.
2. **Find your computer's local IP address**:
   - **Windows (PowerShell)**:
     ```powershell
     ipconfig
     ```
     Look for **IPv4 Address** under your active Wi-Fi adapter (e.g., `192.168.1.45`).
   - **macOS / Linux**:
     ```bash
     ipconfig getifaddr en0 || hostname -I
     ```
3. **Start the Vite server** (either dev or preview):
   ```bash
   npm run dev
   # OR for production build preview:
   npm run preview
   ```
   Both scripts bind to `--host 0.0.0.0`.
4. **Open Safari on your iPhone**:
   - In the Safari address bar, type:
     ```text
     http://<YOUR_COMPUTER_IP>:5173
     ```
     *(Example: `http://192.168.1.45:5173`)*
5. **Verify the iPhone 16 Layout**:
   - **Safe Areas**: Notice top margin accommodates the Dynamic Island and bottom navigation bar floats comfortably above the iOS Home Indicator.
   - **Touch Targets**: All interactive buttons, chips, and cards have minimum 44px hitboxes for one-handed thumb navigation.
   - **Modals**: Opening an email slides up an iOS-style bottom sheet modal.

---

## 3. How to Add to iPhone Home Screen

Launching PriorityMail as an installed Home Screen web app removes Safari's navigation bar, URL bar, and bottom controls, giving you a full-screen mobile app shell:

1. Open PriorityMail in **Safari** on your iPhone.
2. Tap the **Share** button (the square with an upward arrow) in the Safari bottom toolbar.
3. Scroll down in the share sheet and tap **Add to Home Screen**.
4. *(Optional)* Confirm or edit the app title (defaults to `PriorityMail`).
5. Tap **Add** in the top right corner.
6. Return to your iPhone Home Screen and tap the **PriorityMail** icon.
7. PriorityMail launches in **standalone display mode** with no browser chrome!

---

## 4. How to Enable PWA Installability & Offline Support

### What Enables Installability?
PriorityMail includes all W3C and Apple PWA prerequisites:
1. **Web App Manifest (`public/manifest.webmanifest`)**:
   - `name`: "PriorityMail"
   - `short_name`: "PriorityMail"
   - `display`: "standalone"
   - `start_url`: "/"
   - `theme_color`: "#f7f8fc"
   - `background_color`: "#f7f8fc"
   - Icons: 192x192, 512x512, and 512x512 maskable
2. **Apple Web App Meta Tags (`index.html`)**:
   - `<meta name="apple-mobile-web-app-capable" content="yes" />`
   - `<meta name="apple-mobile-web-app-status-bar-style" content="default" />`
   - `<meta name="apple-mobile-web-app-title" content="PriorityMail" />`
   - `<link rel="apple-touch-icon" sizes="180x180" href="/icons/apple-touch-icon.png" />`
3. **Service Worker (`scripts/build-sw.mjs` & `scripts/sw-template.js`)**:
   - Pre-caches all HTML, JS, CSS, and icon assets with a unique build hash.
   - Automatically cleans up older caches upon activation.
   - Intercepts offline navigation requests and returns cached `/index.html`.

### Note on Secure Contexts (HTTPS)
- Browsers (Safari & Chrome) require **HTTPS** (or `localhost`) to register Service Workers and enable Web Push.
- When testing on a local Wi-Fi IP address over plain HTTP, the app runs in full standalone UI mode, but service worker registration is skipped safely. Full offline precaching and push notifications activate automatically when deployed to HTTPS (e.g. Vercel).

---

## 5. How to Deploy to Vercel

PriorityMail is pre-configured with `vercel.json` headers and SPA rewrites for instant Vercel deployment:

### Option A: Via GitHub (Recommended)
1. Push your repository to GitHub.
2. Log in to [Vercel](https://vercel.com/) and click **"Add New" > "Project"**.
3. Select your repository.
4. In **Project Settings**:
   - **Root Directory**: `web`
   - **Framework Preset**: `Vite`
   - **Build Command**: `npm run build`
   - **Output Directory**: `dist`
5. Click **Deploy**. Vercel will build and assign an HTTPS URL (e.g. `https://prioritymail.vercel.app`).
6. Open that HTTPS URL on your iPhone Safari, tap **Share > Add to Home Screen**, and full PWA installation + offline caching will be active!

### Option B: Via Vercel CLI
```bash
cd web
npm install -g vercel
vercel
```

---

## 6. Icon Asset Requirements

PriorityMail references the following icon sizes under `web/public/icons/`:

| File Path | Dimensions | Purpose | Requirement |
|---|---|---|---|
| `/icons/icon-192.png` | 192 × 192 px | Android home screen & PWA install | PNG, any |
| `/icons/icon-512.png` | 512 × 512 px | Android splash screen & app switcher | PNG, any |
| `/icons/icon-maskable-512.png` | 512 × 512 px | Android adaptive icon with safe padding | PNG, maskable |
| `/icons/apple-touch-icon.png` | 180 × 180 px | iOS Safari Home Screen icon | Square PNG, opaque background |

If custom branded icons are replaced, maintain these exact dimensions and paths.

---

## 7. Future Gmail OAuth 2.0 Setup

Currently, PriorityMail runs in mock/demo mode across three simulated accounts (`personal@gmail.com`, `college@gmail.com`, `work@gmail.com`) without requesting Gmail passwords or tokens.

To connect live Gmail accounts in the future:
1. **Google Cloud Console**:
   - Create a project: `https://console.cloud.google.com/`
   - Navigate to **APIs & Services > Library** and enable **Gmail API**.
   - Configure **OAuth Consent Screen** (User type: External, Scopes: `https://www.googleapis.com/auth/gmail.readonly`).
   - Create **OAuth 2.0 Client ID** (Application type: *Web application*).
   - Add authorized JavaScript origins (e.g. `https://your-domain.vercel.app` and `http://localhost:5173`).
2. **Environment Configuration**:
   - Copy `.env.example` to `.env`:
     ```bash
     cp .env.example .env
     ```
   - Set `VITE_GOOGLE_CLIENT_ID` with your public Client ID.
3. **Security Architecture**:
   - **Never store Client Secrets in frontend code**. All token exchange and refresh logic must be handled via a secure backend API endpoint (`VITE_API_BASE_URL`).

---

## 8. Future Web Push Setup

The service worker (`scripts/sw-template.js`) and notification manager (`src/services/notifications.ts`) include a push notification architecture:

1. **Generate VAPID Keys**:
   ```bash
   npx web-push generate-vapid-keys
   ```
2. **Set Public Key**:
   - Place the public key in `web/.env`:
     ```env
     VITE_VAPID_PUBLIC_KEY=your_public_vapid_key_here
     ```
   - Keep the private key secure on your backend server.
3. **Backend Push Delivery**:
   - When a priority email arrives, backend checks user preferences (deadline alerts, VIP alerts, quiet hours) before sending a web push payload containing `{ title, body, emailId }`.
   - The Service Worker receives the push event, displays the notification, and when clicked, focuses the active tab or navigates to `/#email/<id>`.
