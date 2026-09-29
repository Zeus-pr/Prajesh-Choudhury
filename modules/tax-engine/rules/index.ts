/** Rule registry — resolves a rule set by tax year. Never hard-code one year's rules in components (§13/§80). */
import * as y2627 from './2026-27';

export interface RuleSet {
  TAX_YEAR: string;
  ASSESSMENT_YEAR: string;
  LAW_VERSION: string;
  RULE_SET_VERSION: string;
  [k: string]: unknown;
}

const REGISTRY: Record<string, RuleSet> = {
  '2026-27': y2627 as unknown as RuleSet,
};

export function getRules(taxYear: string): RuleSet {
  const r = REGISTRY[taxYear];
  if (!r) throw new Error(`No published tax rules for year ${taxYear}. Supported: ${Object.keys(REGISTRY).join(', ')}`);
  return r;
}

export function supportedTaxYears(): string[] {
  return Object.keys(REGISTRY);
}
