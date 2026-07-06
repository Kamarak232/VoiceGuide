import { useNavigate } from 'react-router-dom';
import { useState } from 'react';

const DEMO_YOUTUBE_ID = ''; // paste your YouTube video ID here e.g. 'dQw4w9WgXcQ'

export default function Home() {
  const navigate = useNavigate();
  const [videoPlaying, setVideoPlaying] = useState(false);

  return (
    <div className="min-h-screen" style={{ background: 'radial-gradient(ellipse at 20% 20%, rgba(0,212,255,0.04) 0%, transparent 60%), radial-gradient(ellipse at 80% 80%, rgba(180,77,255,0.04) 0%, transparent 60%)' }}>

      {/* Hero */}
      <div className="max-w-4xl mx-auto px-6 pt-24 pb-16 text-center">
        <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-medium mb-8"
          style={{ background: 'rgba(0,212,255,0.08)', border: '1px solid rgba(0,212,255,0.15)', color: '#00d4ff' }}>
          <span className="w-1.5 h-1.5 rounded-full bg-current" />
          AI-powered screen recording narrator
        </div>

        <h1 className="text-5xl font-bold text-white leading-tight mb-6" style={{ letterSpacing: '-0.02em' }}>
          Turn any screen recording into a<br />
          <span style={{ background: 'linear-gradient(90deg, #00d4ff, #b44dff)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
            narrated tutorial
          </span>
          {' '}— in your own voice
        </h1>

        <p className="text-lg mb-10 max-w-2xl mx-auto leading-relaxed" style={{ color: 'rgba(255,255,255,0.55)' }}>
          Record your screen. AI watches it, writes a step-by-step script, then narrates it using your cloned voice. Download the finished MP4 in under 2 minutes.
        </p>

        <div className="flex items-center justify-center gap-4 flex-wrap">
          <button
            onClick={() => navigate('/onboarding')}
            className="btn-neon px-8 py-3 text-base font-semibold"
          >
            Start for free →
          </button>
          <span className="text-sm" style={{ color: 'rgba(255,255,255,0.3)' }}>
            No credit card needed to try
          </span>
        </div>
      </div>

      {/* Demo video */}
      <div className="max-w-4xl mx-auto px-6 pb-20">
        <div className="relative rounded-2xl overflow-hidden"
          style={{ border: '1px solid rgba(255,255,255,0.08)', background: 'rgba(255,255,255,0.02)', aspectRatio: '16/9' }}>

          {DEMO_YOUTUBE_ID && videoPlaying ? (
            <iframe
              className="absolute inset-0 w-full h-full"
              src={`https://www.youtube.com/embed/${DEMO_YOUTUBE_ID}?autoplay=1&rel=0`}
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
              allowFullScreen
            />
          ) : (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-6">
              {/* Fake screen preview */}
              <div className="w-3/4 max-w-lg rounded-xl overflow-hidden"
                style={{ border: '1px solid rgba(255,255,255,0.08)', background: 'rgba(0,0,0,0.4)' }}>
                <div className="flex items-center gap-1.5 px-3 py-2" style={{ background: 'rgba(255,255,255,0.04)' }}>
                  <span className="w-2.5 h-2.5 rounded-full" style={{ background: 'rgba(255,80,80,0.6)' }} />
                  <span className="w-2.5 h-2.5 rounded-full" style={{ background: 'rgba(255,180,0,0.6)' }} />
                  <span className="w-2.5 h-2.5 rounded-full" style={{ background: 'rgba(0,200,80,0.6)' }} />
                  <div className="flex-1 mx-2 h-4 rounded" style={{ background: 'rgba(255,255,255,0.06)' }} />
                </div>
                <div className="p-4 flex flex-col gap-2">
                  {[80, 60, 90, 50].map((w, i) => (
                    <div key={i} className="h-2 rounded" style={{ width: `${w}%`, background: 'rgba(255,255,255,0.06)' }} />
                  ))}
                </div>
              </div>

              {/* Play button */}
              <button
                onClick={() => DEMO_YOUTUBE_ID ? setVideoPlaying(true) : null}
                className="flex items-center gap-3 px-6 py-3 rounded-xl font-semibold transition-all"
                style={{
                  background: DEMO_YOUTUBE_ID ? 'linear-gradient(135deg, rgba(0,212,255,0.2), rgba(180,77,255,0.15))' : 'rgba(255,255,255,0.04)',
                  border: `1px solid ${DEMO_YOUTUBE_ID ? 'rgba(0,212,255,0.3)' : 'rgba(255,255,255,0.08)'}`,
                  color: DEMO_YOUTUBE_ID ? 'white' : 'rgba(255,255,255,0.35)',
                  cursor: DEMO_YOUTUBE_ID ? 'pointer' : 'default',
                }}
              >
                <span className="text-xl">▶</span>
                <span>{DEMO_YOUTUBE_ID ? 'Watch 30-second demo' : 'Demo video coming soon'}</span>
              </button>

              {!DEMO_YOUTUBE_ID && (
                <p className="text-xs" style={{ color: 'rgba(255,255,255,0.2)' }}>
                  Record a demo of VoiceGuide → paste the YouTube ID into Home.tsx
                </p>
              )}
            </div>
          )}

          {/* Glow */}
          <div className="absolute inset-0 pointer-events-none"
            style={{ boxShadow: 'inset 0 0 60px rgba(0,212,255,0.03)' }} />
        </div>
      </div>

      {/* How it works */}
      <div className="max-w-4xl mx-auto px-6 pb-20">
        <p className="text-center text-xs font-bold uppercase tracking-widest mb-12" style={{ color: 'rgba(255,255,255,0.2)' }}>
          How it works
        </p>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
          {[
            { step: '01', icon: '🎙', title: 'Clone your voice', desc: 'Record 2–3 minutes of yourself speaking. Done once, reused forever.' },
            { step: '02', icon: '🖥', title: 'Record your screen', desc: 'Capture any app, website, or tool. No editing needed.' },
            { step: '03', icon: '🤖', title: 'AI writes the script', desc: 'Claude watches your keyframes and writes a step-by-step narration.' },
            { step: '04', icon: '⬇️', title: 'Download the MP4', desc: 'Your narrated video, synced to the right timestamps, ready to publish.' },
          ].map(({ step, icon, title, desc }) => (
            <div key={step} className="flex flex-col gap-3 p-5 rounded-xl"
              style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.06)' }}>
              <div className="flex items-center justify-between">
                <span className="text-2xl">{icon}</span>
                <span className="text-xs font-mono" style={{ color: 'rgba(0,212,255,0.4)' }}>{step}</span>
              </div>
              <p className="font-semibold text-white text-sm">{title}</p>
              <p className="text-xs leading-relaxed" style={{ color: 'rgba(255,255,255,0.4)' }}>{desc}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Social proof / stats */}
      <div className="max-w-4xl mx-auto px-6 pb-20">
        <div className="grid grid-cols-3 gap-6 p-8 rounded-2xl text-center"
          style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.06)' }}>
          {[
            { stat: '< 2 min', label: 'From recording to finished MP4' },
            { stat: '100%', label: 'Your voice — cloned once' },
            { stat: '0 editing', label: 'AI handles the script' },
          ].map(({ stat, label }) => (
            <div key={stat} className="flex flex-col gap-2">
              <p className="text-3xl font-bold" style={{ background: 'linear-gradient(90deg, #00d4ff, #b44dff)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
                {stat}
              </p>
              <p className="text-xs" style={{ color: 'rgba(255,255,255,0.4)' }}>{label}</p>
            </div>
          ))}
        </div>
      </div>

      {/* CTA */}
      <div className="max-w-2xl mx-auto px-6 pb-32 text-center">
        <h2 className="text-3xl font-bold text-white mb-4">Ready to make your first tutorial?</h2>
        <p className="mb-8" style={{ color: 'rgba(255,255,255,0.4)' }}>Clone your voice once, then record as many tutorials as you want.</p>
        <button
          onClick={() => navigate('/onboarding')}
          className="btn-neon px-10 py-3 text-base font-semibold"
        >
          Get started free →
        </button>
      </div>
    </div>
  );
}
