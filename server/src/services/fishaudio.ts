import axios from 'axios';
import FormData from 'form-data';
import fs from 'fs';
import ffmpeg from 'fluent-ffmpeg';
import { withRetry } from './retry';

const BASE = 'https://api.fish.audio';

function apiKey(): string {
  return process.env.FISH_AUDIO_API_KEY!;
}

export async function createVoiceClone(audioFilePath: string, name: string): Promise<string> {
  const form = new FormData();
  form.append('title', name);
  form.append('type', 'tts');
  form.append('train_mode', 'fast');
  form.append('visibility', 'private');
  form.append('voices', fs.createReadStream(audioFilePath), {
    filename: 'voice-sample.mp3',
    contentType: 'audio/mpeg',
  });

  let res: any;
  try {
    res = await withRetry(
      () => axios.post(`${BASE}/model`, form, {
        headers: { ...form.getHeaders(), Authorization: `Bearer ${apiKey()}` },
      }),
      { label: 'Fish Audio clone', attempts: 3, baseDelayMs: 2000 }
    );
  } catch (e: any) {
    const body = e?.response?.data;
    console.error('[Fish Audio] clone error body:', JSON.stringify(body));
    throw e;
  }

  return res.data._id as string;
}

export interface SegmentAudio {
  audioFile: string;
  audioDuration: number;
}

export async function synthesiseWithTimestamps(
  text: string,
  voiceId: string,
  outputPath: string
): Promise<SegmentAudio> {
  const res = await withRetry(
    () => axios.post(
      `${BASE}/v1/tts`,
      { text, reference_id: voiceId, format: 'mp3', mp3_bitrate: 128, normalize: true, latency: 'normal' },
      { headers: { Authorization: `Bearer ${apiKey()}`, 'Content-Type': 'application/json' }, responseType: 'arraybuffer' }
    ),
    { label: 'Fish Audio TTS', attempts: 3, baseDelayMs: 1000 }
  );

  fs.writeFileSync(outputPath, Buffer.from(res.data));
  const audioDuration = await getAudioDuration(outputPath);
  return { audioFile: outputPath, audioDuration };
}

function getAudioDuration(filePath: string): Promise<number> {
  return new Promise((resolve, reject) => {
    ffmpeg.ffprobe(filePath, (err, metadata) => {
      if (err) return reject(err);
      resolve(metadata.format.duration ?? 0);
    });
  });
}
