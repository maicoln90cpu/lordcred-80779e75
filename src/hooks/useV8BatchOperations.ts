import { useState } from 'react';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { isRetriableErrorKind, shouldAutoRetry } from '@/lib/v8ErrorClassification';
import type { analyzeV8Paste } from '@/lib/v8Parser';
import { triggerLauncherShortLoop } from '@/lib/v8LauncherTrigger';

const MAX_CONCURRENCY = 3;

type SimulationMode = 'none' | 'disbursed_amount' | 'installment_face_value';

interface UseV8BatchOperationsArgs {
  configId: string;
  parcelas: number;
  simulationMode: SimulationMode;
  simulationValue: string;
  batchName: string;
  pasteAnalysis: ReturnType<typeof analyzeV8Paste>;
  blockingIssues: ReturnType<typeof analyzeV8Paste>['issues'];
  configs: any[];
  v8Settings: any;
  simulations: any[];
  activeBatchId: string | null;
  setActiveBatchId: (id: string | null) => void;
  maxAutoRetry: number;
  minBackoffMs: number;
  maxBackoffMs: number;
  backgroundRetryEnabled: boolean;
}

/**
 * Encapsula toda a lógica de disparo/retry/simulação/cancelamento de lotes V8.
 * Mantém o orquestrador V8NovaSimulacaoTab enxuto e focado em layout.
 */
export function useV8BatchOperations(args: UseV8BatchOperationsArgs) {
  const {
    configId, parcelas, simulationMode, simulationValue, batchName,
    pasteAnalysis, blockingIssues, configs, v8Settings, simulations,
    activeBatchId, setActiveBatchId,
    maxAutoRetry, minBackoffMs, maxBackoffMs, backgroundRetryEnabled,
  } = args;

  const [running, setRunning] = useState(false);

  function normalizedValue() {
    return simulationMode === 'none' ? 0 : Number(simulationValue.replace(',', '.'));
  }

  async function handleRetryFailed() {
    if (!activeBatchId) return;
    const candidates = simulations.filter((s: any) => {
      const kind = s.error_kind || s.raw_response?.kind || s.raw_response?.error_kind || null;
      if (!isRetriableErrorKind(kind)) return false;
      if (s.status === 'failed') return true;
      if (s.status === 'pending' && s.last_attempt_at) {
        return Date.now() - new Date(s.last_attempt_at).getTime() > 60_000;
      }
      return false;
    });
    if (candidates.length === 0) {
      toast.info('Nenhuma falha retentável neste lote (apenas erros temporários ou em análise são reprocessados automaticamente).');
      return;
    }
    if (!configId) { toast.error('Escolha a tabela usada no lote antes de retentar'); return; }
    setRunning(true);
    const toastId = toast.loading(`Retentando ${candidates.length} simulação(ões)...`);
    let okCount = 0; let failCount = 0;
    const normalized = normalizedValue();
    try {
      let idx = 0;
      const workers = Array.from({ length: MAX_CONCURRENCY }, async () => {
        while (idx < candidates.length) {
          const myIdx = idx++; const sim: any = candidates[myIdx];
          try {
            const parsedRow = pasteAnalysis.rows.find((r) => r.cpf === sim.cpf);
            const { data, error } = await supabase.functions.invoke('v8-clt-api', {
              body: {
                action: 'simulate_one',
                params: {
                  cpf: sim.cpf, nome: sim.name, data_nascimento: sim.birth_date,
                  genero: parsedRow?.genero, telefone: parsedRow?.telefone,
                  config_id: sim.config_id || configId, parcelas: parcelas || sim.installments,
                  simulation_mode: simulationMode === 'none' ? undefined : simulationMode,
                  simulation_value: simulationMode === 'none' ? undefined : normalized,
                  batch_id: activeBatchId, simulation_id: sim.id,
                  attempt_count: Number(sim.attempt_count ?? 1) + 1,
                  triggered_by: 'manual_retry',
                },
              },
            });
            if (error || !data?.success) failCount += 1; else okCount += 1;
          } catch { failCount += 1; }
        }
      });
      await Promise.all(workers);
      toast.success(`Retentativa concluída: ${okCount} ok · ${failCount} ainda com erro`, { id: toastId });
    } catch (err: any) {
      toast.error(`Erro ao retentar: ${err?.message || err}`, { id: toastId });
    } finally { setRunning(false); }
  }

  async function handleStart() {
    const rows = pasteAnalysis.rows;
    if (rows.length === 0) { toast.error('Cole pelo menos 1 CPF válido'); return; }
    if (blockingIssues.length > 0) { toast.error(`Corrija ${blockingIssues.length} linha(s) inválida(s) antes de enviar o lote`); return; }
    if (!configId) { toast.error('Escolha uma tabela'); return; }
    if (!batchName.trim()) { toast.error('Dê um nome ao lote'); return; }
    const hasValueInput = simulationValue.trim().length > 0;
    const wantsValue = simulationMode !== 'none';
    if (wantsValue && (!hasValueInput || !Number.isFinite(Number(simulationValue.replace(',', '.'))) || Number(simulationValue.replace(',', '.')) <= 0)) {
      toast.error('Informe um valor válido para a simulação ou escolha "Sem valor (V8 decide)"'); return;
    }

    setRunning(true);
    const cfgLabel = configs.find((c) => c.config_id === configId)?.name;
    const normalized = normalizedValue();
    const strategy = v8Settings?.simulation_strategy ?? 'webhook_only';
    const throttleMs = v8Settings?.consult_throttle_ms ?? 1200;
    let pendingCount = 0;

    try {
      const { data, error } = await supabase.functions.invoke('v8-clt-api', {
        body: { action: 'create_batch', params: { name: batchName.trim(), config_id: configId, config_label: cfgLabel, parcelas, rows } },
      });
      if (error) throw error;
      if (!data?.success) throw new Error(data?.error || 'Falha ao criar lote');

      const batchId = data.data.batch_id as string;
      setActiveBatchId(batchId);
      const skippedCount = Number((data?.data?.skipped_duplicates ?? 0)) || 0;
      const dedupeWindow = Number((data?.data?.dedupe_window_days ?? 7)) || 7;
      if (skippedCount > 0) {
        toast.warning(
          `${skippedCount} CPF(s) ignorado(s) — já consultados nos últimos ${dedupeWindow} dia(s). Veja-os marcados como "Duplicado recente".`,
          { duration: 8000 },
        );
      }
      toast.success(`Lote criado com ${data.data.total} CPFs. Iniciando (estratégia: ${strategy})...`);

      const { data: sims } = await supabase
        .from('v8_simulations').select('id, cpf, name, birth_date, paste_order, status, error_kind')
        .eq('batch_id', batchId)
        // Etapa 1 (correção de ordem): respeitar a ordem em que o operador colou.
        // Antes ordenávamos por created_at — todas as linhas têm o mesmo timestamp
        // (insert em massa), então a ordem ficava aleatória.
        .order('paste_order', { ascending: true, nullsFirst: false })
        .order('created_at', { ascending: true });
      if (!sims) throw new Error('Falha ao carregar simulações');

      // Etapa C — não disparar consulta para CPFs deduplicados
      const simsToProcess = sims.filter((s: any) => s.error_kind !== 'duplicate_recent' && s.status !== 'skipped');

      if (strategy === 'webhook_only') {
        for (let i = 0; i < simsToProcess.length; i++) {
          const sim = simsToProcess[i];
          // Etapa 4 (b): heartbeat ANTES do POST. Marca attempt_count=1 + last_attempt_at
          // para o watchdog conseguir distinguir "nunca disparou" de "disparou e aguarda".
          await supabase
            .from('v8_simulations')
            .update({ attempt_count: 1, last_attempt_at: new Date().toISOString(), last_step: 'dispatch_started' })
            .eq('id', sim.id);
          let dispatchOk = false;
          try {
            const parsedRow = rows.find((r) => r.cpf === sim.cpf);
            const { data: dResp, error: dErr } = await supabase.functions.invoke('v8-clt-api', {
              body: {
                action: 'simulate_consult_only',
                params: {
                  cpf: sim.cpf, nome: sim.name, data_nascimento: sim.birth_date,
                  genero: parsedRow?.genero, telefone: parsedRow?.telefone,
                  config_id: configId, parcelas, batch_id: batchId, simulation_id: sim.id,
                  attempt_count: 1, triggered_by: 'user',
                },
              },
            });
            dispatchOk = !dErr && (dResp?.success !== false);
            if (dispatchOk) pendingCount += 1;
          } catch (err) { console.error('Sim err', sim.cpf, err); }
          // Etapa 4 (a): se o dispatch falhou, marca FAILED imediatamente.
          if (!dispatchOk) {
            await supabase.from('v8_simulations').update({
              status: 'failed',
              error_kind: 'dispatch_failed',
              error_message: 'Falha ao disparar a consulta para a V8 (timeout/erro de rede).',
              last_step: 'dispatch_failed',
              processed_at: new Date().toISOString(),
            }).eq('id', sim.id);
            await supabase.rpc('v8_increment_batch_failure', { _batch_id: batchId });
          }
          if (i < simsToProcess.length - 1) await new Promise((r) => setTimeout(r, throttleMs));
        }
        toast.success(
          `Lote disparado: ${pendingCount} consulta(s) aguardando webhook V8. Os valores aparecem em ~10–30s por CPF.`,
          { duration: 8000 },
        );
      } else {
        let idx = 0;
        const workers = Array.from({ length: MAX_CONCURRENCY }, async () => {
          while (idx < simsToProcess.length) {
            const myIdx = idx++; const sim = simsToProcess[myIdx];
            try {
              const parsedRow = rows.find((r) => r.cpf === sim.cpf);
              await supabase.functions.invoke('v8-clt-api', {
                body: {
                  action: 'simulate_one',
                  params: {
                    cpf: sim.cpf, nome: sim.name, data_nascimento: sim.birth_date,
                    genero: parsedRow?.genero, telefone: parsedRow?.telefone,
                    config_id: configId, parcelas,
                    simulation_mode: simulationMode === 'none' ? undefined : simulationMode,
                    simulation_value: simulationMode === 'none' ? undefined : normalized,
                    batch_id: batchId, simulation_id: sim.id,
                    attempt_count: Number((sim as any).attempt_count ?? 0) + 1,
                    triggered_by: 'user',
                  },
                },
              });
              const { data: latestSim } = await supabase
                .from('v8_simulations').select('status').eq('id', sim.id).maybeSingle();
              if (latestSim?.status === 'pending') pendingCount += 1;
            } catch (err) { console.error('Sim err', sim.cpf, err); }
          }
        });
        await Promise.all(workers);
        if (pendingCount > 0) toast.warning(`Lote enviado. ${pendingCount} consulta(s) ainda em análise.`);
        else toast.success('Lote concluído!');
      }

      if (backgroundRetryEnabled) {
        toast.info('Auto-retry rodando em segundo plano (cron a cada 1 min). Pode fechar a aba.');
      } else if (strategy !== 'webhook_only') {
        await runAutoRetryLoop(batchId, rows, normalized);
      }
    } catch (err: any) {
      toast.error(`Erro: ${err?.message || err}`);
    } finally { setRunning(false); }
  }

  async function handleSimulateSelected() {
    if (!activeBatchId) return;
    if (!configId) { toast.error('Escolha a tabela usada no lote'); return; }
    const candidates = simulations.filter((s: any) =>
      s.status === 'success' && s.consult_id && (s.simulate_status ?? 'not_started') !== 'done'
    );
    if (candidates.length === 0) { toast.info('Nenhum CPF pronto para simular (precisa ter consulta SUCCESS).'); return; }
    setRunning(true);
    const throttleMs = v8Settings?.simulate_throttle_ms ?? 1200;
    const normalized = normalizedValue();
    const toastId = toast.loading(`Simulando ${candidates.length} CPF(s)...`);
    let okCount = 0; let failCount = 0;
    try {
      for (let i = 0; i < candidates.length; i++) {
        const sim: any = candidates[i];
        try {
          const { data } = await supabase.functions.invoke('v8-clt-api', {
            body: {
              action: 'simulate_only_for_consult',
              params: {
                simulation_id: sim.id, consult_id: sim.consult_id,
                config_id: sim.config_id || configId, parcelas: parcelas || sim.installments,
                simulation_mode: simulationMode === 'none' ? undefined : simulationMode,
                simulation_value: simulationMode === 'none' ? undefined : normalized,
              },
            },
          });
          if (data?.success) okCount += 1; else failCount += 1;
        } catch { failCount += 1; }
        if (i < candidates.length - 1) await new Promise((r) => setTimeout(r, throttleMs));
      }
      toast.success(`Simulação concluída: ${okCount} ok · ${failCount} erro`, { id: toastId });
    } catch (err: any) {
      toast.error(`Erro: ${err?.message || err}`, { id: toastId });
    } finally { setRunning(false); }
  }

  async function runAutoRetryLoop(batchId: string, rows: ReturnType<typeof analyzeV8Paste>['rows'], normalized: number) {
    let round = 0; const MAX_ROUNDS = maxAutoRetry;
    while (round < MAX_ROUNDS) {
      const { data: fresh } = await supabase
        .from('v8_simulations')
        .select('id, cpf, name, birth_date, status, attempt_count, raw_response, error_kind, config_id, installments')
        .eq('batch_id', batchId);
      if (!fresh) break;
      const candidates = fresh.filter((s: any) => {
        const kind = s.error_kind || s.raw_response?.kind || s.raw_response?.error_kind || null;
        if (!isRetriableErrorKind(kind)) return false;
        if (s.status === 'failed') return shouldAutoRetry(kind, s.attempt_count, maxAutoRetry);
        if (s.status === 'pending' && s.last_attempt_at) {
          const ageMs = Date.now() - new Date(s.last_attempt_at).getTime();
          return ageMs > 60_000 && shouldAutoRetry(kind, s.attempt_count, maxAutoRetry);
        }
        return false;
      });
      if (candidates.length === 0) {
        if (round > 0) toast.success(`Auto-retry concluído após ${round} rodada(s).`);
        break;
      }
      round += 1;
      const backoffMs = Math.min(minBackoffMs * Math.pow(2, round - 1), maxBackoffMs);
      toast.info(`Rodada de auto-retry ${round}/${MAX_ROUNDS} · ${candidates.length} CPF(s) instáveis · aguardando ${Math.round(backoffMs / 1000)}s antes...`);
      await new Promise((r) => setTimeout(r, backoffMs));
      let idx = 0;
      const workers = Array.from({ length: MAX_CONCURRENCY }, async () => {
        while (idx < candidates.length) {
          const myIdx = idx++; const sim: any = candidates[myIdx];
          try {
            const parsedRow = rows.find((r) => r.cpf === sim.cpf);
            await supabase.functions.invoke('v8-clt-api', {
              body: {
                action: 'simulate_one',
                params: {
                  cpf: sim.cpf, nome: sim.name, data_nascimento: sim.birth_date,
                  genero: parsedRow?.genero, telefone: parsedRow?.telefone,
                  config_id: sim.config_id || configId, parcelas: parcelas || sim.installments,
                  simulation_mode: simulationMode === 'none' ? undefined : simulationMode,
                  simulation_value: simulationMode === 'none' ? undefined : normalized,
                  batch_id: batchId, simulation_id: sim.id,
                  attempt_count: Number(sim.attempt_count ?? 1) + 1,
                  triggered_by: 'user',
                },
              },
            });
          } catch (err) { console.error('Auto-retry sim err', sim.cpf, err); }
        }
      });
      await Promise.all(workers);
    }
  }

  async function handleReplayPending() {
    // Item 9 (abr/2026): explicar para o operador o que aconteceu de verdade.
    // Esta ação NÃO consulta a V8 — ela só reprocessa webhooks que a V8 já nos enviou
    // mas que ficaram com erro de processamento (ex.: deploy em andamento, RLS bloqueou).
    // Se total=0, não tem nada pendente — está tudo certo.
    const toastId = toast.loading('Verificando webhooks pendentes...');
    try {
      const { data, error } = await supabase.functions.invoke('v8-webhook', {
        body: { action: 'replay_pending', limit: 500, batch_id: activeBatchId },
      });
      if (error) throw error;
      const total = Number(data?.total ?? 0);
      const success = Number(data?.success ?? 0);
      const failed = Number(data?.failed ?? 0);
      if (total === 0) {
        toast.success('Nenhum webhook pendente encontrado ✅', {
          id: toastId,
          description: 'Está tudo em dia. Se uma linha está em "aguardando", a V8 ainda não enviou resposta — aguarde ou use o botão "Verificar status" em cada linha.',
          duration: 7000,
        });
      } else if (failed === 0) {
        toast.success(`✅ ${success} webhook(s) reprocessado(s) com sucesso`, {
          id: toastId,
          description: 'Os resultados devem aparecer na tabela em alguns segundos.',
          duration: 6000,
        });
      } else {
        toast.warning(`⚠️ ${success} ok · ${failed} falha(s) (de ${total})`, {
          id: toastId,
          description: 'Algumas falhas persistiram. Veja os detalhes em Webhooks → "Logs com erro".',
          duration: 8000,
        });
      }
    } catch (e: any) {
      toast.error(`Falha ao buscar pendentes: ${e?.message || e}`, { id: toastId });
    }
  }

  /** Dispara o launcher imediatamente após cancelar para promover próximo da fila. */
  function triggerLauncherNow() {
    triggerLauncherShortLoop({ reason: 'cancel-batch' });
  }

  async function handleCancelBatch() {
    if (!activeBatchId) return;
    const pending = simulations.filter((s: any) => s.status === 'pending').length;
    const ok = window.confirm(
      `Cancelar este lote?\n\n` +
      `• ${pending} consulta(s) pendente(s) serão marcadas como FALHA (cancelado).\n` +
      `• Os crons de retry e poller vão ignorar este lote a partir de agora.\n` +
      `• Resultados já recebidos (success) serão preservados.\n` +
      `• CPFs já em análise continuam sendo monitorados (webhook chega normalmente).\n\n` +
      `Esta ação NÃO pode ser desfeita.`,
    );
    if (!ok) return;
    try {
      const { data, error } = await supabase.functions.invoke('v8-clt-api', {
        body: { action: 'cancel_batch', batch_id: activeBatchId },
      });
      if (error) throw error;
      toast.success(`Lote cancelado · ${data?.canceled ?? 0} pendente(s) marcadas como falha.`);
      triggerLauncherNow();
    } catch (e: any) {
      toast.error(`Falha ao cancelar lote: ${e?.message || e}`);
    }
  }

  async function handleCancelBatchHard() {
    if (!activeBatchId) return;
    const nonSuccess = simulations.filter((s: any) => s.status !== 'success').length;
    const ok = window.confirm(
      `⚠️ CANCELAMENTO TOTAL — Ignorar webhooks futuros\n\n` +
      `• ${nonSuccess} simulação(ões) serão marcadas como FALHA (inclusive as em análise na V8).\n` +
      `• Webhooks futuros desses CPFs serão IGNORADOS — consultas já pagas serão perdidas.\n` +
      `• Apenas resultados já com "sucesso" serão preservados.\n\n` +
      `Use apenas quando quiser parar TUDO imediatamente.\n\n` +
      `Esta ação NÃO pode ser desfeita.`,
    );
    if (!ok) return;
    try {
      const { data, error } = await supabase.functions.invoke('v8-clt-api', {
        body: { action: 'cancel_batch_hard', params: { batch_id: activeBatchId } },
      });
      if (error) throw error;
      toast.success(`Lote cancelado (duro) · ${data?.data?.canceled_simulations ?? 0} simulação(ões) canceladas. Webhooks futuros serão ignorados.`, { duration: 8000 });
      triggerLauncherNow();
    } catch (e: any) {
      toast.error(`Falha ao cancelar lote: ${e?.message || e}`);
    }
  }

  async function handleCheckStatus(
    cpf: string,
    simulationId: string | undefined,
    setDialogState: (s: { cpf: string; loading: boolean; result: any | null; error: string | null }) => void,
    openDialog: () => void,
  ) {
    openDialog();
    setDialogState({ cpf, loading: true, result: null, error: null });
    try {
      const { data, error } = await supabase.functions.invoke('v8-clt-api', {
        body: { action: 'check_consult_status', params: { cpf } },
      });
      if (error) throw error;
      if (!data?.success) {
        setDialogState({ cpf, loading: false, result: null, error: data?.user_message || data?.error || 'Falha ao consultar' });
        return;
      }
      setDialogState({ cpf, loading: false, result: data.data, error: null });
      if (simulationId && data?.data) {
        try {
          const probedAtIso = new Date().toISOString();
          const { data: current } = await supabase
            .from('v8_simulations').select('raw_response').eq('id', simulationId).maybeSingle();
          const baseRaw = (current?.raw_response as any) ?? {};
          await supabase.from('v8_simulations').update({
            raw_response: { ...baseRaw, v8_status_snapshot: { ...(data.data as object), probed_at: probedAtIso } },
            v8_status_snapshot_at: probedAtIso,
          }).eq('id', simulationId);
        } catch { /* ignore */ }
      }
    } catch (err: any) {
      setDialogState({ cpf, loading: false, result: null, error: err?.message || String(err) });
    }
  }

  return {
    running,
    handleStart, handleRetryFailed, handleSimulateSelected,
    handleReplayPending, handleCancelBatch, handleCancelBatchHard, handleCheckStatus,
  };
}
