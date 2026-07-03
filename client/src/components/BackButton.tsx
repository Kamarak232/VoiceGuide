import { useNavigate } from 'react-router-dom';

export default function BackButton({ to }: { to: string }) {
  const navigate = useNavigate();
  return (
    <button
      onClick={() => navigate(to)}
      className="flex items-center gap-2 text-sm font-medium mb-8 px-3 py-1.5 rounded-lg transition-all"
      style={{
        color: 'rgba(255,255,255,0.5)',
        border: '1px solid rgba(255,255,255,0.08)',
        background: 'rgba(255,255,255,0.03)',
      }}
      onMouseEnter={e => {
        e.currentTarget.style.color = '#00d4ff';
        e.currentTarget.style.borderColor = 'rgba(0,212,255,0.3)';
        e.currentTarget.style.background = 'rgba(0,212,255,0.06)';
      }}
      onMouseLeave={e => {
        e.currentTarget.style.color = 'rgba(255,255,255,0.5)';
        e.currentTarget.style.borderColor = 'rgba(255,255,255,0.08)';
        e.currentTarget.style.background = 'rgba(255,255,255,0.03)';
      }}
    >
      <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
        <path d="M10 12L6 8l4-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
      </svg>
      Back
    </button>
  );
}
