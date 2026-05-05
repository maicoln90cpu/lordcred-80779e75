/**
 * Mapeamento OFICIAL V8 ↔ INTERNO LordCred.
 *
 * A V8 expõe **9 status oficiais** (5 ciclo de consulta de margem + 4 ciclo
 * de operação/proposta — após colapsar grupos equivalentes da doc).
 *
 * O LordCred persiste **13 status internos** (sucesso/erro normalizados +
 * marcadores próprios como `temporary_v8`, `active_consult`, `cancelado`).
 *
 * Esta tabela traduz qualquer status interno (ou qualquer status cru recebido
 * da V8) para um par `{ official, internal }` exibível lado a lado na UI.
 *
 * Fonte: docs/V8-INTEGRATION.md + supabase/functions/_shared/v8Status.ts.
 *
 * Mantenha SINCRONIZADO com `V8StatusGlossary.tsx`.
 */

export type V8StatusTone = 'ok' | 'wait' | 'bad' | 'warn' | 'neutral';

export interface V8StatusPair {
  /** Bucket OFICIAL V8 (curto, exibido como tag escura). */
  official: string;
  /** Tag INTERNA LordCred (status cru ou apelido coloquial). */
  internal: string;
  /** Cor semântica para os 2 badges. */
  tone: V8StatusTone;
  /** Tooltip explicando equivalência (linguagem leiga). */
  description: string;
}

/**
 * Os 9 status OFICIAIS V8 (buckets exibidos no badge escuro).
 * Cada bucket agrupa 1+ status crus da V8 + 1+ status internos LordCred.
 */
export const V8_OFFICIAL_BUCKETS = [
  'WAITING_CONSENT',      // 1. Termo aguardando autorização
  'CONSENT_APPROVED',     // 2. Autorizado, aguardando consulta Dataprev
  'WAITING_ANALYSIS',     // 3. Em análise (consulta + crédito)
  'SUCCESS',              // 4. Margem disponível (terminal positivo da consulta)
  'REJECTED',             // 5. Sem margem / recusada (terminal negativo da consulta)
  'IN_PROGRESS',          // 6. Operação em andamento (CCB, formalização, processing)
  'PAID',                 // 7. Pago — dinheiro liberado
  'CANCELED',             // 8. Cancelada/estornada
  'PENDENCY',             // 9. Pendência aberta (PIX, docs, ligação)
] as const;

export type V8OfficialBucket = (typeof V8_OFFICIAL_BUCKETS)[number];

interface BucketDef {
  bucket: V8OfficialBucket;
  tone: V8StatusTone;
  description: string;
}

/** Definição de cada bucket oficial. */
const BUCKETS: Record<V8OfficialBucket, BucketDef> = {
  WAITING_CONSENT:   { bucket: 'WAITING_CONSENT',   tone: 'wait', description: 'Termo de consentimento criado, aguardando autorização do trabalhador.' },
  CONSENT_APPROVED:  { bucket: 'CONSENT_APPROVED',  tone: 'wait', description: 'Trabalhador autorizou e a V8 já tem a margem mensal disponível (availableMarginValue). Falta apenas o cálculo de parcela/valor liberado — clique em "Simular selecionados" ou ative "Auto-melhor" para fechar a proposta.' },
  WAITING_ANALYSIS:  { bucket: 'WAITING_ANALYSIS',  tone: 'wait', description: 'Em análise (consulta de margem ou crédito).' },
  SUCCESS:           { bucket: 'SUCCESS',           tone: 'ok',   description: 'Consulta concluída com margem disponível.' },
  REJECTED:          { bucket: 'REJECTED',          tone: 'bad',  description: 'Sem margem ou recusada na análise de crédito.' },
  IN_PROGRESS:       { bucket: 'IN_PROGRESS',       tone: 'wait', description: 'Operação em andamento: CCB, formalização ou processamento.' },
  PAID:              { bucket: 'PAID',              tone: 'ok',   description: 'Pago — dinheiro liberado para o cliente.' },
  CANCELED:          { bucket: 'CANCELED',          tone: 'bad',  description: 'Cancelada, recusada na análise final ou estornada.' },
  PENDENCY:          { bucket: 'PENDENCY',          tone: 'warn', description: 'Pendência aberta — requer ação (PIX, docs, ligação).' },
};

/**
 * Tradução completa: qualquer status (cru V8 ou interno LordCred) → bucket oficial.
 * Chaves em UPPERCASE para casamento case-insensitive.
 */
const STATUS_TO_BUCKET: Record<string, V8OfficialBucket> = {
  // ===== Ciclo CONSULTA de margem (status crus V8 + internos) =====
  WAITING_CONSENT: 'WAITING_CONSENT',
  CONSENT_APPROVED: 'CONSENT_APPROVED',
  WAITING_CONSULT: 'WAITING_ANALYSIS',
  WAITING_CREDIT_ANALYSIS: 'WAITING_ANALYSIS',
  ANALYSIS_PENDING: 'WAITING_ANALYSIS',                // interno
  ACTIVE_CONSULT: 'WAITING_ANALYSIS',                  // interno
  'AGUARDANDO CONSULTA ANTIGA': 'WAITING_ANALYSIS',    // interno coloquial
  TEMPORARY_V8: 'WAITING_ANALYSIS',                    // interno (instabilidade)

  SUCCESS: 'SUCCESS',
  APPROVED: 'SUCCESS',
  DONE: 'SUCCESS',

  REJECTED: 'REJECTED',
  FAILED: 'REJECTED',
  ERROR: 'REJECTED',

  // ===== Ciclo OPERAÇÃO/proposta (status crus V8) =====
  GENERATING_CCB: 'IN_PROGRESS',
  FORMALIZATION: 'IN_PROGRESS',
  ANALYSIS: 'IN_PROGRESS',
  MANUAL_ANALYSIS: 'IN_PROGRESS',
  PROCESSING: 'IN_PROGRESS',

  PAID: 'PAID',

  CANCELED: 'CANCELED',
  CANCELLED: 'CANCELED',
  AWAITING_CANCEL: 'CANCELED',
  REFUNDED: 'CANCELED',
  EXPIRED: 'CANCELED',
  CANCELADO: 'CANCELED',                               // interno PT-BR

  // Pendências (todos viram bucket PENDENCY com tag interna específica)
  PENDING: 'PENDENCY',
  PENDING_PIX: 'PENDENCY',
  PENDING_PAYMENT_DATA: 'PENDENCY',
  PENDING_DOCUMENTS: 'PENDENCY',
  PENDING_DOCUMENTATION: 'PENDENCY',
  PENDING_SIGNATURE_DOCUMENTS: 'PENDENCY',
  AWAITING_CALL: 'PENDENCY',
};

/**
 * Resolve o par `{ official, internal, tone, description }` para qualquer status.
 * - `internal` é o valor cru recebido (preservado para o operador).
 * - `official` é o bucket V8 (1 dos 9).
 * - Se não reconhecido: bucket fica como o próprio valor com tone neutral.
 */
export function resolveV8StatusPair(rawStatus?: string | null): V8StatusPair {
  const raw = String(rawStatus ?? '').trim();
  if (!raw) {
    return { official: '—', internal: '—', tone: 'neutral', description: 'Sem status reportado.' };
  }
  const key = raw.toUpperCase();
  const bucket = STATUS_TO_BUCKET[key];
  if (!bucket) {
    return {
      official: raw,
      internal: raw,
      tone: 'neutral',
      description: 'Status desconhecido — não consta no mapeamento oficial. Verifique o JSON bruto.',
    };
  }
  const def = BUCKETS[bucket];
  return {
    official: def.bucket,
    internal: raw,
    tone: def.tone,
    description: def.description,
  };
}

/** Classes Tailwind por tom (semantic tokens). */
export const V8_TONE_CLASSES: Record<V8StatusTone, string> = {
  ok:      'bg-success/15 text-success border-success/30',
  wait:    'bg-info/15 text-info border-info/30',
  bad:     'bg-destructive/15 text-destructive border-destructive/30',
  warn:    'bg-warning/15 text-warning border-warning/30',
  neutral: 'bg-muted text-muted-foreground border-border',
};

export function getV8ToneClass(tone: V8StatusTone): string {
  return V8_TONE_CLASSES[tone];
}
