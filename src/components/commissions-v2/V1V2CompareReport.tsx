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

type PairStatus = 'paired' | 'no_v2' | 'duplicate';

interface Row {
  key: string;
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
  status: PairStatus;
}

/**
 * Compara V1 × V2 por CHAVE OPERACIONAL (data + vendedor + produto + banco + valor + cpf).
 * IDs não coincidem entre V1 e V2 — o pareamento por id mostrava divergência falsa.
 */
function buildKey(r: any): string {
  const date = (r.sale_date || '').slice(0, 10);
  const seller = r.seller_id || '';
  const product = (r.product || '').toUpperCase().trim();
  const bank = (r.bank || '').toUpperCase().trim().replace(/\s+/g, ' ');
  const value = Math.round(Number(r.released_value || 0) * 100) / 100;
  const cpf = (r.client_cpf || '').replace(/\D/g, '') || (r.external_proposal_id || '');
  return `${date}|${seller}|${product}|${bank}|${value.toFixed(2)}|${cpf}`;
}

export default function V1V2CompareReport() {
  const [loading, setLoading] = useState(false);
  const [rows, setRows] = useState<Row[]>([]);
  const [onlyDiff, setOnlyDiff] = useState(true);
  const [limit, setLimit] = useState(500);

  const load = async () => {
    setLoading(true);
    try {
      const cols = 'id, sale_date, bank, product, seller_id, released_value, commission_rate, commission_value, client_cpf, external_proposal_id, table_name';
      const { data: v1, error: e1 } = await supabase
        .from('commission_sales')
        .select(cols)
        .order('sale_date', { ascending: false })
        .limit(limit);
      if (e1) throw e1;

      const { data: v2, error: e2 } = await supabase
        .from('commission_sales_v2')
        .select(cols + ', rate_match_level')
        .order('sale_date', { ascending: false })
        .limit(limit);
      if (e2) throw e2;

      // Agrupar V2 por chave (detectar duplicatas)
      const v2map = new Map<string, any[]>();
      for (const r of v2 || []) {
        const k = buildKey(r);
        const arr = v2map.get(k) || [];
        arr.push(r);
        v2map.set(k, arr);
      }

      const merged: Row[] = (v1 || []).map(r => {
        const k = buildKey(r);
        const candidates = v2map.get(k) || [];
        const v2r = candidates[0];
        const v1v = Number(r.commission_value || 0);
        const v2v = Number(v2r?.commission_value || 0);
        let status: PairStatus = 'no_v2';
        if (candidates.length === 1) status = 'paired';
        else if (candidates.length > 1) status = 'duplicate';
        return {
          key: k,
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
          status,
        };
      });

      setRows(merged);
    } catch (err: any) {
      toast({ title: 'Erro ao comparar', description: err.message, variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  const filtered = onlyDiff ? rows.filter(r => Math.abs(r.delta) > 0.01 || r.status !== 'paired') : rows;
  const totalV1 = rows.reduce((s, r) => s + r.v1_value, 0);
  const totalV2 = rows.reduce((s, r) => s + r.v2_value, 0);
  const totalDelta = totalV2 - totalV1;
  const counts = {
    paired: rows.filter(r => r.status === 'paired').length,
    no_v2: rows.filter(r => r.status === 'no_v2').length,
    dup: rows.filter(r => r.status === 'duplicate').length,
  };

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
      Status: r.status,
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
          Comparação V1 × V2 (paridade por chave operacional)
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="text-xs text-muted-foreground">
          Pareamento por: <code>data + vendedor + produto + banco + valor + cpf/proposta</code>.
          IDs não coincidem entre V1 e V2 — comparar por ID gerava divergência falsa.
        </p>
        <div className="flex flex-wrap gap-2 items-end">
          <div>
            <label className="text-xs text-muted-foreground">Últimas N vendas (cada lado)</label>
            <Input type="number" value={limit} onChange={e => setLimit(Number(e.target.value) || 500)} className="w-32" />
          </div>
          <Button onClick={load} disabled={loading}>
            {loading ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
            Carregar comparação
          </Button>
          <Button variant="outline" onClick={() => setOnlyDiff(s => !s)}>
            {onlyDiff ? 'Mostrar todas' : 'Só divergentes / sem par'}
          </Button>
          {filtered.length > 0 && (
            <Button variant="outline" onClick={exportXlsx}>
              <Download className="w-4 h-4 mr-2" /> Exportar XLSX
            </Button>
          )}
        </div>

        {rows.length > 0 && (
          <>
            <div className="grid grid-cols-3 gap-3">
              <div className="rounded border p-3">
                <div className="text-xs text-muted-foreground">Total V1</div>
                <div className="font-bold">{fmtBRL(totalV1)}</div>
              </div>
              <div className="rounded border p-3">
                <div className="text-xs text-muted-foreground">Total V2 (pareado)</div>
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
            <div className="flex gap-2 text-xs">
              <Badge variant="outline" className="text-green-600 border-green-500">✅ Pareado: {counts.paired}</Badge>
              <Badge variant="outline" className="text-red-600 border-red-500">❌ Sem par V2: {counts.no_v2}</Badge>
              <Badge variant="outline" className="text-amber-600 border-amber-500">⚠️ Duplicidade: {counts.dup}</Badge>
            </div>
          </>
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
                  <th className="text-center p-2">Status</th>
                  <th className="text-right p-2">Δ</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map(r => (
                  <tr key={r.key} className="border-t">
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
                      {r.v2_match_level === 'generic_no_value' && <Badge variant="outline" className="text-purple-600 border-purple-500" title="Genérica sem faixa de valor">GNV</Badge>}
                      {r.v2_match_level === 'specific' && <Badge variant="outline" className="text-green-600 border-green-500">OK</Badge>}
                      {(!r.v2_match_level || r.v2_match_level === 'none') && <Badge variant="destructive">×</Badge>}
                    </td>
                    <td className="p-2 text-center">
                      {r.status === 'paired' && <Badge variant="outline" className="text-green-600 border-green-500">pareado</Badge>}
                      {r.status === 'no_v2' && <Badge variant="outline" className="text-red-600 border-red-500">sem par</Badge>}
                      {r.status === 'duplicate' && <Badge variant="outline" className="text-amber-600 border-amber-500">dup</Badge>}
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
