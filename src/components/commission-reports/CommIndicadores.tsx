import { useMemo } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHeader, TableRow } from '@/components/ui/table';
import { Loader2, Medal, PieChart, Ticket } from 'lucide-react';
import { TSHead, useSortState, applySortToData } from './CRSortUtils';

const fmtBRL = (v: number) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

interface Sale {
  id: string;
  seller_id: string;
  product: string;
  bank: string;
  released_value: number;
  commission_value: number;
  week_label: string | null;
  bonus_value?: number;
}

interface Profile {
  user_id: string;
  name: string | null;
  email: string;
}

export default function CommIndicadores({ profiles, getSellerName }: { profiles: Profile[]; getSellerName: (id: string) => string }) {
  const { sort, toggle } = useSortState();

  const { data: sales = [], isLoading } = useQuery({
    queryKey: ['comm-sales-indicadores'],
    queryFn: async () => {
      const { data } = await supabase.from('commission_sales').select('id, seller_id, product, bank, released_value, commission_value, week_label').limit(5000);
      return (data || []) as Sale[];
    },
  });

  // 1. Ticket Médio por Vendedor
  const ticketMedio = useMemo(() => {
    const map = new Map<string, { total: number; count: number; comissao: number }>();
    for (const s of sales) {
      const entry = map.get(s.seller_id) || { total: 0, count: 0, comissao: 0 };
      entry.total += s.released_value;
      entry.count++;
      entry.comissao += s.commission_value || 0;
      map.set(s.seller_id, entry);
    }
    return Array.from(map.entries()).map(([seller_id, v]) => ({
      seller_id,
      nome: getSellerName(seller_id),
      propostas: v.count,
      totalLiberado: v.total,
      ticketMedio: v.count > 0 ? v.total / v.count : 0,
      comissaoTotal: v.comissao,
    }));
  }, [sales, getSellerName]);

  // 2. Ranking Semanal (latest week)
  const rankingSemanal = useMemo(() => {
    const weeks = [...new Set(sales.filter(s => s.week_label).map(s => s.week_label!))].sort().reverse();
    const latestWeek = weeks[0] || null;
    const prevWeek = weeks[1] || null;

    if (!latestWeek) return { week: '', rows: [] };

    const current = new Map<string, number>();
    const prev = new Map<string, number>();
    for (const s of sales) {
      if (s.week_label === latestWeek) current.set(s.seller_id, (current.get(s.seller_id) || 0) + (s.commission_value || 0));
      if (prevWeek && s.week_label === prevWeek) prev.set(s.seller_id, (prev.get(s.seller_id) || 0) + (s.commission_value || 0));
    }

    const rows = Array.from(current.entries()).map(([seller_id, cms]) => {
      const prevCms = prev.get(seller_id) || 0;
      return { seller_id, nome: getSellerName(seller_id), comissao: cms, anterior: prevCms, variacao: prevCms > 0 ? ((cms - prevCms) / prevCms) : 0 };
    }).sort((a, b) => b.comissao - a.comissao);

    return { week: latestWeek, rows };
  }, [sales, getSellerName]);

  // 3. Mix de Produtos
  const mixProdutos = useMemo(() => {
    const map = new Map<string, { fgts: number; clt: number; outros: number; total: number }>();
    for (const s of sales) {
      const entry = map.get(s.seller_id) || { fgts: 0, clt: 0, outros: 0, total: 0 };
      const p = s.product.toUpperCase();
      if (p.includes('FGTS')) entry.fgts += s.released_value;
      else if (p.includes('CLT') || p.includes('TRABALHADOR')) entry.clt += s.released_value;
      else entry.outros += s.released_value;
      entry.total += s.released_value;
      map.set(s.seller_id, entry);
    }
    return Array.from(map.entries()).map(([seller_id, v]) => ({
      seller_id,
      nome: getSellerName(seller_id),
      fgts: v.fgts,
      clt: v.clt,
      outros: v.outros,
      pctFGTS: v.total > 0 ? v.fgts / v.total : 0,
      pctCLT: v.total > 0 ? v.clt / v.total : 0,
    }));
  }, [sales, getSellerName]);

  const sortedTicket = applySortToData(ticketMedio, sort);
  const sortedMix = applySortToData(mixProdutos, sort);

  if (isLoading) return <div className="flex justify-center py-12"><Loader2 className="w-6 h-6 animate-spin text-muted-foreground" /></div>;
  if (sales.length === 0) return <p className="text-center text-muted-foreground py-8 text-sm">Nenhuma venda registrada ainda.</p>;

  return (
    <div className="space-y-6">
      {/* 1. Ticket Médio */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-lg"><Ticket className="w-5 h-5" /> Ticket Médio por Vendedor</CardTitle>
          <CardDescription>Valor liberado médio por proposta, agrupado por vendedor.</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="border rounded-lg max-h-[400px] overflow-auto">
            <Table className="min-w-[700px]">
              <TableHeader>
                <tr>
                  <TSHead label="Vendedor" sortKey="nome" sort={sort} toggle={toggle} tooltip="Nome do vendedor" className="text-xs" />
                  <TSHead label="Propostas" sortKey="propostas" sort={sort} toggle={toggle} tooltip="Quantidade total de propostas" className="text-xs text-right" />
                  <TSHead label="Total Liberado" sortKey="totalLiberado" sort={sort} toggle={toggle} tooltip="Soma do valor liberado" className="text-xs text-right" />
                  <TSHead label="Ticket Médio" sortKey="ticketMedio" sort={sort} toggle={toggle} tooltip="Valor médio por proposta" className="text-xs text-right" />
                  <TSHead label="Comissão Total" sortKey="comissaoTotal" sort={sort} toggle={toggle} tooltip="Soma da comissão calculada" className="text-xs text-right" />
                </tr>
              </TableHeader>
              <TableBody>
                {sortedTicket.map((r, i) => (
                  <TableRow key={i}>
                    <TableCell className="text-xs font-medium">{r.nome}</TableCell>
                    <TableCell className="text-xs text-right font-mono">{r.propostas}</TableCell>
                    <TableCell className="text-xs text-right font-mono">{fmtBRL(r.totalLiberado)}</TableCell>
                    <TableCell className="text-xs text-right font-mono font-bold">{fmtBRL(r.ticketMedio)}</TableCell>
                    <TableCell className="text-xs text-right font-mono">{fmtBRL(r.comissaoTotal)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {/* 2. Ranking Semanal */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-lg"><Medal className="w-5 h-5 text-yellow-500" /> Ranking Semanal</CardTitle>
          <CardDescription>Top vendedores por comissão na semana mais recente{rankingSemanal.week ? ` (${rankingSemanal.week})` : ''}.</CardDescription>
        </CardHeader>
        <CardContent>
          {rankingSemanal.rows.length === 0 ? (
            <p className="text-center text-muted-foreground py-4 text-sm">Sem dados de semana disponíveis.</p>
          ) : (
            <div className="border rounded-lg max-h-[400px] overflow-auto">
              <Table className="min-w-[700px]">
                <TableHeader>
                  <tr>
                    <TSHead label="#" sortKey="_rank" sort={sort} toggle={toggle} tooltip="Posição no ranking" className="text-xs w-10" />
                    <TSHead label="Vendedor" sortKey="nome" sort={sort} toggle={toggle} tooltip="Nome do vendedor" className="text-xs" />
                    <TSHead label="Comissão" sortKey="comissao" sort={sort} toggle={toggle} tooltip="Comissão total na semana" className="text-xs text-right" />
                    <TSHead label="Sem. Anterior" sortKey="anterior" sort={sort} toggle={toggle} tooltip="Comissão na semana anterior" className="text-xs text-right" />
                    <TSHead label="Variação" sortKey="variacao" sort={sort} toggle={toggle} tooltip="Variação percentual vs semana anterior" className="text-xs text-right" />
                  </tr>
                </TableHeader>
                <TableBody>
                  {rankingSemanal.rows.map((r, i) => (
                    <TableRow key={i}>
                      <TableCell className="text-xs font-bold">{i + 1}º</TableCell>
                      <TableCell className="text-xs font-medium">{r.nome}</TableCell>
                      <TableCell className="text-xs text-right font-mono font-bold">{fmtBRL(r.comissao)}</TableCell>
                      <TableCell className="text-xs text-right font-mono text-muted-foreground">{fmtBRL(r.anterior)}</TableCell>
                      <TableCell className={`text-xs text-right font-mono ${r.variacao > 0 ? 'text-green-600' : r.variacao < 0 ? 'text-destructive' : ''}`}>
                        {r.variacao > 0 ? '+' : ''}{(r.variacao * 100).toFixed(1)}%
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* 3. Mix de Produtos */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-lg"><PieChart className="w-5 h-5" /> Mix de Produtos</CardTitle>
          <CardDescription>Distribuição percentual FGTS vs CLT por vendedor.</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="border rounded-lg max-h-[400px] overflow-auto">
            <Table>
              <TableHeader>
                <tr>
                  <TSHead label="Vendedor" sortKey="nome" sort={sort} toggle={toggle} tooltip="Nome do vendedor" className="text-xs" />
                  <TSHead label="FGTS" sortKey="fgts" sort={sort} toggle={toggle} tooltip="Valor liberado em FGTS" className="text-xs text-right" />
                  <TSHead label="% FGTS" sortKey="pctFGTS" sort={sort} toggle={toggle} tooltip="Percentual do total em FGTS" className="text-xs text-right" />
                  <TSHead label="CLT" sortKey="clt" sort={sort} toggle={toggle} tooltip="Valor liberado em CLT" className="text-xs text-right" />
                  <TSHead label="% CLT" sortKey="pctCLT" sort={sort} toggle={toggle} tooltip="Percentual do total em CLT" className="text-xs text-right" />
                </tr>
              </TableHeader>
              <TableBody>
                {sortedMix.map((r, i) => (
                  <TableRow key={i}>
                    <TableCell className="text-xs font-medium">{r.nome}</TableCell>
                    <TableCell className="text-xs text-right font-mono">{fmtBRL(r.fgts)}</TableCell>
                    <TableCell className="text-xs text-right font-mono"><Badge variant="default" className="text-[10px]">{(r.pctFGTS * 100).toFixed(1)}%</Badge></TableCell>
                    <TableCell className="text-xs text-right font-mono">{fmtBRL(r.clt)}</TableCell>
                    <TableCell className="text-xs text-right font-mono"><Badge variant="secondary" className="text-[10px]">{(r.pctCLT * 100).toFixed(1)}%</Badge></TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
