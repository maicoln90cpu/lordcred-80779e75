import { useState } from 'react';
import { Users as UsersIcon, Shield, ShieldOff, Smartphone, Loader2, Trash2, Pencil } from 'lucide-react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import { TSHead, useSortState, applySortToData } from '@/components/commission-reports/CRSortUtils';

interface UserProfile {
  id: string;
  user_id: string;
  email: string;
  name: string | null;
  is_blocked: boolean;
  created_at: string;
  created_by: string | null;
  chip_count: number;
  max_chips: number;
  role: string;
}

const getRoleLabel = (role: string) => {
  switch (role) {
    // 'master' nunca deve chegar aqui (filtrado no Users.tsx); fallback neutro por defesa em profundidade.
    case 'master': return 'Administrador';
    case 'admin': return 'Administrador';
    case 'manager': return 'Gerente';
    case 'seller': return 'Vendedor';
    case 'support': return 'Suporte';
    default: return role;
  }
};

interface UsersTableProps {
  users: UserProfile[];
  isLoading: boolean;
  isSupport: boolean;
  isMaster: boolean;
  isRegularAdmin: boolean;
  canManageUsers: boolean;
  statusFilter: 'active' | 'blocked' | 'all';
  onStatusFilterChange: (value: 'active' | 'blocked' | 'all') => void;
  onEditUser: (user: UserProfile) => void;
  onRefresh: () => void;
}

export function UsersTable({ users, isLoading, isSupport, isMaster, isRegularAdmin, canManageUsers, statusFilter, onStatusFilterChange, onEditUser, onRefresh }: UsersTableProps) {
  const { toast } = useToast();
  const { sort, toggle } = useSortState();
  const [page, setPage] = useState(0);
  const PAGE_SIZE = 50;
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [userToDelete, setUserToDelete] = useState<UserProfile | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const handleToggleBlock = async (userId: string, currentBlocked: boolean) => {
    try {
      const { error } = await supabase.from('profiles').update({ is_blocked: !currentBlocked }).eq('user_id', userId);
      if (error) throw error;
      toast({ title: currentBlocked ? 'Usuário desbloqueado' : 'Usuário bloqueado', description: `O acesso foi ${currentBlocked ? 'liberado' : 'bloqueado'}` });
      onRefresh();
    } catch (error) {
      toast({ title: 'Erro', description: 'Não foi possível alterar o status', variant: 'destructive' });
    }
  };

  const handleDeleteUser = async () => {
    if (!userToDelete) return;
    setIsDeleting(true);
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData?.session?.access_token;
      if (!token) throw new Error('Sessão expirada');

      const response = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/delete-user`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify({ userId: userToDelete.user_id }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || 'Erro ao excluir usuário');

      toast({ title: 'Usuário excluído', description: 'O usuário foi removido permanentemente' });
      setDeleteDialogOpen(false);
      setUserToDelete(null);
      onRefresh();
    } catch (error: any) {
      toast({ title: 'Erro ao excluir usuário', description: error.message || 'Tente novamente', variant: 'destructive' });
    } finally {
      setIsDeleting(false);
    }
  };

  const handleRoleChange = async (user: UserProfile, value: string) => {
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData?.session?.access_token;
      if (!token) throw new Error('Sessão expirada');
      const response = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/update-user-role`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify({ targetUserId: user.user_id, newRole: value }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error);
      toast({ title: 'Role atualizada', description: `${user.email} agora é ${getRoleLabel(value)}` });
      onRefresh();
    } catch (error: any) {
      toast({ title: 'Erro', description: error.message, variant: 'destructive' });
    }
  };

  return (
    <>
      <Card className="border-border/50">
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <UsersIcon className="w-5 h-5" />
              {isMaster ? 'Usuários Cadastrados' : 'Meus Usuários'}
            </CardTitle>
            <Select value={statusFilter} onValueChange={(v) => onStatusFilterChange(v as 'active' | 'blocked' | 'all')}>
              <SelectTrigger className="w-[140px]"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="active">Ativos</SelectItem>
                <SelectItem value="blocked">Inativos</SelectItem>
                <SelectItem value="all">Todos</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <CardDescription>{users.length} usuário(s) encontrado(s)</CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex items-center justify-center py-12"><Loader2 className="w-6 h-6 animate-spin text-muted-foreground" /></div>
          ) : users.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground"><UsersIcon className="w-8 h-8 mx-auto mb-2 opacity-40" /><p>Nenhum usuário cadastrado</p></div>
          ) : (
            <Table>
              <TableHeader>
                <tr>
                  <TSHead label="Usuário" sortKey="name" sort={sort} toggle={toggle} />
                  <TSHead label="Role" sortKey="role" sort={sort} toggle={toggle} />
                  <TSHead label="Chips" sortKey="chip_count" sort={sort} toggle={toggle} />
                  <TSHead label="Status" sortKey="is_blocked" sort={sort} toggle={toggle} />
                  {!isSupport && <th className="text-right px-4 py-2 text-sm font-medium">Ações</th>}
                </tr>
              </TableHeader>
              <TableBody>
                {(() => {
                  const sorted = applySortToData(users, sort, (item, key) => {
                    if (key === 'name') return item.name || item.email;
                    return (item as any)[key];
                  });
                  const totalPages = Math.ceil(sorted.length / PAGE_SIZE);
                  const paged = sorted.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);
                  return (
                    <>
                      {paged.map((user) => (
                        <TableRow key={user.id}>
                          <TableCell>
                            <div>
                              <p className="font-medium">{user.name || user.email}</p>
                              {user.name && <p className="text-sm text-muted-foreground">{user.email}</p>}
                            </div>
                          </TableCell>
                          <TableCell>
                            {(isMaster || isRegularAdmin) && user.role !== 'master' ? (
                              <Select value={user.role} onValueChange={(value) => handleRoleChange(user, value)}>
                                <SelectTrigger className="w-[140px]"><SelectValue /></SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="admin">Administrador</SelectItem>
                                  <SelectItem value="manager">Gerente</SelectItem>
                                  <SelectItem value="seller">Vendedor</SelectItem>
                                  <SelectItem value="support">Suporte</SelectItem>
                                </SelectContent>
                              </Select>
                            ) : (
                              <Badge variant="outline">{getRoleLabel(user.role)}</Badge>
                            )}
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center gap-1.5">
                              <Smartphone className="w-4 h-4 text-muted-foreground" />
                              <span>{user.chip_count}/{user.max_chips}</span>
                            </div>
                          </TableCell>
                          <TableCell>
                            <Badge variant={user.is_blocked ? 'destructive' : 'outline'}>
                              {user.is_blocked ? 'Bloqueado' : 'Ativo'}
                            </Badge>
                          </TableCell>
                          {!isSupport && (
                            <TableCell className="text-right">
                              <div className="flex items-center justify-end gap-1">
                                <Button variant="ghost" size="sm" onClick={() => handleToggleBlock(user.user_id, user.is_blocked)} className={cn(user.is_blocked ? "text-primary hover:text-primary" : "text-destructive hover:text-destructive")}>
                                  {user.is_blocked ? <><Shield className="w-4 h-4 mr-1" />Desbloquear</> : <><ShieldOff className="w-4 h-4 mr-1" />Bloquear</>}
                                </Button>
                                <Button variant="ghost" size="sm" onClick={() => onEditUser(user)}>
                                  <Pencil className="w-4 h-4 mr-1" />Editar
                                </Button>
                                <Button variant="ghost" size="sm" onClick={() => { setUserToDelete(user); setDeleteDialogOpen(true); }} className="text-destructive hover:text-destructive">
                                  <Trash2 className="w-4 h-4 mr-1" />Excluir
                                </Button>
                              </div>
                            </TableCell>
                          )}
                        </TableRow>
                      ))}
                      {totalPages > 1 && (
                        <TableRow>
                          <TableCell colSpan={isSupport ? 4 : 5}>
                            <div className="flex items-center justify-center gap-2 py-1">
                              <Button variant="outline" size="sm" disabled={page === 0} onClick={() => setPage(p => p - 1)}>Anterior</Button>
                              <span className="text-xs text-muted-foreground">Página {page + 1} de {totalPages} ({sorted.length} usuários)</span>
                              <Button variant="outline" size="sm" disabled={page >= totalPages - 1} onClick={() => setPage(p => p + 1)}>Próxima</Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      )}
                    </>
                  );
                })()}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir Usuário</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja excluir permanentemente o usuário{' '}
              <span className="font-medium text-foreground">{userToDelete?.name || userToDelete?.email}</span>?
              <br /><br />Esta ação não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeleting}>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={(e) => { e.preventDefault(); handleDeleteUser(); }} disabled={isDeleting} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              {isDeleting ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Excluindo...</> : 'Excluir Permanentemente'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
