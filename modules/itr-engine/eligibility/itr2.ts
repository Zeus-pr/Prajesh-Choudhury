import type { ItrInputs, ItrSuggestion } from '../types';
/** ITR-2: individuals/HUF with capital gains, more than one house property, foreign assets, director/unlisted shares; no business income. */
export function evaluateItr2(i: ItrInputs): ItrSuggestion {
  const reasons: string[] = [];
  if (i.hasCapitalGains) reasons.push('Capital gains detected.');
  if (i.hasMoreThanOneHouseProperty) reasons.push('More than one house property.');
  if (i.isDirector || i.holdsUnlistedShares) reasons.push('Directorship or unlisted equity shares require ITR-2.');
  if (i.hasForeignAssetsOrIncome) reasons.push('Foreign assets/income disclosure required.');
  if (!i.isResident) reasons.push('Non-residents cannot use ITR-1.');
  if (i.totalIncomePaise > 5_000_000_00) reasons.push('Total income above ₹50 lakh.');
  const blockers: string[] = [];
  if (i.hasBusinessOrProfession) blockers.push('Business/professional income requires ITR-3/ITR-4 instead.');
  return { form: 'ITR-2', reasons, additionalConditions: blockers };
}
