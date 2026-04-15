import { describe, it, expect } from 'vitest';
import { normalizeCorbanPropostasInput, type NormalizedCorbanProposta } from '../corbanPropostas';

const norm1 = (input: unknown): NormalizedCorbanProposta => normalizeCorbanPropostasInput(input)[0];

describe('normalizeCorbanPropostasInput', () => {
  // ===== Unwrapping =====
  it('unwraps array of objects', () => {
    const res = normalizeCorbanPropostasInput([{ id: '1', nome: 'Ana' }]);
    expect(res).toHaveLength(1);
    expect(res[0].proposta_id).toBe('1');
    expect(res[0].nome).toBe('Ana');
  });

  it('unwraps { data: [...] } wrapper', () => {
    const res = normalizeCorbanPropostasInput({ data: [{ id: '1' }] });
    expect(res).toHaveLength(1);
  });

  it('unwraps { propostas: [...] } wrapper', () => {
    const res = normalizeCorbanPropostasInput({ propostas: [{ id: '1' }, { id: '2' }] });
    expect(res).toHaveLength(2);
  });

  it('unwraps numeric-keyed object', () => {
    const res = normalizeCorbanPropostasInput({ '100': { nome: 'X' }, '200': { nome: 'Y' } });
    expect(res).toHaveLength(2);
    expect(res[0].proposta_id).toBe('100');
  });

  it('wraps single object with known keys', () => {
    const res = normalizeCorbanPropostasInput({ proposta_id: '99', nome: 'Solo' });
    expect(res).toHaveLength(1);
    expect(res[0].proposta_id).toBe('99');
  });

  it('returns empty for non-object primitives', () => {
    expect(normalizeCorbanPropostasInput(null)).toEqual([]);
    expect(normalizeCorbanPropostasInput(42)).toEqual([]);
    expect(normalizeCorbanPropostasInput('text')).toEqual([]);
  });

  it('parses JSON string input', () => {
    const res = normalizeCorbanPropostasInput(JSON.stringify([{ id: '1', cpf: '12345' }]));
    expect(res).toHaveLength(1);
    expect(res[0].cpf).toBe('12345');
  });

  // ===== Field mapping =====
  it('maps proposta_id from "id" fallback', () => {
    expect(norm1({ id: 'ABC' }).proposta_id).toBe('ABC');
  });

  it('maps proposta_id from "codigo_proposta"', () => {
    expect(norm1({ codigo_proposta: 'XYZ' }).proposta_id).toBe('XYZ');
  });

  it('maps cpf from nested "cliente_cpf"', () => {
    expect(norm1({ cliente_cpf: '111.222.333-44' }).cpf).toBe('111.222.333-44');
  });

  it('maps nome from "nome_completo"', () => {
    expect(norm1({ nome_completo: 'Maria Silva' }).nome).toBe('Maria Silva');
  });

  it('maps telefone from "celular"', () => {
    expect(norm1({ celular: '11999887766' }).telefone).toBe('11999887766');
  });

  it('maps banco from "banco_nome" priority', () => {
    expect(norm1({ banco_nome: 'Itaú', banco: 'BMG' }).banco).toBe('Itaú');
  });

  it('maps produto from "tipo_operacao" fallback', () => {
    expect(norm1({ tipo_operacao: 'FGTS' }).produto).toBe('FGTS');
  });

  it('maps status from "status_api_descricao" priority', () => {
    expect(norm1({ status_api_descricao: 'Aprovado', status: 'A' }).status).toBe('Aprovado');
  });

  // ===== Numeric fields =====
  it('parses valor_liberado from currency string', () => {
    expect(norm1({ valor_liberado: 'R$ 1.234,56' }).valor_liberado).toBeCloseTo(1234.56);
  });

  it('parses valor_liberado from number', () => {
    expect(norm1({ valor_liberado: 5000 }).valor_liberado).toBe(5000);
  });

  it('parses valor_parcela', () => {
    expect(norm1({ parcela: '150,00' }).valor_parcela).toBeCloseTo(150);
  });

  it('returns null for missing numeric field', () => {
    expect(norm1({}).valor_liberado).toBeNull();
  });

  // ===== Prazo (string or number) =====
  it('keeps prazo as number when numeric', () => {
    expect(norm1({ prazo: 12 }).prazo).toBe(12);
  });

  it('keeps prazo as string when non-numeric', () => {
    expect(norm1({ prazo: '12x' }).prazo).toBe('12x');
  });

  // ===== Deep lookup =====
  it('finds cpf in nested structure', () => {
    const input = { cliente: { dados: { cpf: '999' } } };
    expect(norm1(input).cpf).toBe('999');
  });

  it('finds value in nested JSON string', () => {
    const input = { raw: JSON.stringify({ cpf: '888' }) };
    // raw is stored but cpf found at top-level walk
    expect(norm1(input).cpf).toBe('888');
  });

  // ===== Equipe fields =====
  it('maps vendedor_nome', () => {
    expect(norm1({ nome_vendedor: 'João' }).vendedor_nome).toBe('João');
  });

  it('maps digitador_nome', () => {
    expect(norm1({ digitador: 'Pedro' }).digitador_nome).toBe('Pedro');
  });

  it('maps equipe_nome', () => {
    expect(norm1({ nome_equipe: 'Equipe A' }).equipe_nome).toBe('Equipe A');
  });

  it('maps promotora from "substabelecimento"', () => {
    expect(norm1({ substabelecimento: 'Promo X' }).promotora_nome).toBe('Promo X');
  });

  // ===== Dates =====
  it('maps data_cadastro', () => {
    expect(norm1({ cadastro: '2026-01-01' }).data_cadastro).toBe('2026-01-01');
  });

  it('maps data_pagamento from "data_pago"', () => {
    expect(norm1({ data_pago: '2026-03-15' }).data_pagamento).toBe('2026-03-15');
  });

  // ===== Endereco completo =====
  it('builds endereco_completo from parts', () => {
    const input = { logradouro: 'Rua A', numero: '10', bairro: 'Centro', cidade: 'SP', uf: 'SP', cep: '01000-000' };
    const result = norm1(input);
    expect(result.endereco_completo).toContain('Rua A');
    expect(result.endereco_completo).toContain('Centro');
    expect(result.endereco_completo).toContain('01000-000');
  });

  it('returns null endereco when no parts exist', () => {
    expect(norm1({}).endereco_completo).toBeNull();
  });

  // ===== Observacoes =====
  it('builds observacoes from api + manual', () => {
    const input = { observacao_api: 'err timeout', observacao: 'ok teste' };
    const result = norm1(input);
    expect(result.observacoes).toContain('API: err timeout');
    expect(result.observacoes).toContain('Manual: ok teste');
  });

  // ===== raw preserved =====
  it('preserves raw source', () => {
    const input = { id: '1', extra_field: 'xyz' };
    const result = norm1(input);
    expect(result.raw).toBeTruthy();
    expect((result.raw as any).extra_field).toBe('xyz');
  });

  // ===== Edge: empty array =====
  it('returns empty for empty array', () => {
    expect(normalizeCorbanPropostasInput([])).toEqual([]);
  });

  // ===== Batch =====
  it('normalizes a batch of 3 proposals', () => {
    const batch = [
      { id: '1', nome: 'A', valor_liberado: 1000 },
      { id: '2', nome: 'B', valor_liberado: 2000 },
      { id: '3', nome: 'C', valor_liberado: 3000 },
    ];
    const results = normalizeCorbanPropostasInput(batch);
    expect(results).toHaveLength(3);
    expect(results[2].valor_liberado).toBe(3000);
    expect(results[0].nome).toBe('A');
  });
});
