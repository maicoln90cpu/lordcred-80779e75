import { Button } from '@/components/ui/button';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { Play, RefreshCw, X, Download, Pause, Ban, Zap } from 'lucide-react';

interface Props {
  running: boolean;
  showManualWarning: boolean;
  awaitingManualSim: number;
  onSimulateSelected: () => void;
  /** @deprecated Removido da UI em abr/2026 (Onda 2 / item 8). Auto-retry cobre 100% dos casos. Prop mantida para compat de tipos. */
  onRetryFailed?: () => void;
  onReplayPending: () => void;
  onCancelBatch: () => void;
  /** Cancelamento duro: marca TODAS as sims (inclusive em análise) como falha e ignora webhooks futuros. */
  onCancelBatchHard?: () => void;
  /** Etapa 1 (item 9): exportar simulações do lote ativo em CSV. */
  onExportCsv?: () => void;
  exportDisabled?: boolean;
  /** Etapa 2 (item 6): pause/resume do lote — bloqueia cron e poller. */
  isPaused?: boolean;
  onTogglePause?: () => void;
  /** Etapa 4 (mai/2026): força dispatch de linhas presas (pending sem attempt). */
  onForceDispatchBatch?: () => void;
  stuckCount?: number;
}

/**
 * Barra de ações do lote ativo: Simular selecionados / Retentar falhados /
 * Buscar resultados pendentes / Pausar / Exportar CSV / Cancelar lote.
 * Apenas UI — toda a lógica fica no orquestrador.
 */
export default function BatchActionsBar({
  running, showManualWarning, awaitingManualSim,
  onSimulateSelected, onReplayPending, onCancelBatch, onCancelBatchHard,
  onExportCsv, exportDisabled,
  isPaused, onTogglePause,
  onForceDispatchBatch, stuckCount = 0,
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
        {/* Item 8 (abr/2026): "Retentar falhados" REMOVIDO da UI.
            Razão: o cron `v8-retry-cron` já reprocessa automaticamente todas as falhas
            classificadas como recuperáveis (instabilidade, análise pendente) com backoff.
            O botão manual gerava confusão (operador não sabia se devia clicar ou esperar)
            e podia estourar o limite de tentativas antes do cron concluir o ciclo. */}
        <Tooltip>
          <TooltipTrigger asChild>
            <Button size="sm" variant="outline" onClick={onReplayPending}>
              <RefreshCw className="w-3 h-3 mr-1" /> Reprocessar webhooks pendentes
            </Button>
          </TooltipTrigger>
          <TooltipContent side="bottom" className="max-w-xs text-xs">
            <strong>O que faz:</strong> varre os webhooks que a V8 nos enviou nos últimos 7 dias mas que ficaram com erro/sem processar (ex.: payload chegou enquanto o sistema estava em deploy). Reprocessa todos.
            <br /><br />
            <strong>O que NÃO faz:</strong> não pergunta nada novo para a V8. Se uma linha está em "aguardando" porque a V8 ainda não respondeu, este botão não muda nada.
            <br /><br />
            <strong>Quando usar:</strong> apenas se você suspeitar que algum resultado ficou perdido. Se o contador "ok=0" e "total=0", está tudo certo (não tem nada pendente).
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
        {onTogglePause && (
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                size="sm"
                variant={isPaused ? 'default' : 'outline'}
                onClick={onTogglePause}
                className={isPaused ? 'bg-amber-500 hover:bg-amber-600 text-white' : undefined}
              >
                {isPaused ? <Play className="w-3 h-3 mr-1" /> : <Pause className="w-3 h-3 mr-1" />}
                {isPaused ? 'Continuar' : 'Pausar'}
              </Button>
            </TooltipTrigger>
            <TooltipContent side="bottom" className="max-w-xs text-xs">
              {isPaused
                ? 'Retoma o lote: cron de retry e poller voltam a processar este lote automaticamente.'
                : 'Pausa o lote: cron de retry e poller automático param de tocar nele. Ações manuais (Simular/Retentar/Buscar) continuam funcionando. Use para evitar gastar tentativas enquanto investiga.'}
            </TooltipContent>
          </Tooltip>
        )}
        <Tooltip>
          <TooltipTrigger asChild>
            <Button size="sm" variant="destructive" onClick={onCancelBatch}>
              <X className="w-3 h-3 mr-1" /> Cancelar lote
            </Button>
          </TooltipTrigger>
          <TooltipContent side="bottom" className="max-w-sm text-xs space-y-1">
            <div><strong>O que faz:</strong> Para novas consultas deste lote. CPFs que ainda não foram enviados viram "cancelado".</div>
            <div className="text-emerald-200">✅ CPFs <strong>já enviados</strong> para a V8 continuam sendo ouvidos — se o resultado chegar depois, ele aparece normalmente. <strong>Não desperdiça consulta já paga.</strong></div>
            <div className="text-muted-foreground">Resultados com sucesso são sempre preservados.</div>
          </TooltipContent>
        </Tooltip>
        {onCancelBatchHard && (
          <Tooltip>
            <TooltipTrigger asChild>
              <Button size="sm" variant="destructive" onClick={onCancelBatchHard} className="bg-red-700 hover:bg-red-800">
                <Ban className="w-3 h-3 mr-1" /> Cancelar tudo
              </Button>
            </TooltipTrigger>
            <TooltipContent side="bottom" className="max-w-sm text-xs space-y-1">
              <div><strong>O que faz:</strong> Para TUDO imediatamente — inclusive ignora resultados de CPFs que já foram enviados para a V8.</div>
              <div className="text-red-200">🛑 <strong>Atenção:</strong> consultas já pagas serão <strong>perdidas</strong> (o sistema vai ignorar os webhooks que a V8 enviar depois).</div>
              <div className="text-muted-foreground">Use apenas em emergência, quando não se importar com os resultados pendentes.</div>
            </TooltipContent>
          </Tooltip>
        )}
      </TooltipProvider>
    </div>
  );
}
