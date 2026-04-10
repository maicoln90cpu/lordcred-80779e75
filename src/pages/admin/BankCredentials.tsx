import { useState } from 'react';
import DashboardLayout from '@/components/layout/DashboardLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { supabase } from '@/integrations/supabase/client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from '@/hooks/use-toast';
import { Plus, Pencil, Trash2, Eye, EyeOff, ExternalLink, Landmark } from 'lucide-react';

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

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-foreground flex items-center gap-2">
              <Landmark className="h-8 w-8" /> Bancos
            </h1>
            <p className="text-muted-foreground mt-1">Credenciais de acesso aos bancos parceiros</p>
          </div>
          <Button onClick={() => { setForm(emptyForm); setEditingId(null); setDialogOpen(true); }}>
            <Plus className="h-4 w-4 mr-2" /> Adicionar Banco
          </Button>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Credenciais Cadastradas</CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <p className="text-muted-foreground text-center py-8">Carregando...</p>
            ) : banks.length === 0 ? (
              <p className="text-muted-foreground text-center py-8">Nenhum banco cadastrado</p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Banco</TableHead>
                    <TableHead>Usuário</TableHead>
                    <TableHead>Senha</TableHead>
                    <TableHead>Link</TableHead>
                    <TableHead className="text-right">Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {banks.map(b => (
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

      {/* Add/Edit Dialog */}
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

      {/* Delete Confirmation */}
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
