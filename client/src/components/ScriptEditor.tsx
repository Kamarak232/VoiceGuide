import { useState } from 'react';
import { ScriptSegment, SyncEntry } from '../store/useStore';

interface Props {
  segments: ScriptSegment[];
  syncManifest: SyncEntry[];
  onUpdateText: (stepNumber: number, text: string) => void;
  onRegenerateAudio: (step: ScriptSegment) => Promise<void>;
}

function formatTime(seconds: number) {
  const m = Math.floor(seconds / 60);
  const s = Math.round(seconds % 60);
  return `${m}:${String(s).padStart(2, '0')}`;
}

export default function ScriptEditor({ segments, syncManifest, onUpdateText, onRegenerateAudio }: Props) {
  const [regenerating, setRegenerating] = useState<number | null>(null);
  const [regenError, setRegenError] = useState<number | null>(null);
  const [editingStep, setEditingStep] = useState<number | null>(null);

  async function handleRegenerate(seg: ScriptSegment) {
    setRegenerating(seg.stepNumber);
    setRegenError(null);
    try {
      await onRegenerateAudio(seg);
    } catch {
      setRegenError(seg.stepNumber);
    } finally {
      setRegenerating(null);
    }
  }

  return (
    <div className="flex flex-col gap-3">
      {segments.map((seg) => {
        const syncEntry = syncManifest.find((e) => e.step === seg.stepNumber);
        return (
          <div
            key={seg.stepNumber}
            className="card p-4 flex flex-col gap-3 transition-all duration-200"
            style={syncEntry ? { borderColor: 'rgba(0,212,255,0.15)' } : {}}
          >
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold uppercase tracking-widest" style={{ color: '#00d4ff88' }}>
                Step {seg.stepNumber}
              </span>
              {seg.videoStartTime >= 0 && (
                <span className="text-xs font-mono px-2 py-0.5 rounded" style={{ background: 'rgba(255,255,255,0.04)', color: '#7777aa' }}>
                  ▶ {formatTime(seg.videoStartTime)}
                </span>
              )}
            </div>

            {editingStep === seg.stepNumber ? (
              <textarea
                rows={3}
                value={seg.text}
                onChange={(e) => onUpdateText(seg.stepNumber, e.target.value)}
                className="input-dark resize-none"
                autoFocus
                onBlur={() => setEditingStep(null)}
              />
            ) : (
              <p
                className="text-sm leading-relaxed cursor-text text-white/80 hover:text-white transition-colors"
                onClick={() => setEditingStep(seg.stepNumber)}
              >
                {seg.text}
              </p>
            )}

            {syncEntry && (
              <div className="flex items-center gap-3">
                <audio controls src={syncEntry.audioFile} className="h-8 flex-1" style={{ filter: 'invert(1) hue-rotate(180deg)' }} />
                <span className="text-xs text-dim">{syncEntry.audioDuration.toFixed(1)}s</span>
              </div>
            )}

            <div className="flex items-center gap-3">
              <button
                onClick={() => handleRegenerate(seg)}
                disabled={regenerating === seg.stepNumber}
                className="text-xs underline transition-colors disabled:opacity-40"
                style={{ color: regenerating === seg.stepNumber ? '#7777aa' : '#00d4ff88' }}
                onMouseEnter={e => { if (regenerating !== seg.stepNumber) e.currentTarget.style.color = '#00d4ff'; }}
                onMouseLeave={e => { if (regenerating !== seg.stepNumber) e.currentTarget.style.color = '#00d4ff88'; }}
              >
                {regenerating === seg.stepNumber
                  ? <span className="flex items-center gap-1.5">
                      <span className="w-3 h-3 border border-t-transparent rounded-full animate-spin inline-block" style={{ borderColor: '#00d4ff88', borderTopColor: 'transparent' }} />
                      Regenerating…
                    </span>
                  : 'Regenerate audio'}
              </button>
              {regenError === seg.stepNumber && (
                <span className="text-xs" style={{ color: 'rgba(255,100,100,0.8)' }}>Failed — try again</span>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
