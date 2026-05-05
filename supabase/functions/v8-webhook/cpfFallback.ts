// Helpers determinísticos do fallback "match por CPF" do v8-webhook.
// Mantidos isolados para serem cobertos por testes Deno sem subir Supabase.

export function extractCpfFromPayload(payload: unknown): string {
  const p = (payload ?? {}) as Record<string, any>;
  const raw =
    p?.data?.document ??
    p?.document ??
    p?.workerData?.document ??
    p?.data?.workerData?.document ??
    "";
  return String(raw).replace(/\D/g, "");
}

export function isValidCpf(cpf: string): boolean {
  return /^\d{11}$/.test(cpf);
}

export function isWithinFallbackWindow(createdAtIso: string, now: number = Date.now(), windowMs = 15 * 60 * 1000): boolean {
  const t = Date.parse(createdAtIso);
  if (Number.isNaN(t)) return false;
  return now - t <= windowMs;
}

export interface FallbackCandidate {
  id: string;
  cpf: string;
  status: string;
  consult_id: string | null;
  batch_id: string | null;
  created_at: string;
}

/** Decide se uma linha candidata é elegível para receber o consult_id do webhook. */
export function isCandidateEligible(c: FallbackCandidate, now: number = Date.now()): boolean {
  return (
    isValidCpf(c.cpf) &&
    c.status === "pending" &&
    c.consult_id == null &&
    c.batch_id != null &&
    isWithinFallbackWindow(c.created_at, now)
  );
}
