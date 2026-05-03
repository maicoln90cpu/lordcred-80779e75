import { AlertTriangle } from 'lucide-react';

/**
 * Banner amarelo exibido em TODAS as abas do módulo Comissões Parceiros V2.
 * Sinaliza que o módulo está em homologação — V1 continua sendo a referência oficial.
 */
export default function V2BetaBanner() {
  return (
    <div className="flex items-start gap-2 rounded-md border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-amber-900 dark:text-amber-200">
      <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" />
      <div className="text-xs leading-snug">
        <strong>Módulo em homologação (BETA).</strong> Cálculos e relatórios da V2 ainda estão em validação contra a V1.
        Use <code className="px-1 rounded bg-background/60">/admin/commissions</code> (V1) como referência oficial até a liberação final.
      </div>
    </div>
  );
}
