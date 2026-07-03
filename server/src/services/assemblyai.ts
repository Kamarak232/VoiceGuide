import axios from 'axios';
import fs from 'fs';

const BASE = 'https://api.assemblyai.com/v2';

function apiKey(): string {
  return process.env.ASSEMBLYAI_API_KEY!;
}

async function uploadAudio(filePath: string): Promise<string> {
  const data = fs.readFileSync(filePath);
  const res = await axios.post(`${BASE}/upload`, data, {
    headers: { authorization: apiKey(), 'Content-Type': 'application/octet-stream' },
  });
  return res.data.upload_url as string;
}

export interface TranscriptWord {
  text: string;
  start: number; // ms
  end: number;   // ms
  confidence: number;
}

export interface TranscriptResult {
  text: string;
  words: TranscriptWord[];
}

export async function transcribeAudio(
  filePath: string,
  keywords: string[] = []
): Promise<TranscriptResult> {
  const audioUrl = await uploadAudio(filePath);

  const submitRes = await axios.post(
    `${BASE}/transcript`,
    { audio_url: audioUrl, word_boost: keywords, boost_param: 'high' },
    { headers: { authorization: apiKey() } }
  );

  const transcriptId: string = submitRes.data.id;

  for (;;) {
    await new Promise((r) => setTimeout(r, 3000));
    const pollRes = await axios.get(`${BASE}/transcript/${transcriptId}`, {
      headers: { authorization: apiKey() },
    });
    const { status, text, words, error } = pollRes.data;

    if (status === 'completed') {
      return { text: text ?? '', words: words ?? [] };
    }
    if (status === 'error') {
      throw new Error(`AssemblyAI transcription failed: ${error}`);
    }
  }
}
