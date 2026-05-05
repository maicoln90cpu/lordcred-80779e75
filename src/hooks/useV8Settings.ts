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
  // Nova estratégia (etapa 2 — webhook_only)
  simulation_strategy: 'webhook_only' | 'legacy_sync';
  auto_simulate_after_consult: boolean;
  consult_throttle_ms: number;
  simulate_throttle_ms: number;
  webhook_wait_timeout_min: number;
  /** Etapa 5 — quando true, exige documentos no envio do POST /operation */
  require_documents_on_create: boolean;
  /** Etapa 2A — retentativas internas por endpoint V8 (1-30) */
  max_retries_consult: number;
  max_retries_authorize: number;
  max_retries_simulate: number;
  /** Etapa C — bloqueio de duplicidade de CPF dentro de uma janela recente. */
  cpf_dedupe_enabled: boolean;
  cpf_dedupe_window_days: number;
  /** Etapa 2 (mai/2026) — Auto-melhor sempre ligado para qualquer simulação com margem. */
  auto_best_always_on: boolean;
  /** Etapa 2 (mai/2026) — Quantos lotes V8 o mesmo operador roda em paralelo (1-3). */
  max_concurrent_batches_per_owner: number;
  updated_at: string;
}

const DEFAULTS: Omit<V8Settings, 'id' | 'updated_at'> = {
  max_auto_retry_attempts: 15,
  retry_min_backoff_seconds: 10,
  retry_max_backoff_seconds: 120,
  background_retry_enabled: true,
  retry_batch_size: 25,
  sound_on_complete: false,
  simulation_strategy: 'webhook_only',
  auto_simulate_after_consult: false,
  consult_throttle_ms: 1200,
  simulate_throttle_ms: 1200,
  webhook_wait_timeout_min: 5,
  require_documents_on_create: false,
  max_retries_consult: 3,
  max_retries_authorize: 15,
  max_retries_simulate: 15,
  cpf_dedupe_enabled: true,
  cpf_dedupe_window_days: 7,
  auto_best_always_on: true,
  max_concurrent_batches_per_owner: 2,
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
