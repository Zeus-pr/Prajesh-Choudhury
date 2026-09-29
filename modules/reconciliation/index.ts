/**
 * Reconciliation Engine (§23, §53, §54).
 * Deterministic matching first. AI may suggest but never silently merges (§53).
 */
export type ReconStatus = 'MATCHED' | 'DUPLICATE' | 'MISSING' | 'CONFLICT' | 'NEEDS_REVIEW' | 'USER_CONFIRMED';

export interface FinancialRecord {
  id: string;
  user_id: string;
  tax_year: string;
  source: string;               // AIS | FORM_16 | FORM_26AS | BANK | BROKER | MF | MANUAL
  source_record_id: string;     // immutable original record id (§36)
  category: string;             // SALARY | INTEREST | DIVIDEND | CAPITAL_GAINS | TDS ...
  amount_paise: number;
  currency: string;
  transaction_date?: string;
  confidence: number;           // 0..1
  status: ReconStatus;
  isin?: string;
  reference?: string;
}

export interface ReconGroup {
  category: string;
  records: FinancialRecord[];
  status: ReconStatus;
  differencePaise: number;
  explanation: string;
  action: string;
}

/** Group records by category and compare amounts across sources. Never declares a winner (§54). */
export function reconcile(records: FinancialRecord[]): ReconGroup[] {
  const byCat = new Map<string, FinancialRecord[]>();
  for (const r of records) {
    const arr = byCat.get(r.category) ?? [];
    arr.push(r); byCat.set(r.category, arr);
  }
  const groups: ReconGroup[] = [];
  for (const [category, recs] of byCat) {
    const amounts = recs.map(r => r.amount_paise);
    const min = Math.min(...amounts), max = Math.max(...amounts);
    const diff = max - min;
    let status: ReconStatus; let explanation = ''; let action = '';
    if (recs.length === 0) { status = 'MISSING'; explanation = 'No source reports this category.'; action = 'Add information or mark as not applicable.'; }
    else if (recs.length === 1) { status = 'NEEDS_REVIEW'; explanation = `Only one source (${recs[0].source}) reports ${category}.`; action = 'Confirm the figure or upload a second source.'; }
    else if (diff === 0) { status = 'MATCHED'; explanation = `${recs.length} sources agree on the amount.`; action = 'None required.'; }
    else if (isDuplicateCandidate(recs)) { status = 'DUPLICATE'; explanation = `Same ${category} appears in multiple sources with equal amount — likely the same income reported twice.`; action = 'Merge to avoid double counting.'; }
    else { status = 'CONFLICT'; explanation = `Potential mismatch between sources: difference ₹${(diff / 100).toLocaleString('en-IN')}.`; action = 'Review both sources and choose the correct treatment. TaxOS will not decide for you.'; }
    groups.push({ category, records: recs, status, differencePaise: diff, explanation, action });
  }
  return groups;
}

/** Same amount + same period from different sources → duplicate candidate (§20/§53). */
export function isDuplicateCandidate(recs: FinancialRecord[]): boolean {
  if (recs.length < 2) return false;
  const allEqual = recs.every(r => r.amount_paise === recs[0].amount_paise);
  const distinctSources = new Set(recs.map(r => r.source)).size >= 2;
  return allEqual && distinctSources;
}

/** Deterministic dedup key: date+amount+category+isin/reference. */
export function dedupeKey(r: Pick<FinancialRecord, 'category' | 'amount_paise' | 'transaction_date' | 'isin' | 'reference'>): string {
  return [r.category, r.amount_paise, r.transaction_date ?? '', r.isin ?? '', r.reference ?? ''].join('|');
}

export function findDuplicates(records: FinancialRecord[]): Map<string, FinancialRecord[]> {
  const m = new Map<string, FinancialRecord[]>();
  for (const r of records) {
    const k = dedupeKey(r);
    m.set(k, [...(m.get(k) ?? []), r]);
  }
  for (const [k, v] of m) if (v.length < 2) m.delete(k);
  return m;
}
