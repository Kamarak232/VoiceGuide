import { useNavigate } from 'react-router-dom';
import { useStore } from '../store/useStore';
import VideoContextForm from '../components/VideoContextForm';
import BackButton from '../components/BackButton';

export default function Setup() {
  const navigate = useNavigate();
  const voiceId = useStore((s) => s.voiceId);
  const videoContext = useStore((s) => s.videoContext);
  const setVideoContext = useStore((s) => s.setVideoContext);
  const clearSession = useStore((s) => s.clearSession);
  const segments = useStore((s) => s.segments);

  function handleClearEverything() {
    if (!confirm('Clear all session data including script, narration and video? Your voice setup will be kept.')) return;
    clearSession();
  }

  return (
    <div className="max-w-2xl mx-auto px-6 py-16">
      <BackButton to="/onboarding" />

      <div className="flex items-start justify-between mb-2">
        <h1 className="text-4xl font-bold text-white">Before you record</h1>
        {segments.length > 0 && (
          <button onClick={handleClearEverything} className="btn-danger mt-1">
            Clear everything
          </button>
        )}
      </div>
      <p className="text-dim mb-10">
        Tell the AI what your tutorial is about. This shapes the narration script it generates.
      </p>

      {!voiceId && (
        <div className="mb-8 p-4 rounded-xl text-sm" style={{ background: 'rgba(255,160,0,0.06)', border: '1px solid rgba(255,160,0,0.15)', color: 'rgba(255,200,80,0.85)' }}>
          You haven't set up a voice yet.{' '}
          <button className="underline font-medium" onClick={() => navigate('/onboarding')}>
            Go to voice setup →
          </button>
        </div>
      )}

      <VideoContextForm
        value={videoContext}
        onChange={setVideoContext}
        onSubmit={() => navigate('/record')}
      />

      {(segments.length > 0 || videoContext.title) && (
        <div className="mt-12 pt-8" style={{ borderTop: '1px solid rgba(255,255,255,0.05)' }}>
          <p className="hint-dark mb-3">Start completely fresh</p>
          <button onClick={handleClearEverything} className="btn-danger">
            Clear everything and reset session
          </button>
        </div>
      )}
    </div>
  );
}
