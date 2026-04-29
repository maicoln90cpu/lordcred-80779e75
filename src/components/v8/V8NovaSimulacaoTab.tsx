import { useEffect, useMemo, useState } from 'react';
import {
  Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Loader2, Plus, X, Pencil, Check, PlayCircle } from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { useV8Configs } from '@/hooks/useV8Configs';
import { queueAllDrafts, summarizeRunAll } from '@/lib/v8RunAllDrafts';
import { useV8BatchSimulations } from '@/hooks/useV8Batches';
import { analyzeV8Paste } from '@/lib/v8Parser';
import { MAX_AUTO_RETRY_ATTEMPTS } from '@/lib/v8ErrorClassification';
import { useV8Settings } from '@/hooks/useV8Settings';
import { useV8BatchOperations } from '@/hooks/useV8BatchOperations';
import BatchCreatePanel from './nova-simulacao/BatchCreatePanel';
import BatchProgressTable from './nova-simulacao/BatchProgressTable';
import BatchActionsBar from './nova-simulacao/BatchActionsBar';
import ScheduledBatchesPanel from './nova-simulacao/ScheduledBatchesPanel';
import QueuedBatchesPanel from './nova-simulacao/QueuedBatchesPanel';
import { downloadBatchCsv } from '@/lib/v8BatchExport';
import { Input } from '@/components/ui/input';
import { loadDrafts, saveDrafts, emptyDraft, type V8DraftSlot, type SimulationMode } from '@/lib/v8DraftSlots';

const DEFAULT_PARCEL_OPTIONS = [12, 24, 36, 48, 60, 72, 84, 96];

/**
 * Orquestrador da aba "Nova Simulação".
 * Etapa 4 (item 10): suporta múltiplos rascunhos (slots) e enfileiramento de lotes.
 */
export default function V8NovaSimulacaoTab() {
  const { configs, refreshing, refreshFromV8 } = useV8Configs();
  const { settings: v8Settings, save: saveV8Settings } = useV8Settings();

  // Multi-slots de rascunho. Cada slot tem seu próprio formulário + lote ativo.
  const _initial = useMemo(() => loadDrafts(), []);
  const [drafts, setDrafts] = useState<V8DraftSlot[]>(_initial.drafts);
  const [activeId, setActiveId] = useState<string>(_initial.activeId);
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState('');
  const active = drafts.find((d) => d.id === activeId) ?? drafts[0];

  function patchActive(patch: Partial<V8DraftSlot>) {
    setDrafts((prev) => prev.map((d) => (d.id === activeId ? { ...d, ...patch } : d)));
  }
  function addSlot() {
    if (drafts.length >= 6) { toast.warning('Máximo 6 rascunhos simultâneos'); return; }
    const next = emptyDraft(`Rascunho ${drafts.length + 1}`);
    setDrafts((prev) => [...prev, next]);
    setActiveId(next.id);
  }
  function removeSlot(id: string) {
    if (drafts.length === 1) { toast.warning('Mantenha pelo menos 1 rascunho'); return; }
    const slot = drafts.find((d) => d.id === id);
    if (slot?.activeBatchId) {
      if (!window.confirm('Este rascunho tem um lote ativo. Remover mesmo assim? (o lote continua no banco)')) return;
    }
    const next = drafts.filter((d) => d.id !== id);
    setDrafts(next);
    if (activeId === id) setActiveId(next[0].id);
  }
  function commitRename(id: string) {
    const v = renameValue.trim();
    if (v) setDrafts((prev) => prev.map((d) => (d.id === id ? { ...d, label: v } : d)));
    setRenamingId(null);
  }

  useEffect(() => { saveDrafts(drafts, activeId); }, [drafts, activeId]);

  // Aliases p/ não reescrever o resto do componente.
  const batchName = active.batchName;
  const setBatchName = (v: string) => patchActive({ batchName: v });
  const configId = active.configId;
  const setConfigId = (v: string) => patchActive({ configId: v });
  const parcelas = active.parcelas;
  const setParcelas = (v: number) => patchActive({ parcelas: v });
  const simulationMode = active.simulationMode;
  const setSimulationMode = (v: SimulationMode) => patchActive({ simulationMode: v });
  const simulationValue = active.simulationValue;
  const setSimulationValue = (v: string) => patchActive({ simulationValue: v });
  const pasteText = active.pasteText;
  const setPasteText = (v: string) => patchActive({ pasteText: v });
  const activeBatchId = active.activeBatchId;
  const setActiveBatchId = (v: string | null) => patchActive({ activeBatchId: v });

  const [statusDialogOpen, setStatusDialogOpen] = useState(false);
  const [statusDialogData, setStatusDialogData] = useState<{ cpf: string; loading: boolean; result: any | null; error: string | null }>({ cpf: '', loading: false, result: null, error: null });

  // Etapa 2 (item 6): estado de pausa do lote ativo (lido com realtime).
  const [activeBatchPaused, setActiveBatchPaused] = useState(false);
  useEffect(() => {
    if (!activeBatchId) { setActiveBatchPaused(false); return; }
    let cancelled = false;
    const load = async () => {
      const { data } = await supabase
        .from('v8_batches')
        .select('is_paused')
        .eq('id', activeBatchId)
        .maybeSingle();
      if (!cancelled) setActiveBatchPaused(!!(data as any)?.is_paused);
    };
    load();
    const ch = supabase
      .channel(`v8-batch-paused-${activeBatchId}`)
      .on('postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'v8_batches', filter: `id=eq.${activeBatchId}` },
        (payload: any) => setActiveBatchPaused(!!payload.new?.is_paused),
      )
      .subscribe();
    return () => { cancelled = true; supabase.removeChannel(ch); };
  }, [activeBatchId]);

  const togglePause = async () => {
    if (!activeBatchId) return;
    const next = !activeBatchPaused;
    const { data: { user } } = await supabase.auth.getUser();
    const { error } = await supabase
      .from('v8_batches')
      .update({
        is_paused: next,
        paused_at: next ? new Date().toISOString() : null,
        paused_by: next ? user?.id ?? null : null,
      })
      .eq('id', activeBatchId);
    if (error) { toast.error('Não foi possível alterar a pausa: ' + error.message); return; }
    setActiveBatchPaused(next);
    toast.success(next ? '⏸ Lote pausado — cron e auto-retry vão pular este lote' : '▶ Lote retomado');
  };

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

  // Etapa 2 (item 4): default = máximo de parcelas permitido pela tabela.
  // Se o operador não abriu "Opções avançadas", sempre usamos o teto.
  useEffect(() => {
    if (parcelOptions.length > 0 && !parcelOptions.includes(parcelas)) {
      setParcelas(Math.max(...parcelOptions));
    }
  }, [parcelOptions, parcelas]);

  const ops = useV8BatchOperations({
    configId, parcelas, simulationMode, simulationValue, batchName,
    pasteAnalysis, blockingIssues, configs, v8Settings, simulations,
    activeBatchId, setActiveBatchId,
    maxAutoRetry, minBackoffMs, maxBackoffMs, backgroundRetryEnabled,
  });

  // FIX abr/2026: isola o "Processando..." por rascunho.
  // Antes: ops.running era global, então iniciar o Rascunho 1 travava o botão do Rascunho 2.
  // Agora: guardamos qual draft disparou; só esse vê running=true.
  const [runningDraftId, setRunningDraftId] = useState<string | null>(null);
  const isThisDraftRunning = ops.running && runningDraftId === activeId;
  const wrappedStart = async () => {
    setRunningDraftId(activeId);
    try { await ops.handleStart(); }
    finally { setRunningDraftId(null); }
  };

  // Auto-simulação após consulta (depende de estado local + ops)
  const [autoSimQueue, setAutoSimQueue] = useState<Set<string>>(new Set());
  useEffect(() => {
    if (!v8Settings?.auto_simulate_after_consult || !activeBatchId || !configId) return;
    if (activeBatchPaused) return; // Etapa 2 (item 6): respeita pausa do lote.
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
          if (error || data?.success === false) {
            fail += 1;
            // FIX 4: garante que o motivo aparece na UI mesmo se o backend não gravou
            // (camada extra de segurança — caso a invoke retorne erro de rede/timeout).
            const reason = data?.user_message || data?.detail || data?.title
              || data?.error || error?.message || 'Erro ao chamar simulação V8';
            try {
              await supabase.from('v8_simulations').update({
                simulate_status: 'failed',
                simulate_error_message: String(reason),
                simulate_attempted_at: new Date().toISOString(),
              }).eq('id', sim.id);
            } catch { /* ignore */ }
          } else {
            ok += 1;
          }
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
  }, [simulations, v8Settings?.auto_simulate_after_consult, activeBatchId, configId, parcelas, activeBatchPaused]);

  const awaitingManualSim = simulations.filter(
    (s: any) => s.status === 'success' && (s.simulate_status ?? 'not_started') === 'not_started',
  ).length;
  const autoOn = !!v8Settings?.auto_simulate_after_consult;
  const showManualWarning = !autoOn && awaitingManualSim > 0;

  // Etapa 3 (item 7): handler de agendamento. Cria o lote em status='scheduled'.
  // O launcher (pg_cron) materializa as simulações e dispara as consultas no horário.
  async function handleSchedule(scheduledForIso: string) {
    const rows = pasteAnalysis.rows;
    if (rows.length === 0) { toast.error('Cole pelo menos 1 CPF válido'); return; }
    if (blockingIssues.length > 0) { toast.error(`Corrija ${blockingIssues.length} linha(s) inválida(s) antes de agendar`); return; }
    if (!configId) { toast.error('Escolha uma tabela'); return; }
    if (!batchName.trim()) { toast.error('Dê um nome ao lote'); return; }

    const cfgLabel = configs.find((c) => c.config_id === configId)?.name;
    const numericValue = simulationMode !== 'none' && simulationValue.trim()
      ? Number(simulationValue.replace(',', '.'))
      : null;

    const { data, error } = await supabase.functions.invoke('v8-clt-api', {
      body: {
        action: 'schedule_batch',
        params: {
          name: batchName.trim(),
          config_id: configId,
          config_label: cfgLabel,
          parcelas,
          rows,
          scheduled_for: scheduledForIso,
          strategy: v8Settings?.simulation_strategy ?? 'webhook_only',
          simulation_mode: simulationMode,
          simulation_value: numericValue,
        },
      },
    });
    if (error || !data?.success) {
      toast.error('Falha ao agendar: ' + (data?.error || error?.message || 'erro desconhecido'));
      return;
    }
    const when = new Date(scheduledForIso);
    toast.success(
      `📅 Lote agendado para ${when.toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' })}`,
      { description: 'O lote começa sozinho na hora marcada (verificação a cada 1 min).' },
    );
    // Limpa o rascunho local — lote agendado já está persistido no banco.
    setPasteText('');
    setBatchName('');
  }

  // Etapa 4 (item 10): handler de enfileiramento. Cria o lote em status='queued'.
  // O launcher promove queued→scheduled quando o operador não tem nenhum lote ativo.
  async function handleQueue() {
    const rows = pasteAnalysis.rows;
    if (rows.length === 0) { toast.error('Cole pelo menos 1 CPF válido'); return; }
    if (blockingIssues.length > 0) { toast.error(`Corrija ${blockingIssues.length} linha(s) inválida(s) antes de enfileirar`); return; }
    if (!configId) { toast.error('Escolha uma tabela'); return; }
    if (!batchName.trim()) { toast.error('Dê um nome ao lote'); return; }

    const cfgLabel = configs.find((c) => c.config_id === configId)?.name;
    const numericValue = simulationMode !== 'none' && simulationValue.trim()
      ? Number(simulationValue.replace(',', '.'))
      : null;

    const { data, error } = await supabase.functions.invoke('v8-clt-api', {
      body: {
        action: 'queue_batch',
        params: {
          name: batchName.trim(),
          config_id: configId,
          config_label: cfgLabel,
          parcelas,
          rows,
          strategy: v8Settings?.simulation_strategy ?? 'webhook_only',
          simulation_mode: simulationMode,
          simulation_value: numericValue,
        },
      },
    });
    if (error || !data?.success) {
      toast.error('Falha ao enfileirar: ' + (data?.error || error?.message || 'erro desconhecido'));
      return;
    }
    toast.success(
      `📋 Lote enfileirado na posição #${data?.data?.queue_position ?? '?'}`,
      { description: 'Começa sozinho assim que o lote atual terminar (verificação a cada 1 min).' },
    );
    setPasteText('');
    setBatchName('');
  }

  // Etapa 1 (item 1, abr/2026): "Executar todos em sequência".
  // Enfileira cada rascunho válido. O primeiro vira 'scheduled' (roda já),
  // os demais ficam em 'queued' e o launcher promove um por vez.
  const [runAllBusy, setRunAllBusy] = useState(false);
  async function handleRunAllDrafts() {
    if (runAllBusy) return;
    const eligible = drafts.filter((d) => d.pasteText.trim() && d.batchName.trim() && d.configId);
    if (eligible.length === 0) {
      toast.error('Nenhum rascunho preenchido (precisa de nome, tabela e CPFs).');
      return;
    }
    if (!window.confirm(
      `Vou enfileirar ${eligible.length} rascunho(s) em sequência.\n\n` +
      `O 1º começa imediatamente; os demais começam sozinhos quando o anterior terminar (verificação a cada 1 min).\n\nConfirmar?`,
    )) return;
    setRunAllBusy(true);
    try {
      const results = await queueAllDrafts({
        drafts,
        configs,
        strategy: v8Settings?.simulation_strategy ?? 'webhook_only',
      });
      const summary = summarizeRunAll(results);
      const skippedDetail = results
        .filter((r) => r.status !== 'queued')
        .map((r) => `• ${r.label}: ${r.reason}`)
        .join('\n');
      if (summary.queued > 0) {
        toast.success(`▶ Sequência iniciada: ${summary.text}`, {
          description: skippedDetail || 'Acompanhe abaixo na "Fila de execução".',
          duration: 8000,
        });
      } else {
        toast.error(`Nada enfileirado: ${summary.text}`, { description: skippedDetail });
      }
    } finally {
      setRunAllBusy(false);
    }
  }

  return (
    <div className="space-y-4">
      <div className="rounded-md border border-blue-300 bg-blue-50 dark:border-blue-800 dark:bg-blue-950/30 px-3 py-2 text-xs text-blue-900 dark:text-blue-200">
        ℹ️ <strong>Como funciona:</strong> esta aba envia simulações <em>com os parâmetros que você definiu</em> (tabela, prazo, valor). Se a margem do CPF for menor do que o pedido, a V8 retorna <strong>falha</strong> — é o comportamento esperado. Para encontrar automaticamente a melhor combinação valor × prazo dentro da margem disponível, use o botão <strong>"Encontrar proposta viável"</strong> dentro de <strong>Operações</strong> (após uma consulta com sucesso).
      </div>
      {/* Etapa 4 (item 10): tabs de rascunhos — cada slot mantém formulário e lote ativo independentes. */}
      <div className="flex items-center gap-1 flex-wrap border-b border-border pb-2">
        {drafts.map((d) => {
          const isActive = d.id === activeId;
          const isRenaming = renamingId === d.id;
          return (
            <div
              key={d.id}
              className={`group flex items-center gap-1 rounded-t-md px-2 py-1.5 text-xs border-t border-l border-r ${
                isActive
                  ? 'bg-background border-border font-medium'
                  : 'bg-muted/40 border-transparent text-muted-foreground hover:bg-muted/70 cursor-pointer'
              }`}
              onClick={() => !isRenaming && setActiveId(d.id)}
            >
              {isRenaming ? (
                <>
                  <Input
                    autoFocus value={renameValue}
                    onChange={(e) => setRenameValue(e.target.value)}
                    onKeyDown={(e) => { if (e.key === 'Enter') commitRename(d.id); if (e.key === 'Escape') setRenamingId(null); }}
                    className="h-6 w-32 text-xs"
                  />
                  <button onClick={(e) => { e.stopPropagation(); commitRename(d.id); }} className="text-emerald-600">
                    <Check className="w-3.5 h-3.5" />
                  </button>
                </>
              ) : (
                <>
                  <span>{d.label}</span>
                  {d.activeBatchId && <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" title="Lote ativo" />}
                  {isActive && (
                    <button
                      onClick={(e) => { e.stopPropagation(); setRenamingId(d.id); setRenameValue(d.label); }}
                      className="opacity-50 hover:opacity-100"
                      title="Renomear"
                    >
                      <Pencil className="w-3 h-3" />
                    </button>
                  )}
                  {drafts.length > 1 && (
                    <button
                      onClick={(e) => { e.stopPropagation(); removeSlot(d.id); }}
                      className="opacity-50 hover:opacity-100 hover:text-destructive"
                      title="Remover rascunho"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  )}
                </>
              )}
            </div>
          );
        })}
        <Button variant="ghost" size="sm" onClick={addSlot} className="h-7 text-xs">
          <Plus className="w-3.5 h-3.5 mr-1" /> Novo rascunho
        </Button>
        {drafts.length > 1 && (
          <Button
            variant="default"
            size="sm"
            onClick={handleRunAllDrafts}
            disabled={runAllBusy}
            className="h-7 text-xs ml-auto gap-1.5"
            title="Enfileira cada rascunho. O 1º começa já; os demais começam sozinhos quando o anterior terminar."
          >
            {runAllBusy
              ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
              : <PlayCircle className="w-3.5 h-3.5" />}
            ▶ Executar todos em sequência ({drafts.length})
          </Button>
        )}
      </div>

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
        running={isThisDraftRunning}
        onStart={wrappedStart}
        onSchedule={handleSchedule}
        onQueue={handleQueue}
      />

      <QueuedBatchesPanel />
      <ScheduledBatchesPanel />

      {activeBatchId && activeBatchPaused && (
        <div className="rounded-lg border border-amber-300 bg-amber-50 dark:border-amber-700 dark:bg-amber-950/40 px-3 py-2 text-sm text-amber-900 dark:text-amber-200 flex items-center justify-between">
          <span>⏸ <strong>Lote pausado.</strong> Cron de retry e poller automático estão ignorando este lote. Ações manuais ainda funcionam.</span>
        </div>
      )}

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
              onExportCsv={() => downloadBatchCsv(simulations, batchName)}
              exportDisabled={simulations.length === 0}
              isPaused={activeBatchPaused}
              onTogglePause={togglePause}
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
