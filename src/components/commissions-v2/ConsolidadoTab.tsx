import { useState, useEffect, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHeader, TableRow } from '@/components/ui/table';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { supabase } from '@/integrations/supabase/client';
import { Download } from 'lucide-react';
import { TSHead, useSortState, applySortToData } from '@/components/commission-reports/CRSortUtils';
import WeekMultiSelect from './WeekMultiSelect';
import { fmtBRL, exportToExcel } from './commissionUtils';
import type { CommissionSale, SellerPix, Profile } from './commissionUtils';

interface ConsolidadoTabProps {
  profiles: Profile[];
  getSellerName: (id: string) => string;
}

export default function ConsolidadoTab({ profiles, getSellerName }: ConsolidadoTabProps) {
  const [sales, setSales] = useState<CommissionSale[]>([]);
  const [pixList, setPixList] = useState<SellerPix[]>([]);
  const [loading, setLoading] = useState(true);
  const [monthFilter, setMonthFilter] = useState<string>('all');
  const [weekFilters, setWeekFilters] = useState<string[]>([]);
  const { sort, toggle } = useSortState();

  useEffect(() => {
    Promise.all([
      supabase.from('commission_sales_v2').select('*').order('sale_date', { ascending: false }),
      supabase.from('seller_pix_v2').select('*'),
    ]).then(([salesRes, pixRes]) => {
      if (salesRes.data) setSales(salesRes.data as unknown as CommissionSale[]);
      if (pixRes.data) setPixList(pixRes.data as unknown as SellerPix[]);
      setLoading(false);
    });
  }, []);

  const monthOptions = useMemo(() => {
    const set = new Set<string>();
    sales.forEach(s => { if (s.sale_date) set.add(s.sale_date.slice(0, 7)); });
    return [...set].sort().reverse();
  }, [sales]);

  const weeks = useMemo(() => {
    const filteredSales = monthFilter === 'all'
      ? sales
      : sales.filter(s => s.sale_date && s.sale_date.slice(0, 7) === monthFilter);
    return [...new Set(filteredSales.map(s => s.week_label).filter(Boolean))].sort().reverse() as string[];
  }, [sales, monthFilter]);

  useEffect(() => {
    setWeekFilters(prev => prev.filter(w => weeks.includes(w)));
  }, [weeks]);

  const monthBaseSales = monthFilter === 'all'
    ? sales
    : sales.filter(s => s.sale_date && s.sale_date.slice(0, 7) === monthFilter);
  const filtered = weekFilters.length === 0 ? monthBaseSales : monthBaseSales.filter(s => weekFilters.includes(s.week_label || ''));

  const monthLabel = (ym: string) => {
    const [y, m] = ym.split('-');
    const names = ['Janeiro','Fevereiro','Março','Abril','Maio','Junho','Julho','Agosto','Setembro','Outubro','Novembro','Dezembro'];
    return `${names[Number(m) - 1]}/${y}`;
  };


  const sellerIds = [...new Set(filtered.map(s => s.seller_id))];
  const sellerData = sellerIds.map(sid => {
    const sellerSales = filtered.filter(s => s.seller_id === sid);
    const clt = sellerSales.filter(s => s.product === 'Crédito do Trabalhador').reduce((a, s) => a + s.commission_value, 0);
    const fgts = sellerSales.filter(s => s.product === 'FGTS').reduce((a, s) => a + s.commission_value, 0);
    const pix = pixList.find(p => p.seller_id === sid);
    return { seller_id: sid, clt, fgts, total: clt + fgts, pix_key: pix?.pix_key || '-' };
  }).sort((a, b) => b.total - a.total);

  const grandTotal = sellerData.reduce((a, s) => a + s.total, 0);
  const fmt = fmtBRL;

  const handleExport = async () => {
    const data = sellerData.map(s => ({
      'Vendedor': getSellerName(s.seller_id),
      'Comissão CLT': s.clt,
      'Comissão FGTS': s.fgts,
      'Total': s.total,
      'Chave PIX': s.pix_key,
    }));
    data.push({
      'Vendedor': 'TOTAL',
      'Comissão CLT': sellerData.reduce((a, s) => a + s.clt, 0),
      'Comissão FGTS': sellerData.reduce((a, s) => a + s.fgts, 0),
      'Total': grandTotal,
      'Chave PIX': '',
    });
    const suffix = weekFilters.length > 0 ? '_' + weekFilters.join('+').replace(/[\/\s]/g, '-') : '';
    await exportToExcel(data, `consolidado_comissoes${suffix}.xlsx`, 'Consolidado');
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle>Consolidado Semanal</CardTitle>
          <Button variant="outline" size="sm" onClick={handleExport} disabled={sellerData.length === 0}>
            <Download className="w-4 h-4 mr-1" /> Exportar Excel
          </Button>
        </div>
        <div className="flex flex-col sm:flex-row gap-2 mt-2">
          <Select value={monthFilter} onValueChange={setMonthFilter}>
            <SelectTrigger className="w-full sm:w-48">
              <SelectValue placeholder="Mês" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos os meses</SelectItem>
              {monthOptions.map(m => (
                <SelectItem key={m} value={m}>{monthLabel(m)}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <WeekMultiSelect weeks={weeks} selected={weekFilters} onChange={setWeekFilters} className="w-full sm:w-64" />
        </div>
      </CardHeader>
      <CardContent>
        {loading ? <p className="text-center text-muted-foreground py-8">Carregando...</p> : sellerData.length === 0 ? (
          <p className="text-center text-muted-foreground py-8">Nenhum dado</p>
        ) : (
          <Table>
            <TableHeader>
              <tr>
                <TSHead label="Vendedor" sortKey="seller_id" sort={sort} toggle={toggle} />
                <TSHead label="CLT" sortKey="clt" sort={sort} toggle={toggle} className="text-right" />
                <TSHead label="FGTS" sortKey="fgts" sort={sort} toggle={toggle} className="text-right" />
                <TSHead label="Total" sortKey="total" sort={sort} toggle={toggle} className="text-right" />
                <TSHead label="Chave PIX" sortKey="pix_key" sort={sort} toggle={toggle} />
              </tr>
            </TableHeader>
            <TableBody>
              {applySortToData(sellerData, sort, (s, k) => {
                if (k === 'seller_id') return getSellerName(s.seller_id);
                return (s as any)[k];
              }).map(s => (
                <TableRow key={s.seller_id}>
                  <TableCell className="font-medium">{getSellerName(s.seller_id)}</TableCell>
                  <TableCell className="text-right">{fmt(s.clt)}</TableCell>
                  <TableCell className="text-right">{fmt(s.fgts)}</TableCell>
                  <TableCell className="text-right font-bold text-primary">{fmt(s.total)}</TableCell>
                  <TableCell className="font-mono text-sm">{s.pix_key}</TableCell>
                </TableRow>
              ))}
              <TableRow className="bg-muted/50 font-bold">
                <TableCell>TOTAL</TableCell>
                <TableCell className="text-right">{fmt(sellerData.reduce((a, s) => a + s.clt, 0))}</TableCell>
                <TableCell className="text-right">{fmt(sellerData.reduce((a, s) => a + s.fgts, 0))}</TableCell>
                <TableCell className="text-right text-primary">{fmt(grandTotal)}</TableCell>
                <TableCell />
              </TableRow>
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  );
}
