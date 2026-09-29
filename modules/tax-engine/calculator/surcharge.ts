import type { Paise } from '../types';
import { SURCHARGE } from '../rules/2026-27';

/** s.92 surcharge on income-tax, levied at the rate of the applicable income band.
 *  V1 scope (salaried individuals) has no special-rate CG surcharge cap handling here;
 *  high-income (>₹50L) cases surface a NEEDS_REVIEW flag in validators. */
export function computeSurcharge(totalIncome: Paise, taxBeforeSurcharge: Paise): { surcharge: Paise; rate: number; ruleId: string } {
  const bands = SURCHARGE.bands;
  let rate = 0;
  for (const b of bands) { if (totalIncome <= b.upTo) { rate = b.rate; break; } }
  return { surcharge: Math.floor(taxBeforeSurcharge * rate), rate, ruleId: SURCHARGE.meta.ruleId };
}
