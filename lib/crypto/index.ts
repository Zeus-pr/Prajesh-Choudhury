/** Field-level encryption at rest for sensitive identifiers (PAN etc.) — AES-256-GCM (§38). */
import { createCipheriv, createDecipheriv, randomBytes } from 'crypto';

function key(): Buffer {
  const secret = process.env.ENCRYPTION_KEY; // 64 hex chars = 32 bytes
  if (!secret || !/^[0-9a-f]{64}$/i.test(secret)) {
    if (process.env.NODE_ENV === 'production') throw new Error('ENCRYPTION_KEY must be a 32-byte hex key in production');
    return Buffer.from('0'.repeat(64), 'hex'); // deterministic dev key — never for production
  }
  return Buffer.from(secret, 'hex');
}

export function encryptString(plain: string): string {
  const iv = randomBytes(12);
  const c = createCipheriv('aes-256-gcm', key(), iv);
  const enc = Buffer.concat([c.update(plain, 'utf8'), c.final()]);
  return `v1:${iv.toString('hex')}:${enc.toString('hex')}:${c.getAuthTag().toString('hex')}`;
}

export function decryptString(payload: string): string {
  const [v, ivHex, dataHex, tagHex] = payload.split(':');
  if (v !== 'v1' || !ivHex || !dataHex || !tagHex) throw new Error('Malformed ciphertext');
  const d = createDecipheriv('aes-256-gcm', key(), Buffer.from(ivHex, 'hex'));
  d.setAuthTag(Buffer.from(tagHex, 'hex'));
  return Buffer.concat([d.update(Buffer.from(dataHex, 'hex')), d.final()]).toString('utf8');
}

/** Masked display form: ABCDE****F — never render full PAN outside secure contexts. */
export function maskPan(pan: string): string {
  if (pan.length < 10) return '••••';
  return `${pan.slice(0, 3)}••••${pan.slice(-1)}`;
}

export const PAN_RE = /^[A-Z]{5}[0-9]{4}[A-Z]$/;
