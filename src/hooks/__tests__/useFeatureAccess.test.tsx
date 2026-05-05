import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook } from '@testing-library/react';

// Mocks must be declared before importing the hook under test
const featureMock = vi.fn();
const authMock = vi.fn();

vi.mock('@/hooks/useFeaturePermissions', () => ({
  useFeaturePermissions: () => featureMock(),
}));
vi.mock('@/contexts/AuthContext', () => ({
  useAuth: () => authMock(),
}));

import { useFeatureAccess } from '@/hooks/useFeatureAccess';

function setup({
  isMaster = false,
  userRole = 'seller',
  hasPerm = true,
  enabled = true,
  loading = false,
}: Partial<{
  isMaster: boolean; userRole: string; hasPerm: boolean; enabled: boolean; loading: boolean;
}>) {
  authMock.mockReturnValue({ isMaster, userRole });
  featureMock.mockReturnValue({
    hasPermission: () => hasPerm,
    isFeatureEnabled: () => enabled,
    loading,
  });
}

describe('useFeatureAccess', () => {
  beforeEach(() => vi.clearAllMocks());

  it('seller with permission and toggle ON: canSee + canEdit', () => {
    setup({ userRole: 'seller', hasPerm: true, enabled: true });
    const { result } = renderHook(() => useFeatureAccess('queue'));
    expect(result.current.canSee).toBe(true);
    expect(result.current.canEdit).toBe(true);
    expect(result.current.isPrivileged).toBe(false);
  });

  it('seller without permission: blocked even if toggle ON', () => {
    setup({ userRole: 'seller', hasPerm: false, enabled: true });
    const { result } = renderHook(() => useFeatureAccess('audit_logs'));
    expect(result.current.canSee).toBe(false);
    expect(result.current.canEdit).toBe(false);
  });

  it('master: canEdit even without role permission, but canSee requires toggle', () => {
    setup({ isMaster: true, userRole: 'seller', hasPerm: false, enabled: true });
    const { result } = renderHook(() => useFeatureAccess('v8_simulador'));
    expect(result.current.isPrivileged).toBe(true);
    expect(result.current.canEdit).toBe(true);
    expect(result.current.canSee).toBe(false); // hasRolePermission false → canSee false
  });

  it('admin is privileged (canEdit true)', () => {
    setup({ userRole: 'admin', hasPerm: false, enabled: true });
    const { result } = renderHook(() => useFeatureAccess('broadcasts'));
    expect(result.current.isPrivileged).toBe(true);
    expect(result.current.canEdit).toBe(true);
  });

  it('manager is privileged', () => {
    setup({ userRole: 'manager', hasPerm: true, enabled: true });
    const { result } = renderHook(() => useFeatureAccess('tickets'));
    expect(result.current.isPrivileged).toBe(true);
  });

  it('master toggle OFF: nobody can see/edit, even admin', () => {
    setup({ userRole: 'admin', hasPerm: true, enabled: false });
    const { result } = renderHook(() => useFeatureAccess('audit_logs'));
    expect(result.current.canSee).toBe(false);
    expect(result.current.canEdit).toBe(false);
    expect(result.current.featureEnabled).toBe(false);
  });

  it('forwards loading state', () => {
    setup({ loading: true });
    const { result } = renderHook(() => useFeatureAccess('any'));
    expect(result.current.loading).toBe(true);
  });
});
