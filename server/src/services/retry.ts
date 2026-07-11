const RETRYABLE = new Set([408, 429, 500, 502, 503, 504]);

function isRetryable(err: any): boolean {
  const status = err?.response?.status ?? err?.status;
  if (status && RETRYABLE.has(status)) return true;
  // Network-level failures (ECONNRESET, ETIMEDOUT, etc.)
  const code = err?.code ?? '';
  return ['ECONNRESET', 'ETIMEDOUT', 'ENOTFOUND', 'EAI_AGAIN'].includes(code);
}

export async function withRetry<T>(
  fn: () => Promise<T>,
  { attempts = 3, baseDelayMs = 1000, label = 'request' }: { attempts?: number; baseDelayMs?: number; label?: string } = {}
): Promise<T> {
  let lastErr: unknown;
  for (let i = 0; i < attempts; i++) {
    try {
      return await fn();
    } catch (err: any) {
      lastErr = err;
      if (!isRetryable(err) || i === attempts - 1) throw err;
      const delay = baseDelayMs * 2 ** i;
      console.warn(`[retry] ${label} failed (attempt ${i + 1}/${attempts}), retrying in ${delay}ms — ${err?.message}`);
      await new Promise((r) => setTimeout(r, delay));
    }
  }
  throw lastErr;
}
