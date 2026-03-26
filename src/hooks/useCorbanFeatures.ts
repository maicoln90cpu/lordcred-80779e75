import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

export interface CorbanFeature {
  id: string;
  feature_key: string;
  feature_label: string;
  category: string;
  description: string | null;
  visible_to_sellers: boolean;
  visible_to_support: boolean;
  sort_order: number;
}

export function useCorbanFeatures() {
  const { isSeller, isSupport } = useAuth();

  const { data: features = [], isLoading, refetch } = useQuery({
    queryKey: ['corban-features'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('corban_feature_config')
        .select('*')
        .order('category')
        .order('sort_order');
      if (error) throw error;
      return (data || []) as CorbanFeature[];
    },
  });

  const isFeatureVisible = (featureKey: string): boolean => {
    const feature = features.find(f => f.feature_key === featureKey);
    if (!feature) return false;
    if (isSeller) return feature.visible_to_sellers;
    if (isSupport) return feature.visible_to_support;
    return true; // admin/master see everything
  };

  const featuresByCategory = features.reduce((acc, f) => {
    if (!acc[f.category]) acc[f.category] = [];
    acc[f.category].push(f);
    return acc;
  }, {} as Record<string, CorbanFeature[]>);

  return { features, featuresByCategory, isFeatureVisible, isLoading, refetch };
}
