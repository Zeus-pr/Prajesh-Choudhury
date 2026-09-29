export interface ItrInputs {
  hasSalary: boolean;
  hasHouseProperty: boolean;
  hasCapitalGains: boolean;
  hasBusinessOrProfession: boolean;      // incl. freelance treated as profession income requiring ITR-3 in complex cases
  isDirector: boolean;
  holdsUnlistedShares: boolean;
  hasForeignAssetsOrIncome: boolean;
  hasMoreThanOneHouseProperty: boolean;
  totalIncomePaise: number;
  isResident: boolean;
}
export interface ItrSuggestion { form: string; reasons: string[]; additionalConditions: string[]; }
