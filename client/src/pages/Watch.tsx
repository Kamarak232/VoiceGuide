import { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { getWatchData, WatchData } from '../lib/api';

const BASE = import.meta.env.VITE_API_URL ?? '';

export default function Watch() {
  const { sessionId } = useParams<{ sessionId: string }>();
  const [data, setData] = useState<WatchData | null>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!sessionId) return;
    getWatchData(sessionId)
      .then(setData)
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, [sessionId]);

  function handleCopy() {
    navigator.clipboard.writeText(window.location.href).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="flex items-center gap-3 text-dim">
          <div className="w-4 h-4 border-2 border-t-transparent rounded-full animate-spin" style={{ borderColor: '#00d4ff', borderTopColor: 'transparent' }} />
          Loading tutorial…
        </div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-4 px-6 text-center">
        <p className="text-white font-semibold">Tutorial not found</p>
        <p className="text-dim text-sm">{error || 'This link may be invalid or the video hasn\'t been rendered yet.'}</p>
        <Link to="/" className="text-sm" style={{ color: '#00d4ff' }}>Go to VoiceGuide →</Link>
      </div>
    );
  }

  const videoUrl = `${BASE}${data.downloadUrl}`;

  return (
    <div className="max-w-4xl mx-auto px-6 py-10">
      {/* Header */}
      <div className="flex items-start justify-between gap-4 mb-6 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold text-white mb-1">{data.title || 'Tutorial'}</h1>
          {data.videoContext?.description && (
            <p className="text-sm text-dim">{data.videoContext.description}</p>
          )}
        </div>
        <div className="flex items-center gap-3 flex-shrink-0">
          <button
            onClick={handleCopy}
            className="flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-medium transition-all"
            style={{
              background: copied ? 'rgba(0,212,255,0.12)' : 'rgba(255,255,255,0.04)',
              border: `1px solid ${copied ? 'rgba(0,212,255,0.3)' : 'rgba(255,255,255,0.1)'}`,
              color: copied ? '#00d4ff' : 'rgba(255,255,255,0.7)',
            }}
          >
            {copied ? (
              <>
                <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
                  <path d="M3 8l4 4 6-7" stroke="#00d4ff" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
                Copied!
              </>
            ) : (
              <>
                <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
                  <path d="M10 2H3a1 1 0 0 0-1 1v9M6 4h7a1 1 0 0 1 1 1v8a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1V5a1 1 0 0 1 1-1z" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
                </svg>
                Copy link
              </>
            )}
          </button>
          <Link
            to="/"
            className="text-xs font-medium px-3 py-2 rounded-xl transition-all"
            style={{ background: 'rgba(0,212,255,0.08)', border: '1px solid rgba(0,212,255,0.2)', color: '#00d4ff' }}
          >
            Make your own →
          </Link>
        </div>
      </div>

      {/* Video */}
      <div className="rounded-2xl overflow-hidden mb-8" style={{ background: '#000', border: '1px solid rgba(255,255,255,0.08)' }}>
        <video src={videoUrl} controls style={{ width: '100%', display: 'block', maxHeight: '65vh' }} />
      </div>

      {/* Steps */}
      {data.segments.length > 0 && (
        <div className="rounded-2xl p-6" style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.07)' }}>
          <p className="text-xs font-semibold uppercase tracking-widest mb-4" style={{ color: 'rgba(255,255,255,0.3)' }}>Steps</p>
          <div className="flex flex-col gap-3">
            {data.segments.map((s) => (
              <div key={s.stepNumber} className="flex gap-3 items-start">
                <span
                  className="flex-shrink-0 w-5 h-5 rounded flex items-center justify-center text-xs font-bold mt-0.5"
                  style={{ background: 'rgba(0,212,255,0.08)', color: '#00d4ff', border: '1px solid rgba(0,212,255,0.15)' }}
                >
                  {s.stepNumber}
                </span>
                <p className="text-sm text-dim leading-relaxed">{s.text}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Footer */}
      <p className="text-center text-xs mt-8" style={{ color: 'rgba(255,255,255,0.2)' }}>
        Made with{' '}
        <Link to="/" style={{ color: 'rgba(0,212,255,0.6)' }}>VoiceGuide</Link>
      </p>
    </div>
  );
}
