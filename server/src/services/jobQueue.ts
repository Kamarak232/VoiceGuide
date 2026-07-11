export interface JobState {
  status: 'queued' | 'processing' | 'done' | 'error';
  stage?: string;
  result?: Record<string, unknown>;
  error?: string;
  createdAt: number;
}

const jobs = new Map<string, JobState>();
let running = 0;
const MAX_CONCURRENT = 2;
const pending: (() => Promise<void>)[] = [];

// Purge jobs older than 2 hours to prevent memory leak
setInterval(() => {
  const cutoff = Date.now() - 2 * 60 * 60 * 1000;
  for (const [id, job] of jobs) {
    if (job.createdAt < cutoff) jobs.delete(id);
  }
}, 15 * 60 * 1000);

function drain() {
  if (running >= MAX_CONCURRENT || pending.length === 0) return;
  const fn = pending.shift()!;
  running++;
  fn().finally(() => { running--; drain(); });
}

export function createJob(id: string): void {
  jobs.set(id, { status: 'queued', createdAt: Date.now() });
}

export function updateJob(id: string, patch: Partial<Omit<JobState, 'createdAt'>>): void {
  const existing = jobs.get(id);
  if (existing) jobs.set(id, { ...existing, ...patch });
}

export function getJob(id: string): JobState | undefined {
  return jobs.get(id);
}

export function enqueue(fn: () => Promise<void>): void {
  pending.push(fn);
  drain();
}

export function getQueueStats() {
  return { running, queued: pending.length, total: jobs.size };
}
