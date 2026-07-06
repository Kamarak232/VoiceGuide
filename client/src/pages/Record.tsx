import { useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useStore } from '../store/useStore';
import { processRecording } from '../lib/api';
import BackButton from '../components/BackButton';
import { friendlyError } from '../lib/errors';

interface ClickEvent {
  x: number;
  y: number;
  timestamp: number;
}

type Status =
  | 'idle'
  | 'recording'
  | 'uploading'
  | 'processing-frames'
  | 'processing-ai'
  | 'processing-script'
  | 'done'
  | 'error';

const PROCESSING_STAGES: { key: Status; label: string; detail: string; durationMs: number }[] = [
  { key: 'uploading',         label: 'Uploading recording',      detail: 'Sending your screen recording to the server…',          durationMs: 6000  },
  { key: 'processing-frames', label: 'Extracting keyframes',     detail: 'Pulling one screenshot every 5 seconds…',               durationMs: 10000 },
  { key: 'processing-ai',     label: 'Analysing with AI',        detail: 'Claude is watching your recording and taking notes…',   durationMs: 25000 },
  { key: 'processing-script', label: 'Writing your script',      detail: 'Turning the analysis into step-by-step narration…',     durationMs: 12000 },
];

export default function Record() {
  const navigate = useNavigate();
  const voiceId = useStore((s) => s.voiceId);
  const videoContext = useStore((s) => s.videoContext);
  const setSessionId = useStore((s) => s.setSessionId);
  const setSegments = useStore((s) => s.setSegments);
  const setSyncManifest = useStore((s) => s.setSyncManifest);
  const setVideoUrl = useStore((s) => s.setVideoUrl);
  const setVideoDuration = useStore((s) => s.setVideoDuration);

  const [status, setStatus] = useState<Status>('idle');
  const [error, setError] = useState('');
  const [seconds, setSeconds] = useState(0);

  const screenRecorderRef = useRef<MediaRecorder | null>(null);
  const narrationRecorderRef = useRef<MediaRecorder | null>(null);
  const screenChunks = useRef<Blob[]>([]);
  const narrationChunks = useRef<Blob[]>([]);
  const clickLog = useRef<ClickEvent[]>([]);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  async function startRecording() {
    const [screenStream, micStream] = await Promise.all([
      navigator.mediaDevices.getDisplayMedia({ video: true, audio: true }),
      navigator.mediaDevices.getUserMedia({ audio: true }),
    ]);

    screenChunks.current = [];
    narrationChunks.current = [];
    clickLog.current = [];

    const screenRecorder = new MediaRecorder(screenStream);
    screenRecorder.ondataavailable = (e) => screenChunks.current.push(e.data);
    screenRecorder.start();
    screenRecorderRef.current = screenRecorder;

    const narrationRecorder = new MediaRecorder(micStream);
    narrationRecorder.ondataavailable = (e) => narrationChunks.current.push(e.data);
    narrationRecorder.start();
    narrationRecorderRef.current = narrationRecorder;

    const recordingStart = Date.now();
    document.addEventListener('click', (e) => {
      clickLog.current.push({ x: e.clientX, y: e.clientY, timestamp: Date.now() - recordingStart });
    });

    setStatus('recording');
    setSeconds(0);
    timerRef.current = setInterval(() => setSeconds((s) => s + 1), 1000);

    screenStream.getVideoTracks()[0].onended = stopRecording;
  }

  async function stopRecording() {
    if (timerRef.current) clearInterval(timerRef.current);

    screenRecorderRef.current?.stop();
    narrationRecorderRef.current?.stop();

    await new Promise<void>((resolve) => {
      let done = 0;
      const checkDone = () => { if (++done === 2) resolve(); };
      screenRecorderRef.current!.onstop = checkDone;
      narrationRecorderRef.current!.onstop = checkDone;
    });

    const screenBlob = new Blob(screenChunks.current, { type: 'video/webm' });
    const narrationBlob = new Blob(narrationChunks.current, { type: 'audio/webm' });

    setStatus('uploading');
    setError('');

    const stageTimers: ReturnType<typeof setTimeout>[] = [];
    let elapsed = 0;
    for (const stage of PROCESSING_STAGES.slice(1)) {
      elapsed += PROCESSING_STAGES[PROCESSING_STAGES.findIndex(s => s.key === (elapsed === 0 ? 'uploading' : stage.key)) - 1]?.durationMs ?? 6000;
      stageTimers.push(setTimeout(() => setStatus(stage.key), elapsed));
    }
    // simpler: just schedule each stage in sequence
    stageTimers.length = 0;
    let delay = PROCESSING_STAGES[0].durationMs;
    for (let i = 1; i < PROCESSING_STAGES.length; i++) {
      const key = PROCESSING_STAGES[i].key;
      stageTimers.push(setTimeout(() => setStatus(key), delay));
      delay += PROCESSING_STAGES[i].durationMs;
    }

    try {
      const result = await processRecording(
        screenBlob,
        narrationBlob,
        videoContext,
        clickLog.current,
        voiceId
      );
      stageTimers.forEach(clearTimeout);

      setSessionId(result.sessionId);
      setSegments(result.segments);
      setSyncManifest(result.syncManifest);
      setVideoUrl(result.videoUrl);
      setVideoDuration(result.videoDuration);
      setStatus('done');
      navigate('/review');
    } catch (e) {
      stageTimers.forEach(clearTimeout);
      setError(friendlyError(e));
      setStatus('error');
    }
  }

  const formatTime = (s: number) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
  const isProcessing = ['uploading', 'processing-frames', 'processing-ai', 'processing-script'].includes(status);
  const currentStageIndex = PROCESSING_STAGES.findIndex(s => s.key === status);
  const progressPct = isProcessing ? Math.round(((currentStageIndex + 0.5) / PROCESSING_STAGES.length) * 100) : 0;
  const currentStage = PROCESSING_STAGES[currentStageIndex];

  return (
    <div className="max-w-2xl mx-auto px-6 py-16">
      {!isProcessing && <BackButton to="/setup" />}

      <h1 className="text-4xl font-bold text-white mb-2">
        {videoContext.title || 'Record your tutorial'}
      </h1>
      <p className="text-dim mb-10">
        Click Record, share your screen, then navigate as normal. Talking aloud helps the AI write a better script.
      </p>

      {status === 'idle' && (
        <button onClick={startRecording} className="btn-neon">
          Start Recording
        </button>
      )}

      {status === 'recording' && (
        <div className="flex flex-col items-start gap-6">
          <div className="flex items-center gap-3">
            <span className="w-3 h-3 rounded-full bg-red-500 animate-pulse" style={{ boxShadow: '0 0 8px rgba(239,68,68,0.8)' }} />
            <span className="font-mono text-3xl font-bold text-white">{formatTime(seconds)}</span>
            <span className="text-sm text-dim">(max 10 min)</span>
          </div>
          <p className="text-sm text-dim">
            Recording stops when you close the screen share, or:
          </p>
          <button
            onClick={stopRecording}
            className="btn-neon"
            style={{ borderColor: 'rgba(239,68,68,0.5)', background: 'linear-gradient(135deg, rgba(239,68,68,0.15), rgba(180,0,0,0.1))', boxShadow: '0 0 20px rgba(239,68,68,0.2)' }}
          >
            Stop & Process
          </button>
        </div>
      )}

      {isProcessing && (
        <div className="flex flex-col gap-8 max-w-md">
          {/* Current stage hero */}
          <div className="flex items-center gap-4">
            <div className="w-10 h-10 rounded-full border-2 flex-shrink-0 flex items-center justify-center"
              style={{ borderColor: '#00d4ff', borderTopColor: 'transparent', animation: 'spin 0.8s linear infinite' }} />
            <div>
              <p className="text-white font-semibold">{currentStage?.label}…</p>
              <p className="text-sm text-dim">{currentStage?.detail}</p>
            </div>
          </div>

          {/* Progress bar */}
          <div className="flex flex-col gap-2">
            <div className="w-full rounded-full h-1.5" style={{ background: 'rgba(255,255,255,0.06)' }}>
              <div
                className="h-1.5 rounded-full transition-all duration-[1500ms]"
                style={{
                  width: `${progressPct}%`,
                  background: 'linear-gradient(90deg, #00d4ff, #b44dff)',
                  boxShadow: '0 0 10px rgba(0,212,255,0.5)',
                }}
              />
            </div>
            <p className="text-xs text-dim text-right">{progressPct}%</p>
          </div>

          {/* Stage checklist */}
          <div className="flex flex-col gap-2">
            {PROCESSING_STAGES.map((stage, i) => {
              const done = i < currentStageIndex;
              const active = i === currentStageIndex;
              return (
                <div key={stage.key} className="flex items-center gap-3">
                  <div className="w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0 text-xs"
                    style={{
                      background: done ? 'rgba(0,212,255,0.15)' : active ? 'rgba(0,212,255,0.08)' : 'rgba(255,255,255,0.03)',
                      border: `1px solid ${done ? 'rgba(0,212,255,0.4)' : active ? 'rgba(0,212,255,0.25)' : 'rgba(255,255,255,0.08)'}`,
                    }}>
                    {done ? <span style={{ color: '#00d4ff' }}>✓</span> : <span style={{ color: active ? '#00d4ff' : 'rgba(255,255,255,0.2)' }}>{i + 1}</span>}
                  </div>
                  <span className="text-sm" style={{ color: done ? 'rgba(0,212,255,0.7)' : active ? 'white' : 'rgba(255,255,255,0.25)' }}>
                    {stage.label}
                  </span>
                </div>
              );
            })}
          </div>

          <p className="text-xs text-dim">A 3–5 minute recording typically takes under 60 seconds.</p>
        </div>
      )}

      {status === 'error' && (
        <div className="flex flex-col gap-4">
          <div className="p-4 rounded-xl text-sm" style={{ background: 'rgba(255,60,60,0.06)', border: '1px solid rgba(255,60,60,0.15)', color: 'rgba(255,120,120,0.9)' }}>
            {error}
          </div>
          <button onClick={() => setStatus('idle')} className="btn-ghost self-start text-sm px-4 py-2">
            Try again
          </button>
        </div>
      )}
    </div>
  );
}
