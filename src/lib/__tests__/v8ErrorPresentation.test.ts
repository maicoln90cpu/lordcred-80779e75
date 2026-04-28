import { describe, it, expect } from 'vitest';
import {
  translateV8Status,
  dedupeLines,
  getV8ErrorMessageDeduped,
} from '../v8ErrorPresentation';

describe('translateV8Status', () => {
  it('traduz status conhecidos para PT-BR', () => {
    expect(translateV8Status('success')).toBe('sucesso');
    expect(translateV8Status('failed')).toBe('falha');
    expect(translateV8Status('pending')).toBe('aguardando V8');
    expect(translateV8Status('processing')).toBe('processando');
    expect(translateV8Status('completed')).toBe('concluído');
    expect(translateV8Status('cancelled')).toBe('cancelado');
    expect(translateV8Status('canceled')).toBe('cancelado');
  });

  it('é case-insensitive e tolera espaços', () => {
    expect(translateV8Status('SUCCESS')).toBe('sucesso');
    expect(translateV8Status(' Failed ')).toBe('falha');
  });

  it('devolve "—" para null/undefined/vazio', () => {
    expect(translateV8Status(null)).toBe('—');
    expect(translateV8Status(undefined)).toBe('—');
    expect(translateV8Status('')).toBe('—');
  });

  it('devolve o original quando não conhece o status', () => {
    expect(translateV8Status('weird_state')).toBe('weird_state');
  });
});

describe('dedupeLines', () => {
  it('remove linhas idênticas mantendo a 1ª ocorrência e a ordem', () => {
    const input = 'A\nB\nA\nC\nB';
    expect(dedupeLines(input)).toBe('A\nB\nC');
  });

  it('é case-insensitive na comparação mas preserva o texto original', () => {
    expect(dedupeLines('Erro X\nerro x\nERRO X')).toBe('Erro X');
  });

  it('descarta linhas vazias', () => {
    expect(dedupeLines('A\n\n\nB\n  \nA')).toBe('A\nB');
  });

  it('lida com null/undefined', () => {
    expect(dedupeLines(null)).toBe('');
    expect(dedupeLines(undefined)).toBe('');
  });
});

describe('getV8ErrorMessageDeduped', () => {
  it('combina headline + error_message removendo repetições', () => {
    const raw = { title: 'Limite de requisições excedido' };
    const errorMessage =
      'Limite de requisições excedido\nA V8 está com instabilidade ou rate limit.\nA V8 está com instabilidade ou rate limit.';
    expect(getV8ErrorMessageDeduped(raw, errorMessage)).toBe(
      'Limite de requisições excedido\nA V8 está com instabilidade ou rate limit.',
    );
  });

  it('funciona quando raw_response está vazio', () => {
    expect(getV8ErrorMessageDeduped(null, 'Erro X\nErro X')).toBe('Erro X');
  });
});
