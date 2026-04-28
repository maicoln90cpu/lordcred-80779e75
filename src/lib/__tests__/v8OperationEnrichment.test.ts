import { describe, it, expect } from 'vitest';

/**
 * Regressão crítica: a V8 expõe o id da operação no JSON da listagem como
 * `operationId` (camelCase), NÃO como `id`. Se o filtro de enrichment voltar a
 * usar apenas `op?.id`, os campos `issueAmount`, `installmentFaceValue` e
 * `numberOfInstallments` ficam null para sempre — e a tabela "Consultas" /
 * "Propostas" mostra "R$ 0,00" e "—" mesmo com dados reais no detalhe.
 *
 * Este teste reproduz o filtro real do edge function `v8-clt-api.actionListOperations`.
 */
const getOpId = (op: any): string | null => {
  const v = op?.operationId ?? op?.id ?? op?.operation_id ?? null;
  return v ? String(v) : null;
};

const isEligibleForEnrichment = (op: any): boolean =>
  !!getOpId(op) &&
  (op.issueAmount == null || op.installmentFaceValue == null || op.numberOfInstallments == null);

describe('V8 list_operations enrichment eligibility', () => {
  it('marca como elegível um item que vem com operationId (camelCase) e campos null', () => {
    const fromV8 = {
      operationId: '2cc26634-586c-40b9-bb6f-d65fe2d44164',
      contractNumber: 'MAG4734084801',
      disbursedIssueAmount: '1908.29',
      issueAmount: null,
      installmentFaceValue: null,
      numberOfInstallments: null,
    };
    expect(isEligibleForEnrichment(fromV8)).toBe(true);
    expect(getOpId(fromV8)).toBe('2cc26634-586c-40b9-bb6f-d65fe2d44164');
  });

  it('aceita também o fallback `id` (caso a V8 mude o formato)', () => {
    expect(getOpId({ id: 'abc' })).toBe('abc');
    expect(getOpId({ operation_id: 'xyz' })).toBe('xyz');
  });

  it('NÃO marca como elegível quando todos os campos já estão preenchidos', () => {
    const completo = {
      operationId: 'op-1',
      issueAmount: '1000',
      installmentFaceValue: '100',
      numberOfInstallments: 12,
    };
    expect(isEligibleForEnrichment(completo)).toBe(false);
  });

  it('NÃO marca como elegível quando não há nenhum id reconhecível', () => {
    expect(isEligibleForEnrichment({ issueAmount: null })).toBe(false);
  });
});
