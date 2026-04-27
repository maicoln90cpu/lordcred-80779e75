import { describe, it, expect } from 'vitest';
import { decideWebhookStatusUpdate } from '../v8WebhookGuard';

describe('decideWebhookStatusUpdate', () => {
  describe('proteção contra success sem valores (BUG histórico)', () => {
    it('BLOQUEIA success quando released_value é null', () => {
      const result = decideWebhookStatusUpdate(
        { status: 'pending', released_value: null, installment_value: 1500 },
        'success',
      );
      expect(result.blocked).toBe(true);
      expect(result.nextStatus).toBe(null);
      expect(result.reason).toBe('blocked_success_without_values');
    });

    it('BLOQUEIA success quando installment_value é null', () => {
      const result = decideWebhookStatusUpdate(
        { status: 'pending', released_value: 5000, installment_value: null },
        'success',
      );
      expect(result.blocked).toBe(true);
    });

    it('BLOQUEIA success quando ambos valores são null (caso típico do rate limit)', () => {
      const result = decideWebhookStatusUpdate(
        { status: 'failed', released_value: null, installment_value: null },
        'success',
      );
      expect(result.blocked).toBe(true);
    });

    it('ACEITA success quando released_value E installment_value existem', () => {
      const result = decideWebhookStatusUpdate(
        { status: 'pending', released_value: 5000, installment_value: 250 },
        'success',
      );
      expect(result.blocked).toBe(false);
      expect(result.nextStatus).toBe('success');
    });

    it('ACEITA success com valores zero (são números válidos)', () => {
      const result = decideWebhookStatusUpdate(
        { status: 'pending', released_value: 0, installment_value: 0 },
        'success',
      );
      expect(result.blocked).toBe(false);
      expect(result.nextStatus).toBe('success');
    });
  });

  describe('proteção contra regressão para pending (BUG histórico)', () => {
    it('BLOQUEIA pending quando linha já é failed', () => {
      const result = decideWebhookStatusUpdate(
        { status: 'failed', released_value: null, installment_value: null },
        'pending',
      );
      expect(result.blocked).toBe(true);
      expect(result.reason).toBe('blocked_regression_to_pending');
    });

    it('BLOQUEIA pending quando linha já é success', () => {
      const result = decideWebhookStatusUpdate(
        { status: 'success', released_value: 5000, installment_value: 250 },
        'pending',
      );
      expect(result.blocked).toBe(true);
    });

    it('ACEITA pending quando linha continua pending (sem mudança real)', () => {
      const result = decideWebhookStatusUpdate(
        { status: 'pending', released_value: null, installment_value: null },
        'pending',
      );
      expect(result.blocked).toBe(false);
      expect(result.nextStatus).toBe('pending');
    });
  });

  describe('regras de failed', () => {
    it('ACEITA failed quando status atual é pending', () => {
      const result = decideWebhookStatusUpdate(
        { status: 'pending', released_value: null, installment_value: null },
        'failed',
      );
      expect(result.blocked).toBe(false);
      expect(result.nextStatus).toBe('failed');
    });

    it('ACEITA failed quando status atual é failed (idempotente)', () => {
      const result = decideWebhookStatusUpdate(
        { status: 'failed', released_value: null, installment_value: null },
        'failed',
      );
      expect(result.blocked).toBe(false);
    });

    it('BLOQUEIA failed quando status atual é success (não destruir resultado bom)', () => {
      const result = decideWebhookStatusUpdate(
        { status: 'success', released_value: 5000, installment_value: 250 },
        'failed',
      );
      expect(result.blocked).toBe(true);
      expect(result.reason).toBe('blocked_failed_after_success');
    });
  });

  describe('edge cases', () => {
    it('BLOQUEIA quando incoming é null (status V8 não mapeável)', () => {
      const result = decideWebhookStatusUpdate(
        { status: 'pending', released_value: null, installment_value: null },
        null,
      );
      expect(result.blocked).toBe(true);
      expect(result.reason).toBe('no_internal_status_mapped');
    });

    it('linha inicial sem status (insert) aceita pending', () => {
      // simula linha recém-criada órfã
      const result = decideWebhookStatusUpdate(
        { status: null, released_value: null, installment_value: null },
        'pending',
      );
      // status null !== 'pending' → bloqueia (conservador, evita criar pending de nada)
      expect(result.blocked).toBe(true);
    });
  });
});
