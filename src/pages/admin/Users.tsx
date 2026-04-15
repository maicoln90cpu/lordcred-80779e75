import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import DashboardLayout from '@/components/layout/DashboardLayout';
import { useAuth } from '@/contexts/AuthContext';
import { UserCreateDialog } from '@/components/admin/UserCreateDialog';
import { UserEditDialog } from '@/components/admin/UserEditDialog';
import { UsersTable } from '@/components/admin/UsersTable';
import { TeamsManager } from '@/components/admin/TeamsManager';

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
  const { user: currentUser, isAdmin, isSupport, userRole, isMaster } = useAuth();
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [userToEdit, setUserToEdit] = useState<UserProfile | null>(null);

  const isRegularAdmin = userRole === 'admin';
  const canManageUsers = isMaster || (!isSupport && isRegularAdmin);
  const canChooseRole = isMaster || isRegularAdmin;

  useEffect(() => { fetchUsers(); }, []);

  const fetchUsers = async () => {
    try {
      const { data: profilesData, error: profilesError } = await supabase
        .from('profiles').select('*').order('created_at', { ascending: false });
      if (profilesError) throw profilesError;

      const { data: rolesData } = await supabase.from('user_roles').select('user_id, role');
      const { data: chipsData } = await supabase.from('chips').select('user_id');

      const chipCounts = (chipsData || []).reduce((acc, chip) => {
        acc[chip.user_id] = (acc[chip.user_id] || 0) + 1;
        return acc;
      }, {} as Record<string, number>);

      const rolesMap = (rolesData || []).reduce((acc, r) => {
        acc[r.user_id] = r.role;
        return acc;
      }, {} as Record<string, string>);

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

      if (isMaster) {
        enrichedUsers = enrichedUsers.filter(u => u.role !== 'master');
      } else if (isSupport) {
        enrichedUsers = enrichedUsers.filter(u =>
          (u.role === 'seller' || u.role === 'support') && u.user_id !== currentUser?.id
        );
      } else {
        enrichedUsers = enrichedUsers.filter(u => u.role !== 'master' && u.user_id !== currentUser?.id);
      }

      setUsers(enrichedUsers);
    } catch (error) {
      console.error('Error fetching users:', error);
    } finally {
      setIsLoading(false);
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
          <UserCreateDialog
            canChooseRole={canChooseRole}
            isMaster={isMaster}
            isRegularAdmin={isRegularAdmin}
            onUserCreated={fetchUsers}
          />
        </div>

        <UsersTable
          users={users}
          isLoading={isLoading}
          isSupport={isSupport}
          isMaster={isMaster}
          isRegularAdmin={isRegularAdmin}
          canManageUsers={canManageUsers}
          onEditUser={(user) => { setUserToEdit(user); setEditDialogOpen(true); }}
          onRefresh={fetchUsers}
        />

        {canManageUsers && (
          <TeamsManager users={users.map(u => ({ user_id: u.user_id, name: u.name, email: u.email }))} />
        )}

        <UserEditDialog
          open={editDialogOpen}
          onOpenChange={setEditDialogOpen}
          user={userToEdit}
          canManageUsers={canManageUsers}
          onUserUpdated={fetchUsers}
        />
      </div>
    </DashboardLayout>
  );
}
