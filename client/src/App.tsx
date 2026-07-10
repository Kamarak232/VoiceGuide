import { BrowserRouter, Routes, Route, NavLink, Link, Navigate } from 'react-router-dom';
import { useEffect, useState, useRef, createContext, useContext } from 'react';
import type { User } from '@supabase/supabase-js';
import Home from './pages/Home';
import Onboarding from './pages/Onboarding';
import Setup from './pages/Setup';
import Record from './pages/Record';
import Review from './pages/Review';
import Export from './pages/Export';
import Auth from './pages/Auth';
import Pricing from './pages/Pricing';
import Settings from './pages/Settings';
import Library from './pages/Library';
import { useStore } from './store/useStore';
import { supabase } from './lib/supabase';

const BASE = import.meta.env.VITE_API_URL ?? '';
function useServerWake() {
  useEffect(() => {
    fetch(`${BASE}/health`, { method: 'GET' }).catch(() => {});
  }, []);
}

export const AuthContext = createContext<User | null>(null);
export function useAuth() { return useContext(AuthContext); }

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const user = useAuth();
  if (user === undefined) return null; // still loading
  if (!user) return <Navigate to="/auth" replace />;
  return <>{children}</>;
}


function Nav() {
  useServerWake();
  const voiceId = useStore((s) => s.voiceId);
  const user = useAuth();
  return (
    <nav
      style={{
        background: 'rgba(6,6,14,0.95)',
        borderBottom: '1px solid rgba(0,212,255,0.08)',
        backdropFilter: 'blur(12px)',
      }}
      className="sticky top-0 z-50 px-6 py-3 flex items-center gap-8"
    >
      <Link
        to="/"
        className="font-bold text-lg tracking-tight"
        style={{ background: 'linear-gradient(90deg, #00d4ff, #b44dff)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', textDecoration: 'none' }}
      >
        VoiceGuide
      </Link>
      {user && (
        <div className="flex gap-1 text-sm">
          {[
            { to: '/library', label: 'Library' },
            { to: '/onboarding', label: 'Voice Setup' },
            { to: '/setup', label: 'Context' },
            { to: '/record', label: 'Record' },
            { to: '/review', label: 'Review' },
            { to: '/export', label: 'Export' },
            { to: '/pricing', label: 'Pricing' },
          ].map(({ to, label }) => (
            <NavLink
              key={to}
              to={to}
              className={({ isActive }) =>
                isActive
                  ? 'px-3 py-1.5 rounded-lg text-neon font-medium text-sm'
                  : 'px-3 py-1.5 rounded-lg text-dim hover:text-white text-sm transition-colors'
              }
              style={({ isActive }) => isActive ? {
                background: 'rgba(0,212,255,0.08)',
                boxShadow: 'inset 0 0 12px rgba(0,212,255,0.06)',
              } : {}}
            >
              {label}
            </NavLink>
          ))}
        </div>
      )}
      <div className="ml-auto flex items-center gap-4">
        {voiceId && user && (
          <span className="text-xs font-medium flex items-center gap-1.5" style={{ color: '#00d4ff' }}>
            <span className="w-1.5 h-1.5 rounded-full bg-neon inline-block" style={{ boxShadow: '0 0 6px #00d4ff' }} />
            Voice ready
          </span>
        )}
        {user ? (
          <NavLink to="/settings" className={({ isActive }) =>
            isActive
              ? 'text-xs font-medium px-3 py-1.5 rounded-lg text-neon'
              : 'text-xs font-medium px-3 py-1.5 rounded-lg text-dim hover:text-white transition-colors'
          }>
            Account
          </NavLink>
        ) : (
          <Link to="/auth" className="text-xs font-medium px-3 py-1.5 rounded-lg transition-all"
            style={{ background: 'rgba(0,212,255,0.08)', color: '#00d4ff', border: '1px solid rgba(0,212,255,0.2)' }}>
            Sign in
          </Link>
        )}
      </div>
    </nav>
  );
}

export default function App() {
  const [user, setUser] = useState<User | null | undefined>(undefined);
  const clearSession = useStore((s) => s.clearSession);
  const prevUserIdRef = useRef<string | null | undefined>(undefined);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null);
      prevUserIdRef.current = session?.user?.id ?? null;
    });
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      const newUserId = session?.user?.id ?? null;
      setUser(session?.user ?? null);
      if (event === 'SIGNED_OUT') {
        clearSession();
        prevUserIdRef.current = null;
      }
      if (event === 'SIGNED_IN') {
        // Only clear when a known previous user is replaced by a different user.
        // prevUserIdRef is undefined until getSession resolves — skip that first fire.
        if (prevUserIdRef.current !== undefined && newUserId !== prevUserIdRef.current) {
          clearSession();
        }
        prevUserIdRef.current = newUserId;
      }
    });
    return () => subscription.unsubscribe();
  }, []);

  // Still resolving session — render nothing to avoid flash
  if (user === undefined) return null;

  return (
    <AuthContext.Provider value={user}>
      <BrowserRouter>
        <Nav />
        <main className="min-h-screen">
          <Routes>
            <Route path="/" element={<Home />} />
            <Route path="/auth" element={user ? <Navigate to="/onboarding" replace /> : <Auth />} />
            <Route path="/onboarding" element={<ProtectedRoute><Onboarding /></ProtectedRoute>} />
            <Route path="/setup" element={<ProtectedRoute><Setup /></ProtectedRoute>} />
            <Route path="/record" element={<ProtectedRoute><Record /></ProtectedRoute>} />
            <Route path="/review" element={<ProtectedRoute><Review /></ProtectedRoute>} />
            <Route path="/export" element={<ProtectedRoute><Export /></ProtectedRoute>} />
            <Route path="/pricing" element={<Pricing />} />
            <Route path="/settings" element={<ProtectedRoute><Settings /></ProtectedRoute>} />
            <Route path="/library" element={<ProtectedRoute><Library /></ProtectedRoute>} />
          </Routes>
        </main>
      </BrowserRouter>
    </AuthContext.Provider>
  );
}
