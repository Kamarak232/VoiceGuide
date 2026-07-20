import { supabase } from './supabase';

export const PLAN_LIMITS: Record<string, number> = {
  free: 1,
  creator: 20,
  pro: 60,
  studio: 999999,
};

const ADMIN_EMAILS = new Set(
  (process.env.ADMIN_EMAILS ?? '').split(',').map((e) => e.trim()).filter(Boolean)
);

export async function checkVideoLimit(
  userId: string
): Promise<{ allowed: boolean; plan: string; used: number; limit: number }> {
  const { data: user } = await supabase
    .from('vg_users')
    .select('plan, email')
    .eq('id', userId)
    .single();

  if (user?.email && ADMIN_EMAILS.has(user.email as string)) {
    return { allowed: true, plan: 'studio', used: 0, limit: 999999 };
  }

  const plan = (user?.plan as string) ?? 'free';
  const limit = PLAN_LIMITS[plan] ?? 3;

  const startOfMonth = new Date();
  startOfMonth.setDate(1);
  startOfMonth.setHours(0, 0, 0, 0);

  const { count } = await supabase
    .from('vg_videos')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', userId)
    .gte('created_at', startOfMonth.toISOString());

  const used = count ?? 0;
  return { allowed: used < limit, plan, used, limit };
}

export async function recordVideo(
  userId: string,
  sessionId: string,
  title: string,
  extra?: {
    videoUrl?: string;
    videoDuration?: number;
    segments?: unknown;
    syncManifest?: unknown;
    videoContext?: unknown;
  }
): Promise<void> {
  await supabase.from('vg_videos').insert({
    user_id: userId,
    session_id: sessionId,
    title,
    video_url: extra?.videoUrl,
    video_duration: extra?.videoDuration,
    segments: extra?.segments,
    sync_manifest: extra?.syncManifest ?? [],
    video_context: extra?.videoContext,
  });
}

export async function updateRecordingSyncManifest(
  sessionId: string,
  syncManifest: unknown
): Promise<void> {
  await supabase
    .from('vg_videos')
    .update({ sync_manifest: syncManifest })
    .eq('session_id', sessionId);
}

export async function updateRecordingDownload(
  sessionId: string,
  downloadUrl: string
): Promise<void> {
  await supabase
    .from('vg_videos')
    .update({ download_url: downloadUrl })
    .eq('session_id', sessionId);
}

export async function listRecordings(userId: string): Promise<unknown[]> {
  // Try with new columns first; fall back to base columns if migration not yet run
  const { data, error } = await supabase
    .from('vg_videos')
    .select('session_id, title, created_at, video_duration, download_url, video_context')
    .eq('user_id', userId)
    .order('created_at', { ascending: false });
  if (error) {
    // Columns may not exist yet — return minimal data
    const { data: fallback } = await supabase
      .from('vg_videos')
      .select('session_id, title, created_at')
      .eq('user_id', userId)
      .order('created_at', { ascending: false });
    return fallback ?? [];
  }
  return data ?? [];
}

export async function getRecording(userId: string, sessionId: string): Promise<unknown | null> {
  const { data } = await supabase
    .from('vg_videos')
    .select('*')
    .eq('user_id', userId)
    .eq('session_id', sessionId)
    .single();
  return data ?? null;
}
