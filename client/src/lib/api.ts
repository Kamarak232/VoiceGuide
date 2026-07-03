const BASE = import.meta.env.VITE_API_URL ?? '';

export async function cloneVoice(audioBlob: Blob): Promise<{ voiceId: string }> {
  const form = new FormData();
  form.append('audio', audioBlob, 'voice-sample.webm');
  const res = await fetch(`${BASE}/voice/clone`, { method: 'POST', body: form });
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
  voiceId: string
): Promise<ProcessResponse> {
  const form = new FormData();
  form.append('screen', screenBlob, 'screen.webm');
  if (narrationBlob) form.append('narration', narrationBlob, 'narration.webm');
  form.append('videoContext', JSON.stringify(videoContext));
  form.append('clickLog', JSON.stringify(clickLog));
  form.append('voiceId', voiceId);

  const res = await fetch(`${BASE}/recording/process`, { method: 'POST', body: form });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

export async function synthesiseStep(
  text: string,
  voiceId: string,
  sessionId: string,
  step: number
): Promise<{ audioFile: string; audioDuration: number }> {
  const res = await fetch(`${BASE}/voice/synthesise`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ text, voiceId, sessionId, step }),
  });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

export async function renderExport(
  sessionId: string,
  syncManifest: import('../store/useStore').SyncEntry[],
  videoUrl: string
): Promise<{ downloadUrl: string }> {
  const res = await fetch(`${BASE}/export/render`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ sessionId, syncManifest, videoUrl }),
  });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}
