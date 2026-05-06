import { describe, it, expect } from 'vitest';
import { isAutoName, buildAutoBatchName } from '../v8BatchName';

describe('isAutoName', () => {
  it('considera vazio como auto', () => {
    expect(isAutoName('')).toBe(true);
    expect(isAutoName('   ')).toBe(true);
  });

  it('considera nomes ≤ 3 chars como auto (a, b, ab, abc)', () => {
    expect(isAutoName('a')).toBe(true);
    expect(isAutoName('b')).toBe(true);
    expect(isAutoName('ab')).toBe(true);
    expect(isAutoName('abc')).toBe(true);
  });

  it('considera nomes sem dígitos como auto', () => {
    expect(isAutoName('Mailing julho')).toBe(true);
    expect(isAutoName('CLIENTES NOVOS')).toBe(true);
  });

  it('preserva nomes com dígitos e mais de 3 chars', () => {
    expect(isAutoName('Mailing 2026')).toBe(false);
    expect(isAutoName('Lote julho 1')).toBe(false);
    expect(isAutoName('Operação 23')).toBe(false);
  });

  it('reescreve nomes auto-gerados antigos para regerar timestamp', () => {
    expect(isAutoName('Lote 06/05 10:30 — Rascunho A')).toBe(true);
  });
});

describe('buildAutoBatchName', () => {
  const fixed = new Date(2026, 4, 6, 14, 7); // 06/05/2026 14:07

  it('formata DD/MM HH:mm com label do rascunho', () => {
    expect(buildAutoBatchName('', 'Rascunho A', fixed))
      .toBe('Lote 06/05 14:07 — Rascunho A');
  });

  it('preserva nome curto digitado pelo operador como sufixo do label', () => {
    expect(buildAutoBatchName('a', 'Rascunho A', fixed))
      .toBe('Lote 06/05 14:07 — Rascunho A (a)');
  });

  it('ignora nome longo (apenas usa o label)', () => {
    expect(buildAutoBatchName('Mailing julho', 'Rascunho B', fixed))
      .toBe('Lote 06/05 14:07 — Rascunho B');
  });
});
