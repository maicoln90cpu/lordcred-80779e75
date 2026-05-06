import { useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Loader2, Search, AlertTriangle, Eye, Zap } from 'lucide-react';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { RealtimeFreshness, AutoRetryIndicator } from './BatchAnimations';
import PayloadInspectorDialog from './PayloadInspectorDialog';
import BatchStatusLegend from './BatchStatusLegend';
import {
  getV8ErrorMessageDeduped,
  getV8ErrorMeta,
  getV8StatusSnapshot,
  translateV8Status,
} from '@/lib/v8ErrorPresentation';
import { isRetriableErrorKind, MAX_AUTO_RETRY_ATTEMPTS } from '@/lib/v8ErrorClassification';
import type { ReactNode } from 'react';

function getSimulationStatusLabel(simulation: any) {
  const errorKind = simulation.error_kind || simulation.raw_response?.kind || simulation.raw_response?.error_kind || null;
  const ws = (simulation.webhook_status || '').toUpperCase();
  if (simulation.status === 'pending' && (errorKind === 'active_consult' || ws === 'WAITING_EXTERNAL')) return 'aguardando consulta antiga';
  if (simulation.status === 'failed' && errorKind === 'active_consult') return 'consulta ativa';
  if (simulation.status === 'failed' && errorKind === 'rejected_by_v8') return 'rejeitado pela V8';
  if (simulation.status === 'failed' && errorKind === 'canceled') return 'cancelado';
  if (simulation.status === 'failed' && errorKind === 'existing_proposal') return 'proposta existente';
  if (simulation.status === 'failed' && errorKind === 'temporary_v8') return 'instável';
  if (simulation.status === 'failed' && errorKind === 'invalid_data') return 'dados inválidos';
  if (simulation.status === 'pending') {
    if (!simulation.last_attempt_at) return 'processando';
    if (ws.startsWith('WAITING_')) return 'em análise';
    return 'aguardando V8';
  }
  return translateV8Status(simulation.status);
}

function getSimulationStatusVariant(simulation: any) {
  const errorKind = simulation.error_kind || simulation.raw_response?.kind || simulation.raw_response?.error_kind || null;
  const ws = (simulation.webhook_status || '').toUpperCase();
  if (simulation.status === 'success') return 'default' as const;
  if (simulation.status === 'pending' && (errorKind === 'active_consult' || ws === 'WAITING_EXTERNAL')) return 'outline' as const;
  if (simulation.status === 'pending') return 'secondary' as const;
  if (simulation.status === 'failed' && errorKind === 'active_consult') return 'outline' as const;
  if (simulation.status === 'failed' && errorKind === 'canceled') return 'outline' as const;
  return 'destructive' as const;
}

interface Props {
  simulations: any[];
  parcelas: number;
  lastUpdateAt: Date | null;
  maxAutoRetry: number;
  awaitingManualSim: number;
  showManualWarning: boolean;
  actionsSlot: ReactNode;
  onCheckStatus: (cpf: string, simulationId?: string) => void;
  /** Etapa 4 (mai/2026): forçar dispatch de uma linha específica. */
  onForceDispatchRow?: (sim: any) => void;
  /** Etapa 1 (mai/2026): meta do lote para renderizar linhas-fantasma quando v8_simulations ainda está vazio. */
  batch?: {
    id: string;
    status: string;
    scheduled_payload: any;
    queue_position: number | null;
    name: string;
    is_paused?: boolean | null;
    paused_at?: string | null;
  } | null;
  /** Mai/2026: callback para retomar lote pausado (despausar). */
  onResumeBatch?: (batchId: string) => Promise<void> | void;
}

/**
 * Tabela "Progresso do Lote" — apenas UI. Recebe simulações e callbacks via props.
 * Mantém a coluna Parcelas conforme planejado em .lovable/plan.md.
 */
export default function BatchProgressTable({
  simulations, parcelas, lastUpdateAt, maxAutoRetry,
  awaitingManualSim, showManualWarning, actionsSlot, onCheckStatus, batch,
  onForceDispatchRow, onResumeBatch,
}: Props) {
  const [payloadSim, setPayloadSim] = useState<any | null>(null);
  const [resuming, setResuming] = useState(false);

  // Etapa 1 (mai/2026): linhas-fantasma. Quando o lote está enfileirado/agendado/processando
  // mas v8_simulations ainda não foi materializado, mostramos os CPFs do scheduled_payload.rows
  // com status visual "Aguardando início da fila" / "Materializando..." para o operador
  // saber que o lote está vivo.
  const phantomRows: any[] = (() => {
    if (!batch || simulations.length > 0) return [];
    const isPhantomState = ['queued', 'scheduled', 'processing'].includes(batch.status);
    if (!isPhantomState) return [];
    const rows = (batch.scheduled_payload?.rows as any[]) || [];
    const phantomLabel =
      batch.status === 'queued' ? '⏳ Aguardando início da fila' :
      batch.status === 'scheduled' ? '⏳ Aguardando agendamento' :
      '▶ Materializando...';
    return rows.map((r, idx) => ({
      id: `phantom-${batch.id}-${idx}`,
      cpf: (r.cpf || '').replace(/\D/g, ''),
      name: r.nome ?? null,
      status: 'pending',
      released_value: null,
      installment_value: null,
      installments: null,
      attempt_count: 0,
      raw_response: null,
      error_message: null,
      simulate_status: 'not_started',
      __phantom: true,
      __phantomLabel: phantomLabel,
    }));
  })();

  const displaySims = phantomRows.length > 0 ? phantomRows : simulations;
  const total = displaySims.length;
  const done = simulations.filter((s) => s.status === 'success' || s.status === 'failed').length;
  const success = simulations.filter((s) => s.status === 'success').length;
  const failed = simulations.filter((s) => s.status === 'failed').length;
  const pct = total > 0 ? Math.round((done / total) * 100) : 0;

  const autoRetryActive = simulations.filter((s: any) => {
    const kind = s.error_kind || s.raw_response?.kind || s.raw_response?.error_kind || null;
    if (!isRetriableErrorKind(kind)) return false;
    if (s.status === 'failed') return true;
    if (s.status === 'pending' && s.last_attempt_at) return true;
    return false;
  }).length;

  return (
    <Card>
      <CardHeader className="flex-row items-center justify-between">
        <CardTitle>Progresso do Lote</CardTitle>
        {actionsSlot}
      </CardHeader>
      <CardContent className="space-y-3">
        <BatchStatusLegend />
        {batch?.is_paused && (
          <div className="rounded-md border-2 border-destructive/50 bg-destructive/10 p-3 text-sm flex items-start gap-3">
            <AlertTriangle className="w-5 h-5 text-destructive shrink-0 mt-0.5" />
            <div className="flex-1">
              <div className="font-semibold text-destructive">⏸ Lote pausado{batch.paused_at ? ` em ${new Date(batch.paused_at).toLocaleString('pt-BR')}` : ''}</div>
              <div className="text-xs text-muted-foreground mt-0.5">
                Enquanto pausado, <strong>nenhum auto-retry, poller ou worker</strong> processa este lote — os CPFs ficam congelados em "aguardando V8". Clique em <strong>▶ Retomar</strong> para reativar.
              </div>
            </div>
            {onResumeBatch && batch?.id && (
              <Button
                size="sm"
                variant="default"
                disabled={resuming}
                onClick={async () => {
                  setResuming(true);
                  try { await onResumeBatch(batch.id); } finally { setResuming(false); }
                }}
              >
                {resuming ? <Loader2 className="w-4 h-4 mr-1 animate-spin" /> : '▶'} Retomar lote
              </Button>
            )}
          </div>
        )}
        {showManualWarning && (
          <div className="rounded-md border border-yellow-500/40 bg-yellow-500/10 p-3 text-xs leading-relaxed">
            ⚠️ <strong>{awaitingManualSim} consulta(s) com margem aprovada aguardando simulação.</strong>{' '}
            A V8 já liberou a margem desses CPFs, mas o cálculo de parcela e valor liberado ainda não foi feito.
            Clique em <strong>"Simular selecionados"</strong> (botão amarelo pulsante acima) para finalizar.
            Ou ative o toggle <em>🤖 Auto-melhor</em> no formulário do lote para o sistema testar a melhor proposta automaticamente.
          </div>
        )}
        <AutoRetryIndicator retryCount={autoRetryActive} maxAttempts={maxAutoRetry} />
        <div className="flex justify-between text-sm">
          <span>{done} / {total} ({pct}%)</span>
          <div className="flex items-center gap-2">
            <RealtimeFreshness since={lastUpdateAt} />
            <Badge variant="default">{success} ok</Badge>
            <Badge variant="destructive">{failed} falha</Badge>
          </div>
        </div>
        <Progress value={pct} />
        {phantomRows.length > 0 && batch && (
          <div className="rounded-md border border-blue-300/60 bg-blue-50 dark:bg-blue-950/30 px-3 py-2 text-xs text-blue-900 dark:text-blue-200">
            {batch.status === 'queued' && (
              <>📋 <strong>Lote em fila</strong>{batch.queue_position ? <> — posição #{batch.queue_position}</> : null}. Começa quando o anterior terminar. Os {phantomRows.length} CPF(s) abaixo são uma prévia do que será disparado.</>
            )}
            {batch.status === 'scheduled' && (
              <>⏰ <strong>Lote agendado</strong>. {phantomRows.length} CPF(s) aguardando início.</>
            )}
            {batch.status === 'processing' && (
              <>▶ <strong>Lote iniciado</strong> — materializando {phantomRows.length} CPF(s) na V8. As linhas reais aparecerão em segundos.</>
            )}
          </div>
        )}
        <div className="max-h-96 overflow-y-auto border rounded">
          <table className="w-full text-xs">
            <thead className="bg-muted sticky top-0">
              <tr>
                {/* Etapa 1 (mai/2026): nova ordem solicitada — Nome, CPF, Status, Motivo,
                    Valor liberado, Parcelas, Valor parcela, Tentativas, Payload. */}
                <th className="px-2 py-1 text-left">Nome</th>
                <th className="px-2 py-1 text-left">CPF</th>
                <th className="px-2 py-1 text-left">Status</th>
                <th className="px-2 py-1 text-left">Motivo</th>
                <th className="px-2 py-1 text-right" title="Valor liberado. Quando vem do webhook da consulta, é uma ESTIMATIVA (máximo da faixa V8). O valor real só é calculado ao clicar em 'Simular selecionados'.">Valor liberado</th>
                <th className="px-2 py-1 text-center" title="Nº de parcelas usadas na simulação. Em cinza = ainda não simulado, mostra o configurado no lote. ⚠️ = V8 ajustou para caber nos limites do CPF.">Parcelas</th>
                <th className="px-2 py-1 text-right" title="Parcela mensal. Estimativa enquanto a simulação real não foi rodada.">Valor parcela</th>
                <th className="px-2 py-1 text-center">Tentativas</th>
                <th className="px-2 py-1 text-center w-10" title="Ver payload completo (JSON cru recebido da V8 e tentativas registradas)">Payload</th>
              </tr>
            </thead>
            <tbody>
              {displaySims.map((s) => {
                if ((s as any).__phantom) {
                  return (
                    <tr key={s.id} className="border-t bg-muted/30">
                      <td className="px-2 py-1">{(s as any).name || <span className="text-muted-foreground">—</span>}</td>
                      <td className="px-2 py-1 font-mono">{s.cpf}</td>
                      <td className="px-2 py-1">
                        <Badge variant="outline" className="border-blue-400/50 text-blue-700 bg-blue-500/10">
                          {(s as any).__phantomLabel}
                        </Badge>
                      </td>
                      <td className="px-2 py-1 align-top text-muted-foreground italic text-[11px]">
                        Aguardando o lote ser disparado na V8
                      </td>
                      <td className="px-2 py-1 text-right text-muted-foreground">—</td>
                      <td className="px-2 py-1 text-center text-muted-foreground">
                        {parcelas ? <span className="text-muted-foreground">({parcelas}x)</span> : '—'}
                      </td>
                      <td className="px-2 py-1 text-right text-muted-foreground">—</td>
                      <td className="px-2 py-1 text-center text-muted-foreground">0</td>
                      <td className="px-2 py-1 text-center text-muted-foreground">—</td>
                    </tr>
                  );
                }
                const ws = ((s as any).webhook_status || '').toUpperCase();
                const k = (s as any).error_kind || s.raw_response?.kind || s.raw_response?.error_kind || null;
                const isWaitingExternal = s.status === 'pending' && (k === 'active_consult' || ws === 'WAITING_EXTERNAL');
                const inst = (s as any).installments;
                const clampApplied = !!(s as any).raw_response?.clamp_applied;
                const clampNote = (s as any).raw_response?.clamp_note as string | null | undefined;
                return (
                  <tr key={s.id} className="border-t">
                    <td className="px-2 py-1">{(s as any).name || <span className="text-muted-foreground">—</span>}</td>
                    <td className="px-2 py-1 font-mono">{s.cpf}</td>
                    <td className="px-2 py-1">
                      <Badge
                        variant={getSimulationStatusVariant(s)}
                        className={isWaitingExternal ? 'border-yellow-500/50 text-yellow-700 bg-yellow-500/10' : undefined}
                      >
                        {getSimulationStatusLabel(s)}
                      </Badge>
                    </td>
                    <td className="px-2 py-1 align-top">
                      <ReasonCell s={s} onCheckStatus={onCheckStatus} />
                    </td>
                    <td className="px-2 py-1 text-right">
                      {s.released_value != null ? (
                        <span title={(s.simulate_status ?? 'not_started') !== 'success' ? 'Estimativa (máximo da faixa V8). Clique em "Simular selecionados" para o valor real.' : 'Valor real calculado pela V8 via /simulation.'}>
                          R$ {Number(s.released_value).toFixed(2)}
                          {(s.simulate_status ?? 'not_started') !== 'success' && (
                            <span className="ml-1 text-[9px] text-amber-600 align-top">~est</span>
                          )}
                        </span>
                      ) : '—'}
                    </td>
                    <td className="px-2 py-1 text-center">
                      <div className="inline-flex items-center justify-center gap-1">
                        {inst != null ? (
                          <span className="font-medium">{inst}x</span>
                        ) : parcelas ? (
                          <span className="text-muted-foreground" title="Parcela configurada no lote — ainda não confirmada pela V8">
                            ({parcelas}x)
                          </span>
                        ) : (
                          <span className="text-muted-foreground">—</span>
                        )}
                        {clampApplied && (
                          <TooltipProvider>
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <AlertTriangle className="w-3 h-3 text-amber-500 cursor-help" />
                              </TooltipTrigger>
                              <TooltipContent side="top" className="max-w-xs text-xs">
                                A V8 não aceitou a parcela escolhida no lote para este CPF. O sistema ajustou automaticamente para o valor permitido.
                                {clampNote ? <div className="mt-1 italic text-muted-foreground">{clampNote}</div> : null}
                              </TooltipContent>
                            </Tooltip>
                          </TooltipProvider>
                        )}
                      </div>
                    </td>
                    <td className="px-2 py-1 text-right">{s.installment_value != null ? `R$ ${Number(s.installment_value).toFixed(2)}` : '—'}</td>
                    <td
                      className={`px-2 py-1 text-center ${(s.attempt_count ?? 0) >= 2 ? 'font-bold text-amber-600' : ''}`}
                      title={(() => {
                        const k = (s as any).error_kind || s.raw_response?.kind || s.raw_response?.error_kind || null;
                        const n = s.attempt_count ?? 0;
                        const linhas = [
                          'Existem DOIS contadores diferentes:',
                          '1) Chamadas completas (esta coluna): cada vez que o sistema reabre o ciclo /consult → /authorize → /simulation contra a V8 para este CPF. Sobe de 1 em 1 a cada nova tentativa do auto-retry.',
                          `2) Retentativas internas (invisíveis): dentro de UMA chamada completa, o servidor já tenta sozinho cada endpoint múltiplas vezes em caso de 5xx/429. Limites configurados em Configurações: /consult até ${'<configurado>'}x, /authorize até ${'<configurado>'}x, /simulation até ${'<configurado>'}x.`,
                          '',
                          `Estado atual: ${n} chamada(s) completa(s) usada(s) de até ${maxAutoRetry}.`,
                        ];
                        if (k === 'active_consult') {
                          linhas.push('Motivo "active_consult" não retenta automaticamente: o cliente já tem uma consulta ativa na V8. Aguarde a V8 finalizar a consulta original ou cancele-a no painel V8 antes de tentar de novo.');
                        } else if (k && !isRetriableErrorKind(k)) {
                          linhas.push(`Motivo "${k}" é FINAL — não vai subir mais. Casos como rejected_by_v8, invalid_data e existing_proposal exigem ação humana (cancelar consulta antiga, corrigir cadastro).`);
                        } else if (isRetriableErrorKind(k)) {
                          linhas.push(`Motivo "${k}" é instabilidade temporária — auto-retry continua até ${maxAutoRetry}.`);
                        }
                        return linhas.join('\n');
                      })()}
                    >
                      {s.attempt_count ?? 0}
                      {(() => {
                        const k = (s as any).error_kind || s.raw_response?.kind || s.raw_response?.error_kind || null;
                        const n = s.attempt_count ?? 0;
                        const isActiveConsult = k === 'active_consult';
                        const isFinal = k && !isRetriableErrorKind(k) && !isActiveConsult;
                        const isRetriable = isRetriableErrorKind(k);
                        if (isActiveConsult && n > 0) {
                          return <span className="text-[10px] block text-amber-600">(aguarde V8)</span>;
                        }
                        if (isFinal && n > 0) {
                          return <span className="text-[10px] block text-muted-foreground">(final)</span>;
                        }
                        if (isRetriable) {
                          return <span className="text-[10px] block text-muted-foreground">(de até {maxAutoRetry})</span>;
                        }
                        if (n >= MAX_AUTO_RETRY_ATTEMPTS) {
                          return <span className="text-[10px] block text-destructive">(máx)</span>;
                        }
                        return null;
                      })()}
                    </td>
                    <td className="px-2 py-1 text-center align-top">
                      <div className="inline-flex items-center gap-0.5">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-6 w-6"
                          title="Ver payload completo"
                          onClick={() => setPayloadSim(s)}
                        >
                          <Eye className="w-3.5 h-3.5" />
                        </Button>
                        {onForceDispatchRow && s.status === 'pending' && (Number(s.attempt_count ?? 0) === 0 || (s.last_attempt_at && Date.now() - new Date(s.last_attempt_at).getTime() > 5 * 60 * 1000)) && (
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-6 w-6 text-amber-600 hover:text-amber-700"
                            title="Forçar dispatch — re-disparar consulta na V8 (ignora dedupe)"
                            onClick={() => onForceDispatchRow(s)}
                          >
                            <Zap className="w-3.5 h-3.5" />
                          </Button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </CardContent>
      <PayloadInspectorDialog
        open={!!payloadSim}
        onOpenChange={(o) => !o && setPayloadSim(null)}
        simulation={payloadSim}
      />
    </Card>
  );
}

function ReasonCell({ s, onCheckStatus }: { s: any; onCheckStatus: (cpf: string, id?: string) => void }) {
  const kind = s.error_kind || s.raw_response?.kind || s.raw_response?.error_kind || null;
  const isActiveConsult = kind === 'active_consult';
  const isDuplicate = kind === 'duplicate_recent' || s.status === 'skipped';
  // Etapa 1 (item 2): strip defensivo removido. Backfill já limpou linhas antigas
  // com prefixo "Rejeitada pela V8: " e o webhook/poller não regrava mais esse texto.
  const message = getV8ErrorMessageDeduped(s.raw_response, s.error_message);
  const meta = getV8ErrorMeta(s.raw_response);
  const hasErrorInfo = !!(s.error_message || message || s.raw_response);

  if (isDuplicate) {
    const originalId = s.raw_response?.original_id ?? null;
    const windowDays = s.raw_response?.window_days ?? 7;
    return (
      <div className="space-y-1">
        <div className="font-medium text-amber-600">Duplicado recente</div>
        <div className="text-[11px] text-muted-foreground">
          CPF já consultado nos últimos {windowDays} dia(s). Nova consulta evitada para não abrir propostas paralelas na V8.
        </div>
        {originalId && (
          <a
            href={`/admin/v8-simulador?tab=historico&sim=${originalId}`}
            className="text-[11px] underline text-primary"
          >
            Ver consulta original
          </a>
        )}
      </div>
    );
  }

  // Sucesso — não é falha, então mostra o estado da etapa de simulação.
  if (s.status === 'success') {
    const simStatus = s.simulate_status ?? 'not_started';
    if (simStatus === 'success') {
      return <span className="text-emerald-600">Proposta calculada</span>;
    }
    if (simStatus === 'failed') {
      // FIX 4: prioriza simulate_error_message (coluna dedicada). Se não houver,
      // tenta extrair do error_message como fallback. Mostra motivo real da V8.
      const simReason = (typeof s.simulate_error_message === 'string' && s.simulate_error_message.trim())
        ? s.simulate_error_message.trim()
        : null;
      // Detecta o erro mais comum: V8 recusou porque a parcela default
      // bateu no teto da margem disponível. Nesse caso o operador precisa
      // saber que basta deixar o "valor" em branco (auto-melhor aplica 0,95).
      const isMarginCap = simReason
        && /parcela.*acima.*margem|valor.*parcela.*margem/i.test(simReason);
      return (
        <div className="space-y-0.5">
          <div className="text-amber-600">
            Margem aprovada · simulação falhou
            {simReason ? <>: <span className="font-medium">{simReason}</span></> : ''}
          </div>
          <div className="text-[11px] text-muted-foreground italic">
            Tente "Encontrar proposta viável" para escolher outro prazo/valor.
          </div>
          {isMarginCap && (
            <div className="text-[11px] text-emerald-600">
              💡 Dica: deixe o campo "Valor" em branco e clique em "Simular selecionados" — o sistema aplica fator de segurança 0,95 igual ao botão 🔍 da aba Operações.
            </div>
          )}
        </div>
      );
    }
    return <span className="text-muted-foreground">Margem aprovada — clique em "Simular selecionados" para calcular a proposta</span>;
  }

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
            {snapshot.name && <div><span className="text-muted-foreground">Nome:</span> {snapshot.name}</div>}
            {snapshot.detail && <div className="text-muted-foreground italic">{snapshot.detail}</div>}
          </div>
          <Button size="sm" variant="ghost" className="h-6 px-2 text-[10px]" onClick={() => onCheckStatus(s.cpf, s.id)}>
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
        <Button size="sm" variant="outline" onClick={() => onCheckStatus(s.cpf, s.id)}>
          <Search className="w-3 h-3 mr-1" /> Ver status na V8
        </Button>
      </div>
    );
  }

  if (s.status === 'pending' && !s.last_attempt_at) {
    return (
      <span className="flex items-center gap-2 text-blue-500">
        <Loader2 className="w-3 h-3 animate-spin" />
        Disparando consulta na V8…
      </span>
    );
  }
  if (s.status === 'pending' && !hasErrorInfo) {
    const elapsed = s.processed_at ? Math.floor((Date.now() - new Date(s.processed_at).getTime()) / 1000) : null;
    const noWebhook = !s.last_attempt_at && !s.raw_response;
    return (
      <span className="text-muted-foreground">
        Aguardando retorno da V8 (via webhook)
        {elapsed != null && elapsed > 60 ? ` · há ${elapsed}s` : ''}
        {noWebhook && elapsed != null && elapsed > 120 ? ' · webhook ainda não chegou' : ''}
      </span>
    );
  }
  if (hasErrorInfo) {
    return (
      <div className="space-y-1">
        <div className="whitespace-pre-line font-medium">{message || 'Falha sem detalhe retornado'}</div>
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
  return <>—</>;
}
