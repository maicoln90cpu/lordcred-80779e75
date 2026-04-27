import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ChevronDown, ChevronRight, RefreshCw, Loader2 } from 'lucide-react';
import { useV8Batches, useV8BatchSimulations } from '@/hooks/useV8Batches';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { isRetriableErrorKind } from '@/lib/v8ErrorClassification';
import {
  getV8ErrorHeadline,
  getV8ErrorMeta,
  getV8ErrorSecondary,
  stringifyV8Payload,
} from '@/lib/v8ErrorPresentation';

function BatchDetail({ batchId }: { batchId: string }) {
  const { simulations } = useV8BatchSimulations(batchId);
  const { toast } = useToast();
  const [retrying, setRetrying] = useState(false);

  const failedRetriable = simulations.filter((s) => {
    if (s.status !== 'failed') return false;
    const kind = (s as any).raw_response?.kind || (s as any).raw_response?.error_kind || null;
    return isRetriableErrorKind(kind);
  });

  const handleRetry = async () => {
    if (failedRetriable.length === 0) return;
    setRetrying(true);
    try {
      const { data, error } = await supabase.functions.invoke('v8-retry-cron', {
        body: { batch_id: batchId, manual: true },
      });
      if (error) throw error;
      toast({
        title: 'Retentativa iniciada',
        description: `${(data as any)?.eligible ?? failedRetriable.length} simulações reenviadas. Os resultados aparecerão em alguns segundos.`,
      });
    } catch (err: any) {
      toast({ title: 'Erro ao retentar', description: err?.message || String(err), variant: 'destructive' });
    } finally {
      setRetrying(false);
    }
  };

  return (
    <div className="space-y-2 mt-2">
      {failedRetriable.length > 0 && (
        <div className="flex items-center justify-between rounded border border-yellow-500/30 bg-yellow-500/10 px-3 py-2">
          <span className="text-xs">
            <strong>{failedRetriable.length}</strong> simulação(ões) falhada(s) podem ser retentadas (instabilidade da V8 / análise pendente).
          </span>
          <Button size="sm" variant="outline" onClick={handleRetry} disabled={retrying} className="h-7">
            {retrying ? <Loader2 className="w-3 h-3 mr-1 animate-spin" /> : <RefreshCw className="w-3 h-3 mr-1" />}
            Retentar falhados
          </Button>
        </div>
      )}
      <div className="border rounded overflow-x-auto">
      <table className="w-full text-xs">
        <thead className="bg-muted">
          <tr>
            <th className="px-2 py-1 text-left">CPF</th>
            <th className="px-2 py-1 text-left">Nome</th>
            <th className="px-2 py-1 text-left">Status</th>
            <th className="px-2 py-1 text-right">Liberado</th>
            <th className="px-2 py-1 text-right">Parcela</th>
            <th className="px-2 py-1 text-right">Margem</th>
            <th className="px-2 py-1 text-right">A cobrar</th>
            <th className="px-2 py-1 text-center">Tentativas</th>
            <th className="px-2 py-1 text-left">Motivo / payload</th>
          </tr>
        </thead>
        <tbody>
          {simulations.map((s) => (
            <tr key={s.id} className="border-t">
              <td className="px-2 py-1 font-mono">{s.cpf}</td>
              <td className="px-2 py-1">{s.name || '—'}</td>
              <td className="px-2 py-1">
                <Badge
                  variant={s.status === 'success' ? 'default' : s.status === 'failed' ? 'destructive' : 'secondary'}
                >
                  {s.status}
                </Badge>
              </td>
              <td className="px-2 py-1 text-right">{s.released_value != null ? `R$ ${Number(s.released_value).toFixed(2)}` : '—'}</td>
              <td className="px-2 py-1 text-right">{s.installment_value != null ? `R$ ${Number(s.installment_value).toFixed(2)}` : '—'}</td>
              <td className="px-2 py-1 text-right">{s.company_margin != null ? `R$ ${Number(s.company_margin).toFixed(2)}` : '—'}</td>
              <td className="px-2 py-1 text-right">{s.amount_to_charge != null ? `R$ ${Number(s.amount_to_charge).toFixed(2)}` : '—'}</td>
              <td className="px-2 py-1 text-center">{s.attempt_count ?? 0}</td>
              <td className="px-2 py-1 align-top">
                {s.error_message || s.raw_response ? (
                  <div className="space-y-1">
                    <div className="whitespace-pre-line font-medium">
                      {getV8ErrorHeadline(s.raw_response, s.error_message) || 'Sem detalhe informado'}
                    </div>
                    {getV8ErrorSecondary(s.raw_response) && (
                      <div className="whitespace-pre-line text-muted-foreground">
                        {getV8ErrorSecondary(s.raw_response)}
                      </div>
                    )}
                    {(getV8ErrorMeta(s.raw_response).step || getV8ErrorMeta(s.raw_response).kind) && (
                      <div className="text-[11px] text-muted-foreground">
                        {getV8ErrorMeta(s.raw_response).step ? `etapa: ${getV8ErrorMeta(s.raw_response).step}` : null}
                        {getV8ErrorMeta(s.raw_response).step && getV8ErrorMeta(s.raw_response).kind ? ' • ' : null}
                        {getV8ErrorMeta(s.raw_response).kind ? `tipo: ${getV8ErrorMeta(s.raw_response).kind}` : null}
                      </div>
                    )}
                    {getV8ErrorMeta(s.raw_response).guidance && (
                      <div className="whitespace-pre-line text-[11px] text-muted-foreground">
                        {getV8ErrorMeta(s.raw_response).guidance}
                      </div>
                    )}
                    {stringifyV8Payload(s.raw_response) && (
                      <details className="rounded border border-border bg-muted/30 p-2">
                        <summary className="cursor-pointer text-[11px] font-medium text-muted-foreground">
                          Ver payload bruto
                        </summary>
                        <pre className="mt-2 overflow-x-auto whitespace-pre-wrap break-words font-mono text-[11px] text-muted-foreground">
                          {stringifyV8Payload(s.raw_response)}
                        </pre>
                      </details>
                    )}
                  </div>
                ) : (
                  <span className="text-muted-foreground">—</span>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      </div>
    </div>
  );
}

export default function V8HistoricoTab() {
  const { batches, loading } = useV8Batches();
  const [expanded, setExpanded] = useState<string | null>(null);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Histórico de Lotes</CardTitle>
      </CardHeader>
      <CardContent>
        {loading && <p className="text-sm text-muted-foreground">Carregando...</p>}
        {!loading && batches.length === 0 && (
          <p className="text-sm text-muted-foreground">Nenhum lote encontrado.</p>
        )}
        <div className="space-y-2">
          {batches.map((b) => {
            const successRate = b.total_count > 0 ? Math.round((b.success_count / b.total_count) * 100) : 0;
            const isOpen = expanded === b.id;
            return (
              <div key={b.id} className="border rounded">
                <button
                  type="button"
                  onClick={() => setExpanded(isOpen ? null : b.id)}
                  className="w-full flex items-center gap-2 p-3 hover:bg-muted/50 transition-colors text-left"
                >
                  {isOpen ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                  <div className="flex-1">
                    <div className="font-medium text-sm">{b.name}</div>
                    <div className="text-xs text-muted-foreground">
                      {b.config_name || b.config_id} • {b.installments}x • {new Date(b.created_at).toLocaleString('pt-BR')}
                    </div>
                  </div>
                  <Badge variant={b.status === 'completed' ? 'default' : 'secondary'}>
                    {b.status}
                  </Badge>
                  <Badge variant="outline">{b.success_count}/{b.total_count} ok</Badge>
                  <Badge variant="outline">{successRate}%</Badge>
                </button>
                {isOpen && <div className="px-3 pb-3"><BatchDetail batchId={b.id} /></div>}
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}
