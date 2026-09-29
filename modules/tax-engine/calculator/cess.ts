import type { Paise } from '../types';
import { CESS } from '../rules/2026-27';

export function computeCess(taxPlusSurcharge: Paise): { cess: Paise; ruleId: string } {
  return { cess: Math.floor(taxPlusSurcharge * CESS.rate), ruleId: CESS.meta.ruleId };
}
