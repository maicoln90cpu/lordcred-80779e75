import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { Copy, RefreshCw, FileJson, Webhook as WebhookIcon, Loader2, Ban, KeyRound, FileUp } from 'lucide-react';
import { toast } from 'sonner';
import V8RawJsonSheet from './V8RawJsonSheet';
import ResolvePixPendencyDialog from './ResolvePixPendencyDialog';
import UploadDocumentsDialog from './UploadDocumentsDialog';

interface Props {
  kind: 'simulation' | 'webhook' | 'operation';
  rowId: string;
  status?: string | null;
  /** ids relacionados, exibidos como botões de copiar */
  consultId?: string | null;
  operationId?: string | null;
  v8SimulationId?: string | null;
  /** CPF do tomador — usado para pré-preencher dialog de PIX */
  borrowerCpf?: string | null;
  /** título exibido no sheet do JSON */
  title?: string;
}

export default function TimelineEventActions({
  kind, rowId, status, consultId, operationId, v8SimulationId, borrowerCpf, title,
}: Props) {
  const [busy, setBusy] = useState<string | null>(null);
  const [showJson, setShowJson] = useState(false);
  const [showPixDialog, setShowPixDialog] = useState(false);
  const [showDocsDialog, setShowDocsDialog] = useState(false);

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

  async function cancelOperation() {
    if (!operationId) {
      toast.error('Sem operation_id para cancelar');
      return;
    }
    const reason = window.prompt(
      `Cancelar a operação ${operationId.slice(0, 12)}… na V8?\n\nMotivo (opcional, será enviado e auditado):`,
      '',
    );
    // null = usuário cancelou o prompt; string vazia = confirmou sem motivo.
    if (reason === null) return;
    setBusy('cancel');
    try {
      const { data, error } = await supabase.functions.invoke('v8-clt-api', {
        body: { action: 'cancel_operation', operationId, reason: reason || undefined },
      });
      if (error) throw error;
      if (!data?.success) {
        throw new Error(data?.error || data?.title || 'Falha ao cancelar na V8');
      }
      toast.success('Operação cancelada na V8');
    } catch (e: any) {
      toast.error(`Falhou: ${e?.message ?? e}`);
    } finally {
      setBusy(null);
    }
  }

  const canReprocess = kind === 'simulation' && (status === 'failed' || status === 'pending');
  const canReplay = kind === 'webhook';
  // Status finais — não permitem cancelamento na V8.
  const finalStatuses = new Set([
    'paid', 'canceled', 'cancelled', 'rejected', 'expired', 'finished', 'completed',
  ]);
  const normalizedStatus = (status || '').toLowerCase();
  const canCancelOperation =
    kind === 'operation' && !!operationId && !finalStatuses.has(normalizedStatus);
  // Pendência de PIX — V8 retorna status como pending_pix / pending_payment_data.
  const pixPendencyStatuses = new Set(['pending_pix', 'pending_payment_data']);
  const canResolvePix =
    kind === 'operation' && !!operationId && pixPendencyStatuses.has(normalizedStatus);

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
        {canCancelOperation && (
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                size="sm"
                variant="ghost"
                className="h-7 px-2 text-red-600 hover:text-red-700 hover:bg-red-50 dark:hover:bg-red-950"
                onClick={cancelOperation}
                disabled={busy === 'cancel'}
              >
                {busy === 'cancel' ? <Loader2 className="w-3 h-3 animate-spin" /> : <Ban className="w-3 h-3" />}
                <span className="ml-1 text-xs">Cancelar na V8</span>
              </Button>
            </TooltipTrigger>
            <TooltipContent>POST /operation/{'{id}'}/cancel — apenas admin/manager</TooltipContent>
          </Tooltip>
        )}
        {canResolvePix && (
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                size="sm"
                variant="ghost"
                className="h-7 px-2 text-amber-600 hover:text-amber-700 hover:bg-amber-50 dark:hover:bg-amber-950"
                onClick={() => setShowPixDialog(true)}
              >
                <KeyRound className="w-3 h-3" />
                <span className="ml-1 text-xs">Resolver PIX</span>
              </Button>
            </TooltipTrigger>
            <TooltipContent>PATCH /operation/{'{id}'}/pendency/payment-data — admin/manager</TooltipContent>
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
      {showPixDialog && operationId && (
        <ResolvePixPendencyDialog
          open={showPixDialog}
          onOpenChange={setShowPixDialog}
          operationId={operationId}
          borrowerCpf={borrowerCpf}
        />
      )}
    </>
  );
}
