// ⚠️ CÓPIA ISOLADA dos helpers de período de Comissões V1.
// Mantemos um arquivo dedicado em commissions-v2/ para que evoluções da V2
// (em homologação) não regridam a V1 em produção.
// Se mudar a lógica em V1, edite src/components/commissions/kpiPeriodUtils.ts.

export interface SaleLike {
  sale_date: string;
  released_value: number;
  commission_value: number;
  week_label?: string | null;
  seller_id: string;
  product?: string | null;
}

export function getPreviousWeekLabels(
  selectedWeeks: string[],
  availableWeeksDesc: string[],
): string[] {
  if (selectedWeeks.length === 0) return [];
  if (availableWeeksDesc.length === 0) return [];
  const indices = selectedWeeks
    .map((w) => availableWeeksDesc.indexOf(w))
    .filter((i) => i >= 0)
    .sort((a, b) => a - b);
  if (indices.length === 0) return [];
  const lastIndex = indices[indices.length - 1];
  const count = selectedWeeks.length;
  const previous: string[] = [];
  for (let i = lastIndex + 1; i < availableWeeksDesc.length && previous.length < count; i++) {
    previous.push(availableWeeksDesc[i]);
  }
  return previous;
}

export function filterPreviousMonthSales<T extends SaleLike>(sales: T[], referenceDate = new Date()): T[] {
  const ref = new Date(referenceDate);
  const prevMonth = ref.getMonth() === 0 ? 11 : ref.getMonth() - 1;
  const prevYear = ref.getMonth() === 0 ? ref.getFullYear() - 1 : ref.getFullYear();
  return sales.filter((s) => {
    const d = new Date(s.sale_date);
    return d.getFullYear() === prevYear && d.getMonth() === prevMonth;
  });
}

export function filterCurrentMonthSales<T extends SaleLike>(sales: T[], referenceDate = new Date()): T[] {
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
