import { ReactNode } from 'react';
import { Loader2 } from 'lucide-react';
import { useFeatureAccess } from '@/hooks/useFeatureAccess';
import { EmptyStateNoAccess } from './EmptyStateNoAccess';

interface FeatureGateProps {
  /** chave da feature em feature_permissions / master_feature_toggles */
  featureKey: string;
  /** Nome amigável da feature exibido no EmptyState */
  featureLabel: string;
  children: ReactNode;
  /** Wrapper opcional (ex: DashboardLayout) — recebe o conteúdo (loader, EmptyState ou children) */
  wrapper?: (node: ReactNode) => ReactNode;
}

/**
 * Gate declarativo: renderiza children somente se canSee=true.
 * Caso contrário mostra loader (carregando) ou EmptyStateNoAccess.
 */
export function FeatureGate({ featureKey, featureLabel, children, wrapper }: FeatureGateProps) {
  const { canSee, loading } = useFeatureAccess(featureKey);

  const wrap = (node: ReactNode) => (wrapper ? wrapper(node) : node);

  if (loading) {
    return wrap(
      <div className="flex items-center justify-center py-20 text-muted-foreground">
        <Loader2 className="w-6 h-6 animate-spin mr-2" />
        Carregando permissões...
      </div>,
    );
  }

  if (!canSee) {
    return wrap(<EmptyStateNoAccess feature={featureLabel} />);
  }

  return <>{children}</>;
}

export default FeatureGate;
