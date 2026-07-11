import { Router, Request, Response } from 'express';
import { supabase } from '../services/supabase';
import { AuthRequest } from '../middleware/auth';
import crypto from 'crypto';

const router = Router();

async function getUserPlan(userId: string): Promise<string> {
  const { data } = await supabase.from('vg_users').select('plan').eq('id', userId).single();
  return (data?.plan as string) ?? 'free';
}

async function getWorkspaceForUser(userId: string) {
  // Owner?
  const { data: owned } = await supabase
    .from('vg_workspaces')
    .select('id, name, owner_id')
    .eq('owner_id', userId)
    .single();
  if (owned) return { workspace: owned, role: 'owner' as const };

  // Member?
  const { data: membership } = await supabase
    .from('vg_workspace_members')
    .select('workspace_id, vg_workspaces(id, name, owner_id)')
    .eq('user_id', userId)
    .single();
  if (membership) {
    const ws = (membership as any).vg_workspaces;
    return { workspace: ws, role: 'member' as const };
  }

  return null;
}

// GET /team — my workspace info
router.get('/', async (req: AuthRequest, res: Response) => {
  const ctx = await getWorkspaceForUser(req.userId!);
  if (!ctx) { res.json({ workspace: null }); return; }

  const { workspace, role } = ctx;

  const { data: members } = await supabase
    .from('vg_workspace_members')
    .select('user_id, role, joined_at, vg_users(email)')
    .eq('workspace_id', workspace.id);

  const { data: invites } = role === 'owner'
    ? await supabase
        .from('vg_workspace_invites')
        .select('id, email, token, status, created_at')
        .eq('workspace_id', workspace.id)
        .eq('status', 'pending')
    : { data: [] };

  res.json({
    workspace: { id: workspace.id, name: workspace.name, role },
    members: (members ?? []).map((m: any) => ({
      userId: m.user_id,
      role: m.role,
      joinedAt: m.joined_at,
      email: m.vg_users?.email ?? null,
    })),
    pendingInvites: invites ?? [],
  });
});

// POST /team — create workspace (Studio only)
router.post('/', async (req: AuthRequest, res: Response) => {
  const plan = await getUserPlan(req.userId!);
  if (plan !== 'studio') {
    res.status(403).json({ error: 'Workspace is a Studio plan feature. Upgrade to Studio to create a team.' });
    return;
  }

  const existing = await getWorkspaceForUser(req.userId!);
  if (existing) {
    res.status(400).json({ error: 'You already have a workspace.' });
    return;
  }

  const { name } = req.body as { name: string };
  if (!name?.trim()) { res.status(400).json({ error: 'Workspace name is required.' }); return; }

  const { data: ws, error } = await supabase
    .from('vg_workspaces')
    .insert({ name: name.trim(), owner_id: req.userId! })
    .select('id, name')
    .single();

  if (error || !ws) { res.status(500).json({ error: error?.message ?? 'Failed to create workspace.' }); return; }

  // Owner is also a member with role 'owner'
  await supabase.from('vg_workspace_members').insert({
    workspace_id: ws.id,
    user_id: req.userId!,
    role: 'owner',
  });

  res.json({ workspace: { id: ws.id, name: ws.name } });
});

// POST /team/invite — generate invite link (Studio owner only)
router.post('/invite', async (req: AuthRequest, res: Response) => {
  const ctx = await getWorkspaceForUser(req.userId!);
  if (!ctx || ctx.role !== 'owner') {
    res.status(403).json({ error: 'Only the workspace owner can invite members.' });
    return;
  }

  const { email } = req.body as { email: string };
  if (!email?.trim()) { res.status(400).json({ error: 'Email is required.' }); return; }

  // Check if already a member
  const { data: existingMember } = await supabase
    .from('vg_workspace_members')
    .select('user_id')
    .eq('workspace_id', ctx.workspace.id)
    .eq('vg_users.email', email.trim())
    .single();

  if (existingMember) {
    res.status(400).json({ error: 'This person is already in your workspace.' });
    return;
  }

  const token = crypto.randomBytes(32).toString('hex');

  await supabase.from('vg_workspace_invites').upsert(
    { workspace_id: ctx.workspace.id, email: email.trim().toLowerCase(), token, status: 'pending' },
    { onConflict: 'workspace_id,email' }
  );

  res.json({ token, inviteUrl: `/join/${token}` });
});

// GET /invite/:token — PUBLIC: get invite details (mounted without auth in index.ts)
export async function getInviteDetails(req: Request, res: Response) {
  const { data: invite } = await supabase
    .from('vg_workspace_invites')
    .select('id, email, status, workspace_id, vg_workspaces(name)')
    .eq('token', req.params.token)
    .single();

  if (!invite) { res.status(404).json({ error: 'Invite not found or already used.' }); return; }
  if ((invite as any).status !== 'pending') { res.status(410).json({ error: 'This invite has already been used.' }); return; }

  res.json({
    email: (invite as any).email,
    workspaceName: (invite as any).vg_workspaces?.name ?? 'Unknown workspace',
  });
}

// POST /team/join/:token — accept invite (auth required)
router.post('/join/:token', async (req: AuthRequest, res: Response) => {
  const { data: invite } = await supabase
    .from('vg_workspace_invites')
    .select('id, email, status, workspace_id')
    .eq('token', req.params.token)
    .single();

  if (!invite || (invite as any).status !== 'pending') {
    res.status(410).json({ error: 'This invite is invalid or already used.' });
    return;
  }

  // Add as member
  const { error } = await supabase.from('vg_workspace_members').upsert({
    workspace_id: (invite as any).workspace_id,
    user_id: req.userId!,
    role: 'member',
  }, { onConflict: 'workspace_id,user_id' });

  if (error) { res.status(500).json({ error: error.message }); return; }

  // Mark invite as accepted
  await supabase.from('vg_workspace_invites').update({ status: 'accepted' }).eq('id', (invite as any).id);

  res.json({ ok: true, workspaceId: (invite as any).workspace_id });
});

// DELETE /team/members/:userId — remove a member (Studio owner only)
router.delete('/members/:userId', async (req: AuthRequest, res: Response) => {
  const ctx = await getWorkspaceForUser(req.userId!);
  if (!ctx || ctx.role !== 'owner') {
    res.status(403).json({ error: 'Only the workspace owner can remove members.' });
    return;
  }

  if (req.params.userId === req.userId) {
    res.status(400).json({ error: 'You cannot remove yourself from the workspace.' });
    return;
  }

  await supabase
    .from('vg_workspace_members')
    .delete()
    .eq('workspace_id', ctx.workspace.id)
    .eq('user_id', req.params.userId);

  res.json({ ok: true });
});

export { getWorkspaceForUser };
export default router;
