/**
 * Composição financeira — explica de forma leiga a relação entre o valor
 * liberado, a parcela mensal, o número de parcelas e o total efetivamente
 * pago pelo cliente ao final do contrato.
 *
 * Exemplo (caso reportado pelo usuário no item 8 do plano):
 *   liberado = R$ 10.847,00
 *   parcela  = R$ 745,84
 *   prazo    = 36 meses
 *   --------------------------------------------------------
 *   total_pago = 745,84 × 36 = R$ 26.850,24
 *   juros_totais = total_pago − liberado = R$ 16.003,24
 *   markup_pct = juros / liberado = ~147,5%
 *   cet_mensal_aprox ≈ taxa que satisfaz PV = parcela * a(n,i)
 *
 * Sem nenhuma dependência externa — usado tanto no UI (V8StatusOnV8Dialog)
 * quanto nos testes de regressão.
 */

export interface FinancialBreakdown {
  released: number;
  installment: number;
  installments: number;
  totalPaid: number;
  totalInterest: number;
  markupPct: number; // juros/liberado * 100
  monthlyRatePct: number | null; // CET mensal aproximado (%)
  annualRatePct: number | null; // CET anual aproximado (%)
}

export function computeFinancialBreakdown(
  released: number | null | undefined,
  installment: number | null | undefined,
  installments: number | null | undefined,
): FinancialBreakdown | null {
  const r = Number(released);
  const p = Number(installment);
  const n = Number(installments);
  if (!Number.isFinite(r) || !Number.isFinite(p) || !Number.isFinite(n)) return null;
  if (r <= 0 || p <= 0 || n <= 0) return null;

  const totalPaid = p * n;
  const totalInterest = totalPaid - r;
  const markupPct = (totalInterest / r) * 100;

  // CET mensal — bisseção em [0.0001%, 50%].
  const monthlyRate = solveMonthlyRate(r, p, n);
  const monthlyRatePct = monthlyRate != null ? monthlyRate * 100 : null;
  const annualRatePct =
    monthlyRate != null ? (Math.pow(1 + monthlyRate, 12) - 1) * 100 : null;

  return {
    released: r,
    installment: p,
    installments: n,
    totalPaid,
    totalInterest,
    markupPct,
    monthlyRatePct,
    annualRatePct,
  };
}

/** Resolve i tal que PV = P * (1 - (1+i)^-n) / i. Retorna null se inviável. */
function solveMonthlyRate(pv: number, pmt: number, n: number): number | null {
  // Se a parcela * n <= pv, não há juros (ou inconsistente).
  if (pmt * n <= pv) return 0;
  let lo = 1e-7;
  let hi = 0.5;
  for (let iter = 0; iter < 80; iter++) {
    const mid = (lo + hi) / 2;
    const pvCalc = (pmt * (1 - Math.pow(1 + mid, -n))) / mid;
    if (pvCalc > pv) lo = mid; else hi = mid;
  }
  const result = (lo + hi) / 2;
  if (!Number.isFinite(result) || result <= 0) return null;
  return result;
}
