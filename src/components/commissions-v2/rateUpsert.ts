/**
 * Upsert manual em duas fases para tabelas de taxas (CLT e FGTS V2).
 *
 * POR QUÊ NÃO USAR ON CONFLICT?
 *  - O índice único de CLT é `(bank, COALESCE(table_key,''), term_min, term_max, has_insurance, effective_date)`.
 *  - PostgREST/Supabase exige uma CONSTRAINT (não só índice) ou um conjunto de colunas SEM expressões para `onConflict`.
 *  - Como temos `COALESCE(...)` no índice, qualquer `onConflict='bank,table_key,...'` retorna:
 *    "there is no unique or exclusion constraint matching the ON CONFLICT specification".
 *  - FGTS V2 nem tem índice único.
 *
 * Solução: SELECT existentes pela mesma chave de negócio → separa em "novas" e "substituições" → INSERT em lote + UPDATE por id.
 * Bônus: já devolve os contadores X novas / Y substituídas para o usuário (sem round-trip extra).
 */

import { supabase } from '@/integrations/supabase/client';

export type RateRow = {
  effective_date: string;
  bank: string;
  table_key: string | null;
  term_min: number;
  term_max: number;
  min_value: number;
  max_value: number;
  has_insurance: boolean;
  rate: number;
  obs: string | null;
};

export type RateUpsertResult = {
  inserted: number;
  updated: number;
  errors: string[];
};

/**
 * Normaliza bank/table_key para UPPERCASE antes de qualquer comparação ou gravação.
 * Crítico porque o índice único do Postgres é case-sensitive — se o banco já tem
 * 'FACTA' e a planilha trouxer 'Facta', um INSERT puro estouraria duplicate key.
 * Também alinha com `calculate_commission_v2()` que faz UPPER(NEW.bank) na leitura.
 */
function normalizeRow(r: RateRow): RateRow {
  return {
    ...r,
    bank: (r.bank || '').trim().toUpperCase(),
    table_key: r.table_key ? r.table_key.trim().toUpperCase() : null,
  };
}

/** Chave de negócio que define duplicidade. Mesma em CLT e FGTS V2. */
function rateKey(r: Pick<RateRow, 'bank' | 'table_key' | 'term_min' | 'term_max' | 'has_insurance' | 'effective_date'>) {
  return [
    (r.bank || '').trim().toUpperCase(),
    (r.table_key || '').trim().toUpperCase(),
    r.term_min,
    r.term_max,
    r.has_insurance ? 1 : 0,
    r.effective_date,
  ].join('|');
}

/**
 * Faz pre-fetch das chaves existentes e classifica cada linha do payload em "nova" ou "substituir".
 * Retorna {existingMap} = chave de negócio → id existente.
 */
async function fetchExistingMap(
  tableName: 'commission_rates_clt_v2' | 'commission_rates_fgts_v2',
  rows: RateRow[],
): Promise<Map<string, string>> {
  if (rows.length === 0) return new Map();
  const banks = Array.from(new Set(rows.map(r => r.bank))).filter(Boolean);
  const dates = Array.from(new Set(rows.map(r => r.effective_date))).filter(Boolean);
  if (banks.length === 0 || dates.length === 0) return new Map();

  // Busca tudo pelos bancos + datas envolvidos (pequeno, eficiente).
  // Paginação defensiva caso passe de 1000 linhas.
  const all: any[] = [];
  let from = 0;
  const pageSize = 1000;
  while (true) {
    const { data, error } = await supabase
      .from(tableName)
      .select('id, bank, table_key, term_min, term_max, has_insurance, effective_date')
      .in('bank', banks)
      .in('effective_date', dates)
      .range(from, from + pageSize - 1);
    if (error) throw new Error(error.message);
    if (!data || data.length === 0) break;
    all.push(...data);
    if (data.length < pageSize) break;
    from += pageSize;
  }

  const map = new Map<string, string>();
  for (const r of all) map.set(rateKey(r as any), r.id as string);
  return map;
}

/**
 * Pré-visualiza quantas linhas seriam inseridas vs substituídas, sem aplicar nada.
 * Usado pelo preview do dialog de importação (item 4 do plano).
 */
export async function previewRateUpsert(
  tableName: 'commission_rates_clt_v2' | 'commission_rates_fgts_v2',
  rows: RateRow[],
): Promise<{ newCount: number; replaceCount: number }> {
  const existing = await fetchExistingMap(tableName, rows);
  let replaceCount = 0;
  for (const r of rows) if (existing.has(rateKey(r))) replaceCount += 1;
  return { newCount: rows.length - replaceCount, replaceCount };
}

/**
 * Aplica o upsert manual: INSERT em lote para novas, UPDATE por id para existentes.
 * Não usa ON CONFLICT, então funciona mesmo sem constraint única no banco.
 */
export async function upsertRates(
  tableName: 'commission_rates_clt_v2' | 'commission_rates_fgts_v2',
  rows: RateRow[],
): Promise<RateUpsertResult> {
  const result: RateUpsertResult = { inserted: 0, updated: 0, errors: [] };
  if (rows.length === 0) return result;

  const existing = await fetchExistingMap(tableName, rows);

  const toInsert: RateRow[] = [];
  const toUpdate: { id: string; row: RateRow }[] = [];
  // Dedup local: se a mesma chave aparecer duas vezes no arquivo, mantém a última.
  const localSeen = new Map<string, number>();
  rows.forEach((r, idx) => localSeen.set(rateKey(r), idx));

export async function upsertRates(
  tableName: 'commission_rates_clt_v2' | 'commission_rates_fgts_v2',
  rowsRaw: RateRow[],
): Promise<RateUpsertResult> {
  const result: RateUpsertResult = { inserted: 0, updated: 0, errors: [] };
  if (rowsRaw.length === 0) return result;

  // 1) Normaliza tudo (UPPERCASE em bank/table_key) ANTES de qualquer comparação ou gravação.
  const rows = rowsRaw.map(normalizeRow);

  const existing = await fetchExistingMap(tableName, rows);

  const toInsert: RateRow[] = [];
  const toUpdate: { id: string; row: RateRow }[] = [];
  // Dedup local: se a mesma chave aparecer duas vezes no arquivo, mantém a última.
  const localSeen = new Map<string, number>();
  rows.forEach((r, idx) => localSeen.set(rateKey(r), idx));

  rows.forEach((r, idx) => {
    const key = rateKey(r);
    if (localSeen.get(key) !== idx) return;
    const id = existing.get(key);
    if (id) toUpdate.push({ id, row: r });
    else toInsert.push(r);
  });

  // INSERT em lotes de 500
  if (toInsert.length > 0) {
    const batchSize = 500;
    for (let i = 0; i < toInsert.length; i += batchSize) {
      const batch = toInsert.slice(i, i + batchSize);
      const { error } = await supabase.from(tableName).insert(batch as any);
      if (error) result.errors.push(`Insert batch ${i}: ${error.message}`);
      else result.inserted += batch.length;
    }
  }

  // UPDATE por id, em paralelo com limite simples de 8
  if (toUpdate.length > 0) {
    const concurrency = 8;
    let cursor = 0;
    async function worker() {
      while (cursor < toUpdate.length) {
        const my = toUpdate[cursor++];
        const { error } = await supabase
          .from(tableName)
          .update({
            min_value: my.row.min_value,
            max_value: my.row.max_value,
            rate: my.row.rate,
            obs: my.row.obs,
          })
          .eq('id', my.id);
        if (error) result.errors.push(`Update ${my.id}: ${error.message}`);
        else result.updated += 1;
      }
    }
    await Promise.all(Array.from({ length: Math.min(concurrency, toUpdate.length) }, worker));
  }

  return result;
}
