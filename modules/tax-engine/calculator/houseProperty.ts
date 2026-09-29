import type { Paise } from '../types';
import { DEDUCTION_CAPS_OLD } from '../rules/2026-27';

/** Basic-level house property (V1): annual value less 30% statutory deduction (s.24(a))
 *  and interest on housing loan capped at ₹2L for self-occupied (s.24(b)). */
export function housePropertyIncome(input: {
  grossAnnualValue: Paise;         // letable value or 0 for self-occupied
  municipalTaxes: Paise;
  isSelfOccupied: boolean;
  homeLoanInterest: Paise;
}): { taxable: Paise; interestDeduction: Paise } {
  const netAfterTaxes = Math.max(0, input.grossAnnualValue - input.municipalTaxes);
  const statutory = Math.floor(netAfterTaxes * 0.3);
  let interest = 0;
  if (input.isSelfOccupied) {
    interest = Math.min(input.homeLoanInterest, DEDUCTION_CAPS_OLD.HOME_LOAN_INTEREST_SELF_OCCUPIED);
    return { taxable: Math.max(-200000 * 100, 0 - interest), interestDeduction: interest }; // loss u/hp capped only by set-off rules downstream
  }
  interest = Math.min(input.homeLoanInterest, DEDUCTION_CAPS_OLD.HOME_LOAN_INTEREST_SELF_OCCUPIED);
  return { taxable: netAfterTaxes - statutory - interest, interestDeduction: interest };
}
