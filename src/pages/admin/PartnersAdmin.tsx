import { useState } from 'react';
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ScrollArea, ScrollBar } from '@/components/ui/scroll-area';
import { toast } from '@/hooks/use-toast';
import { useNavigate } from 'react-router-dom';
import { Plus, Search, Eye, Trash2, ScrollText, LayoutList, Kanban, Phone, User } from 'lucide-react';
import { format } from 'date-fns';

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

  const [form, setForm] = useState({
    nome: '', telefone: '', cpf: '', email: '',
    captacao_tipo: '', indicado_por: '',
    pipeline_status: 'contato_inicial', obs: '',
  });

  const { data: allPartners = [], isLoading } = useQuery({
    queryKey: ['partners'],
    queryFn: async () => {
      const { data, error } = await supabase.from('partners').select('*').order('created_at', { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const partners = statusFilter === 'all' ? allPartners : allPartners.filter(p => p.pipeline_status === statusFilter);

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
      setForm({ nome: '', telefone: '', cpf: '', email: '', captacao_tipo: '', indicado_por: '', pipeline_status: 'contato_inicial', obs: '' });
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

  const filtered = partners.filter(p => {
    if (!search) return true;
    const s = search.toLowerCase();
    return (p.nome?.toLowerCase().includes(s)) ||
      (p.cpf?.toLowerCase().includes(s)) ||
      (p.telefone?.toLowerCase().includes(s)) ||
      (p.cnpj?.toLowerCase().includes(s));
  });

  const statusCounts = allPartners.reduce<Record<string, number>>((acc, p) => {
    acc[p.pipeline_status] = (acc[p.pipeline_status] || 0) + 1;
    return acc;
  }, {});

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold">Parceiros</h1>
            <p className="text-sm text-muted-foreground">Pipeline de captação e gestão de parceiros comerciais</p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => navigate('/admin/parceiros/template')}>
              <ScrollText className="w-4 h-4 mr-2" /> Template
            </Button>
            <Button onClick={() => setDialogOpen(true)}>
              <Plus className="w-4 h-4 mr-2" /> Novo Parceiro
            </Button>
          </div>
        </div>

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
                      <TableHead className="sticky left-0 bg-background z-10">Nome</TableHead>
                      <TableHead>Telefone</TableHead>
                      <TableHead>Status</TableHead>
                      {CRM_COLUMNS.map(col => (
                        <TableHead key={col.key} className="min-w-[140px]">{col.label}</TableHead>
                      ))}
                      <TableHead className="w-[80px]">Ações</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {isLoading ? (
                      <TableRow><TableCell colSpan={4 + CRM_COLUMNS.length} className="text-center py-8 text-muted-foreground">Carregando...</TableCell></TableRow>
                    ) : filtered.length === 0 ? (
                      <TableRow><TableCell colSpan={4 + CRM_COLUMNS.length} className="text-center py-8 text-muted-foreground">Nenhum parceiro encontrado</TableCell></TableRow>
                    ) : filtered.map(p => (
                      <TableRow key={p.id} className="hover:bg-muted/50">
                        <TableCell className="sticky left-0 bg-background z-10 font-medium cursor-pointer" onClick={() => navigate(`/admin/parceiros/${p.id}`)}>
                          {p.nome}
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
          /* Kanban View */
          <ScrollArea className="w-full pb-4">
            <div className="flex gap-4 min-w-max">
              {PIPELINE_STATUSES.map(status => {
                const cards = filtered.filter(p => p.pipeline_status === status.value);
                return (
                  <div key={status.value} className="w-[280px] shrink-0">
                    <div className={`rounded-t-lg px-3 py-2 ${status.color}`}>
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-semibold">{status.label}</span>
                        <Badge variant="secondary" className="text-[10px] h-5">{cards.length}</Badge>
                      </div>
                    </div>
                    <div className="bg-muted/30 rounded-b-lg p-2 space-y-2 min-h-[200px] border border-t-0 border-border/50">
                      {cards.length === 0 ? (
                        <p className="text-xs text-muted-foreground text-center py-8">Vazio</p>
                      ) : cards.map(p => (
                        <Card
                          key={p.id}
                          className="cursor-pointer hover:border-primary/50 transition-colors"
                          onClick={() => navigate(`/admin/parceiros/${p.id}`)}
                        >
                          <CardContent className="p-3 space-y-2">
                            <p className="font-medium text-sm truncate">{p.nome}</p>
                            {p.telefone && (
                              <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                                <Phone className="w-3 h-3" /> {p.telefone}
                              </div>
                            )}
                            {p.captacao_tipo && (
                              <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                                <User className="w-3 h-3" /> {p.captacao_tipo}
                              </div>
                            )}
                            <div className="flex gap-1 flex-wrap">
                              {(p as any).reuniao_marcada && <Badge variant="outline" className="text-[10px]">📅 {(p as any).reuniao_marcada}</Badge>}
                              {(p as any).criou_mei === 'Sim' && <Badge variant="outline" className="text-[10px]">✅ MEI</Badge>}
                              {(p as any).enviou_link && <Badge variant="outline" className="text-[10px]">🔗 Link</Badge>}
                            </div>
                            {/* Quick status move */}
                            <div onClick={e => e.stopPropagation()}>
                              <Select
                                value={p.pipeline_status}
                                onValueChange={v => updatePipelineStatus(p.id, v)}
                              >
                                <SelectTrigger className="h-6 text-[10px] border-dashed">
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                  {PIPELINE_STATUSES.map(s => (
                                    <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            </div>
                          </CardContent>
                        </Card>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
            <ScrollBar orientation="horizontal" />
          </ScrollArea>
        )}
      </div>

      {/* Create Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Novo Parceiro</DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 py-2">
            <div className="grid gap-2">
              <Label>Nome *</Label>
              <Input value={form.nome} onChange={e => setForm(f => ({ ...f, nome: e.target.value }))} placeholder="Nome completo" />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label>Telefone</Label>
                <Input value={form.telefone} onChange={e => setForm(f => ({ ...f, telefone: e.target.value }))} placeholder="(00) 00000-0000" />
              </div>
              <div className="grid gap-2">
                <Label>CPF</Label>
                <Input value={form.cpf} onChange={e => setForm(f => ({ ...f, cpf: e.target.value }))} placeholder="000.000.000-00" />
              </div>
            </div>
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
            <Button onClick={() => createMutation.mutate()} disabled={!form.nome || createMutation.isPending}>
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
