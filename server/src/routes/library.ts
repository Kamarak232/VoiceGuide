import { Router, Response } from 'express';
import { AuthRequest } from '../middleware/auth';
import { listRecordings, getRecording } from '../services/limits';

const router = Router();

router.get('/', async (req: AuthRequest, res: Response) => {
  try {
    const recordings = await listRecordings(req.userId!);
    res.json({ recordings });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

router.get('/:sessionId', async (req: AuthRequest, res: Response) => {
  try {
    const recording = await getRecording(req.userId!, req.params.sessionId);
    if (!recording) {
      res.status(404).json({ error: 'Recording not found.' });
      return;
    }
    res.json({ recording });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

export default router;
