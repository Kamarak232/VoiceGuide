import { BrowserRouter, Routes, Route, Navigate, NavLink } from 'react-router-dom';
import { useEffect, useState } from 'react';
import Onboarding from './pages/Onboarding';
import Setup from './pages/Setup';
import Record from './pages/Record';
import Review from './pages/Review';
import Export from './pages/Export';
import { useStore } from './store/useStore';

function Nav() {
  const voiceId = useStore((s) => s.voiceId);
  return (
    <nav
      style={{
        background: 'rgba(6,6,14,0.95)',
        borderBottom: '1px solid rgba(0,212,255,0.08)',
        backdropFilter: 'blur(12px)',
      }}
      className="sticky top-0 z-50 px-6 py-3 flex items-center gap-8"
    >
      <span
        className="font-bold text-lg tracking-tight"
        style={{ background: 'linear-gradient(90deg, #00d4ff, #b44dff)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}
      >
        VoiceGuide
      </span>
      <div className="flex gap-1 text-sm">
        {[
          { to: '/onboarding', label: 'Voice Setup' },
          { to: '/setup', label: 'Context' },
          { to: '/record', label: 'Record' },
          { to: '/review', label: 'Review' },
          { to: '/export', label: 'Export' },
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
      {voiceId && (
        <span className="ml-auto text-xs font-medium flex items-center gap-1.5" style={{ color: '#00d4ff' }}>
          <span className="w-1.5 h-1.5 rounded-full bg-neon inline-block" style={{ boxShadow: '0 0 6px #00d4ff' }} />
          Voice ready
        </span>
      )}
    </nav>
  );
}

function OllamaBanner() {
  const [ollamaDown, setOllamaDown] = useState(false);

  useEffect(() => {
    fetch('http://localhost:3001/health')
      .then((r) => r.json())
      .then((d) => setOllamaDown(!d.ollama))
      .catch(() => setOllamaDown(true));
  }, []);

  if (!ollamaDown) return null;
  return (
    <div
      className="px-6 py-2.5 text-sm flex items-center gap-2"
      style={{
        background: 'rgba(255,160,0,0.06)',
        borderBottom: '1px solid rgba(255,160,0,0.15)',
        color: 'rgba(255,200,80,0.85)',
      }}
    >
      <span>⚠</span>
      <span>Ollama is not running — script generation will fail. Start it with <code className="font-mono bg-white/5 px-1 rounded">ollama serve</code> then refresh.</span>
    </div>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <Nav />
      <OllamaBanner />
      <main className="min-h-screen">
        <Routes>
          <Route path="/" element={<Navigate to="/onboarding" replace />} />
          <Route path="/onboarding" element={<Onboarding />} />
          <Route path="/setup" element={<Setup />} />
          <Route path="/record" element={<Record />} />
          <Route path="/review" element={<Review />} />
          <Route path="/export" element={<Export />} />
        </Routes>
      </main>
    </BrowserRouter>
  );
}
