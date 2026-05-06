import { computeFinancialBreakdown } from '@/lib/v8FinancialComposition';

const formatBRL = (n?: number | null) =>
  typeof n === 'number' && Number.isFinite(n)
    ? n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
    : '—';

interface Props {
  released?: number | null;
  installment?: number | null;
  installments?: number | null;
  /** Quando o servidor já calculou (coluna no banco), passa aqui pra evitar recalcular. */
  precomputed?: {
    total_paid?: number | null;
    total_interest?: number | null;
    markup_pct?: number | null;
    cet_monthly_pct?: number | null;
    cet_annual_pct?: number | null;
  } | null;
}

/**
 * Bloco "Composição financeira" — Etapa 6.
 *
 * Mostra de forma leiga a relação entre liberado, parcela, número de
 * parcelas e total efetivamente pago. Usa valores pré-calculados pelo
 * servidor (preferido) ou cai no cálculo local como fallback.
 */
export function FinancialCompositionBlock({ released, installment, installments, precomputed }: Props) {
  const local = computeFinancialBreakdown(released, installment, installments);
  if (!local) return null;

  const totalPaid = precomputed?.total_paid ?? local.totalPaid;
  const totalInterest = precomputed?.total_interest ?? local.totalInterest;
  const markupPct = precomputed?.markup_pct ?? local.markupPct;
  const cetMonthly = precomputed?.cet_monthly_pct ?? local.monthlyRatePct;
  const cetAnnual = precomputed?.cet_annual_pct ?? local.annualRatePct;

  return (
    <div
      data-testid="financial-composition-block"
      className="mt-3 rounded-md border border-amber-500/30 bg-amber-500/5 p-3 text-xs space-y-1"
    >
      <div className="font-semibold text-amber-700 dark:text-amber-400">
        💡 Composição financeira (entenda os números)
      </div>
      <div className="grid grid-cols-2 gap-x-4 gap-y-1">
        <div>
          <span className="text-muted-foreground">Total a pagar:</span>{' '}
          <strong>{formatBRL(totalPaid)}</strong> ({local.installments}× {formatBRL(local.installment)})
        </div>
        <div>
          <span className="text-muted-foreground">Juros totais:</span>{' '}
          <strong>{formatBRL(totalInterest)}</strong>
        </div>
        <div>
          <span className="text-muted-foreground">Markup sobre o liberado:</span>{' '}
          <strong>{markupPct.toFixed(1)}%</strong>
        </div>
        {cetMonthly != null && (
          <div>
            <span className="text-muted-foreground">CET aprox.:</span>{' '}
            <strong>{cetMonthly.toFixed(2)}% a.m.</strong>{' '}
            ({cetAnnual?.toFixed(1)}% a.a.)
          </div>
        )}
      </div>
      <div className="text-muted-foreground italic mt-1">
        O cliente recebe {formatBRL(local.released)} hoje e devolve {formatBRL(totalPaid)} ao final — a diferença ({formatBRL(totalInterest)}) é o custo do crédito.
      </div>
    </div>
  );
}
