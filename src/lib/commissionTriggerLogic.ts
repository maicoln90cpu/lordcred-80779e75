/**
 * Espelho TS puro da lógica do trigger `calculate_commission_v2` (Postgres).
 * Usado para Vitest e para o relatório side-by-side V1×V2.
 *
 * IMPORTANTE: Se mudar o trigger no banco, atualize aqui também.
 * Documentação completa em docs/COMMISSIONS-V2.md.
 */

export type Product = 'FGTS' | 'CLT' | string;
export type MatchLevel = 'specific' | 'generic' | 'generic_no_value' | 'fallback' | 'none';

export interface RateRow {
  effective_date: string;       // ISO yyyy-mm-dd
  bank: string;
  table_key: string | null;
  term_min: number;             // meses
  term_max: number;             // meses
  min_value: number;
  max_value: number;
  has_insurance: boolean;
  rate: number;                 // %
}

export interface SaleInput {
  sale_date: string;            // ISO yyyy-mm-dd or full ISO
  product: Product;
  bank: string;
  table_name?: string | null;   // origem do table_key (ex.: "LOTUS 1+", "FACTA GOLD")
  term: number | null;          // meses
  released_value: number;
  has_insurance: boolean;
}

export interface CalcResult {
  rate: number;
  commission_value: number;
  match_level: MatchLevel;
}

/** Heurística de extração de table_key a partir do table_name (espelho do trigger). */
export function extractTableKey(tableName: string | null | undefined): string | null {
  if (!tableName) return null;
  const u = tableName.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toUpperCase().trim();
  // Heurísticas suportadas (ordem importa — específico → genérico)
  const patterns: Array<[RegExp, string]> = [
    [/LOTUS\s*5\+/i, 'LOTUS 5+'],
    [/LOTUS\s*4\+/i, 'LOTUS 4+'],
    [/LOTUS\s*3\+/i, 'LOTUS 3+'],
    [/LOTUS\s*2\+/i, 'LOTUS 2+'],
    [/LOTUS\s*1\+/i, 'LOTUS 1+'],
    [/HUB\s*CARTA/i, 'HUB CARTA'],
    [/HUB\s*PREMIUM/i, 'HUB PREMIUM'],
    [/FACTA\s*GOLD\s*PLUS/i, 'FACTA GOLD PLUS'],
    [/FACTA\s*GOLD/i, 'FACTA GOLD'],
    [/FACTA\s*SAQUE/i, 'FACTA SAQUE'],
    [/FACTA\s*NOVO/i, 'FACTA NOVO'],
    [/FACTA\s*AGENDADO/i, 'FACTA AGENDADO'],
    [/PARANA\s*TURBO/i, 'PARANA TURBO'],
    [/PARAN[AÁ]/i, 'PARANA'],
  ];
  for (const [re, key] of patterns) if (re.test(u)) return key;
  return u || null;
}

function dateLE(a: string, b: string): boolean {
  return a.slice(0, 10) <= b.slice(0, 10);
}

function pickLatest(rows: RateRow[]): RateRow | null {
  if (!rows.length) return null;
  return [...rows].sort((a, b) => (a.effective_date < b.effective_date ? 1 : -1))[0];
}

/**
 * Calcula comissão V2 com fallback 3 níveis:
 *  1) specific  — bank + table_key + term + value + insurance
 *  2) generic   — bank + term + value + insurance (sem table_key)
 *  3) fallback  — bank + insurance + date (paridade com V1)
 */
export function calcCommissionV2(sale: SaleInput, rates: RateRow[]): CalcResult {
  const bank = (sale.bank || '').toUpperCase().trim();
  const tk = extractTableKey(sale.table_name ?? sale.bank);
  const term = sale.term ?? 0;
  const value = sale.released_value || 0;
  const ins = !!sale.has_insurance;

  const sameBank = rates.filter(r =>
    (r.bank || '').toUpperCase().trim() === bank &&
    r.has_insurance === ins &&
    dateLE(r.effective_date, sale.sale_date),
  );

  // Nível 1 — specific
  if (tk) {
    const specific = sameBank.filter(r =>
      r.table_key && r.table_key.toUpperCase() === tk &&
      term >= r.term_min && term <= r.term_max &&
      value >= r.min_value && value <= r.max_value,
    );
    const hit = pickLatest(specific);
    if (hit && hit.rate > 0) {
      return { rate: hit.rate, commission_value: +(value * hit.rate / 100).toFixed(2), match_level: 'specific' };
    }
  }

  // Nível 2 — generic (ignora table_key)
  const generic = sameBank.filter(r =>
    term >= r.term_min && term <= r.term_max &&
    value >= r.min_value && value <= r.max_value,
  );
  const gHit = pickLatest(generic);
  if (gHit && gHit.rate > 0) {
    return { rate: gHit.rate, commission_value: +(value * gHit.rate / 100).toFixed(2), match_level: 'generic' };
  }

  // Nível 3 — generic_no_value (ignora table_key e valor — só bank+seguro+prazo+data)
  const genericNoValue = sameBank.filter(r =>
    term >= r.term_min && term <= r.term_max,
  );
  const gnvHit = pickLatest(genericNoValue);
  if (gnvHit && gnvHit.rate > 0) {
    return { rate: gnvHit.rate, commission_value: +(value * gnvHit.rate / 100).toFixed(2), match_level: 'generic_no_value' };
  }

  // Nível 3 — fallback (apenas bank + insurance + date — paridade V1)
  const fHit = pickLatest(sameBank);
  if (fHit && fHit.rate > 0) {
    return { rate: fHit.rate, commission_value: +(value * fHit.rate / 100).toFixed(2), match_level: 'fallback' };
  }

  return { rate: 0, commission_value: 0, match_level: 'none' };
}

/** Lógica V1 (apenas bank + insurance + date — para comparação side-by-side). */
export function calcCommissionV1(sale: SaleInput, rates: Array<Pick<RateRow, 'bank' | 'has_insurance' | 'effective_date' | 'rate'>>): CalcResult {
  const bank = (sale.bank || '').toUpperCase().trim();
  const ins = !!sale.has_insurance;
  const candidates = rates.filter(r =>
    (r.bank || '').toUpperCase().trim() === bank &&
    r.has_insurance === ins &&
    dateLE(r.effective_date, sale.sale_date),
  );
  const hit = pickLatest(candidates as RateRow[]);
  if (hit && hit.rate > 0) {
    const cv = +(sale.released_value * hit.rate / 100).toFixed(2);
    return { rate: hit.rate, commission_value: cv, match_level: 'fallback' };
  }
  return { rate: 0, commission_value: 0, match_level: 'none' };
}
