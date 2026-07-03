import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import path from 'path';
import fs from 'fs';
import axios from 'axios';
import voiceRouter from './routes/voice';
import recordingRouter from './routes/recording';
import exportRouter from './routes/export';

const requiredEnvVars = ['FISH_AUDIO_API_KEY'];
for (const key of requiredEnvVars) {
  if (!process.env[key]) {
    throw new Error(`Missing required environment variable: ${key}. Add it to server/.env.`);
  }
}

['uploads', 'outputs'].forEach((dir) => {
  fs.mkdirSync(path.join(__dirname, '../../', dir), { recursive: true });
});

const app = express();
const PORT = process.env.PORT || 3001;

const allowedOrigins = process.env.ALLOWED_ORIGINS
  ? process.env.ALLOWED_ORIGINS.split(',').map((o) => o.trim())
  : ['http://localhost:5173'];
app.use(cors({ origin: allowedOrigins }));
app.use(express.json());

app.use('/uploads', express.static(path.join(__dirname, '../../uploads')));
app.use('/outputs', express.static(path.join(__dirname, '../../outputs')));

app.use('/voice', voiceRouter);
app.use('/recording', recordingRouter);
app.use('/export', exportRouter);

app.get('/health', async (_req, res) => {
  const ollamaOk = await axios.get('http://localhost:11434/', { timeout: 3000 })
    .then(() => true)
    .catch(() => false);
  res.json({ ok: true, ollama: ollamaOk });
});

app.listen(PORT, () => {
  console.log(`VoiceTutorial server running on http://localhost:${PORT}`);
});
