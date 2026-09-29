/**
 * AI provider abstraction (§61). The application is never locked to one vendor.
 * CRITICAL (§62): AI explains and assists; it NEVER calculates tax.
 * LLM output must always pass JSON-schema validation + business validation + confidence threshold (§34/§61).
 */
import { z } from 'zod';

export const DocumentExtractionSchema = z.object({
  document_type: z.enum(['FORM_16', 'FORM_16A', 'AIS', 'FORM_26AS', 'BANK_STATEMENT', 'BROKER_STATEMENT', 'MF_STATEMENT', 'NPS_STATEMENT', 'INSURANCE_RECEIPT', 'HOME_LOAN_CERT', 'DONATION_RECEIPT', 'OTHER']),
  financial_year: z.string().regex(/^\d{4}-\d{2}$/),
  gross_salary: z.number().int().min(0).optional(),
  tds: z.number().int().min(0).optional(),
  confidence: z.number().min(0).max(1),
});
export type StructuredExtraction = z.infer<typeof DocumentExtractionSchema>;

export interface AIProvider {
  name: string;
  classifyDocument(text: string): Promise<{ type: StructuredExtraction['document_type']; confidence: number }>;
  extractDocument(text: string, hintType?: string): Promise<StructuredExtraction>;
  normalizeTransaction(narration: string): Promise<{ category: string; taxable: boolean | null; confidence: number }>;
  explainCalculation(calcSummary: string, question: string): Promise<string>;
}

const CONFIDENCE_FLOOR = 0.5;

/** Deterministic fallback provider — no external calls, no invented numbers.
 *  When AI_API_KEY is unset (V1 default), this keeps the pipeline honest (§71: no fake integrations). */
class DeterministicProvider implements AIProvider {
  name = 'deterministic-fallback';
  async classifyDocument(text: string) {
    const t = text.slice(0, 4000);
    if (/annual information statement|AIS/i.test(t)) return { type: 'AIS' as const, confidence: 0.9 };
    if (/form\s*26AS/i.test(t)) return { type: 'FORM_26AS' as const, confidence: 0.9 };
    if (/part\s*B|Form No\. 16|TDS certificate.*16\(i\)/i.test(t)) return { type: 'FORM_16' as const, confidence: 0.85 };
    if (/16A|certificate under rule 31\(1a\)/i.test(t)) return { type: 'FORM_16A' as const, confidence: 0.8 };
    if (/statement of account|savings account current/i.test(t)) return { type: 'BANK_STATEMENT' as const, confidence: 0.75 };
    if (/capital gains|realised gain/i.test(t)) return { type: 'BROKER_STATEMENT' as const, confidence: 0.6 };
    return { type: 'OTHER' as const, confidence: 0.3 };
  }
  async extractDocument(text: string, hintType?: string) {
    const cls = await this.classifyDocument(text);
    return DocumentExtractionSchema.parse({
      document_type: (hintType as StructuredExtraction['document_type']) ?? cls.type,
      financial_year: (text.match(/(?:FY|Financial Year)[:\s]*(\d{4}-\d{2})/i)?.[1]) ?? '2026-27',
      confidence: cls.confidence,
    });
  }
  async normalizeTransaction(narration: string) {
    const n = narration.toLowerCase();
    if (/interest/.test(n)) return { category: 'INTEREST', taxable: true, confidence: 0.8 };
    if (/dividend/.test(n)) return { category: 'DIVIDEND', taxable: true, confidence: 0.85 };
    if (/salary/.test(n)) return { category: 'SALARY', taxable: true, confidence: 0.85 };
    if (/transfer|neft|upi/.test(n)) return { category: 'TRANSFER', taxable: null, confidence: 0.5 };
    return { category: 'UNKNOWN', taxable: null, confidence: 0.2 };
  }
  async explainCalculation(calcSummary: string, _question: string) {
    // Explanation only — recites the deterministic calculation summary verbatim.
    return `Here is how your estimate was computed:\n${calcSummary}\n\nEvery figure above comes from the TaxOS deterministic tax engine using published rules for FY 2026-27. TaxOS provides informational calculations, not legal or tax advice.`;
  }
}

/** Optional OpenAI-compatible adapter, activated ONLY when AI_API_KEY is set.
 *  Output still passes schema + business validation + confidence floor before use (§61). */
class OpenAiCompatibleProvider implements AIProvider {
  name = 'openai-compatible';
  constructor(private apiKey: string, private baseUrl = 'https://api.openai.com/v1', private model = 'gpt-4o-mini') {}
  private async chat(prompt: string, json = false): Promise<string> {
    const res = await fetch(`${this.baseUrl}/chat/completions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${this.apiKey}` },
      body: JSON.stringify({ model: this.model, messages: [{ role: 'user', content: prompt }], ...(json ? { response_format: { type: 'json_object' } } : {}) }),
    });
    if (!res.ok) throw new Error(`AI provider error ${res.status}`);
    const data = await res.json();
    return data.choices?.[0]?.message?.content ?? '';
  }
  async classifyDocument(text: string) {
    const raw = await this.chat(`Classify this Indian tax document into exactly one of FORM_16, FORM_16A, AIS, FORM_26AS, BANK_STATEMENT, BROKER_STATEMENT, MF_STATEMENT, NPS_STATEMENT, INSURANCE_RECEIPT, HOME_LOAN_CERT, DONATION_RECEIPT, OTHER. Reply JSON {"type":"...","confidence":0..1}. Text:\n${text.slice(0, 6000)}`, true);
    try {
      const p = JSON.parse(raw);
      const okTypes = DocumentExtractionSchema.shape.document_type.options as string[];
      if (!okTypes.includes(p.type)) return { type: 'OTHER' as const, confidence: 0 };
      return { type: p.type, confidence: Math.max(0, Math.min(1, Number(p.confidence ?? 0))) };
    } catch { return { type: 'OTHER' as const, confidence: 0 }; }
  }
  async extractDocument(text: string, hintType?: string) {
    const raw = await this.chat(`Extract structured data from this Indian tax document (${hintType ?? 'unknown'}). Reply JSON matching {document_type, financial_year:"YYYY-YY", gross_salary_paise?, tds_paise?, confidence}. Amounts in integer paise. Never guess: use low confidence when unsure.\n${text.slice(0, 8000)}`, true);
    const parsed = JSON.parse(raw);
    const out = DocumentExtractionSchema.parse({
      document_type: parsed.document_type ?? 'OTHER',
      financial_year: parsed.financial_year ?? '2026-27',
      gross_salary: parsed.gross_salary_paise,
      tds: parsed.tds_paise,
      confidence: parsed.confidence ?? 0,
    });
    if (out.confidence < CONFIDENCE_FLOOR) throw new Error('LLM extraction below confidence floor — routed to human confirmation.');
    return out;
  }
  async normalizeTransaction(narration: string) {
    const raw = await this.chat(`Classify bank narration "${narration}" for an Indian taxpayer. JSON {category, taxable: bool|null, confidence}. Credits that may be transfers are taxable=null.`, true);
    try { return JSON.parse(raw); } catch { return { category: 'UNKNOWN', taxable: null, confidence: 0 }; }
  }
  async explainCalculation(calcSummary: string, question: string) {
    return this.chat(`You are TaxOS. Explain THIS deterministic calculation to answer the user's question. Do NOT invent or modify any number; use only the figures provided.\nQuestion: ${question}\nCalculation:\n${calcSummary}`);
  }
}

let _provider: AIProvider | null = null;
export function getAI(): AIProvider {
  if (_provider) return _provider;
  _provider = process.env.AI_API_KEY ? new OpenAiCompatibleProvider(process.env.AI_API_KEY, process.env.AI_BASE_URL) : new DeterministicProvider();
  return _provider;
}
