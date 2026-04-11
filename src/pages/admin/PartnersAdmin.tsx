import { useState, useCallback, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import DashboardLayout from '@/components/layout/DashboardLayout';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Textarea } from '@/components/ui/textarea';
import { ScrollArea, ScrollBar } from '@/components/ui/scroll-area';
import { toast } from '@/hooks/use-toast';
import { useNavigate } from 'react-router-dom';
import { Plus, Search, Eye, Trash2, ScrollText, LayoutList, Kanban, Phone, User, Download, AlertTriangle, Loader2 } from 'lucide-react';
import { useSortState, applySortToData } from '@/components/commission-reports/CRSortUtils';
import { ArrowUpDown, ArrowUp, ArrowDown } from 'lucide-react';
import { format } from 'date-fns';
import * as XLSX from 'xlsx';
import { PartnersDashboard } from '@/components/partners/PartnersDashboard';
import PartnerKanbanBoard from '@/components/partners/PartnerKanbanBoard';

const PIPELINE_STATUSES = [
  { value: 'contato_inicial', label: 'Contato Inicial', color: 'bg-muted text-muted-foreground' },
  { value: 'reuniao_marcada', label: 'Reunião Marcada', color: 'bg-blue-500/20 text-blue-400' },
  { value: 'link_enviado', label: 'Link Enviado', color: 'bg-indigo-500/20 text-indigo-400' },
  { value: 'confirmou', label: 'Confirmou', color: 'bg-cyan-500/20 text-cyan-400' },
  { value: 'mei_pendente', label: 'MEI Pendente', color: 'bg-yellow-500/20 text-yellow-400' },
  { value: 'mei_criado', label: 'MEI Criado', color: 'bg-orange-500/20 text-orange-400' },
  { value: 'contrato_pendente', label: 'Contrato Pendente', color: 'bg-amber-500/20 text-amber-400' },
  { value: 'contrato_assinado', label: 'Contrato Assinado', color: 'bg-emerald-500/20 text-emerald-400' },
  { value: 'em_treinamento', label: 'Em Treinamento', color: 'bg-purple-500/20 text-purple-400' },
  { value: 'ativo', label: 'Ativo', color: 'bg-green-500/20 text-green-400' },
  { value: 'desistencia', label: 'Desistência', color: 'bg-destructive/20 text-destructive' },
];

const CRM_COLUMNS: { key: string; label: string; options: string[] }[] = [
  { key: 'reuniao_marcada', label: 'Reunião Marcada', options: ['Chamei', 'Remarcar', 'Não atendeu', 'Confirmou', ''] },
  { key: 'reuniao', label: 'Reunião', options: ['Sim', 'Incluir na próxima', 'Msg não chega', 'Faltou', ''] },
  { key: 'enviou_link', label: 'Enviou Link', options: ['Sim', 'Não'] },
  { key: 'aceitou', label: 'Aceitou', options: ['Confirmou', 'Pensando', 'Recusou', ''] },
  { key: 'info_mei', label: 'Info MEI', options: ['Sim', 'Questionei interesse', 'Não respondeu', ''] },
  { key: 'criou_mei', label: 'Criou MEI', options: ['Sim', 'Não respondeu', 'Aguardando criação', 'Não quer', ''] },
  { key: 'captacao_parceiro', label: 'Captação', options: ['Entrevista', 'Indicação', 'Redes Sociais', 'Outro', ''] },
];

const INACTIVITY_DAYS = 7;

function isValidCpf(value: string): boolean {
  const raw = value.replace(/\D/g, '');
  if (raw.length !== 11 || /^(\d)\1{10}$/.test(raw)) return false;
  let sum = 0;
  for (let i = 0; i < 9; i++) sum += Number(raw[i]) * (10 - i);
  if (((sum * 10) % 11) % 10 !== Number(raw[9])) return false;
  sum = 0;
  for (let i = 0; i < 10; i++) sum += Number(raw[i]) * (11 - i);
  return ((sum * 10) % 11) % 10 === Number(raw[10]);
}

function isValidCnpj(value: string): boolean {
  const raw = value.replace(/\D/g, '');
  if (raw.length !== 14 || /^(\d)\1{13}$/.test(raw)) return false;
  const weights1 = [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];
  const weights2 = [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];
  let sum = 0;
  for (let i = 0; i < 12; i++) sum += Number(raw[i]) * weights1[i];
  const d1 = sum % 11 < 2 ? 0 : 11 - (sum % 11);
  if (d1 !== Number(raw[12])) return false;
  sum = 0;
  for (let i = 0; i < 13; i++) sum += Number(raw[i]) * weights2[i];
  const d2 = sum % 11 < 2 ? 0 : 11 - (sum % 11);
  return d2 === Number(raw[13]);
}

function formatCnpj(value: string): string {
  const raw = value.replace(/\D/g, '').slice(0, 14);
  if (raw.length <= 2) return raw;
  if (raw.length <= 5) return `${raw.slice(0, 2)}.${raw.slice(2)}`;
  if (raw.length <= 8) return `${raw.slice(0, 2)}.${raw.slice(2, 5)}.${raw.slice(5)}`;
  if (raw.length <= 12) return `${raw.slice(0, 2)}.${raw.slice(2, 5)}.${raw.slice(5, 8)}/${raw.slice(8)}`;
  return `${raw.slice(0, 2)}.${raw.slice(2, 5)}.${raw.slice(5, 8)}/${raw.slice(8, 12)}-${raw.slice(12)}`;
}

function formatCpf(value: string): string {
  const raw = value.replace(/\D/g, '').slice(0, 11);
  if (raw.length <= 3) return raw;
  if (raw.length <= 6) return `${raw.slice(0, 3)}.${raw.slice(3)}`;
  if (raw.length <= 9) return `${raw.slice(0, 3)}.${raw.slice(3, 6)}.${raw.slice(6)}`;
  return `${raw.slice(0, 3)}.${raw.slice(3, 6)}.${raw.slice(6, 9)}-${raw.slice(9)}`;
}

function formatPhone(value: string): string {
  const raw = value.replace(/\D/g, '').slice(0, 11);
  if (raw.length <= 2) return raw;
  if (raw.length <= 7) return `(${raw.slice(0, 2)}) ${raw.slice(2)}`;
  return `(${raw.slice(0, 2)}) ${raw.slice(2, 7)}-${raw.slice(7)}`;
}

const getStatusBadge = (status: string) => {
  const s = PIPELINE_STATUSES.find(p => p.value === status);
  return s ? <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold ${s.color}`}>{s.label}</span> : <Badge variant="outline">{status}</Badge>;
};

export default function PartnersAdmin() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<'tabela' | 'kanban'>('tabela');
  const [duplicateWarning, setDuplicateWarning] = useState('');
  const { sort, toggle: toggleSort } = useSortState();

  const [form, setForm] = useState({
    nome: '', telefone: '', cpf: '', cnpj: '', email: '',
    captacao_tipo: '', indicado_por: '',
    pipeline_status: 'contato_inicial', obs: '',
  });
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});

  const { data: allPartners = [], isLoading } = useQuery({
    queryKey: ['partners'],
    queryFn: async () => {
      const allData: any[] = [];
      let from = 0;
      const batchSize = 1000;
      while (true) {
        const { data, error } = await supabase.from('partners').select('*').order('created_at', { ascending: false }).range(from, from + batchSize - 1);
        if (error) throw error;
        if (!data || data.length === 0) break;
        allData.push(...data);
        if (data.length < batchSize) break;
        from += batchSize;
      }
      return allData;
    },
  });

  const partners = statusFilter === 'all' ? allPartners : allPartners.filter(p => p.pipeline_status === statusFilter);

  // Duplicate detection
  const checkDuplicate = (cpf: string, telefone: string) => {
    if (!cpf && !telefone) { setDuplicateWarning(''); return; }
    const cleanCpf = cpf.replace(/\D/g, '');
    const cleanTel = telefone.replace(/\D/g, '');
    const dup = allPartners.find(p => {
      if (cleanCpf && p.cpf?.replace(/\D/g, '') === cleanCpf) return true;
      if (cleanTel && p.telefone?.replace(/\D/g, '') === cleanTel) return true;
      return false;
    });
    setDuplicateWarning(dup ? `⚠️ Possível duplicado: "${dup.nome}" (${dup.pipeline_status})` : '');
  };

  // Inactivity badge
  const isInactive = (p: any) => {
    const daysSince = (Date.now() - new Date(p.updated_at).getTime()) / (1000 * 60 * 60 * 24);
    return daysSince > INACTIVITY_DAYS && !['ativo', 'desistencia'].includes(p.pipeline_status);
  };

  const createMutation = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from('partners').insert({
        nome: form.nome,
        telefone: form.telefone || null,
        cpf: form.cpf || null,
        email: form.email || null,
        captacao_tipo: form.captacao_tipo || null,
        indicado_por: form.indicado_por || null,
        pipeline_status: form.pipeline_status,
        obs: form.obs || null,
        data_contato: new Date().toISOString().split('T')[0],
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['partners'] });
      setDialogOpen(false);
      setForm({ nome: '', telefone: '', cpf: '', cnpj: '', email: '', captacao_tipo: '', indicado_por: '', pipeline_status: 'contato_inicial', obs: '' });
      setDuplicateWarning('');
      setFormErrors({});
      toast({ title: 'Parceiro criado com sucesso' });
    },
    onError: (e: any) => toast({ title: 'Erro', description: e.message, variant: 'destructive' }),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('partners').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['partners'] });
      setDeleteId(null);
      toast({ title: 'Parceiro excluído' });
    },
    onError: (e: any) => toast({ title: 'Erro', description: e.message, variant: 'destructive' }),
  });

  const updateCrmField = async (partnerId: string, field: string, value: any) => {
    const updateData: Record<string, any> = {};
    if (field === 'enviou_link') {
      updateData[field] = value === 'Sim';
    } else {
      updateData[field] = value || null;
    }
    const { error } = await supabase.from('partners').update(updateData).eq('id', partnerId);
    if (error) {
      toast({ title: 'Erro ao atualizar', description: error.message, variant: 'destructive' });
    } else {
      queryClient.invalidateQueries({ queryKey: ['partners'] });
    }
  };

  const updatePipelineStatus = async (partnerId: string, newStatus: string) => {
    const { error } = await supabase.from('partners').update({ pipeline_status: newStatus }).eq('id', partnerId);
    if (error) {
      toast({ title: 'Erro ao mover', description: error.message, variant: 'destructive' });
    } else {
      queryClient.invalidateQueries({ queryKey: ['partners'] });
    }
  };

  const filteredBase = partners.filter(p => {
    if (!search) return true;
    const s = search.toLowerCase();
    return (p.nome?.toLowerCase().includes(s)) ||
      (p.cpf?.toLowerCase().includes(s)) ||
      (p.telefone?.toLowerCase().includes(s)) ||
      (p.cnpj?.toLowerCase().includes(s));
  });
  const filtered = useMemo(() => applySortToData(filteredBase, sort), [filteredBase, sort]);

  const statusCounts = allPartners.reduce<Record<string, number>>((acc, p) => {
    acc[p.pipeline_status] = (acc[p.pipeline_status] || 0) + 1;
    return acc;
  }, {});

  const handleExport = () => {
    const exportData = filtered.map(p => ({
      Nome: p.nome,
      Telefone: p.telefone || '',
      CPF: p.cpf || '',
      Email: p.email || '',
      CNPJ: p.cnpj || '',
      Status: PIPELINE_STATUSES.find(s => s.value === p.pipeline_status)?.label || p.pipeline_status,
      'Data Contato': p.data_contato || '',
      'Reunião Marcada': (p as any).reuniao_marcada || '',
      'Reunião': (p as any).reuniao || '',
      'Aceitou': (p as any).aceitou || '',
      'Criou MEI': (p as any).criou_mei || '',
      Captação: p.captacao_tipo || '',
      Observações: p.obs || '',
      Criado: format(new Date(p.created_at), 'dd/MM/yyyy'),
    }));
    const ws = XLSX.utils.json_to_sheet(exportData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Parceiros');
    XLSX.writeFile(wb, `parceiros_${format(new Date(), 'yyyyMMdd')}.xlsx`);
    toast({ title: `${exportData.length} parceiros exportados` });
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold">Parceiros</h1>
            <p className="text-sm text-muted-foreground">Pipeline de captação e gestão de parceiros comerciais</p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={handleExport} disabled={filtered.length === 0}>
              <Download className="w-4 h-4 mr-2" /> Exportar
            </Button>
            <Button variant="outline" onClick={() => navigate('/admin/parceiros/template')}>
              <ScrollText className="w-4 h-4 mr-2" /> Template
            </Button>
            <Button onClick={() => setDialogOpen(true)}>
              <Plus className="w-4 h-4 mr-2" /> Novo Parceiro
            </Button>
          </div>
        </div>

        {/* Dashboard Metrics */}
        <PartnersDashboard partners={allPartners as any} />

        {/* Status filters */}
        <div className="flex gap-2 flex-wrap">
          <button
            onClick={() => setStatusFilter('all')}
            className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${statusFilter === 'all' ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground hover:bg-accent'}`}
          >
            Todos ({allPartners.length})
          </button>
          {PIPELINE_STATUSES.map(s => {
            const count = statusCounts[s.value] || 0;
            return (
              <button
                key={s.value}
                onClick={() => setStatusFilter(s.value === statusFilter ? 'all' : s.value)}
                className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${
                  statusFilter === s.value
                    ? 'bg-primary text-primary-foreground'
                    : count === 0
                      ? 'bg-muted/50 text-muted-foreground/50 hover:bg-muted hover:text-muted-foreground'
                      : s.color + ' hover:opacity-80'
                }`}
              >
                {s.label} ({count})
              </button>
            );
          })}
        </div>

        {/* Search + View Toggle */}
        <div className="flex items-center gap-4">
          <div className="relative max-w-sm flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input placeholder="Buscar por nome, CPF, telefone ou CNPJ..." value={search} onChange={e => setSearch(e.target.value)} className="pl-9" />
          </div>
          <div className="flex border rounded-lg overflow-hidden">
            <button
              onClick={() => setViewMode('tabela')}
              className={`px-3 py-2 text-xs font-medium flex items-center gap-1.5 transition-colors ${viewMode === 'tabela' ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground hover:bg-accent'}`}
            >
              <LayoutList className="w-3.5 h-3.5" /> Tabela
            </button>
            <button
              onClick={() => setViewMode('kanban')}
              className={`px-3 py-2 text-xs font-medium flex items-center gap-1.5 transition-colors ${viewMode === 'kanban' ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground hover:bg-accent'}`}
            >
              <Kanban className="w-3.5 h-3.5" /> Kanban
            </button>
          </div>
        </div>

        {viewMode === 'tabela' ? (
          <Card>
            <CardContent className="p-0">
              <ScrollArea className="w-full">
                <Table>
                  <TableHeader>
                    <TableRow>
                      {[
                        { key: 'nome', label: 'Nome', sticky: true },
                        { key: 'telefone', label: 'Telefone' },
                        { key: 'pipeline_status', label: 'Status' },
                      ].map(col => {
                        const Icon = sort.key === col.key ? (sort.dir === 'asc' ? ArrowUp : ArrowDown) : ArrowUpDown;
                        return (
                          <TableHead
                            key={col.key}
                            className={`cursor-pointer select-none hover:bg-muted/50 ${col.sticky ? 'sticky left-0 bg-background z-10' : ''}`}
                            onClick={() => toggleSort(col.key)}
                          >
                            <span className="inline-flex items-center gap-1">
                              {col.label}
                              <Icon className={`w-3 h-3 ${sort.key === col.key ? 'text-foreground' : 'text-muted-foreground/50'}`} />
                            </span>
                          </TableHead>
                        );
                      })}
                      {CRM_COLUMNS.map(col => (
                        <TableHead key={col.key} className="min-w-[140px]">{col.label}</TableHead>
                      ))}
                      <TableHead className="w-[80px]">Ações</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {isLoading ? (
                      <TableRow><TableCell colSpan={4 + CRM_COLUMNS.length} className="text-center py-12"><Loader2 className="w-6 h-6 animate-spin text-muted-foreground mx-auto" /></TableCell></TableRow>
                    ) : filtered.length === 0 ? (
                      <TableRow><TableCell colSpan={4 + CRM_COLUMNS.length} className="text-center py-12 text-muted-foreground"><User className="w-8 h-8 mx-auto mb-2 opacity-40" /><p>Nenhum parceiro encontrado</p></TableCell></TableRow>
                    ) : filtered.map(p => (
                      <TableRow key={p.id} className="hover:bg-muted/50">
                        <TableCell className="sticky left-0 bg-background z-10 font-medium cursor-pointer" onClick={() => navigate(`/admin/parceiros/${p.id}`)}>
                          <div className="flex items-center gap-2">
                            {p.nome}
                            {isInactive(p) && (
                              <span className="inline-flex items-center rounded-full px-1.5 py-0.5 text-[10px] font-medium bg-amber-500/20 text-amber-500" title={`Sem atualização há +${INACTIVITY_DAYS} dias`}>
                                Inativo
                              </span>
                            )}
                          </div>
                        </TableCell>
                        <TableCell className="text-sm">{p.telefone || '—'}</TableCell>
                        <TableCell>{getStatusBadge(p.pipeline_status)}</TableCell>
                        {CRM_COLUMNS.map(col => {
                          const rawValue = (p as any)[col.key];
                          const currentValue = col.key === 'enviou_link' ? (rawValue ? 'Sim' : 'Não') : (rawValue || '');
                          return (
                            <TableCell key={col.key} onClick={e => e.stopPropagation()}>
                              <Select
                                value={currentValue}
                                onValueChange={v => updateCrmField(p.id, col.key, v)}
                              >
                                <SelectTrigger className="h-7 text-xs min-w-[120px] border-dashed">
                                  <SelectValue placeholder="—" />
                                </SelectTrigger>
                                <SelectContent>
                                  {col.options.filter(Boolean).map(opt => (
                                    <SelectItem key={opt} value={opt}>{opt}</SelectItem>
                                  ))}
                                  <SelectItem value=" ">— Limpar</SelectItem>
                                </SelectContent>
                              </Select>
                            </TableCell>
                          );
                        })}
                        <TableCell>
                          <div className="flex gap-1" onClick={e => e.stopPropagation()}>
                            <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => navigate(`/admin/parceiros/${p.id}`)}>
                              <Eye className="w-3.5 h-3.5" />
                            </Button>
                            <Button size="icon" variant="ghost" className="h-7 w-7 text-destructive" onClick={() => setDeleteId(p.id)}>
                              <Trash2 className="w-3.5 h-3.5" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
                <ScrollBar orientation="horizontal" />
              </ScrollArea>
            </CardContent>
          </Card>
        ) : (
          /* Kanban View with Drag & Drop */
          <PartnerKanbanBoard
            partners={filtered}
            statuses={PIPELINE_STATUSES}
            isInactive={isInactive}
            onMove={updatePipelineStatus}
            onCardClick={(id) => navigate(`/admin/parceiros/${id}`)}
          />
        )}
      </div>

      {/* Create Dialog */}
      <Dialog open={dialogOpen} onOpenChange={(o) => { setDialogOpen(o); if (!o) { setDuplicateWarning(''); setFormErrors({}); } }}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Novo Parceiro</DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 py-2">
            <div className="grid gap-2">
              <Label>Nome <span className="text-destructive">*</span></Label>
              <Input value={form.nome} onChange={e => setForm(f => ({ ...f, nome: e.target.value }))} placeholder="Nome completo" className={formErrors.nome ? 'border-destructive' : ''} />
              {formErrors.nome && <p className="text-xs text-destructive">{formErrors.nome}</p>}
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label>Telefone</Label>
                <Input value={form.telefone} onChange={e => {
                  const v = formatPhone(e.target.value);
                  setForm(f => ({ ...f, telefone: v }));
                  checkDuplicate(form.cpf, v);
                }} placeholder="(00) 00000-0000" />
              </div>
              <div className="grid gap-2">
                <Label>CPF do Representante <span className="text-destructive">*</span></Label>
                <Input value={form.cpf} onChange={e => {
                  const v = formatCpf(e.target.value);
                  setForm(f => ({ ...f, cpf: v }));
                  checkDuplicate(v, form.telefone);
                  if (formErrors.cpf) setFormErrors(prev => { const n = { ...prev }; delete n.cpf; return n; });
                }} placeholder="000.000.000-00" className={formErrors.cpf ? 'border-destructive' : ''} />
                {formErrors.cpf && <p className="text-xs text-destructive">{formErrors.cpf}</p>}
              </div>
            </div>

            {duplicateWarning && (
              <div className="flex items-center gap-2 p-3 rounded-md bg-amber-500/10 border border-amber-500/20">
                <AlertTriangle className="w-4 h-4 text-amber-500 shrink-0" />
                <p className="text-xs text-amber-500">{duplicateWarning}</p>
              </div>
            )}

            <div className="grid gap-2">
              <Label>Email</Label>
              <Input type="email" value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} placeholder="email@exemplo.com" />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label>Tipo de Captação</Label>
                <Select value={form.captacao_tipo} onValueChange={v => setForm(f => ({ ...f, captacao_tipo: v }))}>
                  <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="indicacao">Indicação</SelectItem>
                    <SelectItem value="redes_sociais">Redes Sociais</SelectItem>
                    <SelectItem value="anuncio">Anúncio</SelectItem>
                    <SelectItem value="organico">Orgânico</SelectItem>
                    <SelectItem value="evento">Evento</SelectItem>
                    <SelectItem value="outro">Outro</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="grid gap-2">
                <Label>Indicado por</Label>
                <Input value={form.indicado_por} onChange={e => setForm(f => ({ ...f, indicado_por: e.target.value }))} placeholder="Nome de quem indicou" />
              </div>
            </div>
            <div className="grid gap-2">
              <Label>Status</Label>
              <Select value={form.pipeline_status} onValueChange={v => setForm(f => ({ ...f, pipeline_status: v }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {PIPELINE_STATUSES.map(s => (
                    <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-2">
              <Label>Observações</Label>
              <Textarea value={form.obs} onChange={e => setForm(f => ({ ...f, obs: e.target.value }))} placeholder="Notas internas..." rows={3} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancelar</Button>
            <Button onClick={() => {
              const errors: Record<string, string> = {};
              if (!form.nome.trim()) errors.nome = 'Nome é obrigatório';
              const cpfRaw = form.cpf.replace(/\D/g, '');
              if (!cpfRaw) errors.cpf = 'CPF do representante é obrigatório';
              else if (!isValidCpf(cpfRaw)) errors.cpf = 'CPF inválido — verifique os dígitos';
              setFormErrors(errors);
              if (Object.keys(errors).length > 0) return;
              createMutation.mutate();
            }} disabled={createMutation.isPending}>
              {createMutation.isPending ? 'Salvando...' : 'Criar Parceiro'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirm */}
      <Dialog open={!!deleteId} onOpenChange={() => setDeleteId(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Excluir parceiro?</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">Esta ação é irreversível. Todos os dados e histórico do parceiro serão removidos.</p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteId(null)}>Cancelar</Button>
            <Button variant="destructive" onClick={() => deleteId && deleteMutation.mutate(deleteId)} disabled={deleteMutation.isPending}>
              {deleteMutation.isPending ? 'Excluindo...' : 'Excluir'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  );
}
