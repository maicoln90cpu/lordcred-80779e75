import { describe, it, expect } from 'vitest';
import {
  isValidCpf, isValidCnpj,
  formatCpf, formatCnpj, formatPhone, formatCep,
  validateForContract,
} from '../partnerUtils';

// ==================== CPF ====================
describe('isValidCpf', () => {
  it('accepts a known-valid CPF', () => {
    expect(isValidCpf('529.982.247-25')).toBe(true);
    expect(isValidCpf('52998224725')).toBe(true);
  });
  it('rejects all-same digits', () => {
    expect(isValidCpf('111.111.111-11')).toBe(false);
  });
  it('rejects wrong check digits', () => {
    expect(isValidCpf('529.982.247-00')).toBe(false);
  });
  it('rejects wrong length', () => {
    expect(isValidCpf('123')).toBe(false);
  });
});

// ==================== CNPJ ====================
describe('isValidCnpj', () => {
  it('accepts a known-valid CNPJ', () => {
    expect(isValidCnpj('11.222.333/0001-81')).toBe(true);
  });
  it('rejects all-same digits', () => {
    expect(isValidCnpj('11.111.111/1111-11')).toBe(false);
  });
  it('rejects wrong check digits', () => {
    expect(isValidCnpj('11.222.333/0001-00')).toBe(false);
  });
});

// ==================== Formatters ====================
describe('formatCpf', () => {
  it('formats full CPF', () => {
    expect(formatCpf('52998224725')).toBe('529.982.247-25');
  });
  it('formats partial input', () => {
    expect(formatCpf('529')).toBe('529');
    expect(formatCpf('5299')).toBe('529.9');
  });
});

describe('formatCnpj', () => {
  it('formats full CNPJ', () => {
    expect(formatCnpj('11222333000181')).toBe('11.222.333/0001-81');
  });
});

describe('formatPhone', () => {
  it('formats 11-digit phone', () => {
    expect(formatPhone('11999887766')).toBe('(11) 99988-7766');
  });
  it('handles short input', () => {
    expect(formatPhone('11')).toBe('11');
  });
});

describe('formatCep', () => {
  it('formats 8-digit CEP', () => {
    expect(formatCep('01310100')).toBe('01310-100');
  });
});

// ==================== Contract Validation ====================
describe('validateForContract', () => {
  const validForm = {
    razao_social: 'Empresa Teste LTDA',
    cnpj: '11.222.333/0001-81',
    endereco_pj_rua: 'Rua Teste',
    endereco_pj_numero: '123',
    endereco_pj_bairro: 'Centro',
    endereco_pj_municipio: 'São Paulo',
    endereco_pj_uf: 'SP',
    endereco_pj_cep: '01310-100',
    nome: 'João Silva',
    cpf: '529.982.247-25',
    telefone: '11999887766',
    email: 'joao@test.com',
    nacionalidade: 'Brasileira',
    estado_civil: 'Solteiro',
    endereco_rep_cep: '01310-100',
    endereco_rep_rua: 'Rua Rep',
    endereco_rep_numero: '10',
    endereco_rep_bairro: 'Centro',
    endereco_rep_municipio: 'São Paulo',
    endereco_rep_uf: 'SP',
  };

  it('returns no errors for valid form', () => {
    expect(Object.keys(validateForContract(validForm))).toHaveLength(0);
  });

  it('returns errors for empty form', () => {
    const errors = validateForContract({});
    expect(Object.keys(errors).length).toBeGreaterThan(5);
  });

  it('rejects name without surname', () => {
    const errors = validateForContract({ ...validForm, nome: 'João' });
    expect(errors.nome).toBeDefined();
  });

  it('rejects invalid CPF', () => {
    const errors = validateForContract({ ...validForm, cpf: '000.000.000-00' });
    expect(errors.cpf).toBeDefined();
  });
});
