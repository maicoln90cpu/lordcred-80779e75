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

const PAGE_SIZE = 50;

const STATUS_OPTIONS = [
  { value: 'pendente', label: 'Pendente' },
  { value: 'CHAMEI', label: 'Chamei' },
  { value: 'NÃO ATENDEU', label: 'Não Atendeu' },
  { value: 'NÃO EXISTE', label: 'Não Existe' },
  { value: 'APROVADO', label: 'Aprovado' },
];

const statusColors: Record<string, string> = {
  'CHAMEI': 'bg-blue-500/20 text-blue-400',
  'NÃO EXISTE': 'bg-red-500/20 text-red-400',
  'APROVADO': 'bg-green-500/20 text-green-400',
  'NÃO ATENDEU': 'bg-yellow-500/20 text-yellow-400',
  'pendente': 'bg-muted text-muted-foreground',
};

export default function LeadsTable() {
  const [filterSeller, setFilterSeller] = useState<string>('all');
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [filterBatch, setFilterBatch] = useState<string>('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [page, setPage] = useState(0);
  const [bulkAction, setBulkAction] = useState<'delete' | 'status' | 'reassign' | null>(null);
  const [bulkStatus, setBulkStatus] = useState('pendente');
  const [bulkSeller, setBulkSeller] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: sellers = [] } = useQuery({
    queryKey: ['sellers-list'],
    queryFn: async () => {
      const { data: profiles } = await supabase.from('profiles').select('user_id, name, email');
      return profiles || [];
    }
  });

  const { data: leads = [], isLoading } = useQuery({
    queryKey: ['admin-leads', filterSeller, filterStatus, filterBatch, searchTerm],
    queryFn: async () => {
      let query = supabase.from('client_leads' as any).select('*').order('created_at', { ascending: false });
      if (filterSeller !== 'all') query = query.eq('assigned_to', filterSeller);
      if (filterStatus !== 'all') query = query.eq('status', filterStatus);
      if (filterBatch !== 'all') query = query.eq('batch_name', filterBatch);
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

  const handleBulkDelete = async () => {
    setIsProcessing(true);
    try {
      const ids = Array.from(selectedIds);
      // Delete in batches of 50
      for (let i = 0; i < ids.length; i += 50) {
        const batch = ids.slice(i, i + 50);
        const { error } = await supabase.from('client_leads' as any).delete().in('id', batch);
        if (error) throw error;
      }
      toast({ title: `${ids.length} leads excluídos` });
      setSelectedIds(new Set());
      queryClient.invalidateQueries({ queryKey: ['admin-leads'] });
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
      queryClient.invalidateQueries({ queryKey: ['admin-leads'] });
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
      queryClient.invalidateQueries({ queryKey: ['admin-leads'] });
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
      Status: l.status,
      Vendedor: getSellerName(l.assigned_to),
      Lote: l.batch_name,
      'Data Criação': l.created_at,
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
      queryClient.invalidateQueries({ queryKey: ['admin-leads'] });
      toast({ title: 'Lead excluído' });
    }
  };

  const getSellerName = (userId: string) => {
    const seller = sellers.find((s: any) => s.user_id === userId);
    return seller?.name || seller?.email || 'N/A';
  };

  return (
    <>
      <Card>
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
            <Select value={filterSeller} onValueChange={(v) => { setFilterSeller(v); setPage(0); }}>
              <SelectTrigger><SelectValue placeholder="Vendedor" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos os vendedores</SelectItem>
                {sellers.map((s: any) => <SelectItem key={s.user_id} value={s.user_id}>{s.name || s.email}</SelectItem>)}
              </SelectContent>
            </Select>
            <Select value={filterStatus} onValueChange={(v) => { setFilterStatus(v); setPage(0); }}>
              <SelectTrigger><SelectValue placeholder="Status" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos os status</SelectItem>
                {STATUS_OPTIONS.map(s => <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>)}
              </SelectContent>
            </Select>
            <Select value={filterBatch} onValueChange={(v) => { setFilterBatch(v); setPage(0); }}>
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

          {isLoading ? (
            <div className="flex justify-center py-8">
              <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
            </div>
          ) : leads.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              Nenhum lead encontrado. Importe uma planilha para começar.
            </div>
          ) : (
            <div className="border rounded-lg overflow-auto max-h-[600px]">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-10">
                      <Checkbox checked={allPageSelected} onCheckedChange={toggleAll} />
                    </TableHead>
                    <TableHead>Nome</TableHead>
                    <TableHead>Telefone</TableHead>
                    <TableHead>Valor Lib.</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Vendedor</TableHead>
                    <TableHead>Lote</TableHead>
                    <TableHead className="w-10"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {pagedLeads.map((lead: any) => (
                    <TableRow key={lead.id} className={selectedIds.has(lead.id) ? 'bg-primary/5' : ''}>
                      <TableCell>
                        <Checkbox checked={selectedIds.has(lead.id)} onCheckedChange={() => toggleOne(lead.id)} />
                      </TableCell>
                      <TableCell className="font-medium">{lead.nome}</TableCell>
                      <TableCell>{lead.telefone}</TableCell>
                      <TableCell>
                        {lead.valor_lib ? Number(lead.valor_lib).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }) : '-'}
                      </TableCell>
                      <TableCell>
                        <Badge className={statusColors[lead.status] || 'bg-muted text-muted-foreground'}>{lead.status}</Badge>
                      </TableCell>
                      <TableCell className="text-sm">{getSellerName(lead.assigned_to)}</TableCell>
                      <TableCell className="text-sm text-muted-foreground">{lead.batch_name}</TableCell>
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
          )}

          {/* Pagination */}
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
        </CardContent>
      </Card>

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
              {STATUS_OPTIONS.map(s => <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>)}
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
