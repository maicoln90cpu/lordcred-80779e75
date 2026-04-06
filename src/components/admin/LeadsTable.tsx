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
import { DEFAULT_ALIASES, type ColumnAlias } from './LeadImporter';

function formatDate(value: string | number | null | undefined): string {
  if (!value) return '-';
  const num = typeof value === 'number' ? value : Number(value);
  if (!isNaN(num) && num > 10000 && num < 100000) {
    const excelEpoch = new Date(1900, 0, 1);
    const date = new Date(excelEpoch.getTime() + (num - 2) * 86400000);
    if (!isNaN(date.getTime())) return date.toLocaleDateString('pt-BR');
  }
  const str = String(value).trim();
  if (/^\d{2}\/\d{2}\/\d{4}$/.test(str)) return str;
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

interface ProfileOption {
  value: string;
  label: string;
  color_class: string;
}

interface LeadsTableProps {
  filterSeller?: string;
  filterStatus?: string;
  filterBatch?: string;
  filterProfile?: string;
  filterBancoSimulado?: string;
  onFiltersChange?: (filters: { seller: string; status: string; batch: string; profile: string; bancoSimulado: string }) => void;
  statusOptions?: Array<{ value: string; label: string; color_class: string }>;
  columnConfig?: ColumnConfig[];
  profileOptions?: ProfileOption[];
  columnAliases?: ColumnAlias[];
}

export default function LeadsTable({ filterSeller: extSeller, filterStatus: extStatus, filterBatch: extBatch, filterProfile: extProfile, filterBancoSimulado: extBancoSimulado, onFiltersChange, statusOptions = DEFAULT_STATUS_OPTIONS, columnConfig, profileOptions = [], columnAliases = DEFAULT_ALIASES }: LeadsTableProps) {
  const [filterSeller, setFilterSeller] = useState<string>(extSeller || 'all');
  const [filterStatus, setFilterStatus] = useState<string>(extStatus || 'all');
  const [filterBatch, setFilterBatch] = useState<string>(extBatch || 'all');
  const [filterProfile, setFilterProfile] = useState<string>(extProfile || 'all');
  const [filterBancoSimulado, setFilterBancoSimulado] = useState<string>(extBancoSimulado || 'all');
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [page, setPage] = useState(0);
  const [bulkAction, setBulkAction] = useState<'delete' | 'status' | 'reassign' | 'profile' | null>(null);
  const [bulkStatus, setBulkStatus] = useState('pendente');
  const [bulkSeller, setBulkSeller] = useState('');
  const [bulkProfile, setBulkProfile] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const actualSeller = extSeller ?? filterSeller;
  const actualStatus = extStatus ?? filterStatus;
  const actualBatch = extBatch ?? filterBatch;
  const actualProfile = extProfile ?? filterProfile;
  const actualBancoSimulado = extBancoSimulado ?? filterBancoSimulado;

  const updateFilter = (key: 'seller' | 'status' | 'batch' | 'profile' | 'bancoSimulado', value: string) => {
    if (key === 'seller') setFilterSeller(value);
    if (key === 'status') setFilterStatus(value);
    if (key === 'batch') setFilterBatch(value);
    if (key === 'profile') setFilterProfile(value);
    if (key === 'bancoSimulado') setFilterBancoSimulado(value);
    setPage(0);
    onFiltersChange?.({
      seller: key === 'seller' ? value : actualSeller,
      status: key === 'status' ? value : actualStatus,
      batch: key === 'batch' ? value : actualBatch,
      profile: key === 'profile' ? value : actualProfile,
      bancoSimulado: key === 'bancoSimulado' ? value : actualBancoSimulado,
    });
  };

  const statusColorMap = useMemo(() => {
    const map: Record<string, string> = {};
    statusOptions.forEach(s => { map[s.value] = s.color_class; });
    return map;
  }, [statusOptions]);

  const profileColorMap = useMemo(() => {
    const map: Record<string, string> = {};
    profileOptions.forEach(p => { map[p.value] = p.color_class; });
    return map;
  }, [profileOptions]);

  // Extract hex from color_class — supports "hex:#abc123" and legacy "bg-[#abc123]/20"
  const extractHex = (colorClass: string): string | null => {
    if (colorClass.startsWith('hex:')) return colorClass.slice(4);
    const match = colorClass.match(/#[0-9a-fA-F]{6}/);
    return match ? match[0] : null;
  };

  const renderColorBadge = (label: string, colorClass: string) => {
    const hex = extractHex(colorClass);
    if (hex) {
      return (
        <Badge variant="secondary" style={{ backgroundColor: hex + '33', color: hex, borderColor: hex + '44' }}>
          {label}
        </Badge>
      );
    }
    return <Badge className={colorClass}>{label}</Badge>;
  };

  const { data: sellers = [] } = useQuery({
    queryKey: ['sellers-list'],
    queryFn: async () => {
      const { data: profiles } = await supabase.from('profiles').select('user_id, name, email');
      return profiles || [];
    }
  });

  const { data: leads = [], isLoading } = useQuery({
    queryKey: ['admin-leads', actualSeller, actualStatus, actualBatch, actualProfile, actualBancoSimulado, searchTerm],
    queryFn: async () => {
      let query = supabase.from('client_leads' as any).select('*').order('created_at', { ascending: false });
      if (actualSeller !== 'all') query = query.eq('assigned_to', actualSeller);
      if (actualStatus !== 'all') query = query.eq('status', actualStatus);
      if (actualBatch !== 'all') query = query.eq('batch_name', actualBatch);
      if (actualBancoSimulado !== 'all') query = query.eq('banco_simulado', actualBancoSimulado);
      if (actualProfile === '__none__') {
        query = query.is('perfil', null);
      } else if (actualProfile !== 'all') {
        query = query.eq('perfil', actualProfile);
      }
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

  const bancoSimuladoNames = useMemo(() => {
    const names = new Set<string>();
    leads.forEach((l: any) => l.banco_simulado && names.add(l.banco_simulado));
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
          assigned_to: bulkSeller, assigned_at: new Date().toISOString(), updated_at: new Date().toISOString()
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

  const handleBulkProfile = async () => {
    setIsProcessing(true);
    try {
      const ids = Array.from(selectedIds);
      const newProfile = bulkProfile === '__none__' ? null : bulkProfile;
      for (let i = 0; i < ids.length; i += 50) {
        const batch = ids.slice(i, i + 50);
        const { error } = await supabase.from('client_leads' as any).update({
          perfil: newProfile, updated_at: new Date().toISOString()
        }).in('id', batch);
        if (error) throw error;
      }
      toast({ title: `Perfil de ${ids.length} leads atualizado` });
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
    // Use system_label from aliases for export headers
    const getLabel = (key: string, fallback: string) => {
      const alias = columnAliases.find(a => a.key === key);
      return alias ? alias.system_label : fallback;
    };
    const exportData = leads.map((l: any) => ({
      [getLabel('nome', 'Nome')]: l.nome,
      [getLabel('telefone', 'Telefone')]: l.telefone,
      [getLabel('cpf', 'CPF')]: l.cpf,
      [getLabel('valor_lib', 'Valor Lib.')]: l.valor_lib,
      [getLabel('prazo', 'Prazo')]: l.prazo,
      [getLabel('vlr_parcela', 'Parcela')]: l.vlr_parcela,
      [getLabel('banco_nome', 'Banco Nome')]: l.banco_nome,
      [getLabel('banco_codigo', 'Banco Código')]: l.banco_codigo,
      [getLabel('banco_simulado', 'Banco Simulado')]: l.banco_simulado,
      [getLabel('agencia', 'Agência')]: l.agencia,
      Conta: l.conta,
      Aprovado: l.aprovado,
      Reprovado: l.reprovado,
      [getLabel('data_nasc', 'Data Nasc.')]: l.data_nasc,
      [getLabel('nome_mae', 'Nome Mãe')]: l.nome_mae,
      [getLabel('data_ref', 'Data Ref.')]: l.data_ref,
      Status: l.status,
      Perfil: l.perfil || '',
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

  const visibleCols = useMemo(() => {
    if (!columnConfig) return null;
    return columnConfig.filter(c => c.visible);
  }, [columnConfig]);

  const formatDateTime = (value: string | null | undefined): string => {
    if (!value) return '-';
    const d = new Date(value);
    if (isNaN(d.getTime())) return '-';
    return d.toLocaleDateString('pt-BR') + ' ' + d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
  };

  const renderCellValue = (lead: any, key: string) => {
    switch (key) {
      case 'valor_lib':
        return lead.valor_lib ? Number(lead.valor_lib).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }) : '-';
      case 'vlr_parcela':
        return lead.vlr_parcela ? Number(lead.vlr_parcela).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }) : '-';
      case 'data_nasc':
      case 'data_ref':
        return formatDate(lead[key]);
      case 'assigned_at':
        return formatDateTime(lead.assigned_at);
      case 'status':
        return renderColorBadge(lead.status, statusColorMap[lead.status] || 'bg-muted text-muted-foreground');
      case 'perfil':
        return lead.perfil
          ? renderColorBadge(lead.perfil, profileColorMap[lead.perfil] || 'bg-muted text-muted-foreground')
          : <span className="text-muted-foreground text-xs">-</span>;
      case 'assigned_to':
        return getSellerName(lead.assigned_to);
      case 'notes':
        return <span className="max-w-[200px] truncate block">{lead[key] || '-'}</span>;
      default: {
        // Check if this is a custom column stored in notes JSON
        if (!NATIVE_COLUMN_KEYS.has(key) && lead.notes) {
          try {
            const extras = JSON.parse(lead.notes);
            if (extras[key]) return extras[key];
          } catch {}
        }
        return lead[key] || '-';
      }
    }
  };

  return (
    <>
      <div className="space-y-4">
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
            <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-6 gap-4">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input placeholder="Buscar nome, telefone, CPF..." value={searchTerm} onChange={(e) => { setSearchTerm(e.target.value); setPage(0); }} className="pl-9" />
              </div>
              <Select value={actualSeller} onValueChange={(v) => updateFilter('seller', v)}>
                <SelectTrigger><SelectValue placeholder="Vendedor" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos os vendedores</SelectItem>
                  {[...sellers].sort((a: any, b: any) => (a.name || a.email).localeCompare(b.name || b.email, 'pt-BR')).map((s: any) => <SelectItem key={s.user_id} value={s.user_id}>{s.name || s.email}</SelectItem>)}
                </SelectContent>
              </Select>
              <Select value={actualStatus} onValueChange={(v) => updateFilter('status', v)}>
                <SelectTrigger><SelectValue placeholder="Status" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos os status</SelectItem>
                  {[...statusOptions].sort((a, b) => a.label.localeCompare(b.label, 'pt-BR')).map(s => <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>)}
                </SelectContent>
              </Select>
              <Select value={actualProfile} onValueChange={(v) => updateFilter('profile', v)}>
                <SelectTrigger><SelectValue placeholder="Perfil" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos os perfis</SelectItem>
                  <SelectItem value="__none__">Sem perfil</SelectItem>
                  {[...profileOptions].sort((a, b) => a.label.localeCompare(b.label, 'pt-BR')).map(p => <SelectItem key={p.value} value={p.value}>{p.label}</SelectItem>)}
                </SelectContent>
              </Select>
              <Select value={actualBatch} onValueChange={(v) => updateFilter('batch', v)}>
                <SelectTrigger><SelectValue placeholder="Lote" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos os lotes</SelectItem>
                  {[...batchNames].sort((a, b) => a.localeCompare(b, 'pt-BR')).map(b => <SelectItem key={b} value={b}>{b}</SelectItem>)}
                </SelectContent>
              </Select>
              <Select value={actualBancoSimulado} onValueChange={(v) => updateFilter('bancoSimulado', v)}>
                <SelectTrigger><SelectValue placeholder="Banco Simulado" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos os bancos</SelectItem>
                  {[...bancoSimuladoNames].sort((a, b) => a.localeCompare(b, 'pt-BR')).map(b => <SelectItem key={b} value={b}>{b}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>

            {selectedIds.size > 0 && (
              <div className="flex items-center gap-3 p-3 rounded-lg bg-primary/10 border border-primary/20 flex-wrap">
                <span className="text-sm font-medium">{selectedIds.size} selecionados</span>
                <Button variant="destructive" size="sm" onClick={() => setBulkAction('delete')}>
                  <Trash2 className="w-4 h-4 mr-1" /> Excluir
                </Button>
                <Button variant="outline" size="sm" onClick={() => setBulkAction('status')}>
                  Alterar Status
                </Button>
                <Button variant="outline" size="sm" onClick={() => setBulkAction('profile')}>
                  Alterar Perfil
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
                      {visibleCols ? (
                        visibleCols.map((col, i) => (
                          <TableHead key={col.key} className={i === 0 ? 'sticky left-10 bg-background z-10' : ''}>
                            {col.label}
                          </TableHead>
                        ))
                      ) : (
                        <>
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
                          <TableHead>Perfil</TableHead>
                          <TableHead>Vendedor</TableHead>
                          <TableHead>Lote</TableHead>
                          <TableHead>Observações</TableHead>
                        </>
                      )}
                      <TableHead className="w-10"></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {pagedLeads.map((lead: any) => (
                      <TableRow key={lead.id} className={selectedIds.has(lead.id) ? 'bg-primary/5' : ''}>
                        <TableCell className="sticky left-0 bg-background z-10">
                          <Checkbox checked={selectedIds.has(lead.id)} onCheckedChange={() => toggleOne(lead.id)} />
                        </TableCell>
                        {visibleCols ? (
                          visibleCols.map((col, i) => (
                            <TableCell key={col.key} className={`whitespace-nowrap ${i === 0 ? 'font-medium sticky left-10 bg-background z-10' : ''}`}>
                              {renderCellValue(lead, col.key)}
                            </TableCell>
                          ))
                        ) : (
                          <>
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
                              {renderColorBadge(lead.status, statusColorMap[lead.status] || 'bg-muted text-muted-foreground')}
                            </TableCell>
                            <TableCell>
                              {lead.perfil
                                ? renderColorBadge(lead.perfil, profileColorMap[lead.perfil] || 'bg-muted text-muted-foreground')
                                : <span className="text-muted-foreground text-xs">-</span>
                              }
                            </TableCell>
                            <TableCell className="text-sm whitespace-nowrap">{getSellerName(lead.assigned_to)}</TableCell>
                            <TableCell className="text-sm text-muted-foreground whitespace-nowrap">{lead.batch_name || '-'}</TableCell>
                            <TableCell className="text-sm max-w-[200px] truncate">{lead.notes || '-'}</TableCell>
                          </>
                        )}
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
              {[...statusOptions].sort((a, b) => a.label.localeCompare(b.label, 'pt-BR')).map(s => <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>)}
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

      {/* Bulk Profile Dialog */}
      <AlertDialog open={bulkAction === 'profile'} onOpenChange={(o) => !o && setBulkAction(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Alterar perfil de {selectedIds.size} leads</AlertDialogTitle>
          </AlertDialogHeader>
          <Select value={bulkProfile} onValueChange={setBulkProfile}>
            <SelectTrigger><SelectValue placeholder="Selecionar perfil" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="__none__">Sem perfil</SelectItem>
              {[...profileOptions].sort((a, b) => a.label.localeCompare(b.label, 'pt-BR')).map(p => <SelectItem key={p.value} value={p.value}>{p.label}</SelectItem>)}
            </SelectContent>
          </Select>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isProcessing}>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleBulkProfile} disabled={isProcessing || !bulkProfile}>
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
              {[...sellers].sort((a: any, b: any) => (a.name || a.email).localeCompare(b.name || b.email, 'pt-BR')).map((s: any) => <SelectItem key={s.user_id} value={s.user_id}>{s.name || s.email}</SelectItem>)}
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
