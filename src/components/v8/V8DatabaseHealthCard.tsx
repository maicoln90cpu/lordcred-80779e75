/**
 * V8DatabaseHealthCard — "Saúde do banco" (Etapa 2).
 *
 * Mostra ao operador o quanto a integração V8 está consumindo do banco
 * Supabase: linhas em v8_simulations, v8_webhook_logs, antigos pendentes
 * de limpeza, e botão para forçar a rotina de limpeza manualmente.
 *
 * Lê via RPC `get_v8_database_health` (criada na Etapa 1) e dispara
 * `cleanup_webhook_logs` quando o operador clica em "Limpar agora".
 *
 * IMPORTANTE: o tamanho físico da tabela só cai depois de VACUUM FULL,
 * que precisa ser rodado fora da app (SQL Editor). Mostramos um aviso.
 */
import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Database, RefreshCw, Trash2, Loader2, AlertTriangle } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface HealthRow {
  total_simulations: number;
  total_webhooks_v8: number;
  webhooks_v8_older_than_3d: number;
  v8_webhook_table_size: string;
  v8_simulations_table_size: string;
  database_total_size: string;
}

export default function V8DatabaseHealthCard() {
  const [data, setData] = useState<HealthRow | null>(null);
  const [loading, setLoading] = useState(false);
  const [cleaning, setCleaning] = useState(false);

  async function load() {
    setLoading(true);
    try {
      const { data: rpcData, error } = await supabase.rpc('get_v8_database_health' as any);
      if (error) throw error;
      const row = Array.isArray(rpcData) ? rpcData[0] : rpcData;
      setData(row as HealthRow);
    } catch (err: any) {
      toast.error(`Erro ao consultar saúde do banco: ${err?.message || err}`);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { void load(); }, []);

  async function handleCleanNow() {
    if (!confirm('Apagar agora todos os webhooks V8 com mais de 3 dias?\n\nEssa rotina já roda automaticamente todo dia às 04h UTC. Use só se precisar liberar espaço imediatamente.')) return;
    setCleaning(true);
    try {
      const { error } = await supabase.rpc('cleanup_webhook_logs' as any);
      if (error) throw error;
      toast.success('Limpeza executada. Recarregando dados…');
      await load();
    } catch (err: any) {
      toast.error(`Erro: ${err?.message || err}`);
    } finally {
      setCleaning(false);
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Database className="w-5 h-5" />
          Saúde do banco (V8)
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="text-sm text-muted-foreground">
          Quanto a integração V8 ocupa do banco Supabase. A rotina de limpeza
          roda automaticamente todo dia às <strong>04h UTC (01h Brasília)</strong> e
          apaga webhooks com mais de 3 dias.
        </p>

        {loading && !data ? (
          <div className="py-8 flex justify-center">
            <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
          </div>
        ) : data ? (
          <>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
              <Stat label="Banco total" value={data.database_total_size} />
              <Stat label="Tabela webhooks V8" value={data.v8_webhook_table_size} />
              <Stat label="Tabela simulações V8" value={data.v8_simulations_table_size} />
              <Stat label="Simulações" value={Number(data.total_simulations).toLocaleString('pt-BR')} />
              <Stat label="Webhooks V8" value={Number(data.total_webhooks_v8).toLocaleString('pt-BR')} />
              <Stat
                label="Pendentes de limpeza (>3 dias)"
                value={Number(data.webhooks_v8_older_than_3d).toLocaleString('pt-BR')}
                warn={data.webhooks_v8_older_than_3d > 1000}
              />
            </div>

            {data.webhooks_v8_older_than_3d > 1000 && (
              <div className="rounded-md border border-amber-500/30 bg-amber-500/10 p-3 text-sm flex items-start gap-2">
                <AlertTriangle className="w-4 h-4 text-amber-600 mt-0.5 shrink-0" />
                <div>
                  Há <strong>{data.webhooks_v8_older_than_3d.toLocaleString('pt-BR')}</strong> webhooks
                  antigos que deveriam ter sido apagados. Verifique se o cron <code>cleanup-webhook-logs</code> está
                  ativo, ou clique em "Limpar agora".
                </div>
              </div>
            )}

            <div className="rounded-md border bg-muted/30 p-3 text-xs text-muted-foreground space-y-1">
              <div>
                💡 <strong>Importante</strong>: a limpeza apaga linhas, mas o tamanho
                físico do arquivo (<em>{data.v8_webhook_table_size}</em>) só cai
                depois de rodar <code className="font-mono">VACUUM FULL public.v8_webhook_logs;</code> no SQL Editor.
              </div>
              <div>
                O Postgres reaproveita o espaço internamente nas próximas inserções,
                então a tabela não cresce sem limite — só não devolve o espaço ao SO sem o VACUUM.
              </div>
            </div>
          </>
        ) : (
          <div className="text-sm text-muted-foreground">Sem dados.</div>
        )}

        <div className="flex flex-wrap gap-2">
          <Button variant="outline" size="sm" onClick={() => void load()} disabled={loading}>
            <RefreshCw className={`w-4 h-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
            Atualizar
          </Button>
          <Button
            variant="destructive"
            size="sm"
            onClick={handleCleanNow}
            disabled={cleaning || loading}
          >
            {cleaning ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Trash2 className="w-4 h-4 mr-2" />}
            Limpar webhooks &gt; 3 dias agora
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

function Stat({ label, value, warn }: { label: string; value: string | number; warn?: boolean }) {
  return (
    <div className={`rounded-md border p-3 ${warn ? 'border-amber-500/40 bg-amber-500/5' : ''}`}>
      <div className="text-[11px] uppercase tracking-wide text-muted-foreground">{label}</div>
      <div className={`text-lg font-semibold mt-0.5 ${warn ? 'text-amber-700 dark:text-amber-400' : ''}`}>
        {value}
      </div>
    </div>
  );
}
