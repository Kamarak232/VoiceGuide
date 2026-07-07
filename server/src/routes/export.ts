import { Router, Request, Response } from 'express';
import { renderFinalVideo, generateSRT, getVideoInfo, generateTitleCard, concatVideos, SyncEntry, SubtitleEntry } from '../services/ffmpeg';
import { restoreFile, urlToKey } from '../services/r2';
import path from 'path';
import fs from 'fs';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const router = Router();

router.post('/render', async (req: Request, res: Response) => {
  const { sessionId, syncManifest, videoUrl, burnSubtitles, segments, titleCard } = req.body as {
    sessionId: string;
    syncManifest: SyncEntry[];
    videoUrl: string;
    burnSubtitles?: boolean;
    segments?: { stepNumber: number; text: string }[];
    titleCard?: { title: string; subtitle: string };
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
    console.log('[export] screen not on disk, attempting R2 restore...');
    const restored = await restoreFile(urlToKey(videoUrl), screenVideoPath);
    if (!restored) {
      res.status(404).json({ error: 'Screen recording not found. Please record again.' });
      return;
    }
  }

  const resolvedManifest: SyncEntry[] = await Promise.all(
    syncManifest.map(async (entry) => {
      const localPath = path.join(__dirname, '../../../outputs', path.basename(entry.audioFile));
      if (!fs.existsSync(localPath)) {
        console.log(`[export] audio step ${entry.step} missing, attempting R2 restore...`);
        await restoreFile(`outputs/${path.basename(entry.audioFile)}`, localPath);
      }
      return { ...entry, audioFile: localPath };
    })
  );

  const outputsDir = path.join(__dirname, '../../../outputs');
  const finalOutputPath = path.join(outputsDir, `session-${sessionId}-final.mp4`);

  let srtPath: string | undefined;
  if (burnSubtitles && segments && segments.length > 0) {
    srtPath = path.join(outputsDir, `session-${sessionId}.srt`);
    const subtitleEntries: SubtitleEntry[] = resolvedManifest.map((entry) => {
      const seg = segments.find((s) => s.stepNumber === entry.step);
      return {
        step: entry.step,
        text: seg?.text ?? '',
        startTime: entry.videoStartTime,
        endTime: entry.videoStartTime + entry.audioDuration,
      };
    }).filter((e) => e.text);
    generateSRT(subtitleEntries, srtPath);
  }

  if (titleCard && titleCard.title) {
    const mainTmpPath = path.join(outputsDir, `session-${sessionId}-main-tmp.mp4`);
    const titleCardPath = path.join(outputsDir, `session-${sessionId}-titlecard.mp4`);
    try {
      const { width, height } = await getVideoInfo(screenVideoPath);
      await renderFinalVideo(screenVideoPath, resolvedManifest, [], mainTmpPath, srtPath);
      await generateTitleCard(titleCard.title, titleCard.subtitle ?? '', titleCardPath, width, height);
      await concatVideos(titleCardPath, mainTmpPath, finalOutputPath);
    } finally {
      if (fs.existsSync(mainTmpPath)) fs.unlinkSync(mainTmpPath);
      if (fs.existsSync(titleCardPath)) fs.unlinkSync(titleCardPath);
    }
  } else {
    await renderFinalVideo(screenVideoPath, resolvedManifest, [], finalOutputPath, srtPath);
  }

  res.json({ downloadUrl: `/outputs/session-${sessionId}-final.mp4` });
});

export default router;
