import type { TaxPaymentInput, Paise } from '../types';

export interface TaxCredits { tds: Paise; tcs: Paise; advanceTax: Paise; selfAssessmentTax: Paise; total: Paise; }

export function aggregatePayments(payments: TaxPaymentInput[]): TaxCredits {
  const c: TaxCredits = { tds: 0, tcs: 0, advanceTax: 0, selfAssessmentTax: 0, total: 0 };
  for (const p of payments) {
    switch (p.type) {
      case 'TDS': c.tds += p.amount; break;
      case 'TCS': c.tcs += p.amount; break;
      case 'ADVANCE_TAX': c.advanceTax += p.amount; break;
      case 'SELF_ASSESSMENT': c.selfAssessmentTax += p.amount; break;
    }
  }
  c.total = c.tds + c.tcs + c.advanceTax + c.selfAssessmentTax;
  return c;
}
