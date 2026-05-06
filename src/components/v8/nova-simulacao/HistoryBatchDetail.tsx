import { useMemo, useState } from 'react';
import { ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import BatchProgressTable from './BatchProgressTable';
import BatchActionsBar from './BatchActionsBar';
import { useV8BatchSimulations, type V8Batch } from '@/hooks/useV8Batches';
import { useV8Settings } from '@/hooks/useV8Settings';
import { downloadBatchCsv } from '@/lib/v8BatchExport';
import { triggerLauncherShortLoop } from '@/lib/v8LauncherTrigger';

interface Props {
  batch: V8Batch;
  onBack: () => void;
}

/**
 * Etapa 2 (mai/2026 — itens 4/6/7): visão de detalhe do lote no Histórico
 * com BatchActionsBar completo (Simular selecionados, Reprocessar webhooks,
 * Pausar/Retomar, Cancelar lote, Cancelar tudo, Forçar dispatch).
 *
 * Independente do orquestrador "Nova Simulação" — usa só o batch_id e
 * dispara as mesmas edge functions diretamente.
 */
export default function HistoryBatchDetail({ batch, onBack }: Props) {
  const { simulations, batch: meta, lastUpdateAt, reload } = useV8BatchSimulations(batch.id);
  const { settings: v8Settings } = useV8Settings();
  const [running, setRunning] = useState(false);
  const isPaused = !!(meta as any)?.is_paused || !!(batch as any)?.is_paused;

  const stuckCount = useMemo(
    () => simulations.filter((s: any) => {
      if (s.status !== 'pending') return false;
      if (Number(s.attempt_count ?? 0) === 0) return true;
      if (s.last_attempt_at) return Date.now() - new Date(s.last_attempt_at).getTime() > 5 * 60 * 1000;
      return true;
    }).length,
    [simulations],
  );

  const awaitingManualSim = useMemo(
    () => simulations.filter((s: any) =>
      s.status === 'success' && s.consult_id && (s.simulate_status ?? 'not_started') !== 'success',
    ).length,
    [simulations],
  );

  const configId = (meta as any)?.config_id || batch.config_id || null;
  const parcelas = batch.installments ?? meta?.installments ?? 0;

  async function handleSimulateSelected() {
    if (!configId) { toast.error('Lote sem tabela definida'); return; }
    const candidates = simulations.filter((s: any) =>
      s.status === 'success' && s.consult_id && (s.simulate_status ?? 'not_started') !== 'success',
    );
    if (candidates.length === 0) { toast.info('Nenhum CPF pronto para simular'); return; }
    setRunning(true);
    const tId = toast.loading(`🤖 Auto-melhor: ${candidates.length} CPF(s)...`);
    let ok = 0, fail = 0;
    try {
      const { runAutoBestForSim } = await import('@/lib/v8AutoBest');
      const throttle = v8Settings?.simulate_throttle_ms ?? 1200;
      for (let i = 0; i < candidates.length; i++) {
        const sim: any = candidates[i];
        try {
          const r = await runAutoBestForSim({
            id: sim.id, cpf: sim.cpf, consult_id: sim.consult_id,
            config_id: sim.config_id || configId,
            margem_valor: sim.margem_valor,
            sim_value_min: sim.sim_value_min, sim_value_max: sim.sim_value_max,
            sim_installments_min: sim.sim_installments_min, sim_installments_max: sim.sim_installments_max,
          });
          if (r.status === 'success') ok++; else fail++;
        } catch { fail++; }
        if (i < candidates.length - 1) await new Promise(r => setTimeout(r, throttle));
      }
      toast.success(`Auto-melhor: ${ok} ok · ${fail} sem proposta`, { id: tId, duration: 7000 });
    } finally { setRunning(false); reload(); }
  }

  async function handleReplayPending() {
    const tId = toast.loading('Verificando webhooks pendentes...');
    try {
      const { data, error } = await supabase.functions.invoke('v8-webhook', {
        body: { action: 'replay_pending', limit: 500, batch_id: batch.id },
      });
      if (error) throw error;
      const total = Number(data?.total ?? 0), ok = Number(data?.success ?? 0), fail = Number(data?.failed ?? 0);
      if (total === 0) toast.success('Nenhum webhook pendente ✅', { id: tId });
      else if (fail === 0) toast.success(`✅ ${ok} reprocessado(s)`, { id: tId });
      else toast.warning(`${ok} ok · ${fail} falha (de ${total})`, { id: tId });
    } catch (e: any) { toast.error(`Falha: ${e?.message || e}`, { id: tId }); }
  }

  async function handleCancelBatch() {
    const pending = simulations.filter((s: any) => s.status === 'pending').length;
    if (!window.confirm(`Cancelar lote? ${pending} pendente(s) viram FALHA. Sucessos preservados.`)) return;
    try {
      const { data, error } = await supabase.functions.invoke('v8-clt-api', {
        body: { action: 'cancel_batch', batch_id: batch.id },
      });
      if (error) throw error;
      toast.success(`Lote cancelado · ${data?.canceled ?? 0} marcadas`);
      triggerLauncherShortLoop({ reason: 'cancel-batch' });
    } catch (e: any) { toast.error(`Falha: ${e?.message || e}`); }
  }

  async function handleCancelBatchHard() {
    const ns = simulations.filter((s: any) => s.status !== 'success').length;
    if (!window.confirm(`⚠️ Cancelar TUDO? ${ns} simulação(ões) viram FALHA. Webhooks futuros IGNORADOS.`)) return;
    try {
      const { data, error } = await supabase.functions.invoke('v8-clt-api', {
        body: { action: 'cancel_batch_hard', params: { batch_id: batch.id } },
      });
      if (error) throw error;
      toast.success(`Cancelado (duro) · ${data?.data?.canceled_simulations ?? 0}`, { duration: 8000 });
      triggerLauncherShortLoop({ reason: 'cancel-batch' });
    } catch (e: any) { toast.error(`Falha: ${e?.message || e}`); }
  }

  async function togglePause() {
    const next = !isPaused;
    const { data: { user } } = await supabase.auth.getUser();
    const { error } = await supabase.from('v8_batches').update({
      is_paused: next, paused_at: next ? new Date().toISOString() : null,
      paused_by: next ? user?.id ?? null : null,
    }).eq('id', batch.id);
    if (error) toast.error('Falha: ' + error.message);
    else toast.success(next ? '⏸ Lote pausado' : '▶ Lote retomado');
    if (!next) triggerLauncherShortLoop({ reason: 'resume-batch' });
  }

  async function handleForceDispatchBatch() {
    const stuck = simulations.filter((s: any) => {
      if (s.status !== 'pending') return false;
      if (Number(s.attempt_count ?? 0) === 0) return true;
      if (s.last_attempt_at) return Date.now() - new Date(s.last_attempt_at).getTime() > 5 * 60 * 1000;
      return true;
    });
    if (stuck.length === 0) { toast.info('Nada preso'); return; }
    if (!window.confirm(`Forçar dispatch de ${stuck.length} linha(s)?`)) return;
    setRunning(true);
    const tId = toast.loading(`Forçando ${stuck.length}...`);
    let ok = 0, fail = 0;
    const throttle = v8Settings?.consult_throttle_ms ?? 1200;
    try {
      for (let i = 0; i < stuck.length; i++) {
        const sim: any = stuck[i];
        await supabase.from('v8_simulations').update({
          attempt_count: Number(sim.attempt_count ?? 0) + 1,
          last_attempt_at: new Date().toISOString(),
          last_step: 'dispatch_started', error_kind: null, error_message: null,
        }).eq('id', sim.id);
        try {
          const { data, error } = await supabase.functions.invoke('v8-clt-api', {
            body: {
              action: 'simulate_consult_only',
              params: {
                cpf: sim.cpf, nome: sim.name, data_nascimento: sim.birth_date,
                config_id: sim.config_id || configId, parcelas: parcelas || sim.installments,
                batch_id: batch.id, simulation_id: sim.id,
                attempt_count: Number(sim.attempt_count ?? 0) + 1,
                triggered_by: 'force_dispatch_batch_history',
              },
            },
          });
          if (!error && data?.success !== false) ok++; else fail++;
        } catch { fail++; }
        if (i < stuck.length - 1) await new Promise(r => setTimeout(r, throttle));
      }
      toast.success(`${ok} ok · ${fail} falha`, { id: tId });
    } finally { setRunning(false); reload(); }
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <Button variant="ghost" size="sm" onClick={onBack} className="gap-1">
          <ArrowLeft className="w-4 h-4" /> Voltar para histórico
        </Button>
        <div className="text-xs text-muted-foreground">
          Lote: <strong className="text-foreground">{batch.name}</strong>
          {' · '}criado em {new Date(batch.created_at).toLocaleString('pt-BR')}
        </div>
      </div>
      <BatchProgressTable
        simulations={simulations}
        batch={meta}
        parcelas={parcelas}
        lastUpdateAt={lastUpdateAt}
        maxAutoRetry={v8Settings?.max_auto_retry_attempts ?? 6}
        retryMinBackoffSeconds={v8Settings?.retry_min_backoff_seconds ?? 8}
        awaitingManualSim={awaitingManualSim}
        showManualWarning={false}
        onCheckStatus={() => {}}
        onResumeBatch={async () => { await togglePause(); }}
        actionsSlot={
          <BatchActionsBar
            running={running}
            showManualWarning={false}
            awaitingManualSim={awaitingManualSim}
            onSimulateSelected={handleSimulateSelected}
            onReplayPending={handleReplayPending}
            onCancelBatch={handleCancelBatch}
            onCancelBatchHard={handleCancelBatchHard}
            onExportCsv={() => downloadBatchCsv(simulations, batch.name)}
            exportDisabled={simulations.length === 0}
            isPaused={isPaused}
            onTogglePause={togglePause}
            onForceDispatchBatch={handleForceDispatchBatch}
            stuckCount={stuckCount}
          />
        }
      />
    </div>
  );
}
