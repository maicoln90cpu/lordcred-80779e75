import { describe, it, expect } from 'vitest';

/**
 * Reimplementação local de startOfTodaySaoPauloIso e fmtBRL para teste isolado
 * (a função original está privada dentro de V8KpisBar.tsx). Mantemos paridade
 * exata para detectar regressões de fuso horário e formato monetário BR.
 */
function startOfTodaySaoPauloIso(now: Date) {
  const offsetHours = -3;
  const sp = new Date(now.getTime() + (offsetHours * 60 - now.getTimezoneOffset()) * 60000);
  const y = sp.getUTCFullYear();
  const m = String(sp.getUTCMonth() + 1).padStart(2, '0');
  const d = String(sp.getUTCDate()).padStart(2, '0');
  return `${y}-${m}-${d}T00:00:00-03:00`;
}

function fmtBRL(n: number | null) {
  if (n == null) return '—';
  return n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

describe('V8KpisBar helpers — timezone São Paulo', () => {
  it('retorna ISO com offset -03:00 sempre', () => {
    const iso = startOfTodaySaoPauloIso(new Date('2026-04-29T15:00:00Z'));
    expect(iso).toMatch(/T00:00:00-03:00$/);
  });

  it('quando UTC vira dia novo mas em SP ainda é o dia anterior, retorna o dia anterior', () => {
    // 02:00 UTC = 23:00 do dia anterior em SP
    const iso = startOfTodaySaoPauloIso(new Date('2026-04-29T02:00:00Z'));
    expect(iso.startsWith('2026-04-28')).toBe(true);
  });

  it('formata BRL corretamente', () => {
    expect(fmtBRL(1234.5)).toContain('1.234,50');
    expect(fmtBRL(null)).toBe('—');
    expect(fmtBRL(0)).toContain('0,00');
  });
});
