/**
 * TaxOS — Versioned tax rules for Tax Year 2026-27 (AY 2027-28).
 *
 * TAX RULE SOURCE POLICY (§14): rules here are transcribed from official
 * Income Tax Department sources. Every rule carries a RuleMeta with
 * source URL + retrieval date. NEVER edit numbers casually; go through the
 * Draft → Review → Source-verified → Tests → Approved → Publish workflow (§50).
 * Historical rule sets are never overwritten — create rules/<next-year>/ instead.
 *
 * Primary sources (verified 2026-09-29):
 *  - CBDT press note on new direct-tax rates effective AY 2027-28
 *    (announced 2025-09-22): https://pib.gov.in/PressNoteDetails.aspx?NoteId=1535228&Lang=1
 *  - Income Tax Department FAQ on new income-tax regime: https://www.incometax.gov.in
 *  - Finance (No. 2) Act, 2025.
 */
import type { SlabRule, RuleMeta } from '../../types';

export const TAX_YEAR = '2026-27';
export const ASSESSMENT_YEAR = 'AY 2027-28';
export const LAW_VERSION = 'Income Tax Act, 1961 as amended by Finance (No. 2) Act 2025 / New Income-tax Act 2025 framework applicable from 2026-27';
export const RULE_SET_VERSION = '2026-27.1';

const SRC = 'https://pib.gov.in/PressNoteDetails.aspx?NoteId=1535228&Lang=1';
const RETRIEVED = '2026-09-29';

function meta(ruleId: string, ref: string): RuleMeta {
  return {
    ruleId,
    taxYear: TAX_YEAR,
    assessmentYear: ASSESSMENT_YEAR,
    lawVersion: LAW_VERSION,
    effectiveFrom: '2026-04-01',
    effectiveTo: '2027-03-31',
    sourceName: 'Income Tax Department / CBDT',
    sourceUrl: SRC,
    sourceReference: ref,
    retrievedOn: RETRIEVED,
    version: RULE_SET_VERSION,
    status: 'PUBLISHED',
  };
}

const L = (rupees: number) => rupees * 100; // paise helper

/** New Regime default slabs — s.115BAC as amended, AY 2027-28.
 *  ₹0–4L nil · 4–8L 5% · 8–12L 10% · 12–16L 15% · 16–20L 20% · 20–24L 25% · >24L 30% */
export const NEW_REGIME_SLABS_GENERAL: SlabRule = {
  meta: meta('SLAB-NEW-2026-27-GENERAL', 's.115BAC(1A) as substituted w.e.f. AY 2027-28'),
  regime: 'NEW',
  ageBand: 'GENERAL',
  bands: [
    { upTo: L(400000), rate: 0 },
    { upTo: L(800000), rate: 0.05 },
    { upTo: L(1200000), rate: 0.10 },
    { upTo: L(1600000), rate: 0.15 },
    { upTo: L(2000000), rate: 0.20 },
    { upTo: L(2400000), rate: 0.25 },
    { upTo: Infinity, rate: 0.30 },
  ],
};

/** Old Regime slabs (Finance Act 2025 rates, unchanged for AY 2027-28).
 *  ₹0–2.5L nil · 2.5–5L 5% · 5–10L 20% · >10L 30%. Seniors ≥60: basic exemption ₹3L; super-seniors ≥80: ₹5L. */
export const OLD_REGIME_SLABS_GENERAL: SlabRule = {
  meta: meta('SLAB-OLD-2026-27-GENERAL', 'First Schedule to the IT Act, individual AOP rates'),
  regime: 'OLD',
  ageBand: 'GENERAL',
  bands: [
    { upTo: L(250000), rate: 0 },
    { upTo: L(500000), rate: 0.05 },
    { upTo: L(1000000), rate: 0.20 },
    { upTo: Infinity, rate: 0.30 },
  ],
};

export const OLD_REGIME_SLABS_SENIOR: SlabRule = {
  ...OLD_REGIME_SLABS_GENERAL,
  meta: meta('SLAB-OLD-2026-27-SENIOR', 's.10(1) third proviso basic exemption ₹3,00,000 (60–80 yrs)'),
  ageBand: 'SENIOR',
  bands: [
    { upTo: L(300000), rate: 0 },
    { upTo: L(500000), rate: 0.05 },
    { upTo: L(1000000), rate: 0.20 },
    { upTo: Infinity, rate: 0.30 },
  ],
};

export const OLD_REGIME_SLABS_SUPER_SENIOR: SlabRule = {
  ...OLD_REGIME_SLABS_GENERAL,
  meta: meta('SLAB-OLD-2026-27-SUPER-SENIOR', 's.10(1) fourth proviso basic exemption ₹5,00,000 (≥80 yrs)'),
  ageBand: 'SUPER_SENIOR',
  bands: [
    { upTo: L(500000), rate: 0 },
    { upTo: L(500000), rate: 0.05 }, // no income falls in band 2; kept explicit
    { upTo: L(1000000), rate: 0.20 },
    { upTo: Infinity, rate: 0.30 },
  ],
};

/** Section 87A rebate — AY 2027-28.
 *  New regime: ₹60,000 rebate for total income ≤ ₹12,00,000.
 *  Old regime: ₹5,000 rebate for taxable income ≤ ₹5,00,000. */
export const REBATE_87A_NEW = {
  meta: meta('REBATE-87A-NEW-2026-27', 's.87A as amended — new regime rebate ₹60,000 up to ₹12 lakh'),
  maxIncome: L(1200000),
  maxRebate: L(60000),
};
export const REBATE_87A_OLD = {
  meta: meta('REBATE-87A-OLD-2026-27', 's.87A — old regime ₹5,000 up to ₹5 lakh'),
  maxIncome: L(500000),
  maxRebate: L(5000),
};

/** Surcharge — unchanged AY 2027-28 (caps also unchanged this year). */
export const SURCHARGE = {
  meta: meta('SURCHARGE-2026-27', 's.92 — marginal-relief caps per CBDT clarification'),
  bands: [
    { upTo: L(5000000), rate: 0 },
    { upTo: L(10000000), rate: 0.10 },
    { upTo: L(20000000), rate: 0.15 },
    { upTo: L(50000000), rate: 0.25 },
    { upTo: Infinity, rate: 0.37 },
  ],
  /** Cap on surcharge for special-rate capital gains income (₹111A/₹112A etc.) */
  capSpecialRate: 0.10,
};

/** Health & Education Cess — 4%. */
export const CESS = {
  meta: meta('CESS-2026-27', 's.88(1)(a) Health and Education Cess @ 4%'),
  rate: 0.04,
};

/** Standard deduction — s.16(ia)/115BAC(1b). New regime: ₹75,000. Old regime: ₹50,000. */
export const STANDARD_DEDUCTION = {
  meta: meta('STD-2026-27', 'Standard deduction: ₹75,000 (new regime) / ₹50,000 (old regime)'),
  newRegime: L(75000),
  oldRegime: L(50000),
};

/** Deduction caps for Chapter VI-A (old regime only). */
export const DEDUCTION_CAPS_OLD = {
  meta: meta('CAPS-VI-A-2026-27', 'Chapter VI-A caps'),
  '80C': L(150000),
  '80CCD1B': L(50000),      // NPS additional
  '80CCD2': L(0),           // employer NPS — 10% of salary (handled separately)
  '80D': L(25000),          // self+family (parents add-on handled in calculator)
  '80D_SENIOR_PARENTS': L(50000),
  '80TTA': L(10000),
  '80TTB': L(50000),        // senior citizens, interest income
  '80G': null,              // varies
  'HOME_LOAN_INTEREST_SELF_OCCUPIED': L(200000), // s.24(b)
};

/** Capital-gains rates — AY 2027-28 (post July-2024 amendment, unchanged). */
export const CAPITAL_GAINS_RULES = {
  meta: meta('CG-2026-27', 'ss.111A, 112, 112A as amended by Finance (No.2) Act 2024'),
  stcg111A: { rate: 0.20, holdingPeriodDays: 12, appliesTo: 'listed equity/equity MF/ETF units & units specified u/s 115BA(4)/115BB(4)' },
  ltcg112A: { rate: 0.125, exemptLimit: L(125000), holdingPeriodDays: 12, appliesTo: 'listed equity/ETF units, equity mutual funds' },
  ltcg112NoIndexation: { rate: 0.125, appliesTo: 'other assets held > 24 months (debt MFs, property etc.)' },
  stcgSlab: { appliesTo: 'assets with holding period ≤ 24 months not covered by 111A' },
};

/** New-regime partial deductions (§12/§13): only standard deduction (salaried),
 *  employer NPS 80CCD(2), and Agnipath pension components are allowed. */
export const NEW_REGIME_ALLOWED_DEDUCTIONS = ['StandardDeduction', '80CCD2_EMPLOYER', 'AGNIPATH_PENSION'];

export const SLAB_TABLES: SlabRule[] = [
  NEW_REGIME_SLABS_GENERAL,
  OLD_REGIME_SLABS_GENERAL,
  OLD_REGIME_SLABS_SENIOR,
  OLD_REGIME_SLABS_SUPER_SENIOR,
];
