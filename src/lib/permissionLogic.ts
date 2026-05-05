// ===== Pure permission logic — no React/Supabase dependencies =====

export type FeatureScope = 'none' | 'menu_only' | 'full';

export interface PermissionEntry {
  feature_key: string;
  allowed_user_ids: string[];
  allowed_roles: string[];
  /** Scope per role (none/menu_only/full). Set by Etapa A migration. */
  role_scopes?: Record<string, FeatureScope>;
}

/**
 * Determines if a user has access to a specific feature (boolean).
 * Pure function — used by useFeaturePermissions hook and tests.
 *
 * Hierarchy: master > admin > manager > (check permissions) > deny
 */
export function checkPermission(
  featureKey: string,
  userId: string | null,
  userRole: string,
  isMaster: boolean,
  permissions: PermissionEntry[],
  disabledFeatures: Set<string>,
): boolean {
  return checkScope(featureKey, userId, userRole, isMaster, permissions, disabledFeatures) !== 'none';
}

/**
 * Returns the access scope ('none' | 'menu_only' | 'full') for a feature.
 * Mirrors backend SQL function `get_feature_scope()`.
 */
export function checkScope(
  featureKey: string,
  userId: string | null,
  userRole: string,
  isMaster: boolean,
  permissions: PermissionEntry[],
  disabledFeatures: Set<string>,
): FeatureScope {
  if (!userId) return 'none';
  if (isMaster) return 'full';
  if (disabledFeatures.has(featureKey)) return 'none';
  if (userRole === 'admin') return 'full';
  if (userRole === 'manager') return featureKey === 'permissions' ? 'none' : 'full';

  const perm = permissions.find(p => p.feature_key === featureKey);
  if (!perm) return 'full'; // default-open compat

  // user_id explícito sempre full
  if (perm.allowed_user_ids?.includes(userId)) return 'full';

  // role_scopes (preferido)
  const scope = perm.role_scopes?.[userRole];
  if (scope === 'full' || scope === 'menu_only' || scope === 'none') return scope;

  // Fallback legado: allowed_roles
  if (perm.allowed_roles?.includes(userRole)) return 'full';

  // Sem nenhuma regra → default-open
  const noRoles = !perm.allowed_roles?.length;
  const noUsers = !perm.allowed_user_ids?.length;
  const noScopes = !perm.role_scopes || Object.keys(perm.role_scopes).length === 0;
  if (noRoles && noUsers && noScopes) return 'full';

  return 'none';
}
