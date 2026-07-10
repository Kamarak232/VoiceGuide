import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { getLibrary, getLibraryRecording, LibraryItem } from '../lib/api';
import { useStore } from '../store/useStore';
import { friendlyError } from '../lib/errors';

const BASE = import.meta.env.VITE_API_URL ?? '';

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
}

function formatDuration(secs: number | null) {
  if (!secs) return null;
  const m = Math.floor(secs / 60);
  const s = Math.round(secs % 60);
  return m > 0 ? `${m}m ${s}s` : `${s}s`;
}

export default function Library() {
  const navigate = useNavigate();
  const [items, setItems] = useState<LibraryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [restoring, setRestoring] = useState<string | null>(null);

  const setSessionId = useStore((s) => s.setSessionId);
  const setSegments = useStore((s) => s.setSegments);
  const setSyncManifest = useStore((s) => s.setSyncManifest);
  const setVideoUrl = useStore((s) => s.setVideoUrl);
  const setVideoDuration = useStore((s) => s.setVideoDuration);
  const setVideoContext = useStore((s) => s.setVideoContext);
  const setDownloadUrl = useStore((s) => s.setDownloadUrl);

  useEffect(() => {
    getLibrary()
      .then(setItems)
      .catch((e) => setError(friendlyError(e)))
      .finally(() => setLoading(false));
  }, []);

  async function handleOpen(item: LibraryItem) {
    setRestoring(item.session_id);
    try {
      const rec = await getLibraryRecording(item.session_id);
      setSessionId(rec.session_id);
      setSegments(rec.segments ?? []);
      setSyncManifest(rec.sync_manifest ?? []);
      setVideoUrl(rec.video_url ? `${BASE}${rec.video_url}` : '');
      setVideoDuration(rec.video_duration ?? 0);
      if (rec.video_context) setVideoContext(rec.video_context as import('../store/useStore').VideoContext);
      if (rec.download_url) setDownloadUrl(`${BASE}${rec.download_url}`);
      navigate(rec.download_url ? '/export' : '/review');
    } catch (e) {
      setError(friendlyError(e));
      setRestoring(null);
    }
  }

  if (loading) {
    return (
      <div className="max-w-4xl mx-auto px-6 py-16 flex items-center gap-3 text-dim">
        <div className="w-4 h-4 border-2 border-t-transparent rounded-full animate-spin" style={{ borderColor: '#00d4ff', borderTopColor: 'transparent' }} />
        Loading recordings…
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto px-6 py-12">
      <h1 className="text-2xl font-bold text-white mb-2">My Recordings</h1>
      <p className="text-sm text-dim mb-8">Click a recording to continue editing or download.</p>

      {error && (
        <p className="text-sm mb-6" style={{ color: 'rgba(255,120,120,0.9)' }}>{error}</p>
      )}

      {items.length === 0 ? (
        <div className="rounded-2xl p-10 text-center" style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.07)' }}>
          <p className="text-dim text-sm mb-4">No recordings yet.</p>
          <button onClick={() => navigate('/record')} className="btn-neon text-sm">
            Start Recording →
          </button>
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          {items.map((item) => (
            <button
              key={item.session_id}
              onClick={() => handleOpen(item)}
              disabled={restoring === item.session_id}
              className="w-full text-left rounded-2xl p-5 transition-all"
              style={{
                background: 'rgba(255,255,255,0.02)',
                border: '1px solid rgba(255,255,255,0.07)',
              }}
              onMouseEnter={(e) => (e.currentTarget.style.borderColor = 'rgba(0,212,255,0.2)')}
              onMouseLeave={(e) => (e.currentTarget.style.borderColor = 'rgba(255,255,255,0.07)')}
            >
              <div className="flex items-center justify-between gap-4">
                <div className="flex-1 min-w-0">
                  <p className="text-white font-semibold text-sm truncate">{item.title || 'Untitled'}</p>
                  <div className="flex items-center gap-3 mt-1 flex-wrap">
                    <span className="text-xs text-dim">{formatDate(item.created_at)}</span>
                    {formatDuration(item.video_duration) && (
                      <span className="text-xs text-dim">{formatDuration(item.video_duration)}</span>
                    )}
                    {item.download_url ? (
                      <span className="text-xs font-medium px-2 py-0.5 rounded-full" style={{ background: 'rgba(0,212,255,0.1)', color: '#00d4ff' }}>
                        Rendered
                      </span>
                    ) : (
                      <span className="text-xs font-medium px-2 py-0.5 rounded-full" style={{ background: 'rgba(255,255,255,0.06)', color: 'rgba(255,255,255,0.4)' }}>
                        Draft
                      </span>
                    )}
                  </div>
                </div>
                <div className="flex-shrink-0 text-xs font-medium" style={{ color: '#00d4ff' }}>
                  {restoring === item.session_id ? (
                    <span className="flex items-center gap-1.5">
                      <span className="w-3 h-3 border border-t-transparent rounded-full animate-spin" style={{ borderColor: '#00d4ff', borderTopColor: 'transparent' }} />
                      Opening…
                    </span>
                  ) : item.download_url ? 'Download →' : 'Continue →'}
                </div>
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
