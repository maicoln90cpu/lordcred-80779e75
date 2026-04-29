import { useEffect, useState } from 'react';
import { Card } from '@/components/ui/card';
import { supabase } from '@/integrations/supabase/client';
import { Calculator, CheckCircle2, FileText, TrendingUp, Loader2 } from 'lucide-react';

/**
 * V8KpisBar — Cards de KPI no topo da página V8.
 *
 * Mostra ao operador, sem clicar em nada:
 *  • Simulações hoje (total, success/failed)
 *  • Propostas criadas hoje (v8_operations_local com first_seen_at >= hoje)
 *  • Ticket médio (media de released_value das simulações success de hoje)
 *  • Aprovação (% sucesso vs total finalizado de hoje)
 *
 * "Hoje" = America/Sao_Paulo (sufixo -03:00).
 * Atualiza a cada 60s + ao montar.
 */

interface Kpis {
  simsTotal: number;
  simsSuccess: number;
  simsFailed: number;
  opsCreated: number;
  avgTicket: number | null;
  approvalRate: number | null;
}

function startOfTodaySaoPauloIso() {
  // Pega o "hoje" em São Paulo, retorna ISO com offset -03:00.
  // Não dependemos de Intl pra evitar drift de DST (Brasil não tem DST hoje).
  const now = new Date();
  const offsetHours = -3;
  const sp = new Date(now.getTime() + (offsetHours * 60 - now.getTimezoneOffset()) * 60000);
  const y = sp.getUTCFullYear();
  const m = String(sp.getUTCMonth() + 1).padStart(2, '0');
  const d = String(sp.getUTCDate()).padStart(2, '0');
  return `${y}-${m}-${d}T00:00:00-03:00`;
}

function fmtBRL(n: number | null) {
  if (n == null) return '—';
  return n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

export default function V8KpisBar() {
  const [kpis, setKpis] = useState<Kpis | null>(null);
  const [loading, setLoading] = useState(true);

  async function load() {
    setLoading(true);
    try {
      const since = startOfTodaySaoPauloIso();

      // ⚠️ BUG ANTIGO: `.select('status, released_value').gte(...)` carregava as
      // linhas e o Supabase corta silenciosamente em 1000 → KPI ficava cravado em
      // "Simulações hoje: 1000". Agora usamos `count: 'exact', head: true` para
      // o total, que NÃO tem cap, e queries separadas para success/failed.
      const [{ count: simsTotal }, { count: simsSuccess }, { count: simsFailed }] = await Promise.all([
        supabase.from('v8_simulations').select('id', { count: 'exact', head: true }).gte('created_at', since),
        supabase.from('v8_simulations').select('id', { count: 'exact', head: true }).gte('created_at', since).eq('status', 'success'),
        supabase.from('v8_simulations').select('id', { count: 'exact', head: true }).gte('created_at', since).eq('status', 'failed'),
      ]);

      // Para o ticket médio precisamos dos valores. Aceitamos imprecisão acima
      // de 2000 sucessos/dia (cenário improvável no negócio atual).
      const { data: releasedRows } = await supabase
        .from('v8_simulations')
        .select('released_value')
        .eq('status', 'success')
        .gte('created_at', since)
        .not('released_value', 'is', null)
        .limit(2000);

      const released = (releasedRows ?? []).map((s: any) => Number(s.released_value)).filter((n) => Number.isFinite(n));
      const avgTicket = released.length > 0
        ? released.reduce((a, b) => a + b, 0) / released.length
        : null;

      const finalized = (simsSuccess ?? 0) + (simsFailed ?? 0);
      const approvalRate = finalized > 0 ? Math.round(((simsSuccess ?? 0) / finalized) * 100) : null;

      // Operações criadas hoje
      const { count: opsCreated } = await supabase
        .from('v8_operations_local')
        .select('id', { count: 'exact', head: true })
        .gte('first_seen_at', since);

      setKpis({
        simsTotal: simsTotal ?? 0,
        simsSuccess: simsSuccess ?? 0,
        simsFailed: simsFailed ?? 0,
        opsCreated: opsCreated ?? 0,
        avgTicket,
        approvalRate,
      });
    } catch (e) {
      console.error('[V8KpisBar] load error', e);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
    const id = setInterval(() => void load(), 60_000);
    return () => clearInterval(id);
  }, []);

  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
      <KpiCard
        icon={<Calculator className="w-4 h-4" />}
        label="Simulações hoje"
        value={loading ? '…' : String(kpis?.simsTotal ?? 0)}
        sub={loading ? null : `${kpis?.simsSuccess ?? 0} ok · ${kpis?.simsFailed ?? 0} falha`}
      />
      <KpiCard
        icon={<FileText className="w-4 h-4" />}
        label="Propostas criadas hoje"
        value={loading ? '…' : String(kpis?.opsCreated ?? 0)}
        sub={null}
      />
      <KpiCard
        icon={<TrendingUp className="w-4 h-4" />}
        label="Ticket médio"
        value={loading ? '…' : fmtBRL(kpis?.avgTicket ?? null)}
        sub="Liberado médio das simulações ok"
      />
      <KpiCard
        icon={<CheckCircle2 className="w-4 h-4" />}
        label="Aprovação hoje"
        value={loading ? '…' : kpis?.approvalRate != null ? `${kpis.approvalRate}%` : '—'}
        sub="Sucesso ÷ (sucesso + falha)"
      />
    </div>
  );
}

function KpiCard({ icon, label, value, sub }: { icon: React.ReactNode; label: string; value: string; sub: string | null }) {
  return (
    <Card className="p-3">
      <div className="flex items-center gap-2 text-xs text-muted-foreground">
        <span className="text-primary">{icon}</span>
        <span>{label}</span>
      </div>
      <div className="text-2xl font-bold mt-1 tabular-nums">{value}</div>
      {sub && <div className="text-[11px] text-muted-foreground mt-0.5">{sub}</div>}
    </Card>
  );
}

export function V8KpisBarLoading() {
  return (
    <div className="flex justify-center py-4">
      <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />
    </div>
  );
}
