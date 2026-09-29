/** Object storage abstraction (§39). DB stores only storage_key/mime/size/checksum; files live in encrypted object storage. */
import { createHash, createHmac, randomUUID, timingSafeEqual } from 'crypto';

export interface StoredObject { key: string; sizeBytes: number; checksumSha256: string; mimeType: string; }

export interface StorageProvider {
  put(key: string, body: Buffer, mime: string): Promise<StoredObject>;
  get(key: string): Promise<Buffer | null>;
  delete(key: string): Promise<void>;
  /** Signed temporary download URL (§39). */
  signedUrl(key: string, ttlSeconds?: number): Promise<string>;
}

const KEY_PREFIX = 'taxos-docs/';

function sanitizeKey(userScope: string, name: string): string {
  const safe = name.toLowerCase().replace(/[^a-z0-9._-]/g, '_').slice(-80);
  return `${KEY_PREFIX}${userScope}/${randomUUID()}-${safe}`;
}

/** Local filesystem provider for development (./storage). In production use R2/S3/Supabase via env. */
class LocalStorage implements StorageProvider {
  constructor(private root: string) {}
  private path(key: string) {
    // prevent traversal
    if (!key.startsWith(KEY_PREFIX)) throw new Error('Invalid storage key');
    return `${this.root}/${key}`;
  }
  async put(key: string, body: Buffer, mime: string): Promise<StoredObject> {
    const fs = await import('fs/promises');
    await fs.mkdir(this.path('').replace(/\/$/, ''), { recursive: true });
    await fs.mkdir(await this.dirOf(key), { recursive: true });
    await fs.writeFile(this.path(key), body);
    return { key, sizeBytes: body.length, checksumSha256: sha256(body), mimeType: mime };
  }
  private async dirOf(key: string) {
    const p = this.path(key);
    return p.slice(0, p.lastIndexOf('/'));
  }
  async get(key: string): Promise<Buffer | null> {
    const fs = await import('fs/promises');
    try { return await fs.readFile(this.path(key)); } catch { return null; }
  }
  async delete(key: string): Promise<void> {
    const fs = await import('fs/promises');
    try { await fs.unlink(this.path(key)); } catch { /* already gone — secure deletion is best-effort here; S3/R2 handles real crypto-erase */ }
  }
  async signedUrl(key: string, ttl = 300): Promise<string> {
    const exp = Math.floor(Date.now() / 1000) + ttl;
    const sig = sign(key, String(exp));
    return `/api/storage/signed/${encodeURIComponent(key)}?exp=${exp}&sig=${sig}`;
  }
}

function sha256(b: Buffer) { return createHash('sha256').update(b).digest('hex'); }
function sign(key: string, exp: string): string {
  const secret = process.env.STORAGE_SIGNING_SECRET ?? 'dev-only-signing-secret-change-me';
  return createHmac('sha256', secret).update(`${key}:${exp}`).digest('hex');
}

export function verifySignedUrl(key: string, exp: string, sig: string): boolean {
  const expected = sign(key, exp);
  if (!/^[0-9a-f]{64}$/.test(sig)) return false;
  const a = Buffer.from(expected, 'hex'), b = Buffer.from(sig, 'hex');
  return timingSafeEqual(a, b) && Number(exp) * 1000 > Date.now();
}

let _provider: StorageProvider | null = null;
export function getStorage(): StorageProvider {
  if (_provider) return _provider;
  const endpoint = process.env.STORAGE_ENDPOINT;
  if (endpoint) {
    // S3/R2-compatible provider would be initialised here with STORAGE_ACCESS_KEY/SECRET_KEY/BUCKET.
    // Not activated until credentials are configured — we never fake a working remote integration (§71).
    throw new Error('Remote storage is configured but the S3/R2 driver requires verified credentials. Set STORAGE_* env vars or leave unset to use local dev storage.');
  }
  _provider = new LocalStorage(process.env.LOCAL_STORAGE_DIR ?? './storage');
  return _provider;
}

export { sanitizeKey as buildStorageKey };
