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
import { MAX_AUTO_RETRY_ATTEMPTS } from '@/lib/v8ErrorClassification';
import { useV8Settings } from '@/hooks/useV8Settings';
import { useV8BatchOperations } from '@/hooks/useV8BatchOperations';
import BatchCreatePanel from './nova-simulacao/BatchCreatePanel';
import BatchProgressTable from './nova-simulacao/BatchProgressTable';
import BatchActionsBar from './nova-simulacao/BatchActionsBar';

const DEFAULT_PARCEL_OPTIONS = [12, 24, 36, 48, 60, 72, 84, 96];
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

/**
 * Orquestrador da aba "Nova Simulação".
 * UI delegada para src/components/v8/nova-simulacao/* e lógica de lote
 * para useV8BatchOperations. Aqui ficam apenas: estado, derivados, persistência
 * de rascunho e auto-simulate (que depende de estado local).
 */
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

  const ops = useV8BatchOperations({
    configId, parcelas, simulationMode, simulationValue, batchName,
    pasteAnalysis, blockingIssues, configs, v8Settings, simulations,
    activeBatchId, setActiveBatchId,
    maxAutoRetry, minBackoffMs, maxBackoffMs, backgroundRetryEnabled,
  });

  // Auto-simulação após consulta (depende de estado local + ops)
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
      let ok = 0;
      let fail = 0;
      for (let i = 0; i < candidates.length; i++) {
        const sim: any = candidates[i];
        try {
          const { data, error } = await supabase.functions.invoke('v8-clt-api', {
            body: {
              action: 'simulate_only_for_consult',
              params: {
                simulation_id: sim.id, consult_id: sim.consult_id,
                config_id: sim.config_id || configId,
                parcelas: parcelas || sim.installments,
              },
            },
          });
          if (error || data?.success === false) fail += 1; else ok += 1;
        } catch (err) {
          fail += 1;
          console.error('[auto-simulate] erro', sim.cpf, err);
        }
        if (i < candidates.length - 1) await new Promise((r) => setTimeout(r, throttle));
      }
      if (ok + fail > 0) {
        toast.success(
          `🤖 Auto-simulação: ${ok} disparada(s)${fail ? ` · ${fail} falha(s)` : ''}`,
          { description: 'Aguarde os resultados aparecerem na tabela (via webhook).' },
        );
      }
    })();
  }, [simulations, v8Settings?.auto_simulate_after_consult, activeBatchId, configId, parcelas]);

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
        running={ops.running}
        onStart={ops.handleStart}
      />

      {activeBatchId && (
        <BatchProgressTable
          simulations={simulations}
          parcelas={parcelas}
          lastUpdateAt={lastUpdateAt}
          maxAutoRetry={maxAutoRetry}
          awaitingManualSim={awaitingManualSim}
          showManualWarning={showManualWarning}
          onCheckStatus={(cpf, simId) =>
            ops.handleCheckStatus(cpf, simId, setStatusDialogData, () => setStatusDialogOpen(true))
          }
          actionsSlot={
            <BatchActionsBar
              running={ops.running}
              showManualWarning={showManualWarning}
              awaitingManualSim={awaitingManualSim}
              onSimulateSelected={ops.handleSimulateSelected}
              onRetryFailed={ops.handleRetryFailed}
              onReplayPending={ops.handleReplayPending}
              onCancelBatch={ops.handleCancelBatch}
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
