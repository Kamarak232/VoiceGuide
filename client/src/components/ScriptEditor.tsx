import { useState, useRef } from 'react';
import { ScriptSegment, SyncEntry } from '../store/useStore';

interface Props {
  segments: ScriptSegment[];
  syncManifest: SyncEntry[];
  onUpdateText: (stepNumber: number, text: string) => void;
  onRegenerateAudio: (step: ScriptSegment) => Promise<void>;
  onRecordStep: (step: ScriptSegment, blob: Blob) => Promise<void>;
}

function formatTime(seconds: number) {
  const m = Math.floor(seconds / 60);
  const s = Math.round(seconds % 60);
  return `${m}:${String(s).padStart(2, '0')}`;
}

export default function ScriptEditor({ segments, syncManifest, onUpdateText, onRegenerateAudio, onRecordStep }: Props) {
  const [regenerating, setRegenerating] = useState<number | null>(null);
  const [regenError, setRegenError] = useState<number | null>(null);
  const [editingStep, setEditingStep] = useState<number | null>(null);
  const [recordingStep, setRecordingStep] = useState<number | null>(null);
  const [recordingSeconds, setRecordingSeconds] = useState(0);
  const [uploadingStep, setUploadingStep] = useState<number | null>(null);
  const [uploadError, setUploadError] = useState<number | null>(null);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

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

  async function startStepRecording(stepNumber: number) {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    chunksRef.current = [];
    const recorder = new MediaRecorder(stream);
    recorder.ondataavailable = (e) => chunksRef.current.push(e.data);
    recorder.start();
    mediaRecorderRef.current = recorder;
    setRecordingStep(stepNumber);
    setRecordingSeconds(0);
    timerRef.current = setInterval(() => setRecordingSeconds((s) => s + 1), 1000);
  }

  async function stopStepRecording(seg: ScriptSegment) {
    if (timerRef.current) clearInterval(timerRef.current);
    mediaRecorderRef.current?.stop();

    await new Promise<void>((resolve) => {
      mediaRecorderRef.current!.onstop = () => resolve();
    });

    mediaRecorderRef.current?.stream.getTracks().forEach((t) => t.stop());

    const blob = new Blob(chunksRef.current, { type: 'audio/webm' });
    setRecordingStep(null);
    setUploadingStep(seg.stepNumber);
    setUploadError(null);

    try {
      await onRecordStep(seg, blob);
    } catch {
      setUploadError(seg.stepNumber);
    } finally {
      setUploadingStep(null);
    }
  }

  const fmt = (s: number) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;

  return (
    <div className="flex flex-col gap-3">
      {segments.map((seg) => {
        const syncEntry = syncManifest.find((e) => e.step === seg.stepNumber);
        const isRecording = recordingStep === seg.stepNumber;
        const isUploading = uploadingStep === seg.stepNumber;

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

            {/* Recording UI */}
            {isRecording && (
              <div className="flex items-center gap-3 p-3 rounded-xl" style={{ background: 'rgba(239,68,68,0.06)', border: '1px solid rgba(239,68,68,0.2)' }}>
                <span className="w-2.5 h-2.5 rounded-full bg-red-500 animate-pulse flex-shrink-0" style={{ boxShadow: '0 0 6px rgba(239,68,68,0.8)' }} />
                <span className="font-mono text-sm text-white">{fmt(recordingSeconds)}</span>
                <span className="text-xs text-dim flex-1">Recording your voice…</span>
                <button
                  onClick={() => stopStepRecording(seg)}
                  className="text-xs font-medium px-3 py-1.5 rounded-lg"
                  style={{ background: 'rgba(239,68,68,0.15)', color: 'rgba(255,120,120,0.9)', border: '1px solid rgba(239,68,68,0.25)' }}
                >
                  Stop & save
                </button>
              </div>
            )}

            {isUploading && (
              <div className="flex items-center gap-2 text-xs text-dim">
                <span className="w-3 h-3 border border-t-transparent rounded-full animate-spin" style={{ borderColor: '#00d4ff88', borderTopColor: 'transparent' }} />
                Saving your recording…
              </div>
            )}

            <div className="flex items-center gap-4 flex-wrap">
              {!isRecording && !isUploading && (
                <>
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

                  <button
                    onClick={() => startStepRecording(seg.stepNumber)}
                    className="text-xs underline transition-colors"
                    style={{ color: 'rgba(180,77,255,0.6)' }}
                    onMouseEnter={e => { e.currentTarget.style.color = '#b44dff'; }}
                    onMouseLeave={e => { e.currentTarget.style.color = 'rgba(180,77,255,0.6)'; }}
                  >
                    🎙 Record my voice
                  </button>
                </>
              )}

              {regenError === seg.stepNumber && (
                <span className="text-xs" style={{ color: 'rgba(255,100,100,0.8)' }}>Failed — try again</span>
              )}
              {uploadError === seg.stepNumber && (
                <span className="text-xs" style={{ color: 'rgba(255,100,100,0.8)' }}>Upload failed — try again</span>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
