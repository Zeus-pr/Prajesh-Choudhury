/** Shared parsing helpers + import status machine (§55). */
export type ImportStatus = 'UPLOADED' | 'PROCESSING' | 'EXTRACTED' | 'REVIEW_REQUIRED' | 'CONFIRMED' | 'FAILED';

export interface ExtractedField<T> { value: T; confidence: number; requiresConfirmation: boolean; }
const CONFIRM_THRESHOLD = 0.9;

export function field<T>(value: T, confidence: number): ExtractedField<T> {
  return { value, confidence, requiresConfirmation: confidence < CONFIRM_THRESHOLD };
}

/** Parse Indian-formatted money: "₹1,45,000", "145000.00", "(1,234)" negative. Returns paise. */
export function parseIndianMoney(s: string): number | null {
  if (!s) return null;
  const neg = /^\(.*\)$/.test(s.trim()) || s.trim().startsWith('-');
  const cleaned = s.replace(/[₹,\s()]/g, '').replace(/^-/, '');
  if (!/^\d+(\.\d{1,2})?$/.test(cleaned)) return null;
  const paise = Math.round(parseFloat(cleaned) * 100);
  return neg ? -paise : paise;
}

/** Detect password-protected/corrupt PDFs for friendly errors (§56). */
export function pdfErrorHint(err: unknown): string {
  const msg = String((err as Error)?.message ?? err);
  if (/password|encrypt/i.test(msg)) return 'This PDF appears to be password protected. Try uploading an unlocked copy.';
  if (/damaged|invalid|corrupt/i.test(msg)) return "We couldn't read this PDF — it may be damaged or in an unsupported format. Try a different export (CSV/JSON).";
  return "We couldn't process this file. Possible reasons: unsupported format, damaged file, or empty document.";
}
