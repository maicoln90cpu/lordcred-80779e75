/**
 * Guard puro do webhook V8 — espelho fiel da lógica em
 * `supabase/functions/v8-webhook/index.ts` (handler `processV8Payload`).
 *
 * Decide quais campos podem ser atualizados em `v8_simulations` ao receber
 * um evento da V8, prevenindo dois bugs históricos:
 *
 *  1. Promoção indevida para `success` sem valores monetários reais
 *     (a V8 envia `status=SUCCESS` referente à autorização da consulta,
 *     não à simulação financeira; a simulação pode ter falhado por rate limit).
 *  2. Regressão de `failed` ou `success` para `pending` quando chega um
 *     evento `WAITING_*` posterior.
 *
 * SE MUDAR AQUI, MUDE TAMBÉM em `supabase/functions/v8-webhook/index.ts`.
 */

export type InternalStatus = 'success' | 'failed' | 'pending';

export interface CurrentRow {
  status: string | null;
  released_value: number | null;
  installment_value: number | null;
}

export interface GuardDecision {
  /** Status final que será gravado, ou null se não deve mudar */
  nextStatus: InternalStatus | null;
  /** Se true, o webhook é apenas auditado (raw_response/last_webhook_at), status preservado */
  blocked: boolean;
  /** Motivo legível para logs/debug */
  reason: string;
}

/**
 * Decide se um evento webhook V8 pode atualizar o status local.
 *
 * Regras:
 *  - success só é aceito se a linha local TEM `released_value` E `installment_value`
 *  - failed só é aceito se a linha local NÃO está em `success` (não rebaixar resultado bom)
 *  - pending só é aceito se a linha local já está em `pending` (não rebaixar failed/success)
 */
export function decideWebhookStatusUpdate(
  current: CurrentRow,
  incoming: InternalStatus | null,
): GuardDecision {
  if (!incoming) {
    return { nextStatus: null, blocked: true, reason: 'no_internal_status_mapped' };
  }

  if (incoming === 'success') {
    const hasRealValues =
      current.released_value != null && current.installment_value != null;
    if (hasRealValues) {
      return { nextStatus: 'success', blocked: false, reason: 'success_with_values' };
    }
    return {
      nextStatus: null,
      blocked: true,
      reason: 'blocked_success_without_values',
    };
  }

  if (incoming === 'failed') {
    if (current.status === 'success') {
      return {
        nextStatus: null,
        blocked: true,
        reason: 'blocked_failed_after_success',
      };
    }
    return { nextStatus: 'failed', blocked: false, reason: 'failed_accepted' };
  }

  if (incoming === 'pending') {
    if (current.status === 'pending') {
      return { nextStatus: 'pending', blocked: false, reason: 'pending_kept' };
    }
    return {
      nextStatus: null,
      blocked: true,
      reason: 'blocked_regression_to_pending',
    };
  }

  return { nextStatus: null, blocked: true, reason: 'unhandled_status' };
}
