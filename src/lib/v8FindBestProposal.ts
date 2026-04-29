/**
 * v8FindBestProposal — gera candidatos de proposta `valor × prazo` que respeitam
 * os limites OFICIAIS retornados pela V8 no webhook de consulta:
 *   - simulationLimit.installmentsMin / installmentsMax
 *   - simulationLimit.valueMin / valueMax
 *   - availableMarginValue (margem disponível do trabalhador)
 *
 * Estratégia (revisada após erros reais de produção):
 *  - Em vez de adivinhar valor liberado via taxa estimada (que difere da real
 *    da tabela e estoura a margem), usamos preferencialmente o modo
 *    `installment_face_value`: enviamos a parcela desejada (margem disponível
 *    com fator de segurança) e a V8 calcula o valor liberado real.
 *  - Geramos uma lista de candidatos ordenados (maior prazo + parcela mais
 *    agressiva primeiro). Se a V8 recusar o melhor, o componente tenta o
 *    próximo automaticamente até esgotar.
 *
 * `findBestProposal` (legacy) é mantido para compatibilidade do teste antigo.
 */

/** Taxa mensal padrão consignado CLT V8 (estimativa conservadora). */
export const DEFAULT_MONTHLY_RATE = 0.0299; // 2,99% a.m.

/** Margem de segurança aplicada à parcela enviada para evitar estouro. */
export const SAFETY_FACTORS = [0.95, 0.85, 0.75, 0.65] as const;

/** Limites práticos. */
const MIN_DISBURSED = 300;
const MIN_INSTALLMENT = 25; // V8 raramente aceita parcela abaixo disso

export interface FindBestProposalInput {
  marginValue: number;          // R$ disponíveis por mês
  installmentOptions: number[]; // ex: [6, 8, 10, 12, 18, 24, 36, 46]
  monthlyRate?: number;         // override de taxa
  valueMin?: number | null;     // sim_value_min da V8
  valueMax?: number | null;     // sim_value_max da V8
  /** Limites oficiais V8: nº de parcelas min/max permitidos para este CPF. */
  installmentsMin?: number | null;
  installmentsMax?: number | null;
}

export interface BestProposal {
  installments: number;
  estimatedInstallmentValue: number; // parcela mensal estimada
  estimatedDisbursedValue: number;   // valor liberado estimado
}

/** Candidato de tentativa para enviar à V8. */
export interface ProposalCandidate {
  installments: number;
  /** Modo recomendado para a V8. */
  simulationMode: 'installment_face_value' | 'disbursed_amount';
  /** Valor a enviar (parcela ou valor liberado, conforme `simulationMode`). */
  simulationValue: number;
  /** Para feedback ao operador. */
  estimatedDisbursedValue: number;
  estimatedInstallmentValue: number;
  safetyFactor: number;
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

/**
 * Aplica os limites oficiais da V8 sobre a lista de prazos da tabela.
 * Os limites de installments podem vir tanto da configuração da tabela
 * (`installmentOptions`) quanto do CPF (`installmentsMin/Max`). A interseção
 * é o que a V8 vai aceitar de fato.
 */
export function filterInstallments(
  installmentOptions: number[],
  installmentsMin?: number | null,
  installmentsMax?: number | null,
): number[] {
  const min = Number.isFinite(Number(installmentsMin)) ? Number(installmentsMin) : 1;
  const max = Number.isFinite(Number(installmentsMax)) ? Number(installmentsMax) : Infinity;
  return (installmentOptions || [])
    .filter((n) => Number.isInteger(n) && n > 0 && n >= min && n <= max)
    .sort((a, b) => a - b);
}

/**
 * Gera candidatos ordenados (melhor primeiro). O componente tenta um por um
 * até a V8 aceitar.
 */
export function buildProposalCandidates(input: FindBestProposalInput): ProposalCandidate[] {
  const { marginValue } = input;
  if (!Number.isFinite(marginValue) || marginValue <= 0) return [];
  const allowed = filterInstallments(
    input.installmentOptions,
    input.installmentsMin,
    input.installmentsMax,
  );
  if (allowed.length === 0) return [];

  const rate = input.monthlyRate ?? DEFAULT_MONTHLY_RATE;
  const valueMin = Math.max(MIN_DISBURSED, Number(input.valueMin ?? MIN_DISBURSED));
  const valueMax = Number(input.valueMax ?? Infinity);

  // Maior prazo primeiro (mais valor liberado).
  const installmentsDesc = [...allowed].sort((a, b) => b - a);

  const candidates: ProposalCandidate[] = [];
  for (const n of installmentsDesc) {
    for (const factor of SAFETY_FACTORS) {
      const pmt = Math.max(MIN_INSTALLMENT, Number((marginValue * factor).toFixed(2)));
      if (pmt > marginValue) continue;
      const pv = presentValueFromInstallment(pmt, rate, n);
      const cappedPv = Math.floor(Math.min(pv, valueMax));
      if (cappedPv < valueMin) continue;
      candidates.push({
        installments: n,
        // Modo seguro: parcela desejada — V8 calcula o valor liberado real.
        simulationMode: 'installment_face_value',
        simulationValue: pmt,
        estimatedInstallmentValue: pmt,
        estimatedDisbursedValue: cappedPv,
        safetyFactor: factor,
      });
    }
  }
  return candidates;
}

/**
 * Mantido para compatibilidade. Devolve o primeiro candidato (melhor estimativa).
 */
export function findBestProposal(input: FindBestProposalInput): BestProposal | null {
  const candidates = buildProposalCandidates(input);
  if (candidates.length === 0) return null;
  const best = candidates[0];
  return {
    installments: best.installments,
    estimatedInstallmentValue: best.estimatedInstallmentValue,
    estimatedDisbursedValue: best.estimatedDisbursedValue,
  };
}
