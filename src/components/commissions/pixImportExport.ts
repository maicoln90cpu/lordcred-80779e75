// Helper compartilhado de export/import de chaves PIX (V1 e V2).
// Usa o mesmo resolveSellerByName das outras importações de comissão.
import { supabase } from '@/integrations/supabase/client';
import { loadXLSX } from '@/lib/xlsx-lazy';
import { resolveSellerByName, type SellerProfileLike } from '@/lib/sellerNameMatch';

export interface PixRow {
  seller_id: string;
  pix_key: string;
  pix_type: string;
}

const VALID_TYPES = new Set(['cpf', 'cnpj', 'celular', 'email', 'aleatoria']);

function normalizePixType(raw: string): string {
  const t = (raw || '').toString().toLowerCase().trim()
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  if (t === 'telefone' || t === 'phone' || t === 'celular') return 'celular';
  if (t === 'e-mail' || t === 'email') return 'email';
  if (t === 'aleatoria' || t === 'aleatorio' || t === 'random') return 'aleatoria';
  if (VALID_TYPES.has(t)) return t;
  return 'cpf';
}

export async function exportPixToXlsx(
  rows: { seller_id: string; pix_type: string; pix_key: string }[],
  getSellerName: (id: string) => string,
  fileName = 'chaves_pix.xlsx',
) {
  const XLSX = await loadXLSX();
  const data = rows.map(r => ({
    'Vendedor': getSellerName(r.seller_id),
    'Tipo': r.pix_type.toUpperCase(),
    'Chave PIX': r.pix_key,
  }));
  const ws = XLSX.utils.json_to_sheet(data);
  ws['!cols'] = [{ wch: 30 }, { wch: 14 }, { wch: 32 }];
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'PIX');
  XLSX.writeFile(wb, fileName);
}

export async function downloadPixTemplate(fileName = 'modelo_chaves_pix.xlsx') {
  const XLSX = await loadXLSX();
  const ws = XLSX.utils.aoa_to_sheet([
    ['Vendedor', 'Tipo', 'Chave PIX'],
    ['Maria Silva', 'CPF', '123.456.789-00'],
    ['joao@empresa.com', 'EMAIL', 'joao@empresa.com'],
  ]);
  ws['!cols'] = [{ wch: 30 }, { wch: 14 }, { wch: 32 }];
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Modelo PIX');
  XLSX.writeFile(wb, fileName);
}

export interface PixImportResult {
  inserted: number;
  updated: number;
  skipped: number;
  errors: string[];
}

/**
 * Importa chaves PIX de um arquivo Excel/CSV.
 * - Resolve vendedor por nome (match exato + fuzzy via pg_trgm).
 * - Estratégia upsert: se já existir (seller_id + pix_type), atualiza chave; senão insere.
 * - Linhas com vendedor ambíguo/não encontrado são ignoradas.
 */
export async function importPixFromFile(
  file: File,
  profiles: SellerProfileLike[],
  tableName: 'seller_pix' | 'seller_pix_v2',
): Promise<PixImportResult> {
  const XLSX = await loadXLSX();
  const data = await file.arrayBuffer();
  const wb = XLSX.read(data, { type: 'array' });
  const ws = wb.Sheets[wb.SheetNames[0]];
  const rows: any[] = XLSX.utils.sheet_to_json(ws, { defval: '' });

  const result: PixImportResult = { inserted: 0, updated: 0, skipped: 0, errors: [] };

  const normalize = (s: string) => s?.toString().toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim() || '';
  const findCol = (row: any, aliases: string[]): string => {
    const keys = Object.keys(row);
    for (const alias of aliases) {
      const found = keys.find(k => normalize(k) === normalize(alias));
      if (found && row[found] !== '' && row[found] != null) return row[found].toString();
    }
    return '';
  };

  // Carrega lista atual para detectar update vs insert sem 1 round-trip por linha
  const { data: existing } = await supabase.from(tableName).select('id, seller_id, pix_type, pix_key');
  const existingMap = new Map<string, { id: string; pix_key: string }>();
  (existing || []).forEach((e: any) => {
    existingMap.set(`${e.seller_id}::${e.pix_type}`, { id: e.id, pix_key: e.pix_key });
  });

  for (const row of rows) {
    const sellerName = findCol(row, ['Vendedor', 'vendedor', 'Nome', 'nome']);
    const pixKey = findCol(row, ['Chave PIX', 'chave pix', 'chave', 'pix_key', 'pix']);
    const pixTypeRaw = findCol(row, ['Tipo', 'tipo', 'pix_type']);
    if (!sellerName || !pixKey) { result.skipped++; continue; }

    const match = await resolveSellerByName(sellerName, profiles);
    if (!match.userId || match.ambiguous) {
      result.skipped++;
      result.errors.push(`Vendedor não encontrado/ambíguo: "${sellerName}"`);
      continue;
    }

    const pixType = normalizePixType(pixTypeRaw);
    const key = `${match.userId}::${pixType}`;
    const existingRow = existingMap.get(key);

    if (existingRow) {
      if (existingRow.pix_key === pixKey) { result.skipped++; continue; }
      const { error } = await supabase.from(tableName).update({ pix_key: pixKey } as any).eq('id', existingRow.id);
      if (error) result.errors.push(error.message);
      else result.updated++;
    } else {
      const { error } = await supabase.from(tableName).insert({
        seller_id: match.userId, pix_type: pixType, pix_key: pixKey,
      } as any);
      if (error) result.errors.push(error.message);
      else result.inserted++;
    }
  }

  return result;
}
