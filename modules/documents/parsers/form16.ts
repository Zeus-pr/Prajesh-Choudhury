/** Form 16 text extraction (§17). Deterministic regex first; LLM only fills gaps (see lib/ai/provider).
 *  Never silently trusts OCR — every field carries confidence; low-confidence fields require confirmation. */
import { field, parseIndianMoney, type ExtractedField } from './common';

export interface Form16Extraction {
  document_type: 'FORM_16';
  employer_name: ExtractedField<string>;
  employer_pan: ExtractedField<string>;
  employee_pan?: ExtractedField<string>;
  financial_year: ExtractedField<string>;
  gross_salary: ExtractedField<number>;      // paise
  taxable_salary: ExtractedField<number>;
  tds_deducted: ExtractedField<number>;
  regime?: ExtractedField<string>;
}

const PAN_RE = /\b([A-Z]{5}\d{4}[A-Z])\b/;

export function extractForm16(text: string): Form16Extraction {
  const fyMatch = text.match(/(?:FY|Financial Year)[:\s]*(\d{4}-\d{2})/i);
  const employer = text.match(/(?:Employer|Name and Address of Employer)[:\s]*([^\n]+)/i);
  const pans = [...text.matchAll(new RegExp(PAN_RE.source, 'g'))].map(m => m[1]);
  const gross = text.match(/(?:Gross Salary|Total Salary)[:\s₹]*([\d,]+(?:\.\d{2})?)/i);
  const taxable = text.match(/(?:Taxable Salary|Net Salary|Salary u\.s\s*15\(3\))[:\s₹]*([\d,]+(?:\.\d{2})?)/i);
  const tds = text.match(/(?:TDS deducted|Tax Deducted at Source|Total Tax Deducted)[^\d]{0,40}([\d,]+(?:\.\d{2})?)/i);
  const regime = text.match(/\b(Old Regime|New Regime|Regime 115BAC)\b/i);

  return {
    document_type: 'FORM_16',
    employer_name: field(employer?.[1]?.trim() ?? 'Unknown employer', employer ? 0.85 : 0.3),
    employer_pan: field(pans[0] ?? '', pans[0] ? 0.9 : 0.2),
    employee_pan: pans[1] ? field(pans[1], 0.88) : undefined,
    financial_year: field(fyMatch?.[1] ?? '2026-27', fyMatch ? 0.95 : 0.4),
    gross_salary: field(parseIndianMoney(gross?.[1] ?? '') ?? 0, gross ? 0.97 : 0.35),
    taxable_salary: field(parseIndianMoney(taxable?.[1] ?? '') ?? (parseIndianMoney(gross?.[1] ?? '') ?? 0), taxable ? 0.95 : 0.5),
    tds_deducted: field(parseIndianMoney(tds?.[1] ?? '') ?? 0, tds ? 0.98 : 0.3),
    regime: regime ? field(regime[1], 0.9) : undefined,
  };
}
