import { Router, Request, Response } from 'express';
import { upload } from '../middleware/upload';
import { createVoiceClone, synthesiseWithTimestamps } from '../services/fishaudio';
import { uploadFile } from '../services/r2';
import path from 'path';
import fs from 'fs';
import ffmpeg from 'fluent-ffmpeg';

const router = Router();

function convertToMp3(inputPath: string, outputPath: string): Promise<void> {
  return new Promise((resolve, reject) => {
    ffmpeg(inputPath)
      .noVideo()
      .audioCodec('libmp3lame')
      .audioBitrate('128k')
      .audioFrequency(44100)
      .output(outputPath)
      .on('start', (cmd) => console.log('[ffmpeg] command:', cmd))
      .on('end', () => { console.log('[ffmpeg] conversion done'); resolve(); })
      .on('error', (err) => { console.error('[ffmpeg] error:', err.message); reject(err); })
      .run();
  });
}

router.post('/clone', upload.single('audio'), async (req: Request, res: Response) => {
  if (!req.file) {
    res.status(400).json({ error: 'No audio file uploaded.' });
    return;
  }

  console.log('[clone] file received:', req.file.path, 'size:', req.file.size, 'mime:', req.file.mimetype);

  const rawPath = req.file.path;
  const mp3Path = rawPath + '.mp3';

  try {
    console.log('[clone] converting to mp3...');
    await convertToMp3(rawPath, mp3Path);
    console.log('[clone] mp3 size:', fs.statSync(mp3Path).size);

    console.log('[clone] sending to Fish Audio...');
    const voiceId = await createVoiceClone(mp3Path, 'My Tutorial Voice');
    console.log('[clone] success, voiceId:', voiceId);

    res.json({ voiceId });
  } catch (e: any) {
    const raw = e?.response?.data;
    console.error('[clone] error:', JSON.stringify(raw) || e?.message);
    const detail = (Array.isArray(raw) ? raw.map((r: any) => r?.msg || r?.message).join(', ')
      : typeof raw === 'object' ? raw?.message || raw?.detail?.message || raw?.detail
      : null) || e?.message || 'Unknown error';
    const status = e?.response?.status || 500;
    res.status(status).json({ error: `Fish Audio error: ${detail}` });
  } finally {
    if (fs.existsSync(mp3Path)) fs.unlinkSync(mp3Path);
    if (fs.existsSync(rawPath)) fs.unlinkSync(rawPath);
  }
});

function getAudioDuration(filePath: string): Promise<number> {
  return new Promise((resolve, reject) => {
    ffmpeg.ffprobe(filePath, (err, meta) => {
      if (err) reject(err);
      else resolve(meta.format.duration ?? 0);
    });
  });
}

router.post('/record-step', upload.single('audio'), async (req: Request, res: Response) => {
  if (!req.file) { res.status(400).json({ error: 'No audio uploaded.' }); return; }
  const { sessionId, step } = req.body as { sessionId: string; step: string };
  if (!sessionId || !step) { res.status(400).json({ error: 'sessionId and step are required.' }); return; }

  const rawPath = req.file.path;
  const outputFile = path.join(__dirname, '../../../outputs', `session-${sessionId}-step-${step}.mp3`);
  try {
    await convertToMp3(rawPath, outputFile);
    const audioDuration = await getAudioDuration(outputFile);
    await uploadFile(outputFile, `outputs/session-${sessionId}-step-${step}.mp3`).catch((err) =>
      console.error('[r2] audio upload failed:', err.message)
    );
    res.json({ audioFile: `/outputs/session-${sessionId}-step-${step}.mp3`, audioDuration });
  } catch (e: any) {
    res.status(500).json({ error: e?.message || 'Failed to process recording.' });
  } finally {
    if (fs.existsSync(rawPath)) fs.unlinkSync(rawPath);
  }
});

router.post('/synthesise', async (req: Request, res: Response) => {
  const { text, voiceId, sessionId, step } = req.body as {
    text: string;
    voiceId: string;
    sessionId: string;
    step: number;
  };

  if (!text || !voiceId || !sessionId) {
    res.status(400).json({ error: 'text, voiceId, and sessionId are required.' });
    return;
  }

  const outputFile = path.join(__dirname, '../../../outputs', `session-${sessionId}-step-${step}.mp3`);
  try {
    const result = await synthesiseWithTimestamps(text, voiceId, outputFile);
    await uploadFile(outputFile, `outputs/session-${sessionId}-step-${step}.mp3`).catch((err) =>
      console.error('[r2] audio upload failed:', err.message)
    );
    res.json({ audioFile: `/outputs/session-${sessionId}-step-${step}.mp3`, audioDuration: result.audioDuration });
  } catch (e: any) {
    const raw = e?.response?.data;
    console.error('[synthesise] error status:', e?.response?.status, 'body:', JSON.stringify(raw)?.slice(0, 200));
    const detail = e?.message || 'TTS failed';
    res.status(500).json({ error: `Fish Audio TTS error: ${detail}` });
  }
});

export default router;
