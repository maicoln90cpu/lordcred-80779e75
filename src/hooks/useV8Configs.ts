import { useEffect, useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

export interface V8Config {
  id: string;
  v8_config_id: string;
  label: string;
  raw: any;
  synced_at: string;
}

export function useV8Configs() {
  const [configs, setConfigs] = useState<V8Config[]>([]);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  const loadFromCache = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('v8_configs_cache')
      .select('*')
      .order('label', { ascending: true });
    if (!error && data) setConfigs(data as V8Config[]);
    setLoading(false);
  }, []);

  const refreshFromV8 = useCallback(async () => {
    setRefreshing(true);
    try {
      const { data, error } = await supabase.functions.invoke('v8-clt-api', {
        body: { action: 'get_configs' },
      });
      if (error) throw error;
      if (!data?.success) throw new Error(data?.error || 'Falha ao carregar configs');
      toast.success(`${data.data?.length ?? 0} tabelas atualizadas`);
      await loadFromCache();
    } catch (err: any) {
      toast.error(`Erro: ${err?.message || err}`);
    } finally {
      setRefreshing(false);
    }
  }, [loadFromCache]);

  useEffect(() => {
    loadFromCache();
  }, [loadFromCache]);

  return { configs, loading, refreshing, refreshFromV8, reload: loadFromCache };
}
