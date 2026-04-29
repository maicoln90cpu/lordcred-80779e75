import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Loader2, Search } from 'lucide-react';
import { MargemDispCell } from '../MargemDispCell';
import { RealtimeFreshness, AutoRetryIndicator } from './BatchAnimations';
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
}

/**
 * Tabela "Progresso do Lote" — apenas UI. Recebe simulações e callbacks via props.
 * Mantém a coluna Parcelas conforme planejado em .lovable/plan.md.
 */
export default function BatchProgressTable({
  simulations, parcelas, lastUpdateAt, maxAutoRetry,
  awaitingManualSim, showManualWarning, actionsSlot, onCheckStatus,
}: Props) {
  const total = simulations.length;
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
        {showManualWarning && (
          <div className="rounded-md border border-yellow-500/40 bg-yellow-500/10 p-3 text-xs leading-relaxed">
            ⚠️ <strong>{awaitingManualSim} consulta(s) com margem aprovada aguardando simulação.</strong>{' '}
            A V8 já liberou a margem desses CPFs, mas o cálculo de parcela e valor liberado ainda não foi feito.
            Clique em <strong>"Simular selecionados"</strong> (botão amarelo pulsante acima) para finalizar.
            Ou ative o toggle <em>"Simular automaticamente após consulta"</em> em Configurações.
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
        <div className="max-h-96 overflow-y-auto border rounded">
          <table className="w-full text-xs">
            <thead className="bg-muted sticky top-0">
              <tr>
                <th className="px-2 py-1 text-left">CPF</th>
                <th className="px-2 py-1 text-left">Status</th>
                <th className="px-2 py-1 text-center" title="Nº de parcelas usadas na simulação. Em cinza = ainda não simulado, mostra o configurado no lote.">Parcelas</th>
                <th className="px-2 py-1 text-right" title="Margem consignável disponível do trabalhador na V8 (availableMarginValue). É o teto de parcela CLT que o cliente pode contratar.">
                  💰 Margem Disp.
                </th>
                <th className="px-2 py-1 text-right" title="Valor liberado. Quando vem do webhook da consulta, é uma ESTIMATIVA (máximo da faixa V8). O valor real só é calculado ao clicar em 'Simular selecionados'.">Liberado</th>
                <th className="px-2 py-1 text-right" title="Parcela mensal. Estimativa enquanto a simulação real não foi rodada.">Parcela</th>
                <th className="px-2 py-1 text-right" title="Cálculo interno LordCred — não é enviado à V8">Margem LordCred</th>
                <th className="px-2 py-1 text-right" title="Valor liberado menos a margem LordCred">A cobrar</th>
                <th className="px-2 py-1 text-center">Tentativas</th>
                <th className="px-2 py-1 text-left">Motivo</th>
              </tr>
            </thead>
            <tbody>
              {simulations.map((s) => {
                const ws = ((s as any).webhook_status || '').toUpperCase();
                const k = (s as any).error_kind || s.raw_response?.kind || s.raw_response?.error_kind || null;
                const isWaitingExternal = s.status === 'pending' && (k === 'active_consult' || ws === 'WAITING_EXTERNAL');
                const inst = (s as any).installments;
                return (
                  <tr key={s.id} className="border-t">
                    <td className="px-2 py-1 font-mono">{s.cpf}</td>
                    <td className="px-2 py-1">
                      <Badge
                        variant={getSimulationStatusVariant(s)}
                        className={isWaitingExternal ? 'border-yellow-500/50 text-yellow-700 bg-yellow-500/10' : undefined}
                      >
                        {getSimulationStatusLabel(s)}
                      </Badge>
                    </td>
                    <td className="px-2 py-1 text-center">
                      {inst != null ? (
                        <span className="font-medium">{inst}x</span>
                      ) : parcelas ? (
                        <span className="text-muted-foreground" title="Parcela configurada no lote — ainda não confirmada pela V8">
                          ({parcelas}x)
                        </span>
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </td>
                    <td className="px-2 py-1 text-right"><MargemDispCell simulation={s as any} /></td>
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
                    <td className="px-2 py-1 text-right">{s.installment_value != null ? `R$ ${Number(s.installment_value).toFixed(2)}` : '—'}</td>
                    <td className="px-2 py-1 text-right">{s.company_margin != null ? `R$ ${Number(s.company_margin).toFixed(2)}` : '—'}</td>
                    <td className="px-2 py-1 text-right">{s.amount_to_charge != null ? `R$ ${Number(s.amount_to_charge).toFixed(2)}` : '—'}</td>
                    <td
                      className={`px-2 py-1 text-center ${(s.attempt_count ?? 0) >= 2 ? 'font-bold text-amber-600' : ''}`}
                      title={(() => {
                        const k = (s as any).error_kind || s.raw_response?.kind || s.raw_response?.error_kind || null;
                        if (k && !isRetriableErrorKind(k)) return `Esta linha não é retentável automaticamente (motivo: ${k}). Auto-retry só vale para temporary_v8 e analysis_pending.`;
                        return `Tentativas usadas / teto configurado (${maxAutoRetry}).`;
                      })()}
                    >
                      {s.attempt_count ?? 0}
                      {(s.attempt_count ?? 0) >= MAX_AUTO_RETRY_ATTEMPTS && <span className="text-[10px] block text-destructive">(máx)</span>}
                    </td>
                    <td className="px-2 py-1 align-top">
                      <ReasonCell s={s} onCheckStatus={onCheckStatus} />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </CardContent>
    </Card>
  );
}

function ReasonCell({ s, onCheckStatus }: { s: any; onCheckStatus: (cpf: string, id?: string) => void }) {
  const kind = s.raw_response?.kind || s.raw_response?.error_kind || null;
  const isActiveConsult = kind === 'active_consult';
  const message = getV8ErrorMessageDeduped(s.raw_response, s.error_message);
  const meta = getV8ErrorMeta(s.raw_response);
  const hasErrorInfo = !!(s.error_message || message || s.raw_response);

  // Sucesso — não é falha, então mostra o estado da etapa de simulação.
  if (s.status === 'success') {
    const simStatus = s.simulate_status ?? 'not_started';
    if (simStatus === 'success') {
      return <span className="text-emerald-600">Proposta calculada</span>;
    }
    if (simStatus === 'failed') {
      return <span className="text-amber-600">Margem aprovada · simulação falhou — tente "Encontrar proposta viável"</span>;
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
