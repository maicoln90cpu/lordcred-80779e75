import { describe, it, expect } from 'vitest';
import {
  detectV8ErrorKind,
  isRetriableErrorKind,
  RETRIABLE_ERROR_KINDS,
  shouldAutoRetry,
  MAX_AUTO_RETRY_ATTEMPTS,
} from '../v8ErrorClassification';

describe('detectV8ErrorKind', () => {
  describe('rate limit (HTTP 429)', () => {
    it('classifica HTTP 429 como temporary_v8', () => {
      expect(detectV8ErrorKind({ status: 429 })).toBe('temporary_v8');
    });

    it('classifica 429 com texto adicional como temporary_v8', () => {
      expect(
        detectV8ErrorKind({ status: 429, message: 'Too Many Requests' }),
      ).toBe('temporary_v8');
    });

    it('classifica texto "Limite de requisições excedido" como temporary_v8', () => {
      expect(
        detectV8ErrorKind({
          status: 200,
          message: 'Limite de requisições excedido',
        }),
      ).toBe('temporary_v8');
    });

    it('classifica variante sem acento "Limite de requisicoes excedido"', () => {
      expect(
        detectV8ErrorKind({ rawText: 'Limite de requisicoes excedido' }),
      ).toBe('temporary_v8');
    });

    it('classifica "rate limit" em inglês', () => {
      expect(detectV8ErrorKind({ detail: 'rate limit reached' })).toBe(
        'temporary_v8',
      );
    });

    it('rate limit textual prevalece sobre status 200', () => {
      expect(
        detectV8ErrorKind({ status: 200, title: 'Rate limit excedido' }),
      ).toBe('temporary_v8');
    });
  });

  describe('outros classificadores (regressão)', () => {
    it('500+ continua sendo temporary_v8', () => {
      expect(detectV8ErrorKind({ status: 503 })).toBe('temporary_v8');
      expect(detectV8ErrorKind({ status: 500 })).toBe('temporary_v8');
    });

    it('"Já existe uma consulta ativa" é active_consult', () => {
      expect(
        detectV8ErrorKind({ message: 'Já existe uma consulta ativa para este CPF' }),
      ).toBe('active_consult');
    });

    it('"ainda em análise" é analysis_pending', () => {
      expect(detectV8ErrorKind({ detail: 'Consulta ainda em análise' })).toBe(
        'analysis_pending',
      );
    });

    it('"proposta já existente" é existing_proposal', () => {
      expect(detectV8ErrorKind({ message: 'Proposta já existente' })).toBe(
        'existing_proposal',
      );
    });

    it('400 sem texto reconhecido é invalid_data', () => {
      expect(detectV8ErrorKind({ status: 400 })).toBe('invalid_data');
    });

    it('payload vazio é unknown', () => {
      expect(detectV8ErrorKind({})).toBe('unknown');
      expect(detectV8ErrorKind()).toBe('unknown');
    });

    it('429 tem prioridade sobre invalid_data (4xx genérico)', () => {
      // 429 é 4xx mas deve cair na regra específica de rate limit antes
      expect(detectV8ErrorKind({ status: 429 })).toBe('temporary_v8');
    });
  });
});

describe('isRetriableErrorKind / RETRIABLE_ERROR_KINDS', () => {
  it('inclui temporary_v8 e analysis_pending', () => {
    expect(isRetriableErrorKind('temporary_v8')).toBe(true);
    expect(isRetriableErrorKind('analysis_pending')).toBe(true);
  });

  it('NÃO inclui active_consult, existing_proposal, invalid_data, rejected_by_v8', () => {
    expect(isRetriableErrorKind('active_consult')).toBe(false);
    expect(isRetriableErrorKind('existing_proposal')).toBe(false);
    expect(isRetriableErrorKind('invalid_data')).toBe(false);
    expect(isRetriableErrorKind('rejected_by_v8')).toBe(false);
    expect(isRetriableErrorKind('unknown')).toBe(false);
  });

  it('lida com null/undefined/string vazia', () => {
    expect(isRetriableErrorKind(null)).toBe(false);
    expect(isRetriableErrorKind(undefined)).toBe(false);
    expect(isRetriableErrorKind('')).toBe(false);
  });

  it('Set imutável tem exatamente 2 entradas', () => {
    expect(RETRIABLE_ERROR_KINDS.size).toBe(2);
  });
});

describe('shouldAutoRetry / MAX_AUTO_RETRY_ATTEMPTS', () => {
  it('MAX_AUTO_RETRY_ATTEMPTS é 15 (contrato com a UI)', () => {
    expect(MAX_AUTO_RETRY_ATTEMPTS).toBe(15);
  });

  it('retenta temporary_v8 abaixo do cap', () => {
    expect(shouldAutoRetry('temporary_v8', 0)).toBe(true);
    expect(shouldAutoRetry('temporary_v8', 1)).toBe(true);
    expect(shouldAutoRetry('temporary_v8', 14)).toBe(true);
  });

  it('retenta analysis_pending abaixo do cap', () => {
    expect(shouldAutoRetry('analysis_pending', 5)).toBe(true);
  });

  it('PARA de retentar ao atingir o cap (15 tentativas)', () => {
    expect(shouldAutoRetry('temporary_v8', 15)).toBe(false);
    expect(shouldAutoRetry('temporary_v8', 99)).toBe(false);
  });

  it('NUNCA retenta active_consult (precisa ação humana)', () => {
    expect(shouldAutoRetry('active_consult', 0)).toBe(false);
    expect(shouldAutoRetry('active_consult', 1)).toBe(false);
  });

  it('NUNCA retenta invalid_data, existing_proposal, unknown', () => {
    expect(shouldAutoRetry('invalid_data', 0)).toBe(false);
    expect(shouldAutoRetry('existing_proposal', 0)).toBe(false);
    expect(shouldAutoRetry('unknown', 0)).toBe(false);
  });

  it('lida com null/undefined', () => {
    expect(shouldAutoRetry(null, 0)).toBe(false);
    expect(shouldAutoRetry(undefined, null)).toBe(false);
    expect(shouldAutoRetry('temporary_v8', null)).toBe(true); // 0 tentativas
  });

  it('retenta dispatch_failed (timeout/erro de rede no POST inicial)', () => {
    expect(isRetriableErrorKind('dispatch_failed')).toBe(true);
    expect(RETRIABLE_ERROR_KINDS.has('dispatch_failed')).toBe(true);
    expect(shouldAutoRetry('dispatch_failed', 1, 15)).toBe(true);
    expect(shouldAutoRetry('dispatch_failed', 15, 15)).toBe(false); // esgotou
  });

  it('NUNCA retenta active_consult (criaria consulta paralela na V8)', () => {
    expect(isRetriableErrorKind('active_consult')).toBe(false);
    expect(shouldAutoRetry('active_consult', 0)).toBe(false);
  });
});
