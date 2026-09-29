/** Deduction applicability & caps (§13). New regime allows only a narrow set (§12). */
import type { DeductionInput, Paise, TaxRegime } from '../types';
import { DEDUCTION_CAPS_OLD, NEW_REGIME_ALLOWED_DEDUCTIONS } from '../rules/2026-27';

export interface AppliedDeduction extends DeductionInput { ruleId: string; }

export function applyDeductions(regime: TaxRegime, deductions: DeductionInput[]): AppliedDeduction[] {
  const out: AppliedDeduction[] = [];
  for (const d of deductions) {
    if (regime === 'NEW' && !NEW_REGIME_ALLOWED_DEDUCTIONS.includes(d.section)) continue; // not allowed
    let amount = Math.max(0, d.amount);
    let capApplied = false;
    const cap = (DEDUCTION_CAPS_OLD as Record<string, Paise | null>)[d.section];
    if (typeof cap === 'number' && cap >= 0 && amount > cap) { amount = cap; capApplied = true; }
    out.push({ ...d, amount, capApplied, ruleId: DEDUCTION_CAPS_OLD.meta.ruleId });
  }
  return out;
}

export function totalDeductions(applied: AppliedDeduction[]): Paise {
  return applied.reduce((s, d) => s + d.amount, 0);
}
