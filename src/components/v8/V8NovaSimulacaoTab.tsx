import { useEffect, useMemo, useState } from 'react';
import {
  Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import { Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { useV8Configs } from '@/hooks/useV8Configs';
import { useV8BatchSimulations } from '@/hooks/useV8Batches';
import { analyzeV8Paste } from '@/lib/v8Parser';
import { isRetriableErrorKind, shouldAutoRetry, MAX_AUTO_RETRY_ATTEMPTS } from '@/lib/v8ErrorClassification';
import { useV8Settings } from '@/hooks/useV8Settings';
import BatchCreatePanel from './nova-simulacao/BatchCreatePanel';
import BatchProgressTable from './nova-simulacao/BatchProgressTable';
import BatchActionsBar from './nova-simulacao/BatchActionsBar';

const DEFAULT_PARCEL_OPTIONS = [12, 24, 36, 48, 60, 72, 84, 96];
const MAX_CONCURRENCY = 3;
const STORAGE_KEY = 'v8:nova-simulacao:draft';

type SimulationMode = 'none' | 'disbursed_amount' | 'installment_face_value';
type V8Draft = {
  batchName: string; configId: string; parcelas: number;
  simulationMode: SimulationMode; simulationValue: string;
  pasteText: string; activeBatchId: string | null;
};

function loadDraft(): Partial<V8Draft> {
  try {
    const raw = typeof window !== 'undefined' ? window.localStorage.getItem(STORAGE_KEY) : null;
    return raw ? JSON.parse(raw) : {};
  } catch { return {}; }
}

export default function V8NovaSimulacaoTab() {
  const { configs, refreshing, refreshFromV8 } = useV8Configs();
  const { settings: v8Settings, save: saveV8Settings } = useV8Settings();
  const _draft = useMemo(() => loadDraft(), []);
  const [batchName, setBatchName] = useState(_draft.batchName ?? '');
  const [configId, setConfigId] = useState(_draft.configId ?? '');
  const [parcelas, setParcelas] = useState<number>(_draft.parcelas ?? 24);
  const [simulationMode, setSimulationMode] = useState<SimulationMode>(_draft.simulationMode ?? 'none');
  const [simulationValue, setSimulationValue] = useState(_draft.simulationValue ?? '');
  const [pasteText, setPasteText] = useState(_draft.pasteText ?? '');
  const [activeBatchId, setActiveBatchId] = useState<string | null>(_draft.activeBatchId ?? null);
  const [running, setRunning] = useState(false);

  useEffect(() => {
    try {
      const draft: V8Draft = { batchName, configId, parcelas, simulationMode, simulationValue, pasteText, activeBatchId };
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(draft));
    } catch {}
  }, [batchName, configId, parcelas, simulationMode, simulationValue, pasteText, activeBatchId]);

  const [statusDialogOpen, setStatusDialogOpen] = useState(false);
  const [statusDialogData, setStatusDialogData] = useState<{ cpf: string; loading: boolean; result: any | null; error: string | null }>({ cpf: '', loading: false, result: null, error: null });

  const maxAutoRetry = v8Settings?.max_auto_retry_attempts ?? MAX_AUTO_RETRY_ATTEMPTS;
  const minBackoffMs = (v8Settings?.retry_min_backoff_seconds ?? 10) * 1000;
  const maxBackoffMs = (v8Settings?.retry_max_backoff_seconds ?? 120) * 1000;
  const backgroundRetryEnabled = v8Settings?.background_retry_enabled ?? true;

  const { simulations, lastUpdateAt } = useV8BatchSimulations(activeBatchId);
  const pasteAnalysis = useMemo(() => analyzeV8Paste(pasteText), [pasteText]);
  const invalidDateIssue = pasteAnalysis.issues.find((i) => i.code === 'invalid_date');
  const blockingIssues = pasteAnalysis.issues.filter(
    (i) => i.code === 'invalid_date' || i.code === 'invalid_format' || i.code === 'missing_birth_date',
  );

  const selectedConfig = useMemo(
    () => configs.find((c) => c.config_id === configId) ?? null,
    [configs, configId],
  );

  const parcelOptions = useMemo<number[]>(() => {
    const rawOptions: number[] = Array.isArray(selectedConfig?.raw_data?.number_of_installments)
      ? selectedConfig.raw_data.number_of_installments
          .map((v: string | number) => Number(v))
          .filter((v: number) => Number.isInteger(v) && v > 0)
      : [];
    if (rawOptions.length > 0) return [...new Set<number>(rawOptions)].sort((a, b) => a - b);
    if (selectedConfig?.min_term != null && selectedConfig?.max_term != null) {
      const ranged = DEFAULT_PARCEL_OPTIONS.filter(
        (v) => v >= Number(selectedConfig.min_term) && v <= Number(selectedConfig.max_term),
      );
      if (ranged.length > 0) return ranged;
    }
    return DEFAULT_PARCEL_OPTIONS;
  }, [selectedConfig]);

  useEffect(() => {
    if (parcelOptions.length > 0 && !parcelOptions.includes(parcelas)) {
      setParcelas(parcelOptions[0]);
    }
  }, [parcelOptions, parcelas]);

  // Auto-simulação após consulta (toggle no UI)
  const [autoSimQueue, setAutoSimQueue] = useState<Set<string>>(new Set());
  useEffect(() => {
    if (!v8Settings?.auto_simulate_after_consult || !activeBatchId || !configId) return;
    const candidates = simulations.filter((s: any) =>
      s.status === 'success' && s.consult_id
      && (s.simulate_status ?? 'not_started') === 'not_started'
      && !autoSimQueue.has(s.id),
    );
    if (candidates.length === 0) return;
    const throttle = v8Settings?.simulate_throttle_ms ?? 1200;
    const ids = candidates.map((c) => c.id);
    setAutoSimQueue((prev) => new Set([...prev, ...ids]));
    (async () => {
      for (let i = 0; i < candidates.length; i++) {
        const sim: any = candidates[i];
        try {
          await supabase.functions.invoke('v8-clt-api', {
            body: {
              action: 'simulate_only_for_consult',
              params: {
                simulation_id: sim.id,
                consult_id: sim.consult_id,
                config_id: sim.config_id || configId,
                parcelas: parcelas || sim.installments,
              },
            },
          });
        } catch (err) { console.error('[auto-simulate] erro', sim.cpf, err); }
        if (i < candidates.length - 1) await new Promise((r) => setTimeout(r, throttle));
      }
    })();
  }, [simulations, v8Settings?.auto_simulate_after_consult, activeBatchId, configId, parcelas]);

  async function handleCheckStatus(cpf: string, simulationId?: string) {
    setStatusDialogOpen(true);
    setStatusDialogData({ cpf, loading: true, result: null, error: null });
    try {
      const { data, error } = await supabase.functions.invoke('v8-clt-api', {
        body: { action: 'check_consult_status', params: { cpf } },
      });
      if (error) throw error;
      if (!data?.success) {
        setStatusDialogData({ cpf, loading: false, result: null, error: data?.user_message || data?.error || 'Falha ao consultar' });
        return;
      }
      setStatusDialogData({ cpf, loading: false, result: data.data, error: null });
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
      setStatusDialogData({ cpf, loading: false, result: null, error: err?.message || String(err) });
    }
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
    const normalizedSimulationValue = simulationMode === 'none' ? 0 : Number(simulationValue.replace(',', '.'));
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
                  simulation_value: simulationMode === 'none' ? undefined : normalizedSimulationValue,
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
    if (blockingIssues.length > 0) {
      toast.error(`Corrija ${blockingIssues.length} linha(s) inválida(s) antes de enviar o lote`); return;
    }
    if (!configId) { toast.error('Escolha uma tabela'); return; }
    if (!batchName.trim()) { toast.error('Dê um nome ao lote'); return; }
    const hasValueInput = simulationValue.trim().length > 0;
    const wantsValue = simulationMode !== 'none';
    if (wantsValue && (!hasValueInput || !Number.isFinite(Number(simulationValue.replace(',', '.'))) || Number(simulationValue.replace(',', '.')) <= 0)) {
      toast.error('Informe um valor válido para a simulação ou escolha "Sem valor (V8 decide)"'); return;
    }

    setRunning(true);
    const cfgLabel = configs.find((c) => c.config_id === configId)?.name;
    const normalizedSimulationValue = simulationMode === 'none' ? 0 : Number(simulationValue.replace(',', '.'));
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
      toast.success(`Lote criado com ${data.data.total} CPFs. Iniciando (estratégia: ${strategy})...`);

      const { data: sims } = await supabase
        .from('v8_simulations').select('id, cpf, name, birth_date')
        .eq('batch_id', batchId).order('created_at', { ascending: true });
      if (!sims) throw new Error('Falha ao carregar simulações');

      if (strategy === 'webhook_only') {
        for (let i = 0; i < sims.length; i++) {
          const sim = sims[i];
          try {
            const parsedRow = rows.find((r) => r.cpf === sim.cpf);
            await supabase.functions.invoke('v8-clt-api', {
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
            pendingCount += 1;
          } catch (err) { console.error('Sim err', sim.cpf, err); }
          if (i < sims.length - 1) await new Promise((r) => setTimeout(r, throttleMs));
        }
        toast.success(
          `Lote disparado: ${pendingCount} consulta(s) aguardando webhook V8. Os valores aparecem em ~10–30s por CPF.`,
          { duration: 8000 },
        );
      } else {
        let idx = 0;
        const workers = Array.from({ length: MAX_CONCURRENCY }, async () => {
          while (idx < sims.length) {
            const myIdx = idx++; const sim = sims[myIdx];
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
                    simulation_value: simulationMode === 'none' ? undefined : normalizedSimulationValue,
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
        await runAutoRetryLoop(batchId, rows, normalizedSimulationValue);
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
    const normalizedSimulationValue = simulationMode === 'none' ? 0 : Number(simulationValue.replace(',', '.'));
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
                simulation_value: simulationMode === 'none' ? undefined : normalizedSimulationValue,
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

  async function runAutoRetryLoop(batchId: string, rows: ReturnType<typeof analyzeV8Paste>['rows'], normalizedSimulationValue: number) {
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
                  simulation_value: simulationMode === 'none' ? undefined : normalizedSimulationValue,
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
    try {
      const { data, error } = await supabase.functions.invoke('v8-webhook', {
        body: { action: 'replay_pending', limit: 500, batch_id: activeBatchId },
      });
      if (error) throw error;
      toast.success(`Resultados pendentes buscados: ${data?.success ?? 0} ok · ${data?.failed ?? 0} falhas (de ${data?.total ?? 0})`);
    } catch (e: any) {
      toast.error(`Falha ao buscar pendentes: ${e?.message || e}`);
    }
  }

  async function handleCancelBatch() {
    if (!activeBatchId) return;
    const pending = simulations.filter((s: any) => s.status === 'pending').length;
    const ok = window.confirm(
      `Cancelar este lote?\n\n` +
      `• ${pending} consulta(s) pendente(s) serão marcadas como FALHA (cancelado).\n` +
      `• Os crons de retry e poller vão ignorar este lote a partir de agora.\n` +
      `• Resultados já recebidos (success) serão preservados.\n\n` +
      `Esta ação NÃO pode ser desfeita.`,
    );
    if (!ok) return;
    try {
      const { data, error } = await supabase.functions.invoke('v8-clt-api', {
        body: { action: 'cancel_batch', batch_id: activeBatchId },
      });
      if (error) throw error;
      toast.success(`Lote cancelado · ${data?.canceled ?? 0} pendente(s) marcadas como falha.`);
    } catch (e: any) {
      toast.error(`Falha ao cancelar lote: ${e?.message || e}`);
    }
  }

  const awaitingManualSim = simulations.filter(
    (s: any) => s.status === 'success' && (s.simulate_status ?? 'not_started') === 'not_started',
  ).length;
  const autoOn = !!v8Settings?.auto_simulate_after_consult;
  const showManualWarning = !autoOn && awaitingManualSim > 0;

  return (
    <div className="space-y-4">
      <BatchCreatePanel
        batchName={batchName} setBatchName={setBatchName}
        configId={configId} setConfigId={setConfigId}
        parcelas={parcelas} setParcelas={setParcelas}
        simulationMode={simulationMode} setSimulationMode={setSimulationMode}
        simulationValue={simulationValue} setSimulationValue={setSimulationValue}
        pasteText={pasteText} setPasteText={setPasteText}
        configs={configs}
        parcelOptions={parcelOptions}
        selectedConfig={selectedConfig}
        refreshing={refreshing}
        refreshFromV8={refreshFromV8}
        pasteAnalysis={pasteAnalysis}
        blockingIssues={blockingIssues}
        invalidDateIssue={invalidDateIssue}
        autoSimulate={v8Settings?.auto_simulate_after_consult ?? false}
        onToggleAutoSimulate={(v) => saveV8Settings({ auto_simulate_after_consult: v })}
        v8SettingsLoaded={!!v8Settings}
        running={running}
        onStart={handleStart}
      />

      {activeBatchId && (
        <BatchProgressTable
          simulations={simulations}
          parcelas={parcelas}
          lastUpdateAt={lastUpdateAt}
          maxAutoRetry={maxAutoRetry}
          awaitingManualSim={awaitingManualSim}
          showManualWarning={showManualWarning}
          onCheckStatus={handleCheckStatus}
          actionsSlot={
            <BatchActionsBar
              running={running}
              showManualWarning={showManualWarning}
              awaitingManualSim={awaitingManualSim}
              onSimulateSelected={handleSimulateSelected}
              onRetryFailed={handleRetryFailed}
              onReplayPending={handleReplayPending}
              onCancelBatch={handleCancelBatch}
            />
          }
        />
      )}

      <Dialog open={statusDialogOpen} onOpenChange={setStatusDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Status da consulta na V8</DialogTitle>
            <DialogDescription>
              CPF: <span className="font-mono">{statusDialogData.cpf}</span>
            </DialogDescription>
          </DialogHeader>
          {statusDialogData.loading ? (
            <div className="flex items-center gap-2 text-sm text-muted-foreground py-4">
              <Loader2 className="w-4 h-4 animate-spin" /> Buscando na V8...
            </div>
          ) : statusDialogData.error ? (
            <div className="text-sm text-destructive whitespace-pre-line">{statusDialogData.error}</div>
          ) : statusDialogData.result?.found === false ? (
            <div className="text-sm text-muted-foreground">{statusDialogData.result.message}</div>
          ) : statusDialogData.result?.latest ? (
            <div className="space-y-2 text-sm">
              <div><strong>Status:</strong> {statusDialogData.result.latest.status ?? '—'}</div>
              <div><strong>Nome:</strong> {statusDialogData.result.latest.name ?? '—'}</div>
              <div><strong>Criada em:</strong> {statusDialogData.result.latest.createdAt ? new Date(statusDialogData.result.latest.createdAt).toLocaleString('pt-BR') : '—'}</div>
              {statusDialogData.result.latest.detail && (
                <div className="text-muted-foreground">{statusDialogData.result.latest.detail}</div>
              )}
              {statusDialogData.result.consults?.length > 1 && (
                <details className="mt-2">
                  <summary className="cursor-pointer text-xs text-muted-foreground">
                    Ver todas as {statusDialogData.result.consults.length} consultas
                  </summary>
                  <ul className="mt-2 space-y-1 text-xs">
                    {statusDialogData.result.consults.map((c: any) => (
                      <li key={c.consultId} className="border rounded p-2">
                        <div><strong>{c.status}</strong> · {c.createdAt ? new Date(c.createdAt).toLocaleString('pt-BR') : '—'}</div>
                        {c.detail && <div className="text-muted-foreground">{c.detail}</div>}
                      </li>
                    ))}
                  </ul>
                </details>
              )}
            </div>
          ) : (
            <div className="text-sm text-muted-foreground">Sem dados.</div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
