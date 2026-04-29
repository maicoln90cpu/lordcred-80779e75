import { Badge } from '@/components/ui/badge';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { resolveV8StatusPair, getV8ToneClass } from '@/lib/v8StatusMapping';

interface Props {
  status?: string | null;
  /** Esconde a tag interna se ela for igual ao bucket oficial (evita duplicação visual). */
  hideInternalIfSame?: boolean;
  /** Tamanho compacto para tabelas. */
  compact?: boolean;
}

/**
 * Mostra os 2 badges lado a lado:
 *  - OFICIAL V8 (escuro, colorido pelo tom)
 *  - INTERNO LordCred (outline, status cru)
 *
 * Tooltip explica a equivalência em linguagem leiga.
 *
 * Uso:
 *   <V8StatusBadgePair status={ev.status} />
 *   <V8StatusBadgePair status="pending_pix" />     → [PENDENCY] [pending_pix]
 *   <V8StatusBadgePair status="paid" />            → [PAID]     (interna oculta — igual)
 */
export function V8StatusBadgePair({ status, hideInternalIfSame = true, compact = false }: Props) {
  const pair = resolveV8StatusPair(status);
  const sameLabel = pair.official.toUpperCase() === pair.internal.toUpperCase();
  const showInternal = !(hideInternalIfSame && sameLabel);
  const sizeClass = compact ? 'text-[10px] px-1.5 py-0' : '';

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <span className="inline-flex items-center gap-1">
          <Badge variant="outline" className={`${getV8ToneClass(pair.tone)} ${sizeClass} font-semibold`}>
            {pair.official}
          </Badge>
          {showInternal && (
            <Badge variant="outline" className={`${sizeClass} font-mono opacity-80`}>
              {pair.internal}
            </Badge>
          )}
        </span>
      </TooltipTrigger>
      <TooltipContent className="max-w-xs">
        <div className="space-y-1 text-xs">
          <div>
            <span className="font-semibold">Oficial V8:</span> {pair.official}
          </div>
          <div>
            <span className="font-semibold">Interno LordCred:</span> {pair.internal}
          </div>
          <div className="text-muted-foreground italic mt-1">{pair.description}</div>
        </div>
      </TooltipContent>
    </Tooltip>
  );
}
