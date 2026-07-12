import { useState, useRef } from 'react';

interface Props {
  onComplete: (blob: Blob) => void;
}

type Tab = 'record' | 'upload';
type RecorderState = 'idle' | 'recording' | 'done';

export default function VoiceSampleRecorder({ onComplete }: Props) {
  const [tab, setTab] = useState<Tab>('record');

  const [recState, setRecState] = useState<RecorderState>('idle');
  const [seconds, setSeconds] = useState(0);
  const [recBlob, setRecBlob] = useState<Blob | null>(null);
  const [recAudioUrl, setRecAudioUrl] = useState<string | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const [uploadedFile, setUploadedFile] = useState<File | null>(null);
  const [uploadedUrl, setUploadedUrl] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  async function startRecording() {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    const recorder = new MediaRecorder(stream);
    chunksRef.current = [];
    recorder.ondataavailable = (e) => chunksRef.current.push(e.data);
    recorder.onstop = () => {
      const blob = new Blob(chunksRef.current, { type: 'audio/webm' });
      const url = URL.createObjectURL(blob);
      setRecBlob(blob);
      setRecAudioUrl(url);
      setRecState('done');
      stream.getTracks().forEach((t) => t.stop());
    };
    recorder.start();
    mediaRecorderRef.current = recorder;
    setRecState('recording');
    setSeconds(0);
    timerRef.current = setInterval(() => setSeconds((s) => s + 1), 1000);
  }

  function stopRecording() {
    mediaRecorderRef.current?.stop();
    if (timerRef.current) clearInterval(timerRef.current);
  }

  function resetRecording() {
    setRecState('idle');
    setRecBlob(null);
    setRecAudioUrl(null);
    setSeconds(0);
  }

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadedFile(file);
    setUploadedUrl(URL.createObjectURL(file));
    // Don't call onComplete yet — wait for user to confirm
  }

  function resetUpload() {
    setUploadedFile(null);
    setUploadedUrl(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  }

  const formatTime = (s: number) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;

  // Fish Audio needs a meaningful sample to train a clone — block very short recordings
  // and nudge anything under a minute toward a re-record.
  const MIN_SECONDS = 10;
  const RECOMMENDED_SECONDS = 60;
  const tooShort = seconds < MIN_SECONDS;
  const shorterThanRecommended = seconds < RECOMMENDED_SECONDS;

  return (
    <div className="flex flex-col gap-6">
      {/* Tabs */}
      <div className="flex rounded-xl overflow-hidden self-start" style={{ border: '1px solid rgba(255,255,255,0.08)' }}>
        {(['record', 'upload'] as Tab[]).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className="px-5 py-2 text-sm font-medium transition-all"
            style={tab === t ? {
              background: 'linear-gradient(135deg, rgba(0,212,255,0.15), rgba(180,77,255,0.1))',
              color: '#00d4ff',
              borderRight: t === 'record' ? '1px solid rgba(255,255,255,0.08)' : undefined,
            } : {
              background: 'transparent',
              color: '#7777aa',
              borderRight: t === 'record' ? '1px solid rgba(255,255,255,0.08)' : undefined,
            }}
          >
            {t === 'record' ? '🎙 Record live' : '📁 Upload file'}
          </button>
        ))}
      </div>

      {/* Record tab */}
      {tab === 'record' && (
        <div className="flex flex-col items-start gap-4">
          {recState === 'idle' && (
            <button onClick={startRecording} className="btn-neon">
              Start Recording Voice Sample
            </button>
          )}

          {recState === 'recording' && (
            <div className="flex flex-col gap-4">
              <div className="flex items-center gap-3">
                <span className="w-3 h-3 rounded-full bg-red-500 animate-pulse" style={{ boxShadow: '0 0 8px rgba(239,68,68,0.8)' }} />
                <span className="font-mono text-xl text-white">{formatTime(seconds)}</span>
              </div>
              <p className="text-dim text-sm max-w-sm">
                Read aloud naturally for 2–3 minutes. Talk about anything — this only trains your voice clone.
              </p>
              <button
                onClick={stopRecording}
                className="btn-neon"
                style={{ borderColor: 'rgba(239,68,68,0.5)', background: 'linear-gradient(135deg, rgba(239,68,68,0.15), rgba(180,0,0,0.1))', boxShadow: '0 0 20px rgba(239,68,68,0.2)' }}
              >
                Stop Recording
              </button>
            </div>
          )}

          {recState === 'done' && recAudioUrl && recBlob && (
            <div className="flex flex-col gap-4 w-full max-w-sm">
              <p className="text-white/70 text-sm">Preview your recording ({formatTime(seconds)}):</p>
              <audio controls src={recAudioUrl} className="w-full" />
              {tooShort ? (
                <p className="text-sm" style={{ color: 'rgba(255,120,120,0.9)' }}>
                  Recording is too short ({formatTime(seconds)}). Record at least {MIN_SECONDS} seconds — 1–3 minutes gives the best clone.
                </p>
              ) : shorterThanRecommended ? (
                <p className="text-sm" style={{ color: 'rgba(255,200,80,0.9)' }}>
                  Short samples produce lower-quality clones. Aim for at least 1 minute — 2–3 minutes is ideal.
                </p>
              ) : null}
              <div className="flex gap-3">
                <button
                  onClick={() => onComplete(recBlob)}
                  disabled={tooShort}
                  className="btn-neon"
                  style={tooShort ? { opacity: 0.4, cursor: 'not-allowed' } : undefined}
                >
                  Clone my voice →
                </button>
                <button onClick={resetRecording} className="btn-ghost px-4 py-2 text-sm">
                  Re-record
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Upload tab */}
      {tab === 'upload' && (
        <div className="flex flex-col gap-4">
          {!uploadedFile ? (
            <label
              className="flex flex-col items-center gap-3 rounded-xl p-10 cursor-pointer transition-all"
              style={{ border: '2px dashed rgba(0,212,255,0.15)' }}
              onMouseEnter={e => (e.currentTarget.style.borderColor = 'rgba(0,212,255,0.35)')}
              onMouseLeave={e => (e.currentTarget.style.borderColor = 'rgba(0,212,255,0.15)')}
            >
              <span className="text-4xl">📂</span>
              <span className="text-sm font-medium text-white/70">Click to choose a file</span>
              <span className="hint-dark">MP3, WAV, M4A — 2 to 3 minutes of you speaking</span>
              <input
                ref={fileInputRef}
                type="file"
                accept="audio/*,video/mp4"
                className="hidden"
                onChange={handleFileChange}
              />
            </label>
          ) : (
            <div className="flex flex-col gap-4 max-w-sm">
              <p className="text-white/70 text-sm">Preview your file:</p>
              <audio controls src={uploadedUrl!} className="w-full" />
              <p className="hint-dark text-xs">{uploadedFile.name} · {(uploadedFile.size / 1024 / 1024).toFixed(1)} MB</p>
              <div className="flex gap-3">
                <button onClick={() => onComplete(uploadedFile)} className="btn-neon">
                  Clone my voice →
                </button>
                <button onClick={resetUpload} className="btn-ghost px-4 py-2 text-sm">
                  Choose different
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
