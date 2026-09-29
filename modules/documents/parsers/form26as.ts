/** Form 26AS parser (§16). Normalizes into TaxCredit records.
 *  Note: from AY 2023-24, 26AS primarily shows TDS/TCS; broader info lives in AIS — do not treat as equivalent. */
import { parseIndianMoney } from './common';

export interface TaxCredit {
  source: 'FORM_26AS';
  deductor: string;
  tan?: string;
  section: string;          // 192, 194A, 194I, 206C ...
  transactionDate?: string;
  amountPaidOrCreditedPaise: number;
  tdsCreditedPaise: number;
  isTCS: boolean;
  confidence: number;
}

const SECTION_RE = /\b(19[2-9][A-Z]?|194[A-Z](?:\([0-9]\))?|206C(?:\([0-9A-Z]+\))?|194IA|194LB|194O|194Q|194R|194S|194T)\b/;

/** Parse the tabular text layout of a 26AS statement (PDF text or HTML-to-text). */
export function parse26ASText(text: string): TaxCredit[] {
  const out: TaxCredit[] = [];
  const lines = text.split('\n');
  for (const line of lines) {
    const sec = line.match(SECTION_RE);
    if (!sec) continue;
    // Expect: date | deductor | amount | tax | (optional interest)
    const nums = [...line.matchAll(/(?:₹|Rs\.?)?\s?[\d,]+(?:\.\d{2})?/g)]
      .map(m => parseIndianMoney(m[0]))
      .filter((n): n is number => n !== null && n > 0);
    if (nums.length < 2) continue;
    const dateM = line.match(/(\d{2}[\/-]\d{2}[\/-]\d{2,4})/);
    const deductorM = line.match(/[A-Za-z][A-Za-z .,&'-]{6,60}/);
    out.push({
      source: 'FORM_26AS',
      deductor: deductorM?.[0]?.trim() ?? 'Unknown deductor',
      section: sec[1],
      transactionDate: dateM?.[1],
      amountPaidOrCreditedPaise: nums[0],
      tdsCreditedPaise: nums[1],
      isTCS: sec[1].startsWith('206'),
      confidence: 0.75,
    });
  }
  return out;
}

export function totalTaxCredits(credits: TaxCredit[]): number {
  return credits.reduce((s, c) => s + c.tdsCreditedPaise, 0);
}
