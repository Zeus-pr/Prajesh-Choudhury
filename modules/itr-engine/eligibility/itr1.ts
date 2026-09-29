import type { ItrInputs, ItrSuggestion } from '../types';
/** ITR-1 (Sahaj): resident individual, income ≤ ₹50L, salary + one house property + other sources. No CG, business, foreign assets, director, unlisted shares. */
export function evaluateItr1(i: ItrInputs): ItrSuggestion {
  const blockers: string[] = [];
  if (!i.isResident) blockers.push('Non-resident');
  if (i.totalIncomePaise > 5_000_000_00) blockers.push('Total income exceeds ₹50 lakh');
  if (i.hasCapitalGains) blockers.push('Capital gains present');
  if (i.hasBusinessOrProfession) blockers.push('Business/professional income present');
  if (i.isDirector || i.holdsUnlistedShares) blockers.push('Directorship or unlisted shares');
  if (i.hasForeignAssetsOrIncome) blockers.push('Foreign assets/income');
  if (i.hasMoreThanOneHouseProperty) blockers.push('More than one house property');
  return {
    form: 'ITR-1',
    reasons: blockers.length === 0 ? ['Salary and simple other income within ITR-1 limits'] : [],
    additionalConditions: blockers,
  };
}
