import type { ItrInputs, ItrSuggestion } from '../types';
/** ITR-3: business/professional income (incl. complex freelance) plus the ITR-2 categories. */
export function evaluateItr3(i: ItrInputs): ItrSuggestion {
  const reasons: string[] = [];
  if (i.hasBusinessOrProfession) reasons.push('Business or professional income present.');
  return { form: 'ITR-3', reasons, additionalConditions: reasons.length ? ['Presumptive taxation may allow ITR-4 — review.'] : [] };
}
