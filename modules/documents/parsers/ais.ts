/** AIS parser (§15). Supports the official AIS JSON download schema plus tabular PDF text fallback. */
import { parseIndianMoney } from './common';

export interface AISRecord {
  source: 'AIS';
  informationType: string;      // SALARY | INTEREST | DIVIDEND | SECURITIES | TDS | UNKNOWN ...
  description: string;
  amountPaise: number;
  date?: string;
  counterparty?: string;
  section?: string;             // TDS section e.g. 192, 194A
  confidence: number;
}

export interface AISSummary { records: AISRecord[]; recordCount: number; needsReview: number; totalsByCategory: Record<string, number>; }

interface RawTxn {
  Date?: string; Description?: string; GrossAmount?: string; Section?: string; TAN?: string;
  Deductor?: { deductor?: { legalName?: string } };
}
interface RawAISJson {
  AnnualInformationStatement?: {
    taxpayerInformation?: { name?: string; pan?: string };
    annualIncomeSummary?: {
      salaryIncome?: string;
      incomeFromOtherSources?: { interest?: string; dividend?: string };
      capitalGains?: { longTerm?: string; shortTerm?: string };
    };
    transactionInformation?: RawTxn[];
    taxCreditSummary?: unknown[];
  };
}

export function parseAISJson(json: unknown): AISRecord[] {
  const out: AISRecord[] = [];
  const stmt = (json as RawAISJson)?.AnnualInformationStatement;
  if (!stmt) throw new Error('Unrecognised AIS JSON structure — expected an "AnnualInformationStatement" root object. If you uploaded a PDF, use the PDF import path.');
  const add = (informationType: string, rupeesStr: string | undefined, description: string) => {
    if (!rupeesStr) return;
    const amt = parseIndianMoney(rupeesStr) ?? Math.round(Number(rupeesStr) * 100);
    if (!Number.isFinite(amt) || amt === 0) return;
    out.push({ source: 'AIS', informationType, description, amountPaise: amt, confidence: 0.99 });
  };
  const summary = stmt.annualIncomeSummary;
  add('SALARY', summary?.salaryIncome, 'Salary income per AIS');
  add('INTEREST', summary?.incomeFromOtherSources?.interest, 'Interest income per AIS');
  add('DIVIDEND', summary?.incomeFromOtherSources?.dividend, 'Dividends per AIS');
  add('CAPITAL_GAINS_LTCG', summary?.capitalGains?.longTerm, 'Long-term capital gains per AIS');
  add('CAPITAL_GAINS_STCG', summary?.capitalGains?.shortTerm, 'Short-term capital gains per AIS');
  for (const t of stmt.transactionInformation ?? []) {
    const amt = t.GrossAmount ? (parseIndianMoney(String(t.GrossAmount)) ?? Math.round(Number(t.GrossAmount) * 100)) : NaN;
    if (!Number.isFinite(amt)) continue;
    out.push({
      source: 'AIS',
      informationType: classifyTxn(t.Description ?? ''),
      description: t.Description ?? 'AIS transaction',
      amountPaise: amt,
      date: t.Date,
      counterparty: t.Deductor?.deductor?.legalName,
      section: t.Section,
      confidence: 0.95,
    });
  }
  return out;
}

export function classifyTxn(desc: string): string {
  const d = desc.toLowerCase();
  if (/salary|stipend|wages/.test(d)) return 'SALARY';
  if (/dividend/.test(d)) return 'DIVIDEND';
  if (/interest/.test(d)) return 'INTEREST';
  if (/sale of|securities|shares|mutual fund/.test(d)) return 'SECURITIES';
  if (/tds|tax deducted/.test(d)) return 'TDS';
  return 'UNKNOWN';
}

/** Tabular AIS PDF text fallback: lines like "Interest on bank deposits 42500". Low confidence → review required. */
export function parseAISText(text: string): AISRecord[] {
  const recs: AISRecord[] = [];
  for (const line of text.split('\n')) {
    const m = line.match(/^(.{4,60}?)\s+((?:₹|Rs\.?)?\s?[\d,]+(?:\.\d{2})?)\s*$/);
    if (!m) continue;
    const amt = parseIndianMoney(m[2]);
    if (amt === null || amt === 0) continue;
    recs.push({ source: 'AIS', informationType: classifyTxn(m[1]), description: m[1].trim(), amountPaise: amt, confidence: 0.6 });
  }
  return recs;
}

export function summarizeAIS(records: AISRecord[]): AISSummary {
  const totals: Record<string, number> = {};
  let needsReview = 0;
  for (const r of records) {
    totals[r.informationType] = (totals[r.informationType] ?? 0) + r.amountPaise;
    if (r.confidence < 0.9) needsReview++;
  }
  return { records, recordCount: records.length, needsReview, totalsByCategory: totals };
}
