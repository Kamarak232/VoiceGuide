import { Router, Request, Response } from 'express';
import { upload } from '../middleware/upload';
import { generateScriptFromKeyframes, VideoContext } from '../services/scriptGen';
import { extractKeyframes, extractFallbackFrames, getVideoDuration } from '../services/ffmpeg';
import { v4 as uuidv4 } from 'uuid';
import path from 'path';
import fs from 'fs';

const router = Router();

const recordingUpload = upload.fields([
  { name: 'screen', maxCount: 1 },
  { name: 'narration', maxCount: 1 },
]);

router.post('/process', recordingUpload, async (req: Request, res: Response) => {
  const files = req.files as { [fieldname: string]: Express.Multer.File[] };
  const screenFile = files['screen']?.[0];

  if (!screenFile) {
    res.status(400).json({ error: 'Screen recording is required.' });
    return;
  }

  console.log(`[process] file received: ${screenFile.path} size: ${screenFile.size}`);

  const videoContext: VideoContext = JSON.parse(req.body.videoContext || '{}');
  const sessionId = uuidv4();
  const screenPath = screenFile.path;
  const keyframeDir = path.join(__dirname, '../../../uploads', `frames-${sessionId}`);

  try {
    console.log('[process] getting video duration...');
    let videoDuration = await getVideoDuration(screenPath);
    console.log(`[process] duration: ${videoDuration}s`);

    console.log('[process] extracting keyframes...');
    let result = await extractKeyframes(screenPath, keyframeDir);
    console.log(`[process] extracted ${result.paths.length} frames`);

    if (result.paths.length < 3) {
      console.log('[process] too few frames, trying fallback...');
      result = await extractFallbackFrames(screenPath, keyframeDir);
      console.log(`[process] fallback extracted ${result.paths.length} frames`);
    }

    if (result.paths.length === 0) {
      res.status(422).json({ error: 'Could not extract frames from the recording. Try a longer recording.' });
      return;
    }

    // WebM from MediaRecorder often has no duration header — fall back to last frame timestamp
    if (!videoDuration && result.timestamps.length > 0) {
      videoDuration = result.timestamps[result.timestamps.length - 1] + 5;
    }

    console.log('[process] generating script with Claude...');
    const segments = await generateScriptFromKeyframes(result.paths, result.timestamps, videoContext, videoDuration);
    console.log(`[process] got ${segments.length} segments`);

    res.json({
      sessionId,
      segments,
      syncManifest: [],
      videoUrl: `/uploads/${path.basename(screenPath)}`,
      videoDuration,
    });
  } catch (e: any) {
    const message = e?.response?.data?.error?.message || e?.message || 'Processing failed.';
    res.status(500).json({ error: message });
  } finally {
    if (fs.existsSync(keyframeDir)) {
      fs.rmSync(keyframeDir, { recursive: true, force: true });
    }
  }
});

export default router;
