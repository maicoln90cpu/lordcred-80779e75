import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Loader2, Download, AlertTriangle, CheckCircle2 } from 'lucide-react';
import { toast } from '@/hooks/use-toast';
import { fmtBRL } from './commissionUtils';
import * as XLSX from 'xlsx';

interface Row {
  id: string;
  sale_date: string;
  bank: string;
  product: string;
  released_value: number;
  v1_rate: number;
  v1_value: number;
  v2_rate: number;
  v2_value: number;
  v2_match_level: string | null;
  delta: number;
}

/**
 * Compara venda a venda V1 × V2 (mesmo `id` em ambas tabelas).
 * Mostra divergências para validar a paridade antes de migrar V2 → produção.
 */
export default function V1V2CompareReport() {
  const [loading, setLoading] = useState(false);
  const [rows, setRows] = useState<Row[]>([]);
  const [onlyDiff, setOnlyDiff] = useState(true);
  const [limit, setLimit] = useState(500);

  const load = async () => {
    setLoading(true);
    try {
      const { data: v1, error: e1 } = await supabase
        .from('commission_sales')
        .select('id, sale_date, bank, product, released_value, commission_rate, commission_value')
        .order('sale_date', { ascending: false })
        .limit(limit);
      if (e1) throw e1;

      const ids = (v1 || []).map(r => r.id);
      if (!ids.length) { setRows([]); return; }

      const { data: v2, error: e2 } = await supabase
        .from('commission_sales_v2')
        .select('id, commission_rate, commission_value, rate_match_level')
        .in('id', ids);
      if (e2) throw e2;

      const v2map = new Map((v2 || []).map(r => [r.id, r]));

      const merged: Row[] = (v1 || []).map(r => {
        const v2r = v2map.get(r.id);
        const v1v = Number(r.commission_value || 0);
        const v2v = Number(v2r?.commission_value || 0);
        return {
          id: r.id,
          sale_date: r.sale_date,
          bank: r.bank,
          product: r.product,
          released_value: Number(r.released_value || 0),
          v1_rate: Number(r.commission_rate || 0),
          v1_value: v1v,
          v2_rate: Number(v2r?.commission_rate || 0),
          v2_value: v2v,
          v2_match_level: (v2r as any)?.rate_match_level || null,
          delta: +(v2v - v1v).toFixed(2),
        };
      });

      setRows(merged);
    } catch (err: any) {
      toast({ title: 'Erro ao comparar', description: err.message, variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  const filtered = onlyDiff ? rows.filter(r => Math.abs(r.delta) > 0.01) : rows;
  const totalV1 = rows.reduce((s, r) => s + r.v1_value, 0);
  const totalV2 = rows.reduce((s, r) => s + r.v2_value, 0);
  const totalDelta = totalV2 - totalV1;

  const exportXlsx = () => {
    const ws = XLSX.utils.json_to_sheet(filtered.map(r => ({
      Data: r.sale_date.slice(0, 10),
      Banco: r.bank,
      Produto: r.product,
      Valor: r.released_value,
      'Taxa V1 (%)': r.v1_rate,
      'Comissão V1': r.v1_value,
      'Taxa V2 (%)': r.v2_rate,
      'Comissão V2': r.v2_value,
      'Match V2': r.v2_match_level || '-',
      'Δ (V2-V1)': r.delta,
    })));
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'V1xV2');
    XLSX.writeFile(wb, `comissoes-v1-vs-v2-${new Date().toISOString().slice(0, 10)}.xlsx`);
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <AlertTriangle className="w-5 h-5 text-amber-500" />
          Comparação V1 × V2 (paridade)
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex flex-wrap gap-2 items-end">
          <div>
            <label className="text-xs text-muted-foreground">Últimas N vendas</label>
            <Input type="number" value={limit} onChange={e => setLimit(Number(e.target.value) || 500)} className="w-32" />
          </div>
          <Button onClick={load} disabled={loading}>
            {loading ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
            Carregar comparação
          </Button>
          <Button variant="outline" onClick={() => setOnlyDiff(s => !s)}>
            {onlyDiff ? 'Mostrar todas' : 'Só divergentes'}
          </Button>
          {filtered.length > 0 && (
            <Button variant="outline" onClick={exportXlsx}>
              <Download className="w-4 h-4 mr-2" /> Exportar XLSX
            </Button>
          )}
        </div>

        {rows.length > 0 && (
          <div className="grid grid-cols-3 gap-3">
            <div className="rounded border p-3">
              <div className="text-xs text-muted-foreground">Total V1</div>
              <div className="font-bold">{fmtBRL(totalV1)}</div>
            </div>
            <div className="rounded border p-3">
              <div className="text-xs text-muted-foreground">Total V2</div>
              <div className="font-bold">{fmtBRL(totalV2)}</div>
            </div>
            <div className={`rounded border p-3 ${Math.abs(totalDelta) > 0.01 ? 'border-amber-500' : 'border-green-500'}`}>
              <div className="text-xs text-muted-foreground flex items-center gap-1">
                {Math.abs(totalDelta) <= 0.01 && <CheckCircle2 className="w-3 h-3 text-green-500" />}
                Δ Total
              </div>
              <div className="font-bold">{fmtBRL(totalDelta)}</div>
            </div>
          </div>
        )}

        {filtered.length === 0 && rows.length > 0 && (
          <p className="text-sm text-green-600 flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4" /> Nenhuma divergência nas últimas {rows.length} vendas.
          </p>
        )}

        {filtered.length > 0 && (
          <div className="overflow-auto max-h-[500px] border rounded">
            <table className="w-full text-xs">
              <thead className="bg-muted sticky top-0">
                <tr>
                  <th className="text-left p-2">Data</th>
                  <th className="text-left p-2">Banco</th>
                  <th className="text-right p-2">Valor</th>
                  <th className="text-right p-2">V1 %</th>
                  <th className="text-right p-2">V1 R$</th>
                  <th className="text-right p-2">V2 %</th>
                  <th className="text-right p-2">V2 R$</th>
                  <th className="text-center p-2">Match</th>
                  <th className="text-right p-2">Δ</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map(r => (
                  <tr key={r.id} className="border-t">
                    <td className="p-2">{r.sale_date.slice(0, 10)}</td>
                    <td className="p-2">{r.bank}</td>
                    <td className="p-2 text-right">{fmtBRL(r.released_value)}</td>
                    <td className="p-2 text-right">{r.v1_rate.toFixed(2)}</td>
                    <td className="p-2 text-right">{fmtBRL(r.v1_value)}</td>
                    <td className="p-2 text-right">{r.v2_rate.toFixed(2)}</td>
                    <td className="p-2 text-right">{fmtBRL(r.v2_value)}</td>
                    <td className="p-2 text-center">
                      {r.v2_match_level === 'fallback' && <Badge variant="outline" className="text-amber-600 border-amber-500">FB</Badge>}
                      {r.v2_match_level === 'generic' && <Badge variant="outline" className="text-blue-600 border-blue-500">GEN</Badge>}
                      {r.v2_match_level === 'specific' && <Badge variant="outline" className="text-green-600 border-green-500">OK</Badge>}
                      {(!r.v2_match_level || r.v2_match_level === 'none') && <Badge variant="destructive">×</Badge>}
                    </td>
                    <td className={`p-2 text-right font-semibold ${Math.abs(r.delta) > 0.01 ? 'text-amber-600' : ''}`}>
                      {fmtBRL(r.delta)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
