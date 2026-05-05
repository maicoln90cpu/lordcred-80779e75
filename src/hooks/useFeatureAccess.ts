import { useFeaturePermissions } from './useFeaturePermissions';
import { useAuth } from '@/contexts/AuthContext';

/**
 * Hook unificado para checar acesso a uma feature.
 *
 * Retorna:
 * - canSee: usuário pode visualizar dados/UI da feature (Master toggle ON + permissão por role/user)
 * - canEdit: usuário pode editar dados (privileged OU permissão explícita por role/user)
 * - loading: carregando permissões/toggles/auth
 *
 * Uso típico em uma página:
 *   const { canSee, canEdit, loading } = useFeatureAccess('v8_simulador');
 *   if (loading) return <Loader />;
 *   if (!canSee) return <EmptyStateNoAccess feature="Simulador V8" />;
 */
export function useFeatureAccess(featureKey: string) {
  const { hasPermission, isFeatureEnabled, loading } = useFeaturePermissions();
  const { isMaster, userRole } = useAuth();

  const isPrivileged = isMaster || userRole === 'admin' || userRole === 'manager';
  const featureEnabled = isFeatureEnabled(featureKey);
  const hasRolePermission = hasPermission(featureKey);

  // canSee: a feature precisa estar globalmente ativa E o usuário ter permissão
  const canSee = featureEnabled && hasRolePermission;

  // canEdit: privileged sempre edita; demais precisam de permissão explícita
  const canEdit = featureEnabled && (isPrivileged || hasRolePermission);

  return { canSee, canEdit, loading, isPrivileged, featureEnabled };
}
