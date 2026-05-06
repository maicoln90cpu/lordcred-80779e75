/**
 * Helpers de nome de lote V8 (extraídos de V8NovaSimulacaoTab para testabilidade).
 *
 * Regras (mai/2026):
 * - Nome vazio  → auto-gerado.
 * - Nome casa "Lote DD/MM HH:mm — ..." → considerado auto e regenerado com hora atual.
 * - Nome ≤ 3 chars → auto (evita "a", "b", "c" sem rastreabilidade).
 * - Nome sem nenhum dígito → auto (incentiva data no histórico).
 * - Caso contrário, mantém o nome do operador.
 */
export const AUTO_NAME_RE = /^Lote \d{2}\/\d{2} \d{2}:\d{2} — /;

export function isAutoName(name: string): boolean {
  const v = (name ?? '').trim();
  if (!v) return true;
  if (AUTO_NAME_RE.test(v)) return true;
  if (v.length <= 3) return true;
  if (!/\d/.test(v)) return true;
  return false;
}

export function buildAutoBatchName(currentName: string, label: string, now: Date = new Date()): string {
  const current = (currentName ?? '').trim();
  const pad = (n: number) => String(n).padStart(2, '0');
  const baseLabel = current && current.length <= 3 ? `${label} (${current})` : label;
  return `Lote ${pad(now.getDate())}/${pad(now.getMonth() + 1)} ${pad(now.getHours())}:${pad(now.getMinutes())} — ${baseLabel}`;
}
