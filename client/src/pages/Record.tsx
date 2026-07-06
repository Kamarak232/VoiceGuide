import { useState, useRef, useEffect } from 'react';
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
  | 'trim'
  | 'uploading'
  | 'processing-frames'
  | 'processing-ai'
  | 'processing-script'
  | 'done'
  | 'error';

const PROCESSING_STAGES: { key: Status; label: string; detail: string; durationMs: number }[] = [
  { key: 'uploading',         label: 'Uploading recording',   detail: 'Sending your screen recording to the server…',        durationMs: 6000  },
  { key: 'processing-frames', label: 'Extracting keyframes',  detail: 'Pulling one screenshot every 5 seconds…',             durationMs: 10000 },
  { key: 'processing-ai',     label: 'Analysing with AI',     detail: 'Claude is watching your recording and taking notes…', durationMs: 25000 },
  { key: 'processing-script', label: 'Writing your script',   detail: 'Turning the analysis into step-by-step narration…',   durationMs: 12000 },
];

const fmtSec = (s: number) =>
  s < 60 ? `${s.toFixed(1)}s` : `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`;

function TrimTimeline({
  duration,
  start,
  end,
  onStartChange,
  onEndChange,
}: {
  duration: number;
  start: number;
  end: number;
  onStartChange: (v: number) => void;
  onEndChange: (v: number) => void;
}) {
  const trackRef = useRef<HTMLDivElement>(null);
  const startPct = duration > 0 ? (start / duration) * 100 : 0;
  const endPct = duration > 0 ? (end / duration) * 100 : 100;

  function getSecs(clientX: number) {
    const rect = trackRef.current!.getBoundingClientRect();
    return Math.max(0, Math.min(duration, ((clientX - rect.left) / rect.width) * duration));
  }

  function handlePointerDown(which: 'start' | 'end') {
    return (e: React.PointerEvent<HTMLDivElement>) => {
      e.preventDefault();
      e.currentTarget.setPointerCapture(e.pointerId);
    };
  }

  function handlePointerMove(which: 'start' | 'end') {
    return (e: React.PointerEvent<HTMLDivElement>) => {
      if (!e.currentTarget.hasPointerCapture(e.pointerId)) return;
      const secs = getSecs(e.clientX);
      if (which === 'start') onStartChange(Math.max(0, Math.min(secs, end - 1)));
      else onEndChange(Math.min(duration, Math.max(secs, start + 1)));
    };
  }

  return (
    <div className="flex flex-col gap-3 select-none">
      <div ref={trackRef} className="relative h-8 rounded-lg"
        style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.06)' }}>

        {/* Active region */}
        <div className="absolute top-0 h-full"
          style={{
            left: `${startPct}%`,
            width: `${endPct - startPct}%`,
            background: 'linear-gradient(90deg, rgba(0,212,255,0.25), rgba(180,77,255,0.2))',
          }} />

        {/* Start handle */}
        <div
          onPointerDown={handlePointerDown('start')}
          onPointerMove={handlePointerMove('start')}
          className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 w-5 h-5 rounded-full z-10"
          style={{
            left: `${startPct}%`,
            background: 'white',
            boxShadow: '0 0 0 3px rgba(0,212,255,0.6), 0 2px 8px rgba(0,0,0,0.5)',
            cursor: 'grab',
            touchAction: 'none',
          }}
        />

        {/* End handle */}
        <div
          onPointerDown={handlePointerDown('end')}
          onPointerMove={handlePointerMove('end')}
          className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 w-5 h-5 rounded-full z-10"
          style={{
            left: `${endPct}%`,
            background: 'white',
            boxShadow: '0 0 0 3px rgba(180,77,255,0.6), 0 2px 8px rgba(0,0,0,0.5)',
            cursor: 'grab',
            touchAction: 'none',
          }}
        />
      </div>

      {/* Time labels under handles */}
      <div className="relative h-5 text-xs font-mono">
        <span className="absolute -translate-x-1/2" style={{ left: `${startPct}%`, color: '#00d4ff' }}>
          {fmtSec(start)}
        </span>
        <span className="absolute -translate-x-1/2" style={{ left: `${endPct}%`, color: '#b44dff' }}>
          {fmtSec(end)}
        </span>
      </div>

      <p className="text-xs text-dim">
        Keeping{' '}
        <span className="text-white font-medium">{fmtSec(start)}</span>
        {' → '}
        <span className="text-white font-medium">{fmtSec(end)}</span>
        {' · '}
        <span className="text-white font-medium">{fmtSec(end - start)}</span> total
      </p>
    </div>
  );
}

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
  const [trimStart, setTrimStart] = useState(0);
  const [trimEnd, setTrimEnd] = useState(0);
  const [trimDuration, setTrimDuration] = useState(0);

  const screenRecorderRef = useRef<MediaRecorder | null>(null);
  const narrationRecorderRef = useRef<MediaRecorder | null>(null);
  const screenChunks = useRef<Blob[]>([]);
  const narrationChunks = useRef<Blob[]>([]);
  const clickLog = useRef<ClickEvent[]>([]);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const screenBlobRef = useRef<Blob | null>(null);
  const narrationBlobRef = useRef<Blob | null>(null);
  const blobUrlRef = useRef('');
  const previewVideoRef = useRef<HTMLVideoElement>(null);
  const secondsRef = useRef(0);

  useEffect(() => {
    secondsRef.current = seconds;
  }, [seconds]);

  // Clean up blob URL when leaving trim screen
  useEffect(() => {
    if (status !== 'trim' && blobUrlRef.current) {
      URL.revokeObjectURL(blobUrlRef.current);
      blobUrlRef.current = '';
    }
  }, [status]);

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

    screenBlobRef.current = new Blob(screenChunks.current, { type: 'video/webm' });
    narrationBlobRef.current = new Blob(narrationChunks.current, { type: 'audio/webm' });
    blobUrlRef.current = URL.createObjectURL(screenBlobRef.current);

    setTrimStart(0);
    setTrimDuration(0);
    setStatus('trim');
  }

  async function handleProcess() {
    const screenBlob = screenBlobRef.current;
    if (!screenBlob) return;

    setStatus('uploading');
    setError('');

    const stageTimers: ReturnType<typeof setTimeout>[] = [];
    let delay = PROCESSING_STAGES[0].durationMs;
    for (let i = 1; i < PROCESSING_STAGES.length; i++) {
      const key = PROCESSING_STAGES[i].key;
      stageTimers.push(setTimeout(() => setStatus(key), delay));
      delay += PROCESSING_STAGES[i].durationMs;
    }

    const ts = trimStart > 0 ? trimStart : undefined;
    const te = trimEnd > 0 && trimEnd < trimDuration ? trimEnd : undefined;

    try {
      const result = await processRecording(
        screenBlob,
        narrationBlobRef.current,
        videoContext,
        clickLog.current,
        voiceId,
        ts,
        te
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
      {!isProcessing && status !== 'trim' && <BackButton to="/setup" />}

      {status !== 'trim' && (
        <>
          <h1 className="text-4xl font-bold text-white mb-2">
            {videoContext.title || 'Record your tutorial'}
          </h1>
          <p className="text-dim mb-10">
            Click Record, share your screen, then navigate as normal. Talking aloud helps the AI write a better script.
          </p>
        </>
      )}

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
            Stop & Trim →
          </button>
        </div>
      )}

      {status === 'trim' && (
        <div className="flex flex-col gap-6 max-w-2xl">
          <div>
            <h1 className="text-3xl font-bold text-white mb-1">Trim recording</h1>
            <p className="text-dim text-sm">Drag the handles to remove awkward moments from the start or end.</p>
          </div>

          {/* Video preview */}
          <div className="rounded-xl overflow-hidden" style={{ background: '#000', aspectRatio: '16/9' }}>
            <video
              ref={previewVideoRef}
              src={blobUrlRef.current}
              className="w-full h-full object-contain"
              onLoadedMetadata={() => {
                const vid = previewVideoRef.current!;
                const dur = isFinite(vid.duration) && vid.duration > 0
                  ? vid.duration
                  : secondsRef.current;
                setTrimDuration(dur);
                setTrimEnd(dur);
              }}
              playsInline
              controls
            />
          </div>

          {trimDuration > 0 ? (
            <>
              <TrimTimeline
                duration={trimDuration}
                start={trimStart}
                end={trimEnd}
                onStartChange={setTrimStart}
                onEndChange={setTrimEnd}
              />

              <div className="flex items-center gap-4 flex-wrap">
                <button onClick={handleProcess} className="btn-neon">
                  Process Recording →
                </button>
                <button
                  onClick={handleProcess}
                  className="text-dim text-sm hover:text-white transition-colors"
                >
                  Skip trimming
                </button>
              </div>
            </>
          ) : (
            <p className="text-dim text-sm">Loading preview…</p>
          )}
        </div>
      )}

      {isProcessing && (
        <div className="flex flex-col gap-8 max-w-md">
          <div className="flex items-center gap-4">
            <div className="w-10 h-10 rounded-full border-2 flex-shrink-0 flex items-center justify-center"
              style={{ borderColor: '#00d4ff', borderTopColor: 'transparent', animation: 'spin 0.8s linear infinite' }} />
            <div>
              <p className="text-white font-semibold">{currentStage?.label}…</p>
              <p className="text-sm text-dim">{currentStage?.detail}</p>
            </div>
          </div>

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
