/**
 * MargemDispCell — célula reutilizável da coluna "💰 Margem Disp." nas tabelas
 * V8 (Nova Simulação e Histórico).
 *
 * Frente B: além de mostrar o valor, agora exibe um Tooltip explicando a ORIGEM
 * do número — útil porque a margem pode ter vindo de:
 *
 *  - consulta nova com sucesso (status=success)
 *  - snapshot da V8 quando uma consulta antiga ainda está rodando
 *    (status=failed/active_consult ou status=pending/WAITING_EXTERNAL)
 *  - extração direta do raw_response em casos legados
 *
 * Sem este tooltip, o operador via R$ 345,05 numa linha "falha" e não entendia
 * de onde veio o número.
 */
import { Info } from 'lucide-react';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { extractAvailableMargin, formatMarginBRL } from '@/lib/v8MarginExtractor';

type Simulation = {
  status?: string | null;
  error_kind?: string | null;
  webhook_status?: string | null;
  margem_valor?: number | string | null;
  raw_response?: any;
};

function getMarginOrigin(s: Simulation): string {
  const status = (s.status || '').toLowerCase();
  const kind = (s.error_kind || s.raw_response?.kind || s.raw_response?.error_kind || '').toLowerCase();
  const ws = (s.webhook_status || '').toUpperCase();

  if (status === 'success') {
    return 'Margem retornada pela V8 na consulta deste lote.';
  }
  if (status === 'pending' && (kind === 'active_consult' || ws === 'WAITING_EXTERNAL')) {
    return 'Margem detectada via consulta antiga em andamento na V8 (de outra plataforma ou tentativa anterior). Será atualizada quando a consulta concluir.';
  }
  if (status === 'failed' && kind === 'active_consult') {
    return 'Margem detectada via consulta ativa de outra plataforma. A V8 recusou abrir consulta nova, mas devolveu o snapshot atual do trabalhador.';
  }
  if (status === 'failed') {
    return 'Margem capturada do último snapshot da V8 antes da falha.';
  }
  return 'Margem disponível do trabalhador (availableMarginValue da V8).';
}

export function MargemDispCell({ simulation }: { simulation: Simulation }) {
  const margin = simulation.margem_valor != null
    ? Number(simulation.margem_valor)
    : extractAvailableMargin(simulation.raw_response);

  if (margin == null || !Number.isFinite(margin) || margin <= 0) {
    return <span className="text-muted-foreground">—</span>;
  }

  return (
    <TooltipProvider delayDuration={150}>
      <Tooltip>
        <TooltipTrigger asChild>
          <span className="inline-flex items-center gap-1 font-semibold text-emerald-700 cursor-help">
            {formatMarginBRL(margin)}
            <Info className="h-3 w-3 opacity-50" />
          </span>
        </TooltipTrigger>
        <TooltipContent side="left" className="max-w-xs text-xs leading-relaxed">
          {getMarginOrigin(simulation)}
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
