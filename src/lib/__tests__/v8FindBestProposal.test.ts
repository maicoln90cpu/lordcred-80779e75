import { describe, it, expect } from 'vitest';
import { findBestProposal, presentValueFromInstallment, DEFAULT_MONTHLY_RATE } from '../v8FindBestProposal';

describe('presentValueFromInstallment', () => {
  it('calcula PV padrão Price', () => {
    const pv = presentValueFromInstallment(100, 0.02, 12);
    expect(pv).toBeGreaterThan(1000);
    expect(pv).toBeLessThan(1200);
  });
  it('com taxa zero retorna pmt*n', () => {
    expect(presentValueFromInstallment(50, 0, 10)).toBe(500);
  });
});

describe('findBestProposal', () => {
  const opts = [6, 8, 10, 12, 18, 24, 36, 46];

  it('retorna null para margem inválida', () => {
    expect(findBestProposal({ marginValue: 0, installmentOptions: opts })).toBeNull();
    expect(findBestProposal({ marginValue: NaN, installmentOptions: opts })).toBeNull();
  });

  it('retorna null sem opções de parcela', () => {
    expect(findBestProposal({ marginValue: 100, installmentOptions: [] })).toBeNull();
  });

  it('caso Gabriele (margem 148,93) — escolhe maior prazo viável', () => {
    const r = findBestProposal({
      marginValue: 148.93,
      installmentOptions: opts,
      valueMin: 500,
      valueMax: 5361.48,
    });
    expect(r).not.toBeNull();
    expect(r!.installments).toBeGreaterThanOrEqual(24);
    // Em 46x a 2,99% a.m. com parcela ~141 cabe ~R$ 3.500 (matematicamente).
    // O outro sistema escolheu 24x/R$1.791 (provável taxa real mais alta).
    // Faixa larga porque a taxa real V8 varia por tabela.
    expect(r!.estimatedDisbursedValue).toBeGreaterThan(1200);
    expect(r!.estimatedDisbursedValue).toBeLessThan(5000);
  });

  it('respeita valueMax da V8', () => {
    const r = findBestProposal({
      marginValue: 5000,
      installmentOptions: opts,
      valueMax: 1000,
    });
    expect(r!.estimatedDisbursedValue).toBeLessThanOrEqual(1000);
  });

  it('prazo único disponível não quebra', () => {
    const r = findBestProposal({ marginValue: 200, installmentOptions: [24] });
    expect(r!.installments).toBe(24);
  });

  it('prefere maior valor liberado (geralmente maior prazo)', () => {
    const r = findBestProposal({ marginValue: 300, installmentOptions: [12, 24, 46] });
    expect(r!.installments).toBe(46);
  });

  it('usa taxa custom quando fornecida', () => {
    const a = findBestProposal({ marginValue: 200, installmentOptions: [24], monthlyRate: 0.01 });
    const b = findBestProposal({ marginValue: 200, installmentOptions: [24], monthlyRate: 0.05 });
    expect(a!.estimatedDisbursedValue).toBeGreaterThan(b!.estimatedDisbursedValue);
  });
});
