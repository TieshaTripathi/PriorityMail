import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import session from 'express-session';

import { getDb } from './db/database.js';
import { classifyRouter } from './routes/classify.js';
import { authRouter } from './routes/auth.js';
import { accountsRouter } from './routes/accounts.js';
import { gmailRouter } from './routes/gmail.js';

// ----------------------------------------------------------------
// Validate required secrets on startup
// ----------------------------------------------------------------
const SESSION_SECRET = process.env.SESSION_SECRET || 'dev-session-secret-change-in-production';
if (!process.env.SESSION_SECRET && process.env.NODE_ENV === 'production') {
  console.error('[startup] SESSION_SECRET must be set in production.');
  process.exit(1);
}

// Initialize DB (runs migrations)
getDb();

const app = express();

// Trust reverse proxy (Render, Fly.io, Cloudflare, etc.) so secure cookies work
app.set('trust proxy', 1);

// ----------------------------------------------------------------
// CORS — allow the web app origin to send credentials
// ----------------------------------------------------------------
const isProduction = process.env.NODE_ENV === 'production';

const configuredOrigins = [
  process.env.FRONTEND_URL,
  process.env.WEB_APP_URL,
]
  .filter(Boolean)
  .flatMap((url) => (url as string).split(',').map((s) => s.trim().replace(/\/+$/, '')));

const allowedOrigins = Array.from(
  new Set([
    'https://priority-mail-zeta.vercel.app',
    'http://localhost:5173',
    'http://localhost:4173', // Vite preview
    ...configuredOrigins,
  ]),
);

app.use(
  cors({
    origin: (origin, cb) => {
      // Allow requests with no origin (curl, Postman, mobile apps)
      if (!origin) return cb(null, true);
      const normalized = origin.replace(/\/+$/, '');
      if (allowedOrigins.includes(normalized)) {
        return cb(null, true);
      }
      cb(new Error(`CORS: origin ${origin} not allowed`));
    },
    credentials: true, // Required for cross-domain cookies
  }),
);

app.use(express.json());

// ----------------------------------------------------------------
// Sessions
// In production across domains (e.g. Vercel frontend + Render backend),
// cookies must have SameSite=None and Secure=true over HTTPS.
// In local development on localhost, SameSite=Lax and Secure=false.
// ----------------------------------------------------------------
app.use(
  session({
    secret: SESSION_SECRET,
    name: 'pm.sid',
    resave: false,
    saveUninitialized: false,
    proxy: isProduction,
    cookie: {
      httpOnly: true,
      sameSite: isProduction ? 'none' : 'lax',
      secure: isProduction,
      maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
    },
  }),
);

// ----------------------------------------------------------------
// Health Check Endpoints (safe, does not expose secrets)
// ----------------------------------------------------------------
app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok' });
});

app.get('/health', (_req, res) => {
  res.json({ status: 'ok' });
});

// ----------------------------------------------------------------
// Routes
// ----------------------------------------------------------------
app.use('/api/auth', authRouter);
app.use('/api/accounts', accountsRouter);
app.use('/api/gmail', gmailRouter);
app.use('/api/classify', classifyRouter); // Legacy — kept for backward compat

// ----------------------------------------------------------------
// Start
// ----------------------------------------------------------------
const port = Number(process.env.PORT || 4000);
app.listen(port, () => console.log(`PriorityMail API running on :${port}`));
