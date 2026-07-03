import { Router, Request, Response } from 'express';
import { renderFinalVideo, SyncEntry } from '../services/ffmpeg';
import path from 'path';
import fs from 'fs';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const router = Router();

router.post('/render', async (req: Request, res: Response) => {
  const { sessionId, syncManifest, videoUrl } = req.body as {
    sessionId: string;
    syncManifest: SyncEntry[];
    videoUrl: string;
  };

  if (!sessionId || !syncManifest || !videoUrl) {
    res.status(400).json({ error: 'sessionId, syncManifest, and videoUrl are required.' });
    return;
  }

  if (!UUID_RE.test(sessionId)) {
    res.status(400).json({ error: 'Invalid sessionId.' });
    return;
  }

  const screenVideoPath = path.join(__dirname, '../../../', videoUrl);
  if (!fs.existsSync(screenVideoPath)) {
    res.status(404).json({ error: 'Screen recording not found.' });
    return;
  }

  const resolvedManifest: SyncEntry[] = syncManifest.map((entry) => ({
    ...entry,
    audioFile: path.join(__dirname, '../../../outputs', path.basename(entry.audioFile)),
  }));

  const outputPath = path.join(__dirname, '../../../outputs', `session-${sessionId}-final.mp4`);

  await renderFinalVideo(screenVideoPath, resolvedManifest, [], outputPath);

  res.json({ downloadUrl: `/outputs/session-${sessionId}-final.mp4` });
});

export default router;
