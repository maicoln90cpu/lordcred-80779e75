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
 * - userId: id do usuário logado (para filtros tipo `created_by = userId`)
 * - loading: carregando permissões/toggles/auth
 */
export function useFeatureAccess(featureKey: string) {
  const { hasPermission, isFeatureEnabled, getScope, loading } = useFeaturePermissions();
  const { isMaster, userRole, user } = useAuth();

  const isPrivileged = isMaster || userRole === 'admin' || userRole === 'manager';
  const featureEnabled = isFeatureEnabled(featureKey);
  const hasRolePermission = hasPermission(featureKey);
  const scope: FeatureScope = getScope(featureKey);

  const canSee = featureEnabled && hasRolePermission;
  const canEdit = featureEnabled && (isPrivileged || hasRolePermission);
  const isMenuOnly = scope === 'menu_only';

  return {
    canSee,
    canEdit,
    loading,
    isPrivileged,
    featureEnabled,
    scope,
    isMenuOnly,
    userId: user?.id || null,
  };
}
