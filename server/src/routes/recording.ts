import { Router, Request, Response } from 'express';
import { upload } from '../middleware/upload';
import { generateScriptFromKeyframes, VideoContext } from '../services/scriptGen';
import { extractKeyframes, extractFallbackFrames, getVideoDuration, trimVideo } from '../services/ffmpeg';
import { uploadFile, urlToKey } from '../services/r2';
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

  // Switch to SSE streaming so the client sees real progress
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Transfer-Encoding', 'chunked');
  res.flushHeaders();

  function emit(event: string, data: unknown) {
    res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
  }

  const videoContext: VideoContext = JSON.parse(req.body.videoContext || '{}');
  const trimStart = parseFloat(req.body.trimStart || '0');
  const trimEnd = parseFloat(req.body.trimEnd || '0');
  const sessionId = uuidv4();
  let screenPath = screenFile.path;
  const keyframeDir = path.join(__dirname, '../../../uploads', `frames-${sessionId}`);

  try {
    let videoDuration = await getVideoDuration(screenPath);

    if (trimStart > 0 || (trimEnd > 0 && trimEnd < videoDuration)) {
      const end = trimEnd > 0 && trimEnd < videoDuration ? trimEnd : videoDuration;
      const trimmedPath = screenPath + '.trimmed.webm';
      console.log(`[process] trimming ${trimStart}s → ${end}s`);
      await trimVideo(screenPath, trimmedPath, trimStart, end);
      fs.unlinkSync(screenPath);
      fs.renameSync(trimmedPath, screenPath);
      videoDuration = end - trimStart;
    }
    console.log(`[process] duration: ${videoDuration}s`);

    emit('progress', { stage: 'extracting' });
    console.log('[process] extracting keyframes...');
    let result = await extractKeyframes(screenPath, keyframeDir);
    console.log(`[process] extracted ${result.paths.length} frames`);

    if (result.paths.length < 3) {
      console.log('[process] too few frames, trying fallback...');
      result = await extractFallbackFrames(screenPath, keyframeDir);
      console.log(`[process] fallback extracted ${result.paths.length} frames`);
    }

    if (result.paths.length === 0) {
      emit('error', { error: 'Could not extract frames from the recording. Try a longer recording.' });
      res.end();
      return;
    }

    if (!videoDuration && result.timestamps.length > 0) {
      videoDuration = result.timestamps[result.timestamps.length - 1] + 5;
    }

    emit('progress', { stage: 'analysing' });
    console.log('[process] generating script with Claude...');
    const segments = await generateScriptFromKeyframes(result.paths, result.timestamps, videoContext, videoDuration);
    console.log(`[process] got ${segments.length} segments`);

    emit('progress', { stage: 'saving' });
    const videoUrl = `/uploads/${path.basename(screenPath)}`;
    await uploadFile(screenPath, urlToKey(videoUrl)).catch((err) =>
      console.error('[r2] screen upload failed:', err.message)
    );

    emit('done', { sessionId, segments, syncManifest: [], videoUrl, videoDuration });
  } catch (e: any) {
    const message = e?.response?.data?.error?.message || e?.message || 'Processing failed.';
    emit('error', { error: message });
  } finally {
    if (fs.existsSync(keyframeDir)) {
      fs.rmSync(keyframeDir, { recursive: true, force: true });
    }
    res.end();
  }
});

export default router;
