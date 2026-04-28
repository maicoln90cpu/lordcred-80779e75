/**
 * Extrai a "Margem Disponível" do trabalhador (`availableMarginValue` da V8)
 * de um payload bruto. A V8 retorna esse campo em vários caminhos diferentes
 * conforme o tipo de evento (webhook de consulta, snapshot do poller,
 * resposta direta da check_consult_status, etc.).
 *
 * Esse é o valor LIVRE MENSAL que o cliente tem para comprometer com
 * uma nova operação consignada CLT. NÃO confundir com a "Margem LordCred"
 * (cálculo interno de 5% sobre o valor liberado).
 *
 * Retorna `null` quando nenhum dos caminhos conhecidos contém o valor.
 *
 * Mantenha esta lista de caminhos sincronizada com o que `v8-webhook` e
 * `v8-active-consult-poller` extraem do lado do servidor.
 */
export function extractAvailableMargin(raw: unknown): number | null {
  if (!raw || typeof raw !== 'object') return null;
  const r = raw as Record<string, any>;

  const candidates: Array<unknown> = [
    r.availableMarginValue,
    r.available_margin_value,
    r.availableMargin,
    r.marginValue,
    r.margem_disponivel,
    r.payload?.availableMarginValue,
    r.response?.availableMarginValue,
    r.data?.availableMarginValue,
    r.consult?.availableMarginValue,
    r.consult?.result?.availableMarginValue,
    r.result?.availableMarginValue,
    r.latest?.availableMarginValue,
    r.v8_status_snapshot?.latest?.availableMarginValue,
    r.v8_status_snapshot?.availableMarginValue,
  ];

  for (const c of candidates) {
    if (c == null) continue;
    const num = Number(c);
    if (Number.isFinite(num) && num > 0) return num;
  }
  return null;
}

export function formatMarginBRL(value: number | null | undefined): string {
  if (value == null || !Number.isFinite(Number(value))) return '—';
  return Number(value).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}
