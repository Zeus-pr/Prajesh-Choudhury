/** File-type detection + safe upload validation (§38/§34). Virus scan hook is pluggable; default is a conservative heuristic scanner. */
import { createHash } from 'crypto';

export const MAX_FILE_BYTES = 20 * 1024 * 1024; // 20 MB

export type DocKind = 'PDF' | 'CSV' | 'XLSX' | 'JSON' | 'TXT' | 'HTML' | 'UNSUPPORTED';

const MAGIC: { ext: DocKind; test: (b: Buffer) => boolean }[] = [
  { ext: 'PDF', test: b => b.subarray(0, 5).toString('latin1') === '%PDF-' },
  { ext: 'XLSX', test: b => b.subarray(0, 2).toString('latin1') === 'PK' },
  { ext: 'JSON', test: b => { try { JSON.parse(b.subarray(0, 64 * 1024).toString('utf8').trim()[0] === '{' || b[0] === 0x5b ? b.toString('utf8') : '{}'); return true; } catch { return false; } } },
];

export function detectFileType(buf: Buffer): DocKind {
  for (const m of MAGIC) if (m.test(buf)) return m.ext;
  const head = buf.subarray(0, 4096).toString('utf8').toLowerCase();
  if (/^\s*</.test(head) && /<html|<!doctype/.test(head)) return 'HTML';
  if (/^[\x20-\x7e\n\r\t₹]+$/s.test(buf.subarray(0, 4096).toString('utf8'))) {
    return head.split('\n')[0].split(',').length > 2 ? 'CSV' : 'TXT';
  }
  return 'UNSUPPORTED';
}

export function checksumSha256(buf: Buffer): string {
  return createHash('sha256').update(buf).digest('hex');
}

/** Basic malware heuristics — replace with ClamAV/VirusTotal integration in production (§38). */
export function heuristicScan(buf: Buffer, kind: DocKind): { clean: boolean; reason?: string } {
  if (buf.length === 0) return { clean: false, reason: 'The file is empty.' };
  if (buf.length > MAX_FILE_BYTES) return { clean: false, reason: `File exceeds the ${MAX_FILE_BYTES / 1024 / 1024} MB limit.` };
  if (kind === 'UNSUPPORTED') return { clean: false, reason: 'Unsupported file type. Allowed: PDF, CSV, XLSX, JSON, TXT, HTML.' };
  // Executable signatures
  if (buf.subarray(0, 2).toString('latin1') === 'MZ') return { clean: false, reason: 'This looks like an executable file, which we never accept.' };
  if (buf.subarray(0, 4).toString('latin1') === '!DOC') return { clean: false, reason: 'Word documents are not supported here.' };
  // Embedded JS inside PDF (common attack vector) → flag for manual review rather than hard reject
  if (kind === 'PDF' && /\/JavaScript|\/OpenAction|\/Launch/i.test(buf.subarray(0, Math.min(buf.length, 2_000_000)).toString('latin1'))) {
    return { clean: false, reason: 'This PDF contains embedded scripts and was rejected for your safety.' };
  }
  return { clean: true };
}

export function validateUpload(file: { name: string; size: number; buffer: Buffer }): { ok: boolean; kind?: DocKind; error?: string; checksum?: string } {
  if (file.size > MAX_FILE_BYTES) return { ok: false, error: `File is larger than ${MAX_FILE_BYTES / 1024 / 1024} MB. Split the statement or upload a smaller export.` };
  const kind = detectFileType(file.buffer);
  const scan = heuristicScan(file.buffer, kind);
  if (!scan.clean) return { ok: false, error: scan.reason, kind };
  return { ok: true, kind, checksum: checksumSha256(file.buffer) };
}
