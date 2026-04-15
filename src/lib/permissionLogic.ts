// ===== Pure permission logic — no React/Supabase dependencies =====

export interface PermissionEntry {
  feature_key: string;
  allowed_user_ids: string[];
  allowed_roles: string[];
}

/**
 * Determines if a user has access to a specific feature.
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
  if (!userId) return false;
  if (isMaster) return true;
  if (disabledFeatures.has(featureKey)) return false;
  if (userRole === 'admin') return true;
  if (userRole === 'manager') return featureKey !== 'permissions';

  const perm = permissions.find(p => p.feature_key === featureKey);
  if (!perm) return true;

  const hasRoleAccess = perm.allowed_roles.length > 0 && perm.allowed_roles.includes(userRole);
  const hasUserAccess = perm.allowed_user_ids.length > 0 && perm.allowed_user_ids.includes(userId);

  if (perm.allowed_roles.length === 0 && perm.allowed_user_ids.length === 0) return true;

  return hasRoleAccess || hasUserAccess;
}
