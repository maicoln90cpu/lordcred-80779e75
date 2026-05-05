/**
 * V8DatabaseHealthCard — "Saúde do banco" (Etapa 3 abr/2026).
 *
 * Monitora 5 tabelas técnicas do sistema. As 3 PRIMEIRAS têm limpeza
 * automática diária (retenção 1 dia); as 2 ÚLTIMAS são apenas observadas
 * (mantemos histórico).
 *
 *   1. audit_logs           — limpeza automática 1d
 *   2. v8_webhook_logs      — limpeza automática 1d
 *   3. webhook_logs (UazAPI)— limpeza automática 1d
 *   4. chip_lifecycle_logs  — só monitora (histórico do chip)
 *   5. v8_simulations       — só monitora (histórico de consultas)
 *
 * Lê via RPC `get_v8_database_health` e dispara `cleanup_webhook_logs` /
 * `cleanup_audit_logs` quando o operador clica em "Limpar agora".
 *
 * IMPORTANTE: o tamanho físico da tabela só cai depois de VACUUM FULL
 * (rodado fora da app, no SQL Editor). O Postgres reaproveita o espaço
 * internamente nas próximas inserções.
 */
import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Database, RefreshCw, Trash2, Loader2, AlertTriangle, Eye, Clock, CheckCircle2, XCircle } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { formatDistanceToNow } from 'date-fns';
import { ptBR } from 'date-fns/locale';

interface CronJobStatus {
  jobname: string;
  schedule: string;
  active: boolean;
  last_run_at: string | null;
  last_status: string | null;
}

interface HealthRow {
  // V8
  total_simulations: number;
  total_webhooks_v8: number;
  webhooks_v8_older_than_1d: number;
  v8_webhook_table_size: string;
  v8_simulations_table_size: string;
  database_total_size: string;
  // audit_logs
  total_audit_logs: number;
  audit_logs_older_than_1d: number;
  audit_logs_table_size: string;
  // webhook_logs (UazAPI)
  total_webhook_logs: number;
  webhook_logs_older_than_1d: number;
  webhook_logs_table_size: string;
  // chip_lifecycle_logs
  total_chip_lifecycle_logs: number;
  chip_lifecycle_logs_table_size: string;
}

export default function V8DatabaseHealthCard() {
  const [data, setData] = useState<HealthRow | null>(null);
  const [crons, setCrons] = useState<CronJobStatus[]>([]);
  const [loading, setLoading] = useState(false);
  const [cleaningWebhooks, setCleaningWebhooks] = useState(false);
  const [cleaningAudit, setCleaningAudit] = useState(false);

  async function load() {
    setLoading(true);
    try {
      const [healthRes, cronRes] = await Promise.all([
        supabase.rpc('get_v8_database_health' as any),
        supabase.rpc('get_v8_cron_jobs_status' as any),
      ]);
      if (healthRes.error) throw healthRes.error;
      const row = Array.isArray(healthRes.data) ? healthRes.data[0] : healthRes.data;
      setData(row as HealthRow);
      if (!cronRes.error && Array.isArray(cronRes.data)) {
        setCrons(cronRes.data as CronJobStatus[]);
      }
    } catch (err: any) {
      toast.error(`Erro ao consultar saúde do banco: ${err?.message || err}`);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { void load(); }, []);

  async function handleCleanWebhooks() {
    if (!confirm('Apagar agora todos os webhooks (UazAPI + V8) com mais de 1 dia?\n\nEssa rotina já roda automaticamente todo dia às 04h UTC. Use só se precisar liberar espaço imediatamente.')) return;
    setCleaningWebhooks(true);
    try {
      const { error } = await supabase.rpc('cleanup_webhook_logs' as any);
      if (error) throw error;
      toast.success('Webhooks antigos limpos. Recarregando…');
      await load();
    } catch (err: any) {
      toast.error(`Erro: ${err?.message || err}`);
    } finally {
      setCleaningWebhooks(false);
    }
  }

  async function handleCleanAudit() {
    if (!confirm('Apagar agora todos os audit_logs com mais de 1 dia?\n\nEssa rotina já roda automaticamente todo dia às 03h15 UTC.')) return;
    setCleaningAudit(true);
    try {
      const { error } = await supabase.rpc('cleanup_audit_logs' as any);
      if (error) throw error;
      toast.success('Audit logs antigos limpos. Recarregando…');
      await load();
    } catch (err: any) {
      toast.error(`Erro: ${err?.message || err}`);
    } finally {
      setCleaningAudit(false);
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Database className="w-5 h-5" />
          Saúde do banco — 5 tabelas técnicas
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="text-sm text-muted-foreground">
          Monitora as 5 tabelas técnicas do sistema. <strong>3 são limpas automaticamente</strong> todo dia
          (retenção <strong>1 dia</strong>): audit_logs (03h15 UTC), webhook_logs UazAPI (04h UTC) e v8_webhook_logs (04h UTC).
          <br />As outras 2 (<em>chip_lifecycle_logs</em> e <em>v8_simulations</em>) ficam só monitoradas — têm valor de histórico.
        </p>

        {loading && !data ? (
          <div className="py-8 flex justify-center">
            <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
          </div>
        ) : data ? (
          <>
            <div className="rounded-md border bg-muted/20 p-2 text-xs text-muted-foreground">
              <strong>Banco total:</strong> {data.database_total_size}
            </div>

            {/* GRUPO 1: limpeza automática */}
            <div>
              <div className="flex items-center gap-2 mb-2">
                <Trash2 className="w-3.5 h-3.5 text-amber-600" />
                <h4 className="text-sm font-medium">Limpeza automática (1 dia)</h4>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <TableStat
                  name="audit_logs"
                  totalRows={data.total_audit_logs}
                  oldRows={data.audit_logs_older_than_1d}
                  size={data.audit_logs_table_size}
                  retentionLabel="1 dia"
                />
                <TableStat
                  name="webhook_logs (UazAPI)"
                  totalRows={data.total_webhook_logs}
                  oldRows={data.webhook_logs_older_than_1d}
                  size={data.webhook_logs_table_size}
                  retentionLabel="1 dia"
                />
                <TableStat
                  name="v8_webhook_logs"
                  totalRows={data.total_webhooks_v8}
                  oldRows={data.webhooks_v8_older_than_1d}
                  size={data.v8_webhook_table_size}
                  retentionLabel="1 dia"
                />
              </div>
            </div>

            {/* GRUPO 2: só monitora */}
            <div>
              <div className="flex items-center gap-2 mb-2">
                <Eye className="w-3.5 h-3.5 text-blue-600" />
                <h4 className="text-sm font-medium">Só monitorado (sem limpeza automática)</h4>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <TableStat
                  name="chip_lifecycle_logs"
                  totalRows={data.total_chip_lifecycle_logs}
                  size={data.chip_lifecycle_logs_table_size}
                  retentionLabel="histórico"
                />
                <TableStat
                  name="v8_simulations"
                  totalRows={data.total_simulations}
                  size={data.v8_simulations_table_size}
                  retentionLabel="histórico"
                />
              </div>
            </div>

            {(data.webhooks_v8_older_than_1d > 1000
              || data.audit_logs_older_than_1d > 5000
              || data.webhook_logs_older_than_1d > 1000) && (
              <div className="rounded-md border border-amber-500/30 bg-amber-500/10 p-3 text-sm flex items-start gap-2">
                <AlertTriangle className="w-4 h-4 text-amber-600 mt-0.5 shrink-0" />
                <div>
                  Há linhas pendentes de limpeza acima do esperado. Verifique se os crons{' '}
                  <code>cleanup-audit-logs-daily</code> e <code>cleanup-webhook-logs</code> estão ativos,
                  ou clique nos botões "Limpar agora" abaixo.
                </div>
              </div>
            )}

            <div className="rounded-md border bg-muted/30 p-3 text-xs text-muted-foreground space-y-1">
              <div>
                💡 <strong>Importante</strong>: a limpeza apaga linhas, mas o tamanho
                físico do arquivo só cai depois de rodar{' '}
                <code className="font-mono">VACUUM FULL nome_tabela;</code> no SQL Editor.
                O Postgres reaproveita o espaço internamente nas próximas inserções.
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
            onClick={handleCleanWebhooks}
            disabled={cleaningWebhooks || loading}
          >
            {cleaningWebhooks ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Trash2 className="w-4 h-4 mr-2" />}
            Limpar webhooks &gt; 1 dia
          </Button>
          <Button
            variant="destructive"
            size="sm"
            onClick={handleCleanAudit}
            disabled={cleaningAudit || loading}
          >
            {cleaningAudit ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Trash2 className="w-4 h-4 mr-2" />}
            Limpar audit_logs &gt; 1 dia
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

function TableStat({
  name, totalRows, oldRows, size, retentionLabel,
}: {
  name: string;
  totalRows: number;
  oldRows?: number;
  size: string;
  retentionLabel: string;
}) {
  const warn = oldRows != null && oldRows > 1000;
  return (
    <div className={`rounded-md border p-3 ${warn ? 'border-amber-500/40 bg-amber-500/5' : 'bg-card'}`}>
      <div className="flex items-center justify-between gap-2">
        <div className="text-xs font-mono font-medium truncate" title={name}>{name}</div>
        <span className="text-[10px] uppercase tracking-wide text-muted-foreground shrink-0">{retentionLabel}</span>
      </div>
      <div className="mt-1.5 grid grid-cols-2 gap-2 text-sm">
        <div>
          <div className="text-[10px] uppercase text-muted-foreground">Linhas</div>
          <div className="font-semibold">{Number(totalRows).toLocaleString('pt-BR')}</div>
        </div>
        <div>
          <div className="text-[10px] uppercase text-muted-foreground">Tamanho</div>
          <div className="font-semibold">{size}</div>
        </div>
      </div>
      {oldRows != null && (
        <div className={`mt-1.5 text-[11px] ${warn ? 'text-amber-700 dark:text-amber-400 font-medium' : 'text-muted-foreground'}`}>
          {oldRows > 0
            ? <>Pendentes de limpeza: <strong>{Number(oldRows).toLocaleString('pt-BR')}</strong></>
            : <>✓ Sem pendências</>}
        </div>
      )}
    </div>
  );
}
