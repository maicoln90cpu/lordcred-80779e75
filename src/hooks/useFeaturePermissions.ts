import { useEffect, useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

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

export function useFeaturePermissions() {
  const { user, isMaster, userRole, isLoading: authLoading } = useAuth();
  const [permissions, setPermissions] = useState<FeaturePermission[]>([]);
  const [loading, setLoading] = useState(true);

  const loadPermissions = useCallback(async () => {
    if (!user) {
      setPermissions([]);
      setLoading(false);
      return;
    }
    const { data } = await supabase
      .from('feature_permissions')
      .select('feature_key, allowed_user_ids, allowed_roles');
    setPermissions((data || []).map(d => ({
      feature_key: d.feature_key,
      allowed_user_ids: (d as any).allowed_user_ids || [],
      allowed_roles: (d as any).allowed_roles || [],
    })));
    setLoading(false);
  }, [user?.id]);

  useEffect(() => {
    if (!authLoading) {
      loadPermissions();
    }
  }, [loadPermissions, authLoading]);

  // Realtime subscription — updates menu without page refresh
  useEffect(() => {
    if (!user || authLoading) return;

    const channel = supabase
      .channel('feature-permissions-changes')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'feature_permissions' },
        () => {
          loadPermissions();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user?.id, loadPermissions, authLoading]);

  const hasPermission = (featureKey: string): boolean => {
    if (!user) return false;
    if (isMaster) return true;
    if (userRole === 'admin') return true;
    if (userRole === 'manager') return featureKey !== 'permissions';

    const perm = permissions.find(p => p.feature_key === featureKey);
    if (!perm) return true;

    const hasRoleAccess = perm.allowed_roles.length > 0 && perm.allowed_roles.includes(userRole);
    const hasUserAccess = perm.allowed_user_ids.length > 0 && perm.allowed_user_ids.includes(user.id);

    if (perm.allowed_roles.length === 0 && perm.allowed_user_ids.length === 0) return true;

    return hasRoleAccess || hasUserAccess;
  };

  const hasRoutePermission = (path: string): boolean => {
    const featureKey = ROUTE_FEATURE_MAP[path];
    if (!featureKey) return true;
    return hasPermission(featureKey);
  };

  return { permissions, loading: loading || authLoading, hasPermission, hasRoutePermission };
}
