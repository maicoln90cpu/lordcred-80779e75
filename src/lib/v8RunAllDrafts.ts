/**
 * Etapa 1 (abr/2026): "Executar todos em sequência".
 * Etapa 2 (mai/2026): novo modo `parallel_dispatch` — dispara todos os rascunhos
 * de uma vez (cada um vira um lote `scheduled` com scheduled_for=now()).
 * O launcher (v8-scheduled-launcher) promove TODOS para `processing` na próxima
 * execução, independente de fila. ATENÇÃO: cuidado com rate-limit da V8.
 *
 * Modo `sequential` (padrão / antigo): usa `queue_batch`, o launcher promove
 * um por vez conforme o anterior termina.
 */

import { supabase } from '@/integrations/supabase/client';
import { analyzeV8Paste } from '@/lib/v8Parser';
import type { V8DraftSlot } from '@/lib/v8DraftSlots';

export type RunAllMode = 'sequential' | 'parallel_dispatch';

export interface RunAllItemResult {
  draftId: string;
  label: string;
  status: 'queued' | 'dispatched' | 'skipped' | 'error';
  reason?: string;
  queuePosition?: number;
  batchId?: string;
}

export interface RunAllConfig {
  config_id: string;
  name: string;
}

export async function queueAllDrafts(params: {
  drafts: V8DraftSlot[];
  configs: RunAllConfig[];
  strategy: string;
  mode?: RunAllMode;
}): Promise<RunAllItemResult[]> {
  const mode: RunAllMode = params.mode ?? 'sequential';
  const results: RunAllItemResult[] = [];

  for (const d of params.drafts) {
    if (!d.batchName.trim()) {
      results.push({ draftId: d.id, label: d.label, status: 'skipped', reason: 'Sem nome do lote' });
      continue;
    }
    if (!d.configId) {
      results.push({ draftId: d.id, label: d.label, status: 'skipped', reason: 'Sem tabela escolhida' });
      continue;
    }
    const analysis = analyzeV8Paste(d.pasteText);
    if (analysis.rows.length === 0) {
      results.push({ draftId: d.id, label: d.label, status: 'skipped', reason: 'Sem CPFs válidos' });
      continue;
    }
    const blocking = analysis.issues.filter(
      (i) => i.code === 'invalid_date' || i.code === 'invalid_format' || i.code === 'missing_birth_date',
    );
    if (blocking.length > 0) {
      results.push({
        draftId: d.id, label: d.label, status: 'skipped',
        reason: `${blocking.length} linha(s) inválida(s)`,
      });
      continue;
    }

    const cfgLabel = params.configs.find((c) => c.config_id === d.configId)?.name;
    const numericValue = d.simulationMode !== 'none' && d.simulationValue.trim()
      ? Number(d.simulationValue.replace(',', '.'))
      : null;

    const action = mode === 'parallel_dispatch' ? 'schedule_batch' : 'queue_batch';
    const extraParams: Record<string, unknown> = mode === 'parallel_dispatch'
      ? { scheduled_for: new Date().toISOString() }
      : {};

    try {
      const { data, error } = await supabase.functions.invoke('v8-clt-api', {
        body: {
          action,
          params: {
            name: d.batchName.trim(),
            config_id: d.configId,
            config_label: cfgLabel,
            parcelas: d.parcelas,
            rows: analysis.rows,
            strategy: params.strategy,
            simulation_mode: d.simulationMode,
            simulation_value: numericValue,
            ...extraParams,
          },
        },
      });
      if (error || !data?.success) {
        results.push({
          draftId: d.id, label: d.label, status: 'error',
          reason: data?.error || error?.message || 'erro desconhecido',
        });
        continue;
      }
      results.push({
        draftId: d.id, label: d.label,
        status: mode === 'parallel_dispatch' ? 'dispatched' : 'queued',
        queuePosition: data?.data?.queue_position,
        batchId: data?.data?.batch_id,
      });
    } catch (err) {
      results.push({
        draftId: d.id, label: d.label, status: 'error',
        reason: err instanceof Error ? err.message : 'erro inesperado',
      });
    }
  }

  return results;
}

export function summarizeRunAll(results: RunAllItemResult[]): {
  queued: number;
  dispatched: number;
  skipped: number;
  errors: number;
  text: string;
} {
  const queued = results.filter((r) => r.status === 'queued').length;
  const dispatched = results.filter((r) => r.status === 'dispatched').length;
  const skipped = results.filter((r) => r.status === 'skipped').length;
  const errors = results.filter((r) => r.status === 'error').length;
  const parts: string[] = [];
  if (queued) parts.push(`${queued} enfileirado(s)`);
  if (dispatched) parts.push(`${dispatched} disparado(s)`);
  if (skipped) parts.push(`${skipped} pulado(s)`);
  if (errors) parts.push(`${errors} erro(s)`);
  return { queued, dispatched, skipped, errors, text: parts.join(' · ') || 'Nada a fazer' };
}
