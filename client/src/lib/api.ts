import { getAuthHeader } from './supabase';

const BASE = import.meta.env.VITE_API_URL ?? '';

export interface LibraryItem {
  session_id: string;
  title: string;
  created_at: string;
  video_duration: number | null;
  download_url: string | null;
  video_context: import('../store/useStore').VideoContext | null;
}

export interface LibraryRecording {
  session_id: string;
  title: string;
  created_at: string;
  video_url: string | null;
  video_duration: number | null;
  segments: import('../store/useStore').ScriptSegment[] | null;
  sync_manifest: import('../store/useStore').SyncEntry[] | null;
  video_context: import('../store/useStore').VideoContext | null;
  download_url: string | null;
}

export async function getLibrary(): Promise<LibraryItem[]> {
  const res = await fetch(`${BASE}/library`, { headers: await getAuthHeader() });
  if (!res.ok) throw new Error(await res.text());
  const { recordings } = await res.json();
  return recordings;
}

export async function getLibraryRecording(sessionId: string): Promise<LibraryRecording> {
  const res = await fetch(`${BASE}/library/${sessionId}`, { headers: await getAuthHeader() });
  if (!res.ok) throw new Error(await res.text());
  const { recording } = await res.json();
  return recording;
}

export async function getBillingStatus(): Promise<{ plan: string; used: number; limit: number; hasStripe: boolean }> {
  const res = await fetch(`${BASE}/billing/status`, { headers: await getAuthHeader() });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

export async function createCheckout(plan: string): Promise<{ url: string }> {
  const res = await fetch(`${BASE}/billing/checkout`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...(await getAuthHeader()) },
    body: JSON.stringify({ plan }),
  });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

export async function createPortal(): Promise<{ url: string }> {
  const res = await fetch(`${BASE}/billing/portal`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...(await getAuthHeader()) },
  });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

export async function promoLogin(code: string): Promise<{ access_token: string; refresh_token: string }> {
  const res = await fetch(`${BASE}/auth/promo-login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ code }),
  });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

export async function cloneVoice(audioBlob: Blob): Promise<{ voiceId: string }> {
  const form = new FormData();
  form.append('audio', audioBlob, 'voice-sample.webm');
  const res = await fetch(`${BASE}/voice/clone`, { method: 'POST', body: form, headers: await getAuthHeader() });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

export interface ProcessResponse {
  sessionId: string;
  segments: import('../store/useStore').ScriptSegment[];
  syncManifest: import('../store/useStore').SyncEntry[];
  videoUrl: string;
  videoDuration: number;
}

export async function processRecording(
  screenBlob: Blob,
  narrationBlob: Blob | null,
  videoContext: import('../store/useStore').VideoContext,
  clickLog: { x: number; y: number; timestamp: number }[],
  voiceId: string,
  trimStart?: number,
  trimEnd?: number,
  onProgress?: (stage: string) => void
): Promise<ProcessResponse> {
  const form = new FormData();
  form.append('screen', screenBlob, 'screen.webm');
  if (narrationBlob) form.append('narration', narrationBlob, 'narration.webm');
  form.append('videoContext', JSON.stringify(videoContext));
  form.append('clickLog', JSON.stringify(clickLog));
  form.append('voiceId', voiceId);
  if (trimStart !== undefined && trimStart > 0) form.append('trimStart', String(trimStart));
  if (trimEnd !== undefined && trimEnd > 0) form.append('trimEnd', String(trimEnd));

  const res = await fetch(`${BASE}/recording/process`, { method: 'POST', body: form, headers: await getAuthHeader() });
  if (!res.ok) throw new Error(await res.text());

  // Server streams SSE events — parse the response body as a stream
  const reader = res.body!.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  let result: ProcessResponse | null = null;
  let serverError: string | null = null;

  outer: while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });

    const lines = buffer.split('\n');
    buffer = lines.pop()!;

    let eventName = '';
    let eventData = '';
    for (const line of lines) {
      if (line.startsWith('event: ')) { eventName = line.slice(7).trim(); eventData = ''; }
      else if (line.startsWith('data: ')) { eventData = line.slice(6).trim(); }
      else if (line === '' && eventName) {
        try {
          const parsed = JSON.parse(eventData);
          if (eventName === 'progress') onProgress?.(parsed.stage);
          else if (eventName === 'done') { result = { ...parsed, videoUrl: `${BASE}${parsed.videoUrl}` }; break outer; }
          else if (eventName === 'error') { serverError = parsed.error; break outer; }
        } catch { /* ignore malformed event */ }
        eventName = '';
        eventData = '';
      }
    }
  }

  if (serverError) throw new Error(serverError);
  if (!result) throw new Error('No response received from server.');
  return result;
}

export async function synthesiseStep(
  text: string,
  voiceId: string,
  sessionId: string,
  step: number
): Promise<{ audioFile: string; audioDuration: number }> {
  const res = await fetch(`${BASE}/voice/synthesise`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...(await getAuthHeader()) },
    body: JSON.stringify({ text, voiceId, sessionId, step }),
  });
  if (!res.ok) throw new Error(await res.text());
  const data = await res.json();
  return { ...data, audioFile: `${BASE}${data.audioFile}` };
}

export async function uploadStepRecording(
  blob: Blob,
  sessionId: string,
  step: number
): Promise<{ audioFile: string; audioDuration: number }> {
  const form = new FormData();
  form.append('audio', blob, 'step-recording.webm');
  form.append('sessionId', sessionId);
  form.append('step', String(step));
  const res = await fetch(`${BASE}/voice/record-step`, { method: 'POST', body: form, headers: await getAuthHeader() });
  if (!res.ok) throw new Error(await res.text());
  const data = await res.json();
  return { ...data, audioFile: `${BASE}${data.audioFile}` };
}

export async function previewStep(
  sessionId: string,
  step: number,
  videoUrl: string,
  audioFile: string,
  videoStartTime: number,
  audioDuration: number
): Promise<{ previewUrl: string }> {
  const res = await fetch(`${BASE}/export/preview-step`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...(await getAuthHeader()) },
    body: JSON.stringify({
      sessionId,
      step,
      videoUrl: videoUrl.replace(BASE, ''),
      audioFile: audioFile.replace(BASE, ''),
      videoStartTime,
      audioDuration,
    }),
  });
  if (!res.ok) throw new Error(await res.text());
  const data = await res.json();
  return { previewUrl: `${BASE}${data.previewUrl}` };
}

export async function renderExport(
  sessionId: string,
  syncManifest: import('../store/useStore').SyncEntry[],
  videoUrl: string,
  burnSubtitles?: boolean,
  segments?: import('../store/useStore').ScriptSegment[],
  titleCard?: { title: string; subtitle: string },
  onProgress?: (label: string) => void
): Promise<{ downloadUrl: string }> {
  const startRes = await fetch(`${BASE}/export/render`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...(await getAuthHeader()) },
    body: JSON.stringify({ sessionId, syncManifest, videoUrl: videoUrl.replace(BASE, ''), burnSubtitles, segments, titleCard }),
  });
  if (!startRes.ok) throw new Error(await startRes.text());
  const { jobId } = await startRes.json() as { jobId: string };

  // Poll until done or error
  for (let i = 0; i < 240; i++) {
    await new Promise((r) => setTimeout(r, 3000));
    const pollRes = await fetch(`${BASE}/export/render/${jobId}`, { headers: await getAuthHeader() });
    if (!pollRes.ok) continue;
    const job = await pollRes.json() as { status: string; label: string; downloadUrl?: string; error?: string };
    if (job.label) onProgress?.(job.label);
    if (job.status === 'done' && job.downloadUrl) return { downloadUrl: `${BASE}${job.downloadUrl}` };
    if (job.status === 'error') throw new Error(job.error || 'Render failed.');
  }

  throw new Error('Render timed out. Please try again.');
}
