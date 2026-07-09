import { supabase } from './supabase';

const PLAN_LIMITS: Record<string, number> = {
  free: 1,
  starter: 2,
  pro: 15,
  team: 20,
};

export async function checkVideoLimit(
  userId: string
): Promise<{ allowed: boolean; plan: string; used: number; limit: number }> {
  const { data: user } = await supabase
    .from('vg_users')
    .select('plan')
    .eq('id', userId)
    .single();

  const plan = (user?.plan as string) ?? 'free';
  const limit = PLAN_LIMITS[plan] ?? 1;

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
  title: string
): Promise<void> {
  await supabase.from('vg_videos').insert({ user_id: userId, session_id: sessionId, title });
}
