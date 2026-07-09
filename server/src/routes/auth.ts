import { Router } from 'express';
import { createClient } from '@supabase/supabase-js';
import { supabase } from '../services/supabase';

const router = Router();

router.post('/promo-login', async (req, res) => {
  const { code } = req.body as { code: string };

  const PROMO_CODE = process.env.ADMIN_PROMO_CODE;
  const ADMIN_EMAIL = process.env.ADMIN_EMAIL;
  const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD;
  const SUPABASE_URL = process.env.SUPABASE_URL!;
  const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY!;

  if (!code || !PROMO_CODE || code !== PROMO_CODE) {
    res.status(401).json({ error: 'Invalid promo code.' });
    return;
  }

  if (!ADMIN_EMAIL || !ADMIN_PASSWORD) {
    res.status(500).json({ error: 'Admin account not configured on server.' });
    return;
  }

  // Use anon key for sign-in (service role bypasses RLS but can't create sessions)
  const anonClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  let { data, error } = await anonClient.auth.signInWithPassword({
    email: ADMIN_EMAIL,
    password: ADMIN_PASSWORD,
  });

  // First-time setup: create the admin account automatically
  if (error) {
    const { error: createErr } = await supabase.auth.admin.createUser({
      email: ADMIN_EMAIL,
      password: ADMIN_PASSWORD,
      email_confirm: true,
    });

    if (createErr && !createErr.message?.includes('already been registered')) {
      const detail = createErr.message || JSON.stringify(createErr);
      res.status(500).json({ error: 'Admin account setup failed: ' + detail });
      return;
    }

    const retry = await anonClient.auth.signInWithPassword({ email: ADMIN_EMAIL, password: ADMIN_PASSWORD });
    data = retry.data;
    error = retry.error;
  }

  if (error || !data?.session) {
    res.status(500).json({ error: 'Admin sign-in failed: ' + (error?.message ?? 'no session') });
    return;
  }

  res.json({
    access_token: data.session.access_token,
    refresh_token: data.session.refresh_token,
  });
});

export default router;
