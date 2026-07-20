import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../App';
import { getBillingStatus, createCheckout, createPortal } from '../lib/api';

const PLANS = [
  {
    id: 'free',
    name: 'Free',
    price: '$0',
    period: 'forever',
    videos: '1 video / month',
    for: 'Try it risk-free',
    features: [
      'AI script from any screen recording',
      'Voice cloning — sound like you',
      'MP4 download, ready to share',
      'Subtitles & title card',
    ],
    cta: 'Get started free',
    accent: 'rgba(255,255,255,0.4)',
    popular: false,
  },
  {
    id: 'creator',
    name: 'Creator',
    price: '$19',
    period: 'per month',
    videos: '20 videos / month',
    for: 'Course creators & coaches',
    features: [
      'Everything in Free',
      'Software walkthroughs for courses',
      'Feature tutorials in your own voice',
      'Priority email support',
    ],
    cta: 'Start creating',
    accent: '#00d4ff',
    popular: true,
  },
  {
    id: 'pro',
    name: 'Pro',
    price: '$49',
    period: 'per month',
    videos: '60 videos / month',
    for: 'SaaS teams & product managers',
    features: [
      'Everything in Creator',
      'Onboarding flows & feature announcements',
      'Help-center videos at scale',
      'Priority processing',
    ],
    cta: 'Scale your docs',
    accent: '#b44dff',
    popular: false,
  },
  {
    id: 'studio',
    name: 'Studio',
    price: '$99',
    period: 'per month',
    videos: 'Unlimited videos',
    for: 'Agencies, L&D & ops teams',
    features: [
      'Everything in Pro',
      'Team workspace — invite unlimited members',
      'Shared brand voice across your whole team',
      'Client SOPs, training libraries · SLA support',
    ],
    cta: 'Go unlimited',
    accent: 'linear-gradient(135deg, #00d4ff, #b44dff)',
    popular: false,
  },
];

export default function Pricing() {
  const user = useAuth();
  const navigate = useNavigate();
  const [currentPlan, setCurrentPlan] = useState<string | null>(null);
  const [hasStripe, setHasStripe] = useState(false);
  const [loading, setLoading] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!user) return;
    getBillingStatus().then((s) => {
      setCurrentPlan(s.plan);
      setHasStripe(s.hasStripe);
    }).catch(() => {});
  }, [user]);

  async function handleCta(planId: string) {
    if (!user) { navigate('/auth'); return; }
    if (planId === 'free') { navigate('/onboarding'); return; }
    setError(null);
    if (planId === currentPlan) {
      setLoading('portal');
      try {
        const { url } = await createPortal();
        window.location.href = url;
      } catch (e) {
        setLoading(null);
        setError(e instanceof Error ? e.message : 'Failed to open billing portal.');
      }
      return;
    }
    setLoading(planId);
    try {
      const { url } = await createCheckout(planId);
      window.location.href = url;
    } catch (e) {
      setLoading(null);
      setError(e instanceof Error ? e.message : 'Failed to start checkout. Please try again.');
    }
  }

  async function handleManageBilling() {
    setError(null);
    setLoading('portal');
    try {
      const { url } = await createPortal();
      window.location.href = url;
    } catch (e) {
      setLoading(null);
      setError(e instanceof Error ? e.message : 'Failed to open billing portal.');
    }
  }

  return (
    <div className="max-w-5xl mx-auto px-6 py-16">
      <div className="text-center mb-14">
        <h1 className="text-4xl font-bold text-white mb-4">Simple, honest pricing</h1>
        <p className="text-dim text-lg max-w-2xl mx-auto">
          Whether you're building onboarding flows for a SaaS product, recording walkthroughs for a course, handing off client SOPs, or training a team — VoiceGuide turns your screen recording into a polished narrated MP4 in under a minute.
        </p>
        {user && hasStripe && (
          <button
            onClick={handleManageBilling}
            disabled={loading === 'portal'}
            className="mt-6 text-sm underline text-dim hover:text-white transition-colors"
          >
            {loading === 'portal' ? 'Opening billing…' : 'Manage billing & invoices →'}
          </button>
        )}
      </div>

      {error && (
        <div className="mb-8 px-4 py-3 rounded-xl text-sm text-center" style={{ background: 'rgba(255,60,60,0.1)', border: '1px solid rgba(255,60,60,0.3)', color: '#ff6b6b' }}>
          {error}
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5">
        {PLANS.map((plan) => {
          const isCurrent = currentPlan === plan.id;
          const isGradient = plan.accent.startsWith('linear');
          const accentColor = isGradient ? '#00d4ff' : plan.accent;

          return (
            <div
              key={plan.id}
              className="relative flex flex-col rounded-2xl p-6 transition-all"
              style={{
                background: isCurrent
                  ? `rgba(${plan.id === 'creator' ? '0,212,255' : plan.id === 'pro' ? '180,77,255' : '255,255,255'},0.06)`
                  : 'rgba(255,255,255,0.02)',
                border: `1px solid ${isCurrent ? accentColor + '55' : 'rgba(255,255,255,0.07)'}`,
                boxShadow: plan.popular && !isCurrent ? `0 0 30px ${accentColor}18` : undefined,
              }}
            >
              {plan.popular && (
                <div
                  className="absolute -top-3 left-1/2 -translate-x-1/2 text-xs font-bold px-3 py-1 rounded-full"
                  style={{ background: accentColor, color: '#06060e' }}
                >
                  Most Popular
                </div>
              )}
              {isCurrent && (
                <div
                  className="absolute -top-3 left-1/2 -translate-x-1/2 text-xs font-bold px-3 py-1 rounded-full"
                  style={{ background: accentColor, color: '#06060e' }}
                >
                  Current plan
                </div>
              )}

              <div className="mb-5">
                <p className="text-xs font-semibold uppercase tracking-widest mb-1" style={{ color: accentColor }}>
                  {plan.name}
                </p>
                <div className="flex items-end gap-1">
                  <span className="text-3xl font-bold text-white">{plan.price}</span>
                  <span className="text-sm text-dim mb-1">/{plan.period}</span>
                </div>
                <p className="text-sm mt-1 font-medium" style={{ color: accentColor }}>
                  {plan.videos}
                </p>
                <p className="text-xs mt-2" style={{ color: 'rgba(255,255,255,0.35)' }}>
                  {plan.for}
                </p>
              </div>

              <ul className="flex flex-col gap-2.5 mb-8 flex-1">
                {plan.features.map((f) => (
                  <li key={f} className="flex items-start gap-2 text-sm text-dim">
                    <span className="mt-0.5 flex-shrink-0" style={{ color: accentColor }}>✓</span>
                    {f}
                  </li>
                ))}
              </ul>

              <button
                onClick={() => handleCta(plan.id)}
                disabled={!!loading}
                className="w-full py-2.5 rounded-xl text-sm font-semibold transition-all"
                style={
                  isCurrent
                    ? { background: 'rgba(255,255,255,0.06)', color: 'rgba(255,255,255,0.5)', cursor: 'default' }
                    : isGradient
                    ? {
                        background: 'linear-gradient(135deg, rgba(0,212,255,0.15), rgba(180,77,255,0.15))',
                        border: '1px solid rgba(180,77,255,0.4)',
                        color: '#fff',
                      }
                    : {
                        background: `${accentColor}18`,
                        border: `1px solid ${accentColor}55`,
                        color: accentColor,
                      }
                }
              >
                {loading === plan.id
                  ? 'Redirecting…'
                  : isCurrent
                  ? 'Current plan'
                  : plan.cta}
              </button>
            </div>
          );
        })}
      </div>

      <p className="text-center text-xs text-dim mt-10">
        All plans include voice cloning, AI script generation, subtitles, and MP4 export. No contracts — cancel anytime.
      </p>
    </div>
  );
}
