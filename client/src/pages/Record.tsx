import { useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useStore } from '../store/useStore';
import { processRecording } from '../lib/api';
import BackButton from '../components/BackButton';

interface ClickEvent {
  x: number;
  y: number;
  timestamp: number;
}

type Status =
  | 'idle'
  | 'recording'
  | 'processing-frames'
  | 'processing-script'
  | 'done'
  | 'error';

const STATUS_LABELS: Record<Status, string> = {
  idle: '',
  recording: 'Recording…',
  'processing-frames': 'Extracting keyframes…',
  'processing-script': 'Generating script with AI…',
  done: 'Done!',
  error: 'Something went wrong.',
};

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

    setStatus('processing-frames');
    setError('');

    const stageTimer = setTimeout(() => setStatus('processing-script'), 5000);

    try {
      const result = await processRecording(
        screenBlob,
        narrationBlob,
        videoContext,
        clickLog.current,
        voiceId
      );
      clearTimeout(stageTimer);

      setSessionId(result.sessionId);
      setSegments(result.segments);
      setSyncManifest(result.syncManifest);
      setVideoUrl(result.videoUrl);
      setVideoDuration(result.videoDuration);
      setStatus('done');
      navigate('/review');
    } catch (e) {
      clearTimeout(stageTimer);
      setError(e instanceof Error ? e.message : 'Processing failed.');
      setStatus('error');
    }
  }

  const formatTime = (s: number) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
  const isProcessing = status === 'processing-frames' || status === 'processing-script';

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
        <div className="flex flex-col gap-6">
          <div className="flex flex-col gap-3">
            {(['processing-frames', 'processing-script'] as const).map((s) => {
              const isActive = status === s;
              const isDone = status === 'processing-script' && s === 'processing-frames';
              return (
                <div key={s} className="flex items-center gap-3">
                  <div
                    className="w-4 h-4 rounded-full border-2 flex-shrink-0"
                    style={{
                      borderColor: isDone ? '#00d4ff' : isActive ? '#00d4ff' : 'rgba(255,255,255,0.1)',
                      borderTopColor: isActive ? 'transparent' : undefined,
                      animation: isActive ? 'spin 0.8s linear infinite' : undefined,
                      background: isDone ? '#00d4ff22' : undefined,
                    }}
                  />
                  <span className="text-sm" style={{ color: isActive ? 'white' : isDone ? '#00d4ff88' : 'rgba(255,255,255,0.25)' }}>
                    {STATUS_LABELS[s]}
                  </span>
                </div>
              );
            })}
          </div>
          <div className="w-full rounded-full h-1" style={{ background: 'rgba(255,255,255,0.06)' }}>
            <div
              className="h-1 rounded-full transition-all duration-1000"
              style={{
                width: status === 'processing-frames' ? '40%' : '80%',
                background: 'linear-gradient(90deg, #00d4ff, #b44dff)',
                boxShadow: '0 0 8px rgba(0,212,255,0.6)',
              }}
            />
          </div>
          <p className="text-xs text-dim">
            A 3–5 minute recording typically takes under 60 seconds to process.
          </p>
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
