/**
 * Teste de PARIDADE — importa exatamente o mesmo módulo usado pelo
 * v8-retry-cron (Deno). Se a regra mudar lá, este teste quebra aqui.
 *
 * Cobre os 8 cenários de transição da regra de force_dispatch + retry kinds.
 */
import { describe, it, expect } from 'vitest';
import {
  isRetryEligible,
  classifyTriggeredBy,
  RETRIABLE_KINDS,
} from '../../../supabase/functions/_shared/v8RetryEligibility';

const NOW = Date.UTC(2026, 4, 6, 12, 0, 0);
const minutesAgo = (m: number) => new Date(NOW - m * 60_000).toISOString();
const cfg = (enabled = true, afterMs = 300_000) => ({
  forceDispatchEnabled: enabled,
  forceDispatchAfterMs: afterMs,
});

describe('isRetryEligible — paridade com v8-retry-cron', () => {
  it('força disparo: pending, attempt=0, idade > janela, toggle ON', () => {
    expect(isRetryEligible(
      { status: 'pending', attempt_count: 0, error_kind: null, last_attempt_at: null, created_at: minutesAgo(6) },
      NOW, cfg(true, 300_000),
    )).toBe(true);
  });

  it('toggle OFF nunca força disparo', () => {
    expect(isRetryEligible(
      { status: 'pending', attempt_count: 0, error_kind: null, last_attempt_at: null, created_at: minutesAgo(60) },
      NOW, cfg(false),
    )).toBe(false);
  });

  it('idade < janela => não dispara', () => {
    expect(isRetryEligible(
      { status: 'pending', attempt_count: 0, error_kind: null, last_attempt_at: null, created_at: minutesAgo(2) },
      NOW, cfg(true, 300_000),
    )).toBe(false);
  });

  it('janela mínima 60s', () => {
    expect(isRetryEligible(
      { status: 'pending', attempt_count: 0, error_kind: null, last_attempt_at: null, created_at: minutesAgo(2) },
      NOW, cfg(true, 60_000),
    )).toBe(true);
  });

  it('janela máxima 1800s não dispara antes de 30 min', () => {
    expect(isRetryEligible(
      { status: 'pending', attempt_count: 0, error_kind: null, last_attempt_at: null, created_at: minutesAgo(20) },
      NOW, cfg(true, 1_800_000),
    )).toBe(false);
    expect(isRetryEligible(
      { status: 'pending', attempt_count: 0, error_kind: null, last_attempt_at: null, created_at: minutesAgo(31) },
      NOW, cfg(true, 1_800_000),
    )).toBe(true);
  });

  it('attempt > 0 sem kind: janela legada 2 min', () => {
    expect(isRetryEligible(
      { status: 'pending', attempt_count: 1, error_kind: null, last_attempt_at: minutesAgo(1), created_at: minutesAgo(10) },
      NOW, cfg(true),
    )).toBe(false);
    expect(isRetryEligible(
      { status: 'pending', attempt_count: 1, error_kind: null, last_attempt_at: minutesAgo(3), created_at: minutesAgo(10) },
      NOW, cfg(true),
    )).toBe(true);
  });

  it('kinds retentáveis sempre elegíveis (mesmo com toggle OFF)', () => {
    for (const kind of Array.from(RETRIABLE_KINDS)) {
      expect(isRetryEligible(
        { status: 'failed', attempt_count: 5, error_kind: kind, last_attempt_at: minutesAgo(1), created_at: minutesAgo(10) },
        NOW, cfg(false),
      )).toBe(true);
    }
  });

  it('kind não retentável + failed: nunca reentra', () => {
    expect(isRetryEligible(
      { status: 'failed', attempt_count: 1, error_kind: 'invalid_data', last_attempt_at: minutesAgo(60), created_at: minutesAgo(120) },
      NOW, cfg(true, 60_000),
    )).toBe(false);
  });
});

describe('classifyTriggeredBy', () => {
  it('rotula force_dispatch quando pending+attempt=0', () => {
    expect(classifyTriggeredBy({
      status: 'pending', attempt_count: 0, error_kind: null, last_attempt_at: null, created_at: null,
    })).toBe('force_dispatch');
  });
  it('rotula cron caso contrário', () => {
    expect(classifyTriggeredBy({
      status: 'pending', attempt_count: 3, error_kind: null, last_attempt_at: null, created_at: null,
    })).toBe('cron');
    expect(classifyTriggeredBy({
      status: 'failed', attempt_count: 0, error_kind: 'temporary_v8', last_attempt_at: null, created_at: null,
    })).toBe('cron');
  });
});
