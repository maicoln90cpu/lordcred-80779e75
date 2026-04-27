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
  getV8ErrorHeadline,
  getV8ErrorMeta,
  getV8ErrorSecondary,
  stringifyV8Payload,
} from '@/lib/v8ErrorPresentation';
import { isRetriableErrorKind, shouldAutoRetry, MAX_AUTO_RETRY_ATTEMPTS } from '@/lib/v8ErrorClassification';
import { useV8Settings } from '@/hooks/useV8Settings';

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
  return simulation.status;
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
  const { settings: v8Settings } = useV8Settings();
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

  const { simulations } = useV8BatchSimulations(activeBatchId);
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

  const total = simulations.length;
  const done = simulations.filter((s) => s.status === 'success' || s.status === 'failed').length;
  const success = simulations.filter((s) => s.status === 'success').length;
  const failed = simulations.filter((s) => s.status === 'failed').length;
  const pct = total > 0 ? Math.round((done / total) * 100) : 0;

  async function handleCheckStatus(cpf: string) {
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
    const candidates = simulations.filter((s) => {
      if (s.status !== 'failed') return false;
      const kind = (s as any).error_kind || s.raw_response?.kind || s.raw_response?.error_kind || null;
      return isRetriableErrorKind(kind);
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
      toast.success(`Lote criado com ${data.data.total} CPFs. Iniciando...`);

      const { data: sims } = await supabase
        .from('v8_simulations')
        .select('id, cpf, name, birth_date')
        .eq('batch_id', batchId)
        .order('created_at', { ascending: true });

      if (!sims) throw new Error('Falha ao carregar simulações');

      let idx = 0;
      const workers = Array.from({ length: MAX_CONCURRENCY }, async () => {
        while (idx < sims.length) {
          const myIdx = idx++;
          const sim = sims[myIdx];
          try {
            // Recupera tokens extras (gênero/telefone) parseados na hora da colagem
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
              .select('status')
              .eq('id', sim.id)
              .maybeSingle();
            if (latestSim?.status === 'pending') pendingCount += 1;
          } catch (err) {
            console.error('Sim err', sim.cpf, err);
          }
        }
      });

      await Promise.all(workers);
      if (pendingCount > 0) {
        toast.warning(`Lote enviado. ${pendingCount} consulta(s) ainda estão em análise na V8.`);
      } else {
        toast.success('Lote concluído (1ª passada)!');
      }

      // ===== AUTO-RETRY EM BACKGROUND =====
      // Se o cron `v8-retry-cron` está habilitado, ele assume — o navegador não precisa
      // ficar aberto. Mantemos o loop frontend apenas como fallback quando o cron está OFF.
      if (backgroundRetryEnabled) {
        toast.info('Auto-retry rodando em segundo plano (cron a cada 1 min). Pode fechar a aba.');
      } else {
        await runAutoRetryLoop(batchId, rows, normalizedSimulationValue);
      }
    } catch (err: any) {
      toast.error(`Erro: ${err?.message || err}`);
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
        if (s.status !== 'failed') return false;
        const kind = s.error_kind || s.raw_response?.kind || s.raw_response?.error_kind || null;
        return shouldAutoRetry(kind, s.attempt_count, maxAutoRetry);
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
          <Button variant="outline" size="sm" onClick={refreshFromV8} disabled={refreshing}>
            <RefreshCw className={`w-4 h-4 mr-2 ${refreshing ? 'animate-spin' : ''}`} />
            Atualizar tabelas V8
          </Button>
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

      {activeBatchId && (
        <Card>
          <CardHeader className="flex-row items-center justify-between">
            <CardTitle>Progresso do Lote</CardTitle>
            <div className="flex gap-2">
              <Button
                size="sm"
                variant="secondary"
                disabled={running}
                onClick={handleRetryFailed}
                title="Re-dispara apenas falhas temporárias (rate limit / análise pendente). Não toca em consulta ativa, proposta existente ou dados inválidos."
              >
                <RefreshCw className="w-3 h-3 mr-1" /> Retentar falhados
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={async () => {
                  try {
                    const { data, error } = await supabase.functions.invoke('v8-webhook', {
                      body: { action: 'replay_pending', limit: 500 },
                    });
                    if (error) throw error;
                    toast.success(`Reprocessado: ${data?.success ?? 0} ok · ${data?.failed ?? 0} falhas (de ${data?.total ?? 0})`);
                  } catch (e: any) {
                    toast.error(`Falha ao reprocessar: ${e?.message || e}`);
                  }
                }}
                title="Use se as linhas ficarem em 'aguardando' por mais de 2 minutos"
              >
                <RefreshCw className="w-3 h-3 mr-1" /> Reprocessar pendentes
              </Button>
            </div>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex justify-between text-sm">
              <span>{done} / {total} ({pct}%)</span>
              <div className="flex gap-2">
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
                    <th className="px-2 py-1 text-right">Liberado</th>
                    <th className="px-2 py-1 text-right">Parcela</th>
                    <th className="px-2 py-1 text-right">Margem</th>
                    <th className="px-2 py-1 text-right">A cobrar</th>
                    <th className="px-2 py-1 text-center">Tentativas</th>
                    <th className="px-2 py-1 text-left">Observação</th>
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
                          const headline = getV8ErrorHeadline(s.raw_response, s.error_message);
                          const secondary = getV8ErrorSecondary(s.raw_response);
                          const meta = getV8ErrorMeta(s.raw_response);
                          const payloadStr = stringifyV8Payload(s.raw_response);
                          const hasErrorInfo = !!(s.error_message || headline || s.raw_response);

                          // Caso 1: active_consult em qualquer status — mostrar mensagem amarela + botão
                          if (isActiveConsult) {
                            return (
                              <div className="space-y-1">
                                <div className="whitespace-pre-line font-medium text-amber-600">
                                  Já existe consulta ativa para este CPF na V8
                                </div>
                                <Button size="sm" variant="outline" onClick={() => handleCheckStatus(s.cpf)}>
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

                          // Caso 3: existe info de erro (mesmo em pending) — mostrar
                          if (hasErrorInfo) {
                            return (
                              <div className="space-y-1">
                                <div className="whitespace-pre-line font-medium">
                                  {headline || 'Falha sem detalhe retornado'}
                                </div>
                                {secondary && (
                                  <div className="whitespace-pre-line text-muted-foreground">{secondary}</div>
                                )}
                                {(meta.step || meta.kind) && (
                                  <div className="text-[11px] text-muted-foreground">
                                    {meta.step ? `etapa: ${meta.step}` : null}
                                    {meta.step && meta.kind ? ' • ' : null}
                                    {meta.kind ? `tipo: ${meta.kind}` : null}
                                  </div>
                                )}
                                {meta.guidance && (
                                  <div className="whitespace-pre-line text-[11px] text-muted-foreground">
                                    {meta.guidance}
                                  </div>
                                )}
                                {payloadStr && (
                                  <details className="rounded border border-border bg-muted/30 p-2">
                                    <summary className="cursor-pointer text-[11px] font-medium text-muted-foreground">
                                      Ver payload bruto
                                    </summary>
                                    <pre className="mt-2 overflow-x-auto whitespace-pre-wrap break-words font-mono text-[11px] text-muted-foreground">
                                      {payloadStr}
                                    </pre>
                                  </details>
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
