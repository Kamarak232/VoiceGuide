import { Router, Response } from 'express';
import { upload } from '../middleware/upload';
import { generateScriptFromKeyframes, VideoContext } from '../services/scriptGen';
import { extractKeyframes, extractFallbackFrames, getVideoDuration, trimVideo } from '../services/ffmpeg';
import { uploadFile, urlToKey } from '../services/r2';
import { checkVideoLimit, recordVideo } from '../services/limits';
import { sendUsageAlert } from '../services/email';
import { createJob, updateJob, getJob, enqueue } from '../services/jobQueue';
import { AuthRequest } from '../middleware/auth';
import { v4 as uuidv4 } from 'uuid';
import path from 'path';
import fs from 'fs';

const router = Router();

const recordingUpload = upload.fields([
  { name: 'screen', maxCount: 1 },
  { name: 'narration', maxCount: 1 },
]);

router.post('/process', recordingUpload, async (req: AuthRequest, res: Response) => {
  const files = req.files as { [fieldname: string]: Express.Multer.File[] };
  const screenFile = files['screen']?.[0];

  if (!screenFile) {
    res.status(400).json({ error: 'Screen recording is required.' });
    return;
  }

  // Check plan limits before queuing
  const { allowed, plan, used, limit } = await checkVideoLimit(req.userId!);
  if (!allowed) {
    fs.unlinkSync(screenFile.path);
    res.status(402).json({
      error: `You've used ${used} of ${limit} video${limit === 1 ? '' : 's'} on your ${plan} plan this month. Upgrade to make more.`,
    });
    return;
  }

  const jobId = uuidv4();
  const sessionId = uuidv4();
  createJob(jobId);

  const videoContext: VideoContext = JSON.parse(req.body.videoContext || '{}');
  const trimStart = parseFloat(req.body.trimStart || '0');
  const trimEnd = parseFloat(req.body.trimEnd || '0');
  const userId = req.userId!;
  const userEmail = req.userEmail;
  const screenPath = screenFile.path;
  const keyframeDir = path.join(__dirname, '../../../uploads', `frames-${sessionId}`);

  // Return immediately — client polls /job/:jobId
  res.json({ jobId });

  enqueue(async () => {
    updateJob(jobId, { status: 'processing', stage: 'extracting' });
    let currentPath = screenPath;
    try {
      let videoDuration = await getVideoDuration(currentPath);

      if (trimStart > 0 || (trimEnd > 0 && trimEnd < videoDuration)) {
        const end = trimEnd > 0 && trimEnd < videoDuration ? trimEnd : videoDuration;
        const trimmedPath = currentPath + '.trimmed.webm';
        await trimVideo(currentPath, trimmedPath, trimStart, end);
        fs.unlinkSync(currentPath);
        fs.renameSync(trimmedPath, currentPath);
        videoDuration = end - trimStart;
      }

      let result = await extractKeyframes(currentPath, keyframeDir);
      if (result.paths.length < 3) {
        result = await extractFallbackFrames(currentPath, keyframeDir);
      }
      if (result.paths.length === 0) {
        updateJob(jobId, { status: 'error', error: 'Could not extract frames from the recording. Try a longer recording.' });
        return;
      }
      if (!videoDuration && result.timestamps.length > 0) {
        videoDuration = result.timestamps[result.timestamps.length - 1] + 5;
      }

      updateJob(jobId, { stage: 'analysing' });
      const segments = await generateScriptFromKeyframes(result.paths, result.timestamps, videoContext, videoDuration);

      updateJob(jobId, { stage: 'saving' });
      const videoUrl = `/uploads/${path.basename(currentPath)}`;
      await uploadFile(currentPath, urlToKey(videoUrl)).catch((err) =>
        console.error('[r2] screen upload failed:', err.message)
      );

      const title = videoContext.title || 'Untitled';
      await recordVideo(userId, sessionId, title, {
        videoUrl,
        videoDuration,
        segments,
        syncManifest: [],
        videoContext,
      }).catch((err) => console.error('[db] recordVideo failed:', err.message));

      const newUsed = used + 1;
      if (userEmail && newUsed === limit - 1 && limit !== 999999) {
        sendUsageAlert(userEmail, newUsed, limit, plan).catch((err) =>
          console.error('[email] usage alert failed:', err.message)
        );
      }

      updateJob(jobId, {
        status: 'done',
        result: { sessionId, segments, syncManifest: [], videoUrl, videoDuration },
      });
    } catch (e: any) {
      const message = e?.response?.data?.error?.message || e?.message || 'Processing failed.';
      updateJob(jobId, { status: 'error', error: message });
    } finally {
      if (fs.existsSync(keyframeDir)) {
        fs.rmSync(keyframeDir, { recursive: true, force: true });
      }
    }
  });
});

router.get('/job/:jobId', (req: AuthRequest, res: Response) => {
  const job = getJob(req.params.jobId);
  if (!job) {
    res.status(404).json({ error: 'Job not found.' });
    return;
  }
  res.json(job);
});

export default router;
