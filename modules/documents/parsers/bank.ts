/** Bank statement import (§18). CSV/XLSX/PDF-text. NEVER assume every credit is taxable income (§18/§19). */
import { parse } from 'csv-parse/sync';
import { parseIndianMoney } from './common';

export type BankClass = 'SALARY' | 'INTEREST' | 'DIVIDEND' | 'RENT' | 'TRANSFER' | 'INVESTMENT' | 'UNKNOWN';

export interface BankTransaction {
  date: string;
  narration: string;
  debitPaise: number;
  creditPaise: number;
  balancePaise?: number;
  accountRef?: string;
  classification: BankClass;
  /** Credits classified TRANSFER/UNKNOWN are NOT counted as income until confirmed (§18). */
  taxTreatmentNote: string;
  confidence: number;
}

export function classifyNarration(narration: string, direction: 'CREDIT' | 'DEBIT'): { cls: BankClass; note: string; confidence: number } {
  const n = narration.toLowerCase();
  if (/salary|stipend|payroll/.test(n)) return { cls: 'SALARY', note: 'Likely salary — verify against Form 16.', confidence: 0.85 };
  if (/interest.*(saving|deposit|account)|int\.|paid-up interest/.test(n)) return { cls: 'INTEREST', note: 'Interest income — taxable under Other Sources (savings interest may qualify for s.80TTA).', confidence: 0.85 };
  if (/dividend/.test(n)) return { cls: 'DIVIDEND', note: 'Dividend income — taxable at slab rates.', confidence: 0.9 };
  if (/rent/.test(n) && direction === 'CREDIT') return { cls: 'RENT', note: 'Rental receipt — may be taxable under House Property.', confidence: 0.7 };
  if (/transfer|neft|imps|upi.*self|to self|from self|own a\/c/.test(n)) return { cls: 'TRANSFER', note: 'Internal transfer — not automatically income. Confirm before treating as taxable.', confidence: 0.6 };
  if (/sip|mutual fund|shares|buy\s*\d|purchase/.test(n)) return { cls: 'INVESTMENT', note: 'Investment outflow — not an expense deduction by itself.', confidence: 0.65 };
  return { cls: 'UNKNOWN', note: direction === 'CREDIT' ? 'Possible classification: internal transfer / repayment / gift. Not automatically income — confirm.' : 'Unclassified debit.', confidence: 0.3 };
}

const DATE_RE = /^(\d{4}-\d{2}-\d{2}|\d{2}[\/-]\d{2}[\/-]\d{2,4})$/;

export function parseBankCsv(content: string): BankTransaction[] {
  let rows: string[][];
  try {
    rows = parse(content, { skip_empty_lines: true, relax_column_count: true }) as string[][];
  } catch {
    throw new Error("We couldn't read this CSV. Possible reasons: wrong delimiter, binary file, or damaged export. Try re-downloading the statement.");
  }
  if (!rows.length) return [];
  const header = rows[0].map(h => h.toLowerCase().trim());
  const idx = (names: string[]) => header.findIndex(h => names.some(n => h.includes(n)));
  const di = idx(['date', 'txn date', 'value date']);
  const ni = idx(['narration', 'description', 'details', 'remarks']);
  const dri = idx(['debit', 'withdrawal', 'dr']);
  const cri = idx(['credit', 'deposit', 'cr']);
  const bi = idx(['balance']);
  const ai = idx(['account']);
  if (di < 0 || (dri < 0 && cri < 0)) {
    throw new Error("This CSV doesn't look like a bank statement — we need at least Date and Debit/Credit columns. Upload the transaction-level export, not a summary.");
  }
  const out: BankTransaction[] = [];
  for (const r of rows.slice(1)) {
    const date = r[di]?.trim();
    if (!date || !DATE_RE.test(date)) continue;
    const narration = (ni >= 0 ? r[ni] : '') ?? '';
    const debit = dri >= 0 ? parseIndianMoney(r[dri] ?? '') ?? 0 : 0;
    const credit = cri >= 0 ? parseIndianMoney(r[cri] ?? '') ?? 0 : 0;
    const dir = credit > 0 ? 'CREDIT' : 'DEBIT';
    const { cls, note, confidence } = classifyNarration(narration, dir);
    out.push({
      date, narration, debitPaise: debit, creditPaise: credit,
      balancePaise: bi >= 0 ? parseIndianMoney(r[bi] ?? '') ?? undefined : undefined,
      accountRef: ai >= 0 ? r[ai] : undefined,
      classification: cls, taxTreatmentNote: note, confidence,
    });
  }
  return out;
}

/** Total INTEREST credits — only confidently-classified amounts feed the tax engine after user confirmation. */
export function detectedInterest(txns: BankTransaction[]): number {
  return txns.filter(t => t.classification === 'INTEREST').reduce((s, t) => s + t.creditPaise, 0);
}
