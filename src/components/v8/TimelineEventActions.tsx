import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { Copy, RefreshCw, FileJson, Webhook as WebhookIcon, Loader2, Ban } from 'lucide-react';
import { toast } from 'sonner';
import V8RawJsonSheet from './V8RawJsonSheet';

interface Props {
  kind: 'simulation' | 'webhook' | 'operation';
  rowId: string;
  status?: string | null;
  /** ids relacionados, exibidos como botões de copiar */
  consultId?: string | null;
  operationId?: string | null;
  v8SimulationId?: string | null;
  /** título exibido no sheet do JSON */
  title?: string;
}

export default function TimelineEventActions({
  kind, rowId, status, consultId, operationId, v8SimulationId, title,
}: Props) {
  const [busy, setBusy] = useState<string | null>(null);
  const [showJson, setShowJson] = useState(false);

  function copyId(label: string, value?: string | null) {
    if (!value) return;
    navigator.clipboard.writeText(value);
    toast.success(`${label} copiado`);
  }

  async function reprocess() {
    setBusy('reprocess');
    try {
      const { data, error } = await supabase.functions.invoke('v8-retry-cron', {
        body: { manual: true, simulation_ids: [rowId] },
      });
      if (error) throw error;
      toast.success(
        data?.retried_ok ? 'Reprocessamento disparado' :
        data?.skipped_missing_config ? 'Sem config — não pôde reprocessar' :
        'Sem candidatos elegíveis (talvez já esteja em sucesso)',
      );
    } catch (e: any) {
      toast.error(`Falhou: ${e?.message ?? e}`);
    } finally {
      setBusy(null);
    }
  }

  async function replay() {
    setBusy('replay');
    try {
      const { data, error } = await supabase.functions.invoke('v8-webhook', {
        body: { action: 'replay_pending', limit: 100 },
      });
      if (error) throw error;
      toast.success(`Replay: ${data?.success ?? 0} ok / ${data?.failed ?? 0} falha`);
    } catch (e: any) {
      toast.error(`Falhou: ${e?.message ?? e}`);
    } finally {
      setBusy(null);
    }
  }

  const canReprocess = kind === 'simulation' && (status === 'failed' || status === 'pending');
  const canReplay = kind === 'webhook';

  return (
    <>
      <div className="flex flex-wrap items-center gap-1 mt-1">
        {canReprocess && (
          <Tooltip>
            <TooltipTrigger asChild>
              <Button size="sm" variant="ghost" className="h-7 px-2" onClick={reprocess} disabled={busy === 'reprocess'}>
                {busy === 'reprocess' ? <Loader2 className="w-3 h-3 animate-spin" /> : <RefreshCw className="w-3 h-3" />}
                <span className="ml-1 text-xs">Reprocessar</span>
              </Button>
            </TooltipTrigger>
            <TooltipContent>Re-dispara essa simulação no v8-retry-cron</TooltipContent>
          </Tooltip>
        )}
        {canReplay && (
          <Tooltip>
            <TooltipTrigger asChild>
              <Button size="sm" variant="ghost" className="h-7 px-2" onClick={replay} disabled={busy === 'replay'}>
                {busy === 'replay' ? <Loader2 className="w-3 h-3 animate-spin" /> : <WebhookIcon className="w-3 h-3" />}
                <span className="ml-1 text-xs">Replay pendentes</span>
              </Button>
            </TooltipTrigger>
            <TooltipContent>Reprocessa webhooks pendentes dos últimos 7 dias</TooltipContent>
          </Tooltip>
        )}
        <Tooltip>
          <TooltipTrigger asChild>
            <Button size="sm" variant="ghost" className="h-7 px-2" onClick={() => setShowJson(true)}>
              <FileJson className="w-3 h-3" />
              <span className="ml-1 text-xs">JSON</span>
            </Button>
          </TooltipTrigger>
          <TooltipContent>Ver payload bruto (debug)</TooltipContent>
        </Tooltip>
        {consultId && (
          <Tooltip>
            <TooltipTrigger asChild>
              <Button size="sm" variant="ghost" className="h-7 px-2" onClick={() => copyId('consult_id', consultId)}>
                <Copy className="w-3 h-3" />
                <span className="ml-1 text-xs font-mono">consult</span>
              </Button>
            </TooltipTrigger>
            <TooltipContent className="font-mono text-[10px]">{consultId}</TooltipContent>
          </Tooltip>
        )}
        {operationId && (
          <Tooltip>
            <TooltipTrigger asChild>
              <Button size="sm" variant="ghost" className="h-7 px-2" onClick={() => copyId('operation_id', operationId)}>
                <Copy className="w-3 h-3" />
                <span className="ml-1 text-xs font-mono">operation</span>
              </Button>
            </TooltipTrigger>
            <TooltipContent className="font-mono text-[10px]">{operationId}</TooltipContent>
          </Tooltip>
        )}
        {v8SimulationId && (
          <Tooltip>
            <TooltipTrigger asChild>
              <Button size="sm" variant="ghost" className="h-7 px-2" onClick={() => copyId('v8_simulation_id', v8SimulationId)}>
                <Copy className="w-3 h-3" />
                <span className="ml-1 text-xs font-mono">sim_id</span>
              </Button>
            </TooltipTrigger>
            <TooltipContent className="font-mono text-[10px]">{v8SimulationId}</TooltipContent>
          </Tooltip>
        )}
      </div>
      {showJson && (
        <V8RawJsonSheet
          open={showJson}
          onOpenChange={setShowJson}
          kind={kind}
          rowId={rowId}
          title={title}
        />
      )}
    </>
  );
}
