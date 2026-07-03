import { useNavigate } from 'react-router-dom';
import { useStore } from '../store/useStore';
import BackButton from '../components/BackButton';

export default function Export() {
  const navigate = useNavigate();
  const downloadUrl = useStore((s) => s.downloadUrl);

  if (!downloadUrl) {
    return (
      <div className="max-w-2xl mx-auto px-6 py-16 text-dim">
        No export ready yet.{' '}
        <button className="underline text-neon" onClick={() => navigate('/review')}>
          Go to review →
        </button>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto px-6 py-16">
      <BackButton to="/review" />

      <h1 className="text-4xl font-bold text-white mb-2">Your tutorial is ready!</h1>
      <p className="text-dim mb-10">
        Download your finished MP4 — narrated and synced to your screen recording.
      </p>

      <div className="flex flex-col gap-4">
        <a
          href={downloadUrl}
          download
          className="btn-neon self-start"
        >
          Download MP4
        </a>

        <div className="card p-4">
          <p className="text-xs font-mono break-all text-dim">{downloadUrl}</p>
        </div>

        <button
          onClick={() => navigate('/setup')}
          className="self-start text-sm text-dim hover:text-neon transition-colors underline mt-4"
        >
          Create another tutorial →
        </button>
      </div>
    </div>
  );
}
