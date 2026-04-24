import { TrendingUp, TrendingDown, Minus } from 'lucide-react';

interface KpiDeltaProps {
  current: number;
  previous: number;
  /** Texto curto sobre o que está sendo comparado, ex: "vs mês anterior" ou "vs 2 semanas anteriores" */
  comparisonLabel: string;
}

/**
 * Indicador de variação % entre o valor atual e o período anterior.
 * - ▲ verde: alta
 * - ▼ vermelho: queda
 * - — cinza: estável OU sem base (previous = 0)
 */
export default function KpiDelta({ current, previous, comparisonLabel }: KpiDeltaProps) {
  // Sem base de comparação → mostra "—" cinza
  if (previous === 0) {
    if (current === 0) {
      return (
        <p className="text-[11px] text-muted-foreground mt-1 flex items-center gap-1">
          <Minus className="w-3 h-3" /> sem dados anteriores
        </p>
      );
    }
    return (
      <p className="text-[11px] text-muted-foreground mt-1 flex items-center gap-1">
        <TrendingUp className="w-3 h-3" /> novo ({comparisonLabel})
      </p>
    );
  }

  const pct = ((current - previous) / previous) * 100;
  const rounded = Math.abs(pct) < 0.05 ? 0 : pct;

  if (rounded === 0) {
    return (
      <p className="text-[11px] text-muted-foreground mt-1 flex items-center gap-1">
        <Minus className="w-3 h-3" /> estável {comparisonLabel}
      </p>
    );
  }

  const isUp = rounded > 0;
  const color = isUp ? 'text-green-500' : 'text-destructive';
  const Icon = isUp ? TrendingUp : TrendingDown;
  const sign = isUp ? '+' : '';

  return (
    <p className={`text-[11px] mt-1 flex items-center gap-1 ${color}`}>
      <Icon className="w-3 h-3" />
      <span className="font-medium">{sign}{rounded.toFixed(1)}%</span>
      <span className="text-muted-foreground">{comparisonLabel}</span>
    </p>
  );
}
