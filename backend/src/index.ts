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
const SESSION_SECRET = process.env.SESSION_SECRET;
if (!SESSION_SECRET) {
  console.error('[startup] SESSION_SECRET is not set. The server will not start securely.');
  process.exit(1);
}

// Initialize DB (runs migrations)
getDb();

const app = express();

// ----------------------------------------------------------------
// CORS — allow the web app origin to send cookies
// ----------------------------------------------------------------
const allowedOrigins = [
  process.env.WEB_APP_URL ?? 'http://localhost:5173',
  'http://localhost:5173',
  'http://localhost:4173', // Vite preview
];

app.use(
  cors({
    origin: (origin, cb) => {
      // Allow requests with no origin (curl, Postman, mobile apps)
      if (!origin || allowedOrigins.includes(origin)) return cb(null, true);
      cb(new Error(`CORS: origin ${origin} not allowed`));
    },
    credentials: true, // Required for cookies
  }),
);

app.use(express.json());

// ----------------------------------------------------------------
// Sessions — in-memory store for development
// NOTE: Replace with a persistent session store for production.
// Options: connect-sqlite3 (requires better-sqlite3 build tools),
//          connect-redis (requires Redis), or a custom node:sqlite store.
// For local dev, MemoryStore is fine (sessions reset on server restart).
// ----------------------------------------------------------------
app.use(
  session({
    secret: SESSION_SECRET,
    name: 'pm.sid',
    resave: false,
    saveUninitialized: false,
    cookie: {
      httpOnly: true,
      sameSite: 'lax',
      secure: process.env.NODE_ENV === 'production',
      maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
    },
  }),
);

// ----------------------------------------------------------------
// Routes
// ----------------------------------------------------------------
app.get('/health', (_req, res) =>
  res.json({ ok: true, service: 'priority-mail-backend', version: '2.0.0' }),
);

app.use('/api/auth', authRouter);
app.use('/api/accounts', accountsRouter);
app.use('/api/gmail', gmailRouter);
app.use('/api/classify', classifyRouter); // Legacy — kept for backward compat

// ----------------------------------------------------------------
// Start
// ----------------------------------------------------------------
const port = Number(process.env.PORT || 4000);
app.listen(port, () => console.log(`PriorityMail API running on :${port}`));
