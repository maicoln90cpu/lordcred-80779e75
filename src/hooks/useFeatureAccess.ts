import { useFeaturePermissions } from './useFeaturePermissions';
import { useAuth } from '@/contexts/AuthContext';
import type { FeatureScope } from '@/lib/permissionLogic';

/**
 * Hook unificado para checar acesso a uma feature.
 *
 * Retorna:
 * - canSee: usuário pode visualizar UI da feature (scope != 'none')
 * - canEdit: usuário pode editar dados (privileged ou scope='full')
 * - scope: 'none' | 'menu_only' | 'full' — granularidade fina
 * - isMenuOnly: atalho para `scope === 'menu_only'` (filtra dados pelos próprios)
 * - loading: carregando permissões/toggles/auth
 *
 * Uso típico em uma página de lista:
 *   const { canSee, scope, loading } = useFeatureAccess('bank_credentials');
 *   if (loading) return <Loader />;
 *   if (!canSee) return <EmptyStateNoAccess feature="Bancos" />;
 *   const query = supabase.from('bank_credentials').select('*');
 *   if (scope === 'menu_only') query.eq('created_by', user.id);
 */
export function useFeatureAccess(featureKey: string) {
  const { hasPermission, isFeatureEnabled, getScope, loading } = useFeaturePermissions();
  const { isMaster, userRole } = useAuth();

  const isPrivileged = isMaster || userRole === 'admin' || userRole === 'manager';
  const featureEnabled = isFeatureEnabled(featureKey);
  const hasRolePermission = hasPermission(featureKey);
  const scope: FeatureScope = getScope(featureKey);

  const canSee = featureEnabled && hasRolePermission;
  const canEdit = featureEnabled && (isPrivileged || hasRolePermission);
  const isMenuOnly = scope === 'menu_only';

  return { canSee, canEdit, loading, isPrivileged, featureEnabled, scope, isMenuOnly };
}
