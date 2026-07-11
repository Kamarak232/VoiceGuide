import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import rateLimit from 'express-rate-limit';
import path from 'path';
import fs from 'fs';
import axios from 'axios';
import { cleanupOrphanedFiles } from './services/cleanup';

// Keep the process alive — log the error but don't crash
process.on('uncaughtException', (err) => {
  console.error('[uncaughtException]', err);
});
process.on('unhandledRejection', (reason) => {
  console.error('[unhandledRejection]', reason);
});
import voiceRouter from './routes/voice';
import recordingRouter from './routes/recording';
import exportRouter from './routes/export';
import authRouter from './routes/auth';
import billingRouter, { webhookHandler } from './routes/billing';
import libraryRouter from './routes/library';
import voicesRouter from './routes/voices';
import watchRouter from './routes/watch';
import teamRouter, { getInviteDetails } from './routes/team';
import { requireAuth } from './middleware/auth';

const requiredEnvVars = ['FISH_AUDIO_API_KEY'];
for (const key of requiredEnvVars) {
  if (!process.env[key]) {
    throw new Error(`Missing required environment variable: ${key}. Add it to server/.env.`);
  }
}

['uploads', 'outputs'].forEach((dir) => {
  fs.mkdirSync(path.join(__dirname, '../../', dir), { recursive: true });
});

// Sweep orphaned temp files left by any jobs that were mid-flight when the server last restarted
cleanupOrphanedFiles();

const app = express();
const PORT = process.env.PORT || 3001;

const allowedOrigins = process.env.ALLOWED_ORIGINS
  ? process.env.ALLOWED_ORIGINS.split(',').map((o) => o.trim())
  : ['http://localhost:5173'];

const corsOptions: cors.CorsOptions = {
  origin: (origin, callback) => {
    if (!origin) return callback(null, true);
    if (allowedOrigins.includes(origin)) return callback(null, true);
    // Allow all Vercel preview deployments for this project
    if (/^https:\/\/voice-guide-14ah.*\.vercel\.app$/.test(origin)) return callback(null, true);
    callback(new Error(`CORS: origin ${origin} not allowed`));
  },
  allowedHeaders: ['Content-Type', 'Authorization'],
  methods: ['GET', 'HEAD', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
};

// Explicitly respond to ALL OPTIONS preflights before any auth middleware
app.options('*', cors(corsOptions));
app.use(cors(corsOptions));

// Rate limits — keyed by IP
const globalLimiter = rateLimit({
  windowMs: 60 * 1000,       // 1 minute
  max: 120,                   // 120 req/min per IP (burst tolerance for polling)
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many requests, please slow down.' },
});

const processLimiter = rateLimit({
  windowMs: 60 * 1000,       // 1 minute
  max: 3,                     // max 3 uploads/min per IP
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Upload limit reached. Please wait a moment before trying again.' },
});

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,  // 15 minutes
  max: 20,                    // 20 auth attempts per 15 min
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many login attempts. Please try again in 15 minutes.' },
});

app.use(globalLimiter);
app.use('/recording/process', processLimiter);
app.use('/auth', authLimiter);

// Stripe webhook needs raw body — must be before express.json()
app.post('/billing/webhook', express.raw({ type: 'application/json' }), webhookHandler);

app.use(express.json());

app.use('/uploads', express.static(path.join(__dirname, '../../uploads')));
app.use('/outputs', express.static(path.join(__dirname, '../../outputs')));

app.use('/auth', authRouter);
app.use('/billing', requireAuth, billingRouter);
app.use('/voice', requireAuth, voiceRouter);
app.use('/recording', requireAuth, recordingRouter);
app.use('/export', requireAuth, exportRouter);
app.use('/library', requireAuth, libraryRouter);
app.use('/voices', requireAuth, voicesRouter);
app.use('/watch', watchRouter); // public — no auth
app.get('/invite/:token', getInviteDetails); // public invite-check
app.use('/team', requireAuth, teamRouter);

app.get('/health', async (_req, res) => {
  const ollamaOk = await axios.get('http://localhost:11434/', { timeout: 3000 })
    .then(() => true)
    .catch(() => false);
  res.json({ ok: true, ollama: ollamaOk });
});

app.listen(PORT, () => {
  console.log(`VoiceTutorial server running on http://localhost:${PORT}`);
});
