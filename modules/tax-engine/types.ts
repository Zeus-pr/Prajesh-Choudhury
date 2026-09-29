/**
 * TaxOS — Tax Engine shared types.
 * All monetary values are stored in integer paise to avoid floating-point drift.
 */

export type Paise = number;

export type TaxRegime = 'NEW' | 'OLD';

export type IncomeCategory =
  | 'SALARY'
  | 'PENSION'
  | 'HOUSE_PROPERTY'
  | 'CAPITAL_GAINS_STCG_111A'   // Listed equity/ETF STCG u/s 111A (20% AY26-27)
  | 'CAPITAL_GAINS_LTCG_112A'   // Equity LTCG u/s 112A (>₹1.25L exempt, 12.5%)
  | 'CAPITAL_GAINS_STCG_111A_20' // Other short-term @ slab (111A only covers listed equity)
  | 'CAPITAL_GAINS_LTCG_112'    // Debt/other LTCG without indexation @12.5%
  | 'CAPITAL_GAINS_SLAB'        // Gains taxed at applicable slab rates
  | 'INTEREST_SAVINGS'
  | 'INTEREST_FD'
  | 'DIVIDEND'
  | 'OTHER_INTEREST'
  | 'OTHER_SOURCE'
  | 'FREELANCE';

export interface RuleMeta {
  ruleId: string;
  taxYear: string;          // e.g. "2026-27"
  assessmentYear: string;   // e.g. "AY 2027-28"
  lawVersion: string;       // e.g. "IT Act 1961" | "New IT Act 2025"
  effectiveFrom: string;    // ISO date
  effectiveTo?: string;     // ISO date
  sourceName: string;
  sourceUrl: string;
  sourceReference: string;
  retrievedOn: string;      // date rule text was verified against source
  version: string;          // rule-set version
  status: 'DRAFT' | 'REVIEW' | 'APPROVED' | 'PUBLISHED';
}

export interface SlabRule {
  meta: RuleMeta;
  regime: TaxRegime;
  ageBand: 'GENERAL' | 'SENIOR' | 'SUPER_SENIOR';
  /** Upper bound of each slab band in paise; Infinity for the last. */
  bands: { upTo: number; rate: number }[];
}

export interface IncomeInput {
  category: IncomeCategory;
  amount: Paise;              // positive income; negative for losses (capital gains only)
  description?: string;
  source?: string;            // e.g. "Form 16", "AIS"
  tdsOnIt?: Paise;
}

export interface DeductionInput {
  section: string;            // e.g. "80C", "80D", "80CCD(1B)", "StandardDeduction", "24b"
  label: string;
  amount: Paise;
  capApplied?: boolean;
}

export interface TaxpayerProfile {
  age: number;
  isResident: boolean;
  state?: string;
}

export interface TaxPaymentInput {
  type: 'TDS' | 'TCS' | 'ADVANCE_TAX' | 'SELF_ASSESSMENT';
  amount: Paise;
  source?: string;
  reference?: string;
}

export interface CalculationLine {
  category: string;
  description: string;
  baseAmount: Paise;
  rate: number | null;        // fraction, e.g. 0.125; null for non-rate lines
  taxAmount: Paise;
  source: string;             // where the input came from
  ruleId: string;             // which rule produced this line
}

export interface TaxCalculation {
  taxYear: string;
  lawVersion: string;
  ruleVersion: string;
  regime: TaxRegime;
  grossIncome: Paise;                 // total income (all heads)
  deductions: Paise;                  // aggregate deductions applied
  taxableIncome: Paise;               // ordinary-income taxable base after deductions
  specialRateTax: Paise;              // tax on capital gains @ special rates
  slabTax: Paise;                     // tax on ordinary income @ slabs
  rebate: Paise;                      // s.87A rebate
  surcharge: Paise;
  cess: Paise;
  totalTax: Paise;                    // liability before credits
  tds: Paise;
  tcs: Paise;
  advanceTax: Paise;
  selfAssessmentTax: Paise;
  refundOrPayable: Paise;             // positive => payable, negative => refund
  lines: CalculationLine[];
  calculatedAt: string;
}
