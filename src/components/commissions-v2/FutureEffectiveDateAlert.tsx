/**
 * FutureEffectiveDateAlert — alerta admin para taxas V2 com vigência futura
 * que invalidam vendas anteriores (causa comum de rate_match_level = 'none').
 *
 * Lógica:
 *  1) Busca taxas FGTS_v2 e CLT_v2 com effective_date > hoje OU > min(sale_date das vendas 'none' do mesmo bank+seguro).
 *  2) Mostra resumo + CTA p/ ajustar a vigência.
 */
import { useEffect, useState } from 'react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { CalendarClock, X } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';

interface OffenderRate {
  table: 'FGTS' | 'CLT';
  bank: string;
  table_key: string | null;
  effective_date: string;
  rate: number;
  has_insurance: boolean;
  noneSalesAffected: number;
  earliestNoneSale?: string;
}

interface Props {
  onGoToFGTS?: () => void;
  onGoToCLT?: () => void;
}

export default function FutureEffectiveDateAlert({ onGoToFGTS, onGoToCLT }: Props) {
  const [offenders, setOffenders] = useState<OffenderRate[]>([]);
  const [dismissed, setDismissed] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const today = new Date().toISOString().slice(0, 10);

        // 1. Vendas none agrupadas por banco/seguro/produto
        const { data: noneSales } = await supabase
          .from('commission_sales_v2')
          .select('product, bank, has_insurance, sale_date, rate_match_level')
          .or('rate_match_level.eq.none,rate_match_level.is.null')
          .order('sale_date', { ascending: true })
          .limit(2000);

        const noneIndex = new Map<string, { count: number; earliest: string }>();
        for (const s of (noneSales || []) as any[]) {
          const prod = (s.product || '').toUpperCase().includes('FGTS') ? 'FGTS' : 'CLT';
          const key = `${prod}|${(s.bank || '').toUpperCase().trim()}|${s.has_insurance ? 1 : 0}`;
          const cur = noneIndex.get(key);
          const date = (s.sale_date || '').slice(0, 10);
          if (!cur) noneIndex.set(key, { count: 1, earliest: date });
          else {
            cur.count++;
            if (date < cur.earliest) cur.earliest = date;
          }
        }

        // 2. Taxas com effective_date > hoje OU > earliest none-sale do grupo
        const [fgtsRes, cltRes] = await Promise.all([
          supabase.from('commission_rates_fgts_v2').select('bank, table_key, effective_date, rate, has_insurance'),
          supabase.from('commission_rates_clt_v2').select('bank, table_key, effective_date, rate, has_insurance'),
        ]);

        const list: OffenderRate[] = [];
        const evaluate = (rows: any[], table: 'FGTS' | 'CLT') => {
          for (const r of rows || []) {
            const eff = (r.effective_date || '').slice(0, 10);
            if (!eff) continue;
            const key = `${table}|${(r.bank || '').toUpperCase().trim()}|${r.has_insurance ? 1 : 0}`;
            const none = noneIndex.get(key);
            const isFutureToday = eff > today;
            const blocksPastSales = none && eff > none.earliest;
            if (isFutureToday || blocksPastSales) {
              list.push({
                table,
                bank: r.bank,
                table_key: r.table_key,
                effective_date: eff,
                rate: Number(r.rate || 0),
                has_insurance: !!r.has_insurance,
                noneSalesAffected: none?.count || 0,
                earliestNoneSale: none?.earliest,
              });
            }
          }
        };
        evaluate(fgtsRes.data || [], 'FGTS');
        evaluate(cltRes.data || [], 'CLT');

        // Ordena por mais ofensivo (mais vendas afetadas primeiro)
        list.sort((a, b) => b.noneSalesAffected - a.noneSalesAffected);
        setOffenders(list.slice(0, 20));
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  if (loading || dismissed || offenders.length === 0) return null;

  const totalAffected = offenders.reduce((s, o) => s + o.noneSalesAffected, 0);

  return (
    <Alert className="border-amber-500/50 bg-amber-50 dark:bg-amber-950/20">
      <CalendarClock className="h-4 w-4 text-amber-600" />
      <div className="flex items-start justify-between gap-3 w-full">
        <div className="flex-1">
          <AlertTitle className="text-amber-700 dark:text-amber-400">
            Atenção: {offenders.length} taxa(s) V2 com vigência futura
          </AlertTitle>
          <AlertDescription className="text-xs space-y-2 mt-1">
            <p>
              Estas taxas têm <strong>data de vigência posterior</strong> a vendas que ficaram sem cálculo
              {totalAffected > 0 && <> — afetando ~{totalAffected} venda(s) marcadas como <code>none</code></>}.
              Ajuste a vigência para uma data anterior ou recalcule após corrigir.
            </p>
            <ul className="list-disc pl-5 space-y-0.5 max-h-40 overflow-y-auto">
              {offenders.slice(0, 10).map((o, i) => (
                <li key={i}>
                  <strong>{o.table}</strong> · {o.bank}
                  {o.table_key && <> ({o.table_key})</>} · seguro={o.has_insurance ? 'sim' : 'não'} ·
                  vigência <code>{o.effective_date}</code> · taxa {o.rate}%
                  {o.noneSalesAffected > 0 && (
                    <> → bloqueia {o.noneSalesAffected} venda(s) desde {o.earliestNoneSale}</>
                  )}
                </li>
              ))}
              {offenders.length > 10 && <li className="italic">…e mais {offenders.length - 10}</li>}
            </ul>
            <div className="flex gap-2 pt-1">
              {onGoToFGTS && <Button size="sm" variant="outline" onClick={onGoToFGTS}>Abrir Taxas FGTS</Button>}
              {onGoToCLT && <Button size="sm" variant="outline" onClick={onGoToCLT}>Abrir Taxas CLT</Button>}
            </div>
          </AlertDescription>
        </div>
        <Button
          size="icon"
          variant="ghost"
          className="h-6 w-6 -mt-1"
          onClick={() => setDismissed(true)}
          title="Dispensar nesta sessão"
        >
          <X className="h-3.5 w-3.5" />
        </Button>
      </div>
    </Alert>
  );
}
