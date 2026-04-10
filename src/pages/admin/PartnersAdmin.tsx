import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import DashboardLayout from '@/components/layout/DashboardLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Textarea } from '@/components/ui/textarea';
import { toast } from '@/hooks/use-toast';
import { useNavigate } from 'react-router-dom';
import { Plus, Search, Eye, Trash2, ScrollText } from 'lucide-react';
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

  const [form, setForm] = useState({
    nome: '', telefone: '', cpf: '', email: '',
    captacao_tipo: '', indicado_por: '',
    pipeline_status: 'contato_inicial', obs: '',
  });

  // Always fetch ALL partners for accurate counts, filter in front-end
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

      // Log history
      // We'll do this via a separate insert since we need the partner id
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

  const filtered = partners.filter(p => {
    if (!search) return true;
    const s = search.toLowerCase();
    return (p.nome?.toLowerCase().includes(s)) ||
      (p.cpf?.toLowerCase().includes(s)) ||
      (p.telefone?.toLowerCase().includes(s)) ||
      (p.cnpj?.toLowerCase().includes(s));
  });

  // Count over ALL partners regardless of active filter
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
              <ScrollText className="w-4 h-4 mr-2" /> Template do Contrato
            </Button>
            <Button onClick={() => setDialogOpen(true)}>
              <Plus className="w-4 h-4 mr-2" /> Novo Parceiro
            </Button>
          </div>
        </div>

        {/* Status cards */}
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

        {/* Search */}
        <div className="relative max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input placeholder="Buscar por nome, CPF, telefone ou CNPJ..." value={search} onChange={e => setSearch(e.target.value)} className="pl-9" />
        </div>

        {/* Table */}
        <Card>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Data</TableHead>
                  <TableHead>Nome</TableHead>
                  <TableHead>Telefone</TableHead>
                  <TableHead>CPF</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Captação</TableHead>
                  <TableHead>Indicado por</TableHead>
                  <TableHead className="w-[100px]">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  <TableRow><TableCell colSpan={8} className="text-center py-8 text-muted-foreground">Carregando...</TableCell></TableRow>
                ) : filtered.length === 0 ? (
                  <TableRow><TableCell colSpan={8} className="text-center py-8 text-muted-foreground">Nenhum parceiro encontrado</TableCell></TableRow>
                ) : filtered.map(p => (
                  <TableRow key={p.id} className="cursor-pointer hover:bg-muted/50" onClick={() => navigate(`/admin/parceiros/${p.id}`)}>
                    <TableCell className="text-xs text-muted-foreground whitespace-nowrap">
                      {p.data_contato ? format(new Date(p.data_contato + 'T12:00:00'), 'dd/MM/yyyy') : format(new Date(p.created_at), 'dd/MM/yyyy')}
                    </TableCell>
                    <TableCell className="font-medium">{p.nome}</TableCell>
                    <TableCell className="text-sm">{p.telefone || '—'}</TableCell>
                    <TableCell className="text-sm">{p.cpf || '—'}</TableCell>
                    <TableCell>{getStatusBadge(p.pipeline_status)}</TableCell>
                    <TableCell className="text-sm">{p.captacao_tipo || '—'}</TableCell>
                    <TableCell className="text-sm">{p.indicado_por || '—'}</TableCell>
                    <TableCell>
                      <div className="flex gap-1" onClick={e => e.stopPropagation()}>
                        <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => navigate(`/admin/parceiros/${p.id}`)}>
                          <Eye className="w-4 h-4" />
                        </Button>
                        <Button size="icon" variant="ghost" className="h-8 w-8 text-destructive" onClick={() => setDeleteId(p.id)}>
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
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
