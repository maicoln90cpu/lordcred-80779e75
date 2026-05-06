/**
 * V8HealthOrphansCard — Etapa 4 (mai/2026)
 *
 * Monitora dois sintomas críticos do fluxo V8:
 *   1. Órfãs criadas nas últimas 24h (linhas em v8_simulations sem batch_id,
 *      criadas pelo webhook que não casou com nenhuma simulação do lote).
 *   2. Linhas pendentes SEM consult_id há mais de 5 minutos
 *      (indica falha de gravação no momento do /consult).
 *
 * Alertas:
 *   - >5 órfãs em 24h  -> aviso amarelo
 *   - >0 pending sem consult_id +5min -> aviso vermelho
 */
import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Activity, RefreshCw, AlertTriangle, Loader2, CheckCircle2, Wand2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface OrphanHealth {
  orphans_24h: number;
  pending_without_consult_id: number;
  stuck_batches: number;
  paused_stale_batches: number;
}

export default function V8HealthOrphansCard() {
  const [data, setData] = useState<OrphanHealth | null>(null);
  const [loading, setLoading] = useState(false);
  const [recalculating, setRecalculating] = useState(false);
  const [resumingPaused, setResumingPaused] = useState(false);
  const [fullRecon, setFullRecon] = useState(false);

  async function load() {
    setLoading(true);
    try {
      const cutoff24h = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
      const cutoff5m = new Date(Date.now() - 5 * 60 * 1000).toISOString();
      const cutoffPause1h = new Date(Date.now() - 60 * 60 * 1000).toISOString();

      const [orphRes, pendRes, stuckRes, pausedRes] = await Promise.all([
        supabase
          .from('v8_simulations')
          .select('id', { count: 'exact', head: true })
          .is('batch_id', null)
          .gte('created_at', cutoff24h),
        supabase
          .from('v8_simulations')
          .select('id', { count: 'exact', head: true })
          .eq('status', 'pending')
          .is('consult_id', null)
          .lt('created_at', cutoff5m),
        supabase
          .from('v8_batches')
          .select('id', { count: 'exact', head: true })
          .eq('status', 'stuck'),
        supabase
          .from('v8_batches')
          .select('id', { count: 'exact', head: true })
          .eq('is_paused', true)
          .in('status', ['processing', 'scheduled', 'queued'])
          .lt('paused_at', cutoffPause1h),
      ]);

      setData({
        orphans_24h: orphRes.count ?? 0,
        pending_without_consult_id: pendRes.count ?? 0,
        stuck_batches: stuckRes.count ?? 0,
        paused_stale_batches: pausedRes.count ?? 0,
      });
    } catch (err: any) {
      toast.error(`Erro ao carregar saúde V8: ${err?.message || err}`);
    } finally {
      setLoading(false);
    }
  }

  async function handleRecalculate() {
    setRecalculating(true);
    try {
      const { data, error } = await supabase.rpc('recalculate_all_stuck_v8_batches' as any);
      if (error) throw error;
      const recalculated = (data as any)?.recalculated ?? 0;
      toast.success(`Recálculo executado: ${recalculated} lote(s) corrigido(s).`);
      await load();
    } catch (err: any) {
      toast.error(`Erro ao recalcular: ${err?.message || err}`);
    } finally {
      setRecalculating(false);
    }
  }

  async function handleFullReconciliation() {
    if (!confirm('Rodar reconciliação completa V8?\n\n• Watchdog (pendentes >15min sem webhook → failed)\n• Recálculo de lotes travados\n• Marca dispatch perdido como falha (re-tentável)\n• Re-enfileira Auto-best órfãos')) return;
    setFullRecon(true);
    try {
      const { data, error } = await supabase.rpc('v8_force_full_reconciliation' as any);
      if (error) throw error;
      const d: any = data || {};
      toast.success(
        `Reconciliação OK — watchdog: ${d?.watchdog?.marked_failed ?? 0} | lotes: ${d?.recalc_batches?.recalculated ?? 0} | dispatch perdido: ${d?.lost_dispatch_marked_failed ?? 0} | auto-best re-fila: ${d?.auto_best_requeued ?? 0}`
      );
      await load();
    } catch (err: any) {
      toast.error(`Erro na reconciliação: ${err?.message || err}`);
    } finally {
      setFullRecon(false);
    }
  }

  useEffect(() => { void load(); }, []);

  const orphansWarn = (data?.orphans_24h ?? 0) > 5;
  const pendingErr = (data?.pending_without_consult_id ?? 0) > 0;
  const stuckErr = (data?.stuck_batches ?? 0) > 0;
  const pausedWarn = (data?.paused_stale_batches ?? 0) > 0;
  const allHealthy = data && !orphansWarn && !pendingErr && !stuckErr && !pausedWarn;

  async function handleResumeStalePaused() {
    if (!confirm(`Retomar ${data?.paused_stale_batches ?? 0} lote(s) pausado(s) há +1h?`)) return;
    setResumingPaused(true);
    try {
      const cutoff = new Date(Date.now() - 60 * 60 * 1000).toISOString();
      const { data: list } = await supabase.from('v8_batches')
        .select('id').eq('is_paused', true)
        .in('status', ['processing', 'scheduled', 'queued'])
        .lt('paused_at', cutoff);
      const ids = (list ?? []).map((b: any) => b.id);
      if (ids.length === 0) { toast.info('Nenhum lote elegível.'); return; }
      const { error } = await supabase.from('v8_batches')
        .update({ is_paused: false, paused_at: null, paused_by: null })
        .in('id', ids);
      if (error) throw error;
      toast.success(`▶ ${ids.length} lote(s) retomado(s)`);
      await load();
    } catch (err: any) {
      toast.error(`Erro ao retomar: ${err?.message || err}`);
    } finally { setResumingPaused(false); }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Activity className="w-5 h-5" />
          Saúde do fluxo V8 (órfãs e pendentes)
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {loading && !data ? (
          <div className="py-8 flex justify-center">
            <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
          </div>
        ) : data ? (
          <>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <Stat label="Órfãs (últimas 24h)" value={data.orphans_24h} hint="webhook V8 sem casamento com lote" warn={orphansWarn} threshold="> 5" />
              <Stat label="Pendentes sem consult_id" value={data.pending_without_consult_id} hint="criadas há +5 min, falha ao gravar" error={pendingErr} threshold="> 0" />
              <Stat label="Lotes travados (stuck)" value={data.stuck_batches} hint="sem atividade há +60 min" error={stuckErr} threshold="> 0" />
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <Stat label="Lotes pausados +1h" value={data.paused_stale_batches} hint="processing/scheduled/queued pausados há +60 min" warn={pausedWarn} threshold="> 0" />
            </div>
            {allHealthy && (
              <div className="rounded-md border border-green-500/30 bg-green-500/10 p-3 text-sm flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-green-600" />
                Tudo nominal. Nenhum sintoma de órfã, lote travado ou pausa esquecida.
              </div>
            )}
            {orphansWarn && (
              <div className="rounded-md border border-amber-500/30 bg-amber-500/10 p-3 text-sm flex items-start gap-2">
                <AlertTriangle className="w-4 h-4 text-amber-600 mt-0.5 shrink-0" />
                <div><strong>{data.orphans_24h} órfãs</strong> em 24h. Reconciler roda a cada 2 min.</div>
              </div>
            )}
            {pendingErr && (
              <div className="rounded-md border border-red-500/30 bg-red-500/10 p-3 text-sm flex items-start gap-2">
                <AlertTriangle className="w-4 h-4 text-red-600 mt-0.5 shrink-0" />
                <div><strong>{data.pending_without_consult_id} pendentes</strong> sem <code>consult_id</code> há +5 min.</div>
              </div>
            )}
            {stuckErr && (
              <div className="rounded-md border border-amber-500/30 bg-amber-500/10 p-3 text-sm flex items-start gap-2">
                <AlertTriangle className="w-4 h-4 text-amber-600 mt-0.5 shrink-0" />
                <div><strong>{data.stuck_batches} lote(s)</strong> travado(s). Use "Recalcular lotes agora".</div>
              </div>
            )}
            {pausedWarn && (
              <div className="rounded-md border border-amber-500/30 bg-amber-500/10 p-3 text-sm flex items-start gap-2">
                <AlertTriangle className="w-4 h-4 text-amber-600 mt-0.5 shrink-0" />
                <div className="flex-1">
                  <strong>{data.paused_stale_batches} lote(s) pausados há +1h</strong> com simulações ainda em aberto. Auto-retry e poller pulam pausados — se foi esquecido, retome.
                </div>
                <Button size="sm" variant="default" disabled={resumingPaused} onClick={handleResumeStalePaused}>
                  {resumingPaused ? <Loader2 className="w-4 h-4 animate-spin" /> : '▶'} Retomar todos
                </Button>
              </div>
            )}
          </>
        ) : (
          <div className="text-sm text-muted-foreground">Sem dados.</div>
        )}

        <div className="flex flex-wrap gap-2 pt-1">
          <Button variant="outline" size="sm" onClick={() => void load()} disabled={loading}>
            <RefreshCw className={`w-4 h-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
            Atualizar
          </Button>
          <Button variant="default" size="sm" onClick={handleRecalculate} disabled={recalculating || loading || fullRecon}>
            {recalculating ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Activity className="w-4 h-4 mr-2" />}
            Recalcular lotes agora
          </Button>
          <Button variant="secondary" size="sm" onClick={handleFullReconciliation} disabled={fullRecon || loading || recalculating}>
            {fullRecon ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Wand2 className="w-4 h-4 mr-2" />}
            Reconciliação completa
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

function Stat({
  label, value, hint, warn, error, threshold,
}: { label: string; value: number; hint: string; warn?: boolean; error?: boolean; threshold: string }) {
  const tone = error ? 'border-red-500/40 bg-red-500/5' : warn ? 'border-amber-500/40 bg-amber-500/5' : 'bg-card';
  const valTone = error ? 'text-red-600' : warn ? 'text-amber-700 dark:text-amber-400' : '';
  return (
    <div className={`rounded-md border p-3 ${tone}`}>
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className={`text-2xl font-semibold ${valTone}`}>{Number(value).toLocaleString('pt-BR')}</div>
      <div className="text-[11px] text-muted-foreground mt-1">{hint}</div>
      <div className="text-[10px] text-muted-foreground mt-0.5">alerta: {threshold}</div>
    </div>
  );
}
