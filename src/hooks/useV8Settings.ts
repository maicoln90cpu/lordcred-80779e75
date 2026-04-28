import { useCallback, useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';

export interface V8Settings {
  id: string;
  max_auto_retry_attempts: number;
  retry_min_backoff_seconds: number;
  retry_max_backoff_seconds: number;
  background_retry_enabled: boolean;
  retry_batch_size: number;
  sound_on_complete: boolean;
  updated_at: string;
}

const DEFAULTS: Omit<V8Settings, 'id' | 'updated_at'> = {
  max_auto_retry_attempts: 15,
  retry_min_backoff_seconds: 10,
  retry_max_backoff_seconds: 120,
  background_retry_enabled: true,
  retry_batch_size: 25,
  sound_on_complete: false,
};

export function useV8Settings() {
  const [settings, setSettings] = useState<V8Settings | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    const { data } = await supabase
      .from('v8_settings' as any)
      .select('*')
      .eq('singleton', true)
      .maybeSingle();
    if (data) setSettings(data as any);
    setLoading(false);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const save = useCallback(
    async (patch: Partial<Omit<V8Settings, 'id' | 'updated_at'>>) => {
      if (!settings) return false;
      setSaving(true);
      const { error } = await supabase
        .from('v8_settings' as any)
        .update(patch)
        .eq('id', settings.id);
      setSaving(false);
      if (error) return false;
      await load();
      return true;
    },
    [settings, load],
  );

  return {
    settings,
    loading,
    saving,
    save,
    reload: load,
    defaults: DEFAULTS,
  };
}
