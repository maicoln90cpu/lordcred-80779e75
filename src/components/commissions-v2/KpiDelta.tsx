// ⚠️ CÓPIA ISOLADA do KpiDelta de Comissões V1.
// Mantemos um arquivo dedicado em commissions-v2/ para que ajustes visuais
// na V2 (em homologação) NÃO impactem a V1 em produção.
// Se precisar mudar o comportamento na V1, edite src/components/commissions/KpiDelta.tsx.
import { TrendingUp, TrendingDown, Minus } from 'lucide-react';

interface KpiDeltaProps {
  current: number;
  previous: number;
  comparisonLabel: string;
}

export default function KpiDelta({ current, previous, comparisonLabel }: KpiDeltaProps) {
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
