import type { ItrInputs, ItrSuggestion } from './types';
import { evaluateItr1 } from './eligibility/itr1';
import { evaluateItr2 } from './eligibility/itr2';
import { evaluateItr3 } from './eligibility/itr3';
import { evaluateItr4 } from './eligibility/itr4';
import { ITR_DISCLAIMER } from '../tax-engine/validator/itrValidation';

export interface ItrResult { likely: ItrSuggestion; alternatives: ItrSuggestion[]; disclaimer: string; }

/** Deterministic eligibility resolution (§26). Never claims guaranteed eligibility. */
export function determineLikelyItr(i: ItrInputs): ItrResult {
  const all = [evaluateItr1(i), evaluateItr2(i), evaluateItr3(i), evaluateItr4(i)];
  let likely: ItrSuggestion;
  if (i.hasBusinessOrProfession) likely = evaluateItr3(i);
  else if (all[0].reasons.length) likely = all[0];
  else likely = evaluateItr2(i);
  return { likely, alternatives: all.filter(a => a.form !== likely.form), disclaimer: ITR_DISCLAIMER };
}
