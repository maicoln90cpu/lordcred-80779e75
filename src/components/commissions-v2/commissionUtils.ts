import { loadXLSX } from '@/lib/xlsx-lazy';

/** Converte serial date Excel em partes — substitui XLSX.SSF.parse_date_code (ver commissions/commissionUtils.ts). */
function excelSerialToParts(serial: number): { y: number; m: number; d: number; H: number; M: number } | null {
  if (!isFinite(serial)) return null;
  const epoch = Date.UTC(1899, 11, 30);
  const date = new Date(epoch + Math.round(serial * 86400 * 1000));
  if (isNaN(date.getTime())) return null;
  return {
    y: date.getUTCFullYear(),
    m: date.getUTCMonth() + 1,
    d: date.getUTCDate(),
    H: date.getUTCHours(),
    M: date.getUTCMinutes(),
  };
}

// ==================== TYPES ====================
export interface CommissionSale {
  id: string;
  sale_date: string;
  product: string;
  bank: string;
  term: number | null;
  released_value: number;
  has_insurance: boolean;
  client_cpf: string | null;
  client_name: string | null;
  client_phone: string | null;
  seller_id: string;
  external_proposal_id: string | null;
  commission_rate: number;
  commission_value: number;
  week_label: string | null;
  created_by: string;
  created_at: string;
  table_name: string | null;
  client_birth_date: string | null;
  batch_id?: string | null;
  bonus_value?: number | null;
}

export interface RateFGTS {
  id: string;
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
}

export interface RateCLT {
  id: string;
  effective_date: string;
  bank: string;
  term_min: number;
  term_max: number;
  min_value: number;
  max_value: number;
  has_insurance: boolean;
  rate: number;
  obs: string | null;
  table_key: string | null;
}

export interface SellerPix {
  id: string;
  seller_id: string;
  pix_key: string;
  pix_type: string;
}

export interface Profile {
  user_id: string;
  name: string | null;
  email: string;
}

export interface BonusTier {
  id: string;
  min_contracts: number;
  bonus_value: number;
}

export interface AnnualReward {
  id: string;
  min_contracts: number;
  reward_description: string;
  sort_order: number;
}

// ==================== UTILITIES ====================
export const fmtBRL = (v: number) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

export async function exportToExcel(data: Record<string, string | number>[], filename: string, sheetName = 'Dados') {
  const XLSX = await loadXLSX();
  const ws = XLSX.utils.json_to_sheet(data);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, sheetName);
  XLSX.writeFile(wb, filename);
}

export function formatDateBR(dateStr: string): string {
  try {
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return dateStr;
    return new Intl.DateTimeFormat('pt-BR', { timeZone: 'America/Sao_Paulo', day: '2-digit', month: '2-digit', year: 'numeric' }).format(d);
  } catch { return dateStr; }
}

export function toDatetimeLocalBR(dateStr: string): string {
  try {
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return dateStr.slice(0, 16);
    const parts = new Intl.DateTimeFormat('pt-BR', { timeZone: 'America/Sao_Paulo', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hour12: false }).formatToParts(d);
    const get = (t: string) => parts.find(p => p.type === t)?.value || '00';
    return `${get('year')}-${get('month')}-${get('day')}T${get('hour')}:${get('minute')}`;
  } catch { return dateStr.slice(0, 16); }
}

export function toBrasiliaTimestamp(localDatetime: string): string {
  if (!localDatetime) return localDatetime;
  if (/[+-]\d{2}:\d{2}$/.test(localDatetime) || localDatetime.endsWith('Z')) return localDatetime;
  return localDatetime + '-03:00';
}

export function parseExcelDate(v: any): string | null {
  if (!v) return null;
  if (v instanceof Date && !isNaN(v.getTime())) {
    const y = v.getFullYear();
    const m = String(v.getMonth() + 1).padStart(2, '0');
    const d = String(v.getDate()).padStart(2, '0');
    const h = String(v.getHours()).padStart(2, '0');
    const min = String(v.getMinutes()).padStart(2, '0');
    return `${y}-${m}-${d}T${h}:${min}-03:00`;
  }
  if (typeof v === 'number') {
    const d = excelSerialToParts(v);
    if (d) return `${d.y}-${String(d.m).padStart(2, '0')}-${String(d.d).padStart(2, '0')}T${String(d.H || 0).padStart(2, '0')}:${String(d.M || 0).padStart(2, '0')}-03:00`;
  }
  if (typeof v === 'string') {
    const parts = v.match(/(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})(?:\s+(\d{1,2}):(\d{1,2})(?::(\d{1,2}))?)?/);
    if (parts) return `${parts[3]}-${parts[2].padStart(2, '0')}-${parts[1].padStart(2, '0')}T${(parts[4] || '12').padStart(2, '0')}:${(parts[5] || '00').padStart(2, '0')}-03:00`;
    const iso = new Date(v);
    if (!isNaN(iso.getTime())) {
      const y = iso.getFullYear();
      const m = String(iso.getMonth() + 1).padStart(2, '0');
      const d = String(iso.getDate()).padStart(2, '0');
      const h = String(iso.getHours()).padStart(2, '0');
      const min = String(iso.getMinutes()).padStart(2, '0');
      return `${y}-${m}-${d}T${h}:${min}-03:00`;
    }
  }
  return null;
}

export function cleanCurrency(v: any): number {
  if (typeof v === 'number') return v;
  if (!v) return 0;
  const s = String(v).replace(/[R$\s]/g, '').replace(/\./g, '').replace(',', '.');
  return parseFloat(s) || 0;
}

export const DAY_NAMES = ['Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado'];
