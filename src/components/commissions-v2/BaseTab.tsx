import { useState, useEffect, useRef } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Checkbox } from '@/components/ui/checkbox';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { Plus, Pencil, Trash2, FileSpreadsheet, Search, Upload, Download, Columns, Eraser } from 'lucide-react';
import * as XLSX from 'xlsx';
import { TSHead, useSortState, applySortToData, TOOLTIPS_PARCEIROS_BASE } from '@/components/commission-reports/CRSortUtils';
import type { CommissionSale, Profile } from './commissionUtils';
import { fmtBRL, exportToExcel, formatDateBR, toDatetimeLocalBR, toBrasiliaTimestamp, parseExcelDate, cleanCurrency } from './commissionUtils';
import { resolveSellerByName } from '@/lib/sellerNameMatch';
import WeekMultiSelect from './WeekMultiSelect';
import PasteImportButton from './PasteImportButton';

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
  const saved = localStorage.getItem('comm_v2_base_visible_cols');
  if (saved) { try { return JSON.parse(saved); } catch {} }
  return BASE_COLUMNS.filter(c => c.defaultVisible).map(c => c.key);
}

interface BaseTabProps {
  profiles: Profile[];
  getSellerName: (id: string) => string;
  isAdmin: boolean;
  userId: string;
}

export default function BaseTab({ profiles, getSellerName, isAdmin, userId }: BaseTabProps) {
  const { toast } = useToast();
  const [sales, setSales] = useState<CommissionSale[]>([]);
  const { sort, toggle } = useSortState();
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
      localStorage.setItem('comm_v2_base_visible_cols', JSON.stringify(next));
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
      .from('commission_sales_v2')
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
      sale_date: toDatetimeLocalBR(new Date().toISOString()),
      product: 'FGTS', bank: '', term: '', released_value: '',
      has_insurance: false, client_cpf: '', client_name: '', client_phone: '',
      seller_id: userId, external_proposal_id: '', table_name: '', client_birth_date: ''
    });
    setDialogOpen(true);
  };

  const openEdit = (sale: CommissionSale) => {
    setEditingSale(sale);
    setForm({
      sale_date: toDatetimeLocalBR(sale.sale_date),
      product: sale.product, bank: sale.bank,
      term: sale.term?.toString() || '', released_value: sale.released_value.toString(),
      has_insurance: sale.has_insurance, client_cpf: sale.client_cpf || '',
      client_name: sale.client_name || '', client_phone: sale.client_phone || '',
      seller_id: sale.seller_id, external_proposal_id: sale.external_proposal_id || '',
      table_name: sale.table_name || '', client_birth_date: sale.client_birth_date || ''
    });
    setDialogOpen(true);
  };

  const handleSave = async () => {
    if (!form.bank || !form.released_value || !form.sale_date) {
      toast({ title: 'Preencha os campos obrigatórios', variant: 'destructive' });
      return;
    }
    const payload = {
      sale_date: toBrasiliaTimestamp(form.sale_date), product: form.product, bank: form.bank,
      term: form.term ? parseInt(form.term) : null, released_value: parseFloat(form.released_value),
      has_insurance: form.has_insurance, client_cpf: form.client_cpf || null,
      client_name: form.client_name || null, client_phone: form.client_phone || null,
      seller_id: form.seller_id, external_proposal_id: form.external_proposal_id || null,
      table_name: form.table_name || null, client_birth_date: form.client_birth_date || null,
      created_by: userId,
    };
    let error;
    if (editingSale) {
      ({ error } = await supabase.from('commission_sales_v2').update(payload as any).eq('id', editingSale.id));
    } else {
      ({ error } = await supabase.from('commission_sales_v2').insert(payload as any));
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
    const { error } = await supabase.from('commission_sales_v2').delete().eq('id', id);
    if (error) toast({ title: 'Erro', description: error.message, variant: 'destructive' });
    else { toast({ title: 'Venda excluída' }); loadSales(); }
  };

  const fmt = (v: number) => fmtBRL(v);

  const findSellerByName = async (name: string): Promise<string | null> => {
    const r = await resolveSellerByName(name, profiles);
    if (!r.userId) return null;
    if (r.ambiguous) {
      console.warn('[commissions base V2] match ambíguo descartado para', name, r);
      return null;
    }
    return r.userId;
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
      if (rows.length === 0) { toast({ title: 'Planilha vazia', variant: 'destructive' }); setImporting(false); return; }

      const normalize = (s: string) => s?.toString().toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim() || '';
      const findCol = (row: any, aliases: string[]) => {
        const keys = Object.keys(row);
        for (const alias of aliases) { const found = keys.find(k => normalize(k) === normalize(alias)); if (found) return row[found]; }
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
        const sellerId = (await findSellerByName(sellerName)) || userId;
        payloads.push({
          sale_date: saleDate, product: product || 'FGTS', bank, term, released_value: releasedValue,
          has_insurance: hasInsurance, client_cpf: cpf, client_name: name, client_phone: phone,
          seller_id: sellerId, external_proposal_id: proposalId, table_name: tableName,
          client_birth_date: birthDate, created_by: userId,
        });
        imported++;
      }

      if (payloads.length === 0) { toast({ title: 'Nenhum registro válido encontrado', variant: 'destructive' }); setImporting(false); return; }

      const { data: batchRecord, error: batchErr } = await supabase.from('import_batches' as any).insert({
        file_name: file.name, module: 'parceiros_v2', sheet_name: 'base', row_count: payloads.length, imported_by: userId, status: 'active',
      } as any).select('id').single();

      const batchId = batchErr ? null : (batchRecord as any)?.id;
      if (batchId) payloads.forEach(p => { p.batch_id = batchId; });

      let errors = 0;
      for (let i = 0; i < payloads.length; i += batchSize) {
        const batch = payloads.slice(i, i + batchSize);
        const { error } = await supabase.from('commission_sales_v2').insert(batch as any);
        if (error) { console.error('Batch error:', error); errors += batch.length; }
      }
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
      'Semana': s.week_label || '', 'Data Pago': formatDateBR(s.sale_date), 'Produto': s.product,
      'Banco': s.bank, 'Tabela': s.table_name || '', 'Prazo': s.term || '',
      'Valor Liberado': s.released_value, 'Seguro': s.has_insurance ? 'Sim' : 'Não',
      'CPF': s.client_cpf || '', 'Nome': s.client_name || '', 'Telefone': s.client_phone || '',
      'Data Nascimento': s.client_birth_date || '', 'Vendedor': getSellerName(s.seller_id),
      'ID': s.external_proposal_id || '', 'Taxa %': s.commission_rate, 'Comissão': s.commission_value,
    }));
    exportToExcel(data, 'comissoes_base.xlsx', 'Base');
    toast({ title: 'Exportado com sucesso' });
  };

  // Função handleCopyFromV1 removida ao promover V2 a módulo oficial.
  // Histórico V1 (legado) continua acessível em /admin/commissions, mas sem cópia automática.

  const handleClearV2 = async () => {
    const { count } = await supabase
      .from('commission_sales_v2')
      .select('*', { count: 'exact', head: true });
    if (!count || count === 0) {
      toast({ title: 'Nenhuma venda para apagar' });
      return;
    }
    // Confirmação dupla: agora é módulo de produção, exigir digitar a palavra CONFIRMAR
    const typed = window.prompt(
      `ATENÇÃO: você está prestes a APAGAR todas as ${count} venda(s) do módulo Comissões Parceiros.\n\nEsta ação NÃO pode ser desfeita.\n\nPara prosseguir, digite a palavra CONFIRMAR (em maiúsculas):`
    );
    if (typed !== 'CONFIRMAR') {
      toast({ title: 'Cancelado', description: 'Texto não confere — nada foi apagado.' });
      return;
    }
    const { error } = await supabase
      .from('commission_sales_v2')
      .delete()
      .neq('id', '00000000-0000-0000-0000-000000000000');
    if (error) {
      toast({ title: 'Erro ao limpar', description: error.message, variant: 'destructive' });
    } else {
      toast({ title: '🗑️ Vendas removidas', description: `${count} venda(s) apagada(s) do módulo de comissões parceiros.` });
      loadSales();
    }
  };


  return (
    <Card>
      <CardHeader>
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
          <CardTitle className="flex items-center gap-2"><FileSpreadsheet className="w-5 h-5" /> Vendas / Comissões</CardTitle>
          {isAdmin && (
            <div className="flex gap-2 flex-wrap">
              <input type="file" ref={fileInputRef} accept=".xlsx,.xls,.csv" className="hidden" onChange={handleImportFile} />
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
              <Button onClick={openCreate} size="sm"><Plus className="w-4 h-4 mr-1" /> Nova Venda</Button>
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
                    <TSHead key={col.key} label={col.label} sortKey={col.key} sort={sort} toggle={toggle}
                      className={['released_value', 'commission_rate', 'commission_value'].includes(col.key) ? 'text-right' : ''} />
                  ))}
                  {isAdmin && <TableHead className="text-right">Ações</TableHead>}
                </TableRow>
              </TableHeader>
              <TableBody>
                {applySortToData(filteredSales, sort, (s, k) => {
                  if (k === 'seller_id') return getSellerName(s.seller_id);
                  if (k === 'has_insurance') return s.has_insurance ? 'Sim' : 'Não';
                  return (s as any)[k];
                }).map(sale => (
                  <TableRow key={sale.id}>
                    {BASE_COLUMNS.filter(c => visibleCols.includes(c.key)).map(col => {
                      const key = col.key;
                      if (key === 'week_label') return <TableCell key={key} className="text-xs text-muted-foreground whitespace-nowrap">{sale.week_label || '-'}</TableCell>;
                      if (key === 'sale_date') return <TableCell key={key} className="whitespace-nowrap">{formatDateBR(sale.sale_date)}</TableCell>;
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
                          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => openEdit(sale)}><Pencil className="w-3.5 h-3.5" /></Button>
                          <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => handleDelete(sale.id)}><Trash2 className="w-3.5 h-3.5" /></Button>
                        </div>
                      </TableCell>
                    )}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}

        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
            <DialogHeader><DialogTitle>{editingSale ? 'Editar Venda' : 'Nova Venda'}</DialogTitle></DialogHeader>
            <div className="grid grid-cols-2 gap-3">
              <div><Label>Data Pago *</Label><Input type="datetime-local" value={form.sale_date} onChange={e => setForm({ ...form, sale_date: e.target.value })} /></div>
              <div><Label>Produto *</Label>
                <Select value={form.product} onValueChange={v => setForm({ ...form, product: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent><SelectItem value="FGTS">FGTS</SelectItem><SelectItem value="Crédito do Trabalhador">Crédito do Trabalhador</SelectItem></SelectContent>
                </Select>
              </div>
              <div><Label>Banco *</Label><Input value={form.bank} onChange={e => setForm({ ...form, bank: e.target.value })} placeholder="Ex: PARANA BANCO" /></div>
              <div><Label>Prazo (meses)</Label><Input type="number" value={form.term} onChange={e => setForm({ ...form, term: e.target.value })} placeholder="Ex: 12" /></div>
              <div><Label>Valor Liberado *</Label><Input type="number" step="0.01" value={form.released_value} onChange={e => setForm({ ...form, released_value: e.target.value })} /></div>
              <div className="flex items-end gap-2 pb-1"><Switch checked={form.has_insurance} onCheckedChange={v => setForm({ ...form, has_insurance: v })} /><Label>Seguro</Label></div>
              <div><Label>CPF</Label><Input value={form.client_cpf} onChange={e => setForm({ ...form, client_cpf: e.target.value })} /></div>
              <div><Label>Nome Cliente</Label><Input value={form.client_name} onChange={e => setForm({ ...form, client_name: e.target.value })} /></div>
              <div><Label>Telefone</Label><Input value={form.client_phone} onChange={e => setForm({ ...form, client_phone: e.target.value })} /></div>
              <div><Label>ID Proposta</Label><Input value={form.external_proposal_id} onChange={e => setForm({ ...form, external_proposal_id: e.target.value })} /></div>
              <div><Label>Tabela</Label><Input value={form.table_name} onChange={e => setForm({ ...form, table_name: e.target.value })} placeholder="Ex: FOCO NO CORBAN" /></div>
              <div><Label>Data Nascimento</Label><Input value={form.client_birth_date} onChange={e => setForm({ ...form, client_birth_date: e.target.value })} placeholder="DD/MM/AAAA" /></div>
              {isAdmin && (
                <div className="col-span-2"><Label>Vendedor</Label>
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
