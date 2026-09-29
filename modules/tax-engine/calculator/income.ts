import type { IncomeInput, Paise } from '../types';

export const ORDINARY_CATEGORIES = new Set<string>([
  'SALARY', 'PENSION', 'HOUSE_PROPERTY', 'INTEREST_SAVINGS', 'INTEREST_FD',
  'DIVIDEND', 'OTHER_INTEREST', 'OTHER_SOURCE', 'FREELANCE',
]);

export function isCapitalGain(cat: string) { return cat.startsWith('CAPITAL_GAINS'); }

export function totalIncome(incomes: IncomeInput[]): Paise {
  return incomes.reduce((s, i) => s + i.amount, 0);
}

export function ordinaryIncome(incomes: IncomeInput[]): Paise {
  return incomes.filter(i => ORDINARY_CATEGORIES.has(i.category)).reduce((s, i) => s + Math.max(0, i.amount), 0);
}
