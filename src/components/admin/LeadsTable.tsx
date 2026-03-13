import { useState, useMemo } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { Trash2, Search, Users, Loader2, Download, ChevronLeft, ChevronRight } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import * as XLSX from 'xlsx';

// Format date: handles Excel serial numbers and various string formats -> dd/mm/aaaa
function formatDate(value: string | number | null | undefined): string {
  if (!value) return '-';
  // Excel serial number (numeric string or number)
  const num = typeof value === 'number' ? value : Number(value);
  if (!isNaN(num) && num > 10000 && num < 100000) {
    // Excel date serial: days since 1900-01-01 (with the Excel leap year bug)
    const excelEpoch = new Date(1900, 0, 1);
    const date = new Date(excelEpoch.getTime() + (num - 2) * 86400000);
    if (!isNaN(date.getTime())) {
      return date.toLocaleDateString('pt-BR');
    }
  }
  // Try parsing as date string (yyyy-mm-dd, dd/mm/yyyy, etc.)
  const str = String(value).trim();
  // Already dd/mm/yyyy?
  if (/^\d{2}\/\d{2}\/\d{4}$/.test(str)) return str;
  // yyyy-mm-dd
  if (/^\d{4}-\d{2}-\d{2}/.test(str)) {
    const d = new Date(str);
    if (!isNaN(d.getTime())) return d.toLocaleDateString('pt-BR');
  }
  return str;
}

const PAGE_SIZE = 50;

const DEFAULT_STATUS_OPTIONS = [
  { value: 'pendente', label: 'Pendente', color_class: 'bg-muted text-muted-foreground' },
  { value: 'CHAMEI', label: 'Chamei', color_class: 'bg-blue-500/20 text-blue-400' },
  { value: 'NÃO ATENDEU', label: 'Não Atendeu', color_class: 'bg-yellow-500/20 text-yellow-400' },
  { value: 'NÃO EXISTE', label: 'Não Existe', color_class: 'bg-red-500/20 text-red-400' },
  { value: 'APROVADO', label: 'Aprovado', color_class: 'bg-green-500/20 text-green-400' },
];

interface ColumnConfig {
  key: string;
  label: string;
  visible: boolean;
}

interface LeadsTableProps {
  filterSeller?: string;
  filterStatus?: string;
  filterBatch?: string;
  onFiltersChange?: (filters: { seller: string; status: string; batch: string }) => void;
  statusOptions?: Array<{ value: string; label: string; color_class: string }>;
  columnConfig?: ColumnConfig[];
}

export default function LeadsTable({ filterSeller: extSeller, filterStatus: extStatus, filterBatch: extBatch, onFiltersChange, statusOptions = DEFAULT_STATUS_OPTIONS, columnConfig }: LeadsTableProps) {
  const [filterSeller, setFilterSeller] = useState<string>(extSeller || 'all');
  const [filterStatus, setFilterStatus] = useState<string>(extStatus || 'all');
  const [filterBatch, setFilterBatch] = useState<string>(extBatch || 'all');
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [page, setPage] = useState(0);
  const [bulkAction, setBulkAction] = useState<'delete' | 'status' | 'reassign' | null>(null);
  const [bulkStatus, setBulkStatus] = useState('pendente');
  const [bulkSeller, setBulkSeller] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Sync external filters
  const actualSeller = extSeller ?? filterSeller;
  const actualStatus = extStatus ?? filterStatus;
  const actualBatch = extBatch ?? filterBatch;

  const updateFilter = (key: 'seller' | 'status' | 'batch', value: string) => {
    if (key === 'seller') setFilterSeller(value);
    if (key === 'status') setFilterStatus(value);
    if (key === 'batch') setFilterBatch(value);
    setPage(0);
    onFiltersChange?.({
      seller: key === 'seller' ? value : actualSeller,
      status: key === 'status' ? value : actualStatus,
      batch: key === 'batch' ? value : actualBatch,
    });
  };

  const statusColorMap = useMemo(() => {
    const map: Record<string, string> = {};
    statusOptions.forEach(s => { map[s.value] = s.color_class; });
    return map;
  }, [statusOptions]);

  const { data: sellers = [] } = useQuery({
    queryKey: ['sellers-list'],
    queryFn: async () => {
      const { data: profiles } = await supabase.from('profiles').select('user_id, name, email');
      return profiles || [];
    }
  });

  const { data: leads = [], isLoading } = useQuery({
    queryKey: ['admin-leads', actualSeller, actualStatus, actualBatch, searchTerm],
    queryFn: async () => {
      let query = supabase.from('client_leads' as any).select('*').order('created_at', { ascending: false });
      if (actualSeller !== 'all') query = query.eq('assigned_to', actualSeller);
      if (actualStatus !== 'all') query = query.eq('status', actualStatus);
      if (actualBatch !== 'all') query = query.eq('batch_name', actualBatch);
      if (searchTerm) query = query.or(`nome.ilike.%${searchTerm}%,telefone.ilike.%${searchTerm}%,cpf.ilike.%${searchTerm}%`);
      const { data, error } = await query.limit(1000);
      if (error) throw error;
      return data as any[];
    }
  });

  const batchNames = useMemo(() => {
    const names = new Set<string>();
    leads.forEach((l: any) => l.batch_name && names.add(l.batch_name));
    return Array.from(names).sort();
  }, [leads]);

  const totalPages = Math.max(1, Math.ceil(leads.length / PAGE_SIZE));
  const pagedLeads = leads.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);

  const allPageSelected = pagedLeads.length > 0 && pagedLeads.every((l: any) => selectedIds.has(l.id));

  const toggleAll = () => {
    const next = new Set(selectedIds);
    if (allPageSelected) {
      pagedLeads.forEach((l: any) => next.delete(l.id));
    } else {
      pagedLeads.forEach((l: any) => next.add(l.id));
    }
    setSelectedIds(next);
  };

  const toggleOne = (id: string) => {
    const next = new Set(selectedIds);
    next.has(id) ? next.delete(id) : next.add(id);
    setSelectedIds(next);
  };

  const invalidateAll = () => {
    queryClient.invalidateQueries({ queryKey: ['admin-leads'] });
    queryClient.invalidateQueries({ queryKey: ['admin-leads-metrics'] });
  };

  const handleBulkDelete = async () => {
    setIsProcessing(true);
    try {
      const ids = Array.from(selectedIds);
      for (let i = 0; i < ids.length; i += 50) {
        const batch = ids.slice(i, i + 50);
        const { error } = await supabase.from('client_leads' as any).delete().in('id', batch);
        if (error) throw error;
      }
      toast({ title: `${ids.length} leads excluídos` });
      setSelectedIds(new Set());
      invalidateAll();
    } catch (e: any) {
      toast({ title: 'Erro', description: e.message, variant: 'destructive' });
    } finally {
      setIsProcessing(false);
      setBulkAction(null);
    }
  };

  const handleBulkStatus = async () => {
    setIsProcessing(true);
    try {
      const ids = Array.from(selectedIds);
      for (let i = 0; i < ids.length; i += 50) {
        const batch = ids.slice(i, i + 50);
        const { error } = await supabase.from('client_leads' as any).update({
          status: bulkStatus, updated_at: new Date().toISOString()
        }).in('id', batch);
        if (error) throw error;
      }
      toast({ title: `Status de ${ids.length} leads atualizado` });
      setSelectedIds(new Set());
      invalidateAll();
    } catch (e: any) {
      toast({ title: 'Erro', description: e.message, variant: 'destructive' });
    } finally {
      setIsProcessing(false);
      setBulkAction(null);
    }
  };

  const handleBulkReassign = async () => {
    if (!bulkSeller) return;
    setIsProcessing(true);
    try {
      const ids = Array.from(selectedIds);
      for (let i = 0; i < ids.length; i += 50) {
        const batch = ids.slice(i, i + 50);
        const { error } = await supabase.from('client_leads' as any).update({
          assigned_to: bulkSeller, updated_at: new Date().toISOString()
        }).in('id', batch);
        if (error) throw error;
      }
      toast({ title: `${ids.length} leads reatribuídos` });
      setSelectedIds(new Set());
      invalidateAll();
    } catch (e: any) {
      toast({ title: 'Erro', description: e.message, variant: 'destructive' });
    } finally {
      setIsProcessing(false);
      setBulkAction(null);
    }
  };

  const handleExport = () => {
    const exportData = leads.map((l: any) => ({
      Nome: l.nome,
      Telefone: l.telefone,
      CPF: l.cpf,
      'Valor Lib.': l.valor_lib,
      Prazo: l.prazo,
      Parcela: l.vlr_parcela,
      'Banco Nome': l.banco_nome,
      'Banco Código': l.banco_codigo,
      'Banco Simulado': l.banco_simulado,
      Agência: l.agencia,
      Conta: l.conta,
      Aprovado: l.aprovado,
      Reprovado: l.reprovado,
      'Data Nasc.': l.data_nasc,
      'Nome Mãe': l.nome_mae,
      'Data Ref.': l.data_ref,
      Status: l.status,
      Vendedor: getSellerName(l.assigned_to),
      Lote: l.batch_name,
      Observações: l.notes,
      'Data Criação': l.created_at,
      'Contatado em': l.contacted_at,
    }));
    const ws = XLSX.utils.json_to_sheet(exportData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Leads');
    XLSX.writeFile(wb, `leads_export_${new Date().toISOString().slice(0, 10)}.xlsx`);
  };

  const handleDelete = async (id: string) => {
    const { error } = await supabase.from('client_leads' as any).delete().eq('id', id);
    if (error) {
      toast({ title: 'Erro ao excluir', description: error.message, variant: 'destructive' });
    } else {
      invalidateAll();
      toast({ title: 'Lead excluído' });
    }
  };

  const getSellerName = (userId: string) => {
    const seller = sellers.find((s: any) => s.user_id === userId);
    return seller?.name || seller?.email || 'N/A';
  };

  // Visible columns in order
  const visibleCols = useMemo(() => {
    if (!columnConfig) return null; // null means use hardcoded fallback
    return columnConfig.filter(c => c.visible);
  }, [columnConfig]);

  const renderCellValue = (lead: any, key: string) => {
    switch (key) {
      case 'valor_lib':
        return lead.valor_lib ? Number(lead.valor_lib).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }) : '-';
      case 'vlr_parcela':
        return lead.vlr_parcela ? Number(lead.vlr_parcela).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }) : '-';
      case 'data_nasc':
      case 'data_ref':
        return formatDate(lead[key]);
      case 'status':
        return <Badge className={statusColorMap[lead.status] || 'bg-muted text-muted-foreground'}>{lead.status}</Badge>;
      case 'assigned_to':
        return getSellerName(lead.assigned_to);
      case 'notes':
        return <span className="max-w-[200px] truncate block">{lead[key] || '-'}</span>;
      default:
        return lead[key] || '-';
    }
  };

  return (
    <>
      <div className="space-y-4">
        {/* Card 1: Header + Filtros + Bulk Actions */}
        <Card className="w-full">
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="flex items-center gap-2">
                <Users className="w-5 h-5" />
                Todos os Leads
              </CardTitle>
              <Button variant="outline" size="sm" onClick={handleExport} disabled={leads.length === 0}>
                <Download className="w-4 h-4 mr-2" />
                Exportar XLSX
              </Button>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input placeholder="Buscar nome, telefone, CPF..." value={searchTerm} onChange={(e) => { setSearchTerm(e.target.value); setPage(0); }} className="pl-9" />
              </div>
              <Select value={actualSeller} onValueChange={(v) => updateFilter('seller', v)}>
                <SelectTrigger><SelectValue placeholder="Vendedor" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos os vendedores</SelectItem>
                  {sellers.map((s: any) => <SelectItem key={s.user_id} value={s.user_id}>{s.name || s.email}</SelectItem>)}
                </SelectContent>
              </Select>
              <Select value={actualStatus} onValueChange={(v) => updateFilter('status', v)}>
                <SelectTrigger><SelectValue placeholder="Status" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos os status</SelectItem>
                  {statusOptions.map(s => <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>)}
                </SelectContent>
              </Select>
              <Select value={actualBatch} onValueChange={(v) => updateFilter('batch', v)}>
                <SelectTrigger><SelectValue placeholder="Lote" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos os lotes</SelectItem>
                  {batchNames.map(b => <SelectItem key={b} value={b}>{b}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>

            {/* Bulk action bar */}
            {selectedIds.size > 0 && (
              <div className="flex items-center gap-3 p-3 rounded-lg bg-primary/10 border border-primary/20">
                <span className="text-sm font-medium">{selectedIds.size} selecionados</span>
                <Button variant="destructive" size="sm" onClick={() => setBulkAction('delete')}>
                  <Trash2 className="w-4 h-4 mr-1" /> Excluir
                </Button>
                <Button variant="outline" size="sm" onClick={() => setBulkAction('status')}>
                  Alterar Status
                </Button>
                <Button variant="outline" size="sm" onClick={() => setBulkAction('reassign')}>
                  Reatribuir
                </Button>
                <Button variant="ghost" size="sm" onClick={() => setSelectedIds(new Set())}>
                  Limpar seleção
                </Button>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Card 2: Apenas a Tabela */}
        {isLoading ? (
          <Card>
            <CardContent className="py-8">
              <div className="flex justify-center">
                <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
              </div>
            </CardContent>
          </Card>
        ) : leads.length === 0 ? (
          <Card>
            <CardContent className="py-8">
              <div className="text-center text-muted-foreground">
                Nenhum lead encontrado. Importe uma planilha para começar.
              </div>
            </CardContent>
          </Card>
        ) : (
          <Card className="overflow-hidden">
            <div className="overflow-x-auto overflow-y-auto max-h-[600px]">
              <div className="w-max min-w-full">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-10 sticky left-0 bg-background z-10">
                        <Checkbox checked={allPageSelected} onCheckedChange={toggleAll} />
                      </TableHead>
                      <TableHead className="sticky left-10 bg-background z-10">Nome</TableHead>
                      <TableHead>Telefone</TableHead>
                      <TableHead>CPF</TableHead>
                      <TableHead>Valor Lib.</TableHead>
                      <TableHead>Prazo</TableHead>
                      <TableHead>Parcela</TableHead>
                      <TableHead>Banco</TableHead>
                      <TableHead>Cód. Banco</TableHead>
                      <TableHead>Banco Simulado</TableHead>
                      <TableHead>Agência</TableHead>
                      <TableHead>Conta</TableHead>
                      <TableHead>Aprovado</TableHead>
                      <TableHead>Reprovado</TableHead>
                      <TableHead>Data Nasc.</TableHead>
                      <TableHead>Nome Mãe</TableHead>
                      <TableHead>Data Ref.</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Vendedor</TableHead>
                      <TableHead>Lote</TableHead>
                      <TableHead>Observações</TableHead>
                      <TableHead className="w-10"></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {pagedLeads.map((lead: any) => (
                      <TableRow key={lead.id} className={selectedIds.has(lead.id) ? 'bg-primary/5' : ''}>
                        <TableCell className="sticky left-0 bg-background z-10">
                          <Checkbox checked={selectedIds.has(lead.id)} onCheckedChange={() => toggleOne(lead.id)} />
                        </TableCell>
                        <TableCell className="font-medium sticky left-10 bg-background z-10 whitespace-nowrap">{lead.nome}</TableCell>
                        <TableCell className="whitespace-nowrap">{lead.telefone}</TableCell>
                        <TableCell className="whitespace-nowrap">{lead.cpf || '-'}</TableCell>
                        <TableCell className="whitespace-nowrap">
                          {lead.valor_lib ? Number(lead.valor_lib).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }) : '-'}
                        </TableCell>
                        <TableCell>{lead.prazo || '-'}</TableCell>
                        <TableCell className="whitespace-nowrap">
                          {lead.vlr_parcela ? Number(lead.vlr_parcela).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }) : '-'}
                        </TableCell>
                        <TableCell className="whitespace-nowrap">{lead.banco_nome || '-'}</TableCell>
                        <TableCell>{lead.banco_codigo || '-'}</TableCell>
                        <TableCell className="whitespace-nowrap">{lead.banco_simulado || '-'}</TableCell>
                        <TableCell>{lead.agencia || '-'}</TableCell>
                        <TableCell>{lead.conta || '-'}</TableCell>
                        <TableCell className="whitespace-nowrap">{lead.aprovado || '-'}</TableCell>
                        <TableCell className="whitespace-nowrap">{lead.reprovado || '-'}</TableCell>
                        <TableCell className="whitespace-nowrap">{formatDate(lead.data_nasc)}</TableCell>
                        <TableCell className="whitespace-nowrap">{lead.nome_mae || '-'}</TableCell>
                        <TableCell className="whitespace-nowrap">{formatDate(lead.data_ref)}</TableCell>
                        <TableCell>
                          <Badge className={statusColorMap[lead.status] || 'bg-muted text-muted-foreground'}>{lead.status}</Badge>
                        </TableCell>
                        <TableCell className="text-sm whitespace-nowrap">{getSellerName(lead.assigned_to)}</TableCell>
                        <TableCell className="text-sm text-muted-foreground whitespace-nowrap">{lead.batch_name || '-'}</TableCell>
                        <TableCell className="text-sm max-w-[200px] truncate">{lead.notes || '-'}</TableCell>
                        <TableCell>
                          <Button variant="ghost" size="icon" onClick={() => handleDelete(lead.id)} className="text-destructive hover:text-destructive">
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </div>
          </Card>
        )}

        {/* Paginação fora dos cards */}
        <div className="flex items-center justify-between">
          <p className="text-sm text-muted-foreground">
            {leads.length} leads · Página {page + 1}/{totalPages}
          </p>
          <div className="flex gap-1">
            <Button variant="outline" size="sm" disabled={page === 0} onClick={() => setPage(p => p - 1)}>
              <ChevronLeft className="w-4 h-4" />
            </Button>
            <Button variant="outline" size="sm" disabled={page >= totalPages - 1} onClick={() => setPage(p => p + 1)}>
              <ChevronRight className="w-4 h-4" />
            </Button>
          </div>
        </div>
      </div>

      {/* Bulk Delete Dialog */}
      <AlertDialog open={bulkAction === 'delete'} onOpenChange={(o) => !o && setBulkAction(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir {selectedIds.size} leads?</AlertDialogTitle>
            <AlertDialogDescription>Esta ação não pode ser desfeita.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isProcessing}>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleBulkDelete} disabled={isProcessing} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              {isProcessing ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null}
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Bulk Status Dialog */}
      <AlertDialog open={bulkAction === 'status'} onOpenChange={(o) => !o && setBulkAction(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Alterar status de {selectedIds.size} leads</AlertDialogTitle>
          </AlertDialogHeader>
          <Select value={bulkStatus} onValueChange={setBulkStatus}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              {statusOptions.map(s => <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>)}
            </SelectContent>
          </Select>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isProcessing}>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleBulkStatus} disabled={isProcessing}>
              {isProcessing ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null}
              Aplicar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Bulk Reassign Dialog */}
      <AlertDialog open={bulkAction === 'reassign'} onOpenChange={(o) => !o && setBulkAction(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Reatribuir {selectedIds.size} leads</AlertDialogTitle>
          </AlertDialogHeader>
          <Select value={bulkSeller} onValueChange={setBulkSeller}>
            <SelectTrigger><SelectValue placeholder="Selecionar vendedor" /></SelectTrigger>
            <SelectContent>
              {sellers.map((s: any) => <SelectItem key={s.user_id} value={s.user_id}>{s.name || s.email}</SelectItem>)}
            </SelectContent>
          </Select>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isProcessing}>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleBulkReassign} disabled={isProcessing || !bulkSeller}>
              {isProcessing ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null}
              Reatribuir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
