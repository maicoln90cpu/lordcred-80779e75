/**
 * Exporta as simulações do lote ativo para CSV (UTF-8 BOM, separador `;`
 * — Excel BR abre direto sem desconfigurar acentos ou colunas).
 *
 * Etapa 1 (item 9) do plano de melhorias V8.
 */

function fmtMoney(v: number | null | undefined): string {
  if (v == null || !Number.isFinite(Number(v))) return '';
  return Number(v).toFixed(2).replace('.', ',');
}

function escapeCsv(value: unknown): string {
  if (value == null) return '';
  const s = String(value);
  // Aspas dobradas e escape se contém ; " \n
  if (/[;"\n\r]/.test(s)) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
}

function statusLabel(s: any): string {
  const k = s?.error_kind || s?.raw_response?.kind || s?.raw_response?.error_kind || null;
  if (s?.status === 'success') return s?.simulate_status === 'success' ? 'sucesso (proposta)' : 'sucesso (margem)';
  if (s?.status === 'failed' && k === 'active_consult') return 'consulta ativa';
  if (s?.status === 'failed' && k === 'rejected_by_v8') return 'rejeitado pela V8';
  if (s?.status === 'failed' && k === 'canceled') return 'cancelado';
  if (s?.status === 'failed' && k === 'existing_proposal') return 'proposta existente';
  if (s?.status === 'failed' && k === 'invalid_data') return 'dados inválidos';
  if (s?.status === 'failed' && k === 'temporary_v8') return 'instável';
  if (s?.status === 'failed') return 'falha';
  if (s?.status === 'pending') return 'pendente';
  return s?.status ?? '—';
}

function reasonText(s: any): string {
  if (s?.simulate_error_message) return String(s.simulate_error_message);
  if (s?.error_message) return String(s.error_message);
  return '';
}

export interface BatchExportRow {
  paste_order: number | null;
  name: string | null;
  cpf: string;
  status: string;
  installments: number | null;
  released_value: number | null;
  installment_value: number | null;
  margem_valor: number | null;
  attempt_count: number | null;
  reason: string;
}

export function buildCsvFromSimulations(simulations: any[]): string {
  // Etapa 3 (mai/2026): ordem do CSV alinhada à BatchProgressTable
  // (NOME, CPF, STATUS, MOTIVO, VALOR LIBERADO, PARCELAS, VALOR PARCELA, TENTATIVAS).
  // "Margem disponível" fica como coluna extra ao final (não está na tabela mas é útil).
  const header = [
    'Ordem',
    'Nome',
    'CPF',
    'Status',
    'Motivo',
    'Valor liberado',
    'Parcelas',
    'Valor parcela',
    'Tentativas',
    'Margem disponível',
  ];
  const lines: string[] = [header.join(';')];
  simulations.forEach((s, idx) => {
    const ordem = (s?.paste_order ?? idx) + 1;
    lines.push([
      escapeCsv(ordem),
      escapeCsv(s?.name ?? ''),
      escapeCsv(s?.cpf ?? ''),
      escapeCsv(statusLabel(s)),
      escapeCsv(reasonText(s)),
      escapeCsv(fmtMoney(s?.released_value)),
      escapeCsv(s?.installments ?? ''),
      escapeCsv(fmtMoney(s?.installment_value)),
      escapeCsv(s?.attempt_count ?? 0),
      escapeCsv(fmtMoney(s?.margem_valor)),
    ].join(';'));
  });
  return lines.join('\r\n');
}

export function downloadBatchCsv(simulations: any[], batchName?: string | null): void {
  const csv = buildCsvFromSimulations(simulations);
  // BOM UTF-8 para Excel BR reconhecer acentos.
  const blob = new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  const safe = (batchName || 'lote').replace(/[^\w\-]+/g, '_').slice(0, 40);
  const ts = new Date().toISOString().replace(/[:T]/g, '-').slice(0, 16);
  a.href = url;
  a.download = `v8-${safe}-${ts}.csv`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
