import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { promoLogin } from '../lib/api';

export default function Auth() {
  const navigate = useNavigate();
  const [mode, setMode] = useState<'signin' | 'signup'>('signin');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [promoCode, setPromoCode] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setSuccess('');
    setLoading(true);
    try {
      // Promo code bypasses email/password entirely
      if (promoCode.trim()) {
        const { access_token, refresh_token } = await promoLogin(promoCode.trim());
        await supabase.auth.setSession({ access_token, refresh_token });
        navigate('/onboarding');
        return;
      }

      if (mode === 'signup') {
        const { error } = await supabase.auth.signUp({ email, password });
        if (error) throw error;
        setSuccess('Account created! Check your email to confirm, then sign in.');
        setMode('signin');
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        navigate('/onboarding');
      }
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Something went wrong.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center px-6">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <div
            className="text-3xl font-bold tracking-tight mb-2"
            style={{ background: 'linear-gradient(90deg, #00d4ff, #b44dff)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}
          >
            VoiceGuide
          </div>
          <h1 className="text-xl font-semibold text-white mb-1">
            {mode === 'signin' ? 'Welcome back' : 'Create your account'}
          </h1>
          <p className="text-sm text-dim">
            {mode === 'signin' ? "Don't have an account? " : 'Already have an account? '}
            <button
              onClick={() => { setMode(mode === 'signin' ? 'signup' : 'signin'); setError(''); setSuccess(''); }}
              className="text-neon underline"
            >
              {mode === 'signin' ? 'Sign up' : 'Sign in'}
            </button>
          </p>
        </div>

        <form
          onSubmit={handleSubmit}
          className="flex flex-col gap-4 p-6 rounded-2xl"
          style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)' }}
        >
          <div>
            <label className="text-xs font-medium text-dim block mb-1.5">Email</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              autoFocus
              placeholder="you@company.com"
              className="w-full rounded-lg px-3 py-2.5 text-sm text-white outline-none transition-all"
              style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', caretColor: '#00d4ff' }}
              onFocus={(e) => (e.target.style.borderColor = 'rgba(0,212,255,0.4)')}
              onBlur={(e) => (e.target.style.borderColor = 'rgba(255,255,255,0.1)')}
            />
          </div>
          <div>
            <label className="text-xs font-medium text-dim block mb-1.5">Password</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              minLength={6}
              placeholder="••••••••"
              className="w-full rounded-lg px-3 py-2.5 text-sm text-white outline-none transition-all"
              style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', caretColor: '#00d4ff' }}
              onFocus={(e) => (e.target.style.borderColor = 'rgba(0,212,255,0.4)')}
              onBlur={(e) => (e.target.style.borderColor = 'rgba(255,255,255,0.1)')}
            />
          </div>

          <div>
            <label className="text-xs font-medium text-dim block mb-1.5">Promo code <span style={{ color: 'rgba(255,255,255,0.25)' }}>(optional)</span></label>
            <input
              type="text"
              value={promoCode}
              onChange={(e) => setPromoCode(e.target.value)}
              placeholder="Enter code"
              className="w-full rounded-lg px-3 py-2.5 text-sm text-white outline-none transition-all"
              style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', caretColor: '#b44dff' }}
              onFocus={(e) => (e.target.style.borderColor = 'rgba(180,77,255,0.4)')}
              onBlur={(e) => (e.target.style.borderColor = 'rgba(255,255,255,0.1)')}
            />
          </div>

          {error && (
            <p className="text-sm rounded-lg px-3 py-2" style={{ color: 'rgba(255,100,100,0.9)', background: 'rgba(255,80,80,0.06)', border: '1px solid rgba(255,80,80,0.15)' }}>
              {error}
            </p>
          )}
          {success && (
            <p className="text-sm rounded-lg px-3 py-2" style={{ color: '#00d4ff', background: 'rgba(0,212,255,0.06)', border: '1px solid rgba(0,212,255,0.15)' }}>
              {success}
            </p>
          )}

          <button type="submit" disabled={loading} className="btn-neon mt-1">
            {loading ? (
              <span className="flex items-center justify-center gap-2">
                <span
                  className="w-4 h-4 border-2 rounded-full animate-spin"
                  style={{ borderColor: '#00d4ff', borderTopColor: 'transparent' }}
                />
                {mode === 'signin' ? 'Signing in…' : 'Creating account…'}
              </span>
            ) : (
              mode === 'signin' ? 'Sign in →' : 'Create account →'
            )}
          </button>
        </form>
      </div>
    </div>
  );
}
