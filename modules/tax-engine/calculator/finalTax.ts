/**
 * Deterministic end-to-end tax computation (§13, §81). AI never computes anything (§62).
 * Produces a fully explainable TaxCalculation with per-line rule references.
 */
import type { IncomeInput, DeductionInput, TaxpayerProfile, TaxPaymentInput, TaxRegime, TaxCalculation, CalculationLine, Paise } from '../types';
import { TAX_YEAR, ASSESSMENT_YEAR, LAW_VERSION, RULE_SET_VERSION, NEW_REGIME_SLABS_GENERAL, OLD_REGIME_SLABS_GENERAL, OLD_REGIME_SLABS_SENIOR, OLD_REGIME_SLABS_SUPER_SENIOR, CAPITAL_GAINS_RULES } from '../rules/2026-27';
import { ordinaryIncome, totalIncome } from './income';
import { standardDeduction } from './salary';
import { applyDeductions, totalDeductions } from './deductions';
import { computeCapitalGains } from './capitalGains';
import { rebate87A } from './rebate';
import { computeSurcharge } from './surcharge';
import { computeCess } from './cess';
import { aggregatePayments } from './tds';

export interface CalcRequest {
  regime: TaxRegime;
  incomes: IncomeInput[];
  deductions: DeductionInput[];   // excluding standard deduction (auto-applied for salary/pension)
  taxpayer: TaxpayerProfile;
  payments: TaxPaymentInput[];
}

function slabBandsFor(regime: TaxRegime, age: number) {
  if (regime === 'NEW') return NEW_REGIME_SLABS_GENERAL;
  if (age >= 80) return OLD_REGIME_SLABS_SUPER_SENIOR;
  if (age >= 60) return OLD_REGIME_SLABS_SENIOR;
  return OLD_REGIME_SLABS_GENERAL;
}

/** Progressive slab tax over ordinary income. Returns tax + per-band lines. */
export function computeSlabTax(taxable: Paise, regime: TaxRegime, age: number): { tax: Paise; lines: CalculationLine[] } {
  const rule = slabBandsFor(regime, age);
  const lines: CalculationLine[] = [];
  let tax = 0, prev = 0;
  for (const b of rule.bands) {
    const upper = Math.min(b.upTo, taxable);
    if (upper > prev) {
      const amt = Math.floor((upper - prev) * b.rate);
      tax += amt;
      lines.push({
        category: 'SLAB_TAX',
        description: `${(prev / 100).toLocaleString('en-IN')} to ${(b.upTo === Infinity ? '∞' : (b.upTo / 100).toLocaleString('en-IN'))} @ ${Math.round(b.rate * 100)}%`,
        baseAmount: upper - prev, rate: b.rate, taxAmount: amt,
        source: 'tax-engine', ruleId: rule.meta.ruleId,
      });
    }
    if (b.upTo >= taxable) break;
    prev = b.upTo;
  }
  return { tax, lines };
}

export function calculateTax(req: CalcRequest): TaxCalculation {
  const lines: CalculationLine[] = [];
  const gross = totalIncome(req.incomes);
  const ord = ordinaryIncome(req.incomes);

  // Standard deduction (auto for salaried/pension)
  const salaryLike = req.incomes.filter(i => i.category === 'SALARY' || i.category === 'PENSION').reduce((s, i) => s + Math.max(0, i.amount), 0);
  let deductionsTotal: Paise = 0;
  if (salaryLike > 0) {
    const sd = standardDeduction(req.regime, salaryLike);
    deductionsTotal += sd.amount;
    lines.push({ category: 'DEDUCTION', description: 'Standard deduction', baseAmount: sd.amount, rate: null, taxAmount: 0, source: 'salary/pension', ruleId: sd.ruleId });
  }
  const applied = applyDeductions(req.regime, req.deductions);
  for (const d of applied) {
    deductionsTotal += d.amount;
    lines.push({ category: 'DEDUCTION', description: `${d.section} — ${d.label}${d.capApplied ? ' (capped)' : ''}`, baseAmount: d.amount, rate: null, taxAmount: 0, source: d.section, ruleId: d.ruleId });
  }

  // Capital gains split out of ordinary income
  const cg = computeCapitalGains(req.incomes);
  const slabGross = Math.max(0, ord - cg.slabGains);
  const taxableOrdinary = Math.max(0, slabGross - deductionsTotal);

  // Ordinary slab tax
  const slabRes = computeSlabTax(taxableOrdinary, req.regime, req.taxpayer.age);
  for (const l of slabRes.lines) lines.push(l);

  // Special-rate capital gains tax
  let specialTax = 0;
  if (cg.stcg111A > 0) {
    const t = Math.floor(cg.stcg111A * CAPITAL_GAINS_RULES.stcg111A.rate);
    specialTax += t;
    lines.push({ category: 'CG_111A', description: 'STCG listed equity u/s 111A @ 20%', baseAmount: cg.stcg111A, rate: 0.20, taxAmount: t, source: 'capital-gains', ruleId: CAPITAL_GAINS_RULES.meta.ruleId });
  }
  if (cg.ltcg112A > 0) {
    const t = Math.floor(cg.ltcg112A * CAPITAL_GAINS_RULES.ltcg112A.rate);
    specialTax += t;
    lines.push({ category: 'CG_112A', description: `LTCG equity u/s 112A @ 12.5% (after ₹1.25L exemption${cg.exempt112A ? `, exempt ${cg.exempt112A / 100}` : ''})`, baseAmount: cg.ltcg112A, rate: 0.125, taxAmount: t, source: 'capital-gains', ruleId: CAPITAL_GAINS_RULES.meta.ruleId });
  }
  if (cg.ltcg112 > 0) {
    const t = Math.floor(cg.ltcg112 * CAPITAL_GAINS_RULES.ltcg112NoIndexation.rate);
    specialTax += t;
    lines.push({ category: 'CG_112', description: 'LTCG without indexation @ 12.5%', baseAmount: cg.ltcg112, rate: 0.125, taxAmount: t, source: 'capital-gains', ruleId: CAPITAL_GAINS_RULES.meta.ruleId });
  }

  // Rebate 87A applies only to slab-rate tax
  const qualifyingIncome = taxableOrdinary + cg.slabGains; // total income for rebate purposes (V1 approximation: taxable ordinary)
  const reb = rebate87A(req.regime, qualifyingIncome, slabRes.tax);
  if (reb.rebate > 0) lines.push({ category: 'REBATE', description: 'Section 87A rebate', baseAmount: qualifyingIncome, rate: null, taxAmount: -reb.rebate, source: 'tax-engine', ruleId: reb.ruleId });
  const slabTaxAfterRebate = Math.max(0, slabRes.tax - reb.rebate);

  // Surcharge & cess on total income level
  const sc = computeSurcharge(Math.max(0, gross - deductionsTotal), slabTaxAfterRebate + specialTax);
  if (sc.surcharge > 0) lines.push({ category: 'SURCHARGE', description: `Surcharge @ ${Math.round(sc.rate * 100)}%`, baseAmount: slabTaxAfterRebate + specialTax, rate: sc.rate, taxAmount: sc.surcharge, source: 'tax-engine', ruleId: sc.ruleId });
  const cessRes = computeCess(slabTaxAfterRebate + specialTax + sc.surcharge);
  if (cessRes.cess > 0) lines.push({ category: 'CESS', description: 'Health & Education Cess @ 4%', baseAmount: slabTaxAfterRebate + specialTax + sc.surcharge, rate: 0.04, taxAmount: cessRes.cess, source: 'tax-engine', ruleId: cessRes.ruleId });

  const totalTax = slabTaxAfterRebate + specialTax + sc.surcharge + cessRes.cess;
  const credits = aggregatePayments(req.payments);
  const refundOrPayable = totalTax - credits.total;

  lines.push({ category: 'TOTAL', description: 'Total estimated tax', baseAmount: totalTax, rate: null, taxAmount: totalTax, source: 'tax-engine', ruleId: 'AGGREGATE' });
  lines.push({ category: 'CREDITS', description: 'TDS/TCS/advance/self-assessment paid', baseAmount: credits.total, rate: null, taxAmount: -credits.total, source: 'payments', ruleId: 'AGGREGATE' });

  void ASSESSMENT_YEAR;
  return {
    tax_year: TAX_YEAR, law_version: LAW_VERSION, ruleVersion: RULE_SET_VERSION, regime: req.regime,
    grossIncome: gross, deductions: deductionsTotal, taxableIncome: taxableOrdinary + cg.slabGains + cg.stcg111A + cg.ltcg112A + cg.ltcg112,
    slabTax: slabRes.tax, specialRateTax: specialTax, rebate: reb.rebate, surcharge: sc.surcharge, cess: cessRes.cess,
    totalTax, tds: credits.tds, tcs: credits.tcs, advanceTax: credits.advanceTax, selfAssessmentTax: credits.selfAssessmentTax,
    refundOrPayable, lines, calculatedAt: new Date().toISOString(),
  };
}

export function compareRegimes(req: Omit<CalcRequest, 'regime'>) {
  const neu = calculateTax({ ...req, regime: 'NEW' });
  const old = calculateTax({ ...req, regime: 'OLD' });
  const difference = neu.totalTax - old.totalTax;
  return {
    new: neu, old,
    difference,
    explanation: buildExplanation(neu, old, difference),
  };
}

function buildExplanation(n: TaxCalculation, o: TaxCalculation, diff: number): string {
  if (diff === 0) return 'Both regimes result in the same estimated tax.';
  const lowerIsNew = diff < 0;
  const parts: string[] = [];
  parts.push(`${lowerIsNew ? 'New' : 'Old'} regime results in ₹${Math.abs(diff / 100).toLocaleString('en-IN')} less tax.`);
  parts.push(`Deductions applied — New: ₹${(n.deductions / 100).toLocaleString('en-IN')}, Old: ₹${(o.deductions / 100).toLocaleString('en-IN')}.`);
  parts.push('The difference is driven by Chapter VI-A/24(b) deductions allowed only under the old regime versus the higher slabs and larger basic exemption under the new regime.');
  return parts.join(' ');
}
