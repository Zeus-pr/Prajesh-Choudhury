/** Broker & MF statement normalization (§19/§20). Upload-based only in V1 — no broker logins, no fabricated APIs (§71). */
import { parse } from 'csv-parse/sync';
import { parseIndianMoney } from './common';
import { classifyHolding } from '../../tax-engine/calculator/capitalGains';

export interface SecurityTxnNormalized {
  security: string;
  isin?: string;
  buyDate?: string;
  sellDate?: string;
  quantity: number;
  buyValuePaise: number;
  sellValuePaise: number;
  chargesPaise: number;         // brokerage + STT etc. deductible from sale value per s.48
  realizedGainPaise: number;    // sell - buy - charges (per lot when both dates present)
  holdingType: 'ST' | 'LT' | 'OPEN';
  listedEquity: boolean;
  assetKind: 'EQUITY' | 'EQUITY_MF' | 'DEBT_MF' | 'OTHER';
}

const LISTED_EQ_RE = /^(EQUITY|LISTED|STOCK|SHARE)/i;

export function normalizeBrokerCsv(content: string): SecurityTxnNormalized[] {
  const rows = parse(content, { skip_empty_lines: true, columns: true, relax_column_count: true }) as Record<string, string>[];
  const out: SecurityTxnNormalized[] = [];
  for (const r of rows) {
    const get = (...names: string[]) => {
      for (const n of names) {
        const k = Object.keys(r).find(k => k.toLowerCase().replace(/[^a-z]/g, '').includes(n.toLowerCase()));
        if (k && r[k]) return r[k];
      }
      return undefined;
    };
    const security = get('security', 'scrip', 'fund', 'name');
    const buyDate = get('buydate', 'purchase');
    const sellDate = get('selldate', 'redemption', 'sale');
    const qty = Number(get('quantity', 'units') ?? '0');
    const buyVal = parseIndianMoney(get('buyvalue', 'invested', 'cost') ?? '') ?? 0;
    const sellVal = parseIndianMoney(get('sellvalue', 'redeemed', 'salevalue', 'received') ?? '') ?? 0;
    const charges = parseIndianMoney(get('charges', 'brokerage', 'stt') ?? '') ?? 0;
    const isin = get('isin');
    const assetKindRaw = (get('assetclass', 'type') ?? 'EQUITY').toUpperCase();
    const assetKind: SecurityTxnNormalized['assetKind'] =
      /DEBT/.test(assetKindRaw) ? 'DEBT_MF' : /MF|FUND/.test(assetKindRaw) ? 'EQUITY_MF' : /EQUITY|STOCK|SHARE|LISTED/.test(assetKindRaw) ? 'EQUITY' : 'OTHER';
    const listedEquity = assetKind === 'EQUITY' || assetKind === 'EQUITY_MF';
    if (!security || !qty) continue;
    let holdingType: SecurityTxnNormalized['holdingType'] = 'OPEN';
    if (buyDate && sellDate) holdingType = classifyHolding(buyDate, sellDate, listedEquity);
    out.push({
      security, isin, buyDate, sellDate, quantity: qty,
      buyValuePaise: buyVal, sellValuePaise: sellVal, chargesPaise: charges,
      realizedGainPaise: sellVal > 0 ? sellVal - buyVal - charges : 0,
      holdingType, listedEquity, assetKind,
    });
  }
  return out;
}

/** Map a normalized transaction to the correct tax-engine income category (§22 rule-driven). */
export function toIncomeCategory(t: SecurityTxnNormalized): string {
  if (t.holdingType === 'ST') return t.listedEquity ? 'CAPITAL_GAINS_STCG_111A' : 'CAPITAL_GAINS_SLAB';
  if (t.holdingType === 'LT') {
    if (t.assetKind === 'EQUITY' || t.assetKind === 'EQUITY_MF') return 'CAPITAL_GAINS_LTCG_112A';
    return 'CAPITAL_GAINS_LTCG_112';
  }
  return 'CAPITAL_GAINS_SLAB';
}

/** CAS-style overlapping-source duplicate detection helper (§20/§53): same fund+amount across CAMS/broker. */
export function mfDuplicateCandidates(records: { fund: string; amountPaise: number; source: string }[]): { group: string; records: typeof records }[] {
  const m = new Map<string, typeof records>();
  for (const r of records) {
    const k = `${r.fund}|${r.amountPaise}`;
    m.set(k, [...(m.get(k) ?? []), r]);
  }
  return [...m.entries()].filter(([, v]) => new Set(v.map(x => x.source)).size >= 2).map(([group, recs]) => ({ group, records: recs }));
}
