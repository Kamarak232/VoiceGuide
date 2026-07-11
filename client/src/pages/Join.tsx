import { useEffect, useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { getInviteInfo, acceptInvite } from '../lib/api';
import { useAuth } from '../App';

export default function Join() {
  const { token } = useParams<{ token: string }>();
  const navigate = useNavigate();
  const user = useAuth();

  const [info, setInfo] = useState<{ email: string; workspaceName: string } | null>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [joining, setJoining] = useState(false);

  useEffect(() => {
    if (!token) return;
    getInviteInfo(token)
      .then(setInfo)
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, [token]);

  async function handleAccept() {
    if (!token) return;
    if (!user) {
      // Redirect to auth, come back after login
      navigate(`/auth?next=/join/${token}`);
      return;
    }
    setJoining(true);
    try {
      await acceptInvite(token);
      navigate('/onboarding');
    } catch (e: any) {
      setError(e.message);
      setJoining(false);
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="flex items-center gap-3 text-dim">
          <div className="w-4 h-4 border-2 border-t-transparent rounded-full animate-spin" style={{ borderColor: '#00d4ff', borderTopColor: 'transparent' }} />
          Loading invite…
        </div>
      </div>
    );
  }

  if (error || !info) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-4 px-6 text-center">
        <p className="text-white font-semibold text-lg">Invite not found</p>
        <p className="text-dim text-sm">{error || 'This invite link is invalid or has already been used.'}</p>
        <Link to="/" style={{ color: '#00d4ff' }} className="text-sm">Go to VoiceGuide →</Link>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center px-6">
      <div className="max-w-sm w-full text-center">
        {/* Icon */}
        <div className="w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-6"
          style={{ background: 'linear-gradient(135deg, rgba(0,212,255,0.15), rgba(180,77,255,0.1))', border: '1px solid rgba(0,212,255,0.25)' }}>
          <svg width="28" height="28" viewBox="0 0 24 24" fill="none">
            <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM23 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75" stroke="#00d4ff" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </div>

        <h1 className="text-2xl font-bold text-white mb-2">You're invited</h1>
        <p className="text-dim text-sm mb-1">
          You've been invited to join the <span className="text-white font-semibold">{info.workspaceName}</span> workspace on VoiceGuide.
        </p>
        <p className="text-xs mb-8" style={{ color: 'rgba(255,255,255,0.25)' }}>
          Sent to {info.email}
        </p>

        <button
          onClick={handleAccept}
          disabled={joining}
          className="btn-neon w-full mb-4"
          style={{
            background: 'linear-gradient(135deg, rgba(0,212,255,0.2), rgba(180,77,255,0.1))',
            borderColor: 'rgba(0,212,255,0.4)',
            boxShadow: '0 0 24px rgba(0,212,255,0.15)',
          }}
        >
          {joining ? (
            <span className="flex items-center justify-center gap-2">
              <span className="w-4 h-4 border-2 border-t-transparent rounded-full animate-spin" style={{ borderColor: '#00d4ff', borderTopColor: 'transparent' }} />
              Joining…
            </span>
          ) : user ? `Join ${info.workspaceName} →` : 'Sign in to accept →'}
        </button>

        <p className="text-xs" style={{ color: 'rgba(255,255,255,0.2)' }}>
          By joining you'll share the workspace's brand voice and library.
        </p>
      </div>
    </div>
  );
}
