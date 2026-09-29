import type { Paise, TaxRegime } from '../types';
import { REBATE_87A_NEW, REBATE_87A_OLD } from '../rules/2026-27';

/** Section 87A rebate. New regime AY 2027-28: up to ₹60,000 if total income ≤ ₹12,00,000.
 *  Old regime: up to ₹5,000 if taxable income ≤ ₹5,00,000.
 *  Rebate limits tax computed on ordinary (slab-rate) income; special-rate CG tax is outside its scope. */
export function rebate87A(regime: TaxRegime, qualifyingIncome: Paise, slabTaxBeforeRebate: Paise): { rebate: Paise; ruleId: string } {
  const r = regime === 'NEW' ? REBATE_87A_NEW : REBATE_87A_OLD;
  if (!r || qualifyingIncome <= r.maxIncome) {
    return { rebate: Math.min(r.maxRebate, Math.max(0, slabTaxBeforeRebate)), ruleId: r.meta.ruleId };
  }
  return { rebate: 0, ruleId: r.meta.ruleId };
}
