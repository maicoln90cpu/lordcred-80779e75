import { useState, useMemo, useEffect } from 'react';
import DashboardLayout from '@/components/layout/DashboardLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHeader, TableRow } from '@/components/ui/table';
import { supabase } from '@/integrations/supabase/client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from '@/hooks/use-toast';
import { Plus, Pencil, Trash2, Eye, EyeOff, ExternalLink, Landmark, Loader2, Search } from 'lucide-react';
import { TSHead } from '@/components/commission-reports/CRSortUtils';
import { useTableState } from '@/hooks/useTableState';
import { TablePagination } from '@/components/common/TablePagination';
import { useFeatureAccess } from '@/hooks/useFeatureAccess';
import { EmptyStateNoAccess } from '@/components/common/EmptyStateNoAccess';
import { MenuOnlyScopeBanner } from '@/components/common/MenuOnlyScopeBanner';

interface BankCredential {
  id: string;
  bank_name: string;
  username: string;
  password: string;
  link: string;
  created_at: string;
  updated_at: string;
}

const emptyForm = { bank_name: '', username: '', password: '', link: '' };

export default function BankCredentials() {
  const queryClient = useQueryClient();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [visiblePasswords, setVisiblePasswords] = useState<Set<string>>(new Set());
  const [search, setSearch] = useState('');
  const table = useTableState<BankCredential>({ pageSize: 25, resetPageOn: [search] });
  const { sort, toggleSort: toggle, page, setPage } = table;

  const { canSee, loading: accessLoading, isMenuOnly } = useFeatureAccess('bank_credentials');

  const { data: banks = [], isLoading } = useQuery({
    queryKey: ['bank-credentials'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('bank_credentials')
        .select('*')
        .order('bank_name');
      if (error) throw error;
      return data as BankCredential[];
    },
  });

  const sorted = useMemo(() => applySortToData(banks, sort), [banks, sort]);

  const saveMutation = useMutation({
    mutationFn: async (payload: typeof emptyForm & { id?: string }) => {
      if (payload.id) {
        const { error } = await supabase
          .from('bank_credentials')
          .update({ bank_name: payload.bank_name, username: payload.username, password: payload.password, link: payload.link })
          .eq('id', payload.id);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('bank_credentials')
          .insert({ bank_name: payload.bank_name, username: payload.username, password: payload.password, link: payload.link });
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['bank-credentials'] });
      toast({ title: editingId ? 'Banco atualizado' : 'Banco adicionado' });
      closeDialog();
    },
    onError: (e: Error) => toast({ title: 'Erro', description: e.message, variant: 'destructive' }),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('bank_credentials').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['bank-credentials'] });
      toast({ title: 'Banco removido' });
      setDeleteId(null);
    },
    onError: (e: Error) => toast({ title: 'Erro', description: e.message, variant: 'destructive' }),
  });

  const closeDialog = () => {
    setDialogOpen(false);
    setEditingId(null);
    setForm(emptyForm);
  };

  const openEdit = (b: BankCredential) => {
    setEditingId(b.id);
    setForm({ bank_name: b.bank_name, username: b.username, password: b.password, link: b.link });
    setDialogOpen(true);
  };

  const togglePassword = (id: string) => {
    setVisiblePasswords(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const handleSave = () => {
    if (!form.bank_name.trim()) {
      toast({ title: 'Preencha o nome do banco', variant: 'destructive' });
      return;
    }
    saveMutation.mutate(editingId ? { ...form, id: editingId } : form);
  };

  if (accessLoading) return <DashboardLayout><div className="flex items-center justify-center py-20"><Loader2 className="w-6 h-6 animate-spin" /></div></DashboardLayout>;
  if (!canSee) return <DashboardLayout><EmptyStateNoAccess feature="Bancos" /></DashboardLayout>;

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
           <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
              <Landmark className="w-6 h-6" /> Bancos
            </h1>
            <p className="text-muted-foreground mt-1">Credenciais de acesso aos bancos parceiros</p>
          </div>
          <Button onClick={() => { setForm(emptyForm); setEditingId(null); setDialogOpen(true); }}>
            <Plus className="h-4 w-4 mr-2" /> Adicionar Banco
          </Button>
        </div>

        {isMenuOnly && <MenuOnlyScopeBanner feature="Bancos" />}

        <Card>
          <CardHeader>
            <CardTitle>Credenciais Cadastradas</CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="flex items-center justify-center py-12"><Loader2 className="w-6 h-6 animate-spin text-muted-foreground" /></div>
            ) : sorted.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground"><Landmark className="w-8 h-8 mx-auto mb-2 opacity-40" /><p>Nenhum banco cadastrado</p></div>
            ) : (
              <Table>
                <TableHeader>
                  <tr>
                    <TSHead label="Banco" sortKey="bank_name" sort={sort} toggle={toggle} />
                    <TSHead label="Usuário" sortKey="username" sort={sort} toggle={toggle} />
                    <TSHead label="Senha" sortKey="password" sort={sort} toggle={toggle} />
                    <TSHead label="Link" sortKey="link" sort={sort} toggle={toggle} />
                    <th className="text-right px-4 py-2 text-sm font-medium">Ações</th>
                  </tr>
                </TableHeader>
                <TableBody>
                  {sorted.map(b => (
                    <TableRow key={b.id}>
                      <TableCell className="font-medium">{b.bank_name}</TableCell>
                      <TableCell>{b.username}</TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <span className="font-mono text-sm">
                            {visiblePasswords.has(b.id) ? b.password : '••••••••'}
                          </span>
                          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => togglePassword(b.id)}>
                            {visiblePasswords.has(b.id) ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                          </Button>
                        </div>
                      </TableCell>
                      <TableCell>
                        {b.link ? (
                          <a href={b.link.startsWith('http') ? b.link : `https://${b.link}`} target="_blank" rel="noopener noreferrer"
                            className="text-primary hover:underline flex items-center gap-1 max-w-[200px] truncate">
                            <ExternalLink className="h-3.5 w-3.5 shrink-0" />
                            <span className="truncate">{b.link}</span>
                          </a>
                        ) : '-'}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-1">
                          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => openEdit(b)}>
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive hover:text-destructive" onClick={() => setDeleteId(b.id)}>
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>

      <Dialog open={dialogOpen} onOpenChange={v => { if (!v) closeDialog(); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingId ? 'Editar Banco' : 'Adicionar Banco'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Nome do Banco *</Label>
              <Input value={form.bank_name} onChange={e => setForm(f => ({ ...f, bank_name: e.target.value }))} placeholder="Ex: Parana Banco" />
            </div>
            <div>
              <Label>Usuário / Login</Label>
              <Input value={form.username} onChange={e => setForm(f => ({ ...f, username: e.target.value }))} placeholder="Login de acesso" />
            </div>
            <div>
              <Label>Senha</Label>
              <Input type="password" value={form.password} onChange={e => setForm(f => ({ ...f, password: e.target.value }))} placeholder="Senha de acesso" />
            </div>
            <div>
              <Label>Link de Acesso</Label>
              <Input value={form.link} onChange={e => setForm(f => ({ ...f, link: e.target.value }))} placeholder="https://sistema.banco.com.br" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={closeDialog}>Cancelar</Button>
            <Button onClick={handleSave} disabled={saveMutation.isPending}>
              {saveMutation.isPending ? 'Salvando...' : 'Salvar'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!deleteId} onOpenChange={v => { if (!v) setDeleteId(null); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Confirmar Exclusão</DialogTitle>
          </DialogHeader>
          <p className="text-muted-foreground">Deseja realmente excluir este banco? Esta ação não pode ser desfeita.</p>
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
