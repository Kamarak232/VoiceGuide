import { Router, Response } from 'express';
import { supabase } from '../services/supabase';
import { AuthRequest } from '../middleware/auth';
import { getWorkspaceForUser } from './team';

const router = Router();

router.get('/', async (req: AuthRequest, res: Response) => {
  // Workspace members hear the owner's brand voice
  let voiceOwnerId = req.userId!;
  const ctx = await getWorkspaceForUser(req.userId!);
  if (ctx && ctx.role === 'member') {
    voiceOwnerId = ctx.workspace.owner_id;
  }

  const { data, error } = await supabase
    .from('vg_voices')
    .select('voice_id, name, created_at')
    .eq('user_id', voiceOwnerId)
    .order('created_at', { ascending: false });
  if (error) { res.status(500).json({ error: error.message }); return; }
  res.json({ voices: data ?? [] });
});

router.post('/', async (req: AuthRequest, res: Response) => {
  const { voiceId, name } = req.body as { voiceId: string; name: string };
  if (!voiceId || !name) { res.status(400).json({ error: 'voiceId and name are required.' }); return; }
  const { error } = await supabase
    .from('vg_voices')
    .upsert({ user_id: req.userId!, voice_id: voiceId, name }, { onConflict: 'user_id,voice_id' });
  if (error) { res.status(500).json({ error: error.message }); return; }
  res.json({ ok: true });
});

router.delete('/:voiceId', async (req: AuthRequest, res: Response) => {
  const { error } = await supabase
    .from('vg_voices')
    .delete()
    .eq('user_id', req.userId!)
    .eq('voice_id', req.params.voiceId);
  if (error) { res.status(500).json({ error: error.message }); return; }
  res.json({ ok: true });
});

export default router;
