import { useRef, useState, useEffect } from 'react';
import { SyncEntry } from '../store/useStore';

interface Props {
  videoUrl: string;
  syncManifest: SyncEntry[];
}

export default function VideoPreview({ videoUrl, syncManifest }: Props) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const audioRefs = useRef<HTMLAudioElement[]>([]);
  const [playing, setPlaying] = useState(false);

  useEffect(() => {
    audioRefs.current = syncManifest.map((entry) => {
      const audio = new Audio(entry.audioFile);
      return audio;
    });
    return () => {
      audioRefs.current.forEach((a) => a.pause());
    };
  }, [syncManifest]);

  function handlePlay() {
    const video = videoRef.current;
    if (!video) return;
    video.play();
    setPlaying(true);

    syncManifest.forEach((entry, i) => {
      const audio = audioRefs.current[i];
      if (!audio) return;
      const delayMs = entry.videoStartTime * 1000 - video.currentTime * 1000;
      setTimeout(() => {
        audio.currentTime = 0;
        audio.play().catch(() => {});
      }, Math.max(0, delayMs));
    });
  }

  function handlePause() {
    videoRef.current?.pause();
    audioRefs.current.forEach((a) => a.pause());
    setPlaying(false);
  }

  return (
    <div className="flex flex-col gap-3">
      <video
        ref={videoRef}
        src={videoUrl}
        className="w-full rounded-xl border bg-black"
        onEnded={() => setPlaying(false)}
      />
      <div className="flex gap-3">
        {playing ? (
          <button
            onClick={handlePause}
            className="px-6 py-2 bg-gray-200 text-gray-800 rounded-lg text-sm font-medium hover:bg-gray-300"
          >
            Pause Preview
          </button>
        ) : (
          <button
            onClick={handlePlay}
            className="px-6 py-2 bg-[#534AB7] text-white rounded-lg text-sm font-medium hover:bg-[#3f379a]"
          >
            ▶ Play Preview
          </button>
        )}
      </div>
    </div>
  );
}
