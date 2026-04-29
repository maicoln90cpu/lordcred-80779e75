import { describe, it, expect } from 'vitest';
import {
  findBestProposal,
  buildProposalCandidates,
  filterInstallments,
  presentValueFromInstallment,
} from '../v8FindBestProposal';

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

describe('filterInstallments', () => {
  it('respeita installmentsMax do CPF — não retorna 46x quando max=36', () => {
    const out = filterInstallments([6, 12, 24, 36, 46], 6, 36);
    expect(out).toEqual([6, 12, 24, 36]);
    expect(out).not.toContain(46);
  });
  it('respeita installmentsMin', () => {
    const out = filterInstallments([6, 12, 24, 36], 12, 36);
    expect(out).toEqual([12, 24, 36]);
  });
  it('sem limites retorna tudo válido', () => {
    expect(filterInstallments([6, 12, 24], null, null)).toEqual([6, 12, 24]);
  });
});

describe('buildProposalCandidates', () => {
  const opts = [6, 8, 10, 12, 18, 24, 36, 46];

  it('retorna lista vazia para margem inválida', () => {
    expect(buildProposalCandidates({ marginValue: 0, installmentOptions: opts })).toEqual([]);
  });

  it('NUNCA escolhe 46x quando installmentsMax=36 (caso real Danila/Gabriele/Paulo)', () => {
    const cands = buildProposalCandidates({
      marginValue: 80.78,
      installmentOptions: opts,
      installmentsMin: 6,
      installmentsMax: 36,
      valueMin: 500,
      valueMax: 2908.08,
    });
    expect(cands.length).toBeGreaterThan(0);
    expect(cands.every((c) => c.installments <= 36)).toBe(true);
    expect(cands.every((c) => c.installments >= 6)).toBe(true);
  });

  it('caso Paulo (margem 80,78) — gera candidato com parcela ≤ margem', () => {
    const cands = buildProposalCandidates({
      marginValue: 80.78,
      installmentOptions: opts,
      installmentsMin: 6,
      installmentsMax: 36,
      valueMin: 500,
      valueMax: 2908.08,
    });
    expect(cands[0]).toBeDefined();
    expect(cands[0].simulationValue).toBeLessThanOrEqual(80.78);
    expect(cands[0].simulationMode).toBe('installment_face_value');
    expect(cands[0].installments).toBe(36); // melhor = maior prazo
  });

  it('caso Gabriele (margem 148,93) — usa installment_face_value e prazo máximo', () => {
    const cands = buildProposalCandidates({
      marginValue: 148.93,
      installmentOptions: opts,
      installmentsMin: 6,
      installmentsMax: 36,
      valueMin: 500,
      valueMax: 5361.48,
    });
    expect(cands[0].installments).toBe(36);
    expect(cands[0].simulationValue).toBeLessThanOrEqual(148.93);
  });

  it('gera múltiplos candidatos com fatores de segurança decrescentes', () => {
    const cands = buildProposalCandidates({
      marginValue: 200,
      installmentOptions: [24, 36],
      installmentsMin: 6,
      installmentsMax: 36,
    });
    // 2 prazos × 4 fatores = até 8 candidatos
    expect(cands.length).toBeGreaterThan(2);
    // Maior prazo (36) vem primeiro
    expect(cands[0].installments).toBe(36);
    // Fator de segurança vai diminuindo dentro do mesmo prazo
    const factors36 = cands.filter((c) => c.installments === 36).map((c) => c.safetyFactor);
    expect(factors36).toEqual([...factors36].sort((a, b) => b - a));
  });

  it('respeita valueMin — descarta combinações abaixo do mínimo da V8', () => {
    const cands = buildProposalCandidates({
      marginValue: 30,
      installmentOptions: [6],
      installmentsMin: 6,
      installmentsMax: 36,
      valueMin: 5000, // impossível com margem 30
    });
    expect(cands).toEqual([]);
  });
});

describe('findBestProposal (legacy)', () => {
  it('retorna primeiro candidato', () => {
    const r = findBestProposal({
      marginValue: 148.93,
      installmentOptions: [6, 12, 24, 36, 46],
      installmentsMin: 6,
      installmentsMax: 36,
    });
    expect(r).not.toBeNull();
    expect(r!.installments).toBe(36);
  });
  it('retorna null quando nada cabe', () => {
    expect(findBestProposal({ marginValue: 0, installmentOptions: [24] })).toBeNull();
  });
});
