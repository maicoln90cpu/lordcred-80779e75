/**
 * Etapa 1 (abr/2026): "Executar todos em sequência".
 *
 * Para cada rascunho preenchido (CPFs colados + tabela escolhida + nome),
 * cria um lote V8 com action='queue_batch'. O primeiro vira 'scheduled' (roda já),
 * os demais ficam em 'queued' e o launcher (pg_cron 1/min) promove um por vez
 * conforme o anterior termina.
 *
 * Não interrompe o fluxo normal: cada rascunho continua editável depois.
 */

import { supabase } from '@/integrations/supabase/client';
import { analyzeV8Paste } from '@/lib/v8Parser';
import type { V8DraftSlot } from '@/lib/v8DraftSlots';

export interface RunAllItemResult {
  draftId: string;
  label: string;
  status: 'queued' | 'skipped' | 'error';
  reason?: string;
  queuePosition?: number;
}

export interface RunAllConfig {
  config_id: string;
  name: string;
}

export async function queueAllDrafts(params: {
  drafts: V8DraftSlot[];
  configs: RunAllConfig[];
  strategy: string;
}): Promise<RunAllItemResult[]> {
  const results: RunAllItemResult[] = [];

  for (const d of params.drafts) {
    // Validação leiga: pula em vez de quebrar o lote inteiro.
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

    try {
      const { data, error } = await supabase.functions.invoke('v8-clt-api', {
        body: {
          action: 'queue_batch',
          params: {
            name: d.batchName.trim(),
            config_id: d.configId,
            config_label: cfgLabel,
            parcelas: d.parcelas,
            rows: analysis.rows,
            strategy: params.strategy,
            simulation_mode: d.simulationMode,
            simulation_value: numericValue,
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
        draftId: d.id, label: d.label, status: 'queued',
        queuePosition: data?.data?.queue_position,
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
  skipped: number;
  errors: number;
  text: string;
} {
  const queued = results.filter((r) => r.status === 'queued').length;
  const skipped = results.filter((r) => r.status === 'skipped').length;
  const errors = results.filter((r) => r.status === 'error').length;
  const parts: string[] = [];
  if (queued) parts.push(`${queued} enfileirado(s)`);
  if (skipped) parts.push(`${skipped} pulado(s)`);
  if (errors) parts.push(`${errors} erro(s)`);
  return { queued, skipped, errors, text: parts.join(' · ') || 'Nada a fazer' };
}
