import fs from 'fs';
import path from 'path';

const UPLOADS_DIR = path.join(__dirname, '../../../uploads');
const MAX_AGE_MS = 2 * 60 * 60 * 1000; // 2 hours

export function cleanupOrphanedFiles(): void {
  if (!fs.existsSync(UPLOADS_DIR)) return;

  const cutoff = Date.now() - MAX_AGE_MS;
  let removed = 0;

  for (const entry of fs.readdirSync(UPLOADS_DIR)) {
    const fullPath = path.join(UPLOADS_DIR, entry);
    try {
      const stat = fs.statSync(fullPath);
      if (stat.mtimeMs < cutoff) {
        if (stat.isDirectory()) {
          fs.rmSync(fullPath, { recursive: true, force: true });
        } else {
          fs.unlinkSync(fullPath);
        }
        removed++;
      }
    } catch {
      // File may have been removed by a concurrent process — ignore
    }
  }

  if (removed > 0) {
    console.log(`[cleanup] Removed ${removed} orphaned file(s)/folder(s) from uploads/`);
  }
}
