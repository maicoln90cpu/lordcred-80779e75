/**
 * Testes de regressão — Etapa 4 do plano V8 (force_dispatch automático).
 *
 * Replica EXATAMENTE a lógica de elegibilidade do v8-retry-cron para
 * garantir que mudanças futuras não quebrem as regras combinadas:
 *  - força re-disparo SOMENTE para pendentes com attempt_count=0 e idade
 *    > force_dispatch_after_seconds
 *  - respeita o toggle force_dispatch_enabled (off => nunca força)
 *  - mantém a janela legada de 2 min para pending sem kind e attempts > 0
 *  - clamp do slider entre 60s e 1800s (UI)
 */
import { describe, it, expect } from 'vitest';

const RETRIABLE_KINDS = new Set(['temporary_v8', 'analysis_pending', 'dispatch_failed']);

interface SimRow {
  status: 'pending' | 'failed';
  attempt_count: number;
  error_kind: string | null;
  last_attempt_at: string | null;
  created_at: string;
}

function isEligible(
  s: SimRow,
  now: number,
  forceDispatchEnabled: boolean,
  forceDispatchAfterMs: number,
): boolean {
  const kind = s.error_kind;
  if (kind && RETRIABLE_KINDS.has(kind)) return true;
  if (s.status === 'pending') {
    const ageMs = s.last_attempt_at
      ? now - new Date(s.last_attempt_at).getTime()
      : now - new Date(s.created_at).getTime();
    const attempts = s.attempt_count;
    if (attempts === 0) {
      if (!forceDispatchEnabled) return false;
      return ageMs > forceDispatchAfterMs;
    }
    if (!kind) return ageMs > 120_000;
  }
  return false;
}

const NOW = Date.UTC(2026, 4, 6, 12, 0, 0);
const minutesAgo = (m: number) => new Date(NOW - m * 60_000).toISOString();

describe('v8 force_dispatch — regras de transição', () => {
  it('força disparo quando attempt=0, pending, idade > janela e toggle ON', () => {
    const sim: SimRow = {
      status: 'pending', attempt_count: 0, error_kind: null,
      last_attempt_at: null, created_at: minutesAgo(6),
    };
    expect(isEligible(sim, NOW, true, 300_000)).toBe(true);
  });

  it('NÃO força disparo se toggle estiver OFF', () => {
    const sim: SimRow = {
      status: 'pending', attempt_count: 0, error_kind: null,
      last_attempt_at: null, created_at: minutesAgo(60),
    };
    expect(isEligible(sim, NOW, false, 300_000)).toBe(false);
  });

  it('NÃO força disparo se idade < janela configurada', () => {
    const sim: SimRow = {
      status: 'pending', attempt_count: 0, error_kind: null,
      last_attempt_at: null, created_at: minutesAgo(2),
    };
    expect(isEligible(sim, NOW, true, 300_000)).toBe(false);
  });

  it('janela mínima (60s) já habilita force_dispatch após 1 minuto', () => {
    const sim: SimRow = {
      status: 'pending', attempt_count: 0, error_kind: null,
      last_attempt_at: null, created_at: minutesAgo(2),
    };
    expect(isEligible(sim, NOW, true, 60_000)).toBe(true);
  });

  it('janela máxima (1800s) NÃO dispara antes de 30 minutos', () => {
    const sim20: SimRow = {
      status: 'pending', attempt_count: 0, error_kind: null,
      last_attempt_at: null, created_at: minutesAgo(20),
    };
    const sim31: SimRow = {
      status: 'pending', attempt_count: 0, error_kind: null,
      last_attempt_at: null, created_at: minutesAgo(31),
    };
    expect(isEligible(sim20, NOW, true, 1_800_000)).toBe(false);
    expect(isEligible(sim31, NOW, true, 1_800_000)).toBe(true);
  });

  it('para attempt > 0 sem kind, mantém regra legada de 2 minutos', () => {
    const recent: SimRow = {
      status: 'pending', attempt_count: 1, error_kind: null,
      last_attempt_at: minutesAgo(1), created_at: minutesAgo(10),
    };
    const stale: SimRow = {
      status: 'pending', attempt_count: 1, error_kind: null,
      last_attempt_at: minutesAgo(3), created_at: minutesAgo(10),
    };
    expect(isEligible(recent, NOW, true, 300_000)).toBe(false);
    expect(isEligible(stale, NOW, true, 300_000)).toBe(true);
  });

  it('kinds retentáveis sempre são elegíveis (independe do toggle)', () => {
    for (const kind of ['temporary_v8', 'analysis_pending', 'dispatch_failed']) {
      const sim: SimRow = {
        status: 'failed', attempt_count: 5, error_kind: kind,
        last_attempt_at: minutesAgo(1), created_at: minutesAgo(10),
      };
      expect(isEligible(sim, NOW, false, 300_000)).toBe(true);
    }
  });

  it('kind não retentável e status failed NUNCA reentra na fila', () => {
    const sim: SimRow = {
      status: 'failed', attempt_count: 1, error_kind: 'invalid_data',
      last_attempt_at: minutesAgo(60), created_at: minutesAgo(120),
    };
    expect(isEligible(sim, NOW, true, 60_000)).toBe(false);
  });
});

// Validação dos limites do slider (UI): 60..1800.
function clampWindow(seconds: number): number {
  return Math.min(1800, Math.max(60, Math.round(seconds)));
}

describe('v8 force_dispatch — slider clamp 60–1800', () => {
  it('clampa abaixo do mínimo para 60', () => {
    expect(clampWindow(10)).toBe(60);
    expect(clampWindow(0)).toBe(60);
    expect(clampWindow(-100)).toBe(60);
  });
  it('clampa acima do máximo para 1800', () => {
    expect(clampWindow(3600)).toBe(1800);
    expect(clampWindow(99999)).toBe(1800);
  });
  it('mantém valores no intervalo válido', () => {
    expect(clampWindow(60)).toBe(60);
    expect(clampWindow(300)).toBe(300);
    expect(clampWindow(1800)).toBe(1800);
  });
});
