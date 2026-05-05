import { useEffect, useMemo, useState } from 'react';
import {
  Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Loader2, Plus, X, Pencil, Check, PlayCircle, ChevronDown, Zap, ListOrdered } from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { useV8Configs } from '@/hooks/useV8Configs';
import { queueAllDrafts, summarizeRunAll, type RunAllItemResult, type RunAllMode } from '@/lib/v8RunAllDrafts';
import {
  DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator,
} from '@/components/ui/dropdown-menu';
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
import BatchHistoryPanel from './nova-simulacao/BatchHistoryPanel';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { downloadBatchCsv } from '@/lib/v8BatchExport';
import { Input } from '@/components/ui/input';
import { loadDrafts, saveDrafts, emptyDraft, loadDraftBatchMap, addDraftBatchEntry, removeDraftBatchByBatchId, type V8DraftSlot, type SimulationMode } from '@/lib/v8DraftSlots';
import { triggerLauncherShortLoop } from '@/lib/v8LauncherTrigger';

const DEFAULT_PARCEL_OPTIONS = [12, 24, 36, 48, 60, 72, 84, 96];

/**
 * Orquestrador da aba "Nova Simulação".
 * Etapa 4 (item 10): suporta múltiplos rascunhos (slots) e enfileiramento de lotes.
 */
export default function V8NovaSimulacaoTab() {
  const { configs, refreshing, refreshFromV8 } = useV8Configs();
  const { settings: v8Settings, save: saveV8Settings } = useV8Settings();

  // Multi-slots de rascunho. Cada slot tem seu próprio formulário + lote ativo.
  const _initial = useMemo(() => {
    const loaded = loadDrafts();
    // Restaurar activeBatchId do mapa persistido (sobrevive a refresh)
    const batchMap = loadDraftBatchMap();
    const restoredDrafts = loaded.drafts.map(d => {
      if (!d.activeBatchId && batchMap[d.id]) {
        return { ...d, activeBatchId: batchMap[d.id] };
      }
      return d;
    });
    return { drafts: restoredDrafts, activeId: loaded.activeId };
  }, []);
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

  // AUTO-SWITCH: Quando um batch da fila muda para 'processing', encontra o rascunho
  // correspondente (via mapa localStorage ou batchName) e troca a aba + associa activeBatchId.
  // Quando um batch completa/cancela, limpa o activeBatchId do rascunho e remove do mapa.
  useEffect(() => {
    let cancelled = false;
    const ch = supabase
      .channel('v8-auto-switch-tab')
      .on('postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'v8_batches' },
        (payload: any) => {
          if (cancelled) return;
          const newStatus = payload.new?.status;
          const batchName = payload.new?.name;
          const batchId = payload.new?.id;
          
          if (newStatus === 'processing' && batchId) {
            // Primeiro tenta achar via mapa localStorage (mais confiável que batchName)
            const batchMap = loadDraftBatchMap();
            const mappedDraftId = Object.keys(batchMap).find(k => batchMap[k] === batchId);
            
            setDrafts(prev => {
              const match = mappedDraftId
                ? prev.find(d => d.id === mappedDraftId)
                : prev.find(d => d.batchName.trim() === String(batchName || '').trim() && !d.activeBatchId);
              if (!match) return prev;
              setActiveId(match.id);
              return prev.map(d => d.id === match.id ? { ...d, activeBatchId: batchId } : d);
            });
          } else if ((newStatus === 'completed' || newStatus === 'canceled') && batchId) {
            // Limpa activeBatchId do rascunho cujo lote terminou + remove do mapa
            removeDraftBatchByBatchId(batchId);
            setDrafts(prev =>
              prev.map(d => d.activeBatchId === batchId ? { ...d, activeBatchId: null } : d)
            );
          }
        },
      )
      .subscribe();
    return () => { cancelled = true; supabase.removeChannel(ch); };
  }, []);

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
  const setActiveBatchId = (v: string | null) => {
    patchActive({ activeBatchId: v });
    if (v) addDraftBatchEntry(activeId, v);
    else removeDraftBatchByBatchId(activeBatchId ?? '');
  };
  const autoBest = !!active.autoBest;
  const setAutoBest = async (v: boolean) => {
    patchActive({ autoBest: v });
    // Onda 4: persiste o flag no batch ativo para o worker em background processar.
    if (activeBatchId) {
      try {
        const { error } = await (supabase as any).rpc('v8_set_batch_auto_best', {
          _batch_id: activeBatchId,
          _enabled: v,
        });
        if (error) throw error;
        if (v) {
          toast.success('🤖 Auto-melhor ativo neste lote', {
            description: 'O sistema processa em background — funciona mesmo com a aba fechada (cron 1×/min).',
            duration: 6000,
          });
        }
      } catch (err: any) {
        toast.error(`Não foi possível atualizar Auto-melhor: ${err?.message || err}`);
      }
    }
  };

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

  const { simulations, batch: activeBatchMeta, lastUpdateAt } = useV8BatchSimulations(activeBatchId);
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

  // Etapa 3 (mai/2026): pré-seleciona a tabela "Acelera" quando o rascunho está vazio.
  // Não sobrescreve escolha manual — só age se configId estiver vazio.
  useEffect(() => {
    if (configId) return;
    if (configs.length === 0) return;
    const acelera = configs.find((c) => /acelera/i.test(c.name || ''));
    if (acelera) setConfigId(acelera.config_id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [configs, configId, activeId]);

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

  // Etapa 1 (mai/2026): nome do lote auto-gerado SEMPRE no momento do START.
  // Formato: "Lote DD/MM HH:mm — <Rascunho>". Mantém rastreabilidade nas listagens.
  // Regex detecta nomes auto-gerados (mesmo padrão) e regenera com hora atual,
  // preservando nomes personalizados pelo operador (ex.: "a", "Mailing julho").
  const AUTO_NAME_RE = /^Lote \d{2}\/\d{2} \d{2}:\d{2} — /;
  function isAutoName(name: string): boolean {
    return !name.trim() || AUTO_NAME_RE.test(name.trim());
  }
  function ensureBatchName(): string {
    const current = active.batchName.trim();
    if (current && !isAutoName(current)) return current;
    const now = new Date();
    const pad = (n: number) => String(n).padStart(2, '0');
    const auto = `Lote ${pad(now.getDate())}/${pad(now.getMonth() + 1)} ${pad(now.getHours())}:${pad(now.getMinutes())} — ${active.label}`;
    patchActive({ batchName: auto });
    return auto;
  }

  const wrappedStart = async () => {
    setRunningDraftId(activeId);
    const needsAutoName = isAutoName(active.batchName);
    if (needsAutoName) {
      ensureBatchName();
      // Aguarda 1 render para o hook receber a nova prop batchName.
      await new Promise((r) => setTimeout(r, 0));
    }
    try {
      await ops.handleStart();
      if (autoBest) {
        setTimeout(async () => {
          try {
            const id = activeBatchId;
            if (!id) return;
            await (supabase as any).rpc('v8_set_batch_auto_best', { _batch_id: id, _enabled: true });
          } catch { /* silencioso — usuário pode religar via toggle */ }
        }, 800);
      }
    } finally { setRunningDraftId(null); }
  };

  // Item 7 (abr/2026): toggle "Simular automaticamente após consulta" REMOVIDO.
  // Auto-melhor (autoBest) é o único modo automático: para cada CPF success, tenta
  // candidatos do maior pro menor até a V8 aceitar (mesma lógica do botão 🔍).
  // O modo manual continua disponível pelo botão "Simular selecionados".
  const [autoSimQueue, setAutoSimQueue] = useState<Set<string>>(new Set());
  useEffect(() => {
    if (!activeBatchId || !configId) return;
    if (activeBatchPaused) return; // Etapa 2 (item 6): respeita pausa do lote.
    if (!autoBest) return;

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
      let acceptedAutoBest = 0;
      for (let i = 0; i < candidates.length; i++) {
        const sim: any = candidates[i];
        try {
          // Importação dinâmica para não inflar o bundle inicial da aba.
          const { runAutoBestForSim } = await import('@/lib/v8AutoBest');
          const r = await runAutoBestForSim({
            id: sim.id,
            cpf: sim.cpf,
            consult_id: sim.consult_id,
            config_id: sim.config_id || configId,
            margem_valor: sim.margem_valor,
            sim_value_min: sim.sim_value_min,
            sim_value_max: sim.sim_value_max,
            sim_installments_min: sim.sim_installments_min,
            sim_installments_max: sim.sim_installments_max,
          });
          if (r.status === 'success') { ok += 1; acceptedAutoBest += 1; }
          else { fail += 1; }
        } catch (err) {
          fail += 1;
          console.error('[auto-best] erro', sim.cpf, err);
        }
        if (i < candidates.length - 1) await new Promise((r) => setTimeout(r, throttle));
      }
      if (ok + fail > 0) {
        toast.success(`🤖 Auto-melhor: ${acceptedAutoBest} aceita(s) · ${candidates.length - acceptedAutoBest} sem proposta`, {
          description: 'Cada CPF testou até 6 combinações valor × prazo. Veja os motivos na coluna "Por que falhou".',
          duration: 7000,
        });
      }
    })();
  }, [simulations, autoBest, activeBatchId, configId, parcelas, activeBatchPaused]);

  const awaitingManualSim = simulations.filter(
    (s: any) => s.status === 'success' && (s.simulate_status ?? 'not_started') === 'not_started',
  ).length;
  // Item 7 (abr/2026): com toggle removido, "modo automático" agora = autoBest.
  // Mostramos o aviso manual quando autoBest está OFF e há margens aguardando simular.
  const showManualWarning = !autoBest && awaitingManualSim > 0;

  // Etapa 3 (item 7): handler de agendamento. Cria o lote em status='scheduled'.
  // O launcher (pg_cron) materializa as simulações e dispara as consultas no horário.
  async function handleSchedule(scheduledForIso: string) {
    const rows = pasteAnalysis.rows;
    if (rows.length === 0) { toast.error('Cole pelo menos 1 CPF válido'); return; }
    if (blockingIssues.length > 0) { toast.error(`Corrija ${blockingIssues.length} linha(s) inválida(s) antes de agendar`); return; }
    if (!configId) { toast.error('Escolha uma tabela'); return; }
    const finalName = ensureBatchName();

    const cfgLabel = configs.find((c) => c.config_id === configId)?.name;
    const numericValue = simulationMode !== 'none' && simulationValue.trim()
      ? Number(simulationValue.replace(',', '.'))
      : null;

    const { data, error } = await supabase.functions.invoke('v8-clt-api', {
      body: {
        action: 'schedule_batch',
        params: {
          name: finalName,
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
    const finalName = ensureBatchName();

    const cfgLabel = configs.find((c) => c.config_id === configId)?.name;
    const numericValue = simulationMode !== 'none' && simulationValue.trim()
      ? Number(simulationValue.replace(',', '.'))
      : null;

    const { data, error } = await supabase.functions.invoke('v8-clt-api', {
      body: {
        action: 'queue_batch',
        params: {
          name: finalName,
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
  // Etapa 4 (abr/2026): pré-check de lote ativo + diálogo de relatório claro.
  const [runAllBusy, setRunAllBusy] = useState(false);
  const [runAllReport, setRunAllReport] = useState<RunAllItemResult[] | null>(null);
  // Etapa 2 (mai/2026): IDs dos lotes disparados em paralelo, p/ auto-rotação de aba.
  const [parallelBatchIds, setParallelBatchIds] = useState<string[]>([]);
  const [parallelActiveStatuses, setParallelActiveStatuses] = useState<Record<string, string>>({});

  async function handleRunAllDrafts(mode: RunAllMode = 'sequential') {
    if (runAllBusy) return;
    const now = new Date();
    const pad = (n: number) => String(n).padStart(2, '0');
    const stamp = `${pad(now.getDate())}/${pad(now.getMonth() + 1)} ${pad(now.getHours())}:${pad(now.getMinutes())}`;
    const draftsWithNames: V8DraftSlot[] = drafts.map((d) =>
      d.batchName.trim() ? d : { ...d, batchName: `Lote ${stamp} — ${d.label}` },
    );
    setDrafts(draftsWithNames);
    const eligible = draftsWithNames.filter((d) => d.pasteText.trim() && d.configId);
    if (eligible.length === 0) {
      toast.error('Nenhum rascunho preenchido', {
        description: 'Cada rascunho precisa de TABELA selecionada (em Opções avançadas) e CPFs colados.',
        duration: 8000,
      });
      return;
    }

    let confirmMsg = '';
    if (mode === 'parallel_dispatch') {
      confirmMsg =
        `⚡ MODO PARALELO\n\n` +
        `Vou disparar ${eligible.length} lote(s) AO MESMO TEMPO. Todos começam a consultar a V8 imediatamente.\n\n` +
        `⚠️ ATENÇÃO: a V8 tem rate-limit. Se você disparar muitos lotes grandes em paralelo, algumas consultas podem falhar com timeout/429 e precisarão de retry.\n\n` +
        `As abas vão alternar sozinhas a cada ~8s para você acompanhar.\n\nConfirmar?`;
    } else {
      let hasActive = false;
      let activeName = '';
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (user) {
          const cutoff = new Date(Date.now() - 30 * 60 * 1000).toISOString();
          const { data: actives } = await supabase
            .from('v8_batches')
            .select('id, name')
            .eq('created_by', user.id)
            .in('status', ['processing', 'scheduled'])
            .gte('updated_at', cutoff)
            .limit(1);
          if (actives && actives.length > 0) {
            hasActive = true;
            activeName = (actives[0] as any).name || '(sem nome)';
          }
        }
      } catch { /* segue sem pré-check */ }

      confirmMsg = hasActive
        ? `Você já tem 1 lote em andamento ("${activeName}").\n\n` +
          `Vou enfileirar ${eligible.length} rascunho(s). Eles começam SOZINHOS quando o lote atual terminar.\n\nConfirmar?`
        : `Vou enfileirar ${eligible.length} rascunho(s) em sequência.\n\n` +
          `O 1º começa imediatamente; os demais começam sozinhos quando o anterior terminar.\n\nConfirmar?`;
    }
    if (!window.confirm(confirmMsg)) return;

    setRunAllBusy(true);
    try {
      const results = await queueAllDrafts({
        drafts: draftsWithNames,
        configs,
        strategy: v8Settings?.simulation_strategy ?? 'webhook_only',
        mode,
      });

      const okResults = results.filter(r => (r.status === 'queued' || r.status === 'dispatched') && r.batchId);
      if (okResults.length > 0) {
        setDrafts(prev => {
          const updated = [...prev];
          for (const r of okResults) {
            const idx = updated.findIndex(d => d.id === r.draftId);
            if (idx >= 0 && r.batchId) {
              updated[idx] = { ...updated[idx], activeBatchId: r.batchId };
              addDraftBatchEntry(r.draftId, r.batchId);
            }
          }
          return updated;
        });
        const firstOk = okResults[0];
        if (firstOk) setActiveId(firstOk.draftId);
        // Etapa 2 (mai/2026): short-loop (3x em 10s) reduz latência queued→processing.
        triggerLauncherShortLoop({ reason: 'run-all-sequence' });

        if (mode === 'parallel_dispatch') {
          const ids = okResults.map(r => r.batchId!).filter(Boolean);
          setParallelBatchIds(ids);
          const initial: Record<string, string> = {};
          ids.forEach(id => { initial[id] = 'scheduled'; });
          setParallelActiveStatuses(initial);
        }
      }

      const summary = summarizeRunAll(results);
      const hasIssue = summary.skipped > 0 || summary.errors > 0;
      if (hasIssue) {
        setRunAllReport(results);
      } else {
        const verb = mode === 'parallel_dispatch' ? '⚡ Disparo paralelo' : '▶ Sequência iniciada';
        toast.success(`${verb}: ${summary.text}`, {
          description: mode === 'parallel_dispatch'
            ? 'Todos os lotes começam agora. As abas vão alternar sozinhas.'
            : 'O progresso aparece automaticamente em cada aba.',
          duration: 8000,
        });
      }
    } finally {
      setRunAllBusy(false);
    }
  }

  // Etapa 2 (mai/2026): auto-rotação de aba durante disparo paralelo.
  // Cicla a cada 8s entre as abas com lote ainda em processing/scheduled.
  // Para quando todos terminam (completed/canceled/failed).
  useEffect(() => {
    if (parallelBatchIds.length === 0) return;
    let cancelled = false;

    const ch = supabase
      .channel('v8-parallel-rotation')
      .on('postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'v8_batches' },
        (payload: any) => {
          if (cancelled) return;
          const id = payload.new?.id;
          const status = payload.new?.status;
          if (id && parallelBatchIds.includes(id)) {
            setParallelActiveStatuses(prev => ({ ...prev, [id]: status }));
          }
        },
      )
      .subscribe();

    (async () => {
      const { data } = await supabase
        .from('v8_batches')
        .select('id, status')
        .in('id', parallelBatchIds);
      if (cancelled || !data) return;
      const map: Record<string, string> = {};
      data.forEach((b: any) => { map[b.id] = b.status; });
      setParallelActiveStatuses(prev => ({ ...prev, ...map }));
    })();

    const interval = setInterval(() => {
      if (cancelled) return;
      setActiveId(currentId => {
        const draftIds = drafts
          .filter(d => d.activeBatchId && parallelBatchIds.includes(d.activeBatchId))
          .filter(d => {
            const st = parallelActiveStatuses[d.activeBatchId!];
            return st === 'processing' || st === 'scheduled' || !st;
          })
          .map(d => d.id);
        if (draftIds.length === 0) return currentId;
        const curIdx = draftIds.indexOf(currentId);
        const next = draftIds[(curIdx + 1) % draftIds.length];
        return next;
      });
    }, 8000);

    return () => { cancelled = true; clearInterval(interval); supabase.removeChannel(ch); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [parallelBatchIds.join(','), drafts.map(d => d.activeBatchId ?? '').join(',')]);

  // Encerra rotação quando todos os lotes paralelos finalizaram.
  useEffect(() => {
    if (parallelBatchIds.length === 0) return;
    const allDone = parallelBatchIds.every(id => {
      const st = parallelActiveStatuses[id];
      return st === 'completed' || st === 'canceled' || st === 'failed';
    });
    if (allDone) {
      toast.success('⚡ Disparo paralelo concluído — todas as abas finalizadas.');
      setParallelBatchIds([]);
      setParallelActiveStatuses({});
    }
  }, [parallelActiveStatuses, parallelBatchIds]);

  return (
    <Tabs defaultValue="criar" className="space-y-4">
      <TabsList>
        <TabsTrigger value="criar">Criar lote</TabsTrigger>
        <TabsTrigger value="historico">Histórico de lotes</TabsTrigger>
      </TabsList>

      <TabsContent value="historico" className="mt-2">
        <BatchHistoryPanel />
      </TabsContent>

      <TabsContent value="criar" className="space-y-4 mt-2">
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
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="default"
                size="sm"
                disabled={runAllBusy}
                className="h-7 text-xs ml-auto gap-1.5"
                title="Escolha como executar todos os rascunhos"
              >
                {runAllBusy
                  ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  : <PlayCircle className="w-3.5 h-3.5" />}
                ▶ Executar todos ({drafts.length})
                <ChevronDown className="w-3 h-3 opacity-70" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-72">
              <DropdownMenuLabel className="text-xs">Como disparar?</DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                onClick={() => handleRunAllDrafts('sequential')}
                className="flex items-start gap-2 py-2"
              >
                <ListOrdered className="w-4 h-4 mt-0.5 text-muted-foreground" />
                <div className="flex-1">
                  <div className="text-sm font-medium">Em sequência</div>
                  <div className="text-xs text-muted-foreground">
                    Um lote por vez. Mais seguro contra rate-limit da V8.
                  </div>
                </div>
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={() => handleRunAllDrafts('parallel_dispatch')}
                className="flex items-start gap-2 py-2"
              >
                <Zap className="w-4 h-4 mt-0.5 text-amber-500" />
                <div className="flex-1">
                  <div className="text-sm font-medium">Em paralelo (todos juntos)</div>
                  <div className="text-xs text-muted-foreground">
                    Dispara tudo de uma vez. Abas alternam sozinhas a cada 8s. ⚠️ Cuidado com rate-limit.
                  </div>
                </div>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
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
        autoBest={autoBest}
        onToggleAutoBest={setAutoBest}
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

      {activeBatchId && autoBest && !activeBatchPaused && (
        <div className="rounded-lg border border-amber-300 bg-amber-50 dark:border-amber-700 dark:bg-amber-950/40 px-3 py-2 text-sm text-amber-900 dark:text-amber-200">
          🤖 <strong>Auto-melhor ativo (worker em background).</strong> O sistema testa propostas automaticamente a cada 1 min — você pode <strong>fechar a aba</strong> que continua processando.
        </div>
      )}

      {activeBatchId && (
        <BatchProgressTable
          simulations={simulations}
          batch={activeBatchMeta}
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
              onReplayPending={ops.handleReplayPending}
              onCancelBatch={ops.handleCancelBatch}
              onCancelBatchHard={ops.handleCancelBatchHard}
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

      {/* Etapa 4 (abr/2026): relatório claro pós "Executar todos em sequência". */}
      <Dialog open={!!runAllReport} onOpenChange={(open) => !open && setRunAllReport(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Relatório de enfileiramento</DialogTitle>
            <DialogDescription>
              Veja abaixo o que entrou na fila e o que foi pulado.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2 max-h-96 overflow-auto">
            {(runAllReport ?? []).map((r) => (
              <div
                key={r.draftId}
                className={`rounded border px-3 py-2 text-sm ${
                  r.status === 'queued'
                    ? 'border-emerald-300 bg-emerald-50 dark:border-emerald-800 dark:bg-emerald-950/30'
                    : r.status === 'skipped'
                      ? 'border-amber-300 bg-amber-50 dark:border-amber-800 dark:bg-amber-950/30'
                      : 'border-destructive/50 bg-destructive/10'
                }`}
              >
                <div className="font-medium">
                  {r.status === 'queued' && '✅'}
                  {r.status === 'skipped' && '⚠️'}
                  {r.status === 'error' && '❌'}
                  {' '}{r.label}
                </div>
                <div className="text-xs text-muted-foreground mt-1">
                  {r.status === 'queued' && `Entrou na fila — posição #${r.queuePosition ?? '?'}`}
                  {r.status === 'skipped' && `Pulado: ${r.reason ?? 'motivo não informado'}`}
                  {r.status === 'error' && `Erro: ${r.reason ?? 'erro desconhecido'}`}
                </div>
              </div>
            ))}
          </div>
          <div className="flex items-start gap-2 text-xs text-muted-foreground bg-muted/40 rounded p-2 mt-2">
            <span>💡</span>
            <span>
              <strong>Pulado</strong> normalmente significa: rascunho sem nome, sem tabela escolhida, sem CPFs colados, ou linha com data inválida. Verifique a aba do rascunho pulado e tente de novo.
            </span>
          </div>
          <div className="flex justify-end pt-2">
            <Button onClick={() => setRunAllReport(null)} variant="default">Entendi</Button>
          </div>
        </DialogContent>
      </Dialog>
      </TabsContent>
    </Tabs>
  );
}
