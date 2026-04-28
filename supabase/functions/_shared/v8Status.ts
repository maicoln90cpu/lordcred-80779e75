/**
 * Vocabulário OFICIAL de status da V8 (extraído da doc oficial em 2026-04-28).
 *
 * Se a V8 publicar um status fora dessas listas, registramos `unknown_*` no
 * audit_log para investigação. Não bloqueia upsert — apenas sinaliza.
 *
 * Mantenha SINCRONIZADO com `src/components/v8/V8StatusGlossary.tsx`.
 */

/** Status do ciclo de CONSULTA de margem (`/private-consignment/consult`). */
export const V8_CONSULT_STATUSES = [
  "WAITING_CONSENT",
  "CONSENT_APPROVED",
  "WAITING_CONSULT",
  "WAITING_CREDIT_ANALYSIS",
  "SUCCESS",
  "FAILED",
  "REJECTED",
] as const;

export type V8ConsultStatus = (typeof V8_CONSULT_STATUSES)[number];

/** Status do ciclo de OPERAÇÃO/proposta (`/private-consignment/operation`). */
export const V8_OPERATION_STATUSES = [
  "generating_ccb",
  "formalization",
  "analysis",
  "manual_analysis",
  "awaiting_call",
  "processing",
  "paid",
  "canceled",
  "awaiting_cancel",
  "pending",
  "refunded",
  "rejected",
] as const;

export type V8OperationStatus = (typeof V8_OPERATION_STATUSES)[number];

export type InternalConsultStatus = "success" | "failed" | "pending";

/**
 * Mapeamento doc-oficial: status V8 → status interno LordCred.
 *
 * - SUCCESS: terminal positivo (margem disponível). Único que pode promover.
 * - FAILED / REJECTED: terminal negativo.
 * - WAITING_CONSENT / CONSENT_APPROVED / WAITING_CONSULT / WAITING_CREDIT_ANALYSIS:
 *   estados intermediários — todos mapeados como `pending`.
 *
 * IMPORTANTE: `CONSENT_APPROVED` JÁ NÃO é tratado como sucesso (corrigido em
 * 2026-04-28 após confronto com a doc oficial). É apenas "termo autorizado,
 * V8 ainda vai consultar Dataprev".
 */
export function mapV8ConsultStatus(v8Status?: string | null): InternalConsultStatus | null {
  if (!v8Status) return null;
  const s = v8Status.toUpperCase();
  if (s === "SUCCESS") return "success";
  if (s === "FAILED" || s === "REJECTED" || s === "ERROR") return "failed";
  if (
    s === "WAITING_CONSENT" ||
    s === "CONSENT_APPROVED" ||
    s === "WAITING_CONSULT" ||
    s === "WAITING_CREDIT_ANALYSIS"
  ) return "pending";
  return null;
}

export function isKnownConsultStatus(s?: string | null): boolean {
  if (!s) return false;
  return (V8_CONSULT_STATUSES as readonly string[]).includes(s.toUpperCase());
}

export function isKnownOperationStatus(s?: string | null): boolean {
  if (!s) return false;
  return (V8_OPERATION_STATUSES as readonly string[]).includes(s.toLowerCase());
}

/**
 * Extrai os campos extras de um payload de consulta SUCCESS conforme doc oficial:
 * `availableMarginValue`, `admissionDateMonthsDifference`, `simulationLimit.*`.
 *
 * Retorna apenas campos válidos (números finitos). Aceita também os mesmos
 * paths em `payload.data`/`payload.latest`/`payload.result` para tolerar
 * variações observadas em produção.
 */
export interface V8ConsultExtras {
  margemValor: number | null;
  admissionMonthsDiff: number | null;
  simMonthMin: number | null;
  simMonthMax: number | null;
  simInstallmentsMin: number | null;
  simInstallmentsMax: number | null;
  simValueMin: number | null;
  simValueMax: number | null;
}

function num(v: unknown): number | null {
  if (v == null) return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

export function extractConsultExtras(payload: any): V8ConsultExtras {
  const candidates = [payload, payload?.data, payload?.latest, payload?.result].filter(Boolean);

  const pick = <T,>(get: (p: any) => T | null | undefined): T | null => {
    for (const c of candidates) {
      const v = get(c);
      if (v != null) return v as T;
    }
    return null;
  };

  return {
    margemValor: num(pick((p) => p?.availableMarginValue)),
    admissionMonthsDiff: num(pick((p) => p?.admissionDateMonthsDifference)),
    simMonthMin: num(pick((p) => p?.simulationLimit?.monthMin)),
    simMonthMax: num(pick((p) => p?.simulationLimit?.monthMax)),
    simInstallmentsMin: num(pick((p) => p?.simulationLimit?.installmentsMin)),
    simInstallmentsMax: num(pick((p) => p?.simulationLimit?.installmentsMax)),
    simValueMin: num(pick((p) => p?.simulationLimit?.valueMin)),
    simValueMax: num(pick((p) => p?.simulationLimit?.valueMax)),
  };
}

/**
 * Aplica os extras a um objeto de updates do Supabase, omitindo campos null
 * para não sobrescrever valores antigos com nulo.
 */
export function applyConsultExtras(updates: Record<string, unknown>, extras: V8ConsultExtras): void {
  if (extras.margemValor != null) updates.margem_valor = extras.margemValor;
  if (extras.admissionMonthsDiff != null) updates.admission_months_diff = extras.admissionMonthsDiff;
  if (extras.simMonthMin != null) updates.sim_month_min = extras.simMonthMin;
  if (extras.simMonthMax != null) updates.sim_month_max = extras.simMonthMax;
  if (extras.simInstallmentsMin != null) updates.sim_installments_min = extras.simInstallmentsMin;
  if (extras.simInstallmentsMax != null) updates.sim_installments_max = extras.simInstallmentsMax;
  if (extras.simValueMin != null) updates.sim_value_min = extras.simValueMin;
  if (extras.simValueMax != null) updates.sim_value_max = extras.simValueMax;
}
