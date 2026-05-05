import { describe, it, expect } from 'vitest';
import { checkPermission } from '@/lib/permissionLogic';
import { createPermission, createDisabledSet } from '@/test/testHelpers';

const UID = 'user-1';

describe('checkPermission', () => {
  it('denies when no userId', () => {
    expect(checkPermission('any', null, 'admin', false, [], new Set())).toBe(false);
  });

  it('master always passes (even if disabled)', () => {
    expect(checkPermission('audit_logs', UID, 'seller', true, [], createDisabledSet('audit_logs'))).toBe(true);
  });

  it('disabled feature blocks non-master', () => {
    expect(checkPermission('audit_logs', UID, 'admin', false, [], createDisabledSet('audit_logs'))).toBe(false);
  });

  it('admin passes when feature is enabled', () => {
    expect(checkPermission('v8_simulador', UID, 'admin', false, [], new Set())).toBe(true);
  });

  it('manager passes for any feature except permissions', () => {
    expect(checkPermission('v8_simulador', UID, 'manager', false, [], new Set())).toBe(true);
    expect(checkPermission('permissions', UID, 'manager', false, [], new Set())).toBe(false);
  });

  it('seller is allowed when no permission entry exists (default open)', () => {
    expect(checkPermission('foo', UID, 'seller', false, [], new Set())).toBe(true);
  });

  it('seller blocked when entry exists but role/user not listed', () => {
    const perms = [createPermission('bank_credentials', { allowed_roles: ['support'] })];
    expect(checkPermission('bank_credentials', UID, 'seller', false, perms, new Set())).toBe(false);
  });

  it('seller allowed when role explicitly listed', () => {
    const perms = [createPermission('queue', { allowed_roles: ['seller'] })];
    expect(checkPermission('queue', UID, 'seller', false, perms, new Set())).toBe(true);
  });

  it('seller allowed when user_id explicitly listed', () => {
    const perms = [createPermission('queue', { allowed_user_ids: [UID] })];
    expect(checkPermission('queue', UID, 'seller', false, perms, new Set())).toBe(true);
  });

  it('empty roles AND empty users = open to all', () => {
    const perms = [createPermission('broadcasts')];
    expect(checkPermission('broadcasts', UID, 'support', false, perms, new Set())).toBe(true);
  });
});
