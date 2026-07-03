import axios from 'axios';
import FormData from 'form-data';
import fs from 'fs';
import ffmpeg from 'fluent-ffmpeg';

const BASE = 'https://api.elevenlabs.io/v1';

function apiKey(): string {
  return process.env.ELEVENLABS_API_KEY!;
}

export async function createVoiceClone(audioFilePath: string, name: string): Promise<string> {
  const form = new FormData();
  form.append('name', name);
  form.append('description', 'VoiceTutorial cloned voice');
  form.append('files', fs.createReadStream(audioFilePath));

  const res = await axios.post(`${BASE}/voices/add`, form, {
    headers: { ...form.getHeaders(), 'xi-api-key': apiKey() },
  });

  return res.data.voice_id as string;
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
  const res = await axios.post(
    `${BASE}/text-to-speech/${voiceId}`,
    {
      text,
      model_id: 'eleven_monolingual_v1',
      voice_settings: { stability: 0.5, similarity_boost: 0.75 },
    },
    {
      headers: { 'xi-api-key': apiKey(), 'Content-Type': 'application/json' },
      responseType: 'arraybuffer',
    }
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
