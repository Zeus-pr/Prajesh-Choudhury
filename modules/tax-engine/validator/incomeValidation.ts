import type { IncomeInput } from '../types';

export interface ValidationIssue { field: string; severity: 'ERROR' | 'WARN'; message: string; }

export function validateIncomes(incomes: IncomeInput[]): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  for (const i of incomes) {
    if (!Number.isFinite(i.amount)) issues.push({ field: i.category, severity: 'ERROR', message: 'Amount must be a finite number (paise).' });
    if (i.amount < 0 && !i.category.startsWith('CAPITAL_GAINS')) issues.push({ field: i.category, severity: 'ERROR', message: 'Only capital-gain categories may be negative (losses).' });
    if (!i.source) issues.push({ field: i.category, severity: 'WARN', message: 'No source recorded — figure will be flagged as unverified in the dashboard.' });
  }
  return issues;
}
