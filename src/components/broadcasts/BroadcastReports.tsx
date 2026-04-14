import { useState, useEffect, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { supabase } from '@/integrations/supabase/client';
import { Loader2, BarChart3, TrendingUp, FlaskConical, Send, CheckCircle2, XCircle, Target, Percent } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, LineChart, Line, CartesianGrid, Legend, Cell, PieChart, Pie } from 'recharts';
import { cn } from '@/lib/utils';

interface Campaign {
  id: string;
  name: string;
  status: string;
  total_recipients: number;
  sent_count: number;
  failed_count: number;
  created_at: string;
  completed_at: string | null;
  ab_enabled?: boolean;
}

interface ABStats {
  campaignId: string;
  campaignName: string;
  variantA: { sent: number; failed: number };
  variantB: { sent: number; failed: number };
}

export default function BroadcastReports() {
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [abStats, setAbStats] = useState<ABStats[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadReports();
  }, []);

  const loadReports = async () => {
    const { data } = await supabase
      .from('broadcast_campaigns')
      .select('id, name, status, total_recipients, sent_count, failed_count, created_at, completed_at, ab_enabled')
      .in('status', ['completed', 'running', 'paused'])
      .order('created_at', { ascending: false })
      .limit(50);

    const list = (data || []) as Campaign[];
    setCampaigns(list);

    const abCampaigns = list.filter(c => c.ab_enabled);
    if (abCampaigns.length > 0) {
      const stats: ABStats[] = [];
      for (const camp of abCampaigns.slice(0, 10)) {
        const { data: recipients } = await supabase
          .from('broadcast_recipients')
          .select('variant, status')
          .eq('campaign_id', camp.id)
          .in('status', ['sent', 'failed']);

        if (recipients) {
          const a = { sent: 0, failed: 0 };
          const b = { sent: 0, failed: 0 };
          for (const r of recipients) {
            const target = r.variant === 'B' ? b : a;
            if (r.status === 'sent') target.sent++;
            else target.failed++;
          }
          stats.push({ campaignId: camp.id, campaignName: camp.name, variantA: a, variantB: b });
        }
      }
      setAbStats(stats);
    }

    setLoading(false);
  };

  // ── KPIs ──
  const kpis = useMemo(() => {
    const totalSent = campaigns.reduce((s, c) => s + c.sent_count, 0);
    const totalFailed = campaigns.reduce((s, c) => s + c.failed_count, 0);
    const totalRecipients = campaigns.reduce((s, c) => s + c.total_recipients, 0);
    const completed = campaigns.filter(c => c.status === 'completed').length;
    const globalRate = (totalSent + totalFailed) > 0 ? Math.round((totalSent / (totalSent + totalFailed)) * 100) : 0;

    return { totalSent, totalFailed, totalRecipients, completed, globalRate, total: campaigns.length };
  }, [campaigns]);

  // ── Funnel data ──
  const funnelData = useMemo(() => [
    { name: 'Destinatários', value: kpis.totalRecipients, color: 'hsl(var(--primary))' },
    { name: 'Enviados', value: kpis.totalSent, color: 'hsl(var(--primary) / 0.7)' },
    { name: 'Falhas', value: kpis.totalFailed, color: 'hsl(var(--destructive))' },
  ].filter(d => d.value > 0), [kpis]);

  if (loading) {
    return <div className="flex items-center justify-center h-64"><Loader2 className="w-6 h-6 animate-spin text-primary" /></div>;
  }

  // Chart data: success rate per campaign
  const successData = campaigns.slice(0, 15).reverse().map(c => {
    const total = c.sent_count + c.failed_count;
    return {
      name: c.name.length > 18 ? c.name.slice(0, 18) + '…' : c.name,
      taxa: total > 0 ? Math.round((c.sent_count / total) * 100) : 0,
      enviados: c.sent_count,
      falhas: c.failed_count,
    };
  });

  // Chart data: sends over time
  const timeMap: Record<string, { date: string; enviados: number; falhas: number }> = {};
  for (const c of campaigns) {
    const date = new Date(c.created_at).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });
    if (!timeMap[date]) timeMap[date] = { date, enviados: 0, falhas: 0 };
    timeMap[date].enviados += c.sent_count;
    timeMap[date].falhas += c.failed_count;
  }
  const timeData = Object.values(timeMap).reverse().slice(-14);

  const barColors = ['hsl(var(--primary))', 'hsl(var(--primary) / 0.7)', 'hsl(var(--primary) / 0.5)'];

  return (
    <div className="space-y-4">
      {/* KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        {[
          { label: 'Campanhas', value: kpis.total, icon: BarChart3, color: 'text-primary' },
          { label: 'Concluídas', value: kpis.completed, icon: CheckCircle2, color: 'text-green-400' },
          { label: 'Total Enviados', value: kpis.totalSent.toLocaleString('pt-BR'), icon: Send, color: 'text-blue-400' },
          { label: 'Total Falhas', value: kpis.totalFailed.toLocaleString('pt-BR'), icon: XCircle, color: 'text-destructive' },
          { label: 'Taxa Global', value: `${kpis.globalRate}%`, icon: Percent, color: kpis.globalRate >= 90 ? 'text-green-400' : kpis.globalRate >= 70 ? 'text-yellow-400' : 'text-destructive' },
        ].map(k => (
          <Card key={k.label}>
            <CardContent className="p-3 flex items-center gap-3">
              <k.icon className={cn('w-5 h-5 shrink-0', k.color)} />
              <div>
                <p className={cn('text-lg font-bold', k.color)}>{k.value}</p>
                <p className="text-[11px] text-muted-foreground">{k.label}</p>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid lg:grid-cols-3 gap-4">
        {/* Success rate chart */}
        <Card className="lg:col-span-2">
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2">
              <BarChart3 className="w-4 h-4" /> Taxa de Sucesso por Campanha
            </CardTitle>
          </CardHeader>
          <CardContent>
            {successData.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-8">Nenhuma campanha com dados</p>
            ) : (
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={successData} layout="vertical" margin={{ left: 10, right: 20, top: 5, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis type="number" domain={[0, 100]} tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }} unit="%" />
                  <YAxis type="category" dataKey="name" width={140} tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }} />
                  <Tooltip
                    contentStyle={{ background: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: 8, fontSize: 12 }}
                    formatter={(val: number) => [`${val}%`, 'Taxa de sucesso']}
                  />
                  <Bar dataKey="taxa" radius={[0, 4, 4, 0]} maxBarSize={28}>
                    {successData.map((_, i) => (
                      <Cell key={i} fill={barColors[i % barColors.length]} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>

        {/* Delivery Funnel */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2">
              <Target className="w-4 h-4" /> Funil de Entrega
            </CardTitle>
            <CardDescription className="text-xs">Visão geral de todos os disparos</CardDescription>
          </CardHeader>
          <CardContent>
            {funnelData.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-8">Sem dados</p>
            ) : (
              <>
                <ResponsiveContainer width="100%" height={180}>
                  <PieChart>
                    <Pie data={funnelData} cx="50%" cy="50%" innerRadius={45} outerRadius={70} paddingAngle={4} dataKey="value">
                      {funnelData.map((entry, i) => (
                        <Cell key={i} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip
                      contentStyle={{ background: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: 8, fontSize: 12 }}
                    />
                  </PieChart>
                </ResponsiveContainer>
                <div className="space-y-1.5 mt-2">
                  {funnelData.map(f => (
                    <div key={f.name} className="flex items-center justify-between text-xs">
                      <div className="flex items-center gap-2">
                        <span className="w-2.5 h-2.5 rounded-full" style={{ background: f.color }} />
                        <span className="text-muted-foreground">{f.name}</span>
                      </div>
                      <span className="font-medium">{f.value.toLocaleString('pt-BR')}</span>
                    </div>
                  ))}
                </div>
              </>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Sends over time */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base flex items-center gap-2">
            <TrendingUp className="w-4 h-4" /> Envios ao Longo do Tempo
          </CardTitle>
        </CardHeader>
        <CardContent>
          {timeData.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-8">Sem dados</p>
          ) : (
            <ResponsiveContainer width="100%" height={250}>
              <LineChart data={timeData} margin={{ left: 0, right: 20, top: 5, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis dataKey="date" tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }} />
                <YAxis tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }} />
                <Tooltip contentStyle={{ background: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: 8, fontSize: 12 }} />
                <Legend wrapperStyle={{ fontSize: 12 }} />
                <Line type="monotone" dataKey="enviados" stroke="hsl(var(--primary))" strokeWidth={2} dot={{ r: 3 }} name="Enviados" />
                <Line type="monotone" dataKey="falhas" stroke="hsl(var(--destructive))" strokeWidth={2} dot={{ r: 3 }} name="Falhas" />
              </LineChart>
            </ResponsiveContainer>
          )}
        </CardContent>
      </Card>

      {/* A/B Testing results */}
      {abStats.length > 0 && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2">
              <FlaskConical className="w-4 h-4" /> Resultados Teste A/B
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {abStats.map(ab => {
                const totalA = ab.variantA.sent + ab.variantA.failed;
                const totalB = ab.variantB.sent + ab.variantB.failed;
                const rateA = totalA > 0 ? Math.round((ab.variantA.sent / totalA) * 100) : 0;
                const rateB = totalB > 0 ? Math.round((ab.variantB.sent / totalB) * 100) : 0;
                const winner = rateA > rateB ? 'A' : rateB > rateA ? 'B' : 'Empate';

                return (
                  <div key={ab.campaignId} className="border rounded-lg p-3 space-y-2">
                    <div className="flex items-center justify-between">
                      <p className="font-medium text-sm">{ab.campaignName}</p>
                      <Badge variant={winner === 'Empate' ? 'outline' : 'default'} className="text-xs">
                        {winner === 'Empate' ? '🤝 Empate' : `🏆 Variante ${winner} venceu`}
                      </Badge>
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div className="bg-muted/50 rounded p-2">
                        <p className="text-xs text-muted-foreground mb-1">Variante A</p>
                        <div className="flex items-center gap-2">
                          <span className="text-lg font-bold">{rateA}%</span>
                          <span className="text-xs text-muted-foreground">{ab.variantA.sent} enviados / {totalA} total</span>
                        </div>
                        <div className="w-full bg-muted rounded-full h-1.5 mt-1">
                          <div className="bg-primary rounded-full h-1.5" style={{ width: `${rateA}%` }} />
                        </div>
                      </div>
                      <div className="bg-muted/50 rounded p-2">
                        <p className="text-xs text-muted-foreground mb-1">Variante B</p>
                        <div className="flex items-center gap-2">
                          <span className="text-lg font-bold">{rateB}%</span>
                          <span className="text-xs text-muted-foreground">{ab.variantB.sent} enviados / {totalB} total</span>
                        </div>
                        <div className="w-full bg-muted rounded-full h-1.5 mt-1">
                          <div className="bg-primary/60 rounded-full h-1.5" style={{ width: `${rateB}%` }} />
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
