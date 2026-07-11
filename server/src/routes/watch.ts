import { Router, Request, Response } from 'express';
import { supabase } from '../services/supabase';

const router = Router();

// Public — no auth required
router.get('/:sessionId', async (req: Request, res: Response) => {
  const { data, error } = await supabase
    .from('vg_videos')
    .select('session_id, title, download_url, segments, video_context')
    .eq('session_id', req.params.sessionId)
    .single();

  if (error || !data) {
    res.status(404).json({ error: 'Tutorial not found.' });
    return;
  }

  if (!data.download_url) {
    res.status(404).json({ error: 'This tutorial has not been rendered yet.' });
    return;
  }

  res.json({
    sessionId: data.session_id,
    title: data.title,
    downloadUrl: data.download_url,
    segments: data.segments ?? [],
    videoContext: data.video_context ?? {},
  });
});

export default router;
