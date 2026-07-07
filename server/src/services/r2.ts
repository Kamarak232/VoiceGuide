import { S3Client, PutObjectCommand, GetObjectCommand, HeadObjectCommand } from '@aws-sdk/client-s3';
import { pipeline } from 'stream/promises';
import { Readable } from 'stream';
import fs from 'fs';
import path from 'path';

function makeClient(): S3Client | null {
  const accountId = process.env.CLOUDFLARE_ACCOUNT_ID;
  const accessKeyId = process.env.R2_ACCESS_KEY_ID;
  const secretAccessKey = process.env.R2_SECRET_ACCESS_KEY;
  if (!accountId || !accessKeyId || !secretAccessKey) return null;
  return new S3Client({
    endpoint: `https://${accountId}.r2.cloudflarestorage.com`,
    region: 'auto',
    credentials: { accessKeyId, secretAccessKey },
  });
}

const client = makeClient();
const BUCKET = process.env.R2_BUCKET_NAME ?? 'voiceguide';

if (!client) {
  console.warn('[r2] No Cloudflare R2 credentials — files will use local storage only.');
}

// Upload a local file to R2. No-op if R2 is not configured.
export async function uploadFile(localPath: string, key: string): Promise<void> {
  if (!client) return;
  const body = fs.createReadStream(localPath);
  const size = fs.statSync(localPath).size;
  await client.send(new PutObjectCommand({ Bucket: BUCKET, Key: key, Body: body, ContentLength: size }));
  console.log(`[r2] uploaded ${key} (${(size / 1024).toFixed(0)} KB)`);
}

// Download a file from R2 to a local path. Returns true on success, false if not found.
export async function restoreFile(key: string, localPath: string): Promise<boolean> {
  if (!client) return false;
  try {
    const res = await client.send(new GetObjectCommand({ Bucket: BUCKET, Key: key }));
    fs.mkdirSync(path.dirname(localPath), { recursive: true });
    const out = fs.createWriteStream(localPath);
    await pipeline(res.Body as Readable, out);
    console.log(`[r2] restored ${key} → ${localPath}`);
    return true;
  } catch (e: any) {
    if (e?.name === 'NoSuchKey' || e?.$metadata?.httpStatusCode === 404) return false;
    console.error(`[r2] restore failed for ${key}:`, e.message);
    return false;
  }
}

// Check if a key exists in R2. Returns false if R2 is not configured.
export async function existsInR2(key: string): Promise<boolean> {
  if (!client) return false;
  try {
    await client.send(new HeadObjectCommand({ Bucket: BUCKET, Key: key }));
    return true;
  } catch {
    return false;
  }
}

// Derive the R2 key from a server-relative URL like /uploads/foo.webm or /outputs/bar.mp3
export function urlToKey(serverRelativeUrl: string): string {
  return serverRelativeUrl.replace(/^\//, '');
}
