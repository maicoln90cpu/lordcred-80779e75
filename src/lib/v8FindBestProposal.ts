/**
 * v8FindBestProposal — encontra a melhor combinação `valor × prazo` que cabe
 * dentro da margem disponível do trabalhador, sem precisar bater na V8 várias
 * vezes.
 *
 * Estratégia (paridade com sistemas concorrentes que devolvem proposta pronta):
 *  1. Para cada prazo aceito pela tabela (`number_of_installments`), estima a
 *     parcela usando uma TAXA MÉDIA conhecida (juros consignado CLT V8).
 *  2. A partir dessa parcela, calcula o valor liberado máximo cuja parcela
 *     mensal seja ≤ margem disponível.
 *  3. Retorna a combinação com MAIOR valor liberado (geralmente o prazo mais
 *     longo) — é o que devolve a melhor proposta para o cliente.
 *
 * IMPORTANTE: a taxa usada aqui é estimada (DEFAULT_MONTHLY_RATE). A V8 vai
 * recalcular com a taxa real da tabela ao receber `simulate`. Por isso aplicamos
 * uma margem de segurança (SAFETY_FACTOR) de 5% para evitar ultrapassar margem
 * por diferenças de coeficiente.
 *
 * Quando a V8 expor coeficientes por tabela, esta lib pode ler direto deles.
 */

/** Taxa mensal padrão consignado CLT V8 (estimativa conservadora). */
export const DEFAULT_MONTHLY_RATE = 0.0299; // 2,99% a.m.

/** Margem de segurança aplicada ao valor calculado para evitar estouro. */
export const SAFETY_FACTOR = 0.95;

/** Limites práticos. */
const MIN_DISBURSED = 300;

export interface FindBestProposalInput {
  marginValue: number;          // R$ disponíveis por mês
  installmentOptions: number[]; // ex: [6, 8, 10, 12, 18, 24, 36, 46]
  monthlyRate?: number;         // override de taxa
  valueMin?: number | null;     // sim_value_min da V8
  valueMax?: number | null;     // sim_value_max da V8
}

export interface BestProposal {
  installments: number;
  estimatedInstallmentValue: number; // parcela mensal estimada
  estimatedDisbursedValue: number;   // valor liberado estimado
}

/**
 * Calcula valor presente (PV) de uma série de parcelas iguais — fórmula padrão
 * de financiamento com juros compostos (Price).
 *   PV = PMT * (1 - (1+i)^-n) / i
 */
export function presentValueFromInstallment(pmt: number, rate: number, n: number): number {
  if (rate <= 0) return pmt * n;
  return pmt * (1 - Math.pow(1 + rate, -n)) / rate;
}

export function findBestProposal(input: FindBestProposalInput): BestProposal | null {
  const { marginValue, installmentOptions } = input;
  if (!Number.isFinite(marginValue) || marginValue <= 0) return null;
  if (!installmentOptions || installmentOptions.length === 0) return null;

  const rate = input.monthlyRate ?? DEFAULT_MONTHLY_RATE;
  const valueMin = Math.max(MIN_DISBURSED, Number(input.valueMin ?? MIN_DISBURSED));
  const valueMax = Number(input.valueMax ?? Infinity);

  let best: BestProposal | null = null;

  for (const n of installmentOptions) {
    if (!Number.isInteger(n) || n <= 0) continue;
    const pmt = marginValue * SAFETY_FACTOR;
    let pv = presentValueFromInstallment(pmt, rate, n);
    // Trava no teto da V8 e arredonda pra baixo (R$ 1).
    pv = Math.floor(Math.min(pv, valueMax));
    if (pv < valueMin) continue;
    if (!best || pv > best.estimatedDisbursedValue) {
      best = {
        installments: n,
        estimatedInstallmentValue: Number(pmt.toFixed(2)),
        estimatedDisbursedValue: pv,
      };
    }
  }
  return best;
}
