import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../App';
import { getBillingStatus, createPortal } from '../lib/api';
import { supabase } from '../lib/supabase';

export default function Settings() {
  const user = useAuth();
  const navigate = useNavigate();
  const [billing, setBilling] = useState<{ plan: string; used: number; limit: number; hasStripe: boolean } | null>(null);
  const [portalLoading, setPortalLoading] = useState(false);
  const [signOutLoading, setSignOutLoading] = useState(false);

  useEffect(() => {
    if (!user) return;
    getBillingStatus().then(setBilling).catch(() => {});
  }, [user]);

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
