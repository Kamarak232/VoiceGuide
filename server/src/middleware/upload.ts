import multer, { FileFilterCallback } from 'multer';
import path from 'path';
import { v4 as uuidv4 } from 'uuid';
import { Request, Response, NextFunction } from 'express';

const ALLOWED_MIME_PREFIXES = ['video/', 'audio/'];
const ALLOWED_EXTENSIONS = new Set([
  '.mp4', '.mov', '.avi', '.mkv', '.webm', '.wmv', '.flv', '.m4v',
  '.mp3', '.wav', '.ogg', '.m4a', '.aac', '.webm',
]);

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => {
    cb(null, path.join(__dirname, '../../../uploads'));
  },
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname) || '.webm';
    cb(null, `${uuidv4()}${ext}`);
  },
});

function fileFilter(_req: Request, file: Express.Multer.File, cb: FileFilterCallback) {
  const ext = path.extname(file.originalname).toLowerCase();
  const mimeOk = ALLOWED_MIME_PREFIXES.some((p) => file.mimetype.startsWith(p));
  const extOk = ALLOWED_EXTENSIONS.has(ext) || ext === '';
  if (mimeOk || extOk) {
    cb(null, true);
  } else {
    cb(new Error(`Unsupported file type: ${file.mimetype}. Please upload a video or audio file.`));
  }
}

export const upload = multer({
  storage,
  fileFilter,
  limits: { fileSize: 500 * 1024 * 1024 }, // 500 MB
});

// Handles multer errors (file too large, wrong type) with a clean JSON response
export function handleUploadError(err: any, _req: Request, res: Response, next: NextFunction) {
  if (err?.code === 'LIMIT_FILE_SIZE') {
    res.status(413).json({ error: 'File too large. Maximum upload size is 500 MB.' });
    return;
  }
  if (err instanceof multer.MulterError || err?.message?.startsWith('Unsupported file type')) {
    res.status(400).json({ error: err.message });
    return;
  }
  next(err);
}
