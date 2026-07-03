import ffmpeg from 'fluent-ffmpeg';
import path from 'path';
import fs from 'fs';

export interface SyncEntry {
  step: number;
  audioFile: string;
  audioDuration: number;
  videoStartTime: number;
  maxDuration?: number; // cap clip so it doesn't overlap next step
}

export interface ClickEvent {
  x: number;
  y: number;
  timestamp: number; // ms
}

export function renderFinalVideo(
  screenVideoPath: string,
  syncManifest: SyncEntry[],
  _clickLog: ClickEvent[],
  outputPath: string
): Promise<void> {
  return new Promise((resolve, reject) => {
    const cmd = ffmpeg(screenVideoPath);

    syncManifest.forEach((entry) => cmd.input(entry.audioFile));

    // Delay each clip to start at its video timestamp — no trimming so TTS plays fully
    const adelayFilters = syncManifest.map((entry, i) => {
      const delayMs = Math.round(entry.videoStartTime * 1000);
      return `[${i + 1}:a]adelay=${delayMs}|${delayMs}[a${i + 1}]`;
    });

    const mixInputs = syncManifest.map((_, i) => `[a${i + 1}]`).join('');
    // dropout_transition=0 prevents volume dips when clips overlap; duration=longest keeps audio past video end
    const amixFilter = `${mixInputs}amix=inputs=${syncManifest.length}:duration=longest:dropout_transition=0[aout]`;

    const filterComplex = [...adelayFilters, amixFilter].join(';');

    // -shortest ends the output when the VIDEO track ends (not when audio ends)
    cmd
      .complexFilter(filterComplex)
      .outputOptions(['-map 0:v', '-map [aout]', '-c:v libx264', '-c:a aac', '-crf 23', '-shortest'])
      .output(outputPath)
      .on('end', () => resolve())
      .on('error', (err) => reject(err))
      .run();
  });
}

export function extractAudioFromVideo(videoPath: string, outputAudioPath: string): Promise<void> {
  return new Promise((resolve, reject) => {
    ffmpeg(videoPath)
      .noVideo()
      .audioCodec('libmp3lame')
      .audioBitrate('192k')
      .output(outputAudioPath)
      .on('end', () => resolve())
      .on('error', (err) => reject(err))
      .run();
  });
}

export function getVideoDuration(filePath: string): Promise<number> {
  return new Promise((resolve, reject) => {
    ffmpeg.ffprobe(filePath, (err, metadata) => {
      if (err) return reject(err);
      resolve(metadata.format.duration ?? 0);
    });
  });
}

export interface KeyframeResult {
  paths: string[];
  timestamps: number[]; // seconds into the video for each frame
}

export function extractKeyframes(
  videoPath: string,
  outputDir: string,
  intervalSeconds = 5
): Promise<KeyframeResult> {
  return new Promise((resolve, reject) => {
    fs.mkdirSync(outputDir, { recursive: true });
    const pattern = path.join(outputDir, 'frame_%04d.jpg');

    ffmpeg(videoPath)
      .outputOptions(['-r', String(1 / intervalSeconds), '-q:v', '3'])
      .output(pattern)
      .on('end', () => {
        const paths = readFrameDir(outputDir);
        // frame_0001 → 0s, frame_0002 → intervalSeconds, etc.
        const timestamps = paths.map((_, i) => i * intervalSeconds);
        resolve({ paths, timestamps });
      })
      .on('error', reject)
      .run();
  });
}

export function extractFallbackFrames(
  videoPath: string,
  outputDir: string,
  intervalSeconds = 10
): Promise<KeyframeResult> {
  return new Promise((resolve, reject) => {
    fs.mkdirSync(outputDir, { recursive: true });
    const pattern = path.join(outputDir, 'frame_%04d.jpg');

    ffmpeg(videoPath)
      .outputOptions(['-r', String(1 / intervalSeconds), '-q:v', '3'])
      .output(pattern)
      .on('end', () => {
        const paths = readFrameDir(outputDir);
        const timestamps = paths.map((_, i) => i * intervalSeconds);
        resolve({ paths, timestamps });
      })
      .on('error', reject)
      .run();
  });
}

function readFrameDir(dir: string): string[] {
  return fs.readdirSync(dir)
    .filter(f => f.endsWith('.jpg'))
    .sort()
    .map(f => path.join(dir, f));
}
