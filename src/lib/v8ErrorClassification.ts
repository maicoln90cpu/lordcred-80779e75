/**
 * Classificação de erros V8 — versão TypeScript pura, espelho fiel da lógica
 * em `supabase/functions/v8-clt-api/index.ts` (`detectV8ErrorKind`).
 *
 * Duplicação intencional: edge functions rodam em Deno e não compartilham módulos
 * com `src/`. Mantemos esta cópia para permitir testes Vitest que travam o
 * comportamento esperado e detectam regressões (padrão já usado em
 * `invokeEdgeWithRetry.extended.test.ts`).
 *
 * SE MUDAR AQUI, MUDE TAMBÉM em `supabase/functions/v8-clt-api/index.ts`
 * e vice-versa. O teste em `__tests__/v8ErrorClassification.test.ts`
 * documenta os casos críticos.
 */

export type V8ErrorKind =
  | 'active_consult'
  | 'analysis_pending'
  | 'existing_proposal'
  | 'temporary_v8'
  | 'invalid_data'
  | 'unknown';

export interface V8ErrorInput {
  title?: string | null;
  detail?: string | null;
  message?: string | null;
  error?: string | null;
  rawText?: string | null;
  status?: number | null;
}

export function detectV8ErrorKind(input: V8ErrorInput = {}): V8ErrorKind {
  const haystack = [
    input.title,
    input.detail,
    input.message,
    input.error,
    input.rawText,
  ]
    .filter(Boolean)
    .join(' ')
    .toLowerCase();

  if (
    haystack.includes('já existe uma consulta ativa') ||
    haystack.includes('ja existe uma consulta ativa')
  ) {
    return 'active_consult';
  }
  if (haystack.includes('ainda em análise') || haystack.includes('ainda em analise')) {
    return 'analysis_pending';
  }
  if (
    (haystack.includes('operation') && haystack.includes('already')) ||
    haystack.includes('proposta já existente') ||
    haystack.includes('proposta ja existente')
  ) {
    return 'existing_proposal';
  }
  // Rate limit V8 — HTTP 429 e textos observados em produção.
  if (
    Number(input.status) === 429 ||
    haystack.includes('limite de requisições excedido') ||
    haystack.includes('limite de requisicoes excedido') ||
    haystack.includes('rate limit')
  ) {
    return 'temporary_v8';
  }
  if (Number(input.status) >= 500) {
    return 'temporary_v8';
  }
  if (Number(input.status) >= 400) {
    return 'invalid_data';
  }
  return 'unknown';
}

/**
 * Conjunto de kinds que podem ser retentados automaticamente.
 * Usado pelo botão "Retentar falhados" para filtrar quais linhas reprocessar.
 *
 *  - temporary_v8     → instabilidade/rate limit, retentar com backoff resolve
 *  - analysis_pending → V8 ainda processando, basta esperar e retentar
 *
 * NÃO inclui:
 *  - active_consult    → o cliente já tem consulta ativa, retentar gera mais erro
 *  - existing_proposal → proposta já existe, ação humana necessária
 *  - invalid_data      → erro de payload, precisa corrigir cadastro
 */
export const RETRIABLE_ERROR_KINDS: ReadonlySet<V8ErrorKind> = new Set([
  'temporary_v8',
  'analysis_pending',
]);

export function isRetriableErrorKind(kind: string | null | undefined): boolean {
  return !!kind && RETRIABLE_ERROR_KINDS.has(kind as V8ErrorKind);
}

/**
 * Limite máximo de tentativas automáticas por CPF dentro de um lote.
 * Erros temporários (rate limit, 5xx, análise pendente) são re-disparados
 * em background até esse teto. Acima disso, vira responsabilidade humana
 * (clicar em "Retentar falhados" ou abrir um novo lote).
 */
export const MAX_AUTO_RETRY_ATTEMPTS = 15;

/**
 * Decide se uma simulação falhada deve entrar na próxima rodada de auto-retry.
 * Combina classe do erro (retentável) com cap de tentativas (15).
 */
export function shouldAutoRetry(
  kind: string | null | undefined,
  attemptCount: number | null | undefined,
): boolean {
  if (!isRetriableErrorKind(kind)) return false;
  const attempts = Number(attemptCount ?? 0);
  return attempts < MAX_AUTO_RETRY_ATTEMPTS;
}
