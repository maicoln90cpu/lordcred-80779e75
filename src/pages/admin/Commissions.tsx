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
import { Plus, Pencil, Trash2, DollarSign, Key, BarChart3, FileSpreadsheet, Search, Upload, Download, ArrowUpDown, ArrowUp, ArrowDown, Settings, Loader2, Save } from 'lucide-react';
import * as XLSX from 'xlsx';

// ==================== SORT UTILITIES ====================
type SortDir = 'asc' | 'desc' | null;
interface SortConfig { key: string; dir: SortDir }

function useSortConfig() {
  const [sort, setSort] = useState<SortConfig>({ key: '', dir: null });
  const toggle = (key: string) => {
    setSort(prev => {
      if (prev.key !== key) return { key, dir: 'asc' };
      if (prev.dir === 'asc') return { key, dir: 'desc' };
      return { key: '', dir: null };
    });
  };
  return { sort, toggle };
}

function sortData<T>(data: T[], sort: SortConfig, getValue: (item: T, key: string) => any): T[] {
  if (!sort.key || !sort.dir) return data;
  return [...data].sort((a, b) => {
    let va = getValue(a, sort.key);
    let vb = getValue(b, sort.key);
    if (va == null) va = '';
    if (vb == null) vb = '';
    if (typeof va === 'number' && typeof vb === 'number') return sort.dir === 'asc' ? va - vb : vb - va;
    const sa = String(va).toLowerCase(), sb = String(vb).toLowerCase();
    return sort.dir === 'asc' ? sa.localeCompare(sb) : sb.localeCompare(sa);
  });
}

function SortHead({ label, sortKey, sort, toggle, className }: { label: string; sortKey: string; sort: SortConfig; toggle: (k: string) => void; className?: string }) {
  const Icon = sort.key === sortKey ? (sort.dir === 'asc' ? ArrowUp : ArrowDown) : ArrowUpDown;
  return (
    <TableHead className={`cursor-pointer select-none hover:bg-muted/50 ${className || ''}`} onClick={() => toggle(sortKey)}>
      <span className="inline-flex items-center gap-1">
        {label}
        <Icon className={`w-3 h-3 ${sort.key === sortKey ? 'text-foreground' : 'text-muted-foreground/50'}`} />
      </span>
    </TableHead>
  );
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

// ==================== EXPORT HELPERS ====================
const fmtBRL = (v: number) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

function exportToExcel(data: Record<string, string | number>[], filename: string, sheetName = 'Dados') {
  const ws = XLSX.utils.json_to_sheet(data);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, sheetName);
  XLSX.writeFile(wb, filename);
}

function parseExcelDate(v: any): string | null {
  if (!v) return null;
  // Handle Date objects (from cellDates: true)
  if (v instanceof Date && !isNaN(v.getTime())) {
    return v.toISOString().slice(0, 16);
  }
  if (typeof v === 'number') {
    const d = XLSX.SSF.parse_date_code(v);
    if (d) return `${d.y}-${String(d.m).padStart(2, '0')}-${String(d.d).padStart(2, '0')}T${String(d.H || 0).padStart(2, '0')}:${String(d.M || 0).padStart(2, '0')}`;
  }
  if (typeof v === 'string') {
    const parts = v.match(/(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})(?:\s+(\d{1,2}):(\d{1,2})(?::(\d{1,2}))?)?/);
    if (parts) return `${parts[3]}-${parts[2].padStart(2, '0')}-${parts[1].padStart(2, '0')}T${(parts[4] || '12').padStart(2, '0')}:${(parts[5] || '00').padStart(2, '0')}`;
    const iso = new Date(v);
    if (!isNaN(iso.getTime())) return iso.toISOString().slice(0, 16);
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
        </Tabs>
      </div>
    </DashboardLayout>
  );
}

// ==================== BASE TAB ====================
function BaseTab({ profiles, getSellerName, isAdmin, userId }: { profiles: Profile[]; getSellerName: (id: string) => string; isAdmin: boolean; userId: string }) {
  const { toast } = useToast();
  const [sales, setSales] = useState<CommissionSale[]>([]);
  const { sort, toggle } = useSortConfig();
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingSale, setEditingSale] = useState<CommissionSale | null>(null);
  const [search, setSearch] = useState('');
  const [weekFilter, setWeekFilter] = useState('');
  const [importing, setImporting] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [form, setForm] = useState({
    sale_date: '', product: 'FGTS', bank: '', term: '', released_value: '',
    has_insurance: false, client_cpf: '', client_name: '', client_phone: '',
    seller_id: userId, external_proposal_id: ''
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
    if (weekFilter && s.week_label !== weekFilter) return false;
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
      seller_id: userId, external_proposal_id: ''
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
      external_proposal_id: sale.external_proposal_id || ''
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
          created_by: userId,
        });
        imported++;
      }

      // Insert in batches
      let errors = 0;
      for (let i = 0; i < payloads.length; i += batchSize) {
        const batch = payloads.slice(i, i + batchSize);
        const { error } = await supabase.from('commission_sales').insert(batch as any);
        if (error) { console.error('Batch error:', error); errors += batch.length; }
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
      'Prazo': s.term || '',
      'Valor Liberado': s.released_value,
      'Seguro': s.has_insurance ? 'Sim' : 'Não',
      'CPF': s.client_cpf || '',
      'Nome': s.client_name || '',
      'Telefone': s.client_phone || '',
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
            <div className="flex gap-2">
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
              <Button variant="outline" size="sm" onClick={handleExportBase} disabled={filteredSales.length === 0}>
                <Download className="w-4 h-4 mr-1" /> Exportar
              </Button>
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
          <Select value={weekFilter} onValueChange={v => setWeekFilter(v === 'all' ? '' : v)}>
            <SelectTrigger className="w-full sm:w-64">
              <SelectValue placeholder="Filtrar por semana" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todas as semanas</SelectItem>
              {weeks.map(w => <SelectItem key={w} value={w!}>{w}</SelectItem>)}
            </SelectContent>
          </Select>
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
                  <SortHead label="Semana" sortKey="week_label" sort={sort} toggle={toggle} />
                  <SortHead label="Data" sortKey="sale_date" sort={sort} toggle={toggle} />
                  <SortHead label="Produto" sortKey="product" sort={sort} toggle={toggle} />
                  <SortHead label="Banco" sortKey="bank" sort={sort} toggle={toggle} />
                  <SortHead label="Prazo" sortKey="term" sort={sort} toggle={toggle} />
                  <SortHead label="Valor Lib." sortKey="released_value" sort={sort} toggle={toggle} className="text-right" />
                  <SortHead label="Seguro" sortKey="has_insurance" sort={sort} toggle={toggle} />
                  <SortHead label="Cliente" sortKey="client_name" sort={sort} toggle={toggle} />
                  <SortHead label="Vendedor" sortKey="seller_id" sort={sort} toggle={toggle} />
                  <SortHead label="Taxa" sortKey="commission_rate" sort={sort} toggle={toggle} className="text-right" />
                  <SortHead label="Comissão" sortKey="commission_value" sort={sort} toggle={toggle} className="text-right" />
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
                    <TableCell className="text-xs text-muted-foreground whitespace-nowrap">{sale.week_label || '-'}</TableCell>
                    <TableCell className="whitespace-nowrap">{new Date(sale.sale_date).toLocaleDateString('pt-BR')}</TableCell>
                    <TableCell>
                      <Badge variant={sale.product === 'FGTS' ? 'default' : 'secondary'}>
                        {sale.product === 'Crédito do Trabalhador' ? 'CLT' : sale.product}
                      </Badge>
                    </TableCell>
                    <TableCell>{sale.bank}</TableCell>
                    <TableCell>{sale.term ? `${sale.term}m` : '-'}</TableCell>
                    <TableCell className="text-right font-medium">{fmt(sale.released_value)}</TableCell>
                    <TableCell>{sale.has_insurance ? 'Sim' : 'Não'}</TableCell>
                    <TableCell className="text-sm">{sale.client_name || '-'}</TableCell>
                    <TableCell className="text-sm">{getSellerName(sale.seller_id)}</TableCell>
                    <TableCell className="text-right">{sale.commission_rate}%</TableCell>
                    <TableCell className="text-right font-bold text-primary">{fmt(sale.commission_value)}</TableCell>
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
              {isAdmin && (
                <div className="col-span-2">
                  <Label>Vendedor</Label>
                  <Select value={form.seller_id} onValueChange={v => setForm({ ...form, seller_id: v })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {profiles.map(p => (
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
                      {profiles.map(p => <SelectItem key={p.user_id} value={p.user_id}>{p.name || p.email}</SelectItem>)}
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
  const [form, setForm] = useState({ effective_date: '', bank: '', term_min: '0', term_max: '999', has_insurance: false, rate: '', obs: '' });
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
    setForm({ effective_date: new Date().toISOString().slice(0, 10), bank: '', term_min: '0', term_max: '999', has_insurance: false, rate: '', obs: '' });
    setDialogOpen(true);
  };

  const openEdit = (r: RateCLT) => {
    setEditing(r);
    setForm({
      effective_date: r.effective_date, bank: r.bank,
      term_min: r.term_min.toString(), term_max: r.term_max.toString(),
      has_insurance: r.has_insurance, rate: r.rate.toString(), obs: r.obs || ''
    });
    setDialogOpen(true);
  };

  const handleSave = async () => {
    if (!form.bank || !form.effective_date || !form.rate) { toast({ title: 'Preencha campos obrigatórios', variant: 'destructive' }); return; }
    const payload = {
      effective_date: form.effective_date, bank: form.bank,
      term_min: parseInt(form.term_min) || 0, term_max: parseInt(form.term_max) || 999,
      has_insurance: form.has_insurance, rate: parseFloat(form.rate) || 0, obs: form.obs || null,
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
              <div className="col-span-2"><Label>Observação</Label><Input value={form.obs} onChange={e => setForm({ ...form, obs: e.target.value })} placeholder="Ex: 2 parceiros" /></div>
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
  const [weekFilter, setWeekFilter] = useState('all');
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
    if (weekFilter !== 'all' && s.week_label !== weekFilter) return false;
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
                {profiles.map(p => <SelectItem key={p.user_id} value={p.user_id}>{p.name || p.email}</SelectItem>)}
              </SelectContent>
            </Select>
          )}
          <Select value={weekFilter} onValueChange={setWeekFilter}>
            <SelectTrigger className="w-full sm:w-64"><SelectValue placeholder="Semana" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todas as semanas</SelectItem>
              {weeks.map(w => <SelectItem key={w} value={w!}>{w}</SelectItem>)}
            </SelectContent>
          </Select>
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
  const [weekFilter, setWeekFilter] = useState('all');
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
  const filtered = weekFilter === 'all' ? sales : sales.filter(s => s.week_label === weekFilter);

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
    const suffix = weekFilter !== 'all' ? '_' + weekFilter.replace(/[\/\s]/g, '-') : '';
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
        <Select value={weekFilter} onValueChange={setWeekFilter}>
          <SelectTrigger className="w-full sm:w-64 mt-2"><SelectValue placeholder="Semana" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todas as semanas</SelectItem>
            {weeks.map(w => <SelectItem key={w} value={w!}>{w}</SelectItem>)}
          </SelectContent>
        </Select>
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

function ConfigTab() {
  const { toast } = useToast();
  const [weekStartDay, setWeekStartDay] = useState<number>(5);
  const [paymentDay, setPaymentDay] = useState<number>(4);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    loadSettings();
  }, []);

  const loadSettings = async () => {
    const { data } = await supabase.from('commission_settings').select('*').limit(1).single();
    if (data) {
      setWeekStartDay((data as any).week_start_day ?? 5);
      setPaymentDay((data as any).payment_day ?? 4);
    }
    setLoading(false);
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const { data: existing } = await supabase.from('commission_settings').select('id').limit(1).single();
      if (existing) {
        const { error } = await supabase
          .from('commission_settings')
          .update({ week_start_day: weekStartDay, payment_day: paymentDay, updated_at: new Date().toISOString() } as any)
          .eq('id', existing.id);
        if (error) throw error;
      }
      toast({ title: 'Configurações salvas', description: `Semana inicia na ${DAY_NAMES[weekStartDay]}, pagamento na ${DAY_NAMES[paymentDay]}` });
    } catch (error: any) {
      toast({ title: 'Erro', description: error.message, variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <p className="text-center text-muted-foreground py-8">Carregando...</p>;

  return (
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
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
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
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {DAY_NAMES.map((name, i) => (
                <SelectItem key={i} value={String(i)}>{name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <p className="text-xs text-muted-foreground">
            Dia da semana em que os pagamentos são realizados (apenas para referência visual).
          </p>
        </div>

        <div className="p-3 bg-muted rounded-md text-sm text-muted-foreground">
          <p><strong>Como funciona:</strong></p>
          <p className="mt-1">Novas vendas importadas terão o <code>week_label</code> calculado automaticamente com base no dia de início configurado.</p>
          <p className="mt-1">Vendas já existentes mantêm o label original. Para recalcular, reimporte ou edite a venda.</p>
        </div>

        <Button onClick={handleSave} disabled={saving}>
          {saving ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Save className="w-4 h-4 mr-2" />}
          Salvar Configurações
        </Button>
      </CardContent>
    </Card>
  );
}
