import type { Paise } from '../types';
import { STANDARD_DEDUCTION } from '../rules/2026-27';
import type { TaxRegime } from '../types';

/** Standard deduction on salary/pension income per regime (§13 salary.ts). */
export function standardDeduction(regime: TaxRegime, grossSalary: Paise): { amount: Paise; ruleId: string } {
  const cap = regime === 'NEW' ? STANDARD_DEDUCTION.newRegime : STANDARD_DEDUCTION.oldRegime;
  return {
    amount: Math.min(cap, grossSalary),
    ruleId: STANDARD_DEDUCTION.meta.ruleId,
  };
}
