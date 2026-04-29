import { Button } from '@/components/ui/button';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { Play, RefreshCw, X, Download, Pause } from 'lucide-react';

interface Props {
  running: boolean;
  showManualWarning: boolean;
  awaitingManualSim: number;
  onSimulateSelected: () => void;
  onRetryFailed: () => void;
  onReplayPending: () => void;
  onCancelBatch: () => void;
  /** Etapa 1 (item 9): exportar simulações do lote ativo em CSV. */
  onExportCsv?: () => void;
  exportDisabled?: boolean;
  /** Etapa 2 (item 6): pause/resume do lote — bloqueia cron e poller. */
  isPaused?: boolean;
  onTogglePause?: () => void;
}

/**
 * Barra de ações do lote ativo: Simular selecionados / Retentar falhados /
 * Buscar resultados pendentes / Pausar / Exportar CSV / Cancelar lote.
 * Apenas UI — toda a lógica fica no orquestrador.
 */
export default function BatchActionsBar({
  running, showManualWarning, awaitingManualSim,
  onSimulateSelected, onRetryFailed, onReplayPending, onCancelBatch,
  onExportCsv, exportDisabled,
  isPaused, onTogglePause,
}: Props) {
  return (
    <div className="flex flex-wrap gap-2">
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              size="sm"
              variant="default"
              disabled={running}
              onClick={onSimulateSelected}
              className={showManualWarning ? 'animate-pulse ring-2 ring-yellow-400' : undefined}
            >
              <Play className="w-3 h-3 mr-1" /> Simular selecionados{showManualWarning ? ` (${awaitingManualSim})` : ''}
            </Button>
          </TooltipTrigger>
          <TooltipContent side="bottom" className="max-w-xs text-xs">
            Roda /simulation nos CPFs com consulta SUCCESS — substitui as estimativas (faixa máxima do webhook) pelos valores REAIS calculados pela V8. Throttled (1 CPF a cada ~1.2s).
          </TooltipContent>
        </Tooltip>
        <Tooltip>
          <TooltipTrigger asChild>
            <Button size="sm" variant="secondary" disabled={running} onClick={onRetryFailed}>
              <RefreshCw className="w-3 h-3 mr-1" /> Retentar falhados
            </Button>
          </TooltipTrigger>
          <TooltipContent side="bottom" className="max-w-xs text-xs">
            Pede para a V8 fazer a consulta de novo nos CPFs que falharam por instabilidade ou análise pendente. Aumenta o número de "Tentativas". Não toca em consulta ativa, proposta existente ou dados inválidos.
          </TooltipContent>
        </Tooltip>
        <Tooltip>
          <TooltipTrigger asChild>
            <Button size="sm" variant="outline" onClick={onReplayPending}>
              <RefreshCw className="w-3 h-3 mr-1" /> Buscar resultados pendentes
            </Button>
          </TooltipTrigger>
          <TooltipContent side="bottom" className="max-w-xs text-xs">
            Pergunta à V8 se ela já tem resposta para consultas que enviamos mas que ainda não chegaram pelo webhook. Não conta como nova tentativa. Use se as linhas ficarem em "aguardando" por mais de 2 minutos.
          </TooltipContent>
        </Tooltip>
        {onExportCsv && (
          <Tooltip>
            <TooltipTrigger asChild>
              <Button size="sm" variant="outline" onClick={onExportCsv} disabled={exportDisabled}>
                <Download className="w-3 h-3 mr-1" /> Exportar CSV
              </Button>
            </TooltipTrigger>
            <TooltipContent side="bottom" className="max-w-xs text-xs">
              Baixa um arquivo CSV (abre no Excel) com nome, CPF, status, parcelas, valores e motivo de cada CPF do lote — na mesma ordem em que foram colados.
            </TooltipContent>
          </Tooltip>
        )}
        <Tooltip>
          <TooltipTrigger asChild>
            <Button size="sm" variant="destructive" onClick={onCancelBatch}>
              <X className="w-3 h-3 mr-1" /> Cancelar lote
            </Button>
          </TooltipTrigger>
          <TooltipContent side="bottom" className="max-w-xs text-xs">
            Para imediatamente o processamento deste lote. Pendentes viram FALHA (cancelado), retry/poller param de tocar nele. Use se um lote estiver "preso" ou se você disparou por engano.
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    </div>
  );
}
