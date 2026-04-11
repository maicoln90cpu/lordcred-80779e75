import { useEffect, useState, useMemo } from 'react';
import { Plus, Users as UsersIcon, Shield, ShieldOff, Smartphone, Loader2, Trash2, Pencil, Eye, EyeOff, KeyRound } from 'lucide-react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { supabase } from '@/integrations/supabase/client';
import DashboardLayout from '@/components/layout/DashboardLayout';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/contexts/AuthContext';
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

export default function Users() {
  const { toast } = useToast();
  const { user: currentUser, isAdmin, isSupport, userRole } = useAuth();
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isCreating, setIsCreating] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [userToDelete, setUserToDelete] = useState<UserProfile | null>(null);
  const [userToEdit, setUserToEdit] = useState<UserProfile | null>(null);
  const [editName, setEditName] = useState('');
  const [editEmail, setEditEmail] = useState('');
  const [isUpdatingEmail, setIsUpdatingEmail] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [newUserEmail, setNewUserEmail] = useState('');
  const [newUserPassword, setNewUserPassword] = useState('');
  const [newUserName, setNewUserName] = useState('');
  const [newUserRole, setNewUserRole] = useState<'admin' | 'manager' | 'seller' | 'support'>('seller');
  const [showPassword, setShowPassword] = useState(false);
  const [editMaxChips, setEditMaxChips] = useState(5);
  const [resetPasswordValue, setResetPasswordValue] = useState('');
  const [isResettingPassword, setIsResettingPassword] = useState(false);
  const [showResetPassword, setShowResetPassword] = useState(false);
  const [editRole, setEditRole] = useState<string>('seller');

  const { isMaster } = useAuth();
  const isRegularAdmin = userRole === 'admin'; // Administrador (not master)
  // Support can only create sellers, cannot edit/delete/block
  const canManageUsers = isMaster || (!isSupport && isRegularAdmin);
  // Master and Admin can choose role when creating
  const canChooseRole = isMaster || isRegularAdmin;

  useEffect(() => {
    fetchUsers();
  }, []);

  const fetchUsers = async () => {
    try {
      const { data: profilesData, error: profilesError } = await supabase
        .from('profiles')
        .select('*')
        .order('created_at', { ascending: false });

      if (profilesError) throw profilesError;

      const { data: rolesData } = await supabase
        .from('user_roles')
        .select('user_id, role');

      const { data: chipsData } = await supabase
        .from('chips')
        .select('user_id');

      const chipCounts = (chipsData || []).reduce((acc, chip) => {
        acc[chip.user_id] = (acc[chip.user_id] || 0) + 1;
        return acc;
      }, {} as Record<string, number>);

      const rolesMap = (rolesData || []).reduce((acc, r) => {
        acc[r.user_id] = r.role;
        return acc;
      }, {} as Record<string, string>);

      // Use SECURITY DEFINER RPC to get master user IDs (RLS may hide master roles from non-masters)
      let masterUserIds = new Set<string>();
      if (!isMaster) {
        const { data: masterIds } = await supabase.rpc('get_master_user_ids');
        masterUserIds = new Set<string>((masterIds as string[]) || []);
      }

      let enrichedUsers = (profilesData || []).map(profile => ({
        ...profile,
        chip_count: chipCounts[profile.user_id] || 0,
        max_chips: (profile as any).max_chips ?? 5,
        role: masterUserIds.has(profile.user_id) ? 'master' : (rolesMap[profile.user_id] || 'seller'),
      }));

      // Filter based on caller's role
      if (isMaster) {
        // Master sees all non-master users, excluding self
        enrichedUsers = enrichedUsers.filter(u => u.role !== 'master');
      } else if (isSupport) {
        // Support sees all sellers and other supports, excluding admins/masters and self
        enrichedUsers = enrichedUsers.filter(u => 
          (u.role === 'seller' || u.role === 'support') && u.user_id !== currentUser?.id
        );
      } else {
        // Administrador: exclude masters (via RPC) and self
        enrichedUsers = enrichedUsers.filter(u => u.role !== 'master' && u.user_id !== currentUser?.id);
      }

      setUsers(enrichedUsers);
    } catch (error) {
      console.error('Error fetching users:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleCreateUser = async () => {
    if (!newUserEmail || !newUserPassword) {
      toast({ title: 'Erro', description: 'Preencha email e senha', variant: 'destructive' });
      return;
    }
    if (newUserPassword.length < 6) {
      toast({ title: 'Erro', description: 'Senha deve ter pelo menos 6 caracteres', variant: 'destructive' });
      return;
    }

    setIsCreating(true);
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData?.session?.access_token;
      if (!token) throw new Error('Sessão expirada');

      // Support always creates sellers; Admin/Master can choose
      const roleToCreate = canChooseRole ? newUserRole : 'seller';

      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/create-user`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`,
          },
          body: JSON.stringify({
            email: newUserEmail,
            password: newUserPassword,
            name: newUserName || null,
            role: roleToCreate,
          }),
        }
      );

      const result = await response.json();
      if (!response.ok) throw new Error(result.error || 'Erro ao criar usuário');

      toast({ title: 'Usuário criado', description: 'O usuário foi criado com sucesso' });
      setDialogOpen(false);
      setNewUserEmail('');
      setNewUserPassword('');
      setNewUserName('');
      setNewUserRole('seller');
      fetchUsers();
    } catch (error: any) {
      console.error('Error creating user:', error);
      toast({ title: 'Erro ao criar usuário', description: error.message || 'Tente novamente', variant: 'destructive' });
    } finally {
      setIsCreating(false);
    }
  };

  const handleToggleBlock = async (userId: string, currentBlocked: boolean) => {
    try {
      const { error } = await supabase
        .from('profiles')
        .update({ is_blocked: !currentBlocked })
        .eq('user_id', userId);
      if (error) throw error;
      toast({
        title: currentBlocked ? 'Usuário desbloqueado' : 'Usuário bloqueado',
        description: `O acesso foi ${currentBlocked ? 'liberado' : 'bloqueado'}`,
      });
      fetchUsers();
    } catch (error) {
      console.error('Error toggling block:', error);
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

      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/delete-user`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`,
          },
          body: JSON.stringify({ userId: userToDelete.user_id }),
        }
      );
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || 'Erro ao excluir usuário');

      toast({ title: 'Usuário excluído', description: 'O usuário foi removido permanentemente' });
      setUsers(prev => prev.filter(u => u.user_id !== userToDelete.user_id));
      setDeleteDialogOpen(false);
      setUserToDelete(null);
    } catch (error: any) {
      console.error('Error deleting user:', error);
      toast({ title: 'Erro ao excluir usuário', description: error.message || 'Tente novamente', variant: 'destructive' });
    } finally {
      setIsDeleting(false);
    }
  };

  const getRoleLabel = (role: string) => {
    switch (role) {
      case 'master': return 'Master';
      case 'admin': return 'Administrador';
      case 'manager': return 'Gerente';
      case 'seller': return 'Vendedor';
      case 'support': return 'Suporte';
      default: return role;
    }
  };

  const pageTitle = isMaster ? 'Gerenciar Usuários' : isSupport ? 'Meus Vendedores' : 'Gerenciar Usuários';
  const pageDescription = isMaster
    ? 'Crie e gerencie administradores, suportes e vendedores'
    : isSupport
    ? 'Crie vendedores para sua equipe'
    : 'Crie e gerencie vendedores e suportes da sua equipe';

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold">{pageTitle}</h1>
            <p className="text-muted-foreground">{pageDescription}</p>
          </div>
          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="w-4 h-4 mr-2" />
                {canChooseRole ? 'Novo Usuário' : 'Novo Vendedor'}
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>{canChooseRole ? 'Criar Novo Usuário' : 'Criar Novo Vendedor'}</DialogTitle>
                <DialogDescription>
                  Preencha os dados para criar uma nova conta
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4 py-4">
                <div className="space-y-2">
                  <Label htmlFor="name">Nome (opcional)</Label>
                  <Input id="name" placeholder="Nome do usuário" value={newUserName} onChange={(e) => setNewUserName(e.target.value)} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="email">Email</Label>
                  <Input id="email" type="email" placeholder="email@exemplo.com" value={newUserEmail} onChange={(e) => setNewUserEmail(e.target.value)} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="password">Senha</Label>
                  <div className="relative">
                    <Input id="password" type={showPassword ? 'text' : 'password'} placeholder="Mínimo 6 caracteres" value={newUserPassword} onChange={(e) => setNewUserPassword(e.target.value)} className="pr-10" />
                    <Button type="button" variant="ghost" size="sm" className="absolute right-0 top-0 h-full px-3 hover:bg-transparent" onClick={() => setShowPassword(!showPassword)}>
                      {showPassword ? <EyeOff className="w-4 h-4 text-muted-foreground" /> : <Eye className="w-4 h-4 text-muted-foreground" />}
                    </Button>
                  </div>
                </div>
                {/* Admin and Master see role selection */}
                {canChooseRole && (
                  <div className="space-y-3">
                    <Label>Tipo de Usuário</Label>
                    <RadioGroup
                      value={newUserRole}
                      onValueChange={(value) => setNewUserRole(value as 'admin' | 'seller' | 'support')}
                      className="flex flex-wrap gap-4"
                    >
                      <div className="flex items-center space-x-2">
                        <RadioGroupItem value="seller" id="role-seller" />
                        <Label htmlFor="role-seller" className="cursor-pointer">Vendedor</Label>
                      </div>
                      <div className="flex items-center space-x-2">
                        <RadioGroupItem value="support" id="role-support" />
                        <Label htmlFor="role-support" className="cursor-pointer">Suporte</Label>
                      </div>
                      <div className="flex items-center space-x-2">
                        <RadioGroupItem value="manager" id="role-manager" />
                        <Label htmlFor="role-manager" className="cursor-pointer">Gerente</Label>
                      </div>
                      {isMaster && (
                        <div className="flex items-center space-x-2">
                          <RadioGroupItem value="admin" id="role-admin" />
                          <Label htmlFor="role-admin" className="cursor-pointer">Administrador</Label>
                        </div>
                      )}
                    </RadioGroup>
                  </div>
                )}
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancelar</Button>
                <Button onClick={handleCreateUser} disabled={isCreating}>
                  {isCreating ? (
                    <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Criando...</>
                  ) : (
                    isMaster || isRegularAdmin ? 'Criar Usuário' : 'Criar Vendedor'
                  )}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>

        <Card className="border-border/50">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <UsersIcon className="w-5 h-5" />
              {isMaster ? 'Usuários Cadastrados' : 'Meus Usuários'}
            </CardTitle>
            <CardDescription>
              {users.length} usuário(s) encontrado(s)
            </CardDescription>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="text-center py-8 text-muted-foreground">Carregando...</div>
            ) : users.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">Nenhum usuário cadastrado</div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Usuário</TableHead>
                    <TableHead>Role</TableHead>
                    <TableHead>Chips</TableHead>
                    <TableHead>Status</TableHead>
                    {!isSupport && <TableHead className="text-right">Ações</TableHead>}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {users.map((user) => (
                    <TableRow key={user.id}>
                      <TableCell>
                        <div>
                          <p className="font-medium">{user.name || user.email}</p>
                          {user.name && <p className="text-sm text-muted-foreground">{user.email}</p>}
                        </div>
                      </TableCell>
                      <TableCell>
                        {(isMaster || isRegularAdmin) && user.role !== 'master' ? (
                          <Select
                            value={user.role}
                            onValueChange={async (value) => {
                              try {
                                const { data: sessionData } = await supabase.auth.getSession();
                                const token = sessionData?.session?.access_token;
                                if (!token) throw new Error('Sessão expirada');
                                const response = await fetch(
                                  `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/update-user-role`,
                                  {
                                    method: 'POST',
                                    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
                                    body: JSON.stringify({ targetUserId: user.user_id, newRole: value }),
                                  }
                                );
                                const result = await response.json();
                                if (!response.ok) throw new Error(result.error);
                                toast({ title: 'Role atualizada', description: `${user.email} agora é ${getRoleLabel(value)}` });
                                fetchUsers();
                              } catch (error: any) {
                                toast({ title: 'Erro', description: error.message, variant: 'destructive' });
                              }
                            }}
                          >
                            <SelectTrigger className="w-[140px]">
                              <SelectValue />
                            </SelectTrigger>
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
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleToggleBlock(user.user_id, user.is_blocked)}
                              className={cn(
                                user.is_blocked
                                  ? "text-primary hover:text-primary"
                                  : "text-destructive hover:text-destructive"
                              )}
                            >
                              {user.is_blocked ? (
                                <><Shield className="w-4 h-4 mr-1" />Desbloquear</>
                              ) : (
                                <><ShieldOff className="w-4 h-4 mr-1" />Bloquear</>
                              )}
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => { setUserToEdit(user); setEditName(user.name || ''); setEditEmail(user.email); setEditMaxChips(user.max_chips); setEditRole(user.role); setResetPasswordValue(''); setShowResetPassword(false); setEditDialogOpen(true); }}
                            >
                              <Pencil className="w-4 h-4 mr-1" />Editar
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => { setUserToDelete(user); setDeleteDialogOpen(true); }}
                              className="text-destructive hover:text-destructive"
                            >
                              <Trash2 className="w-4 h-4 mr-1" />Excluir
                            </Button>
                          </div>
                        </TableCell>
                      )}
                    </TableRow>
                  ))}
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
                <br /><br />
                Esta ação não pode ser desfeita.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel disabled={isDeleting}>Cancelar</AlertDialogCancel>
              <AlertDialogAction
                onClick={(e) => {
                  e.preventDefault();
                  handleDeleteUser();
                }}
                disabled={isDeleting}
                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              >
                {isDeleting ? (<><Loader2 className="w-4 h-4 mr-2 animate-spin" />Excluindo...</>) : 'Excluir Permanentemente'}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Editar Usuário</DialogTitle>
              <DialogDescription>Alterar dados de {userToEdit?.email}</DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="edit-name">Nome</Label>
                <Input id="edit-name" value={editName} onChange={(e) => setEditName(e.target.value)} placeholder="Nome do usuário" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="edit-email">Email</Label>
                <Input id="edit-email" type="email" value={editEmail} onChange={(e) => setEditEmail(e.target.value)} placeholder="email@exemplo.com" />
                <p className="text-xs text-muted-foreground">Alterar o email permite migrar contas fake para o usuário real (mantém todo o histórico vinculado ao UUID)</p>
              </div>
              <div className="space-y-2">
                <Label htmlFor="edit-max-chips">Máx. Chips</Label>
                <Input id="edit-max-chips" type="number" min={1} max={50} value={editMaxChips} onChange={(e) => setEditMaxChips(Number(e.target.value))} />
                <p className="text-xs text-muted-foreground">Número máximo de chips que este usuário pode criar</p>
              </div>
              
              {/* Role editing */}
              {canManageUsers && userToEdit && userToEdit.role !== 'master' && (
                <div className="space-y-2">
                  <Label>Tipo de Usuário</Label>
                  <Select value={editRole} onValueChange={setEditRole}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="seller">Vendedor</SelectItem>
                      <SelectItem value="support">Suporte</SelectItem>
                      <SelectItem value="admin">Administrador</SelectItem>
                    </SelectContent>
                  </Select>
                  <p className="text-xs text-muted-foreground">Alterar o tipo de acesso deste usuário</p>
                </div>
              )}

              {/* Reset password section */}
              <div className="space-y-2 border-t pt-4">
                <Button
                  variant="outline"
                  size="sm"
                  className="w-full"
                  onClick={() => setShowResetPassword(!showResetPassword)}
                >
                  <KeyRound className="w-4 h-4 mr-2" />
                  {showResetPassword ? 'Cancelar Reset de Senha' : 'Resetar Senha'}
                </Button>
                {showResetPassword && (
                  <div className="space-y-2">
                    <Label htmlFor="reset-password">Nova Senha</Label>
                    <Input
                      id="reset-password"
                      type="password"
                      placeholder="Mínimo 6 caracteres"
                      value={resetPasswordValue}
                      onChange={(e) => setResetPasswordValue(e.target.value)}
                    />
                    <Button
                      variant="destructive"
                      size="sm"
                      className="w-full"
                      disabled={isResettingPassword || resetPasswordValue.length < 6}
                      onClick={async () => {
                        if (!userToEdit) return;
                        setIsResettingPassword(true);
                        try {
                          const { data: sessionData } = await supabase.auth.getSession();
                          const token = sessionData?.session?.access_token;
                          if (!token) throw new Error('Sessão expirada');
                          
                          const response = await fetch(
                            `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/create-user`,
                            {
                              method: 'POST',
                              headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
                              body: JSON.stringify({ action: 'reset-password', targetUserId: userToEdit.user_id, newPassword: resetPasswordValue }),
                            }
                          );
                          const result = await response.json();
                          if (!response.ok) throw new Error(result.error || 'Erro ao resetar senha');
                          
                          toast({ title: 'Senha resetada', description: `Senha de ${userToEdit.email} foi alterada` });
                          setShowResetPassword(false);
                          setResetPasswordValue('');
                        } catch (error: any) {
                          toast({ title: 'Erro', description: error.message, variant: 'destructive' });
                        } finally {
                          setIsResettingPassword(false);
                        }
                      }}
                    >
                      {isResettingPassword ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Resetando...</> : 'Confirmar Reset de Senha'}
                    </Button>
                  </div>
                )}
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setEditDialogOpen(false)}>Cancelar</Button>
              <Button
                disabled={isEditing}
                onClick={async () => {
                  if (!userToEdit) return;
                  setIsEditing(true);
                  try {
                    // Update profile
                    const { error } = await supabase
                      .from('profiles')
                      .update({ name: editName.trim() || null, max_chips: editMaxChips } as any)
                      .eq('user_id', userToEdit.user_id);
                    if (error) throw error;

                    // Update email if changed
                    if (editEmail.trim() && editEmail.trim() !== userToEdit.email) {
                      const { data: sessionData } = await supabase.auth.getSession();
                      const token = sessionData?.session?.access_token;
                      if (!token) throw new Error('Sessão expirada');
                      const response = await fetch(
                        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/create-user`,
                        {
                          method: 'POST',
                          headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
                          body: JSON.stringify({ action: 'update-email', targetUserId: userToEdit.user_id, newEmail: editEmail.trim() }),
                        }
                      );
                      const result = await response.json();
                      if (!response.ok) throw new Error(result.error || 'Erro ao atualizar email');
                    }

                    // Update role if changed
                    if (editRole !== userToEdit.role && canManageUsers) {
                      const { data: sessionData } = await supabase.auth.getSession();
                      const token = sessionData?.session?.access_token;
                      if (!token) throw new Error('Sessão expirada');
                      const response = await fetch(
                        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/update-user-role`,
                        {
                          method: 'POST',
                          headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
                          body: JSON.stringify({ targetUserId: userToEdit.user_id, newRole: editRole }),
                        }
                      );
                      const result = await response.json();
                      if (!response.ok) throw new Error(result.error || 'Erro ao atualizar role');
                    }

                    toast({ title: 'Usuário atualizado' });
                    setEditDialogOpen(false);
                    fetchUsers();
                  } catch (error: any) {
                    toast({ title: 'Erro', description: error.message, variant: 'destructive' });
                  } finally {
                    setIsEditing(false);
                  }
                }}
              >
                {isEditing && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                Salvar
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </DashboardLayout>
  );
}
