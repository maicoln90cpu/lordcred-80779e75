import { useState, useMemo } from 'react';
import { format } from 'date-fns';
import { supabase } from '@/integrations/supabase/client';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Loader2, Calculator, Search, Download } from 'lucide-react';
import { loadXLSX } from '@/lib/xlsx-lazy';
import { TSHead, applySortToData, TipWrap } from './CRSortUtils';
import { useTableState } from '@/hooks/useTableState';
import { TablePagination } from '@/components/common/TablePagination';
import { TooltipProvider } from '@/components/ui/tooltip';
import { batchFetchRpc } from '@/lib/batchFetchRpc';
import CRDateFilter from './CRDateFilter';

const fmtBRL = (v: number) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
const fmtDate = (d: string | null) => {
  if (!d) return '-';
  try { return format(new Date(d), 'dd/MM/yyyy'); } catch { return '-'; }
};

interface AuditRow {
  num_contrato: string; nome: string; banco: string; produto: string; tabela: string;
  valor_liberado: number; valor_assegurado: number; prazo: number; seguro: string;
  vendedor: string; data_pago: string | null;
  comissao_recebida: number; comissao_esperada: number; diferenca: number;
}

interface CRRelatorioProps { divergenciasOnly?: boolean; }

export default function CRRelatorio({ divergenciasOnly = false }: CRRelatorioProps) {
  const [search, setSearch] = useState('');
  const { sort, toggle: toggleSort } = useSortState();
  const [filterBanco, setFilterBanco] = useState('');
  const [filterProduto, setFilterProduto] = useState('');
  const [filterDifTipo, setFilterDifTipo] = useState<'all' | 'positive' | 'negative'>('all');
  const [dataInicio, setDataInicio] = useState<Date | undefined>();
  const [dataFim, setDataFim] = useState<Date | undefined>();

  const dateFromStr = dataInicio ? format(dataInicio, 'yyyy-MM-dd') : null;
  const dateToStr = dataFim ? format(dataFim, 'yyyy-MM-dd') : null;

  const { data: reportRows = [], isLoading } = useQuery({
    queryKey: ['cr-audit-rpc-full', dateFromStr, dateToStr],
    queryFn: async () => {
      return batchFetchRpc<AuditRow>('calculate_commission_audit', {
        _date_from: dateFromStr,
        _date_to: dateToStr,
      });
    }
  });

  const filtered = useMemo(() => {
    let rows = divergenciasOnly ? reportRows.filter(r => Math.abs(r.diferenca) > 0.01) : reportRows;
    if (filterBanco) rows = rows.filter(r => r.banco.toUpperCase() === filterBanco);
    if (filterProduto) rows = rows.filter(r => r.produto === filterProduto);
    if (filterDifTipo === 'positive') rows = rows.filter(r => r.diferenca > 0.01);
    if (filterDifTipo === 'negative') rows = rows.filter(r => r.diferenca < -0.01);
    if (search) {
      const q = search.toLowerCase();
      rows = rows.filter(r =>
        r.num_contrato.toLowerCase().includes(q) || r.nome.toLowerCase().includes(q) ||
        r.vendedor.toLowerCase().includes(q) || r.banco.toLowerCase().includes(q)
      );
    }
    return rows;
  }, [reportRows, divergenciasOnly, filterBanco, filterProduto, filterDifTipo, search]);

  const sorted = applySortToData(filtered, sort);
  const bancos = useMemo(() => [...new Set(reportRows.map(r => r.banco.toUpperCase()))].sort(), [reportRows]);
  const totals = useMemo(() => ({
    recebida: filtered.reduce((s, r) => s + r.comissao_recebida, 0),
    esperada: filtered.reduce((s, r) => s + r.comissao_esperada, 0),
    diferenca: filtered.reduce((s, r) => s + r.diferenca, 0),
    liberado: filtered.reduce((s, r) => s + r.valor_liberado, 0),
    count: filtered.length,
  }), [filtered]);

  const handleExport = async () => {
    const XLSX = await loadXLSX();
    const ws = XLSX.utils.json_to_sheet(sorted.map(r => ({
      'Nº Contrato': r.num_contrato, 'Data': fmtDate(r.data_pago), Produto: r.produto,
      Banco: r.banco, Prazo: r.prazo, Tabela: r.tabela, 'Valor Lib.': r.valor_liberado,
      Seguro: r.seguro, Nome: r.nome, Vendedor: r.vendedor,
      'Vlr Assegurado': r.valor_assegurado || '',
      Recebida: r.comissao_recebida,
      Esperada: r.comissao_esperada, Diferença: r.diferenca,
    })));
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, divergenciasOnly ? 'Divergências' : 'Relatório');
    XLSX.writeFile(wb, divergenciasOnly ? 'divergencias.xlsx' : 'relatorio_comissoes.xlsx');
  };

  const title = divergenciasOnly ? 'Divergências' : 'Relatório de Comissões';
  const desc = divergenciasOnly
    ? 'Contratos com diferença entre comissão recebida e esperada.'
    : 'Cruzamento: Relatório (dados de venda) + Geral + Repasse + Seguros → Comissão Esperada vs Recebida.';
  const emptyMsg = reportRows.length === 0
    ? 'Importe dados na aba "Relatório (Import)" primeiro.'
    : 'Importe dados nas abas Geral, Repasse e Seguros primeiro.';

  return (
    <div className="space-y-4">
      <CRDateFilter dataInicio={dataInicio} dataFim={dataFim} setDataInicio={setDataInicio} setDataFim={setDataFim} />
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <div>
              <CardTitle className="flex items-center gap-2 text-lg"><Calculator className="w-5 h-5" /> {title}</CardTitle>
              <CardDescription>{desc}</CardDescription>
            </div>
            <div className="flex items-center gap-2 flex-wrap">
              <TipWrap tip="Quantidade de contratos no filtro atual"><Badge variant="outline" className="text-xs">{totals.count} contratos</Badge></TipWrap>
              <TipWrap tip="Soma de toda produção líquida"><Badge variant="outline" className="text-xs">Liberado: {fmtBRL(totals.liberado)}</Badge></TipWrap>
              <TipWrap tip="Soma de CMS Geral + Repasse + Seguro"><Badge variant="secondary" className="text-xs">Recebida: {fmtBRL(totals.recebida)}</Badge></TipWrap>
              <TipWrap tip="Calculada pelas regras FGTS/CLT cadastradas"><Badge variant="secondary" className="text-xs">Esperada: {fmtBRL(totals.esperada)}</Badge></TipWrap>
              <TipWrap tip="Recebida − Esperada (positivo = recebeu mais)"><Badge variant={totals.diferenca >= 0 ? 'default' : 'destructive'} className="text-xs">Δ {fmtBRL(totals.diferenca)}</Badge></TipWrap>
            </div>
          </div>
          <div className="flex items-center gap-2 pt-2 flex-wrap">
            <div className="relative"><Search className="absolute left-2.5 top-2.5 w-4 h-4 text-muted-foreground" /><Input placeholder="Buscar contrato, nome, vendedor..." value={search} onChange={e => setSearch(e.target.value)} className="pl-8 w-56 h-9" /></div>
            <select value={filterBanco} onChange={e => setFilterBanco(e.target.value)} className="h-9 rounded-md border border-input bg-background px-3 text-sm">
              <option value="">Todos os bancos</option>
              {bancos.map(b => <option key={b} value={b}>{b}</option>)}
            </select>
            <select value={filterProduto} onChange={e => setFilterProduto(e.target.value)} className="h-9 rounded-md border border-input bg-background px-3 text-sm">
              <option value="">Todos os produtos</option>
              <option value="FGTS">FGTS</option>
              <option value="CLT">CLT</option>
            </select>
            {divergenciasOnly && (
              <select value={filterDifTipo} onChange={e => setFilterDifTipo(e.target.value as any)} className="h-9 rounded-md border border-input bg-background px-3 text-sm">
                <option value="all">Todas as diferenças</option>
                <option value="positive">Positivas (recebeu mais)</option>
                <option value="negative">Negativas (recebeu menos)</option>
              </select>
            )}
            <Button variant="outline" size="sm" onClick={handleExport} disabled={sorted.length === 0}><Download className="w-4 h-4 mr-1" /> Exportar</Button>
          </div>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex justify-center py-8"><Loader2 className="w-6 h-6 animate-spin text-muted-foreground" /></div>
          ) : reportRows.length === 0 ? (
            <p className="text-center text-muted-foreground py-8 text-sm">{emptyMsg}</p>
          ) : sorted.length === 0 ? (
            <p className="text-center text-muted-foreground py-8 text-sm">{divergenciasOnly ? 'Nenhuma divergência encontrada! 🎉' : 'Nenhum resultado para os filtros aplicados.'}</p>
          ) : (
            <div className="border rounded-lg max-h-[600px] overflow-auto scrollbar-visible">
            <TooltipProvider delayDuration={300}>
              <Table className="min-w-[1500px]">
                <TableHeader>
                  <tr>
                    <TSHead label="Contrato" sortKey="num_contrato" sort={sort} toggle={toggleSort} tooltip="Nº do contrato / ADE" className="text-xs whitespace-nowrap" />
                    <TSHead label="Data" sortKey="data_pago" sort={sort} toggle={toggleSort} tooltip="Data de pagamento" className="text-xs whitespace-nowrap" />
                    <TSHead label="Nome" sortKey="nome" sort={sort} toggle={toggleSort} tooltip="Nome do cliente" className="text-xs whitespace-nowrap" />
                    <TSHead label="Banco" sortKey="banco" sort={sort} toggle={toggleSort} tooltip="Banco do contrato" className="text-xs whitespace-nowrap" />
                    <TSHead label="Produto" sortKey="produto" sort={sort} toggle={toggleSort} tooltip="FGTS ou CLT" className="text-xs whitespace-nowrap" />
                    <TSHead label="Tabela" sortKey="tabela" sort={sort} toggle={toggleSort} tooltip="Nome da tabela do banco" className="text-xs whitespace-nowrap" />
                    <TSHead label="Valor Lib." sortKey="valor_liberado" sort={sort} toggle={toggleSort} tooltip="Valor liberado ao cliente" className="text-xs whitespace-nowrap text-right" />
                    <TSHead label="Seguro" sortKey="seguro" sort={sort} toggle={toggleSort} tooltip="Sim ou Não" className="text-xs whitespace-nowrap" />
                    <TSHead label="Vendedor" sortKey="vendedor" sort={sort} toggle={toggleSort} tooltip="Vendedor responsável" className="text-xs whitespace-nowrap" />
                    <TSHead label="Recebida" sortKey="comissao_recebida" sort={sort} toggle={toggleSort} tooltip="Soma: Comissão + Repasse + Seguro" className="text-xs whitespace-nowrap text-right" />
                    <TSHead label="Esperada" sortKey="comissao_esperada" sort={sort} toggle={toggleSort} tooltip="Calculada pelas regras FGTS/CLT" className="text-xs whitespace-nowrap text-right" />
                    <TSHead label="Diferença" sortKey="diferenca" sort={sort} toggle={toggleSort} tooltip="Recebida − Esperada" className="text-xs whitespace-nowrap text-right" />
                  </tr>
                </TableHeader>
                <TableBody>
                  {sorted.slice(0, 500).map((r, i) => (
                    <TableRow key={i} className={Math.abs(r.diferenca) > 0.01 ? 'bg-destructive/5' : ''}>
                      <TableCell className="text-xs font-mono">{r.num_contrato || '-'}</TableCell>
                      <TableCell className="text-xs font-mono whitespace-nowrap">{fmtDate(r.data_pago)}</TableCell>
                      <TableCell className="text-xs max-w-[140px] truncate">{r.nome}</TableCell>
                      <TableCell className="text-xs">{r.banco}</TableCell>
                      <TableCell className="text-xs"><Badge variant={r.produto === 'FGTS' ? 'default' : 'secondary'} className="text-[10px]">{r.produto}</Badge></TableCell>
                      <TableCell className="text-xs max-w-[160px] truncate" title={r.tabela}>{r.tabela || '-'}</TableCell>
                      <TableCell className="text-xs text-right font-mono">{fmtBRL(r.valor_liberado)}</TableCell>
                      <TableCell className="text-xs">{r.seguro}</TableCell>
                      <TableCell className="text-xs max-w-[100px] truncate">{r.vendedor || '-'}</TableCell>
                      <TableCell className="text-xs text-right font-mono">{fmtBRL(r.comissao_recebida)}</TableCell>
                      <TableCell className="text-xs text-right font-mono">{fmtBRL(r.comissao_esperada)}</TableCell>
                      <TableCell className={`text-xs text-right font-mono font-bold ${r.diferenca > 0.01 ? 'text-green-600' : r.diferenca < -0.01 ? 'text-destructive' : ''}`}>{fmtBRL(r.diferenca)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TooltipProvider>
              {sorted.length > 500 && <p className="text-center text-xs text-muted-foreground py-2">Mostrando 500 de {sorted.length}...</p>}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
