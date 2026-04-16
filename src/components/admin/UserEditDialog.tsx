import { useEffect, useState } from 'react';
import { Loader2, KeyRound } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { UserTeamsField } from '@/components/admin/UserTeamsField';
import { fetchTeamOptions, fetchUserTeamIds, syncUserTeams, type TeamOption } from '@/lib/userTeams';

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

interface UserEditDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  user: UserProfile | null;
  canManageUsers: boolean;
  onUserUpdated: () => void;
}

export function UserEditDialog({ open, onOpenChange, user, canManageUsers, onUserUpdated }: UserEditDialogProps) {
  const { toast } = useToast();
  const [isLoadingTeams, setIsLoadingTeams] = useState(false);
  const [editName, setEditName] = useState(user?.name || '');
  const [editEmail, setEditEmail] = useState(user?.email || '');
  const [editMaxChips, setEditMaxChips] = useState(user?.max_chips ?? 5);
  const [editRole, setEditRole] = useState(user?.role || 'seller');
  const [isEditing, setIsEditing] = useState(false);
  const [resetPasswordValue, setResetPasswordValue] = useState('');
  const [isResettingPassword, setIsResettingPassword] = useState(false);
  const [showResetPassword, setShowResetPassword] = useState(false);
  const [allTeams, setAllTeams] = useState<TeamOption[]>([]);
  const [selectedTeamIds, setSelectedTeamIds] = useState<string[]>([]);
  const [originalTeamIds, setOriginalTeamIds] = useState<string[]>([]);

  useEffect(() => {
    if (!open) return;

    setResetPasswordValue('');
    setShowResetPassword(false);

    if (!user) {
      setEditName('');
      setEditEmail('');
      setEditMaxChips(5);
      setEditRole('seller');
      setAllTeams([]);
      setSelectedTeamIds([]);
      setOriginalTeamIds([]);
      return;
    }

    setEditName(user.name || '');
    setEditEmail(user.email);
    setEditMaxChips(user.max_chips ?? 5);
    setEditRole(user.role || 'seller');

    if (!canManageUsers || user.role === 'master') {
      setAllTeams([]);
      setSelectedTeamIds([]);
      setOriginalTeamIds([]);
      return;
    }

    let isActive = true;
    setIsLoadingTeams(true);

    Promise.all([fetchTeamOptions(), fetchUserTeamIds(user.user_id)])
      .then(([teams, teamIds]) => {
        if (!isActive) return;
        setAllTeams(teams);
        setSelectedTeamIds(teamIds);
        setOriginalTeamIds(teamIds);
      })
      .catch((error: any) => {
        if (!isActive) return;
        setAllTeams([]);
        setSelectedTeamIds([]);
        setOriginalTeamIds([]);
        toast({
          title: 'Erro ao carregar equipes',
          description: error.message || 'Não foi possível carregar as equipes deste usuário.',
          variant: 'destructive',
        });
      })
      .finally(() => {
        if (isActive) setIsLoadingTeams(false);
      });

    return () => {
      isActive = false;
    };
  }, [open, user, canManageUsers, toast]);

  const handleOpenChange = (value: boolean) => {
    onOpenChange(value);
  };

  const handleResetPassword = async () => {
    if (!user) return;
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
          body: JSON.stringify({ action: 'reset-password', targetUserId: user.user_id, newPassword: resetPasswordValue }),
        }
      );
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || 'Erro ao resetar senha');

      toast({ title: 'Senha resetada', description: `Senha de ${user.email} foi alterada` });
      setShowResetPassword(false);
      setResetPasswordValue('');
    } catch (error: any) {
      toast({ title: 'Erro', description: error.message, variant: 'destructive' });
    } finally {
      setIsResettingPassword(false);
    }
  };

  const handleSave = async () => {
    if (!user) return;
    setIsEditing(true);
    try {
      const { error } = await supabase
        .from('profiles')
        .update({ name: editName.trim() || null, max_chips: editMaxChips } as any)
        .eq('user_id', user.user_id);
      if (error) throw error;

      if (editEmail.trim() && editEmail.trim() !== user.email) {
        const { data: sessionData } = await supabase.auth.getSession();
        const token = sessionData?.session?.access_token;
        if (!token) throw new Error('Sessão expirada');
        const response = await fetch(
          `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/create-user`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
            body: JSON.stringify({ action: 'update-email', targetUserId: user.user_id, newEmail: editEmail.trim() }),
          }
        );
        const result = await response.json();
        if (!response.ok) throw new Error(result.error || 'Erro ao atualizar email');
      }

      if (editRole !== user.role && canManageUsers) {
        const { data: sessionData } = await supabase.auth.getSession();
        const token = sessionData?.session?.access_token;
        if (!token) throw new Error('Sessão expirada');
        const response = await fetch(
          `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/update-user-role`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
            body: JSON.stringify({ targetUserId: user.user_id, newRole: editRole }),
          }
        );
        const result = await response.json();
        if (!response.ok) throw new Error(result.error || 'Erro ao atualizar role');
      }

      if (canManageUsers && user.role !== 'master') {
        await syncUserTeams(user.user_id, originalTeamIds, selectedTeamIds);
      }

      toast({ title: 'Usuário atualizado' });
      onOpenChange(false);
      onUserUpdated();
    } catch (error: any) {
      toast({ title: 'Erro', description: error.message, variant: 'destructive' });
    } finally {
      setIsEditing(false);
    }
  };

  const showTeamsField = canManageUsers && user?.role !== 'master';

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Editar Usuário</DialogTitle>
          <DialogDescription>Alterar dados de {user?.email}</DialogDescription>
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

          {canManageUsers && user && user.role !== 'master' && (
            <div className="space-y-2">
              <Label>Tipo de Usuário</Label>
              <Select value={editRole} onValueChange={setEditRole}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="seller">Vendedor</SelectItem>
                  <SelectItem value="support">Suporte</SelectItem>
                  <SelectItem value="manager">Gerente</SelectItem>
                  <SelectItem value="admin">Administrador</SelectItem>
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">Alterar o tipo de acesso deste usuário</p>
            </div>
          )}

          {showTeamsField && (
            <UserTeamsField
              teams={allTeams}
              selectedTeamIds={selectedTeamIds}
              onSelectedTeamIdsChange={setSelectedTeamIds}
              isLoading={isLoadingTeams}
              disabled={isEditing}
            />
          )}

          <div className="space-y-2 border-t pt-4">
            <Button variant="outline" size="sm" className="w-full" onClick={() => setShowResetPassword(!showResetPassword)}>
              <KeyRound className="w-4 h-4 mr-2" />
              {showResetPassword ? 'Cancelar Reset de Senha' : 'Resetar Senha'}
            </Button>
            {showResetPassword && (
              <div className="space-y-2">
                <Label htmlFor="reset-password">Nova Senha</Label>
                <Input id="reset-password" type="password" placeholder="Mínimo 6 caracteres" value={resetPasswordValue} onChange={(e) => setResetPasswordValue(e.target.value)} />
                <Button variant="destructive" size="sm" className="w-full" disabled={isResettingPassword || resetPasswordValue.length < 6} onClick={handleResetPassword}>
                  {isResettingPassword ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Resetando...</> : 'Confirmar Reset de Senha'}
                </Button>
              </div>
            )}
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button disabled={isEditing || !user} onClick={handleSave}>
            {isEditing && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
            Salvar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
