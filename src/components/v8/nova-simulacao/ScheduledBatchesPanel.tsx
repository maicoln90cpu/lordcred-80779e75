import { useEffect, useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { CalendarClock, X, Loader2 } from 'lucide-react';
import { toast } from 'sonner';

interface ScheduledBatch {
  id: string;
  name: string;
  total_count: number;
  scheduled_for: string;
  scheduled_strategy: string | null;
  config_name: string | null;
  installments: number | null;
  is_paused: boolean;
}

/**
 * Etapa 3 (item 7): mostra lotes em status='scheduled' com countdown e botão
 * para cancelar o agendamento. Realtime via subscription em v8_batches.
 */
export default function ScheduledBatchesPanel() {
  const [batches, setBatches] = useState<ScheduledBatch[]>([]);
  const [loading, setLoading] = useState(true);
  const [now, setNow] = useState(Date.now());

  const reload = useCallback(async () => {
    setLoading(true);
    const { data } = await supabase
      .from('v8_batches')
      .select('id, name, total_count, scheduled_for, scheduled_strategy, config_name, installments, is_paused')
      .eq('status', 'scheduled')
      .order('scheduled_for', { ascending: true })
      .limit(20);
    setBatches((data ?? []) as ScheduledBatch[]);
    setLoading(false);
  }, []);

  useEffect(() => {
    reload();
    const ch = supabase
      .channel('v8-scheduled-batches')
      .on('postgres_changes',
        { event: '*', schema: 'public', table: 'v8_batches' },
        () => reload(),
      )
      .subscribe();
    const t = setInterval(() => setNow(Date.now()), 30_000); // tick countdown
    return () => { supabase.removeChannel(ch); clearInterval(t); };
  }, [reload]);

  async function handleCancel(batchId: string) {
    if (!confirm('Cancelar este agendamento? O lote não será iniciado.')) return;
    const { data, error } = await supabase.functions.invoke('v8-clt-api', {
      body: { action: 'cancel_schedule', params: { batch_id: batchId } },
    });
    if (error || !data?.success) {
      toast.error('Falha ao cancelar: ' + (data?.error || error?.message));
      return;
    }
    toast.success('Agendamento cancelado.');
    reload();
  }

  if (loading && batches.length === 0) return null;
  if (batches.length === 0) return null;

  function formatCountdown(iso: string): string {
    const ms = new Date(iso).getTime() - now;
    if (ms <= 0) return 'iniciando…';
    const min = Math.floor(ms / 60000);
    if (min < 60) return `em ${min} min`;
    const h = Math.floor(min / 60);
    const m = min % 60;
    if (h < 24) return `em ${h}h${m > 0 ? ` ${m}min` : ''}`;
    const d = Math.floor(h / 24);
    return `em ${d}d ${h % 24}h`;
  }

  return (
    <Card className="border-primary/30">
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          <CalendarClock className="w-4 h-4" />
          Lotes agendados ({batches.length})
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
        {batches.map((b) => (
          <div
            key={b.id}
            className="flex items-center justify-between gap-3 rounded-lg border border-border bg-muted/20 px-3 py-2 text-sm"
          >
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2 flex-wrap">
                <strong className="truncate">{b.name}</strong>
                <Badge variant="outline" className="text-xs">
                  {b.total_count} CPFs
                </Badge>
                {b.config_name && (
                  <Badge variant="secondary" className="text-xs">
                    {b.config_name} · {b.installments}x
                  </Badge>
                )}
                {b.is_paused && (
                  <Badge variant="outline" className="text-xs bg-amber-100 text-amber-900 border-amber-300">
                    ⏸ pausado
                  </Badge>
                )}
              </div>
              <div className="text-xs text-muted-foreground mt-0.5">
                {new Date(b.scheduled_for).toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' })}
                {' · '}
                <span className="font-medium text-foreground">{formatCountdown(b.scheduled_for)}</span>
              </div>
            </div>
            <Button size="sm" variant="ghost" onClick={() => handleCancel(b.id)}>
              <X className="w-3 h-3 mr-1" /> Cancelar
            </Button>
          </div>
        ))}
        {loading && (
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <Loader2 className="w-3 h-3 animate-spin" /> atualizando…
          </div>
        )}
      </CardContent>
    </Card>
  );
}
