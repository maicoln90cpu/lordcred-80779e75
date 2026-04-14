import { useEffect, useState } from 'react';
import { Users, Shield, Loader2 } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import { supabase } from '@/integrations/supabase/client';

interface UserProfile {
  user_id: string;
  email: string;
  name: string | null;
  role: string;
}

interface MetaUserAccessCardProps {
  allowedUserIds: string[];
  onChange: (userIds: string[]) => void;
}

export default function MetaUserAccessCard({ allowedUserIds, onChange }: MetaUserAccessCardProps) {
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    fetchUsers();
  }, []);

  const fetchUsers = async () => {
    try {
      const { data: profiles, error: profilesError } = await supabase
        .from('profiles')
        .select('user_id, email, name')
        .eq('is_blocked', false)
        .order('name');

      if (profilesError) throw profilesError;

      const { data: roles, error: rolesError } = await supabase
        .from('user_roles')
        .select('user_id, role');

      if (rolesError) throw rolesError;

      const roleMap = new Map<string, string>();
      roles?.forEach((r: any) => roleMap.set(r.user_id, r.role));

      const merged: UserProfile[] = (profiles || []).map((p: any) => ({
        user_id: p.user_id,
        email: p.email,
        name: p.name,
        role: roleMap.get(p.user_id) || 'seller',
      }));

      // Filter: only show non-privileged users (master/admin always have access)
      setUsers(merged.filter(u => !['master', 'admin'].includes(u.role)));
    } catch (error) {
      console.error('Error fetching users:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const toggleUser = (userId: string) => {
    const updated = allowedUserIds.includes(userId)
      ? allowedUserIds.filter(id => id !== userId)
      : [...allowedUserIds, userId];
    onChange(updated);
  };

  const roleLabel = (role: string) => {
    const labels: Record<string, string> = {
      manager: 'Gerente',
      support: 'Suporte',
      seller: 'Vendedor',
    };
    return labels[role] || role;
  };

  const roleBadgeVariant = (role: string) => {
    if (role === 'manager') return 'default' as const;
    if (role === 'support') return 'secondary' as const;
    return 'outline' as const;
  };

  if (isLoading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-8">
          <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Users className="w-5 h-5" />
          Acesso ao Meta WhatsApp
        </CardTitle>
        <CardDescription>
          Selecione quais usuários podem criar e gerenciar chips via Meta Cloud API.
          <br />
          <span className="flex items-center gap-1 mt-1">
            <Shield className="w-3 h-3" />
            Master e Admin sempre têm acesso automaticamente.
          </span>
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-3 max-h-64 overflow-y-auto pr-2">
          {users.length === 0 ? (
            <p className="text-sm text-muted-foreground">Nenhum usuário encontrado.</p>
          ) : (
            users.map((user) => (
              <label
                key={user.user_id}
                className="flex items-center gap-3 p-2 rounded-lg hover:bg-muted/50 cursor-pointer transition-colors"
              >
                <Checkbox
                  checked={allowedUserIds.includes(user.user_id)}
                  onCheckedChange={() => toggleUser(user.user_id)}
                />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">
                    {user.name || user.email}
                  </p>
                  {user.name && (
                    <p className="text-xs text-muted-foreground truncate">{user.email}</p>
                  )}
                </div>
                <Badge variant={roleBadgeVariant(user.role)} className="text-xs shrink-0">
                  {roleLabel(user.role)}
                </Badge>
              </label>
            ))
          )}
        </div>
        {allowedUserIds.length > 0 && (
          <p className="text-xs text-muted-foreground mt-3 pt-3 border-t">
            {allowedUserIds.length} usuário(s) selecionado(s) + Master/Admin (automático)
          </p>
        )}
      </CardContent>
    </Card>
  );
}
