import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../App';
import { getBillingStatus, createPortal, getTeam, createWorkspace, inviteMember, removeMember, TeamData } from '../lib/api';
import { supabase } from '../lib/supabase';
import { useStore } from '../store/useStore';

export default function Settings() {
  const user = useAuth();
  const navigate = useNavigate();
  const [billing, setBilling] = useState<{ plan: string; used: number; limit: number; hasStripe: boolean } | null>(null);
  const [portalLoading, setPortalLoading] = useState(false);
  const [signOutLoading, setSignOutLoading] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);

  const [team, setTeam] = useState<TeamData | null>(null);
  const [workspaceName, setWorkspaceName] = useState('');
  const [creatingWorkspace, setCreatingWorkspace] = useState(false);
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviting, setInviting] = useState(false);
  const [inviteLink, setInviteLink] = useState('');
  const [inviteCopied, setInviteCopied] = useState(false);
  const [teamError, setTeamError] = useState('');
  const [confirmRemove, setConfirmRemove] = useState<string | null>(null);

  const voiceId = useStore((s) => s.voiceId);
  const savedVoices = useStore((s) => s.savedVoices);
  const setVoiceId = useStore((s) => s.setVoiceId);
  const removeVoice = useStore((s) => s.removeVoice);

  useEffect(() => {
    if (!user) return;
    getBillingStatus().then(setBilling).catch(() => {});
    getTeam().then(setTeam).catch(() => {});
  }, [user]);

  async function handleCreateWorkspace() {
    if (!workspaceName.trim()) return;
    setCreatingWorkspace(true);
    setTeamError('');
    try {
      await createWorkspace(workspaceName.trim());
      setWorkspaceName('');
      const updated = await getTeam();
      setTeam(updated);
    } catch (e: any) {
      setTeamError(e.message);
    } finally {
      setCreatingWorkspace(false);
    }
  }

  async function handleInvite() {
    if (!inviteEmail.trim()) return;
    setInviting(true);
    setTeamError('');
    setInviteLink('');
    try {
      const { token } = await inviteMember(inviteEmail.trim());
      const link = `${window.location.origin}/join/${token}`;
      setInviteLink(link);
      setInviteEmail('');
      const updated = await getTeam();
      setTeam(updated);
    } catch (e: any) {
      setTeamError(e.message);
    } finally {
      setInviting(false);
    }
  }

  async function handleRemoveMember(userId: string) {
    try {
      await removeMember(userId);
      setConfirmRemove(null);
      const updated = await getTeam();
      setTeam(updated);
    } catch (e: any) {
      setTeamError(e.message);
    }
  }

  function copyInviteLink() {
    navigator.clipboard.writeText(inviteLink).then(() => {
      setInviteCopied(true);
      setTimeout(() => setInviteCopied(false), 2000);
    });
  }

  async function handleManageBilling() {
    setPortalLoading(true);
    try {
      const { url } = await createPortal();
      window.location.href = url;
    } catch {
      setPortalLoading(false);
    }
  }

  async function handleSignOut() {
    setSignOutLoading(true);
    await supabase.auth.signOut();
    navigate('/auth');
  }

  function handleDeleteVoice(id: string) {
    removeVoice(id);
    setConfirmDelete(null);
  }

  const planLabel: Record<string, string> = {
    free: 'Free',
    creator: 'Creator — $19/mo',
    pro: 'Pro — $49/mo',
    studio: 'Studio — $99/mo',
  };

  const planColor: Record<string, string> = {
    free: 'rgba(255,255,255,0.4)',
    creator: '#00d4ff',
    pro: '#b44dff',
    studio: '#00d4ff',
  };

  return (
    <div className="max-w-lg mx-auto px-6 py-16">
      <h1 className="text-2xl font-bold text-white mb-8">Account</h1>

      <div className="flex flex-col gap-4">

        {/* Email */}
        <div className="rounded-2xl p-5" style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)' }}>
          <p className="text-xs font-semibold uppercase tracking-widest mb-1" style={{ color: 'rgba(255,255,255,0.3)' }}>Email</p>
          <p className="text-white text-sm">{user?.email}</p>
        </div>

        {/* Plan */}
        <div className="rounded-2xl p-5" style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)' }}>
          <p className="text-xs font-semibold uppercase tracking-widest mb-1" style={{ color: 'rgba(255,255,255,0.3)' }}>Plan</p>
          {billing ? (
            <p className="text-sm font-semibold" style={{ color: planColor[billing.plan] ?? '#fff' }}>
              {planLabel[billing.plan] ?? billing.plan}
            </p>
          ) : (
            <p className="text-sm text-dim">Loading…</p>
          )}
        </div>

        {/* Usage */}
        {billing && (
          <div className="rounded-2xl p-5" style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)' }}>
            <p className="text-xs font-semibold uppercase tracking-widest mb-2" style={{ color: 'rgba(255,255,255,0.3)' }}>Videos this month</p>
            <div className="flex items-center justify-between mb-2">
              <span className="text-white text-sm">{billing.used} / {billing.limit === 999999 ? '∞' : billing.limit}</span>
              {billing.limit !== 999999 && (
                <span className="text-xs" style={{ color: 'rgba(255,255,255,0.3)' }}>
                  {Math.max(0, billing.limit - billing.used)} remaining
                </span>
              )}
            </div>
            {billing.limit !== 999999 && (
              <div className="w-full rounded-full h-1.5" style={{ background: 'rgba(255,255,255,0.08)' }}>
                <div
                  className="h-1.5 rounded-full transition-all"
                  style={{
                    width: `${Math.min(100, (billing.used / billing.limit) * 100)}%`,
                    background: billing.used >= billing.limit ? '#ff4444' : planColor[billing.plan] ?? '#00d4ff',
                  }}
                />
              </div>
            )}
          </div>
        )}

        {/* Saved Voices */}
        <div className="rounded-2xl p-5" style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)' }}>
          <div className="flex items-center justify-between mb-3">
            <p className="text-xs font-semibold uppercase tracking-widest" style={{ color: 'rgba(255,255,255,0.3)' }}>Saved Voices</p>
            <button
              onClick={() => navigate('/onboarding')}
              className="text-xs font-medium transition-colors"
              style={{ color: '#00d4ff' }}
            >
              + Clone new
            </button>
          </div>
          {savedVoices.length === 0 ? (
            <p className="text-sm text-dim">No voices saved yet.{' '}
              <button onClick={() => navigate('/onboarding')} className="underline" style={{ color: '#00d4ff' }}>
                Clone your voice →
              </button>
            </p>
          ) : (
            <div className="flex flex-col gap-2">
              {savedVoices.map((v) => {
                const isActive = v.id === voiceId;
                return (
                  <div key={v.id}
                    className="flex items-center gap-3 p-3 rounded-xl"
                    style={{
                      background: isActive ? 'rgba(0,212,255,0.06)' : 'rgba(255,255,255,0.02)',
                      border: isActive ? '1px solid rgba(0,212,255,0.2)' : '1px solid rgba(255,255,255,0.05)',
                    }}
                  >
                    <div className="w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0"
                      style={{ background: isActive ? 'rgba(0,212,255,0.12)' : 'rgba(255,255,255,0.04)' }}>
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
                        <path d="M12 2a3 3 0 0 1 3 3v7a3 3 0 0 1-6 0V5a3 3 0 0 1 3-3z" fill={isActive ? '#00d4ff' : 'rgba(255,255,255,0.4)'} />
                        <path d="M19 10v1a7 7 0 0 1-14 0v-1M12 19v3M9 22h6" stroke={isActive ? '#00d4ff' : 'rgba(255,255,255,0.3)'} strokeWidth="1.5" strokeLinecap="round" />
                      </svg>
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-white truncate">{v.name}</p>
                      <p className="text-xs" style={{ color: 'rgba(255,255,255,0.3)' }}>
                        {new Date(v.createdAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}
                      </p>
                    </div>
                    <div className="flex items-center gap-2 flex-shrink-0">
                      {isActive ? (
                        <span className="text-xs font-medium px-2 py-0.5 rounded-full"
                          style={{ background: 'rgba(0,212,255,0.1)', color: '#00d4ff' }}>
                          Active
                        </span>
                      ) : (
                        <button onClick={() => setVoiceId(v.id)}
                          className="text-xs font-medium px-3 py-1 rounded-lg transition-all"
                          style={{ background: 'rgba(255,255,255,0.04)', color: 'rgba(255,255,255,0.5)', border: '1px solid rgba(255,255,255,0.08)' }}>
                          Use
                        </button>
                      )}
                      {confirmDelete === v.id ? (
                        <div className="flex items-center gap-1">
                          <button onClick={() => handleDeleteVoice(v.id)}
                            className="text-xs px-2 py-1 rounded-lg"
                            style={{ background: 'rgba(255,60,60,0.12)', color: 'rgba(255,100,100,0.9)' }}>
                            Delete
                          </button>
                          <button onClick={() => setConfirmDelete(null)}
                            className="text-xs px-2 py-1 rounded-lg"
                            style={{ color: 'rgba(255,255,255,0.3)' }}>
                            Cancel
                          </button>
                        </div>
                      ) : (
                        <button onClick={() => setConfirmDelete(v.id)}
                          className="w-6 h-6 flex items-center justify-center rounded-lg transition-all"
                          style={{ color: 'rgba(255,255,255,0.2)' }}>
                          <svg width="12" height="12" viewBox="0 0 16 16" fill="none">
                            <path d="M2 4h12M5 4V2h6v2M6 7v5M10 7v5M3 4l1 10h8l1-10" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" />
                          </svg>
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Team Workspace — Studio plan only */}
        {billing?.plan === 'studio' && (
          <div className="rounded-2xl p-5" style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)' }}>
            <div className="flex items-center gap-2 mb-4">
              <p className="text-xs font-semibold uppercase tracking-widest" style={{ color: 'rgba(255,255,255,0.3)' }}>Team Workspace</p>
              <span className="text-xs font-medium px-2 py-0.5 rounded-full" style={{ background: 'linear-gradient(135deg, rgba(0,212,255,0.15), rgba(180,77,255,0.1))', color: '#00d4ff', border: '1px solid rgba(0,212,255,0.2)' }}>Studio</span>
            </div>

            {teamError && <p className="text-sm mb-3" style={{ color: 'rgba(255,120,120,0.9)' }}>{teamError}</p>}

            {!team?.workspace ? (
              /* Create workspace */
              <div className="flex flex-col gap-3">
                <p className="text-sm text-dim">Create a workspace so your team can collaborate using the same brand voice.</p>
                <div className="flex gap-2">
                  <input
                    value={workspaceName}
                    onChange={(e) => setWorkspaceName(e.target.value)}
                    onKeyDown={(e) => { if (e.key === 'Enter') handleCreateWorkspace(); }}
                    placeholder="e.g. Acme Inc."
                    className="flex-1 rounded-lg px-3 py-2 text-sm text-white outline-none"
                    style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)' }}
                  />
                  <button
                    onClick={handleCreateWorkspace}
                    disabled={creatingWorkspace || !workspaceName.trim()}
                    className="px-4 py-2 rounded-lg text-sm font-medium transition-all"
                    style={{ background: 'rgba(0,212,255,0.1)', border: '1px solid rgba(0,212,255,0.25)', color: '#00d4ff' }}
                  >
                    {creatingWorkspace ? 'Creating…' : 'Create'}
                  </button>
                </div>
              </div>
            ) : (
              /* Workspace exists */
              <div className="flex flex-col gap-4">
                <div className="flex items-center gap-2">
                  <div className="w-7 h-7 rounded-lg flex items-center justify-center" style={{ background: 'rgba(0,212,255,0.1)', border: '1px solid rgba(0,212,255,0.2)' }}>
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
                      <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM23 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75" stroke="#00d4ff" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  </div>
                  <p className="text-white font-semibold text-sm">{team.workspace.name}</p>
                  {team.workspace.role === 'owner' && (
                    <span className="text-xs px-2 py-0.5 rounded-full" style={{ background: 'rgba(180,77,255,0.1)', color: '#b44dff', border: '1px solid rgba(180,77,255,0.2)' }}>Owner</span>
                  )}
                </div>

                {/* Members list */}
                {team.members.filter(m => m.role !== 'owner').length > 0 && (
                  <div className="flex flex-col gap-2">
                    <p className="text-xs font-medium" style={{ color: 'rgba(255,255,255,0.3)' }}>Members</p>
                    {team.members.filter(m => m.role !== 'owner').map((m) => (
                      <div key={m.userId} className="flex items-center justify-between gap-3 p-2.5 rounded-xl" style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.05)' }}>
                        <p className="text-sm text-white truncate">{m.email ?? m.userId.slice(0, 8) + '…'}</p>
                        {team.workspace?.role === 'owner' && (
                          confirmRemove === m.userId ? (
                            <div className="flex items-center gap-1 flex-shrink-0">
                              <button onClick={() => handleRemoveMember(m.userId)} className="text-xs px-2 py-1 rounded-lg" style={{ background: 'rgba(255,60,60,0.12)', color: 'rgba(255,100,100,0.9)' }}>Remove</button>
                              <button onClick={() => setConfirmRemove(null)} className="text-xs px-2 py-1 rounded-lg" style={{ color: 'rgba(255,255,255,0.3)' }}>Cancel</button>
                            </div>
                          ) : (
                            <button onClick={() => setConfirmRemove(m.userId)} className="text-xs flex-shrink-0" style={{ color: 'rgba(255,100,100,0.5)' }}>Remove</button>
                          )
                        )}
                      </div>
                    ))}
                  </div>
                )}

                {/* Pending invites */}
                {team.pendingInvites.length > 0 && (
                  <div className="flex flex-col gap-1">
                    <p className="text-xs font-medium" style={{ color: 'rgba(255,255,255,0.3)' }}>Pending invites</p>
                    {team.pendingInvites.map((inv) => (
                      <p key={inv.id} className="text-sm text-dim">{inv.email} <span style={{ color: 'rgba(255,255,255,0.2)' }}>· awaiting</span></p>
                    ))}
                  </div>
                )}

                {/* Invite form (owner only) */}
                {team.workspace.role === 'owner' && (
                  <div className="flex flex-col gap-2 pt-2" style={{ borderTop: '1px solid rgba(255,255,255,0.05)' }}>
                    <p className="text-xs font-medium" style={{ color: 'rgba(255,255,255,0.3)' }}>Invite a teammate</p>
                    <div className="flex gap-2">
                      <input
                        value={inviteEmail}
                        onChange={(e) => setInviteEmail(e.target.value)}
                        onKeyDown={(e) => { if (e.key === 'Enter') handleInvite(); }}
                        placeholder="teammate@company.com"
                        type="email"
                        className="flex-1 rounded-lg px-3 py-2 text-sm text-white outline-none"
                        style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)' }}
                      />
                      <button
                        onClick={handleInvite}
                        disabled={inviting || !inviteEmail.trim()}
                        className="px-4 py-2 rounded-lg text-sm font-medium transition-all flex-shrink-0"
                        style={{ background: 'rgba(0,212,255,0.1)', border: '1px solid rgba(0,212,255,0.25)', color: '#00d4ff' }}
                      >
                        {inviting ? 'Generating…' : 'Invite'}
                      </button>
                    </div>
                    {inviteLink && (
                      <div className="flex items-center gap-2 p-2.5 rounded-xl" style={{ background: 'rgba(0,212,255,0.04)', border: '1px solid rgba(0,212,255,0.15)' }}>
                        <p className="text-xs text-dim truncate flex-1">{inviteLink}</p>
                        <button onClick={copyInviteLink} className="text-xs font-medium flex-shrink-0" style={{ color: inviteCopied ? '#00d4ff' : 'rgba(255,255,255,0.4)' }}>
                          {inviteCopied ? 'Copied!' : 'Copy'}
                        </button>
                      </div>
                    )}
                    <p className="text-xs" style={{ color: 'rgba(255,255,255,0.2)' }}>Share this link with your teammate. It expires once used.</p>
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* Billing actions */}
        <div className="flex flex-col gap-3 mt-2">
          {billing?.hasStripe ? (
            <button
              onClick={handleManageBilling}
              disabled={portalLoading}
              className="w-full py-3 rounded-xl text-sm font-semibold transition-all"
              style={{ background: 'rgba(0,212,255,0.08)', border: '1px solid rgba(0,212,255,0.2)', color: '#00d4ff' }}
            >
              {portalLoading ? 'Opening…' : 'Manage billing & invoices'}
            </button>
          ) : (
            <button
              onClick={() => navigate('/pricing')}
              className="w-full py-3 rounded-xl text-sm font-semibold transition-all"
              style={{ background: 'rgba(0,212,255,0.08)', border: '1px solid rgba(0,212,255,0.2)', color: '#00d4ff' }}
            >
              Upgrade plan
            </button>
          )}

          <button
            onClick={handleSignOut}
            disabled={signOutLoading}
            className="w-full py-3 rounded-xl text-sm font-semibold transition-all"
            style={{ background: 'rgba(255,60,60,0.06)', border: '1px solid rgba(255,60,60,0.2)', color: '#ff6b6b' }}
          >
            {signOutLoading ? 'Signing out…' : 'Sign out'}
          </button>
        </div>

      </div>
    </div>
  );
}
