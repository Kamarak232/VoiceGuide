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
  // Read the file into a Buffer once: form-data can compute a Content-Length for a Buffer
  // (a ReadStream forces Transfer-Encoding: chunked, which Fish Audio's multipart parser
  // rejects with a 500), and a Buffer is safely re-sendable on every retry attempt.
  const audioBuffer = fs.readFileSync(audioFilePath);

  let res: any;
  try {
    res = await withRetry(
      () => {
        // Build a fresh FormData each attempt so the body is never half-consumed.
        //
        // Field contract verified against the live API (see server/test-fishaudio.ts,
        // probed 2026-07-12): `type` is REQUIRED (omitting it -> 422 "Field required")
        // and `train_mode` is REQUIRED and must be the literal 'fast' ('default' is
        // rejected with 422 "Input should be 'fast'"). Do not remove or change these.
        // A 5xx here (e.g. 503 "Failed to preprocess audio: no available server") is a
        // Fish Audio outage, not a request problem.
        const retryForm = new FormData();
        retryForm.append('title', name);
        retryForm.append('type', 'tts');
        retryForm.append('train_mode', 'fast');
        retryForm.append('visibility', 'private');
        retryForm.append('voices', audioBuffer, {
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
    const status = e?.response?.status;
    const body = e?.response?.data;
    console.error('[Fish Audio] clone error status:', status, 'body:', JSON.stringify(body));
    // 5xx = Fish Audio's side (their preprocessing cluster returns e.g.
    // 503 "Failed to preprocess audio: no available server"). Surface a clear
    // message instead of the raw "Internal Server Error" string.
    if (typeof status === 'number' && status >= 500) {
      const upstream = typeof body === 'string' ? body : body?.message;
      throw new Error(
        `Fish Audio's voice cloning service is temporarily unavailable` +
          `${upstream ? ` (${String(upstream).trim()})` : ''}. Please try again in a few minutes.`
      );
    }
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
