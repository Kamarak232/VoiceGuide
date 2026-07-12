/**
 * Standalone probe for Fish Audio's POST /model (voice clone) endpoint.
 * Usage: cd server && npx ts-node --transpile-only test-fishaudio.ts [path/to/sample.mp3]
 *
 * Tries several form-field combinations to isolate which parameter makes
 * Fish Audio return 500. Any model it successfully creates is deleted again.
 */
import 'dotenv/config';
import axios from 'axios';
import FormData from 'form-data';
import fs from 'fs';

const BASE = 'https://api.fish.audio';
const API_KEY = process.env.FISH_AUDIO_API_KEY;
if (!API_KEY) {
  console.error('FISH_AUDIO_API_KEY missing from server/.env');
  process.exit(1);
}

const mp3Path = process.argv[2] || 'sample.mp3';
if (!fs.existsSync(mp3Path)) {
  console.error(`mp3 file not found: ${mp3Path} — pass a path as the first argument`);
  process.exit(1);
}
const audioBuffer = fs.readFileSync(mp3Path);
console.log(`Using ${mp3Path} (${audioBuffer.length} bytes)\n`);

interface Combo {
  name: string;
  fields: Record<string, string>;
}

const combos: Combo[] = [
  { name: 'A: minimal (title + visibility + train_mode=default)', fields: { title: 'probe-a', visibility: 'private', train_mode: 'default' } },
  { name: 'B: minimal + type=tts', fields: { title: 'probe-b', visibility: 'private', train_mode: 'default', type: 'tts' } },
  { name: 'C: minimal but train_mode=fast', fields: { title: 'probe-c', visibility: 'private', train_mode: 'fast' } },
  { name: 'D: production combo (type=tts + train_mode=fast)', fields: { title: 'probe-d', visibility: 'private', train_mode: 'fast', type: 'tts' } },
  { name: 'E: bare minimum (title only)', fields: { title: 'probe-e', visibility: 'private' } },
];

async function tryCombo(combo: Combo): Promise<void> {
  const form = new FormData();
  for (const [k, v] of Object.entries(combo.fields)) form.append(k, v);
  form.append('voices', audioBuffer, { filename: 'voice-sample.mp3', contentType: 'audio/mpeg' });

  console.log(`--- ${combo.name}`);
  try {
    const res = await axios.post(`${BASE}/model`, form, {
      headers: { ...form.getHeaders(), Authorization: `Bearer ${API_KEY}` },
      timeout: 120_000,
      maxBodyLength: Infinity,
      maxContentLength: Infinity,
    });
    console.log(`    status: ${res.status}`);
    console.log(`    body:   ${JSON.stringify(res.data).slice(0, 500)}`);
    const id = res.data?._id;
    if (id) {
      await axios
        .delete(`${BASE}/model/${id}`, { headers: { Authorization: `Bearer ${API_KEY}` } })
        .then(() => console.log(`    cleaned up model ${id}`))
        .catch((e) => console.log(`    (cleanup of ${id} failed: ${e?.response?.status ?? e?.message})`));
    }
  } catch (e: any) {
    const status = e?.response?.status;
    const body = e?.response?.data;
    const bodyStr = Buffer.isBuffer(body) ? body.toString('utf8') : typeof body === 'string' ? body : JSON.stringify(body);
    console.log(`    status: ${status ?? '(no response)'} ${e?.message}`);
    console.log(`    body:   ${String(bodyStr).slice(0, 500)}`);
  }
  console.log();
}

(async () => {
  for (const combo of combos) await tryCombo(combo);
})();
