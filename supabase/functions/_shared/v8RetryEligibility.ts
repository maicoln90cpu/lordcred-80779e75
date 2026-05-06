/**
 * Regra única de elegibilidade para retry/force_dispatch.
 *
 * Compartilhada entre:
 *  - supabase/functions/v8-retry-cron/index.ts (Deno runtime)
 *  - src/lib/__tests__/v8RetryEligibility.parity.test.ts (Vitest/Node)
 *
 * TS puro, zero deps — funciona em ambos os ambientes. Garante que mudanças
 * na regra do cron sempre quebrem os testes (paridade real).
 */

export const RETRIABLE_KINDS = new Set<string>([
  "temporary_v8",
  "analysis_pending",
  "dispatch_failed",
]);

export interface RetryEligibilityInput {
  status: string;
  attempt_count: number | null | undefined;
  error_kind: string | null | undefined;
  last_attempt_at: string | null | undefined;
  created_at: string | null | undefined;
}

export interface RetryEligibilityConfig {
  forceDispatchEnabled: boolean;
  /** Janela em ms para attempt_count=0 com pending. */
  forceDispatchAfterMs: number;
  /** Janela legada (default 120s) para pending sem kind e attempts > 0. */
  legacyPendingWindowMs?: number;
}

export function isRetryEligible(
  s: RetryEligibilityInput,
  now: number,
  cfg: RetryEligibilityConfig,
): boolean {
  const kind = s.error_kind ?? null;
  if (kind && RETRIABLE_KINDS.has(kind)) return true;

  if (s.status === "pending") {
    const ageMs = s.last_attempt_at
      ? now - new Date(s.last_attempt_at).getTime()
      : now - new Date(s.created_at ?? new Date(now).toISOString()).getTime();
    const attempts = Number(s.attempt_count ?? 0);
    if (attempts === 0) {
      if (!cfg.forceDispatchEnabled) return false;
      return ageMs > cfg.forceDispatchAfterMs;
    }
    if (!kind) return ageMs > (cfg.legacyPendingWindowMs ?? 120_000);
  }
  return false;
}

/** Rótulo de telemetria (audit logs) — distingue force_dispatch de cron normal. */
export function classifyTriggeredBy(s: RetryEligibilityInput): "force_dispatch" | "cron" {
  if (s.status === "pending" && Number(s.attempt_count ?? 0) === 0) return "force_dispatch";
  return "cron";
}
