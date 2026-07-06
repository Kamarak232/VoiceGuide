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

export interface SubtitleEntry {
  step: number;
  text: string;
  startTime: number;
  endTime: number;
}

function toSrtTime(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);
  const ms = Math.round((seconds % 1) * 1000);
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')},${String(ms).padStart(3, '0')}`;
}

export function generateSRT(subtitles: SubtitleEntry[], outputPath: string): void {
  const content = subtitles.map((s, i) =>
    `${i + 1}\n${toSrtTime(s.startTime)} --> ${toSrtTime(s.endTime)}\n${s.text}\n`
  ).join('\n');
  fs.writeFileSync(outputPath, content, 'utf8');
}

export function renderFinalVideo(
  screenVideoPath: string,
  syncManifest: SyncEntry[],
  _clickLog: ClickEvent[],
  outputPath: string,
  srtPath?: string
): Promise<void> {
  return new Promise((resolve, reject) => {
    const cmd = ffmpeg(screenVideoPath);

    syncManifest.forEach((entry) => cmd.input(entry.audioFile));

    const adelayFilters = syncManifest.map((entry, i) => {
      const delayMs = Math.round(entry.videoStartTime * 1000);
      return `[${i + 1}:a]adelay=${delayMs}|${delayMs}[a${i + 1}]`;
    });

    const mixInputs = syncManifest.map((_, i) => `[a${i + 1}]`).join('');
    const amixFilter = `${mixInputs}amix=inputs=${syncManifest.length}:duration=longest:dropout_transition=0[aout]`;

    let videoFilter = '';
    if (srtPath) {
      const escapedPath = srtPath.replace(/\\/g, '/').replace(/:/g, '\\:');
      videoFilter = `subtitles=${escapedPath}:force_style='FontSize=16,PrimaryColour=&H00ffffff,OutlineColour=&H00000000,Outline=2,Bold=1,MarginV=25'`;
    }

    const filterParts = [...adelayFilters, amixFilter];
    if (videoFilter) filterParts.push(`[0:v]${videoFilter}[vout]`);
    const filterComplex = filterParts.join(';');

    const mapVideo = srtPath ? '-map [vout]' : '-map 0:v';

    cmd
      .complexFilter(filterComplex)
      .outputOptions([mapVideo, '-map [aout]', '-c:v libx264', '-c:a aac', '-crf 23', '-shortest'])
      .output(outputPath)
      .on('end', () => { if (srtPath && fs.existsSync(srtPath)) fs.unlinkSync(srtPath); resolve(); })
      .on('error', (err) => { if (srtPath && fs.existsSync(srtPath)) fs.unlinkSync(srtPath); reject(err); })
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
