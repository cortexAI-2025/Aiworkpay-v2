import { mkdir, readFile, rm, writeFile } from 'fs/promises';
import path from 'path';
import { DeleteObjectCommand, GetObjectCommand, PutObjectCommand, S3Client } from '@aws-sdk/client-s3';

/**
 * Private storage for proof files delivered by Payworkers.
 *
 * - `s3` (production): any S3-compatible service — AWS S3, Cloudflare R2,
 *   Scaleway, OVH, MinIO. The bucket must stay private: files are only ever
 *   served through the app, after an access check.
 * - `local` (development, single server): a directory on disk. In Docker,
 *   mount it as a volume or files are lost on redeploy.
 *
 * Objects are addressed by keys this module generates; nothing a user sends is
 * ever used as a path.
 */

export interface Storage {
  put(key: string, body: Buffer, contentType: string): Promise<void>;
  get(key: string): Promise<Buffer>;
  delete(key: string): Promise<void>;
}

class LocalStorage implements Storage {
  constructor(private readonly root: string) {}

  private resolve(key: string): string {
    const full = path.resolve(this.root, key);
    if (!full.startsWith(path.resolve(this.root) + path.sep)) throw new Error('Invalid storage key');
    return full;
  }

  async put(key: string, body: Buffer): Promise<void> {
    const file = this.resolve(key);
    await mkdir(path.dirname(file), { recursive: true });
    await writeFile(file, body, { flag: 'wx' });
  }

  async get(key: string): Promise<Buffer> {
    return readFile(this.resolve(key));
  }

  async delete(key: string): Promise<void> {
    await rm(this.resolve(key), { force: true });
  }
}

class S3Storage implements Storage {
  private readonly client: S3Client;

  constructor(private readonly bucket: string) {
    this.client = new S3Client({
      region: process.env.S3_REGION || 'auto',
      endpoint: process.env.S3_ENDPOINT || undefined,
      forcePathStyle: process.env.S3_FORCE_PATH_STYLE === 'true',
      credentials:
        process.env.S3_ACCESS_KEY_ID && process.env.S3_SECRET_ACCESS_KEY
          ? { accessKeyId: process.env.S3_ACCESS_KEY_ID, secretAccessKey: process.env.S3_SECRET_ACCESS_KEY }
          : undefined,
    });
  }

  async put(key: string, body: Buffer, contentType: string): Promise<void> {
    await this.client.send(
      new PutObjectCommand({ Bucket: this.bucket, Key: key, Body: body, ContentType: contentType })
    );
  }

  async get(key: string): Promise<Buffer> {
    const object = await this.client.send(new GetObjectCommand({ Bucket: this.bucket, Key: key }));
    if (!object.Body) throw new Error('Empty object');
    return Buffer.from(await object.Body.transformToByteArray());
  }

  async delete(key: string): Promise<void> {
    await this.client.send(new DeleteObjectCommand({ Bucket: this.bucket, Key: key }));
  }
}

let storage: Storage | null = null;

export function getStorage(): Storage {
  if (storage) return storage;
  const driver = process.env.STORAGE_DRIVER || 'local';
  if (driver === 's3') {
    const bucket = process.env.S3_BUCKET;
    if (!bucket) throw new Error('S3_BUCKET is required with STORAGE_DRIVER=s3');
    storage = new S3Storage(bucket);
  } else if (driver === 'local') {
    storage = new LocalStorage(process.env.UPLOAD_DIR || path.join(process.cwd(), 'uploads'));
  } else {
    throw new Error(`Unknown STORAGE_DRIVER: ${driver}`);
  }
  return storage;
}

// ─── What may be uploaded ────────────────────────────────────────────────────

function envInt(name: string, fallback: number): number {
  const value = Number(process.env[name]);
  return Number.isInteger(value) && value > 0 ? value : fallback;
}

export const UPLOAD_LIMITS = {
  maxFileBytes: envInt('PROOF_MAX_FILE_MB', 10) * 1024 * 1024,
  maxFilesPerMission: envInt('PROOF_MAX_FILES', 20),
};

/** Accepted proof types, recognised from the file's first bytes. */
const SIGNATURES: { mime: string; extension: string; matches: (b: Buffer) => boolean }[] = [
  { mime: 'image/jpeg', extension: 'jpg', matches: (b) => b.length > 3 && b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff },
  {
    mime: 'image/png',
    extension: 'png',
    matches: (b) => b.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])),
  },
  {
    mime: 'image/webp',
    extension: 'webp',
    matches: (b) => b.subarray(0, 4).toString('latin1') === 'RIFF' && b.subarray(8, 12).toString('latin1') === 'WEBP',
  },
  {
    mime: 'image/heic',
    extension: 'heic',
    matches: (b) =>
      b.subarray(4, 8).toString('latin1') === 'ftyp' &&
      ['heic', 'heix', 'mif1', 'msf1', 'hevc'].includes(b.subarray(8, 12).toString('latin1')),
  },
  { mime: 'application/pdf', extension: 'pdf', matches: (b) => b.subarray(0, 5).toString('latin1') === '%PDF-' },
];

export const ACCEPTED_TYPES = SIGNATURES.map((s) => s.mime);

/**
 * The real type of a file, from its content. What the client declares is not
 * trusted: an HTML page renamed photo.jpg is refused.
 */
export function detectType(content: Buffer): { mime: string; extension: string } | null {
  const match = SIGNATURES.find((s) => s.matches(content));
  return match ? { mime: match.mime, extension: match.extension } : null;
}

/** Display name only: no path, no control characters, bounded length. */
export function safeFilename(name: string, extension: string): string {
  const base = (name.split(/[\\/]/).pop() ?? '')
    .replace(/[\u0000-\u001f\u007f"<>|*?]/g, '')
    .trim()
    .slice(0, 200);
  return base || `preuve.${extension}`;
}
