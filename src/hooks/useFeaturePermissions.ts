import { useEffect, useMemo, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { checkPermission, checkScope, type PermissionEntry, type FeatureScope } from '@/lib/permissionLogic';
import { FEATURE_ROUTE_MAP, ROUTE_FEATURE_MAP } from '@/lib/featureRouteMap';
import { useQuery, useQueryClient } from '@tanstack/react-query';

export { FEATURE_ROUTE_MAP, ROUTE_FEATURE_MAP };

// PermissionEntry is imported from @/lib/permissionLogic

interface FeatureToggle {
  feature_key: string;
  is_enabled: boolean;
}

async function fetchPermissions(): Promise<PermissionEntry[]> {
  const { data } = await supabase
    .from('feature_permissions')
    .select('feature_key, allowed_user_ids, allowed_roles, role_scopes');
  return (data || []).map(d => ({
    feature_key: d.feature_key,
    allowed_user_ids: (d as any).allowed_user_ids || [],
    allowed_roles: (d as any).allowed_roles || [],
    role_scopes: ((d as any).role_scopes || {}) as Record<string, FeatureScope>,
  }));
}

async function fetchToggles(): Promise<FeatureToggle[]> {
  const { data } = await supabase
    .from('master_feature_toggles')
    .select('feature_key, is_enabled');
  return (data || []).map(d => ({
    feature_key: d.feature_key,
    is_enabled: d.is_enabled,
  }));
}

export function useFeaturePermissions() {
  const { user, isMaster, userRole, isLoading: authLoading } = useAuth();
  const queryClient = useQueryClient();

  const { data: permissions = [], isLoading } = useQuery({
    queryKey: ['feature-permissions'],
    queryFn: fetchPermissions,
    enabled: !!user && !authLoading,
    staleTime: 5 * 60 * 1000,
    gcTime: 10 * 60 * 1000,
  });

  const { data: toggles = [], isLoading: togglesLoading } = useQuery({
    queryKey: ['master-feature-toggles'],
    queryFn: fetchToggles,
    enabled: !!user && !authLoading,
    staleTime: 5 * 60 * 1000,
    gcTime: 10 * 60 * 1000,
  });

  // Realtime subscription for permissions
  useEffect(() => {
    if (!user || authLoading) return;

    const channel = supabase
      .channel('feature-permissions-changes')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'feature_permissions' },
        () => {
          queryClient.invalidateQueries({ queryKey: ['feature-permissions'] });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user?.id, authLoading, queryClient]);

  // Realtime subscription for toggles
  useEffect(() => {
    if (!user || authLoading) return;

    const channel = supabase
      .channel('master-toggles-changes')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'master_feature_toggles' },
        () => {
          queryClient.invalidateQueries({ queryKey: ['master-feature-toggles'] });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user?.id, authLoading, queryClient]);

  // Build a set of disabled feature keys for fast lookup
  const disabledFeatures = useMemo(() => {
    const set = new Set<string>();
    toggles.forEach(t => {
      if (!t.is_enabled) set.add(t.feature_key);
    });
    return set;
  }, [toggles]);

  const hasPermission = useCallback((featureKey: string): boolean => {
    return checkPermission(
      featureKey,
      user?.id || null,
      userRole,
      isMaster,
      permissions,
      disabledFeatures,
    );
  }, [user, isMaster, userRole, permissions, disabledFeatures]);

  const hasRoutePermission = useCallback((path: string): boolean => {
    const featureKey = ROUTE_FEATURE_MAP[path];
    if (!featureKey) return true;
    return hasPermission(featureKey);
  }, [hasPermission]);

  const isFeatureEnabled = useCallback((featureKey: string): boolean => {
    if (isMaster) return true;
    return !disabledFeatures.has(featureKey);
  }, [isMaster, disabledFeatures]);

  const loading = isLoading || authLoading || togglesLoading;

  return { permissions, toggles, loading, hasPermission, hasRoutePermission, isFeatureEnabled };
}
