export function friendlyError(e: unknown): string {
  const msg = e instanceof Error ? e.message : String(e ?? '');

  if (!msg || msg.toLowerCase().includes('failed to fetch') || msg.toLowerCase().includes('networkerror') || msg.toLowerCase().includes('network request failed')) {
    return 'Could not reach the server. The server may be waking up — wait 30 seconds and try again.';
  }
  if (msg.toLowerCase().includes('load failed') || msg.toLowerCase().includes('err_connection')) {
    return 'Connection failed. Check your internet connection and try again.';
  }
  if (msg.toLowerCase().includes('502') || msg.toLowerCase().includes('503') || msg.toLowerCase().includes('bad gateway')) {
    return 'The server is temporarily unavailable. Wait a moment and try again.';
  }
  if (msg.toLowerCase().includes('413') || msg.toLowerCase().includes('too large') || msg.toLowerCase().includes('payload')) {
    return 'Your recording is too large to upload. Try a shorter recording (under 5 minutes).';
  }
  if (msg.toLowerCase().includes('timeout') || msg.toLowerCase().includes('timed out')) {
    return 'The request took too long. The server may be busy — try again in a moment.';
  }
  if (msg.toLowerCase().includes('fish audio') || msg.toLowerCase().includes('tts')) {
    return 'Voice synthesis failed. Check that your Fish Audio credits are topped up, then try again.';
  }
  if (msg.toLowerCase().includes('voice') && msg.toLowerCase().includes('clone')) {
    return 'Voice cloning failed. Make sure your audio sample is at least 1 minute long and try again.';
  }
  if (msg.toLowerCase().includes('screen recording not found')) {
    return 'Your recording was lost — the server restarted. Please record again and export straight away.';
  }
  if (msg.toLowerCase().includes('could not extract frames')) {
    return 'Could not read your recording. Try recording for at least 10 seconds and try again.';
  }

  // Strip raw JSON / technical prefixes before showing to user
  try {
    const parsed = JSON.parse(msg);
    if (parsed?.error) return parsed.error;
  } catch {}

  return msg || 'Something went wrong. Please try again.';
}
