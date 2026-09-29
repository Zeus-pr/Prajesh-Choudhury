import type { DeductionInput, TaxRegime } from '../types';
import { NEW_REGIME_ALLOWED_DEDUCTIONS } from '../rules/2026-27';

export function validateRegimeDeductions(regime: TaxRegime, deductions: DeductionInput[]) {
  const out: { section: string; allowed: boolean; note: string }[] = [];
  for (const d of deductions) {
    const allowed = regime === 'OLD' || NEW_REGIME_ALLOWED_DEDUCTIONS.includes(d.section);
    out.push({ section: d.section, allowed, note: allowed ? '' : `${d.section} is not available under the default new regime (§12). It has been excluded from the new-regime calculation.` });
  }
  return out;
}
