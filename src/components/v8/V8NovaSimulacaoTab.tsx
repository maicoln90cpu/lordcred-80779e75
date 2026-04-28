import { useEffect, useMemo, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { RefreshCw, Play, Loader2, Search } from 'lucide-react';
import { toast } from 'sonner';
import { Switch } from '@/components/ui/switch';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { AutoRetryIndicator, RealtimeFreshness } from './V8RealtimeIndicators';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { supabase } from '@/integrations/supabase/client';
import { useV8Configs } from '@/hooks/useV8Configs';
import { useV8BatchSimulations } from '@/hooks/useV8Batches';
import { analyzeV8Paste } from '@/lib/v8Parser';
import {
  getV8ErrorMessageDeduped,
  getV8ErrorMeta,
  getV8StatusSnapshot,
  translateV8Status,
} from '@/lib/v8ErrorPresentation';
import { isRetriableErrorKind, shouldAutoRetry, MAX_AUTO_RETRY_ATTEMPTS } from '@/lib/v8ErrorClassification';
import { useV8Settings } from '@/hooks/useV8Settings';
import { V8StatusGlossary } from './V8StatusGlossary';
import { extractAvailableMargin, formatMarginBRL } from '@/lib/v8MarginExtractor';

function getSimulationStatusLabel(simulation: { status: string; error_message: string | null; raw_response: any; last_attempt_at?: string | null; webhook_status?: string | null }) {
  const errorKind = simulation.raw_response?.kind || simulation.raw_response?.error_kind || null;

  if (simulation.status === 'failed' && errorKind === 'active_consult') {
    return 'consulta ativa';
  }
  if (simulation.status === 'failed' && errorKind === 'existing_proposal') {
    return 'proposta existente';
  }
  if (simulation.status === 'failed' && errorKind === 'temporary_v8') {
    return 'instável';
  }
  if (simulation.status === 'failed' && errorKind === 'invalid_data') {
    return 'dados inválidos';
  }
  if (simulation.status === 'pending') {
    // Sem nenhuma chamada ainda → estamos disparando AGORA
    if (!simulation.last_attempt_at) return 'processando';
    // V8 explicitamente em estado de espera
    const ws = (simulation.webhook_status || '').toUpperCase();
    if (ws.startsWith('WAITING_')) return 'em análise';
    return 'aguardando V8';
  }
  return translateV8Status(simulation.status);
}

function getSimulationStatusVariant(simulation: { status: string; raw_response: any; last_attempt_at?: string | null }) {
  const errorKind = simulation.raw_response?.kind || simulation.raw_response?.error_kind || null;

  if (simulation.status === 'success') return 'default' as const;
  if (simulation.status === 'pending') return 'secondary' as const;
  if (simulation.status === 'failed' && errorKind === 'active_consult') return 'outline' as const;
  return 'destructive' as const;
}

const DEFAULT_PARCEL_OPTIONS = [12, 24, 36, 48, 60, 72, 84, 96];
const MAX_CONCURRENCY = 3;
const STORAGE_KEY = 'v8:nova-simulacao:draft';

type V8Draft = {
  batchName: string;
  configId: string;
  parcelas: number;
  simulationMode: 'none' | 'disbursed_amount' | 'installment_face_value';
  simulationValue: string;
  pasteText: string;
  activeBatchId: string | null;
};

function loadDraft(): Partial<V8Draft> {
  try {
    const raw = typeof window !== 'undefined' ? window.localStorage.getItem(STORAGE_KEY) : null;
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

export default function V8NovaSimulacaoTab() {
  const { configs, refreshing, refreshFromV8 } = useV8Configs();
  const { settings: v8Settings, save: saveV8Settings } = useV8Settings();
  const _draft = useMemo(() => loadDraft(), []);
  const [batchName, setBatchName] = useState<string>(_draft.batchName ?? '');
  const [configId, setConfigId] = useState<string>(_draft.configId ?? '');
  const [parcelas, setParcelas] = useState<number>(_draft.parcelas ?? 24);
  const [simulationMode, setSimulationMode] = useState<'none' | 'disbursed_amount' | 'installment_face_value'>(_draft.simulationMode ?? 'none');
  const [simulationValue, setSimulationValue] = useState<string>(_draft.simulationValue ?? '');
  const [pasteText, setPasteText] = useState<string>(_draft.pasteText ?? '');
  const [activeBatchId, setActiveBatchId] = useState<string | null>(_draft.activeBatchId ?? null);
  const [running, setRunning] = useState(false);

  // Persiste rascunho no localStorage para sobreviver à troca de aba/refresh
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
  const invalidDateIssue = pasteAnalysis.issues.find((issue) => issue.code === 'invalid_date');
  const blockingIssues = pasteAnalysis.issues.filter(
    (issue) => issue.code === 'invalid_date' || issue.code === 'invalid_format' || issue.code === 'missing_birth_date',
  );

  const selectedConfig = useMemo(
    () => configs.find((c) => c.config_id === configId) ?? null,
    [configs, configId],
  );

  const parcelOptions = useMemo<number[]>(() => {
    const rawOptions: number[] = Array.isArray(selectedConfig?.raw_data?.number_of_installments)
      ? selectedConfig.raw_data.number_of_installments
          .map((value: string | number) => Number(value))
          .filter((value: number) => Number.isInteger(value) && value > 0)
      : [];

    if (rawOptions.length > 0) {
      return [...new Set<number>(rawOptions)].sort((a: number, b: number) => a - b);
    }

    if (selectedConfig?.min_term != null && selectedConfig?.max_term != null) {
      const ranged = DEFAULT_PARCEL_OPTIONS.filter(
        (value) => value >= Number(selectedConfig.min_term) && value <= Number(selectedConfig.max_term),
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

  // Auto-simulação após consulta (toggle no UI). Quando ligado, dispara
  // /simulation throttled para cada SUCCESS novo com simulate_status != done.
  const [autoSimQueue, setAutoSimQueue] = useState<Set<string>>(new Set());
  useEffect(() => {
    if (!v8Settings?.auto_simulate_after_consult || !activeBatchId || !configId) return;
    const candidates = simulations.filter((s: any) =>
      s.status === 'success'
      && s.consult_id
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
                parcelas: sim.installments || parcelas,
              },
            },
          });
        } catch (err) {
          console.error('[auto-simulate] erro', sim.cpf, err);
        }
        if (i < candidates.length - 1) await new Promise((r) => setTimeout(r, throttle));
      }
    })();
  }, [simulations, v8Settings?.auto_simulate_after_consult, activeBatchId, configId, parcelas]);

  const total = simulations.length;
  const done = simulations.filter((s) => s.status === 'success' || s.status === 'failed').length;
  const success = simulations.filter((s) => s.status === 'success').length;
  const failed = simulations.filter((s) => s.status === 'failed').length;
  const pct = total > 0 ? Math.round((done / total) * 100) : 0;

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

      // Persistir snapshot na linha — assim a tabela passa a mostrar inline
      // mesmo sem esperar o cron do poller automático.
      if (simulationId && data?.data) {
        try {
          const probedAtIso = new Date().toISOString();
          const { data: current } = await supabase
            .from('v8_simulations')
            .select('raw_response')
            .eq('id', simulationId)
            .maybeSingle();
          const baseRaw = (current?.raw_response as any) ?? {};
          await supabase
            .from('v8_simulations')
            .update({
              raw_response: {
                ...baseRaw,
                v8_status_snapshot: { ...(data.data as object), probed_at: probedAtIso },
              },
              v8_status_snapshot_at: probedAtIso,
            })
            .eq('id', simulationId);
        } catch (_) { /* ignore */ }
      }
    } catch (err: any) {
      setStatusDialogData({ cpf, loading: false, result: null, error: err?.message || String(err) });
    }
  }

  /**
   * Re-dispara simulações falhadas que sejam retentáveis automaticamente:
   * apenas kind ∈ {temporary_v8, analysis_pending} (instabilidade ou análise pendente).
   * NÃO mexe em active_consult, existing_proposal nem invalid_data — esses precisam de ação humana.
   */
  async function handleRetryFailed() {
    if (!activeBatchId) return;
    const candidates = simulations.filter((s: any) => {
      const kind = s.error_kind || s.raw_response?.kind || s.raw_response?.error_kind || null;
      if (!isRetriableErrorKind(kind)) return false;
      if (s.status === 'failed') return true;
      // pending "preso" há +60s também conta como retentável
      if (s.status === 'pending' && s.last_attempt_at) {
        return Date.now() - new Date(s.last_attempt_at).getTime() > 60_000;
      }
      return false;
    });

    if (candidates.length === 0) {
      toast.info('Nenhuma falha retentável neste lote (apenas erros temporários ou em análise são reprocessados automaticamente).');
      return;
    }

    if (!configId) {
      toast.error('Escolha a tabela usada no lote antes de retentar');
      return;
    }

    setRunning(true);
    const toastId = toast.loading(`Retentando ${candidates.length} simulação(ões)...`);
    let okCount = 0;
    let failCount = 0;
    const normalizedSimulationValue = simulationMode === 'none' ? 0 : Number(simulationValue.replace(',', '.'));

    try {
      let idx = 0;
      const workers = Array.from({ length: MAX_CONCURRENCY }, async () => {
        while (idx < candidates.length) {
          const myIdx = idx++;
          const sim = candidates[myIdx];
          try {
            const parsedRow = pasteAnalysis.rows.find((r) => r.cpf === sim.cpf);
            const { data, error } = await supabase.functions.invoke('v8-clt-api', {
              body: {
                action: 'simulate_one',
                params: {
                  cpf: sim.cpf,
                  nome: sim.name,
                  data_nascimento: sim.birth_date,
                  genero: parsedRow?.genero,
                  telefone: parsedRow?.telefone,
                  config_id: sim.config_id || configId,
                  parcelas: sim.installments || parcelas,
                  simulation_mode: simulationMode === 'none' ? undefined : simulationMode,
                  simulation_value: simulationMode === 'none' ? undefined : normalizedSimulationValue,
                  batch_id: activeBatchId,
                  simulation_id: sim.id,
                  attempt_count: Number((sim as any).attempt_count ?? 1) + 1,
                  triggered_by: 'manual_retry',
                },
              },
            });
            if (error || !data?.success) failCount += 1;
            else okCount += 1;
          } catch {
            failCount += 1;
          }
        }
      });
      await Promise.all(workers);
      toast.success(`Retentativa concluída: ${okCount} ok · ${failCount} ainda com erro`, { id: toastId });
    } catch (err: any) {
      toast.error(`Erro ao retentar: ${err?.message || err}`, { id: toastId });
    } finally {
      setRunning(false);
    }
  }

  async function handleStart() {
    const rows = pasteAnalysis.rows;
    if (rows.length === 0) {
      toast.error('Cole pelo menos 1 CPF válido');
      return;
    }
    if (blockingIssues.length > 0) {
      toast.error(`Corrija ${blockingIssues.length} linha(s) inválida(s) antes de enviar o lote`);
      return;
    }
    if (!configId) {
      toast.error('Escolha uma tabela');
      return;
    }
    if (!batchName.trim()) {
      toast.error('Dê um nome ao lote');
      return;
    }
    const hasValueInput = simulationValue.trim().length > 0;
    const wantsValue = simulationMode !== 'none';
    if (wantsValue && (!hasValueInput || !Number.isFinite(Number(simulationValue.replace(',', '.'))) || Number(simulationValue.replace(',', '.')) <= 0)) {
      toast.error('Informe um valor válido para a simulação ou escolha "Sem valor (V8 decide)"');
      return;
    }

    setRunning(true);
    const cfgLabel = configs.find((c) => c.config_id === configId)?.name;
    const normalizedSimulationValue = simulationMode === 'none' ? 0 : Number(simulationValue.replace(',', '.'));
    const strategy = v8Settings?.simulation_strategy ?? 'webhook_only';
    const throttleMs = v8Settings?.consult_throttle_ms ?? 1200;
    let pendingCount = 0;

    try {
      const { data, error } = await supabase.functions.invoke('v8-clt-api', {
        body: {
          action: 'create_batch',
          params: {
            name: batchName.trim(),
            config_id: configId,
            config_label: cfgLabel,
            parcelas,
            rows,
          },
        },
      });
      if (error) throw error;
      if (!data?.success) throw new Error(data?.error || 'Falha ao criar lote');

      const batchId = data.data.batch_id as string;
      setActiveBatchId(batchId);
      toast.success(`Lote criado com ${data.data.total} CPFs. Iniciando (estratégia: ${strategy})...`);

      const { data: sims } = await supabase
        .from('v8_simulations')
        .select('id, cpf, name, birth_date')
        .eq('batch_id', batchId)
        .order('created_at', { ascending: true });

      if (!sims) throw new Error('Falha ao carregar simulações');

      // ====== DISPATCH SEQUENCIAL THROTTLED ======
      // Estratégia webhook_only: 1 CPF a cada throttleMs (padrão 1.2s) — respeitoso
      // com a V8, sem rate-limit. Para 200 CPFs: ~4 min de disparo, depois aguarda
      // webhooks chegarem (~10–20s/CPF em paralelo no lado da V8).
      // Estratégia legacy_sync: mantém concorrência 3 (comportamento antigo).
      if (strategy === 'webhook_only') {
        const action = 'simulate_consult_only';
        for (let i = 0; i < sims.length; i++) {
          const sim = sims[i];
          try {
            const parsedRow = rows.find((r) => r.cpf === sim.cpf);
            await supabase.functions.invoke('v8-clt-api', {
              body: {
                action,
                params: {
                  cpf: sim.cpf,
                  nome: sim.name,
                  data_nascimento: sim.birth_date,
                  genero: parsedRow?.genero,
                  telefone: parsedRow?.telefone,
                  config_id: configId,
                  parcelas,
                  batch_id: batchId,
                  simulation_id: sim.id,
                  attempt_count: 1,
                  triggered_by: 'user',
                },
              },
            });
            pendingCount += 1;
          } catch (err) {
            console.error('Sim err', sim.cpf, err);
          }
          if (i < sims.length - 1) {
            await new Promise((r) => setTimeout(r, throttleMs));
          }
        }
        toast.success(
          `Lote disparado: ${pendingCount} consulta(s) aguardando webhook V8. Os valores aparecem em ~10–30s por CPF (assim que cada webhook chega).`,
          { duration: 8000 },
        );
      } else {
        // Estratégia antiga (legacy_sync): mantida apenas como fallback de segurança.
        let idx = 0;
        const workers = Array.from({ length: MAX_CONCURRENCY }, async () => {
          while (idx < sims.length) {
            const myIdx = idx++;
            const sim = sims[myIdx];
            try {
              const parsedRow = rows.find((r) => r.cpf === sim.cpf);
              await supabase.functions.invoke('v8-clt-api', {
                body: {
                  action: 'simulate_one',
                  params: {
                    cpf: sim.cpf,
                    nome: sim.name,
                    data_nascimento: sim.birth_date,
                    genero: parsedRow?.genero,
                    telefone: parsedRow?.telefone,
                    config_id: configId,
                    parcelas,
                    simulation_mode: simulationMode === 'none' ? undefined : simulationMode,
                    simulation_value: simulationMode === 'none' ? undefined : normalizedSimulationValue,
                    batch_id: batchId,
                    simulation_id: sim.id,
                    attempt_count: Number((sim as any).attempt_count ?? 0) + 1,
                    triggered_by: 'user',
                  },
                },
              });
              const { data: latestSim } = await supabase
                .from('v8_simulations')
                .select('status').eq('id', sim.id).maybeSingle();
              if (latestSim?.status === 'pending') pendingCount += 1;
            } catch (err) {
              console.error('Sim err', sim.cpf, err);
            }
          }
        });
        await Promise.all(workers);
        if (pendingCount > 0) {
          toast.warning(`Lote enviado. ${pendingCount} consulta(s) ainda em análise.`);
        } else {
          toast.success('Lote concluído!');
        }
      }

      // ===== AUTO-RETRY EM BACKGROUND =====
      if (backgroundRetryEnabled) {
        toast.info('Auto-retry rodando em segundo plano (cron a cada 1 min). Pode fechar a aba.');
      } else if (strategy !== 'webhook_only') {
        await runAutoRetryLoop(batchId, rows, normalizedSimulationValue);
      }
    } catch (err: any) {
      toast.error(`Erro: ${err?.message || err}`);
    } finally {
      setRunning(false);
    }
  }

  /**
   * "Simular selecionados" — pega CPFs com consulta SUCCESS (margem retornada)
   * e roda /simulation neles, throttled. Substitui as estimativas do webhook
   * (valueMax distribuído) pelos valores REAIS calculados pela V8.
   */
  async function handleSimulateSelected() {
    if (!activeBatchId) return;
    if (!configId) {
      toast.error('Escolha a tabela usada no lote');
      return;
    }
    // Candidatos: status=success com consult_id e simulate_status != done
    const candidates = simulations.filter((s: any) =>
      s.status === 'success' && s.consult_id && (s.simulate_status ?? 'not_started') !== 'done'
    );
    if (candidates.length === 0) {
      toast.info('Nenhum CPF pronto para simular (precisa ter consulta SUCCESS).');
      return;
    }

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
                simulation_id: sim.id,
                consult_id: sim.consult_id,
                config_id: sim.config_id || configId,
                parcelas: sim.installments || parcelas,
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
    } finally {
      setRunning(false);
    }
  }

  /**
   * Loop de auto-retry — re-dispara apenas falhas retentáveis (temporary_v8 / analysis_pending)
   * até atingir MAX_AUTO_RETRY_ATTEMPTS por CPF. Roda em background, com backoff entre rodadas.
   * Aborta quando: nenhum candidato restante OU usuário clicar em "Parar auto-retry".
   */
  async function runAutoRetryLoop(
    batchId: string,
    rows: ReturnType<typeof analyzeV8Paste>['rows'],
    normalizedSimulationValue: number,
  ) {
    let round = 0;
    const MAX_ROUNDS = maxAutoRetry; // teto configurável (v8_settings.max_auto_retry_attempts)
    while (round < MAX_ROUNDS) {
      // Lê estado fresco do banco (não confia no state do React)
      const { data: fresh } = await supabase
        .from('v8_simulations')
        .select('id, cpf, name, birth_date, status, attempt_count, raw_response, error_kind, config_id, installments')
        .eq('batch_id', batchId);
      if (!fresh) break;

      const candidates = fresh.filter((s: any) => {
        // Inclui pending "preso" (rate-limit assíncrono via webhook), não só failed.
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
          const myIdx = idx++;
          const sim: any = candidates[myIdx];
          try {
            const parsedRow = rows.find((r) => r.cpf === sim.cpf);
            await supabase.functions.invoke('v8-clt-api', {
              body: {
                action: 'simulate_one',
                params: {
                  cpf: sim.cpf,
                  nome: sim.name,
                  data_nascimento: sim.birth_date,
                  genero: parsedRow?.genero,
                  telefone: parsedRow?.telefone,
                  config_id: sim.config_id || configId,
                  parcelas: sim.installments || parcelas,
                  simulation_mode: simulationMode === 'none' ? undefined : simulationMode,
                  simulation_value: simulationMode === 'none' ? undefined : normalizedSimulationValue,
                  batch_id: batchId,
                  simulation_id: sim.id,
                  attempt_count: Number(sim.attempt_count ?? 1) + 1,
                  triggered_by: 'user',
                },
              },
            });
          } catch (err) {
            console.error('Auto-retry sim err', sim.cpf, err);
          }
        }
      });
      await Promise.all(workers);
    }
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="flex-row justify-between items-center">
          <CardTitle>Configurar Simulação</CardTitle>
          <div className="flex items-center gap-2">
            <V8StatusGlossary />
            <Button variant="outline" size="sm" onClick={refreshFromV8} disabled={refreshing}>
              <RefreshCw className={`w-4 h-4 mr-2 ${refreshing ? 'animate-spin' : ''}`} />
              Atualizar tabelas V8
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <Label>Nome do lote</Label>
              <Input
                placeholder="Ex.: Lote 23/04 - manhã"
                value={batchName}
                onChange={(e) => setBatchName(e.target.value)}
              />
            </div>
            <div>
              <Label>Tabela V8</Label>
              <Select value={configId} onValueChange={setConfigId}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione a tabela" />
                </SelectTrigger>
                <SelectContent>
                  {configs.length === 0 && (
                    <SelectItem value="__none__" disabled>
                      Clique em "Atualizar tabelas V8"
                    </SelectItem>
                  )}
                  {configs.map((c) => (
                    <SelectItem key={c.config_id} value={c.config_id}>
                      {c.name}{c.bank_name ? ` · ${c.bank_name}` : ''}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Parcelas</Label>
              <Select value={String(parcelas)} onValueChange={(v) => setParcelas(Number(v))}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {parcelOptions.map((p) => (
                    <SelectItem key={p} value={String(p)}>
                      {p}x
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="mt-1 text-xs text-muted-foreground">
                {selectedConfig
                  ? `Parcelas disponíveis nesta tabela: ${parcelOptions.map((value) => `${value}x`).join(', ')}`
                  : 'Selecione uma tabela para ver apenas as parcelas realmente aceitas pela V8.'}
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <Label>Tipo da simulação</Label>
              <Select value={simulationMode} onValueChange={(value: 'none' | 'disbursed_amount' | 'installment_face_value') => setSimulationMode(value)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Sem valor (V8 escolhe cenário padrão)</SelectItem>
                  <SelectItem value="disbursed_amount">Valor liberado desejado</SelectItem>
                  <SelectItem value="installment_face_value">Valor da parcela desejada</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {simulationMode !== 'none' && (
              <div>
                <Label>{simulationMode === 'disbursed_amount' ? 'Valor liberado desejado' : 'Valor da parcela desejada'}</Label>
                <Input
                  inputMode="decimal"
                  placeholder={simulationMode === 'disbursed_amount' ? 'Ex.: 2500,00' : 'Ex.: 180,00'}
                  value={simulationValue}
                  onChange={(e) => setSimulationValue(e.target.value)}
                />
                <p className="mt-1 text-xs text-muted-foreground">
                  Opcional pela V8. Se não souber, escolha "Sem valor" acima e a V8 devolve cenários padrão.
                </p>
              </div>
            )}
          </div>

          <div>
            <Label>Dados dos clientes (1 por linha)</Label>
            <Textarea
              rows={8}
              placeholder={`12345678901 João da Silva 15/03/1985 M 11999998888\n98765432100;Maria Souza;06/08/1990;F;11988887777\nCARLOS PEREIRA LIMA 11122233344 22/11/1978`}
              value={pasteText}
              onChange={(e) => setPasteText(e.target.value)}
              className="font-mono text-xs"
            />
            <div className="mt-1 space-y-0.5 text-xs text-muted-foreground">
              <p>
                <strong>Formatos aceitos</strong> (1 cliente por linha):
              </p>
              <p>• <strong>Com separadores</strong> (espaço, tab, vírgula ou ponto-e-vírgula): tokens em qualquer ordem.</p>
              <p>• <strong>Concatenado</strong> (NOME+CPF+DATA sem separadores), comum em exports de ERP.</p>
              <p className="pt-1">
                Tokens reconhecidos: <strong>CPF</strong> (11 díg.), <strong>Data</strong> (dd/mm/aaaa ou yyyy-mm-dd),
                {' '}<strong>Gênero</strong> (M/F), <strong>Telefone</strong> (10-11 díg.), <strong>Nome</strong>.
              </p>
              <p>⚠️ <strong>CPF e data de nascimento são obrigatórios</strong> — a V8 rejeita simulação sem data.</p>
              <p className="pt-1 font-medium text-foreground">
                {pasteAnalysis.rows.length} CPFs válidos detectados
              </p>
              {invalidDateIssue && (
                <p className="font-medium text-destructive">
                  Linha {invalidDateIssue.lineNumber}: {invalidDateIssue.message}
                </p>
              )}
              {!invalidDateIssue && blockingIssues.length > 0 && (
                <p className="font-medium text-destructive">
                  Existem {blockingIssues.length} linha(s) em formato não aceito. Corrija antes de iniciar o lote.
                </p>
              )}
              {pasteText.trim().length > 0 && blockingIssues.length === 0 && (
                <p>
                  Se alguma linha ficar como <strong>pending</strong>, isso significa que a consulta ainda está em análise na V8 e não deve ser tratada como falha definitiva.
                </p>
              )}
            </div>
          </div>

          <div className="flex items-center justify-between gap-3 rounded-lg border border-border bg-muted/30 p-3">
            <div className="space-y-0.5">
              <Label className="text-sm font-medium">Simular automaticamente após consulta</Label>
              <p className="text-xs text-muted-foreground">
                Quando ligado: assim que cada margem volta da V8, o sistema dispara <code>/simulation</code> automaticamente (throttled). Quando desligado (recomendado): você revisa as margens e clica em "Simular selecionados".
              </p>
            </div>
            <Switch
              checked={v8Settings?.auto_simulate_after_consult ?? false}
              onCheckedChange={(v) => saveV8Settings({ auto_simulate_after_consult: v })}
              disabled={!v8Settings}
            />
          </div>

          <Button onClick={handleStart} disabled={running || blockingIssues.length > 0} size="lg" className="w-full">
            {running ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Processando...
              </>
            ) : (
              <>
                <Play className="w-4 h-4 mr-2" />
                Iniciar Simulação
              </>
            )}
          </Button>
        </CardContent>
      </Card>

      {activeBatchId && (() => {
        // Linhas com margem aprovada (status=success) que ainda não rodaram /simulation.
        // Quando o toggle "auto-simulate" está desligado, a parcela só aparece após o
        // usuário clicar em "Simular selecionados" — sem esse aviso fica invisível.
        const awaitingManualSim = simulations.filter(
          (s: any) => s.status === 'success' && (s.simulate_status ?? 'not_started') === 'not_started',
        ).length;
        const autoOn = !!v8Settings?.auto_simulate_after_consult;
        const showManualWarning = !autoOn && awaitingManualSim > 0;
        return (
        <Card>
          <CardHeader className="flex-row items-center justify-between">
            <CardTitle>Progresso do Lote</CardTitle>
            <div className="flex gap-2">
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      size="sm"
                      variant="default"
                      disabled={running}
                      onClick={handleSimulateSelected}
                      className={showManualWarning ? 'animate-pulse ring-2 ring-yellow-400' : undefined}
                    >
                      <Play className="w-3 h-3 mr-1" /> Simular selecionados{showManualWarning ? ` (${awaitingManualSim})` : ''}
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent side="bottom" className="max-w-xs text-xs">
                    Roda /simulation nos CPFs com consulta SUCCESS — substitui as estimativas (faixa máxima do webhook) pelos valores REAIS calculados pela V8. Throttled (1 CPF a cada ~1.2s).
                  </TooltipContent>
                </Tooltip>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      size="sm"
                      variant="secondary"
                      disabled={running}
                      onClick={handleRetryFailed}
                    >
                      <RefreshCw className="w-3 h-3 mr-1" /> Retentar falhados
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent side="bottom" className="max-w-xs text-xs">
                    Pede para a V8 fazer a consulta de novo nos CPFs que falharam por instabilidade ou análise pendente. Aumenta o número de "Tentativas". Não toca em consulta ativa, proposta existente ou dados inválidos.
                  </TooltipContent>
                </Tooltip>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={async () => {
                        try {
                          const { data, error } = await supabase.functions.invoke('v8-webhook', {
                            body: { action: 'replay_pending', limit: 500, batch_id: activeBatchId },
                          });
                          if (error) throw error;
                          toast.success(`Resultados pendentes buscados: ${data?.success ?? 0} ok · ${data?.failed ?? 0} falhas (de ${data?.total ?? 0})`);
                        } catch (e: any) {
                          toast.error(`Falha ao buscar pendentes: ${e?.message || e}`);
                        }
                      }}
                    >
                      <RefreshCw className="w-3 h-3 mr-1" /> Buscar resultados pendentes
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent side="bottom" className="max-w-xs text-xs">
                    Pergunta à V8 se ela já tem resposta para consultas que enviamos mas que ainda não chegaram pelo webhook. Não conta como nova tentativa. Use se as linhas ficarem em "aguardando" por mais de 2 minutos.
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            </div>
          </CardHeader>
          <CardContent className="space-y-3">
            {showManualWarning && (
              <div className="rounded-md border border-yellow-500/40 bg-yellow-500/10 p-3 text-xs leading-relaxed">
                ⚠️ <strong>{awaitingManualSim} consulta(s) com margem aprovada aguardando simulação.</strong>{' '}
                A V8 já liberou a margem desses CPFs, mas o cálculo de parcela e valor liberado ainda não foi feito.
                Clique em <strong>"Simular selecionados"</strong> (botão amarelo pulsante acima) para finalizar.
                Ou ative o toggle <em>"Simular automaticamente após consulta"</em> em Configurações.
              </div>
            )}
            {(() => {
              const autoRetryActive = simulations.filter((s: any) => {
                const kind = s.error_kind || s.raw_response?.kind || s.raw_response?.error_kind || null;
                if (!isRetriableErrorKind(kind)) return false;
                if (s.status === 'failed') return true;
                if (s.status === 'pending' && s.last_attempt_at) return true;
                return false;
              }).length;
              return <AutoRetryIndicator retryCount={autoRetryActive} maxAttempts={maxAutoRetry} />;
            })()}
            <div className="flex justify-between text-sm">
              <span>{done} / {total} ({pct}%)</span>
              <div className="flex items-center gap-2">
                <RealtimeFreshness since={lastUpdateAt} />
                <Badge variant="default">{success} ok</Badge>
                <Badge variant="destructive">{failed} falha</Badge>
              </div>
            </div>
            <Progress value={pct} />
            <div className="max-h-96 overflow-y-auto border rounded">
              <table className="w-full text-xs">
                <thead className="bg-muted sticky top-0">
                  <tr>
                    <th className="px-2 py-1 text-left">CPF</th>
                    <th className="px-2 py-1 text-left">Status</th>
                    <th className="px-2 py-1 text-right" title="Margem consignável disponível do trabalhador na V8 (availableMarginValue). É o teto de parcela CLT que o cliente pode contratar.">
                      💰 Margem Disp.
                    </th>
                    <th className="px-2 py-1 text-right">Liberado</th>
                    <th className="px-2 py-1 text-right">Parcela</th>
                    <th className="px-2 py-1 text-right" title="Cálculo interno LordCred — não é enviado à V8">Margem LordCred</th>
                    <th className="px-2 py-1 text-right" title="Valor liberado menos a margem LordCred">A cobrar</th>
                    <th className="px-2 py-1 text-center">Tentativas</th>
                    <th className="px-2 py-1 text-left">Motivo</th>
                  </tr>
                </thead>
                <tbody>
                  {simulations.map((s) => (
                    <tr key={s.id} className="border-t">
                      <td className="px-2 py-1 font-mono">{s.cpf}</td>
                      <td className="px-2 py-1">
                        <Badge
                          variant={getSimulationStatusVariant(s)}
                        >
                          {getSimulationStatusLabel(s)}
                        </Badge>
                      </td>
                      <td className="px-2 py-1 text-right">
                        {(() => {
                          const m = (s as any).margem_valor ?? extractAvailableMargin(s.raw_response);
                          return m != null ? (
                            <span className="font-semibold text-emerald-700">{formatMarginBRL(m)}</span>
                          ) : (
                            <span className="text-muted-foreground">—</span>
                          );
                        })()}
                      </td>
                      <td className="px-2 py-1 text-right">{s.released_value != null ? `R$ ${Number(s.released_value).toFixed(2)}` : '—'}</td>
                      <td className="px-2 py-1 text-right">{s.installment_value != null ? `R$ ${Number(s.installment_value).toFixed(2)}` : '—'}</td>
                      <td className="px-2 py-1 text-right">{s.company_margin != null ? `R$ ${Number(s.company_margin).toFixed(2)}` : '—'}</td>
                      <td className="px-2 py-1 text-right">{s.amount_to_charge != null ? `R$ ${Number(s.amount_to_charge).toFixed(2)}` : '—'}</td>
                      <td className={`px-2 py-1 text-center ${(s.attempt_count ?? 0) >= 2 ? 'font-bold text-amber-600' : ''}`}>
                        {s.attempt_count ?? 0}
                        {(s.attempt_count ?? 0) >= MAX_AUTO_RETRY_ATTEMPTS && <span className="text-[10px] block text-destructive">(máx)</span>}
                      </td>
                      <td className="px-2 py-1 align-top">
                        {(() => {
                          const kind = s.raw_response?.kind || s.raw_response?.error_kind || null;
                          const isActiveConsult = kind === 'active_consult';
                          const message = getV8ErrorMessageDeduped(s.raw_response, s.error_message);
                          const meta = getV8ErrorMeta(s.raw_response);
                          const hasErrorInfo = !!(s.error_message || message || s.raw_response);

                          // Caso 1: active_consult — render inline do snapshot (paridade c/ Histórico)
                          if (isActiveConsult) {
                            const snapshot = getV8StatusSnapshot(s.raw_response);
                            if (snapshot?.hasData) {
                              return (
                                <div className="space-y-1">
                                  <div className="font-medium text-amber-600">Consulta ativa na V8</div>
                                  <div className="text-[11px] space-y-0.5">
                                    {snapshot.status && (
                                      <div>
                                        <span className="text-muted-foreground">Status:</span>{' '}
                                        <span className={`font-semibold ${snapshot.status === 'REJECTED' ? 'text-destructive' : snapshot.status === 'CONSENT_APPROVED' ? 'text-emerald-600' : ''}`}>
                                          {snapshot.status}
                                        </span>
                                      </div>
                                    )}
                                    {snapshot.name && (
                                      <div><span className="text-muted-foreground">Nome:</span> {snapshot.name}</div>
                                    )}
                                    {snapshot.detail && (
                                      <div className="text-muted-foreground italic">{snapshot.detail}</div>
                                    )}
                                  </div>
                                  <Button size="sm" variant="ghost" className="h-6 px-2 text-[10px]" onClick={() => handleCheckStatus(s.cpf, s.id)}>
                                    <Search className="w-3 h-3 mr-1" /> Ver todas as consultas
                                  </Button>
                                </div>
                              );
                            }
                            const subtitle = snapshot?.rateLimited
                              ? 'V8 limitou as consultas. Nova tentativa automática em instantes.'
                              : snapshot?.probedAt
                                ? (snapshot.message || 'Sem retorno da V8 nessa busca. Clique para consultar manualmente.')
                                : 'Buscando status na V8... pode levar alguns instantes.';
                            return (
                              <div className="space-y-1">
                                <div className="whitespace-pre-line font-medium text-amber-600">
                                  Já existe consulta ativa para este CPF na V8
                                </div>
                                <div className="text-[10px] text-muted-foreground italic">{subtitle}</div>
                                <Button size="sm" variant="outline" onClick={() => handleCheckStatus(s.cpf, s.id)}>
                                  <Search className="w-3 h-3 mr-1" /> Ver status na V8
                                </Button>
                              </div>
                            );
                          }

                          // Caso 2a: pending SEM nenhuma chamada (nem disparamos ainda) → "processando"
                          if (s.status === 'pending' && !s.last_attempt_at) {
                            return (
                              <span className="flex items-center gap-2 text-blue-500">
                                <Loader2 className="w-3 h-3 animate-spin" />
                                Disparando consulta na V8…
                              </span>
                            );
                          }
                          // Caso 2b: pending sem informação de erro mas já chamamos
                          if (s.status === 'pending' && !hasErrorInfo) {
                            const elapsed = s.processed_at
                              ? Math.floor((Date.now() - new Date(s.processed_at).getTime()) / 1000)
                              : null;
                            const noWebhook = !s.last_attempt_at && !s.raw_response;
                            return (
                              <span className="text-muted-foreground">
                                Aguardando retorno da V8 (via webhook)
                                {elapsed != null && elapsed > 60 ? ` · há ${elapsed}s` : ''}
                                {noWebhook && elapsed != null && elapsed > 120 ? ' · webhook ainda não chegou' : ''}
                              </span>
                            );
                          }

                          // Caso 3: existe info de erro (mesmo em pending) — mostrar mensagem única
                          if (hasErrorInfo) {
                            return (
                              <div className="space-y-1">
                                <div className="whitespace-pre-line font-medium">
                                  {message || 'Falha sem detalhe retornado'}
                                </div>
                                {(meta.step || meta.kind) && (
                                  <div className="text-[11px] text-muted-foreground">
                                    {meta.step ? `etapa: ${meta.step}` : null}
                                    {meta.step && meta.kind ? ' • ' : null}
                                    {meta.kind ? `tipo: ${meta.kind}` : null}
                                  </div>
                                )}
                              </div>
                            );
                          }

                          return '—';
                        })()}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
        );
      })()}

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
