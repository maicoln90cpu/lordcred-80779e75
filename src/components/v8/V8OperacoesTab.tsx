import { useCallback, useEffect, useMemo, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Loader2,
  Search,
  RefreshCw,
  User,
  FileText,
  Webhook,
  Calculator,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Clock,
  ChevronDown,
  ChevronRight,
} from 'lucide-react';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import TimelineEventActions from './TimelineEventActions';
import { FindBestProposalButton } from './FindBestProposalButton';
import { V8LimitsBadge } from './V8LimitsBadge';
import { V8StatusBadgePair } from './V8StatusBadgePair';

/**
 * V8 — Aba "Operações" (timeline por CPF)
 *
 * Unifica numa única visão:
 *  - Simulações (v8_simulations)
 *  - Operações/propostas locais (v8_operations_local)
 *  - Webhooks recebidos (v8_webhook_logs)
 *
 * Busca por CPF (apenas dígitos) ou nome. Lista as últimas 50 pessoas
 * com atividade recente. Ao expandir, mostra a linha do tempo unificada
 * em ordem cronológica decrescente.
 *
 * NÃO substitui as abas legacy. Fica disponível como nova entrada principal.
 */

interface CpfRow {
  cpf: string;
  name: string | null;
  lastActivity: string;
  simCount: number;
  opCount: number;
  whCount: number;
  lastStatus: string | null;
  successCount: number;
  failedCount: number;
  pendingCount: number;
}

interface TimelineEvent {
  id: string;
  rowId: string;
  kind: 'simulation' | 'operation' | 'webhook';
  at: string;
  title: string;
  subtitle?: string;
  status?: string | null;
  consultId?: string | null;
  operationId?: string | null;
  v8SimulationId?: string | null;
  /** Resumo financeiro (apenas simulações com sucesso). */
  approved?: {
    releasedValue: number | null;
    installmentValue: number | null;
    installments: number | null;
    configName: string | null;
  } | null;
  /** Resumo persistido da operação (vem de v8_operations_local — Etapa 4). */
  operation?: {
    borrowerName: string | null;
    disbursedAmount: number | null;
    installmentValue: number | null;
    numberOfInstallments: number | null;
    contractNumber: string | null;
    paidAt: string | null;
    firstDueDate: string | null;
  } | null;
  meta?: Record<string, any>;
}

function onlyDigits(s: string) {
  return (s || '').replace(/\D/g, '');
}

/**
 * Extrai a URL de formalização do raw_payload da V8.
 * V8 pode retornar a URL em diferentes chaves dependendo do estágio:
 *  - formalizationUrl / formalization_url (usuais)
 *  - contractUrl / contract_url (após CCB pronta)
 *  - signatureUrl (assinatura)
 * Procura na raiz e em sub-objetos comuns (data, operation, formalization).
 */
function extractFormalizationUrl(raw: any): string | null {
  if (!raw || typeof raw !== 'object') return null;
  const candidates = [raw, raw.data, raw.operation, raw.formalization, raw.contract].filter(Boolean);
  const keys = [
    'formalizationUrl', 'formalization_url',
    'contractUrl', 'contract_url',
    'signatureUrl', 'signature_url',
  ];
  for (const c of candidates) {
    for (const k of keys) {
      const v = c?.[k];
      if (typeof v === 'string' && /^https?:\/\//i.test(v)) return v;
    }
  }
  return null;
}

function formatCpf(cpf: string) {
  const d = onlyDigits(cpf);
  if (d.length !== 11) return cpf;
  return `${d.slice(0, 3)}.${d.slice(3, 6)}.${d.slice(6, 9)}-${d.slice(9)}`;
}

function fmtDate(d?: string | null) {
  if (!d) return '—';
  try {
    return format(new Date(d), "dd/MM/yyyy HH:mm", { locale: ptBR });
  } catch {
    return d;
  }
}

function StatusIcon({ status }: { status?: string | null }) {
  const s = (status || '').toLowerCase();
  if (s === 'success' || s === 'approved' || s === 'paid' || s === 'done') {
    return <CheckCircle2 className="w-4 h-4 text-emerald-500" />;
  }
  if (s === 'failed' || s === 'rejected' || s === 'error') {
    return <XCircle className="w-4 h-4 text-red-500" />;
  }
  if (s === 'pending' || s === 'queued' || s === 'processing') {
    return <Clock className="w-4 h-4 text-amber-500" />;
  }
  return <AlertTriangle className="w-4 h-4 text-muted-foreground" />;
}

function KindBadge({ kind }: { kind: TimelineEvent['kind'] }) {
  if (kind === 'simulation') {
    return (
      <Badge variant="outline" className="gap-1">
        <Calculator className="w-3 h-3" /> Simulação
      </Badge>
    );
  }
  if (kind === 'operation') {
    return (
      <Badge variant="outline" className="gap-1">
        <FileText className="w-3 h-3" /> Operação
      </Badge>
    );
  }
  return (
    <Badge variant="outline" className="gap-1">
      <Webhook className="w-3 h-3" /> Webhook
    </Badge>
  );
}

export default function V8OperacoesTab() {
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<'todos' | 'sucesso' | 'falha' | 'pendente'>('todos');
  const [rows, setRows] = useState<CpfRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [expandedCpf, setExpandedCpf] = useState<string | null>(null);
  const [timeline, setTimeline] = useState<TimelineEvent[]>([]);
  const [timelineLoading, setTimelineLoading] = useState(false);

  const loadAggregates = useCallback(async (statusFilter?: 'success' | 'failed' | 'pending') => {
    setLoading(true);
    try {
      // Janela maior (2000) — `failed` domina o volume e enviesa janelas pequenas.
      // Quando há filtro de status, aplica no SQL para garantir presença real.
      let q = supabase
        .from('v8_simulations')
        .select('cpf, name, status, simulate_status, updated_at, created_at')
        .order('updated_at', { ascending: false })
        .limit(2000);
      if (statusFilter) q = q.eq('status', statusFilter);

      const { data, error } = await q;
      if (error) throw error;

      const map = new Map<string, CpfRow>();
      (data ?? []).forEach((s: any) => {
        const cpf = onlyDigits(s.cpf || '');
        if (!cpf) return;
        const at = s.updated_at || s.created_at;
        const st = (s.status || '').toLowerCase();
        const existing = map.get(cpf);
        if (existing) {
          existing.simCount += 1;
          if (st === 'success') existing.successCount += 1;
          else if (st === 'failed') existing.failedCount += 1;
          else if (st === 'pending') existing.pendingCount += 1;
          if (at && at > existing.lastActivity) {
            existing.lastActivity = at;
            existing.lastStatus = s.status;
          }
          if (!existing.name && s.name) existing.name = s.name;
        } else {
          map.set(cpf, {
            cpf,
            name: s.name ?? null,
            lastActivity: at,
            simCount: 1,
            opCount: 0,
            whCount: 0,
            lastStatus: s.status,
            successCount: st === 'success' ? 1 : 0,
            failedCount: st === 'failed' ? 1 : 0,
            pendingCount: st === 'pending' ? 1 : 0,
          });
        }
      });

      // Enriquecer com contagem de webhooks (últimos 7 dias) — agrupado
      const cpfs = Array.from(map.keys());
      if (cpfs.length > 0) {
        // v8_webhook_logs não tem coluna cpf, então fazemos join via v8_simulation_id ↔ v8_simulations
        const { data: simIds } = await supabase
          .from('v8_simulations')
          .select('cpf, v8_simulation_id, consult_id')
          .in('cpf', cpfs)
          .not('v8_simulation_id', 'is', null);

        const idToCpf = new Map<string, string>();
        (simIds ?? []).forEach((r: any) => {
          if (r.v8_simulation_id) idToCpf.set(r.v8_simulation_id, onlyDigits(r.cpf));
          if (r.consult_id) idToCpf.set(r.consult_id, onlyDigits(r.cpf));
        });

        const allIds = Array.from(idToCpf.keys());
        if (allIds.length > 0) {
          const { data: whs } = await supabase
            .from('v8_webhook_logs')
            .select('v8_simulation_id, consult_id')
            .or(`v8_simulation_id.in.(${allIds.join(',')}),consult_id.in.(${allIds.join(',')})`)
            .limit(1000);

          (whs ?? []).forEach((w: any) => {
            const id = w.v8_simulation_id || w.consult_id;
            const cpf = idToCpf.get(id);
            if (cpf && map.has(cpf)) map.get(cpf)!.whCount += 1;
          });
        }
      }

      setRows(Array.from(map.values()).sort((a, b) => (b.lastActivity || '').localeCompare(a.lastActivity || '')).slice(0, 50));
    } catch (e: any) {
      console.error('[V8Operacoes] aggregate error', e);
      setRows([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const map = { todos: undefined, sucesso: 'success', falha: 'failed', pendente: 'pending' } as const;
    void loadAggregates(map[filter] as any);
  }, [loadAggregates, filter]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    const qDigits = onlyDigits(search);
    return rows.filter((r) => {
      // Mudança semântica: "tem alguma sim com este status" em vez de "último = X"
      if (filter === 'sucesso' && r.successCount === 0) return false;
      if (filter === 'falha' && r.failedCount === 0) return false;
      if (filter === 'pendente' && r.pendingCount === 0) return false;
      if (!q) return true;
      if (qDigits.length > 0 && r.cpf.includes(qDigits)) return true;
      if (r.name?.toLowerCase().includes(q)) return true;
      return false;
    });
  }, [rows, search, filter]);

  const loadTimeline = useCallback(async (cpf: string) => {
    setTimelineLoading(true);
    setTimeline([]);
    try {
      const events: TimelineEvent[] = [];

      // 1) Simulações
      const { data: sims } = await supabase
        .from('v8_simulations')
        .select('id, status, simulate_status, error_message, released_value, installment_value, installments, sim_month_max, config_name, v8_simulation_id, consult_id, created_at, updated_at, last_step')
        .eq('cpf', cpf)
        .order('created_at', { ascending: false })
        .limit(50);

      (sims ?? []).forEach((s: any) => {
        // ⚠️ NÃO usar sim_month_max aqui — esse campo é o tempo de admissão CLT do
        // trabalhador (vem do payload V8), NÃO o nº de parcelas do empréstimo.
        // O nº de parcelas correto é a coluna `installments` (gravada por simulate_one
        // / simulate_only_for_consult). Já tivemos regressão por confundir esses dois.
        const installmentsLabel = s.installments ? `${s.installments}x` : null;
        events.push({
          id: `sim-${s.id}`,
          rowId: s.id,
          kind: 'simulation',
          at: s.updated_at || s.created_at,
          title: s.config_name ? `Simulação — ${s.config_name}` : 'Simulação',
          subtitle: [
            s.released_value ? `R$ ${Number(s.released_value).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}` : null,
            installmentsLabel,
            s.last_step,
          ].filter(Boolean).join(' • '),
          status: s.status,
          consultId: s.consult_id,
          v8SimulationId: s.v8_simulation_id,
          approved:
            s.status === 'success' && (s.released_value != null || s.installment_value != null)
              ? {
                  releasedValue: s.released_value != null ? Number(s.released_value) : null,
                  installmentValue: s.installment_value != null ? Number(s.installment_value) : null,
                  installments: s.installments != null ? Number(s.installments) : null,
                  configName: s.config_name ?? null,
                }
              : null,
          meta: { simulate_status: s.simulate_status, error: s.error_message },
        });
      });

      // 2) Webhooks ligados aos ids dessa pessoa
      const ids = (sims ?? [])
        .flatMap((s: any) => [s.v8_simulation_id, s.consult_id])
        .filter(Boolean);
      if (ids.length > 0) {
        const { data: whs } = await supabase
          .from('v8_webhook_logs')
          .select('id, event_type, status, v8_simulation_id, consult_id, operation_id, received_at')
          .or(`v8_simulation_id.in.(${ids.join(',')}),consult_id.in.(${ids.join(',')})`)
          .order('received_at', { ascending: false })
          .limit(100);

        (whs ?? []).forEach((w: any) => {
          events.push({
            id: `wh-${w.id}`,
            rowId: w.id,
            kind: 'webhook',
            at: w.received_at,
            title: `Webhook — ${w.event_type || 'evento'}`,
            subtitle: w.operation_id ? `Operação ${w.operation_id.slice(0, 12)}…` : undefined,
            status: w.status,
            consultId: w.consult_id,
            operationId: w.operation_id,
            v8SimulationId: w.v8_simulation_id,
            meta: { event_type: w.event_type },
          });
        });

        // 3) Operações locais — Etapa 4: lê colunas dedicadas (sem precisar
        //    parsear raw_payload no cliente). Cai no extrator antigo só como fallback.
        const { data: ops } = await supabase
          .from('v8_operations_local')
          .select(
            'id, operation_id, consult_id, v8_simulation_id, status, first_seen_at, last_updated_at, ' +
            'borrower_name, disbursed_amount, installment_value, number_of_installments, ' +
            'contract_number, formalization_url, contract_url, paid_at, first_due_date, raw_payload'
          )
          .or(`v8_simulation_id.in.(${ids.join(',')}),consult_id.in.(${ids.join(',')})`)
          .limit(50);

        (ops ?? []).forEach((o: any) => {
          // formalization_url: prioriza coluna dedicada (Etapa 4), cai no parser antigo só se nula.
          const formalizationUrl =
            (typeof o.formalization_url === 'string' && o.formalization_url) ||
            (typeof o.contract_url === 'string' && o.contract_url) ||
            extractFormalizationUrl(o.raw_payload) ||
            null;

          events.push({
            id: `op-${o.id}`,
            rowId: o.id,
            kind: 'operation',
            at: o.last_updated_at || o.first_seen_at,
            title: o.borrower_name
              ? `Operação · ${o.borrower_name}`
              : `Operação ${o.operation_id?.slice(0, 12) || ''}…`,
            subtitle: o.contract_number ? `Contrato ${o.contract_number}` : undefined,
            status: o.status,
            consultId: o.consult_id,
            operationId: o.operation_id,
            v8SimulationId: o.v8_simulation_id,
            operation: {
              borrowerName: o.borrower_name ?? null,
              disbursedAmount: o.disbursed_amount != null ? Number(o.disbursed_amount) : null,
              installmentValue: o.installment_value != null ? Number(o.installment_value) : null,
              numberOfInstallments: o.number_of_installments ?? null,
              contractNumber: o.contract_number ?? null,
              paidAt: o.paid_at ?? null,
              firstDueDate: o.first_due_date ?? null,
            },
            meta: { formalizationUrl },
          });
        });
      }

      events.sort((a, b) => (b.at || '').localeCompare(a.at || ''));
      setTimeline(events);
    } catch (e) {
      console.error('[V8Operacoes] timeline error', e);
      setTimeline([]);
    } finally {
      setTimelineLoading(false);
    }
  }, []);

  function toggleExpand(cpf: string) {
    if (expandedCpf === cpf) {
      setExpandedCpf(null);
      setTimeline([]);
    } else {
      setExpandedCpf(cpf);
      void loadTimeline(cpf);
    }
  }

  return (
    <TooltipProvider>
      <div className="space-y-4">
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between flex-wrap gap-3">
              <div>
                <CardTitle className="text-lg flex items-center gap-2">
                  <User className="w-5 h-5 text-primary" /> Operações por CPF
                  <Badge variant="secondary" className="ml-2">novo</Badge>
                </CardTitle>
                <p className="text-xs text-muted-foreground mt-1">
                  Visão única por pessoa: simulações, propostas e webhooks numa só linha do tempo.
                </p>
              </div>
              <Button variant="outline" size="sm" onClick={() => {
                const m = { todos: undefined, sucesso: 'success', falha: 'failed', pendente: 'pending' } as const;
                void loadAggregates(m[filter] as any);
              }} disabled={loading}>
                {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
                <span className="ml-2">Atualizar</span>
              </Button>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex flex-wrap gap-3 items-center">
              <div className="relative flex-1 min-w-[260px]">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  placeholder="Buscar por CPF ou nome…"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="pl-9"
                />
              </div>
              <Tabs value={filter} onValueChange={(v) => setFilter(v as any)}>
                <TabsList>
                  <TabsTrigger value="todos">Todos</TabsTrigger>
                  <TabsTrigger value="sucesso">Sucesso</TabsTrigger>
                  <TabsTrigger value="falha">Falha</TabsTrigger>
                  <TabsTrigger value="pendente">Pendente</TabsTrigger>
                </TabsList>
              </Tabs>
            </div>

            {loading && rows.length === 0 ? (
              <div className="py-12 flex justify-center">
                <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
              </div>
            ) : filtered.length === 0 ? (
              <div className="py-12 text-center text-sm text-muted-foreground">
                Nenhuma pessoa encontrada com esses critérios.
              </div>
            ) : (
              <div className="border rounded-lg divide-y">
                {filtered.map((r) => {
                  const expanded = expandedCpf === r.cpf;
                  return (
                    <div key={r.cpf}>
                      <button
                        type="button"
                        onClick={() => toggleExpand(r.cpf)}
                        className="w-full flex items-center gap-3 p-3 hover:bg-muted/40 text-left transition"
                      >
                        {expanded ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                        <StatusIcon status={r.lastStatus} />
                        <div className="flex-1 min-w-0">
                          <div className="font-medium truncate">{r.name || <span className="text-muted-foreground">— sem nome —</span>}</div>
                          <div className="text-xs text-muted-foreground font-mono">{formatCpf(r.cpf)}</div>
                        </div>
                        <div className="hidden md:flex items-center gap-2 text-xs">
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Badge variant="outline" className="gap-1"><Calculator className="w-3 h-3" />{r.simCount}</Badge>
                            </TooltipTrigger>
                            <TooltipContent>{r.simCount} simulação(ões) na janela</TooltipContent>
                          </Tooltip>
                          {r.successCount > 0 && (
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <Badge variant="outline" className="gap-1 border-emerald-500/40 text-emerald-600 dark:text-emerald-400">
                                  <CheckCircle2 className="w-3 h-3" />{r.successCount}
                                </Badge>
                              </TooltipTrigger>
                              <TooltipContent>{r.successCount} sucesso(s)</TooltipContent>
                            </Tooltip>
                          )}
                          {r.failedCount > 0 && (
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <Badge variant="outline" className="gap-1 border-red-500/40 text-red-600 dark:text-red-400">
                                  <XCircle className="w-3 h-3" />{r.failedCount}
                                </Badge>
                              </TooltipTrigger>
                              <TooltipContent>{r.failedCount} falha(s)</TooltipContent>
                            </Tooltip>
                          )}
                          {r.pendingCount > 0 && (
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <Badge variant="outline" className="gap-1 border-amber-500/40 text-amber-600 dark:text-amber-400">
                                  <Clock className="w-3 h-3" />{r.pendingCount}
                                </Badge>
                              </TooltipTrigger>
                              <TooltipContent>{r.pendingCount} pendente(s)</TooltipContent>
                            </Tooltip>
                          )}
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Badge variant="outline" className="gap-1"><Webhook className="w-3 h-3" />{r.whCount}</Badge>
                            </TooltipTrigger>
                            <TooltipContent>{r.whCount} webhook(s)</TooltipContent>
                          </Tooltip>
                        </div>
                        <div className="text-xs text-muted-foreground hidden md:block min-w-[140px] text-right">
                          {fmtDate(r.lastActivity)}
                        </div>
                      </button>

                      {expanded && (
                        <div className="px-4 pb-4 pt-1 bg-muted/20">
                          {r.successCount > 0 && (
                            <div className="flex items-center justify-between gap-2 py-2 px-3 mb-2 rounded-md bg-emerald-500/5 border border-emerald-500/20 flex-wrap">
                              <div className="text-xs text-emerald-700 dark:text-emerald-400 flex items-center gap-3 flex-wrap">
                                <span>💡 Margem confirmada — calcular melhor combinação valor × prazo automaticamente.</span>
                                <V8LimitsBadge cpf={r.cpf} />
                              </div>
                              <FindBestProposalButton
                                cpf={r.cpf}
                                onComplete={() => loadTimeline(r.cpf)}
                              />
                            </div>
                          )}
                          {timelineLoading ? (
                            <div className="py-6 flex justify-center">
                              <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
                            </div>
                          ) : timeline.length === 0 ? (
                            <div className="py-4 text-xs text-muted-foreground text-center">
                              Nenhum evento encontrado para este CPF.
                            </div>
                          ) : (
                            <ol className="relative border-l border-border ml-2 space-y-3 pt-2">
                              {timeline.map((ev) => (
                                <li key={ev.id} className="ml-4">
                                  <div className="absolute -left-[5px] mt-1.5 w-2.5 h-2.5 rounded-full bg-primary" />
                                  <div className="flex items-start gap-2 flex-wrap">
                                    <KindBadge kind={ev.kind} />
                                    <StatusIcon status={ev.status} />
                                    <span className="font-medium text-sm">{ev.title}</span>
                                    <span className="text-xs text-muted-foreground ml-auto">{fmtDate(ev.at)}</span>
                                  </div>
                                  {ev.status && (
                                    <div className="mt-1">
                                      <V8StatusBadgePair status={ev.status} compact />
                                    </div>
                                  )}
                                  {ev.approved && (
                                    <div className="mt-2 rounded-md border border-emerald-500/30 bg-emerald-500/5 px-3 py-2 text-xs space-y-0.5">
                                      <div className="flex items-center gap-2 font-semibold text-emerald-700 dark:text-emerald-400">
                                        <CheckCircle2 className="w-3.5 h-3.5" />
                                        Liberado:
                                        <span>
                                          {ev.approved.releasedValue != null
                                            ? `R$ ${ev.approved.releasedValue.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`
                                            : '—'}
                                        </span>
                                      </div>
                                      <div className="text-muted-foreground">
                                        Parcela:{' '}
                                        <span className="font-medium text-foreground">
                                          {ev.approved.installmentValue != null
                                            ? `R$ ${ev.approved.installmentValue.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`
                                            : '—'}
                                        </span>
                                        {ev.approved.installments ? (
                                          <span className="ml-1 font-medium text-foreground">· {ev.approved.installments}x</span>
                                        ) : null}
                                      </div>
                                      {ev.approved.configName && (
                                        <div className="text-muted-foreground">
                                          Tabela: <span className="text-foreground">{ev.approved.configName}</span>
                                        </div>
                                      )}
                                    </div>
                                  )}
                                  {ev.meta?.error && (
                                    <div className="text-xs text-red-500 mt-1 truncate" title={ev.meta.error}>
                                      ⚠️ {ev.meta.error}
                                    </div>
                                  )}
                                  <TimelineEventActions
                                    kind={ev.kind}
                                    rowId={ev.rowId}
                                    status={ev.status}
                                    consultId={ev.consultId}
                                    operationId={ev.operationId}
                                    v8SimulationId={ev.v8SimulationId}
                                    borrowerCpf={r.cpf}
                                    title={ev.title}
                                    formalizationUrl={ev.meta?.formalizationUrl ?? null}
                                  />
                                </li>
                              ))}
                            </ol>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </TooltipProvider>
  );
}
