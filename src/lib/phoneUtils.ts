/**
 * Utilitários de validação e formatação de telefone (formato BR / E.164).
 *
 * Regras:
 * - Aceita: 10 dígitos (fixo BR), 11 dígitos (celular BR com DDD),
 *   12 dígitos (55 + 10) ou 13 dígitos (55 + 11 — E.164 BR).
 * - Rejeita: vazio, placeholders ("00000000000"), repetições simples ("11111111111"),
 *   menos de 10 dígitos, mais de 13 dígitos.
 */

export const PHONE_PLACEHOLDER = '00000000000';
export const PHONE_PENDING_TAG = '[TELEFONE PENDENTE - revisar]';

export function digitsOnly(input: string | null | undefined): string {
  return (input ?? '').replace(/\D/g, '');
}

export function isPlaceholderPhone(input: string | null | undefined): boolean {
  const d = digitsOnly(input);
  if (d.length === 0) return true;
  if (d === PHONE_PLACEHOLDER) return true;
  // Repetições triviais (todos dígitos iguais)
  if (/^(\d)\1+$/.test(d)) return true;
  return false;
}

export interface PhoneValidationResult {
  valid: boolean;
  /** Apenas dígitos, normalizado (sem código de país duplicado). */
  normalized: string;
  /** Telefone E.164 com prefixo 55 (Brasil). */
  e164: string;
  reason?: string;
}

export function validateBrazilianPhone(input: string | null | undefined): PhoneValidationResult {
  const d = digitsOnly(input);
  if (!d) return { valid: false, normalized: '', e164: '', reason: 'Telefone vazio' };
  if (isPlaceholderPhone(d)) return { valid: false, normalized: d, e164: '', reason: 'Telefone inválido (placeholder)' };

  // Remove possível "+" perdido — já feito por digitsOnly
  let local = d;
  // Se vier com 55 na frente (12 ou 13 dígitos), retira para validar o local
  if ((local.length === 12 || local.length === 13) && local.startsWith('55')) {
    local = local.slice(2);
  }
  if (local.length !== 10 && local.length !== 11) {
    return { valid: false, normalized: d, e164: '', reason: 'Telefone deve ter 10 ou 11 dígitos (DDD + número)' };
  }
  // DDD válido: 11 a 99
  const ddd = parseInt(local.slice(0, 2), 10);
  if (Number.isNaN(ddd) || ddd < 11 || ddd > 99) {
    return { valid: false, normalized: d, e164: '', reason: 'DDD inválido' };
  }
  // Celular (11 dígitos) deve começar com 9 no terceiro dígito
  if (local.length === 11 && local[2] !== '9') {
    return { valid: false, normalized: d, e164: '', reason: 'Celular deve começar com 9 após o DDD' };
  }
  const e164 = `55${local}`;
  return { valid: true, normalized: local, e164, reason: undefined };
}

export function formatBrazilianPhone(input: string | null | undefined): string {
  const d = digitsOnly(input);
  if (!d) return '';
  // Remove 55 inicial se existir
  let local = d;
  if ((local.length === 12 || local.length === 13) && local.startsWith('55')) {
    local = local.slice(2);
  }
  if (local.length === 11) return `(${local.slice(0, 2)}) ${local.slice(2, 7)}-${local.slice(7)}`;
  if (local.length === 10) return `(${local.slice(0, 2)}) ${local.slice(2, 6)}-${local.slice(6)}`;
  return input ?? '';
}

/**
 * Detecta se o registro tem telefone pendente:
 *   - phone é placeholder, OU
 *   - notes contém o marcador PHONE_PENDING_TAG.
 */
export function hasPendingPhone(record: { phone?: string | null; notes?: string | null }): boolean {
  if (isPlaceholderPhone(record.phone)) return true;
  if (record.notes && record.notes.includes(PHONE_PENDING_TAG)) return true;
  return false;
}
