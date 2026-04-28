import { describe, it, expect } from 'vitest';
import { extractAvailableMargin, formatMarginBRL } from '../v8MarginExtractor';

describe('extractAvailableMargin', () => {
  it('retorna null para entradas vazias', () => {
    expect(extractAvailableMargin(null)).toBeNull();
    expect(extractAvailableMargin(undefined)).toBeNull();
    expect(extractAvailableMargin({})).toBeNull();
    expect(extractAvailableMargin('texto')).toBeNull();
  });

  it('extrai availableMarginValue do topo (formato webhook V8)', () => {
    expect(extractAvailableMargin({ availableMarginValue: '412.30' })).toBe(412.30);
    expect(extractAvailableMargin({ availableMarginValue: 891.97 })).toBe(891.97);
  });

  it('extrai de snake_case', () => {
    expect(extractAvailableMargin({ available_margin_value: 100 })).toBe(100);
  });

  it('extrai de aliases conhecidos', () => {
    expect(extractAvailableMargin({ availableMargin: 50 })).toBe(50);
    expect(extractAvailableMargin({ marginValue: 75 })).toBe(75);
  });

  it('extrai de caminhos aninhados (snapshot do poller)', () => {
    const snapshot = {
      v8_status_snapshot: { latest: { availableMarginValue: 1107.09, status: 'CONSENT_APPROVED' } },
    };
    expect(extractAvailableMargin(snapshot)).toBe(1107.09);
  });

  it('extrai de result.availableMarginValue', () => {
    expect(extractAvailableMargin({ result: { availableMarginValue: 222 } })).toBe(222);
  });

  it('ignora valores não numéricos ou zero/negativos', () => {
    expect(extractAvailableMargin({ availableMarginValue: 'abc' })).toBeNull();
    expect(extractAvailableMargin({ availableMarginValue: 0 })).toBeNull();
    expect(extractAvailableMargin({ availableMarginValue: -10 })).toBeNull();
  });

  it('prioriza topo sobre aninhado quando ambos existem', () => {
    const both = { availableMarginValue: 999, result: { availableMarginValue: 1 } };
    expect(extractAvailableMargin(both)).toBe(999);
  });
});

describe('formatMarginBRL', () => {
  it('formata em BRL', () => {
    expect(formatMarginBRL(412.3)).toMatch(/R\$\s*412,30/);
  });
  it('retorna — para inválidos', () => {
    expect(formatMarginBRL(null)).toBe('—');
    expect(formatMarginBRL(undefined)).toBe('—');
    expect(formatMarginBRL(NaN)).toBe('—');
  });
});
