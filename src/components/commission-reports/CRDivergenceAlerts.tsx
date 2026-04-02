import { useMemo } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { AlertTriangle, CheckCircle2, Loader2 } from 'lucide-react';

const fmtBRL = (v: number) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
const fmtPct = (v: number) => `${(v * 100).toFixed(1)}%`;

interface AuditRow {
  num_contrato: string; banco: string; produto: string; valor_liberado: number;
  comissao_recebida: number; comissao_esperada: number; diferenca: number;
}

const THRESHOLD = 0.05; // 5%

export default function CRDivergenceAlerts() {
  const { data: auditData = [], isLoading } = useQuery({
    queryKey: ['cr-audit-rpc-full'],
    queryFn: async () => {
      const { data, error } = await supabase.rpc('calculate_commission_audit', { _date_from: null, _date_to: null });
      if (error) throw error;
      return (data || []) as AuditRow[];
    }
  });

  const alerts = useMemo(() => {
    const byBanco = new Map<string, { esperada: number; recebida: number; count: number }>();
    for (const r of auditData) {
      const banco = (r.banco || '').toUpperCase();
      const entry = byBanco.get(banco) || { esperada: 0, recebida: 0, count: 0 };
      entry.esperada += r.comissao_esperada;
      entry.recebida += r.comissao_recebida;
      entry.count++;
      byBanco.set(banco, entry);
    }

    return Array.from(byBanco.entries())
      .map(([banco, d]) => {
        const diff = d.recebida - d.esperada;
        const pctDiff = d.esperada > 0 ? Math.abs(diff) / d.esperada : 0;
        return { banco, ...d, diff: Math.round(diff * 100) / 100, pctDiff, alert: pctDiff > THRESHOLD };
      })
      .sort((a, b) => b.pctDiff - a.pctDiff);
  }, [auditData]);

  if (isLoading) return <div className="flex justify-center py-8"><Loader2 className="w-5 h-5 animate-spin text-muted-foreground" /></div>;

  const alertBanks = alerts.filter(a => a.alert);
  const okBanks = alerts.filter(a => !a.alert);

  if (alerts.length === 0) return null;

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-lg flex items-center gap-2">
          <AlertTriangle className="w-5 h-5 text-yellow-500" />
          Alertas de Divergência por Banco
        </CardTitle>
        <CardDescription>Bancos com divergência acumulada &gt; 5% entre esperada e recebida</CardDescription>
      </CardHeader>
      <CardContent>
        {alertBanks.length === 0 ? (
          <div className="flex items-center gap-2 text-sm text-muted-foreground py-4">
            <CheckCircle2 className="w-4 h-4 text-green-500" />
            Nenhum banco com divergência &gt; 5%. Todos dentro da tolerância.
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 mb-4">
            {alertBanks.map(a => (
              <div key={a.banco} className="border rounded-lg p-3 bg-destructive/5 border-destructive/20">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-sm font-semibold">{a.banco}</span>
                  <Badge variant="destructive" className="text-[10px]">
                    {fmtPct(a.pctDiff)} desvio
                  </Badge>
                </div>
                <div className="grid grid-cols-2 gap-1 text-xs text-muted-foreground">
                  <span>Esperada: {fmtBRL(a.esperada)}</span>
                  <span>Recebida: {fmtBRL(a.recebida)}</span>
                </div>
                <div className={`text-xs font-semibold mt-1 ${a.diff < 0 ? 'text-destructive' : 'text-green-600'}`}>
                  Δ {fmtBRL(a.diff)} ({a.count} contratos)
                </div>
              </div>
            ))}
          </div>
        )}
        {okBanks.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {okBanks.map(a => (
              <Badge key={a.banco} variant="secondary" className="text-[10px] gap-1">
                <CheckCircle2 className="w-3 h-3 text-green-500" />
                {a.banco} ({fmtPct(a.pctDiff)})
              </Badge>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
