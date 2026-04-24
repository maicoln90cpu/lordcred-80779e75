/**
 * Helpers puros para cálculo de comparação de período no Extrato (V1/V2).
 * Mantidos separados para serem testáveis sem React.
 */

export interface SaleLike {
  sale_date: string;
  released_value: number;
  commission_value: number;
  week_label?: string | null;
  seller_id: string;
  product?: string | null;
}

/**
 * Dado um array ORDENADO descrescente de week_labels disponíveis e os labels
 * filtrados, retorna os labels do "período anterior" — mesma quantidade de
 * semanas, imediatamente anteriores cronologicamente.
 *
 * Como os week_labels começam com "DD/MM a DD/MM", a ordenação alfabética
 * desc dada por sales.sort().reverse() já fica próxima da cronológica,
 * mas para sermos seguros usamos a ordem de aparição (índice) na lista
 * `availableWeeksDesc` que vem do componente.
 */
export function getPreviousWeekLabels(
  selectedWeeks: string[],
  availableWeeksDesc: string[],
): string[] {
  if (selectedWeeks.length === 0) return [];
  if (availableWeeksDesc.length === 0) return [];

  // Encontra os índices das semanas selecionadas na lista descrescente
  const indices = selectedWeeks
    .map((w) => availableWeeksDesc.indexOf(w))
    .filter((i) => i >= 0)
    .sort((a, b) => a - b);

  if (indices.length === 0) return [];

  const lastIndex = indices[indices.length - 1];
  const count = selectedWeeks.length;

  // Pega as próximas `count` semanas DEPOIS do índice mais antigo (mais recente
  // de trás pra frente = índice maior). Como a lista é desc, a "anterior"
  // cronologicamente está no índice maior.
  const previous: string[] = [];
  for (let i = lastIndex + 1; i < availableWeeksDesc.length && previous.length < count; i++) {
    previous.push(availableWeeksDesc[i]);
  }
  return previous;
}

/**
 * Filtra vendas no mês imediatamente anterior ao mês de referência.
 * Usado quando não há filtro de semana.
 */
export function filterPreviousMonthSales<T extends SaleLike>(
  sales: T[],
  referenceDate = new Date(),
): T[] {
  const ref = new Date(referenceDate);
  // mês anterior — pode virar para o ano anterior em janeiro
  const prevMonth = ref.getMonth() === 0 ? 11 : ref.getMonth() - 1;
  const prevYear = ref.getMonth() === 0 ? ref.getFullYear() - 1 : ref.getFullYear();
  return sales.filter((s) => {
    const d = new Date(s.sale_date);
    return d.getFullYear() === prevYear && d.getMonth() === prevMonth;
  });
}

/**
 * Filtra vendas no mês corrente da data de referência.
 */
export function filterCurrentMonthSales<T extends SaleLike>(
  sales: T[],
  referenceDate = new Date(),
): T[] {
  const ref = new Date(referenceDate);
  return sales.filter((s) => {
    const d = new Date(s.sale_date);
    return d.getFullYear() === ref.getFullYear() && d.getMonth() === ref.getMonth();
  });
}

export interface KpiTotals {
  count: number;
  totalValue: number;
  totalComm: number;
  ticket: number;
}

export function computeKpiTotals<T extends SaleLike>(rows: T[]): KpiTotals {
  const count = rows.length;
  const totalValue = rows.reduce((a, s) => a + (s.released_value || 0), 0);
  const totalComm = rows.reduce((a, s) => a + (s.commission_value || 0), 0);
  const ticket = count > 0 ? totalValue / count : 0;
  return { count, totalValue, totalComm, ticket };
}
