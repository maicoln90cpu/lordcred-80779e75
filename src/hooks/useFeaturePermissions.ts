import { useEffect, useMemo, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { checkPermission, type PermissionEntry } from '@/lib/permissionLogic';
import { useQuery, useQueryClient } from '@tanstack/react-query';

/** Maps feature_key → route path(s) */
const FEATURE_ROUTE_MAP: Record<string, string[]> = {
  dashboard: ['/dashboard'],
  chips: ['/chips'],
  settings_warming: ['/settingsaquecimento'],
  warming_reports: ['/admin/warming-reports'],
  users: ['/admin/users'],
  leads: ['/admin/leads'],
  performance: ['/admin/performance'],
  kanban: ['/admin/kanban'],
  product_info: ['/admin/product-info'],
  commissions: ['/admin/commissions'],
  commission_reports: ['/admin/commission-reports'],
  chip_monitor: ['/admin/chip-monitor'],
  queue: ['/admin/queue'],
  webhooks: ['/admin/webhooks'],
  templates: ['/admin/templates'],
  quick_replies: ['/admin/quick-replies'],
  tickets: ['/admin/tickets'],
  internal_chat: ['/chat'],
  links: ['/admin/links'],
  remote_assistance: ['/admin/remote'],
  audit_logs: ['/admin/audit-logs'],
  permissions: ['/admin/permissions'],
  corban_dashboard: ['/admin/corban'],
  corban_propostas: ['/admin/corban/propostas'],
  corban_fgts: ['/admin/corban/fgts'],
  corban_assets: ['/admin/corban/assets'],
  corban_config: ['/admin/corban/config'],
  seller_propostas: ['/corban/propostas'],
  seller_fgts: ['/corban/fgts'],
  whatsapp: ['/whatsapp'],
  master_admin: ['/admin/master'],
  bank_credentials: ['/admin/bancos'],
  partners: ['/admin/parceiros', '/admin/parceiros/template'],
  contract_template: ['/admin/parceiros/template'],
  broadcasts: ['/admin/broadcasts'],
};

/** Builds reverse map: route → feature_key */
const ROUTE_FEATURE_MAP: Record<string, string> = {};
Object.entries(FEATURE_ROUTE_MAP).forEach(([key, routes]) => {
  routes.forEach(route => { ROUTE_FEATURE_MAP[route] = key; });
});

export { FEATURE_ROUTE_MAP, ROUTE_FEATURE_MAP };

interface FeaturePermission {
  feature_key: string;
  allowed_user_ids: string[];
  allowed_roles: string[];
}

interface FeatureToggle {
  feature_key: string;
  is_enabled: boolean;
}

async function fetchPermissions(): Promise<FeaturePermission[]> {
  const { data } = await supabase
    .from('feature_permissions')
    .select('feature_key, allowed_user_ids, allowed_roles');
  return (data || []).map(d => ({
    feature_key: d.feature_key,
    allowed_user_ids: (d as any).allowed_user_ids || [],
    allowed_roles: (d as any).allowed_roles || [],
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
    if (!user) return false;
    if (isMaster) return true;

    // Global toggle check — if disabled, nobody except master sees it
    if (disabledFeatures.has(featureKey)) return false;

    if (userRole === 'admin') return true;
    if (userRole === 'manager') return featureKey !== 'permissions';

    const perm = permissions.find(p => p.feature_key === featureKey);
    if (!perm) return true;

    const hasRoleAccess = perm.allowed_roles.length > 0 && perm.allowed_roles.includes(userRole);
    const hasUserAccess = perm.allowed_user_ids.length > 0 && perm.allowed_user_ids.includes(user.id);

    if (perm.allowed_roles.length === 0 && perm.allowed_user_ids.length === 0) return true;

    return hasRoleAccess || hasUserAccess;
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
