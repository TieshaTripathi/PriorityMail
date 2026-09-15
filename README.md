# PriorityMail — Personal Email Priority Assistant

PriorityMail is an intelligent, cross-platform mobile application (iOS & Android) built with React Native, Expo, and TypeScript. It cuts through email noise, ensuring users see only emails that actually require attention: internships, job interviews, college deadlines, professor recommendations, VIP communications, and urgent action items.

---

## Key Features

- **Priority Inbox**: Clean mobile UI displaying filtered urgent emails, personalized dynamic greeting, and interactive summary counters (*Needs Attention*, *Urgent*, *Deadlines*).
- **All Emails Stream**: Full inbox feed with category filters (*Work*, *College*, *Academic*, *Personal*), search bar, and priority tags.
- **Explainable Priority Engine**: Local scoring engine calculating priority weights (+6 VIP, +5 deadlines, +4 interviews, +4 action items, -5 newsletters) with clear "Why PriorityMail flagged this" chips.
- **Priority Rules Engine**: Create, toggle, and delete rules based on Gmail Labels, Senders, Domains, Keywords, and Subject Keywords with local persistence.
- **VIP Contacts Directory**: Add mentors, placement coordinators, and managers whose emails bypass noise filters.
- **Account-aware Gmail opening**: Android tries an explicit Gmail app intent before web fallback. iOS uses account-aware Gmail web because exact thread routing via a public Gmail scheme is not reliable. Mock thread IDs are illustrative and do not exist in Gmail.
- **Snooze Workflows**: Snooze emails for 1 hour, tonight, tomorrow morning, weekend, or custom timestamp.
- **Offline & Mock-Ready**: Operates seamlessly out of the box with realistic student and professional mock data without requiring active Google API credentials.

---

## Repository Structure

```
personal-email-priority-assistant/
├── web/                         # Progressive Web App (Vite, React 19, TypeScript, PWA)
│   ├── index.html               # Mobile shell with iOS safe-area & PWA meta tags
│   ├── public/                  # PWA Webmanifest & high-res icons (192, 512, apple-touch)
│   ├── src/                     # Priority Inbox, All Emails, Rules, VIP People, Settings
│   ├── scripts/                 # Build-time service worker precache generator
│   ├── tests/                   # Automated unit tests for routing, scoring & notifications
│   └── README.md                # Comprehensive Web PWA guide
├── mobile/                      # Expo / React Native TypeScript Mobile App
│   ├── App.tsx                  # 5-tab bottom navigation with Ionicons
│   ├── app.json                 # Expo project configuration (iOS bundle & Android package)
│   ├── package.json             # Mobile dependencies (React Native 0.86, Expo 57)
│   ├── .env.example             # Environment variables template
│   └── src/
│       ├── types/               # TypeScript interfaces (Email, Rule, VIP, Settings)
│       ├── engine/              # Priority scoring & explanation heuristics
│       ├── services/            # Storage, Gmail service, and realistic mock dataset
│       ├── components/          # Reusable UI (EmailCard, Badges, ReasonChip, Modals)
│       └── screens/             # Priority Inbox, All Emails, Rules, VIP People, Settings
├── backend/                     # Optional Node.js / Express TypeScript backend
├── docs/                        # Architecture and product design documentation
└── README.md                    # Project documentation & setup guide
```

---

## ⚡ Progressive Web App (PWA) — Quick Guide

The `web/` directory contains an installable Progressive Web App optimized for **iPhone 16** (with Dynamic Island padding and Home Indicator safe-area handling) and modern Android phones.

### 1. Run the Web PWA Locally
```bash
# Navigate to web directory
cd web

# Install dependencies
npm install

# Start local development server (binds to 0.0.0.0 for mobile network testing)
npm run dev

# Run TypeScript checks & unit tests
npm run typecheck
npm test

# Build production bundle with versioned service worker precache
npm run build

# Preview production build locally
npm run preview
```

### 2. How to Test on iPhone Safari (Same Wi-Fi)
1. Ensure your iPhone and development computer are on the **same Wi-Fi network**.
2. Find your computer's local IP address (`ipconfig` on Windows or `ipconfig getifaddr en0` on macOS).
3. Start the server:
   ```bash
   npm run dev
   # OR
   npm run preview
   ```
4. On your iPhone, open Safari and navigate to:
   ```text
   http://<YOUR_COMPUTER_IP>:5173
   ```
   *(Example: `http://192.168.1.45:5173`)*
5. The UI automatically adapts to iPhone 16 viewports with proper top/bottom safe-area insets, large 44px+ touch targets, rounded cards, and full-screen bottom navigation.

### 3. How to Add to iPhone Home Screen
1. Open PriorityMail in **Safari** on your iPhone.
2. Tap the **Share** button (box with upward arrow) in the bottom toolbar.
3. Scroll down and tap **"Add to Home Screen"**.
4. Confirm the name `PriorityMail` and tap **Add**.
5. PriorityMail now appears on your Home Screen as an icon. When launched, it opens in **standalone display mode** with **zero browser chrome** (no Safari search bar or bottom navigation).

### 4. How to Enable PWA Installability
Installability requires:
- A valid Web App Manifest (`public/manifest.webmanifest`) with `standalone` display mode, start URL, theme colors, and icons.
- Apple touch icon `<link rel="apple-touch-icon" href="/icons/apple-touch-icon.png">`.
- Registered Service Worker caching the application shell (`sw.js`).
- **HTTPS origin**: While iPhone Safari allows "Add to Home Screen" over local Wi-Fi, offline service worker caching and web push strictly require HTTPS. Deploying to Vercel or Netlify enables full installability and offline support.

### 5. How to Deploy to Vercel
1. Push your repository to GitHub.
2. Log into [Vercel](https://vercel.com/) and click **"Add New Project"**.
3. Import your repository and configure:
   - **Root Directory**: `web`
   - **Framework Preset**: `Vite`
   - **Build Command**: `npm run build`
   - **Output Directory**: `dist`
4. Click **Deploy**. Vercel will build and assign an HTTPS URL (e.g., `https://prioritymail.vercel.app`) with custom cache headers from `web/vercel.json`.

### 6. Future Gmail OAuth Setup
PriorityMail currently runs locally with rich multi-account mock data (`personal@gmail.com`, `college@gmail.com`, `work@gmail.com`) without requiring passwords. For live Google accounts:
1. Create a project in Google Cloud Console and enable the **Gmail API**.
2. Configure OAuth Consent Screen with scope `https://www.googleapis.com/auth/gmail.readonly`.
3. Create a **Web Application OAuth Client ID** and add your authorized origins.
4. Copy `web/.env.example` to `web/.env` and set `VITE_GOOGLE_CLIENT_ID`.
5. Keep client secrets strictly on the backend; the frontend only uses the public client ID.

### 7. Future Web Push Setup
The PWA includes a push-ready service worker architecture:
1. Generate VAPID keys using `npx web-push generate-vapid-keys`.
2. Add the public key to `web/.env` as `VITE_VAPID_PUBLIC_KEY`.
3. Store the private key securely on your backend server.
4. The service worker listens for push events, respects quiet hours and priority preferences, and routes clicks directly to `/#email/<threadId>`.

For detailed architecture and testing notes, see [web/README.md](file:///c:/Users/Tiesha/Downloads/personal-email-priority-assistant/personal-email-priority-assistant/web/README.md).

---

## 1. Prerequisites

Before running the project locally:

- **Node.js**: Use Node.js `24.x` LTS (validated with 24.13.1) installed (`node -v`)
- **npm**: Version `9.x` or `10.x` installed (`npm -v`)
- **Git**: Installed for version control and pushing to GitHub
- **Expo Go App**:
  - **iPhone**: Download [Expo Go on Apple App Store](https://apps.apple.com/app/expo-go/id982107779)
  - **Android**: Download [Expo Go on Google Play Store](https://play.google.com/store/apps/details?id=host.exp.exponent)

---

## 2. Quick Start (Running Locally)

Open your terminal and run the following commands:

```bash
# 1. Navigate to the mobile directory
cd mobile

# 2. Install dependencies
npm install

# 3. Start the Expo development server
npx expo start --go
```

---

## 3. How to Run on iPhone

1. Ensure your iPhone and your computer are connected to the **same Wi-Fi network**.
2. Run `npx expo start --go` in the `mobile` directory. A large QR code will appear in your terminal.
3. Open the **default iOS Camera app** on your iPhone and point it at the QR code.
4. Tap the **"Open in Expo Go"** banner that appears at the top of your iPhone screen.
5. PriorityMail will bundle and launch instantly on your device!

> **Tip (Network Isolation)**: If your Wi-Fi router blocks device-to-device discovery, start Expo in tunnel mode:
> ```bash
> npx expo start --tunnel
> ```

---

## 4. How to Run on Android

1. Open the **Expo Go app** on your Android phone.
2. Tap **"Scan QR Code"** within the Expo Go app.
3. Point your camera at the QR code displayed by `npx expo start`.
4. The JavaScript bundle will compile and launch the app.

---

## 5. How to Put This Project on GitHub

Run the following commands from the root directory (`personal-email-priority-assistant`):

```bash
# 1. Initialize git repository
git init

# 2. Stage all files (respecting .gitignore)
git add .

# 3. Create initial commit
git commit -m "feat: complete PriorityMail mobile MVP for iOS and Android"

# 4. Set main branch
git branch -M main

# 5. Create a new repository on GitHub (via github.com -> New Repository -> e.g. "priority-mail")
# Then connect your remote repository:
git remote add origin https://github.com/YOUR_GITHUB_USERNAME/YOUR_REPO_NAME.git

# 6. Push code to GitHub
git push -u origin main
```

---

## 6. Environment Variables

A template is provided in `mobile/.env.example`. To use custom variables, create a `.env` file in the `mobile/` directory:

```bash
cd mobile
cp .env.example .env
```

Available variables:

```env
# Backend API base endpoint
EXPO_PUBLIC_API_URL=http://localhost:4000

# Google OAuth Client IDs (Google Cloud Console)
EXPO_PUBLIC_GOOGLE_CLIENT_ID_IOS=your-ios-client-id.apps.googleusercontent.com
EXPO_PUBLIC_GOOGLE_CLIENT_ID_ANDROID=your-android-client-id.apps.googleusercontent.com
EXPO_PUBLIC_GOOGLE_CLIENT_ID_WEB=your-web-client-id.apps.googleusercontent.com

# Enable live sync with backend (set to true when backend is running)
EXPO_PUBLIC_ENABLE_LIVE_SYNC=false
```

---

## 7. Future Production Steps

### A. Google Cloud & Gmail OAuth Setup
1. Go to the [Google Cloud Console](https://console.cloud.google.com/).
2. Create a new project named `PriorityMail`.
3. Enable the **Gmail API** under *APIs & Services > Library*.
4. Configure the **OAuth Consent Screen**:
   - User Type: External
   - Scopes: `https://www.googleapis.com/auth/gmail.readonly`
5. Create OAuth 2.0 Credentials:
   - **iOS Client**: Bundle Identifier `com.tiesha.prioritymail`
   - **Android Client**: Package name `com.tiesha.prioritymail` + SHA-1 fingerprint
   - **Web Application Client**: For backend callback handling.
6. Connect Google Cloud Pub/Sub to Gmail Watch (`users.watch`) for push webhook alerts.

### B. Firebase Cloud Messaging (FCM) Setup
1. Create a Firebase Project in the [Firebase Console](https://console.firebase.google.com/).
2. Add an iOS app (`com.tiesha.prioritymail`) and upload your Apple Push Notification Key (`.p8`).
3. Add an Android app (`com.tiesha.prioritymail`) and download `google-services.json`.
4. Configure Expo Notifications:
   ```bash
   npx expo install expo-notifications
   ```

### C. Production Builds
See the standalone build profiles and exact commands below.

---

## License

MIT License — free to use, modify, and distribute.

## Standalone PriorityMail builds

Run all Expo/EAS commands from **mobile/**. The app uses the display name PriorityMail, slug prioritymail, version 1.0.0, and bundle/package identifier com.tiesha.prioritymail. Existing tabs, rules, scoring, snooze, and persistence are preserved.

### Android preview APK (no Expo Go or Metro required)

Supply the artwork described below, then:

```powershell
cd mobile
npm install
npx expo install --fix
npx expo-doctor
npx tsc --noEmit
npx eas-cli@latest login
npx eas-cli@latest build:configure
npx eas-cli@latest build --platform android --profile preview
```

EAS will prompt to link/create your Expo project and create an Android signing key. Keep the generated project ID in the Expo configuration. Download the APK using the completed build's link on your Android phone, permit installation from that browser when prompted, and install it. Launch PriorityMail from its home-screen icon. The release bundle is embedded; your computer can be off.

This folder currently has no Git repository. Initialize Git at the repository root using the GitHub instructions above before building. No GitHub repository or EAS build has been created by these code changes.

### Profiles and iPhone installation

- development: internal development client; run `npx expo start --dev-client` after installing it.
- preview: standalone internal build; Android APK, iOS ad hoc distribution.
- production: store distribution; Android AAB and iOS store build with build-number increments.

For an iPhone preview, Apple signing and device registration are required:

```powershell
npx eas-cli@latest device:create
npx eas-cli@latest build --platform ios --profile preview
```

Register the intended iPhone before building and install using the resulting EAS link. EAS physical iPhone ad hoc builds require an Apple Developer Program membership. APKs cannot install on iPhone. Expo Go remains the free local testing path: `npx expo start --go`. A simulator build is not an iPhone-installable app. No paid Expo feature is configured; free-tier quotas/queues apply, and Apple/Google store accounts are separate.

For stores later:

```powershell
npx eas-cli@latest build --platform android --profile production
npx eas-cli@latest build --platform ios --profile production
```

Store submission, OAuth, push delivery, and account credentials are future work.

### Required artwork

Add these files under mobile/assets/ (no binary placeholders were generated):

| File | Size | Content |
| --- | --- | --- |
| icon.png | 1024 × 1024 | Opaque square icon; no rounded corners |
| adaptive-icon.png | 1024 × 1024 | Transparent foreground; mark inside central 66% |
| splash.png | 1024 × 1024 | Transparent centered logo; rendered 200 points wide on white |

app.config.js enables files automatically when present. Missing artwork uses Expo defaults and a white splash; add your PNGs before a branded build. Rebuild the native app after changing artwork or native configuration.

### Gmail routing and multiple accounts

ConnectedAccount models stable IDs, email, display name, optional avatar, primary status and demo/connected status. Each mock email explicitly owns accountId, accountEmail, gmailThreadId and gmailMessageId. Settings shows personal@gmail.com, college@gmail.com and work@gmail.com, clearly marked as demo connections. Add/Remove are informational placeholders and do not claim OAuth succeeded.

src/services/gmailDeepLink.ts is the single opening service. It encodes the email account and thread ID (message ID fallback) into an authuser Gmail URL. Android first sends ACTION_VIEW specifically to com.google.android.gm through Expo IntentLauncher. If unavailable/rejected, it opens the same URL through Expo Linking. iOS goes directly to this account-aware web URL; the Gmail compose scheme cannot open existing messages. Opening failures return false and the detail modal displays an alert.

Gmail controls how it interprets account/thread URLs; a successful app launch does not prove that Gmail selected the requested thread. Test with real IDs and multiple signed-in accounts before enabling OAuth. Demo messages cannot be found in Gmail. The future API adapter must attach the authenticated account's identity to every fetched message, scope thread fetches/tokens by account, and keep OAuth secrets off-device and out of EXPO_PUBLIC variables. Existing single-account auth settings are legacy placeholders, not authentication state for the new account cards.

### Validation and device acceptance

```powershell
npm run test:links
npx tsc --noEmit
npx expo-doctor
npx expo export --platform all
npx expo start --go
```

Device checks: open details for each demo account; confirm Opening with matches; verify Add/Remove explanations; confirm Mark Done/Snooze and rules still work. On Android test Gmail installed/uninstalled, and on iPhone test browser fallback. With future real Gmail data, verify account selection and thread routing explicitly. Native routing has not been verified on a physical device during this change.

References: [Expo APK builds](https://docs.expo.dev/build-reference/apk/), [internal distribution and iOS signing](https://docs.expo.dev/build/internal-distribution/), [IntentLauncher](https://docs.expo.dev/versions/latest/sdk/intent-launcher/).

Validation on 2026-09-15: Expo dependency alignment completed; Expo Doctor 18/18 passed; strict TypeScript check and Gmail routing tests passed; Android and iOS release bundles exported successfully. Installation reported 14 moderate dependency audit findings; no forced breaking upgrades were applied. Use Node 24 LTS: the elevated shell used an older Node 22.10 and emitted engine warnings, while bundle/type checks ran on Node 24.13.1.
