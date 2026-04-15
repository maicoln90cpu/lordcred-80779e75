import { describe, it, expect } from 'vitest';

// ===== Extract pure permission logic for testing =====
// This mirrors the hasPermission logic from useFeaturePermissions.ts
// without React/Supabase dependencies.

interface PermissionEntry {
  feature_key: string;
  allowed_user_ids: string[];
  allowed_roles: string[];
}

function checkPermission(
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

// ===== Tests =====

const USER_ID = 'user-123';
const OTHER_ID = 'user-999';

describe('Permission logic (checkPermission)', () => {
  const noDisabled = new Set<string>();
  const noPerms: PermissionEntry[] = [];

  // === Role hierarchy ===
  it('master always has access', () => {
    expect(checkPermission('anything', USER_ID, 'seller', true, noPerms, noDisabled)).toBe(true);
  });

  it('master bypasses disabled features', () => {
    const disabled = new Set(['dashboard']);
    expect(checkPermission('dashboard', USER_ID, 'seller', true, noPerms, disabled)).toBe(true);
  });

  it('admin has access to everything', () => {
    expect(checkPermission('permissions', USER_ID, 'admin', false, noPerms, noDisabled)).toBe(true);
  });

  it('manager has access except "permissions"', () => {
    expect(checkPermission('dashboard', USER_ID, 'manager', false, noPerms, noDisabled)).toBe(true);
    expect(checkPermission('permissions', USER_ID, 'manager', false, noPerms, noDisabled)).toBe(false);
  });

  // === Disabled features ===
  it('disabled feature blocks non-master users', () => {
    const disabled = new Set(['leads']);
    expect(checkPermission('leads', USER_ID, 'admin', false, noPerms, disabled)).toBe(false);
  });

  // === No user ===
  it('no user returns false', () => {
    expect(checkPermission('dashboard', null, 'seller', false, noPerms, noDisabled)).toBe(false);
  });

  // === Permission entries ===
  it('feature with no permission entry is open to all', () => {
    expect(checkPermission('dashboard', USER_ID, 'seller', false, noPerms, noDisabled)).toBe(true);
  });

  it('feature with empty roles/users arrays is open to all', () => {
    const perms: PermissionEntry[] = [{ feature_key: 'dashboard', allowed_roles: [], allowed_user_ids: [] }];
    expect(checkPermission('dashboard', USER_ID, 'seller', false, perms, noDisabled)).toBe(true);
  });

  it('feature restricted by role — matching role', () => {
    const perms: PermissionEntry[] = [{ feature_key: 'leads', allowed_roles: ['support', 'seller'], allowed_user_ids: [] }];
    expect(checkPermission('leads', USER_ID, 'seller', false, perms, noDisabled)).toBe(true);
  });

  it('feature restricted by role — non-matching role', () => {
    const perms: PermissionEntry[] = [{ feature_key: 'leads', allowed_roles: ['support'], allowed_user_ids: [] }];
    expect(checkPermission('leads', USER_ID, 'seller', false, perms, noDisabled)).toBe(false);
  });

  it('feature restricted by user ID — matching user', () => {
    const perms: PermissionEntry[] = [{ feature_key: 'leads', allowed_roles: [], allowed_user_ids: [USER_ID] }];
    expect(checkPermission('leads', USER_ID, 'seller', false, perms, noDisabled)).toBe(true);
  });

  it('feature restricted by user ID — non-matching user', () => {
    const perms: PermissionEntry[] = [{ feature_key: 'leads', allowed_roles: [], allowed_user_ids: [OTHER_ID] }];
    expect(checkPermission('leads', USER_ID, 'seller', false, perms, noDisabled)).toBe(false);
  });

  it('feature with both role and user ID — user match is enough', () => {
    const perms: PermissionEntry[] = [{ feature_key: 'leads', allowed_roles: ['support'], allowed_user_ids: [USER_ID] }];
    expect(checkPermission('leads', USER_ID, 'seller', false, perms, noDisabled)).toBe(true);
  });

  it('feature with both role and user ID — role match is enough', () => {
    const perms: PermissionEntry[] = [{ feature_key: 'leads', allowed_roles: ['seller'], allowed_user_ids: [OTHER_ID] }];
    expect(checkPermission('leads', USER_ID, 'seller', false, perms, noDisabled)).toBe(true);
  });

  it('feature with both — neither matches', () => {
    const perms: PermissionEntry[] = [{ feature_key: 'leads', allowed_roles: ['support'], allowed_user_ids: [OTHER_ID] }];
    expect(checkPermission('leads', USER_ID, 'seller', false, perms, noDisabled)).toBe(false);
  });
});

// ===== Route mapping tests =====
// We replicate the maps here to avoid importing the hook (which pulls Supabase/React)
const FEATURE_ROUTE_MAP: Record<string, string[]> = {
  dashboard: ['/dashboard'], chips: ['/chips'], whatsapp: ['/whatsapp'],
  users: ['/admin/users'], master_admin: ['/admin/master'], leads: ['/admin/leads'],
  permissions: ['/admin/permissions'], partners: ['/admin/parceiros', '/admin/parceiros/template'],
};
const ROUTE_FEATURE_MAP: Record<string, string> = {};
Object.entries(FEATURE_ROUTE_MAP).forEach(([key, routes]) => {
  routes.forEach(route => { ROUTE_FEATURE_MAP[route] = key; });
});

describe('FEATURE_ROUTE_MAP / ROUTE_FEATURE_MAP consistency', () => {

  it('every route in FEATURE_ROUTE_MAP has a reverse entry', () => {
    Object.entries(FEATURE_ROUTE_MAP as Record<string, string[]>).forEach(([key, routes]) => {
      routes.forEach((route: string) => {
        expect(ROUTE_FEATURE_MAP[route]).toBe(key);
      });
    });
  });

  it('critical routes are mapped', () => {
    expect(ROUTE_FEATURE_MAP['/dashboard']).toBe('dashboard');
    expect(ROUTE_FEATURE_MAP['/whatsapp']).toBe('whatsapp');
    expect(ROUTE_FEATURE_MAP['/admin/users']).toBe('users');
    expect(ROUTE_FEATURE_MAP['/admin/master']).toBe('master_admin');
  });
});
