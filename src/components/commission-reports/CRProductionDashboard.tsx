import { useState, useMemo } from 'react';
import { format } from 'date-fns';
import { supabase } from '@/integrations/supabase/client';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Loader2, Building2, Package } from 'lucide-react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
  PieChart, Pie, Cell
} from 'recharts';
import CRDateFilter from './CRDateFilter';

const fmtBRL = (v: number) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

const COLORS = [
  'hsl(var(--primary))', 'hsl(var(--accent))', 'hsl(var(--destructive))',
  'hsl(210, 60%, 55%)', 'hsl(150, 50%, 45%)', 'hsl(40, 80%, 55%)',
  'hsl(280, 50%, 55%)', 'hsl(0, 60%, 55%)', 'hsl(180, 50%, 45%)', 'hsl(320, 50%, 55%)',
];

interface RelatorioRow {
  produto: string | null;
  banco: string | null;
  valor_liberado: number | null;
  data_pago: string | null;
}

export default function CRProductionDashboard() {
  const [dataInicio, setDataInicio] = useState<Date | undefined>();
  const [dataFim, setDataFim] = useState<Date | undefined>();

  const { data: allRelatorio = [], isLoading } = useQuery({
    queryKey: ['cr-relatorio-production-all'],
    queryFn: async () => {
      // Batch fetch to bypass 1000 limit
      let all: RelatorioRow[] = [];
      let from = 0;
      const pageSize = 1000;
      while (true) {
        const { data } = await (supabase as any)
          .from('cr_relatorio')
          .select('produto, banco, valor_liberado, data_pago')
          .range(from, from + pageSize - 1);
        if (!data || data.length === 0) break;
        all = all.concat(data);
        if (data.length < pageSize) break;
        from += pageSize;
      }
      return all;
    },
  });

  // Filter by date client-side
  const relatorio = useMemo(() => {
    let rows = allRelatorio;
    if (dataInicio) {
      const fromStr = format(dataInicio, 'yyyy-MM-dd');
      rows = rows.filter(r => {
        if (!r.data_pago) return false;
        return r.data_pago.slice(0, 10) >= fromStr;
      });
    }
    if (dataFim) {
      const toStr = format(dataFim, 'yyyy-MM-dd');
      rows = rows.filter(r => {
        if (!r.data_pago) return false;
        return r.data_pago.slice(0, 10) <= toStr;
      });
    }
    return rows;
  }, [allRelatorio, dataInicio, dataFim]);

  const byBanco = useMemo(() => {
    const map = new Map<string, { valor: number; count: number }>();
    for (const r of relatorio) {
      const banco = (r.banco || 'Sem Banco').toUpperCase();
      const entry = map.get(banco) || { valor: 0, count: 0 };
      entry.valor += r.valor_liberado || 0;
      entry.count++;
      map.set(banco, entry);
    }
    return Array.from(map.entries())
      .map(([banco, d]) => ({ banco, valor: Math.round(d.valor * 100) / 100, count: d.count }))
      .sort((a, b) => b.valor - a.valor);
  }, [relatorio]);

  const byProduto = useMemo(() => {
    const map = new Map<string, { valor: number; count: number }>();
    for (const r of relatorio) {
      const produto = r.produto || 'Sem Produto';
      const entry = map.get(produto) || { valor: 0, count: 0 };
      entry.valor += r.valor_liberado || 0;
      entry.count++;
      map.set(produto, entry);
    }
    return Array.from(map.entries())
      .map(([produto, d]) => ({ produto, valor: Math.round(d.valor * 100) / 100, count: d.count }))
      .sort((a, b) => b.valor - a.valor);
  }, [relatorio]);

  const crossData = useMemo(() => {
    const top10 = byBanco.slice(0, 10).map(b => b.banco);
    const produtos = new Set<string>();
    const map = new Map<string, Record<string, number>>();

    for (const r of relatorio) {
      const banco = (r.banco || 'Sem Banco').toUpperCase();
      if (!top10.includes(banco)) continue;
      const produto = r.produto || 'Outro';
      produtos.add(produto);
      const entry = map.get(banco) || {};
      entry[produto] = (entry[produto] || 0) + (r.valor_liberado || 0);
      map.set(banco, entry);
    }

    return {
      data: top10.map(banco => {
        const entry = map.get(banco) || {};
        const row: Record<string, any> = { banco };
        for (const p of produtos) row[p] = Math.round((entry[p] || 0) * 100) / 100;
        return row;
      }),
      produtos: Array.from(produtos),
    };
  }, [relatorio, byBanco]);

  if (isLoading) {
    return <div className="flex justify-center py-12"><Loader2 className="w-6 h-6 animate-spin text-muted-foreground" /></div>;
  }

  if (allRelatorio.length === 0) {
    return <p className="text-center text-muted-foreground py-8 text-sm">Importe dados na aba Relatório (Import) primeiro.</p>;
  }

  const totalValor = byBanco.reduce((s, b) => s + b.valor, 0);
  const totalContratos = byBanco.reduce((s, b) => s + b.count, 0);

  return (
    <div className="space-y-6">
      <CRDateFilter dataInicio={dataInicio} dataFim={dataFim} setDataInicio={setDataInicio} setDataFim={setDataFim} />

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card><CardContent className="pt-6">
          <div className="flex items-center gap-2 text-muted-foreground text-sm mb-1"><Building2 className="w-4 h-4" /> Bancos Ativos</div>
          <p className="text-2xl font-bold">{byBanco.length}</p>
        </CardContent></Card>
        <Card><CardContent className="pt-6">
          <div className="flex items-center gap-2 text-muted-foreground text-sm mb-1"><Package className="w-4 h-4" /> Contratos Totais</div>
          <p className="text-2xl font-bold">{totalContratos.toLocaleString('pt-BR')}</p>
        </CardContent></Card>
        <Card><CardContent className="pt-6">
          <div className="text-muted-foreground text-sm mb-1">Valor Liberado Total</div>
          <p className="text-2xl font-bold">{fmtBRL(totalValor)}</p>
        </CardContent></Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2"><Building2 className="w-4 h-4" /> Produção por Banco (Top 10)</CardTitle>
            <CardDescription>Valor liberado por banco — top 10 em volume</CardDescription>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={350}>
              <BarChart data={byBanco.slice(0, 10)} layout="vertical" margin={{ left: 10, right: 20 }}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                <XAxis type="number" tickFormatter={(v) => `R$${(v / 1000).toFixed(0)}k`} tick={{ fontSize: 10 }} className="fill-muted-foreground" />
                <YAxis type="category" dataKey="banco" width={120} tick={{ fontSize: 10 }} className="fill-muted-foreground" />
                <Tooltip formatter={(v: number) => fmtBRL(v)} contentStyle={{ backgroundColor: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: '8px', fontSize: 12 }} />
                <Bar dataKey="valor" fill="hsl(var(--primary))" radius={[0, 4, 4, 0]} name="Valor Liberado" />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2"><Package className="w-4 h-4" /> Mix de Produtos</CardTitle>
            <CardDescription>Distribuição do valor liberado por tipo de produto</CardDescription>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={350}>
              <PieChart>
                <Pie data={byProduto} dataKey="valor" nameKey="produto" cx="50%" cy="50%" outerRadius={120}
                  label={({ produto, percent }) => `${produto} (${(percent * 100).toFixed(0)}%)`} labelLine={{ strokeWidth: 1 }}>
                  {byProduto.map((_, i) => (<Cell key={i} fill={COLORS[i % COLORS.length]} />))}
                </Pie>
                <Tooltip formatter={(v: number) => fmtBRL(v)} contentStyle={{ backgroundColor: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: '8px', fontSize: 12 }} />
              </PieChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Produção por Banco × Produto</CardTitle>
          <CardDescription>Composição de produtos por banco (top 10 bancos)</CardDescription>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={400}>
            <BarChart data={crossData.data} margin={{ left: 10, right: 20, bottom: 40 }}>
              <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
              <XAxis dataKey="banco" tick={{ fontSize: 9 }} className="fill-muted-foreground" height={60} angle={-30} textAnchor="end" />
              <YAxis tickFormatter={(v) => `R$${(v / 1000).toFixed(0)}k`} tick={{ fontSize: 10 }} className="fill-muted-foreground" />
              <Tooltip formatter={(v: number) => fmtBRL(v)} contentStyle={{ backgroundColor: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: '8px', fontSize: 12 }} />
              <Legend wrapperStyle={{ fontSize: 11 }} />
              {crossData.produtos.map((p, i) => (<Bar key={p} dataKey={p} stackId="a" fill={COLORS[i % COLORS.length]} />))}
            </BarChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>
    </div>
  );
}
