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
  let res: any;
  try {
    res = await withRetry(
      () => {
        // Build a fresh FormData + ReadStream each attempt — a consumed stream can't be retried
        const retryForm = new FormData();
        retryForm.append('title', name);
        retryForm.append('type', 'tts');
        retryForm.append('train_mode', 'fast');
        retryForm.append('visibility', 'private');
        retryForm.append('voices', fs.createReadStream(audioFilePath), {
          filename: 'voice-sample.mp3',
          contentType: 'audio/mpeg',
        });
        return axios.post(`${BASE}/model`, retryForm, {
          headers: { ...retryForm.getHeaders(), Authorization: `Bearer ${apiKey()}` },
          timeout: 120_000,
          maxBodyLength: Infinity,
          maxContentLength: Infinity,
        });
      },
      { label: 'Fish Audio clone', attempts: 3, baseDelayMs: 5000 }
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
