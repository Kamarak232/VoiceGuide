import { getAuthHeader } from './supabase';

const BASE = import.meta.env.VITE_API_URL ?? '';

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
  const res = await fetch(`${BASE}/export/render`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...(await getAuthHeader()) },
    body: JSON.stringify({ sessionId, syncManifest, videoUrl: videoUrl.replace(BASE, ''), burnSubtitles, segments, titleCard }),
  });
  if (!res.ok) throw new Error(await res.text());

  const reader = res.body!.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  let result: { downloadUrl: string } | null = null;
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
          if (eventName === 'progress') onProgress?.(parsed.label);
          else if (eventName === 'done') { result = { downloadUrl: `${BASE}${parsed.downloadUrl}` }; break outer; }
          else if (eventName === 'error') { serverError = parsed.error; break outer; }
        } catch { /* ignore malformed event */ }
        eventName = '';
        eventData = '';
      }
    }
  }

  if (serverError) throw new Error(serverError);
  if (!result) throw new Error('No response from server.');
  return result;
}
