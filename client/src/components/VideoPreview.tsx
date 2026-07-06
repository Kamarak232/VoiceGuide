import { useRef, useState, useEffect } from 'react';
import { SyncEntry } from '../store/useStore';

interface Props {
  videoUrl: string;
  syncManifest: SyncEntry[];
}

const SPEEDS = [0.5, 0.75, 1, 1.25, 1.5, 2];

export default function VideoPreview({ videoUrl, syncManifest }: Props) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const audioRefs = useRef<HTMLAudioElement[]>([]);
  const timeoutIds = useRef<ReturnType<typeof setTimeout>[]>([]);
  const speedRef = useRef(1);
  const [playing, setPlaying] = useState(false);
  const [speed, setSpeed] = useState(1);

  useEffect(() => {
    audioRefs.current = syncManifest.map((entry) => new Audio(entry.audioFile));
    return () => {
      clearAudio();
    };
  }, [syncManifest]);

  function clearAudio() {
    timeoutIds.current.forEach(clearTimeout);
    timeoutIds.current = [];
    audioRefs.current.forEach((a) => a.pause());
  }

  function scheduleAudio(fromVideoTime: number, atSpeed: number) {
    clearAudio();
    syncManifest.forEach((entry, i) => {
      const audio = audioRefs.current[i];
      if (!audio) return;
      const videoTimeToEntry = entry.videoStartTime - fromVideoTime;

      if (videoTimeToEntry < 0 && -videoTimeToEntry < entry.audioDuration) {
        // Mid-audio: seek into the clip and resume
        audio.currentTime = -videoTimeToEntry;
        audio.playbackRate = atSpeed;
        audio.play().catch(() => {});
      } else if (videoTimeToEntry >= 0) {
        // Future: fire after speed-adjusted wall-clock delay
        const wallMs = (videoTimeToEntry / atSpeed) * 1000;
        const id = setTimeout(() => {
          audio.currentTime = 0;
          audio.playbackRate = atSpeed;
          audio.play().catch(() => {});
        }, wallMs);
        timeoutIds.current.push(id);
      }
    });
  }

  function handlePlay() {
    const video = videoRef.current;
    if (!video) return;
    video.playbackRate = speedRef.current;
    video.play();
    setPlaying(true);
    scheduleAudio(video.currentTime, speedRef.current);
  }

  function handlePause() {
    videoRef.current?.pause();
    clearAudio();
    setPlaying(false);
  }

  function handleSpeedChange(newSpeed: number) {
    speedRef.current = newSpeed;
    setSpeed(newSpeed);
    const video = videoRef.current;
    if (!video) return;
    video.playbackRate = newSpeed;
    if (!video.paused) {
      scheduleAudio(video.currentTime, newSpeed);
    }
  }

  return (
    <div className="flex flex-col gap-3">
      <video
        ref={videoRef}
        src={videoUrl}
        className="w-full rounded-xl bg-black"
        style={{ border: '1px solid rgba(255,255,255,0.06)' }}
        onEnded={() => { clearAudio(); setPlaying(false); }}
      />

      <div className="flex items-center gap-3 flex-wrap">
        {/* Play / Pause */}
        {playing ? (
          <button
            onClick={handlePause}
            className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all"
            style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)', color: 'rgba(255,255,255,0.8)' }}
          >
            ⏸ Pause
          </button>
        ) : (
          <button
            onClick={handlePlay}
            className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all"
            style={{ background: 'rgba(0,212,255,0.1)', border: '1px solid rgba(0,212,255,0.3)', color: '#00d4ff' }}
          >
            ▶ Play Preview
          </button>
        )}

        {/* Speed picker */}
        <div className="flex items-center gap-1 ml-auto">
          {SPEEDS.map((s) => {
            const active = speed === s;
            return (
              <button
                key={s}
                onClick={() => handleSpeedChange(s)}
                className="rounded-md px-2 py-1 text-xs font-mono font-semibold transition-all"
                style={{
                  background: active ? 'rgba(0,212,255,0.12)' : 'rgba(255,255,255,0.03)',
                  border: `1px solid ${active ? 'rgba(0,212,255,0.35)' : 'rgba(255,255,255,0.07)'}`,
                  color: active ? '#00d4ff' : 'rgba(255,255,255,0.35)',
                }}
              >
                {s === 1 ? '1×' : `${s}×`}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
