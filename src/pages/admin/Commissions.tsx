import { useState, useEffect, useRef } from 'react';
import DashboardLayout from '@/components/layout/DashboardLayout';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { Plus, Pencil, Trash2, DollarSign, Key, BarChart3, FileSpreadsheet, Search, Upload, Download, ArrowUpDown, ArrowUp, ArrowDown, Settings, Loader2, Save, Lightbulb, ClipboardList, ClipboardPaste, CalendarDays, Eye, Columns } from 'lucide-react';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Checkbox } from '@/components/ui/checkbox';
import { parseClipboardText } from '@/lib/clipboardParser';
import * as XLSX from 'xlsx';
import { TSHead, useSortState, applySortToData, TOOLTIPS_PARCEIROS_BASE, TOOLTIPS_PARCEIROS_PIX, TOOLTIPS_PARCEIROS_RATES_FGTS, TOOLTIPS_PARCEIROS_RATES_CLT } from '@/components/commission-reports/CRSortUtils';
import type { SortConfig } from '@/components/commission-reports/CRSortUtils';
import CommIndicadores from '@/components/commission-reports/CommIndicadores';
import CRImportHistory from '@/components/commission-reports/CRImportHistory';
import { HelpButton, HELP_PARCEIROS } from '@/components/commission-reports/HelpModal';

// ==================== SORT UTILITIES (kept for backward compat) ====================
type SortDir = 'asc' | 'desc' | null;

function useSortConfig() {
  return useSortState();
}

function sortData<T>(data: T[], sort: SortConfig, getValue: (item: T, key: string) => any): T[] {
  return applySortToData(data, sort, getValue);
}

function SortHead({ label, sortKey, sort, toggle, className, tooltip }: { label: string; sortKey: string; sort: SortConfig; toggle: (k: string) => void; className?: string; tooltip?: string }) {
  return <TSHead label={label} sortKey={sortKey} sort={sort} toggle={toggle} className={className} tooltip={tooltip} />;
}
// ==================== TYPES ====================
interface CommissionSale {
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
}

interface RateFGTS {
  id: string;
  effective_date: string;
  bank: string;
  rate_no_insurance: number;
  rate_with_insurance: number;
}

interface RateCLT {
  id: string;
  effective_date: string;
  bank: string;
  term_min: number;
  term_max: number;
  has_insurance: boolean;
  rate: number;
  obs: string | null;
  table_key: string | null;
}

interface SellerPix {
  id: string;
  seller_id: string;
  pix_key: string;
  pix_type: string;
}

interface Profile {
  user_id: string;
  name: string | null;
  email: string;
}

// ==================== WEEK MULTI-SELECT ====================
function WeekMultiSelect({ weeks, selected, onChange, className }: { weeks: string[]; selected: string[]; onChange: (v: string[]) => void; className?: string }) {
  const sorted = [...weeks].sort((a, b) => (a || '').localeCompare(b || '', 'pt-BR'));
  const label = selected.length === 0 ? 'Todas as semanas' : selected.length === 1 ? selected[0] : `${selected.length} semanas`;
  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="outline" className={`justify-start font-normal ${className || 'w-full sm:w-64'}`}>
          <CalendarDays className="w-4 h-4 mr-2 text-muted-foreground" />
          <span className="truncate">{label}</span>
          {selected.length > 0 && (
            <Badge variant="secondary" className="ml-auto text-xs">{selected.length}</Badge>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-64 max-h-72 overflow-y-auto p-2" align="start">
        <div className="flex items-center justify-between mb-2 px-1">
          <span className="text-xs font-medium text-muted-foreground">Semanas</span>
          {selected.length > 0 && (
            <Button variant="ghost" size="sm" className="h-6 text-xs" onClick={() => onChange([])}>Limpar</Button>
          )}
        </div>
        {sorted.map(w => (
          <label key={w} className="flex items-center gap-2 px-1 py-1.5 hover:bg-accent rounded cursor-pointer text-sm">
            <Checkbox
              checked={selected.includes(w)}
              onCheckedChange={(checked) => {
                if (checked) onChange([...selected, w]);
                else onChange(selected.filter(s => s !== w));
              }}
            />
            <span className="truncate">{w}</span>
          </label>
        ))}
        {sorted.length === 0 && <p className="text-xs text-muted-foreground text-center py-2">Nenhuma semana</p>}
      </PopoverContent>
    </Popover>
  );
}

// ==================== EXPORT HELPERS ====================
const fmtBRL = (v: number) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

function exportToExcel(data: Record<string, string | number>[], filename: string, sheetName = 'Dados') {
  const ws = XLSX.utils.json_to_sheet(data);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, sheetName);
  XLSX.writeFile(wb, filename);
}

// Format a date for display using fixed São Paulo timezone
function formatDateBR(dateStr: string): string {
  try {
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return dateStr;
    return new Intl.DateTimeFormat('pt-BR', { timeZone: 'America/Sao_Paulo', day: '2-digit', month: '2-digit', year: 'numeric' }).format(d);
  } catch { return dateStr; }
}

// Format a timestamptz to datetime-local input value in São Paulo timezone
function toDatetimeLocalBR(dateStr: string): string {
  try {
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return dateStr.slice(0, 16);
    const parts = new Intl.DateTimeFormat('pt-BR', { timeZone: 'America/Sao_Paulo', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hour12: false }).formatToParts(d);
    const get = (t: string) => parts.find(p => p.type === t)?.value || '00';
    return `${get('year')}-${get('month')}-${get('day')}T${get('hour')}:${get('minute')}`;
  } catch { return dateStr.slice(0, 16); }
}

// Ensure a datetime-local string has Brasília offset before saving to timestamptz
function toBrasiliaTimestamp(localDatetime: string): string {
  if (!localDatetime) return localDatetime;
  // If already has offset, return as is
  if (/[+-]\d{2}:\d{2}$/.test(localDatetime) || localDatetime.endsWith('Z')) return localDatetime;
  return localDatetime + '-03:00';
}

function parseExcelDate(v: any): string | null {
  if (!v) return null;
  // Handle Date objects (from cellDates: true) — extract local components to avoid UTC shift
  if (v instanceof Date && !isNaN(v.getTime())) {
    const y = v.getFullYear();
    const m = String(v.getMonth() + 1).padStart(2, '0');
    const d = String(v.getDate()).padStart(2, '0');
    const h = String(v.getHours()).padStart(2, '0');
    const min = String(v.getMinutes()).padStart(2, '0');
    return `${y}-${m}-${d}T${h}:${min}-03:00`;
  }
  if (typeof v === 'number') {
    const d = XLSX.SSF.parse_date_code(v);
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

function cleanCurrency(v: any): number {
  if (typeof v === 'number') return v;
  if (!v) return 0;
  const s = String(v).replace(/[R$\s]/g, '').replace(/\./g, '').replace(',', '.');
  return parseFloat(s) || 0;
}

// ==================== MAIN COMPONENT ====================
export default function Commissions() {
  const { user, isAdmin, isSeller } = useAuth();
  const { toast } = useToast();
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [activeTab, setActiveTab] = useState('base');

  useEffect(() => {
    loadProfiles();
  }, []);

  const loadProfiles = async () => {
    const { data } = await supabase.from('profiles').select('user_id, name, email');
    if (data) setProfiles(data);
  };

  const getSellerName = (sellerId: string) => {
    const p = profiles.find(pr => pr.user_id === sellerId);
    return p?.name || p?.email || sellerId.slice(0, 8);
  };

  return (
    <DashboardLayout>
      <div className="space-y-4">
        <div className="flex items-center gap-3">
          <DollarSign className="w-6 h-6 text-primary" />
          <h1 className="text-2xl font-bold">Comissões Parceiros</h1>
          <HelpButton title="Como funciona Comissões Parceiros" sections={HELP_PARCEIROS} />
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="flex-wrap h-auto">
            <TabsTrigger value="base">Base</TabsTrigger>
            <TabsTrigger value="pix">PIX</TabsTrigger>
            {isAdmin && <TabsTrigger value="rates-fgts">Taxas FGTS</TabsTrigger>}
            {isAdmin && <TabsTrigger value="rates-clt">Taxas CLT</TabsTrigger>}
            <TabsTrigger value="extrato">Extrato</TabsTrigger>
            {isAdmin && <TabsTrigger value="consolidado">Consolidado</TabsTrigger>}
            {isAdmin && <TabsTrigger value="config">Configurações</TabsTrigger>}
            {isAdmin && <TabsTrigger value="indicadores"><Lightbulb className="w-3.5 h-3.5 mr-1" />Indicadores</TabsTrigger>}
            {isAdmin && <TabsTrigger value="hist-importacoes"><ClipboardList className="w-3.5 h-3.5 mr-1" />Hist. Importações</TabsTrigger>}
          </TabsList>

          <TabsContent value="base">
            <BaseTab profiles={profiles} getSellerName={getSellerName} isAdmin={isAdmin} userId={user?.id || ''} />
          </TabsContent>
          <TabsContent value="pix">
            <PixTab profiles={profiles} getSellerName={getSellerName} isAdmin={isAdmin} userId={user?.id || ''} />
          </TabsContent>
          {isAdmin && (
            <TabsContent value="rates-fgts">
              <RatesFGTSTab />
            </TabsContent>
          )}
          {isAdmin && (
            <TabsContent value="rates-clt">
              <RatesCLTTab />
            </TabsContent>
          )}
          <TabsContent value="extrato">
            <ExtratoTab profiles={profiles} getSellerName={getSellerName} isAdmin={isAdmin} userId={user?.id || ''} />
          </TabsContent>
          {isAdmin && (
            <TabsContent value="consolidado">
              <ConsolidadoTab profiles={profiles} getSellerName={getSellerName} />
            </TabsContent>
          )}
          {isAdmin && (
            <TabsContent value="config">
              <ConfigTab />
            </TabsContent>
          )}
          {isAdmin && (
            <TabsContent value="indicadores">
              <CommIndicadores profiles={profiles} getSellerName={getSellerName} />
            </TabsContent>
          )}
          {isAdmin && (
            <TabsContent value="hist-importacoes">
              <HistImportTab userId={user?.id || ''} profiles={profiles} getSellerName={getSellerName} />
            </TabsContent>
          )}
        </Tabs>
      </div>
    </DashboardLayout>
  );
}

// ==================== BASE TAB ====================
// All possible columns for BaseTab
const BASE_COLUMNS = [
  { key: 'week_label', label: 'Semana', defaultVisible: true },
  { key: 'sale_date', label: 'Data', defaultVisible: true },
  { key: 'product', label: 'Produto', defaultVisible: true },
  { key: 'bank', label: 'Banco', defaultVisible: true },
  { key: 'table_name', label: 'Tabela', defaultVisible: true },
  { key: 'term', label: 'Prazo', defaultVisible: true },
  { key: 'released_value', label: 'Valor Lib.', defaultVisible: true },
  { key: 'has_insurance', label: 'Seguro', defaultVisible: true },
  { key: 'client_name', label: 'Cliente', defaultVisible: true },
  { key: 'client_cpf', label: 'CPF', defaultVisible: false },
  { key: 'client_phone', label: 'Telefone', defaultVisible: false },
  { key: 'client_birth_date', label: 'Data Nasc.', defaultVisible: false },
  { key: 'external_proposal_id', label: 'ID Proposta', defaultVisible: false },
  { key: 'seller_id', label: 'Vendedor', defaultVisible: true },
  { key: 'commission_rate', label: 'Taxa', defaultVisible: true },
  { key: 'commission_value', label: 'Comissão', defaultVisible: true },
];

function getDefaultVisibleCols(): string[] {
  const saved = localStorage.getItem('comm_base_visible_cols');
  if (saved) { try { return JSON.parse(saved); } catch {} }
  return BASE_COLUMNS.filter(c => c.defaultVisible).map(c => c.key);
}

function BaseTab({ profiles, getSellerName, isAdmin, userId }: { profiles: Profile[]; getSellerName: (id: string) => string; isAdmin: boolean; userId: string }) {
  const { toast } = useToast();
  const [sales, setSales] = useState<CommissionSale[]>([]);
  const { sort, toggle } = useSortConfig();
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingSale, setEditingSale] = useState<CommissionSale | null>(null);
  const [search, setSearch] = useState('');
  const [weekFilters, setWeekFilters] = useState<string[]>([]);
  const [importing, setImporting] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [visibleCols, setVisibleCols] = useState<string[]>(getDefaultVisibleCols);

  const toggleCol = (key: string) => {
    setVisibleCols(prev => {
      const next = prev.includes(key) ? prev.filter(k => k !== key) : [...prev, key];
      localStorage.setItem('comm_base_visible_cols', JSON.stringify(next));
      return next;
    });
  };

  const [form, setForm] = useState({
    sale_date: '', product: 'FGTS', bank: '', term: '', released_value: '',
    has_insurance: false, client_cpf: '', client_name: '', client_phone: '',
    seller_id: userId, external_proposal_id: '', table_name: '', client_birth_date: ''
  });

  useEffect(() => { loadSales(); }, []);

  const loadSales = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('commission_sales')
      .select('*')
      .order('sale_date', { ascending: false })
      .limit(500);
    if (data) setSales(data as unknown as CommissionSale[]);
    if (error) console.error(error);
    setLoading(false);
  };

  const weeks = [...new Set(sales.map(s => s.week_label).filter(Boolean))].sort().reverse();

  const filteredSales = sales.filter(s => {
    if (weekFilters.length > 0 && !weekFilters.includes(s.week_label || '')) return false;
    if (search) {
      const q = search.toLowerCase();
      return (
        (s.client_name?.toLowerCase().includes(q)) ||
        (s.client_cpf?.includes(q)) ||
        s.bank.toLowerCase().includes(q) ||
        getSellerName(s.seller_id).toLowerCase().includes(q)
      );
    }
    return true;
  });

  const openCreate = () => {
    setEditingSale(null);
    setForm({
      sale_date: new Date().toISOString().slice(0, 16),
      product: 'FGTS', bank: '', term: '', released_value: '',
      has_insurance: false, client_cpf: '', client_name: '', client_phone: '',
      seller_id: userId, external_proposal_id: '', table_name: '', client_birth_date: ''
    });
    setDialogOpen(true);
  };

  const openEdit = (sale: CommissionSale) => {
    setEditingSale(sale);
    setForm({
      sale_date: sale.sale_date.slice(0, 16),
      product: sale.product,
      bank: sale.bank,
      term: sale.term?.toString() || '',
      released_value: sale.released_value.toString(),
      has_insurance: sale.has_insurance,
      client_cpf: sale.client_cpf || '',
      client_name: sale.client_name || '',
      client_phone: sale.client_phone || '',
      seller_id: sale.seller_id,
      external_proposal_id: sale.external_proposal_id || '',
      table_name: (sale as any).table_name || '',
      client_birth_date: (sale as any).client_birth_date || ''
    });
    setDialogOpen(true);
  };

  const handleSave = async () => {
    if (!form.bank || !form.released_value || !form.sale_date) {
      toast({ title: 'Preencha os campos obrigatórios', variant: 'destructive' });
      return;
    }

    const payload = {
      sale_date: form.sale_date,
      product: form.product,
      bank: form.bank,
      term: form.term ? parseInt(form.term) : null,
      released_value: parseFloat(form.released_value),
      has_insurance: form.has_insurance,
      client_cpf: form.client_cpf || null,
      client_name: form.client_name || null,
      client_phone: form.client_phone || null,
      seller_id: form.seller_id,
      external_proposal_id: form.external_proposal_id || null,
      table_name: form.table_name || null,
      client_birth_date: form.client_birth_date || null,
      created_by: userId,
    };

    let error;
    if (editingSale) {
      ({ error } = await supabase.from('commission_sales').update(payload as any).eq('id', editingSale.id));
    } else {
      ({ error } = await supabase.from('commission_sales').insert(payload as any));
    }

    if (error) {
      toast({ title: 'Erro ao salvar', description: error.message, variant: 'destructive' });
    } else {
      toast({ title: editingSale ? 'Venda atualizada' : 'Venda registrada' });
      setDialogOpen(false);
      loadSales();
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Excluir esta venda?')) return;
    const { error } = await supabase.from('commission_sales').delete().eq('id', id);
    if (error) toast({ title: 'Erro', description: error.message, variant: 'destructive' });
    else { toast({ title: 'Venda excluída' }); loadSales(); }
  };

  const fmt = (v: number) => fmtBRL(v);

  const findSellerByName = (name: string): string | null => {
    if (!name) return null;
    const q = name.toLowerCase().trim();
    const p = profiles.find(pr => pr.name?.toLowerCase().trim() === q || pr.email.toLowerCase() === q);
    return p?.user_id || null;
  };

  const handleImportFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setImporting(true);

    try {
      const data = await file.arrayBuffer();
      const wb = XLSX.read(data, { type: 'array', cellDates: true });
      // Try to find "Base" sheet first, fall back to first sheet
      const sheetName = wb.SheetNames.find(n => n.toLowerCase().includes('base')) || wb.SheetNames[0];
      const ws = wb.Sheets[sheetName];
      const rows: any[] = XLSX.utils.sheet_to_json(ws, { defval: '' });

      if (rows.length === 0) {
        toast({ title: 'Planilha vazia', variant: 'destructive' });
        setImporting(false);
        return;
      }

      // Column mapping (flexible headers)
      const normalize = (s: string) => s?.toString().toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim() || '';
      const findCol = (row: any, aliases: string[]) => {
        const keys = Object.keys(row);
        for (const alias of aliases) {
          const found = keys.find(k => normalize(k) === normalize(alias));
          if (found) return row[found];
        }
        return undefined;
      };

      let imported = 0;
      let skipped = 0;
      const batchSize = 50;
      const payloads: any[] = [];

      for (const row of rows) {
        const rawDate = findCol(row, ['Data Pago', 'data_pago', 'Data', 'data pago']);
        const saleDate = parseExcelDate(rawDate);
        if (!saleDate) { skipped++; continue; }

        const product = findCol(row, ['Produto', 'produto']) || '';
        const bank = findCol(row, ['Banco', 'banco']) || '';
        const term = parseInt(findCol(row, ['Prazo', 'prazo'])) || null;
        const releasedValue = cleanCurrency(findCol(row, ['Valor Liberado', 'valor_liberado', 'Valor', 'valor liberado']));
        const insuranceRaw = findCol(row, ['Seguro', 'seguro']);
        const hasInsurance = insuranceRaw?.toString().toLowerCase().trim() === 'sim';
        const cpf = findCol(row, ['CPF', 'cpf'])?.toString() || null;
        const name = findCol(row, ['Nome', 'nome', 'Cliente'])?.toString() || null;
        const phone = findCol(row, ['Telefone', 'telefone', 'Fone'])?.toString() || null;
        const sellerName = findCol(row, ['Vendedor', 'vendedor'])?.toString() || '';
        const proposalId = findCol(row, ['id', 'ID', 'Id Proposta', 'external_proposal_id'])?.toString() || null;
        const tableName = findCol(row, ['Tabela', 'tabela', 'Table'])?.toString() || null;
        const birthDate = findCol(row, ['Data Nascimento', 'data_nascimento', 'Nascimento', 'Data de Nascimento'])?.toString() || null;

        if (!bank || releasedValue <= 0) { skipped++; continue; }

        const sellerId = findSellerByName(sellerName) || userId;

        payloads.push({
          sale_date: saleDate,
          product: product || 'FGTS',
          bank,
          term,
          released_value: releasedValue,
          has_insurance: hasInsurance,
          client_cpf: cpf,
          client_name: name,
          client_phone: phone,
          seller_id: sellerId,
          external_proposal_id: proposalId,
          table_name: tableName,
          client_birth_date: birthDate,
          created_by: userId,
        });
        imported++;
      }

      if (payloads.length === 0) {
        toast({ title: 'Nenhum registro válido encontrado', variant: 'destructive' });
        setImporting(false);
        return;
      }

      // Create import batch record for tracking
      const { data: batchRecord, error: batchErr } = await supabase.from('import_batches' as any).insert({
        file_name: file.name,
        module: 'parceiros',
        sheet_name: 'base',
        row_count: payloads.length,
        imported_by: userId,
        status: 'active',
      } as any).select('id').single();

      const batchId = batchErr ? null : (batchRecord as any)?.id;
      if (batchId) {
        payloads.forEach(p => { p.batch_id = batchId; });
      }

      // Insert in batches
      let errors = 0;
      for (let i = 0; i < payloads.length; i += batchSize) {
        const batch = payloads.slice(i, i + batchSize);
        const { error } = await supabase.from('commission_sales').insert(batch as any);
        if (error) { console.error('Batch error:', error); errors += batch.length; }
      }

      // Update batch row_count if some had errors
      if (batchId && errors > 0) {
        await supabase.from('import_batches' as any).update({ row_count: payloads.length - errors } as any).eq('id', batchId);
      }

      toast({
        title: 'Importação concluída',
        description: `${imported - errors} registros importados${skipped > 0 ? `, ${skipped} ignorados` : ''}${errors > 0 ? `, ${errors} com erro` : ''}`,
      });
      loadSales();
    } catch (err: any) {
      toast({ title: 'Erro na importação', description: err.message, variant: 'destructive' });
    } finally {
      setImporting(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleExportBase = () => {
    const data = filteredSales.map(s => ({
      'Semana': s.week_label || '',
      'Data Pago': new Date(s.sale_date).toLocaleDateString('pt-BR'),
      'Produto': s.product,
      'Banco': s.bank,
      'Tabela': (s as any).table_name || '',
      'Prazo': s.term || '',
      'Valor Liberado': s.released_value,
      'Seguro': s.has_insurance ? 'Sim' : 'Não',
      'CPF': s.client_cpf || '',
      'Nome': s.client_name || '',
      'Telefone': s.client_phone || '',
      'Data Nascimento': (s as any).client_birth_date || '',
      'Vendedor': getSellerName(s.seller_id),
      'ID': s.external_proposal_id || '',
      'Taxa %': s.commission_rate,
      'Comissão': s.commission_value,
    }));
    exportToExcel(data, 'comissoes_base.xlsx', 'Base');
    toast({ title: 'Exportado com sucesso' });
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
          <CardTitle className="flex items-center gap-2">
            <FileSpreadsheet className="w-5 h-5" />
            Vendas / Comissões
          </CardTitle>
          {isAdmin && (
            <div className="flex gap-2 flex-wrap">
              <input
                type="file"
                ref={fileInputRef}
                accept=".xlsx,.xls,.csv"
                className="hidden"
                onChange={handleImportFile}
              />
              <Button variant="outline" size="sm" onClick={() => fileInputRef.current?.click()} disabled={importing}>
                <Upload className="w-4 h-4 mr-1" /> {importing ? 'Importando...' : 'Importar'}
              </Button>
              <PasteImportButton profiles={profiles} userId={userId} onImported={loadSales} />
              <Button variant="outline" size="sm" onClick={handleExportBase} disabled={filteredSales.length === 0}>
                <Download className="w-4 h-4 mr-1" /> Exportar
              </Button>
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" size="sm"><Columns className="w-4 h-4 mr-1" /> Colunas</Button>
                </PopoverTrigger>
                <PopoverContent className="w-56 max-h-80 overflow-y-auto p-2" align="end">
                  <p className="text-xs font-medium text-muted-foreground mb-2">Colunas visíveis</p>
                  {BASE_COLUMNS.map(col => (
                    <label key={col.key} className="flex items-center gap-2 py-1 px-1 hover:bg-muted rounded cursor-pointer text-sm">
                      <Checkbox checked={visibleCols.includes(col.key)} onCheckedChange={() => toggleCol(col.key)} />
                      {col.label}
                    </label>
                  ))}
                </PopoverContent>
              </Popover>
              <Button onClick={openCreate} size="sm">
                <Plus className="w-4 h-4 mr-1" /> Nova Venda
              </Button>
            </div>
          )}
        </div>
        <div className="flex flex-col sm:flex-row gap-2 mt-2">
          <div className="relative flex-1">
            <Search className="absolute left-2.5 top-2.5 w-4 h-4 text-muted-foreground" />
            <Input placeholder="Buscar..." value={search} onChange={e => setSearch(e.target.value)} className="pl-9" />
          </div>
          <WeekMultiSelect weeks={weeks as string[]} selected={weekFilters} onChange={setWeekFilters} />
        </div>
      </CardHeader>
      <CardContent>
        {loading ? (
          <p className="text-muted-foreground text-center py-8">Carregando...</p>
        ) : filteredSales.length === 0 ? (
          <p className="text-muted-foreground text-center py-8">Nenhuma venda encontrada</p>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  {BASE_COLUMNS.filter(c => visibleCols.includes(c.key)).map(col => (
                    <SortHead key={col.key} label={col.label} sortKey={col.key} sort={sort} toggle={toggle}
                      className={['released_value', 'commission_rate', 'commission_value'].includes(col.key) ? 'text-right' : ''} />
                  ))}
                  {isAdmin && <TableHead className="text-right">Ações</TableHead>}
                </TableRow>
              </TableHeader>
              <TableBody>
                {sortData(filteredSales, sort, (s, k) => {
                  if (k === 'seller_id') return getSellerName(s.seller_id);
                  if (k === 'has_insurance') return s.has_insurance ? 'Sim' : 'Não';
                  return (s as any)[k];
                }).map(sale => (
                  <TableRow key={sale.id}>
                    {BASE_COLUMNS.filter(c => visibleCols.includes(c.key)).map(col => {
                      const key = col.key;
                      if (key === 'week_label') return <TableCell key={key} className="text-xs text-muted-foreground whitespace-nowrap">{sale.week_label || '-'}</TableCell>;
                      if (key === 'sale_date') return <TableCell key={key} className="whitespace-nowrap">{new Date(sale.sale_date).toLocaleDateString('pt-BR')}</TableCell>;
                      if (key === 'product') return <TableCell key={key}><Badge variant={sale.product === 'FGTS' ? 'default' : 'secondary'}>{sale.product === 'Crédito do Trabalhador' ? 'CLT' : sale.product}</Badge></TableCell>;
                      if (key === 'bank') return <TableCell key={key}>{sale.bank}</TableCell>;
                      if (key === 'table_name') return <TableCell key={key} className="text-xs text-muted-foreground max-w-[150px] truncate" title={sale.table_name || ''}>{sale.table_name || '-'}</TableCell>;
                      if (key === 'term') return <TableCell key={key}>{sale.term ? `${sale.term}m` : '-'}</TableCell>;
                      if (key === 'released_value') return <TableCell key={key} className="text-right font-medium">{fmt(sale.released_value)}</TableCell>;
                      if (key === 'has_insurance') return <TableCell key={key}>{sale.has_insurance ? 'Sim' : 'Não'}</TableCell>;
                      if (key === 'client_name') return <TableCell key={key} className="text-sm">{sale.client_name || '-'}</TableCell>;
                      if (key === 'client_cpf') return <TableCell key={key} className="text-xs font-mono">{sale.client_cpf || '-'}</TableCell>;
                      if (key === 'client_phone') return <TableCell key={key} className="text-xs">{sale.client_phone || '-'}</TableCell>;
                      if (key === 'client_birth_date') return <TableCell key={key} className="text-xs">{sale.client_birth_date || '-'}</TableCell>;
                      if (key === 'external_proposal_id') return <TableCell key={key} className="text-xs font-mono">{sale.external_proposal_id || '-'}</TableCell>;
                      if (key === 'seller_id') return <TableCell key={key} className="text-sm">{getSellerName(sale.seller_id)}</TableCell>;
                      if (key === 'commission_rate') return <TableCell key={key} className="text-right">{sale.commission_rate}%</TableCell>;
                      if (key === 'commission_value') return <TableCell key={key} className="text-right font-bold text-primary">{fmt(sale.commission_value)}</TableCell>;
                      return <TableCell key={key}>{(sale as any)[key] || '-'}</TableCell>;
                    })}
                    {isAdmin && (
                      <TableCell className="text-right">
                        <div className="flex gap-1 justify-end">
                          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => openEdit(sale)}>
                            <Pencil className="w-3.5 h-3.5" />
                          </Button>
                          <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => handleDelete(sale.id)}>
                            <Trash2 className="w-3.5 h-3.5" />
                          </Button>
                        </div>
                      </TableCell>
                    )}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}

        {/* Dialog Create/Edit */}
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>{editingSale ? 'Editar Venda' : 'Nova Venda'}</DialogTitle>
            </DialogHeader>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Data Pago *</Label>
                <Input type="datetime-local" value={form.sale_date} onChange={e => setForm({ ...form, sale_date: e.target.value })} />
              </div>
              <div>
                <Label>Produto *</Label>
                <Select value={form.product} onValueChange={v => setForm({ ...form, product: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="FGTS">FGTS</SelectItem>
                    <SelectItem value="Crédito do Trabalhador">Crédito do Trabalhador</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Banco *</Label>
                <Input value={form.bank} onChange={e => setForm({ ...form, bank: e.target.value })} placeholder="Ex: PARANA BANCO" />
              </div>
              <div>
                <Label>Prazo (meses)</Label>
                <Input type="number" value={form.term} onChange={e => setForm({ ...form, term: e.target.value })} placeholder="Ex: 12" />
              </div>
              <div>
                <Label>Valor Liberado *</Label>
                <Input type="number" step="0.01" value={form.released_value} onChange={e => setForm({ ...form, released_value: e.target.value })} />
              </div>
              <div className="flex items-end gap-2 pb-1">
                <Switch checked={form.has_insurance} onCheckedChange={v => setForm({ ...form, has_insurance: v })} />
                <Label>Seguro</Label>
              </div>
              <div>
                <Label>CPF</Label>
                <Input value={form.client_cpf} onChange={e => setForm({ ...form, client_cpf: e.target.value })} />
              </div>
              <div>
                <Label>Nome Cliente</Label>
                <Input value={form.client_name} onChange={e => setForm({ ...form, client_name: e.target.value })} />
              </div>
              <div>
                <Label>Telefone</Label>
                <Input value={form.client_phone} onChange={e => setForm({ ...form, client_phone: e.target.value })} />
              </div>
              <div>
                <Label>ID Proposta</Label>
                <Input value={form.external_proposal_id} onChange={e => setForm({ ...form, external_proposal_id: e.target.value })} />
              </div>
              <div>
                <Label>Tabela</Label>
                <Input value={form.table_name} onChange={e => setForm({ ...form, table_name: e.target.value })} placeholder="Ex: FOCO NO CORBAN" />
              </div>
              <div>
                <Label>Data Nascimento</Label>
                <Input value={form.client_birth_date} onChange={e => setForm({ ...form, client_birth_date: e.target.value })} placeholder="DD/MM/AAAA" />
              </div>
              {isAdmin && (
                <div className="col-span-2">
                  <Label>Vendedor</Label>
                  <Select value={form.seller_id} onValueChange={v => setForm({ ...form, seller_id: v })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {[...profiles].sort((a, b) => (a.name || a.email).localeCompare(b.name || b.email, 'pt-BR')).map(p => (
                        <SelectItem key={p.user_id} value={p.user_id}>{p.name || p.email}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancelar</Button>
              <Button onClick={handleSave}>{editingSale ? 'Salvar' : 'Registrar'}</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </CardContent>
    </Card>
  );
}

// ==================== PIX TAB ====================
function PixTab({ profiles, getSellerName, isAdmin, userId }: { profiles: Profile[]; getSellerName: (id: string) => string; isAdmin: boolean; userId: string }) {
  const { toast } = useToast();
  const [pixList, setPixList] = useState<SellerPix[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<SellerPix | null>(null);
  const [form, setForm] = useState({ seller_id: userId, pix_key: '', pix_type: 'cpf' });
  const { sort, toggle } = useSortConfig();

  useEffect(() => { loadPix(); }, []);

  const loadPix = async () => {
    setLoading(true);
    const { data } = await supabase.from('seller_pix').select('*').order('created_at');
    if (data) setPixList(data as unknown as SellerPix[]);
    setLoading(false);
  };

  const openCreate = () => {
    setEditing(null);
    setForm({ seller_id: userId, pix_key: '', pix_type: 'cpf' });
    setDialogOpen(true);
  };

  const openEdit = (p: SellerPix) => {
    setEditing(p);
    setForm({ seller_id: p.seller_id, pix_key: p.pix_key, pix_type: p.pix_type });
    setDialogOpen(true);
  };

  const handleSave = async () => {
    if (!form.pix_key) { toast({ title: 'Informe a chave PIX', variant: 'destructive' }); return; }
    const payload = { seller_id: form.seller_id, pix_key: form.pix_key, pix_type: form.pix_type };
    let error;
    if (editing) {
      ({ error } = await supabase.from('seller_pix').update(payload as any).eq('id', editing.id));
    } else {
      ({ error } = await supabase.from('seller_pix').insert(payload as any));
    }
    if (error) toast({ title: 'Erro', description: error.message, variant: 'destructive' });
    else { toast({ title: 'PIX salvo' }); setDialogOpen(false); loadPix(); }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Excluir esta chave PIX?')) return;
    await supabase.from('seller_pix').delete().eq('id', id);
    toast({ title: 'PIX excluído' });
    loadPix();
  };

  const visiblePix = isAdmin ? pixList : pixList.filter(p => p.seller_id === userId);

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2"><Key className="w-5 h-5" /> Chaves PIX</CardTitle>
          <Button onClick={openCreate} size="sm"><Plus className="w-4 h-4 mr-1" /> Adicionar</Button>
        </div>
      </CardHeader>
      <CardContent>
        {loading ? <p className="text-center text-muted-foreground py-8">Carregando...</p> : visiblePix.length === 0 ? (
          <p className="text-center text-muted-foreground py-8">Nenhuma chave PIX cadastrada</p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <SortHead label="Vendedor" sortKey="seller_id" sort={sort} toggle={toggle} />
                <SortHead label="Tipo" sortKey="pix_type" sort={sort} toggle={toggle} />
                <SortHead label="Chave PIX" sortKey="pix_key" sort={sort} toggle={toggle} />
                <TableHead className="text-right">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {sortData(visiblePix, sort, (p, k) => {
                if (k === 'seller_id') return getSellerName(p.seller_id);
                return (p as any)[k];
              }).map(p => (
                <TableRow key={p.id}>
                  <TableCell>{getSellerName(p.seller_id)}</TableCell>
                  <TableCell><Badge variant="outline">{p.pix_type.toUpperCase()}</Badge></TableCell>
                  <TableCell className="font-mono text-sm">{p.pix_key}</TableCell>
                  <TableCell className="text-right">
                    <div className="flex gap-1 justify-end">
                      <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => openEdit(p)}><Pencil className="w-3.5 h-3.5" /></Button>
                      <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => handleDelete(p.id)}><Trash2 className="w-3.5 h-3.5" /></Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}

        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogContent className="max-w-sm">
            <DialogHeader><DialogTitle>{editing ? 'Editar PIX' : 'Nova Chave PIX'}</DialogTitle></DialogHeader>
            <div className="space-y-3">
              {isAdmin && (
                <div>
                  <Label>Vendedor</Label>
                  <Select value={form.seller_id} onValueChange={v => setForm({ ...form, seller_id: v })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {[...profiles].sort((a, b) => (a.name || a.email).localeCompare(b.name || b.email, 'pt-BR')).map(p => <SelectItem key={p.user_id} value={p.user_id}>{p.name || p.email}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
              )}
              <div>
                <Label>Tipo</Label>
                <Select value={form.pix_type} onValueChange={v => setForm({ ...form, pix_type: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="cpf">CPF</SelectItem>
                    <SelectItem value="celular">Celular</SelectItem>
                    <SelectItem value="email">E-mail</SelectItem>
                    <SelectItem value="aleatoria">Aleatória</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Chave PIX</Label>
                <Input value={form.pix_key} onChange={e => setForm({ ...form, pix_key: e.target.value })} placeholder="Ex: 123.456.789-00" />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancelar</Button>
              <Button onClick={handleSave}>Salvar</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </CardContent>
    </Card>
  );
}

// ==================== RATES FGTS TAB ====================
function RatesFGTSTab() {
  const { toast } = useToast();
  const [rates, setRates] = useState<RateFGTS[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<RateFGTS | null>(null);
  const [form, setForm] = useState({ effective_date: '', bank: '', rate_no_insurance: '', rate_with_insurance: '' });
  const { sort, toggle } = useSortConfig();

  useEffect(() => { loadRates(); }, []);

  const loadRates = async () => {
    setLoading(true);
    const { data } = await supabase.from('commission_rates_fgts').select('*').order('effective_date', { ascending: false });
    if (data) setRates(data as unknown as RateFGTS[]);
    setLoading(false);
  };

  const openCreate = () => {
    setEditing(null);
    setForm({ effective_date: new Date().toISOString().slice(0, 10), bank: '', rate_no_insurance: '', rate_with_insurance: '' });
    setDialogOpen(true);
  };

  const openEdit = (r: RateFGTS) => {
    setEditing(r);
    setForm({ effective_date: r.effective_date, bank: r.bank, rate_no_insurance: r.rate_no_insurance.toString(), rate_with_insurance: r.rate_with_insurance.toString() });
    setDialogOpen(true);
  };

  const handleSave = async () => {
    if (!form.bank || !form.effective_date) { toast({ title: 'Preencha campos obrigatórios', variant: 'destructive' }); return; }
    const payload = {
      effective_date: form.effective_date, bank: form.bank,
      rate_no_insurance: parseFloat(form.rate_no_insurance) || 0,
      rate_with_insurance: parseFloat(form.rate_with_insurance) || 0,
    };
    let error;
    if (editing) {
      ({ error } = await supabase.from('commission_rates_fgts').update(payload as any).eq('id', editing.id));
    } else {
      ({ error } = await supabase.from('commission_rates_fgts').insert(payload as any));
    }
    if (error) toast({ title: 'Erro', description: error.message, variant: 'destructive' });
    else { toast({ title: 'Taxa salva' }); setDialogOpen(false); loadRates(); }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Excluir esta taxa?')) return;
    await supabase.from('commission_rates_fgts').delete().eq('id', id);
    toast({ title: 'Taxa excluída' }); loadRates();
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle>Taxas Comissão FGTS</CardTitle>
          <Button onClick={openCreate} size="sm"><Plus className="w-4 h-4 mr-1" /> Nova Taxa</Button>
        </div>
      </CardHeader>
      <CardContent>
        {loading ? <p className="text-center text-muted-foreground py-8">Carregando...</p> : rates.length === 0 ? (
          <p className="text-center text-muted-foreground py-8">Nenhuma taxa cadastrada</p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <SortHead label="Vigência" sortKey="effective_date" sort={sort} toggle={toggle} />
                <SortHead label="Banco" sortKey="bank" sort={sort} toggle={toggle} />
                <SortHead label="Sem Seguro" sortKey="rate_no_insurance" sort={sort} toggle={toggle} className="text-right" />
                <SortHead label="Com Seguro" sortKey="rate_with_insurance" sort={sort} toggle={toggle} className="text-right" />
                <TableHead className="text-right">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {sortData(rates, sort, (r, k) => (r as any)[k]).map(r => (
                <TableRow key={r.id}>
                  <TableCell>{new Date(r.effective_date + 'T12:00:00').toLocaleDateString('pt-BR')}</TableCell>
                  <TableCell className="font-medium">{r.bank}</TableCell>
                  <TableCell className="text-right">{r.rate_no_insurance}%</TableCell>
                  <TableCell className="text-right">{r.rate_with_insurance}%</TableCell>
                  <TableCell className="text-right">
                    <div className="flex gap-1 justify-end">
                      <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => openEdit(r)}><Pencil className="w-3.5 h-3.5" /></Button>
                      <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => handleDelete(r.id)}><Trash2 className="w-3.5 h-3.5" /></Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}

        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogContent className="max-w-sm">
            <DialogHeader><DialogTitle>{editing ? 'Editar Taxa FGTS' : 'Nova Taxa FGTS'}</DialogTitle></DialogHeader>
            <div className="space-y-3">
              <div><Label>Início Vigência *</Label><Input type="date" value={form.effective_date} onChange={e => setForm({ ...form, effective_date: e.target.value })} /></div>
              <div><Label>Banco *</Label><Input value={form.bank} onChange={e => setForm({ ...form, bank: e.target.value })} placeholder="Ex: PARANA BANCO" /></div>
              <div><Label>Taxa Sem Seguro (%)</Label><Input type="number" step="0.01" value={form.rate_no_insurance} onChange={e => setForm({ ...form, rate_no_insurance: e.target.value })} /></div>
              <div><Label>Taxa Com Seguro (%)</Label><Input type="number" step="0.01" value={form.rate_with_insurance} onChange={e => setForm({ ...form, rate_with_insurance: e.target.value })} /></div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancelar</Button>
              <Button onClick={handleSave}>Salvar</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </CardContent>
    </Card>
  );
}

// ==================== RATES CLT TAB ====================
function RatesCLTTab() {
  const { toast } = useToast();
  const [rates, setRates] = useState<RateCLT[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<RateCLT | null>(null);
  const [form, setForm] = useState({ effective_date: '', bank: '', term_min: '0', term_max: '999', has_insurance: false, rate: '', obs: '', table_key: '' });
  const { sort, toggle } = useSortConfig();

  useEffect(() => { loadRates(); }, []);

  const loadRates = async () => {
    setLoading(true);
    const { data } = await supabase.from('commission_rates_clt').select('*').order('effective_date', { ascending: false });
    if (data) setRates(data as unknown as RateCLT[]);
    setLoading(false);
  };

  const openCreate = () => {
    setEditing(null);
    setForm({ effective_date: new Date().toISOString().slice(0, 10), bank: '', term_min: '0', term_max: '999', has_insurance: false, rate: '', obs: '', table_key: '' });
    setDialogOpen(true);
  };

  const openEdit = (r: RateCLT) => {
    setEditing(r);
    setForm({
      effective_date: r.effective_date, bank: r.bank,
      term_min: r.term_min.toString(), term_max: r.term_max.toString(),
      has_insurance: r.has_insurance, rate: r.rate.toString(), obs: r.obs || '',
      table_key: (r as any).table_key || ''
    });
    setDialogOpen(true);
  };

  const handleSave = async () => {
    if (!form.bank || !form.effective_date || !form.rate) { toast({ title: 'Preencha campos obrigatórios', variant: 'destructive' }); return; }
    const payload = {
      effective_date: form.effective_date, bank: form.bank,
      term_min: parseInt(form.term_min) || 0, term_max: parseInt(form.term_max) || 999,
      has_insurance: form.has_insurance, rate: parseFloat(form.rate) || 0, obs: form.obs || null,
      table_key: form.table_key || null,
    };
    let error;
    if (editing) {
      ({ error } = await supabase.from('commission_rates_clt').update(payload as any).eq('id', editing.id));
    } else {
      ({ error } = await supabase.from('commission_rates_clt').insert(payload as any));
    }
    if (error) toast({ title: 'Erro', description: error.message, variant: 'destructive' });
    else { toast({ title: 'Taxa salva' }); setDialogOpen(false); loadRates(); }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Excluir?')) return;
    await supabase.from('commission_rates_clt').delete().eq('id', id);
    toast({ title: 'Excluída' }); loadRates();
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle>Taxas Comissão CLT</CardTitle>
          <Button onClick={openCreate} size="sm"><Plus className="w-4 h-4 mr-1" /> Nova Taxa</Button>
        </div>
      </CardHeader>
      <CardContent>
        {loading ? <p className="text-center text-muted-foreground py-8">Carregando...</p> : rates.length === 0 ? (
          <p className="text-center text-muted-foreground py-8">Nenhuma taxa cadastrada</p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <SortHead label="Vigência" sortKey="effective_date" sort={sort} toggle={toggle} />
                <SortHead label="Banco" sortKey="bank" sort={sort} toggle={toggle} />
                <SortHead label="Tabela" sortKey="table_key" sort={sort} toggle={toggle} />
                <SortHead label="Prazo Min" sortKey="term_min" sort={sort} toggle={toggle} />
                <SortHead label="Prazo Max" sortKey="term_max" sort={sort} toggle={toggle} />
                <SortHead label="Seguro" sortKey="has_insurance" sort={sort} toggle={toggle} />
                <SortHead label="Taxa" sortKey="rate" sort={sort} toggle={toggle} className="text-right" />
                <SortHead label="Obs" sortKey="obs" sort={sort} toggle={toggle} />
                <TableHead className="text-right">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {sortData(rates, sort, (r, k) => {
                if (k === 'has_insurance') return r.has_insurance ? 'Sim' : 'Não';
                return (r as any)[k];
              }).map(r => (
                <TableRow key={r.id}>
                  <TableCell>{new Date(r.effective_date + 'T12:00:00').toLocaleDateString('pt-BR')}</TableCell>
                  <TableCell className="font-medium">{r.bank}</TableCell>
                  <TableCell className="text-xs">{(r as any).table_key || '-'}</TableCell>
                  <TableCell>{r.term_min}</TableCell>
                  <TableCell>{r.term_max}</TableCell>
                  <TableCell>{r.has_insurance ? 'Sim' : 'Não'}</TableCell>
                  <TableCell className="text-right">{r.rate}%</TableCell>
                  <TableCell className="text-xs text-muted-foreground">{r.obs || '-'}</TableCell>
                  <TableCell className="text-right">
                    <div className="flex gap-1 justify-end">
                      <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => openEdit(r)}><Pencil className="w-3.5 h-3.5" /></Button>
                      <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => handleDelete(r.id)}><Trash2 className="w-3.5 h-3.5" /></Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}

        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogContent className="max-w-md">
            <DialogHeader><DialogTitle>{editing ? 'Editar Taxa CLT' : 'Nova Taxa CLT'}</DialogTitle></DialogHeader>
            <div className="grid grid-cols-2 gap-3">
              <div><Label>Vigência *</Label><Input type="date" value={form.effective_date} onChange={e => setForm({ ...form, effective_date: e.target.value })} /></div>
              <div><Label>Banco *</Label><Input value={form.bank} onChange={e => setForm({ ...form, bank: e.target.value })} /></div>
              <div><Label>Prazo Min</Label><Input type="number" value={form.term_min} onChange={e => setForm({ ...form, term_min: e.target.value })} /></div>
              <div><Label>Prazo Max</Label><Input type="number" value={form.term_max} onChange={e => setForm({ ...form, term_max: e.target.value })} /></div>
              <div className="flex items-end gap-2 pb-1"><Switch checked={form.has_insurance} onCheckedChange={v => setForm({ ...form, has_insurance: v })} /><Label>Seguro</Label></div>
              <div><Label>Taxa (%) *</Label><Input type="number" step="0.01" value={form.rate} onChange={e => setForm({ ...form, rate: e.target.value })} /></div>
              <div><Label>Chave Tabela</Label><Input value={form.table_key} onChange={e => setForm({ ...form, table_key: e.target.value })} placeholder="Ex: SONHO, FOCO, 2 Parcela" /></div>
              <div><Label>Observação</Label><Input value={form.obs} onChange={e => setForm({ ...form, obs: e.target.value })} placeholder="Ex: CLT - Ambos seguro" /></div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancelar</Button>
              <Button onClick={handleSave}>Salvar</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </CardContent>
    </Card>
  );
}

// ==================== EXTRATO TAB ====================
function ExtratoTab({ profiles, getSellerName, isAdmin, userId }: { profiles: Profile[]; getSellerName: (id: string) => string; isAdmin: boolean; userId: string }) {
  const [sales, setSales] = useState<CommissionSale[]>([]);
  const [loading, setLoading] = useState(true);
  const [sellerFilter, setSellerFilter] = useState(isAdmin ? 'all' : userId);
  const [weekFilters, setWeekFilters] = useState<string[]>([]);
  const [productFilter, setProductFilter] = useState('all');
  const { sort, toggle } = useSortConfig();

  useEffect(() => { loadSales(); }, []);

  const loadSales = async () => {
    setLoading(true);
    const { data } = await supabase.from('commission_sales').select('*').order('sale_date', { ascending: false });
    if (data) setSales(data as unknown as CommissionSale[]);
    setLoading(false);
  };

  const weeks = [...new Set(sales.map(s => s.week_label).filter(Boolean))].sort().reverse();

  const filtered = sales.filter(s => {
    if (sellerFilter !== 'all' && s.seller_id !== sellerFilter) return false;
    if (weekFilters.length > 0 && !weekFilters.includes(s.week_label || '')) return false;
    if (productFilter !== 'all' && s.product !== productFilter) return false;
    return true;
  });

  const totalPropostas = filtered.length;
  const totalLiberado = filtered.reduce((a, s) => a + s.released_value, 0);
  const totalComissao = filtered.reduce((a, s) => a + s.commission_value, 0);

  const fmt = (v: number) => fmtBRL(v);

  const handleExportExtrato = () => {
    const data = filtered.map(s => ({
      'Data': new Date(s.sale_date).toLocaleDateString('pt-BR'),
      'Produto': s.product === 'Crédito do Trabalhador' ? 'CLT' : s.product,
      'Banco': s.bank,
      'Vendedor': getSellerName(s.seller_id),
      'Valor Liberado': s.released_value,
      'Comissão': s.commission_value,
    }));
    data.push({
      'Data': 'TOTAL',
      'Produto': '',
      'Banco': '',
      'Vendedor': '',
      'Valor Liberado': totalLiberado,
      'Comissão': totalComissao,
    });
    exportToExcel(data, 'extrato_comissoes.xlsx', 'Extrato');
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2"><BarChart3 className="w-5 h-5" /> Extrato</CardTitle>
          <Button variant="outline" size="sm" onClick={handleExportExtrato} disabled={filtered.length === 0}>
            <Download className="w-4 h-4 mr-1" /> Exportar Excel
          </Button>
        </div>
        <div className="flex flex-col sm:flex-row gap-2 mt-2">
          {isAdmin && (
            <Select value={sellerFilter} onValueChange={setSellerFilter}>
              <SelectTrigger className="w-full sm:w-52"><SelectValue placeholder="Vendedor" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos os vendedores</SelectItem>
                {[...profiles].sort((a, b) => (a.name || a.email).localeCompare(b.name || b.email, 'pt-BR')).map(p => <SelectItem key={p.user_id} value={p.user_id}>{p.name || p.email}</SelectItem>)}
              </SelectContent>
            </Select>
          )}
          <WeekMultiSelect weeks={weeks as string[]} selected={weekFilters} onChange={setWeekFilters} />
          <Select value={productFilter} onValueChange={setProductFilter}>
            <SelectTrigger className="w-full sm:w-48"><SelectValue placeholder="Produto" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos os produtos</SelectItem>
              <SelectItem value="FGTS">FGTS</SelectItem>
              <SelectItem value="Crédito do Trabalhador">CLT</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </CardHeader>
      <CardContent>
        {/* Summary cards */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-4">
          <Card><CardContent className="p-4 text-center"><p className="text-sm text-muted-foreground">Propostas</p><p className="text-2xl font-bold">{totalPropostas}</p></CardContent></Card>
          <Card><CardContent className="p-4 text-center"><p className="text-sm text-muted-foreground">Total Liberado</p><p className="text-2xl font-bold">{fmt(totalLiberado)}</p></CardContent></Card>
          <Card><CardContent className="p-4 text-center"><p className="text-sm text-muted-foreground">Comissão Total</p><p className="text-2xl font-bold text-primary">{fmt(totalComissao)}</p></CardContent></Card>
        </div>

        {loading ? <p className="text-center text-muted-foreground py-4">Carregando...</p> : filtered.length === 0 ? (
          <p className="text-center text-muted-foreground py-4">Nenhum resultado</p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <SortHead label="Data" sortKey="sale_date" sort={sort} toggle={toggle} />
                <SortHead label="Produto" sortKey="product" sort={sort} toggle={toggle} />
                <SortHead label="Banco" sortKey="bank" sort={sort} toggle={toggle} />
                {isAdmin && <SortHead label="Vendedor" sortKey="seller_id" sort={sort} toggle={toggle} />}
                <SortHead label="Valor" sortKey="released_value" sort={sort} toggle={toggle} className="text-right" />
                <SortHead label="Comissão" sortKey="commission_value" sort={sort} toggle={toggle} className="text-right" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {sortData(filtered, sort, (s, k) => {
                if (k === 'seller_id') return getSellerName(s.seller_id);
                return (s as any)[k];
              }).map(s => (
                <TableRow key={s.id}>
                  <TableCell>{new Date(s.sale_date).toLocaleDateString('pt-BR')}</TableCell>
                  <TableCell><Badge variant={s.product === 'FGTS' ? 'default' : 'secondary'}>{s.product === 'Crédito do Trabalhador' ? 'CLT' : s.product}</Badge></TableCell>
                  <TableCell>{s.bank}</TableCell>
                  {isAdmin && <TableCell>{getSellerName(s.seller_id)}</TableCell>}
                  <TableCell className="text-right">{fmt(s.released_value)}</TableCell>
                  <TableCell className="text-right font-bold text-primary">{fmt(s.commission_value)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  );
}

// ==================== CONSOLIDADO TAB ====================
function ConsolidadoTab({ profiles, getSellerName }: { profiles: Profile[]; getSellerName: (id: string) => string }) {
  const [sales, setSales] = useState<CommissionSale[]>([]);
  const [pixList, setPixList] = useState<SellerPix[]>([]);
  const [loading, setLoading] = useState(true);
  const [weekFilters, setWeekFilters] = useState<string[]>([]);
  const { sort, toggle } = useSortConfig();

  useEffect(() => {
    Promise.all([
      supabase.from('commission_sales').select('*').order('sale_date', { ascending: false }),
      supabase.from('seller_pix').select('*'),
    ]).then(([salesRes, pixRes]) => {
      if (salesRes.data) setSales(salesRes.data as unknown as CommissionSale[]);
      if (pixRes.data) setPixList(pixRes.data as unknown as SellerPix[]);
      setLoading(false);
    });
  }, []);

  const weeks = [...new Set(sales.map(s => s.week_label).filter(Boolean))].sort().reverse();
  const filtered = weekFilters.length === 0 ? sales : sales.filter(s => weekFilters.includes(s.week_label || ''));

  // Group by seller
  const sellerIds = [...new Set(filtered.map(s => s.seller_id))];
  const sellerData = sellerIds.map(sid => {
    const sellerSales = filtered.filter(s => s.seller_id === sid);
    const clt = sellerSales.filter(s => s.product === 'Crédito do Trabalhador').reduce((a, s) => a + s.commission_value, 0);
    const fgts = sellerSales.filter(s => s.product === 'FGTS').reduce((a, s) => a + s.commission_value, 0);
    const pix = pixList.find(p => p.seller_id === sid);
    return { seller_id: sid, clt, fgts, total: clt + fgts, pix_key: pix?.pix_key || '-' };
  }).sort((a, b) => b.total - a.total);

  const grandTotal = sellerData.reduce((a, s) => a + s.total, 0);
  const fmt = (v: number) => fmtBRL(v);

  const handleExportConsolidado = () => {
    const data = sellerData.map(s => ({
      'Vendedor': getSellerName(s.seller_id),
      'Comissão CLT': s.clt,
      'Comissão FGTS': s.fgts,
      'Total': s.total,
      'Chave PIX': s.pix_key,
    }));
    data.push({
      'Vendedor': 'TOTAL',
      'Comissão CLT': sellerData.reduce((a, s) => a + s.clt, 0),
      'Comissão FGTS': sellerData.reduce((a, s) => a + s.fgts, 0),
      'Total': grandTotal,
      'Chave PIX': '',
    });
    const suffix = weekFilters.length > 0 ? '_' + weekFilters.join('+').replace(/[\/\s]/g, '-') : '';
    exportToExcel(data, `consolidado_comissoes${suffix}.xlsx`, 'Consolidado');
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle>Consolidado Semanal</CardTitle>
          <Button variant="outline" size="sm" onClick={handleExportConsolidado} disabled={sellerData.length === 0}>
            <Download className="w-4 h-4 mr-1" /> Exportar Excel
          </Button>
        </div>
        <WeekMultiSelect weeks={weeks as string[]} selected={weekFilters} onChange={setWeekFilters} className="w-full sm:w-64 mt-2" />
      </CardHeader>
      <CardContent>
        {loading ? <p className="text-center text-muted-foreground py-8">Carregando...</p> : sellerData.length === 0 ? (
          <p className="text-center text-muted-foreground py-8">Nenhum dado</p>
        ) : (
          <>
            <Table>
              <TableHeader>
                <TableRow>
                  <SortHead label="Vendedor" sortKey="seller_id" sort={sort} toggle={toggle} />
                  <SortHead label="CLT" sortKey="clt" sort={sort} toggle={toggle} className="text-right" />
                  <SortHead label="FGTS" sortKey="fgts" sort={sort} toggle={toggle} className="text-right" />
                  <SortHead label="Total" sortKey="total" sort={sort} toggle={toggle} className="text-right" />
                  <SortHead label="Chave PIX" sortKey="pix_key" sort={sort} toggle={toggle} />
                </TableRow>
              </TableHeader>
              <TableBody>
                {sortData(sellerData, sort, (s, k) => {
                  if (k === 'seller_id') return getSellerName(s.seller_id);
                  return (s as any)[k];
                }).map(s => (
                  <TableRow key={s.seller_id}>
                    <TableCell className="font-medium">{getSellerName(s.seller_id)}</TableCell>
                    <TableCell className="text-right">{fmt(s.clt)}</TableCell>
                    <TableCell className="text-right">{fmt(s.fgts)}</TableCell>
                    <TableCell className="text-right font-bold text-primary">{fmt(s.total)}</TableCell>
                    <TableCell className="font-mono text-sm">{s.pix_key}</TableCell>
                  </TableRow>
                ))}
                <TableRow className="bg-muted/50 font-bold">
                  <TableCell>TOTAL</TableCell>
                  <TableCell className="text-right">{fmt(sellerData.reduce((a, s) => a + s.clt, 0))}</TableCell>
                  <TableCell className="text-right">{fmt(sellerData.reduce((a, s) => a + s.fgts, 0))}</TableCell>
                  <TableCell className="text-right text-primary">{fmt(grandTotal)}</TableCell>
                  <TableCell />
                </TableRow>
              </TableBody>
            </Table>
          </>
        )}
      </CardContent>
    </Card>
  );
}

// ==================== CONFIG TAB ====================
const DAY_NAMES = ['Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado'];

interface BonusTier {
  id: string;
  min_contracts: number;
  bonus_value: number;
}

function ConfigTab() {
  const { toast } = useToast();
  const [weekStartDay, setWeekStartDay] = useState<number>(5);
  const [paymentDay, setPaymentDay] = useState<number>(4);
  const [bonusThreshold, setBonusThreshold] = useState<string>('');
  const [bonusRate, setBonusRate] = useState<string>('0');
  const [bonusMode, setBonusMode] = useState<string>('valor');
  const [bonusFixedValue, setBonusFixedValue] = useState<string>('0');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // Bonus tiers state
  const [tiers, setTiers] = useState<BonusTier[]>([]);
  const [tierForm, setTierForm] = useState({ min_contracts: '', bonus_value: '' });
  const [editingTier, setEditingTier] = useState<BonusTier | null>(null);
  const [tierDialogOpen, setTierDialogOpen] = useState(false);

  useEffect(() => {
    loadSettings();
    loadTiers();
  }, []);

  const loadSettings = async () => {
    const { data } = await supabase.from('commission_settings').select('*').limit(1).single();
    if (data) {
      setWeekStartDay((data as any).week_start_day ?? 5);
      setPaymentDay((data as any).payment_day ?? 4);
      setBonusThreshold((data as any).bonus_threshold != null ? String((data as any).bonus_threshold) : '');
      setBonusRate(String((data as any).bonus_rate ?? 0));
      setBonusMode((data as any).bonus_mode ?? 'valor');
      setBonusFixedValue(String((data as any).bonus_fixed_value ?? 0));
    }
    setLoading(false);
  };

  const loadTiers = async () => {
    const { data } = await supabase.from('commission_bonus_tiers' as any).select('*').order('min_contracts', { ascending: true });
    if (data) setTiers(data as any as BonusTier[]);
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const { data: existing } = await supabase.from('commission_settings').select('id').limit(1).single();
      if (existing) {
        const { error } = await supabase
          .from('commission_settings')
          .update({
            week_start_day: weekStartDay,
            payment_day: paymentDay,
            bonus_threshold: bonusThreshold ? parseFloat(bonusThreshold) : null,
            bonus_rate: parseFloat(bonusRate) || 0,
            bonus_mode: bonusMode,
            bonus_fixed_value: parseFloat(bonusFixedValue) || 0,
            updated_at: new Date().toISOString(),
          } as any)
          .eq('id', existing.id);
        if (error) throw error;
      }
      toast({ title: 'Configurações salvas' });
    } catch (error: any) {
      toast({ title: 'Erro', description: error.message, variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  const handleSaveTier = async () => {
    const minC = parseInt(tierForm.min_contracts);
    const bonusV = parseFloat(tierForm.bonus_value);
    if (!minC || !bonusV) { toast({ title: 'Preencha contratos e valor', variant: 'destructive' }); return; }
    let error;
    if (editingTier) {
      ({ error } = await supabase.from('commission_bonus_tiers' as any).update({ min_contracts: minC, bonus_value: bonusV } as any).eq('id', editingTier.id));
    } else {
      ({ error } = await supabase.from('commission_bonus_tiers' as any).insert({ min_contracts: minC, bonus_value: bonusV } as any));
    }
    if (error) toast({ title: 'Erro', description: error.message, variant: 'destructive' });
    else { toast({ title: 'Faixa salva' }); setTierDialogOpen(false); loadTiers(); }
  };

  const handleDeleteTier = async (id: string) => {
    if (!confirm('Excluir esta faixa?')) return;
    await supabase.from('commission_bonus_tiers' as any).delete().eq('id', id);
    toast({ title: 'Faixa excluída' });
    loadTiers();
  };

  const isFixedBonus = parseFloat(bonusFixedValue) > 0;

  if (loading) return <p className="text-center text-muted-foreground py-8">Carregando...</p>;

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Settings className="w-5 h-5" />
            Configurações de Comissões
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-6 max-w-md">
          <div className="space-y-2">
            <Label>Dia de início da semana (para agrupamento)</Label>
            <Select value={String(weekStartDay)} onValueChange={v => setWeekStartDay(Number(v))}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {DAY_NAMES.map((name, i) => (
                  <SelectItem key={i} value={String(i)}>{name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">
              Define o dia que inicia a "semana de vendas" para o cálculo do week_label. Atualmente: <strong>{DAY_NAMES[weekStartDay]}</strong>
            </p>
          </div>

          <div className="space-y-2">
            <Label>Dia de pagamento (referência)</Label>
            <Select value={String(paymentDay)} onValueChange={v => setPaymentDay(Number(v))}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {DAY_NAMES.map((name, i) => (
                  <SelectItem key={i} value={String(i)}>{name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">Dia da semana em que os pagamentos são realizados.</p>
          </div>

          <div className="border-t pt-4 space-y-4">
            <h3 className="font-medium text-sm">Bônus Simples (por semana)</h3>

            <div className="space-y-2">
              <Label>Tipo de meta de bônus</Label>
              <Select value={bonusMode} onValueChange={setBonusMode}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="valor">Valor Liberado (R$)</SelectItem>
                  <SelectItem value="contratos">Nº de Contratos</SelectItem>
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                {bonusMode === 'valor'
                  ? 'O bônus é ativado quando o total liberado na semana ultrapassar a meta.'
                  : 'O bônus é ativado quando o vendedor atingir o número mínimo de contratos na semana.'}
              </p>
            </div>

            <div className="space-y-2">
              <Label>{bonusMode === 'valor' ? 'Meta semanal para bônus (R$)' : 'Nº mínimo de contratos na semana'}</Label>
              <Input type="number" step={bonusMode === 'valor' ? '0.01' : '1'}
                placeholder={bonusMode === 'valor' ? 'Ex: 50000' : 'Ex: 10'}
                value={bonusThreshold} onChange={e => setBonusThreshold(e.target.value)} />
              <p className="text-xs text-muted-foreground">Deixe vazio para desativar o bônus simples.</p>
            </div>

            <div className="space-y-2">
              <Label>Tipo de premiação</Label>
              <Select value={isFixedBonus ? 'fixo' : 'taxa'} onValueChange={v => {
                if (v === 'fixo') { setBonusRate('0'); setBonusFixedValue(bonusFixedValue === '0' ? '100' : bonusFixedValue); }
                else { setBonusFixedValue('0'); setBonusRate(bonusRate === '0' ? '0.5' : bonusRate); }
              }}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="taxa">Taxa percentual (%)</SelectItem>
                  <SelectItem value="fixo">Valor fixo (R$)</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {isFixedBonus ? (
              <div className="space-y-2">
                <Label>Valor fixo de bônus por contrato (R$)</Label>
                <Input type="number" step="0.01" placeholder="Ex: 100" value={bonusFixedValue} onChange={e => setBonusFixedValue(e.target.value)} />
              </div>
            ) : (
              <div className="space-y-2">
                <Label>Taxa de bônus extra (%)</Label>
                <Input type="number" step="0.01" placeholder="Ex: 0.5" value={bonusRate} onChange={e => setBonusRate(e.target.value)} />
              </div>
            )}
          </div>

          <div className="p-3 bg-muted rounded-md text-sm text-muted-foreground">
            <p><strong>Como funciona o bônus simples:</strong></p>
            <p className="mt-1">
              {bonusMode === 'valor'
                ? `Quando o valor liberado total na semana ultrapassar R$ ${bonusThreshold || '—'}`
                : `Quando o vendedor atingir ${bonusThreshold || '—'} contratos na semana`}
              {isFixedBonus
                ? `, um bônus fixo de R$ ${bonusFixedValue} é adicionado a cada venda.`
                : `, uma comissão extra de ${bonusRate || '0'}% é adicionada sobre o valor liberado.`}
            </p>
          </div>

          <Button onClick={handleSave} disabled={saving}>
            {saving ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Save className="w-4 h-4 mr-2" />}
            Salvar Configurações
          </Button>
        </CardContent>
      </Card>

      {/* Bonus Tiers Card */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <BarChart3 className="w-5 h-5" />
              Faixas de Bônus por Produção (Mensal)
            </CardTitle>
            <Button size="sm" onClick={() => { setEditingTier(null); setTierForm({ min_contracts: '', bonus_value: '' }); setTierDialogOpen(true); }}>
              <Plus className="w-4 h-4 mr-1" /> Adicionar Faixa
            </Button>
          </div>
          <p className="text-sm text-muted-foreground mt-1">
            Faixas escalonadas de bônus mensal por número de contratos. O vendedor recebe o bônus da faixa mais alta atingida.
          </p>
        </CardHeader>
        <CardContent>
          {tiers.length === 0 ? (
            <p className="text-center text-muted-foreground py-4">Nenhuma faixa cadastrada</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nº Mínimo de Contratos</TableHead>
                  <TableHead className="text-right">Valor do Bônus (R$)</TableHead>
                  <TableHead className="text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {tiers.map(t => (
                  <TableRow key={t.id}>
                    <TableCell className="font-medium">{t.min_contracts} contratos</TableCell>
                    <TableCell className="text-right font-bold text-primary">{fmtBRL(t.bonus_value)}</TableCell>
                    <TableCell className="text-right">
                      <div className="flex gap-1 justify-end">
                        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => {
                          setEditingTier(t);
                          setTierForm({ min_contracts: String(t.min_contracts), bonus_value: String(t.bonus_value) });
                          setTierDialogOpen(true);
                        }}><Pencil className="w-3.5 h-3.5" /></Button>
                        <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => handleDeleteTier(t.id)}>
                          <Trash2 className="w-3.5 h-3.5" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}

          <Dialog open={tierDialogOpen} onOpenChange={setTierDialogOpen}>
            <DialogContent className="max-w-sm">
              <DialogHeader><DialogTitle>{editingTier ? 'Editar Faixa' : 'Nova Faixa de Bônus'}</DialogTitle></DialogHeader>
              <div className="space-y-3">
                <div>
                  <Label>Nº mínimo de contratos</Label>
                  <Input type="number" value={tierForm.min_contracts} onChange={e => setTierForm({ ...tierForm, min_contracts: e.target.value })} placeholder="Ex: 10" />
                </div>
                <div>
                  <Label>Valor do bônus (R$)</Label>
                  <Input type="number" step="0.01" value={tierForm.bonus_value} onChange={e => setTierForm({ ...tierForm, bonus_value: e.target.value })} placeholder="Ex: 200" />
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setTierDialogOpen(false)}>Cancelar</Button>
                <Button onClick={handleSaveTier}>Salvar</Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </CardContent>
      </Card>
    </div>
  );
}

// ==================== HIST IMPORT TAB ====================
function HistImportTab({ userId, profiles, getSellerName }: { userId: string; profiles: Profile[]; getSellerName: (id: string) => string }) {
  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [importing, setImporting] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);

  const findSellerByName = (name: string): string | null => {
    if (!name) return null;
    const q = name.toLowerCase().trim();
    const p = profiles.find(pr => pr.name?.toLowerCase().trim() === q || pr.email.toLowerCase() === q);
    return p?.user_id || null;
  };

  const handleImportFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setImporting(true);
    try {
      const data = await file.arrayBuffer();
      const wb = XLSX.read(data, { type: 'array', cellDates: true });
      const sheetName = wb.SheetNames.find(n => n.toLowerCase().includes('base')) || wb.SheetNames[0];
      const ws = wb.Sheets[sheetName];
      const rows: any[] = XLSX.utils.sheet_to_json(ws, { defval: '' });
      if (rows.length === 0) { toast({ title: 'Planilha vazia', variant: 'destructive' }); return; }

      const normalize = (s: string) => s?.toString().toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim() || '';
      const findCol = (row: any, aliases: string[]) => { const keys = Object.keys(row); for (const alias of aliases) { const found = keys.find(k => normalize(k) === normalize(alias)); if (found) return row[found]; } return undefined; };

      let skipped = 0;
      const payloads: any[] = [];
      for (const row of rows) {
        const rawDate = findCol(row, ['Data Pago', 'data_pago', 'Data', 'data pago']);
        const saleDate = parseExcelDate(rawDate);
        if (!saleDate) { skipped++; continue; }
        const bank = findCol(row, ['Banco', 'banco']) || '';
        const releasedValue = cleanCurrency(findCol(row, ['Valor Liberado', 'valor_liberado', 'Valor', 'valor liberado']));
        if (!bank || releasedValue <= 0) { skipped++; continue; }
        const sellerName = findCol(row, ['Vendedor', 'vendedor'])?.toString() || '';
        payloads.push({
          sale_date: saleDate, product: findCol(row, ['Produto', 'produto']) || 'FGTS', bank,
          term: parseInt(findCol(row, ['Prazo', 'prazo'])) || null, released_value: releasedValue,
          has_insurance: findCol(row, ['Seguro', 'seguro'])?.toString().toLowerCase().trim() === 'sim',
          client_cpf: findCol(row, ['CPF', 'cpf'])?.toString() || null,
          client_name: findCol(row, ['Nome', 'nome', 'Cliente'])?.toString() || null,
          client_phone: findCol(row, ['Telefone', 'telefone', 'Fone'])?.toString() || null,
          seller_id: findSellerByName(sellerName) || userId,
          external_proposal_id: findCol(row, ['id', 'ID', 'Id Proposta', 'external_proposal_id'])?.toString() || null,
          table_name: findCol(row, ['Tabela', 'tabela', 'Table'])?.toString() || null,
          client_birth_date: findCol(row, ['Data Nascimento', 'data_nascimento', 'Nascimento'])?.toString() || null,
          created_by: userId,
        });
      }
      if (payloads.length === 0) { toast({ title: 'Nenhum registro válido encontrado', variant: 'destructive' }); return; }

      const { data: batchRecord, error: batchErr } = await supabase.from('import_batches' as any).insert({
        file_name: file.name, module: 'parceiros', sheet_name: 'base', row_count: payloads.length, imported_by: userId, status: 'active',
      } as any).select('id').single();
      const batchId = batchErr ? null : (batchRecord as any)?.id;
      if (batchId) payloads.forEach(p => { p.batch_id = batchId; });

      let errors = 0;
      for (let i = 0; i < payloads.length; i += 50) {
        const batch = payloads.slice(i, i + 50);
        const { error } = await supabase.from('commission_sales').insert(batch as any);
        if (error) { console.error('Batch error:', error); errors += batch.length; }
      }
      if (batchId && errors > 0) await supabase.from('import_batches' as any).update({ row_count: payloads.length - errors } as any).eq('id', batchId);

      toast({ title: 'Importação concluída', description: `${payloads.length - errors} registros importados${skipped > 0 ? `, ${skipped} ignorados` : ''}${errors > 0 ? `, ${errors} com erro` : ''}` });
      setRefreshKey(k => k + 1);
    } catch (err: any) {
      toast({ title: 'Erro na importação', description: err.message, variant: 'destructive' });
    } finally {
      setImporting(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  return (
    <div className="space-y-4">
      <Card>
        <CardContent className="pt-4">
          <div className="flex items-center gap-3">
            <input type="file" ref={fileInputRef} accept=".xlsx,.xls,.csv" className="hidden" onChange={handleImportFile} />
            <Button variant="outline" size="sm" onClick={() => fileInputRef.current?.click()} disabled={importing}>
              {importing ? <Loader2 className="w-4 h-4 mr-1 animate-spin" /> : <Upload className="w-4 h-4 mr-1" />}
              {importing ? 'Importando...' : 'Importar Excel'}
            </Button>
            <span className="text-xs text-muted-foreground">Importe um arquivo Excel para criar um novo lote na Base</span>
          </div>
        </CardContent>
      </Card>
      <CRImportHistory key={refreshKey} moduleFilter="parceiros" />
    </div>
  );
}

// Clipboard parser imported from @/lib/clipboardParser
const POSITIONAL_HEADERS_13 = ['Data Pago', 'Produto', 'Banco', 'Tabela', 'Prazo', 'Valor Liberado', 'Seguro', 'Telefone', 'Nome', 'CPF', 'Data Nascimento', 'Vendedor', 'ID'];
const POSITIONAL_HEADERS_11 = ['Data Pago', 'Produto', 'Banco', 'Prazo', 'Valor Liberado', 'Seguro', 'Telefone', 'Nome', 'CPF', 'Vendedor', 'ID'];
const POSITIONAL_HEADERS_10 = ['Data Pago', 'Produto', 'Banco', 'Prazo', 'Valor Liberado', 'Seguro', 'Nome', 'CPF', 'Vendedor', 'ID'];
const POSITIONAL_HEADERS_9 = ['Data Pago', 'Produto', 'Banco', 'Prazo', 'Valor Liberado', 'Seguro', 'Nome', 'CPF', 'Vendedor'];

// ==================== PASTE IMPORT DIALOG ====================
function PasteImportButton({ profiles, userId, onImported }: { profiles: Profile[]; userId: string; onImported: () => void }) {
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [text, setText] = useState('');
  const [preview, setPreview] = useState<Record<string, string>[]>([]);
  const [headers, setHeaders] = useState<string[]>([]);
  const [detectedFormat, setDetectedFormat] = useState('');
  const [parseStats, setParseStats] = useState({ rawLines: 0, emptyLines: 0 });
  const [importing, setImporting] = useState(false);
  const [previewPage, setPreviewPage] = useState(0);
  const PREVIEW_PAGE_SIZE = 20;

  const findSellerByName = (name: string): string | null => {
    if (!name) return null;
    const q = name.toLowerCase().trim();
    const p = profiles.find(pr => pr.name?.toLowerCase().trim() === q || pr.email.toLowerCase() === q);
    return p?.user_id || null;
  };

  const doParse = (raw: string) => {
    const result = parseClipboardText(raw, POSITIONAL_HEADERS_11);
    setHeaders(result.headers);
    setPreview(result.rows);
    setDetectedFormat(result.format);
    setParseStats({ rawLines: result.rawLineCount, emptyLines: result.emptyLines });
    setPreviewPage(0);
  };

  const handlePaste = (e: React.ClipboardEvent) => {
    e.preventDefault();
    const pasted = e.clipboardData.getData('text');
    setText(pasted);
    doParse(pasted);
  };

  const handleChange = (val: string) => {
    setText(val);
    doParse(val);
  };

  const handleImport = async () => {
    if (preview.length === 0) return;
    setImporting(true);
    try {
      const normalize = (s: string) => s?.toString().toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim() || '';
      const findCol = (row: Record<string, string>, aliases: string[]) => {
        for (const alias of aliases) {
          const key = Object.keys(row).find(k => normalize(k) === normalize(alias));
          if (key && row[key]) return row[key];
        }
        return undefined;
      };

      let skipped = 0;
      const payloads: any[] = [];
      for (const row of preview) {
        const saleDate = parseExcelDate(findCol(row, ['Data Pago', 'data_pago', 'Data', 'data pago']));
        if (!saleDate) { skipped++; continue; }
        const bank = findCol(row, ['Banco', 'banco']) || '';
        const releasedValue = cleanCurrency(findCol(row, ['Valor Liberado', 'valor_liberado', 'Valor', 'valor liberado']));
        if (!bank || releasedValue <= 0) { skipped++; continue; }
        const sellerName = findCol(row, ['Vendedor', 'vendedor']) || '';
        payloads.push({
          sale_date: saleDate, product: findCol(row, ['Produto', 'produto']) || 'FGTS', bank,
          term: parseInt(findCol(row, ['Prazo', 'prazo']) || '') || null, released_value: releasedValue,
          has_insurance: (findCol(row, ['Seguro', 'seguro']) || '').toLowerCase().trim() === 'sim',
          client_cpf: findCol(row, ['CPF', 'cpf']) || null,
          client_name: findCol(row, ['Nome', 'nome', 'Cliente']) || null,
          client_phone: findCol(row, ['Telefone', 'telefone', 'Fone']) || null,
          seller_id: findSellerByName(sellerName) || userId,
          external_proposal_id: findCol(row, ['id', 'ID', 'Id Proposta']) || null,
          table_name: findCol(row, ['Tabela', 'tabela', 'Table']) || null,
          client_birth_date: findCol(row, ['Data Nascimento', 'data_nascimento', 'Nascimento']) || null,
          created_by: userId,
        });
      }
      if (payloads.length === 0) { toast({ title: 'Nenhum registro válido', variant: 'destructive' }); setImporting(false); return; }

      const { data: batchRecord, error: batchErr } = await supabase.from('import_batches' as any).insert({
        file_name: `colagem_${new Date().toISOString().slice(0, 10)}`, module: 'parceiros', sheet_name: 'base',
        row_count: payloads.length, imported_by: userId, status: 'active',
      } as any).select('id').single();
      const batchId = batchErr ? null : (batchRecord as any)?.id;
      if (batchId) payloads.forEach(p => { p.batch_id = batchId; });

      let errors = 0;
      for (let i = 0; i < payloads.length; i += 50) {
        const batch = payloads.slice(i, i + 50);
        const { error } = await supabase.from('commission_sales').insert(batch as any);
        if (error) { console.error('Batch error:', error); errors += batch.length; }
      }
      if (batchId && errors > 0) await supabase.from('import_batches' as any).update({ row_count: payloads.length - errors } as any).eq('id', batchId);

      toast({ title: 'Importação concluída', description: `${payloads.length - errors} registros${skipped > 0 ? `, ${skipped} ignorados` : ''}${errors > 0 ? `, ${errors} com erro` : ''}` });
      setOpen(false); setText(''); setPreview([]); setHeaders([]);
      onImported();
    } catch (err: any) {
      toast({ title: 'Erro na importação', description: err.message, variant: 'destructive' });
    } finally { setImporting(false); }
  };

  const totalPages = Math.ceil(preview.length / PREVIEW_PAGE_SIZE);
  const pagedRows = preview.slice(previewPage * PREVIEW_PAGE_SIZE, (previewPage + 1) * PREVIEW_PAGE_SIZE);

  return (
    <>
      <Button variant="outline" size="sm" onClick={() => { setOpen(true); setText(''); setPreview([]); setHeaders([]); setPreviewPage(0); }}>
        <ClipboardPaste className="w-4 h-4 mr-1" /> Colar
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-[95vw] w-[1200px] max-h-[90vh] flex flex-col">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2"><ClipboardPaste className="w-5 h-5" /> Importar Dados Colados</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">Cole dados copiados do Excel, Google Sheets ou LibreOffice (Ctrl+V). A primeira linha deve conter os cabeçalhos.</p>
          <textarea
            className="flex min-h-[100px] max-h-[140px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 font-mono"
            placeholder="Cole os dados aqui (Ctrl+V)..."
            value={text}
            onChange={e => handleChange(e.target.value)}
            onPaste={handlePaste}
          />
          {preview.length > 0 && (
            <div className="space-y-2 flex-1 min-h-0 flex flex-col">
              <div className="flex items-center justify-between flex-wrap gap-2">
                <div className="flex items-center gap-3">
                  <Badge variant="secondary" className="text-xs">{detectedFormat}</Badge>
                  <span className="text-sm font-medium">{preview.length} registro(s) válido(s)</span>
                  {parseStats.emptyLines > 0 && <span className="text-xs text-muted-foreground">({parseStats.emptyLines} linhas vazias ignoradas)</span>}
                </div>
                <span className="text-xs text-muted-foreground">{headers.length} colunas detectadas</span>
              </div>
              <div className="border rounded-lg overflow-auto flex-1 min-h-0" style={{ maxHeight: '350px' }}>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="text-xs text-muted-foreground w-10">#</TableHead>
                      {headers.map(h => <TableHead key={h} className="text-xs whitespace-nowrap">{h}</TableHead>)}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {pagedRows.map((row, i) => (
                      <TableRow key={previewPage * PREVIEW_PAGE_SIZE + i}>
                        <TableCell className="text-xs text-muted-foreground py-1">{previewPage * PREVIEW_PAGE_SIZE + i + 1}</TableCell>
                        {headers.map(h => <TableCell key={h} className="text-xs py-1 whitespace-nowrap max-w-[200px] truncate">{row[h]}</TableCell>)}
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
              {totalPages > 1 && (
                <div className="flex items-center justify-center gap-2 pt-1">
                  <Button variant="outline" size="sm" disabled={previewPage === 0} onClick={() => setPreviewPage(p => p - 1)}>Anterior</Button>
                  <span className="text-xs text-muted-foreground">Página {previewPage + 1} de {totalPages}</span>
                  <Button variant="outline" size="sm" disabled={previewPage >= totalPages - 1} onClick={() => setPreviewPage(p => p + 1)}>Próxima</Button>
                </div>
              )}
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Cancelar</Button>
            <Button onClick={handleImport} disabled={importing || preview.length === 0}>
              {importing ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Importando...</> : `Importar ${preview.length} registro(s)`}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}