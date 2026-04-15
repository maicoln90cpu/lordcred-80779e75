import { describe, it, expect } from 'vitest';
import { checkPermission } from '@/lib/permissionLogic';
import { createPermission, createDisabledSet } from '@/test/testHelpers';

const USER_ID = 'user-123';
const OTHER_ID = 'user-999';
const noDisabled = new Set<string>();

describe('checkPermission (from permissionLogic.ts)', () => {
  // === Role hierarchy ===
  it('master always has access', () => {
    expect(checkPermission('anything', USER_ID, 'seller', true, [], noDisabled)).toBe(true);
  });

  it('master bypasses disabled features', () => {
    expect(checkPermission('dashboard', USER_ID, 'seller', true, [], createDisabledSet('dashboard'))).toBe(true);
  });

  it('admin has access to everything', () => {
    expect(checkPermission('permissions', USER_ID, 'admin', false, [], noDisabled)).toBe(true);
  });

  it('manager has access except "permissions"', () => {
    expect(checkPermission('dashboard', USER_ID, 'manager', false, [], noDisabled)).toBe(true);
    expect(checkPermission('permissions', USER_ID, 'manager', false, [], noDisabled)).toBe(false);
  });

  // === Disabled features ===
  it('disabled feature blocks non-master users', () => {
    expect(checkPermission('leads', USER_ID, 'admin', false, [], createDisabledSet('leads'))).toBe(false);
  });

  // === No user ===
  it('no user returns false', () => {
    expect(checkPermission('dashboard', null, 'seller', false, [], noDisabled)).toBe(false);
  });

  // === Permission entries ===
  it('feature with no permission entry is open to all', () => {
    expect(checkPermission('dashboard', USER_ID, 'seller', false, [], noDisabled)).toBe(true);
  });

  it('feature with empty roles/users is open to all', () => {
    const perms = [createPermission('dashboard')];
    expect(checkPermission('dashboard', USER_ID, 'seller', false, perms, noDisabled)).toBe(true);
  });

  it('feature restricted by role — matching', () => {
    const perms = [createPermission('leads', { allowed_roles: ['support', 'seller'] })];
    expect(checkPermission('leads', USER_ID, 'seller', false, perms, noDisabled)).toBe(true);
  });

  it('feature restricted by role — non-matching', () => {
    const perms = [createPermission('leads', { allowed_roles: ['support'] })];
    expect(checkPermission('leads', USER_ID, 'seller', false, perms, noDisabled)).toBe(false);
  });

  it('feature restricted by user ID — matching', () => {
    const perms = [createPermission('leads', { allowed_user_ids: [USER_ID] })];
    expect(checkPermission('leads', USER_ID, 'seller', false, perms, noDisabled)).toBe(true);
  });

  it('feature restricted by user ID — non-matching', () => {
    const perms = [createPermission('leads', { allowed_user_ids: [OTHER_ID] })];
    expect(checkPermission('leads', USER_ID, 'seller', false, perms, noDisabled)).toBe(false);
  });

  it('both role and user — user match enough', () => {
    const perms = [createPermission('leads', { allowed_roles: ['support'], allowed_user_ids: [USER_ID] })];
    expect(checkPermission('leads', USER_ID, 'seller', false, perms, noDisabled)).toBe(true);
  });

  it('both role and user — role match enough', () => {
    const perms = [createPermission('leads', { allowed_roles: ['seller'], allowed_user_ids: [OTHER_ID] })];
    expect(checkPermission('leads', USER_ID, 'seller', false, perms, noDisabled)).toBe(true);
  });

  it('both role and user — neither matches', () => {
    const perms = [createPermission('leads', { allowed_roles: ['support'], allowed_user_ids: [OTHER_ID] })];
    expect(checkPermission('leads', USER_ID, 'seller', false, perms, noDisabled)).toBe(false);
  });
});
