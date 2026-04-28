import { useEffect, useState } from 'react';
import { Loader2 } from 'lucide-react';

/**
 * Pequeno indicador "atualizado há Xs" — feedback de que o realtime está vivo.
 */
export function RealtimeFreshness({ since }: { since: Date | null }) {
  const [, setTick] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setTick((n) => n + 1), 1000);
    return () => clearInterval(id);
  }, []);
  if (!since) return null;
  const seconds = Math.max(0, Math.floor((Date.now() - since.getTime()) / 1000));
  const label = seconds < 5 ? 'agora há pouco' : `há ${seconds}s`;
  return (
    <span className="text-[11px] text-muted-foreground inline-flex items-center gap-1">
      <span className="inline-block w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
      atualizado {label}
    </span>
  );
}

/**
 * Indicador "Auto-retry ativo" exibido enquanto houver simulações elegíveis para retry
 * sendo reprocessadas pelo cron `v8-retry-cron` (a cada 1 min).
 *
 * O cron é o motor real; este componente apenas TORNA VISÍVEL o que já está acontecendo,
 * para o usuário não ter a impressão de que precisa clicar em "Retentar" manualmente.
 */
export function AutoRetryIndicator({
  retryCount,
  maxAttempts,
}: {
  retryCount: number;
  maxAttempts: number;
}) {
  if (retryCount === 0) return null;
  return (
    <div className="flex items-center gap-2 rounded border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-xs">
      <Loader2 className="w-3 h-3 animate-spin text-amber-600" />
      <div className="flex-1">
        <strong className="text-amber-600">Auto-retry ativo</strong>
        {' — '}
        {retryCount} simulação(ões) sendo reprocessadas pela V8 automaticamente.
      </div>
      <span className="text-muted-foreground">
        teto: {maxAttempts} tentativas · varredura a cada 1 min
      </span>
    </div>
  );
}
