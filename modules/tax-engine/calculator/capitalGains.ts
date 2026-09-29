/**
 * Capital Gains Engine (§22). Lot-aware, tax-year specific rules.
 * Losses within the same rate class are set off first; inter-class set-off
 * follows s.71/74 constraints (STCG111A can be set off against all special-rate
 * and slab income; LTCG classes only against same-class income). V1 keeps this
 * deterministic and conservative; unabsorbed losses carry forward via UI prompt.
 */
import type { IncomeInput, Paise } from '../types';
import { CAPITAL_GAINS_RULES } from '../rules/2026-27';

export interface CapitalGainResult {
  stcg111A: Paise;          // taxable STCG @20% after intra-class loss set-off
  ltcg112A: Paise;          // taxable LTCG @12.5% after exemption limit
  ltcg112: Paise;           // other LTCG @12.5%
  slabGains: Paise;         // gains taxed at slab rates (may be negative → set-off pool)
  exempt112A: Paise;        // portion of LTCG112A below ₹1.25L exemption
  linesUsedRuleId: string;
}

export function computeCapitalGains(incomes: IncomeInput[]): CapitalGainResult {
  const cg = incomes.filter(i => i.category.startsWith('CAPITAL_GAINS'));
  let stcg = 0, ltcgA = 0, ltcg112 = 0, slab = 0;
  for (const c of cg) {
    switch (c.category) {
      case 'CAPITAL_GAINS_STCG_111A': stcg += c.amount; break;
      case 'CAPITAL_GAINS_LTCG_112A': ltcgA += c.amount; break;
      case 'CAPITAL_GAINS_LTCG_112': ltcg112 += c.amount; break;
      default: slab += c.amount;
    }
  }
  // Intra-class set-off happens naturally because inputs are netted per class.
  // Cross-class: STCG111A losses can't reduce other classes automatically here;
  // we only allow positive pools to be taxed.
  stcg = Math.max(0, stcg);
  ltcg112 = Math.max(0, ltcg112);
  slab = Math.max(0, slab);

  const exemptLimit = CAPITAL_GAINS_RULES.ltcg112A.exemptLimit;
  let exempt112A = 0;
  let taxable112A = 0;
  if (ltcgA > 0) {
    exempt112A = Math.min(ltcgA, exemptLimit);
    taxable112A = ltcgA - exempt112A;
  } else {
    taxable112A = 0; // losses carried forward (user prompted in UI)
  }
  return {
    stcg111A: stcg,
    ltcg112A: taxable112A,
    ltcg112,
    slabGains: slab,
    exempt112A,
    linesUsedRuleId: CAPITAL_GAINS_RULES.meta.ruleId,
  };
}

/** Holding-period classification helper for imported transactions (§19/§22). */
export function classifyHolding(buyDateISO: string, sellDateISO: string, listedEquity: boolean): 'ST' | 'LT' {
  const buy = new Date(buyDateISO), sell = new Date(sellDateISO);
  const monthsDiff = (sell.getFullYear() - buy.getFullYear()) * 12 + (sell.getMonth() - buy.getMonth());
  const threshold = listedEquity ? 12 : 24;
  return monthsDiff >= threshold ? 'LT' : 'ST';
}
