import { describe, it, expect } from 'vitest';
import { analyzeV8Paste, parseV8Paste, parseConcatenated } from '../v8Parser';

describe('parseV8Paste', () => {
  it('(a) CPF nome data com espaços', () => {
    const rows = parseV8Paste('39364073800 Maicon Douglas 06/08/1990');
    expect(rows).toHaveLength(1);
    expect(rows[0].cpf).toBe('39364073800');
    expect(rows[0].nome).toBe('Maicon Douglas');
    expect(rows[0].data_nascimento).toBe('06/08/1990');
  });

  it('(b) CPF;nome;data', () => {
    const rows = parseV8Paste('39364073800;Maria Silva;15/03/1985');
    expect(rows).toHaveLength(1);
    expect(rows[0].cpf).toBe('39364073800');
    expect(rows[0].nome).toBe('Maria Silva');
    expect(rows[0].data_nascimento).toBe('15/03/1985');
  });

  it('(c) CPF puro', () => {
    const rows = parseV8Paste('39364073800');
    expect(rows).toHaveLength(1);
    expect(rows[0].cpf).toBe('39364073800');
    expect(rows[0].nome).toBeUndefined();
    expect(rows[0].data_nascimento).toBeUndefined();
  });

  it('(d) data ISO yyyy-mm-dd é convertida para dd/mm/aaaa', () => {
    const rows = parseV8Paste('39364073800 Joao 1990-08-06');
    expect(rows).toHaveLength(1);
    expect(rows[0].cpf).toBe('39364073800');
    expect(rows[0].data_nascimento).toBe('06/08/1990');
  });

  it('extrai gênero e telefone quando presentes', () => {
    const rows = parseV8Paste('39364073800 Ana Costa 10/10/1990 F 11999998888');
    expect(rows).toHaveLength(1);
    expect(rows[0].genero).toBe('F');
    expect(rows[0].telefone).toBe('11999998888');
  });

  it('aceita CPF formatado com máscara', () => {
    const rows = parseV8Paste('393.640.738-00 Cliente Teste 06/08/1990');
    expect(rows).toHaveLength(1);
    expect(rows[0].cpf).toBe('39364073800');
  });

  it('formato concatenado: NOME+CPF+DATA sem separadores', () => {
    const rows = parseV8Paste('DANIEL ALYSSON BARBOSA DA SILVA1044251247308/05/1992');
    expect(rows).toHaveLength(1);
    expect(rows[0].cpf).toBe('10442512473');
    expect(rows[0].nome).toBe('DANIEL ALYSSON BARBOSA DA SILVA');
    expect(rows[0].data_nascimento).toBe('08/05/1992');
  });

  it('formato concatenado: CPF antes do nome', () => {
    const rows = parseV8Paste('39364073800MAICON DOUGLAS06/08/1990');
    expect(rows).toHaveLength(1);
    expect(rows[0].cpf).toBe('39364073800');
    expect(rows[0].nome).toBe('MAICON DOUGLAS');
    expect(rows[0].data_nascimento).toBe('06/08/1990');
  });

  it('múltiplas linhas misturando formatos', () => {
    const rows = parseV8Paste(
      [
        '39364073800 Joao 06/08/1990',
        'MARIA SILVA1044251247315/03/1985',
        '12345678901',
      ].join('\n')
    );
    expect(rows).toHaveLength(3);
    expect(rows[0].cpf).toBe('39364073800');
    expect(rows[1].cpf).toBe('10442512473');
    expect(rows[1].nome).toBe('MARIA SILVA');
    expect(rows[2].cpf).toBe('12345678901');
  });

  it('descarta linhas sem CPF válido', () => {
    const rows = parseV8Paste('linha sem cpf nenhum aqui\n12345');
    expect(rows).toHaveLength(0);
  });
});

describe('parseConcatenated', () => {
  it('extrai nome+cpf+data colados', () => {
    const r = parseConcatenated('DANIEL ALYSSON BARBOSA DA SILVA1044251247308/05/1992');
    expect(r).not.toBeNull();
    expect(r!.cpf).toBe('10442512473');
    expect(r!.nome).toBe('DANIEL ALYSSON BARBOSA DA SILVA');
    expect(r!.data_nascimento).toBe('08/05/1992');
  });

  it('retorna null se não houver CPF', () => {
    expect(parseConcatenated('apenas texto sem numeros')).toBeNull();
  });

  it('aceita data ISO no meio', () => {
    const r = parseConcatenated('JOAO SILVA393640738001990-08-06');
    expect(r).not.toBeNull();
    expect(r!.cpf).toBe('39364073800');
    expect(r!.data_nascimento).toBe('06/08/1990');
  });
});

describe('analyzeV8Paste', () => {
  it('aponta data inválida como bloqueio', () => {
    const result = analyzeV8Paste('39364073800 Maicon 31/02/1990');
    expect(result.rows).toHaveLength(0);
    expect(result.issues).toHaveLength(1);
    expect(result.issues[0].code).toBe('invalid_date');
  });

  it('aponta linha sem data como bloqueio', () => {
    const result = analyzeV8Paste('39364073800 Maicon Douglas');
    expect(result.rows).toHaveLength(0);
    expect(result.issues).toHaveLength(1);
    expect(result.issues[0].code).toBe('missing_birth_date');
  });

  it('mantém linhas válidas e marca só as inválidas', () => {
    const result = analyzeV8Paste(['39364073800 Joao 06/08/1990', 'linha inválida'].join('\n'));
    expect(result.rows).toHaveLength(1);
    expect(result.issues).toHaveLength(1);
    expect(result.issues[0].code).toBe('invalid_format');
  });
});
