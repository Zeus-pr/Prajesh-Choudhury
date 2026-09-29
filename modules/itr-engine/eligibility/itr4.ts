import type { ItrInputs, ItrSuggestion } from '../types';
/** ITR-4 (Sugam): presumptive income u/s 44AD/44ADA/44AE, income ≤ ₹50L, single house property, no other CG complexities. V1 flags only. */
export function evaluateItr4(i: ItrInputs): ItrSuggestion {
  return {
    form: 'ITR-4',
    reasons: i.hasBusinessOrProfession ? ['Potentially eligible if business/profession income is on presumptive basis (s.44AD/44ADA) and other conditions are met.'] : [],
    additionalConditions: ['Presumptive eligibility must be confirmed by the user/CA.'],
  };
}
