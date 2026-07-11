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
  if (!res.ok) {
    const body = await res.json().catch(() => ({ error: 'Upload failed.' }));
    throw new Error(body.error || 'Upload failed.');
  }
  const { jobId } = await res.json() as { jobId: string };

  // Poll job status every 3 seconds until done or error
  let lastStage = '';
  for (let i = 0; i < 300; i++) {
    await new Promise((r) => setTimeout(r, 3000));
    const pollRes = await fetch(`${BASE}/recording/job/${jobId}`, { headers: await getAuthHeader() });
    if (!pollRes.ok) continue;
    const job = await pollRes.json() as { status: string; stage?: string; result?: Record<string, unknown>; error?: string };
    if (job.stage && job.stage !== lastStage) {
      lastStage = job.stage;
      onProgress?.(job.stage);
    }
    if (job.status === 'done' && job.result) {
      const r = job.result as unknown as ProcessResponse & { videoUrl: string };
      return { ...r, videoUrl: `${BASE}${r.videoUrl}` } as ProcessResponse;
    }
    if (job.status === 'error') throw new Error(job.error || 'Processing failed.');
  }

  throw new Error('Processing timed out. Please try again.');
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

export interface RemoteVoice {
  voice_id: string;
  name: string;
  created_at: string;
}

export async function listVoices(): Promise<RemoteVoice[]> {
  const res = await fetch(`${BASE}/voices`, { headers: await getAuthHeader() });
  if (!res.ok) throw new Error(await res.text());
  const { voices } = await res.json();
  return voices;
}

export async function saveVoice(voiceId: string, name: string): Promise<void> {
  const res = await fetch(`${BASE}/voices`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...(await getAuthHeader()) },
    body: JSON.stringify({ voiceId, name }),
  });
  if (!res.ok) throw new Error(await res.text());
}

export async function deleteVoice(voiceId: string): Promise<void> {
  const res = await fetch(`${BASE}/voices/${voiceId}`, {
    method: 'DELETE',
    headers: await getAuthHeader(),
  });
  if (!res.ok) throw new Error(await res.text());
}

export interface WorkspaceMember {
  userId: string;
  role: string;
  joinedAt: string;
  email: string | null;
}

export interface PendingInvite {
  id: string;
  email: string;
  token: string;
  status: string;
  created_at: string;
}

export interface TeamData {
  workspace: { id: string; name: string; role: 'owner' | 'member' } | null;
  members: WorkspaceMember[];
  pendingInvites: PendingInvite[];
}

export async function getTeam(): Promise<TeamData> {
  const res = await fetch(`${BASE}/team`, { headers: await getAuthHeader() });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

export async function createWorkspace(name: string): Promise<void> {
  const res = await fetch(`${BASE}/team`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...(await getAuthHeader()) },
    body: JSON.stringify({ name }),
  });
  if (!res.ok) throw new Error(await res.text());
}

export async function inviteMember(email: string): Promise<{ token: string }> {
  const res = await fetch(`${BASE}/team/invite`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...(await getAuthHeader()) },
    body: JSON.stringify({ email }),
  });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

export async function getInviteInfo(token: string): Promise<{ email: string; workspaceName: string }> {
  const res = await fetch(`${BASE}/invite/${token}`);
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

export async function acceptInvite(token: string): Promise<void> {
  const res = await fetch(`${BASE}/team/join/${token}`, {
    method: 'POST',
    headers: await getAuthHeader(),
  });
  if (!res.ok) throw new Error(await res.text());
}

export async function removeMember(userId: string): Promise<void> {
  const res = await fetch(`${BASE}/team/members/${userId}`, {
    method: 'DELETE',
    headers: await getAuthHeader(),
  });
  if (!res.ok) throw new Error(await res.text());
}

export interface WatchData {
  sessionId: string;
  title: string;
  downloadUrl: string;
  segments: import('../store/useStore').ScriptSegment[];
  videoContext: import('../store/useStore').VideoContext;
}

export async function getWatchData(sessionId: string): Promise<WatchData> {
  const res = await fetch(`${BASE}/watch/${sessionId}`);
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}
