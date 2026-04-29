import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ListOrdered, ChevronUp, ChevronDown, X, Loader2 } from 'lucide-react';
import { useState } from 'react';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { useV8Queue } from '@/hooks/useV8Queue';

/**
 * Etapa 4 (Item 10): exibe lotes na fila do operador.
 * - Mostra posição, nome, total de CPFs, tabela.
 * - Botões: ↑ ↓ (reordenar), ✕ (cancelar).
 * O launcher (pg_cron, 1min) promove o #1 para 'scheduled' assim que o lote
 * em andamento termina.
 */
export default function QueuedBatchesPanel() {
  const { queue, loading } = useV8Queue();
  const [busyId, setBusyId] = useState<string | null>(null);

  if (loading) return null;
  if (queue.length === 0) return null;

  const action = async (
    batchId: string,
    actionName: 'cancel_queue' | 'reorder_queue',
    extras: Record<string, unknown> = {},
  ) => {
    setBusyId(batchId);
    try {
      const { data, error } = await supabase.functions.invoke('v8-clt-api', {
        body: { action: actionName, params: { batch_id: batchId, ...extras } },
      });
      if (error || !data?.success) {
        toast.error('Falha: ' + (data?.error || error?.message || 'erro desconhecido'));
      } else if (actionName === 'cancel_queue') {
        toast.success('Lote removido da fila');
      }
    } finally {
      setBusyId(null);
    }
  };

  return (
    <Card className="border-blue-300 dark:border-blue-800 bg-blue-50/40 dark:bg-blue-950/20">
      <CardHeader className="pb-2">
        <CardTitle className="text-base flex items-center gap-2">
          <ListOrdered className="w-4 h-4" />
          Fila de execução
          <Badge variant="secondary" className="text-[10px]">{queue.length}</Badge>
        </CardTitle>
        <p className="text-xs text-muted-foreground">
          O lote em <strong>posição #1</strong> começa automaticamente assim que o lote atual terminar.
          O sistema confere a cada 1 min.
        </p>
      </CardHeader>
      <CardContent className="space-y-2">
        {queue.map((b, idx) => (
          <div
            key={b.id}
            className="flex items-center justify-between gap-2 rounded-md border border-border bg-background px-3 py-2"
          >
            <div className="flex items-center gap-3 min-w-0">
              <Badge className="h-6 w-7 justify-center" variant={idx === 0 ? 'default' : 'outline'}>
                #{b.queue_position}
              </Badge>
              <div className="min-w-0">
                <div className="text-sm font-medium truncate">{b.name}</div>
                <div className="text-xs text-muted-foreground truncate">
                  {b.total_count} CPF(s) · {b.config_name ?? '—'}
                  {b.installments ? ` · ${b.installments}x` : ''}
                </div>
              </div>
            </div>
            <div className="flex items-center gap-1">
              <Button
                size="icon" variant="ghost" className="h-7 w-7"
                disabled={busyId === b.id || idx === 0}
                onClick={() => action(b.id, 'reorder_queue', { direction: 'up' })}
                title="Mover para cima"
              >
                <ChevronUp className="w-4 h-4" />
              </Button>
              <Button
                size="icon" variant="ghost" className="h-7 w-7"
                disabled={busyId === b.id || idx === queue.length - 1}
                onClick={() => action(b.id, 'reorder_queue', { direction: 'down' })}
                title="Mover para baixo"
              >
                <ChevronDown className="w-4 h-4" />
              </Button>
              <Button
                size="icon" variant="ghost" className="h-7 w-7 text-destructive hover:text-destructive"
                disabled={busyId === b.id}
                onClick={() => action(b.id, 'cancel_queue')}
                title="Cancelar lote da fila"
              >
                {busyId === b.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <X className="w-4 h-4" />}
              </Button>
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
