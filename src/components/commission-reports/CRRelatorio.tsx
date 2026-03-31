import { useState, useMemo } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Loader2, Calculator, Search, Download } from 'lucide-react';
import * as XLSX from 'xlsx';
import { TSHead, useSortState, applySortToData, TOOLTIPS_RELATORIO, TipWrap } from './CRSortUtils';
import { TooltipProvider } from '@/components/ui/tooltip';

// ==================== TYPES ====================
interface RelatorioRow {
  id: string; data_pago: string | null; num_contrato: string | null; produto: string | null;
  banco: string | null; prazo: number | null; tabela: string | null; valor_liberado: number | null;
  seguro: string | null; cpf: string | null; nome: string | null; data_nascimento: string | null;
  telefone: string | null; vendedor: string | null; id_contrato: string | null;
}
interface GeralRow { ade: string | null; cod_contrato: string | null; cms_rep: number | null; }
interface RepasseRow { ade: string | null; cod_contrato: string | null; cms_rep_favorecido: number | null; }
interface SeguroRow { descricao: string | null; valor_comissao: number | null; }
interface RuleFGTS { banco: string; tabela_chave: string; seguro: string; min_valor: number; max_valor: number; taxa: number; data_vigencia: string; }
interface RuleCLT { banco: string; tabela_chave: string; seguro: string; prazo_min: number; prazo_max: number; taxa: number; data_vigencia: string; }

interface ReportRow {
  num_contrato: string; nome: string; banco: string; produto: string; tabela: string;
  valor_liberado: number; valor_assegurado: number; prazo: number; seguro: string;
  vendedor: string; data_pago: string;
  cms_geral: number; cms_repasse: number; cms_seguro: number;
  comissao_recebida: number; esperada_clt: number; esperada_fgts: number;
  comissao_esperada: number; diferenca: number;
}

// ==================== BANK-SPECIFIC TABLE KEY LOGIC ====================
// These replicate the exact spreadsheet formulas for mapping tabela → tabela_chave

function extractTableKeyFGTS(banco: string, tabela: string, seguro: string): string {
  const b = banco.toUpperCase();
  if (b.includes('PARANA') || b.includes('PARANÁ')) {
    return seguro === 'Sim' ? 'SEGURO' : 'PARANA';
  }
  if (b.includes('LOTUS')) {
    // Last character of table name: e.g. "57325 - 1" → "1"
    const lastChar = tabela.trim().slice(-1);
    return ` ${lastChar} `;
  }
  if (b.includes('HUB')) {
    const t = tabela.toUpperCase();
    if (t.includes('SONHO')) return 'SONHO';
    if (t.includes('FOCO')) return 'FOCO';
    return 'CARTA NA M';
  }
  if (b.includes('FACTA')) {
    return tabela.toUpperCase().includes('PLUS') ? 'GOLD PLUS' : 'GOLD POWER';
  }
  return '*';
}

function extractTableKeyCLT(banco: string, tabela: string): string {
  const b = banco.toUpperCase();
  if (b.includes('HUB')) {
    const t = tabela.toUpperCase();
    if (t.includes('36X COM SEGURO')) return '36X COM SEGURO';
    if (t.includes('FOCO')) return 'FOCO NO CORBAN';
    if (t.includes('SONHO')) return 'SONHO DO CLT';
    if (t.includes('48X')) return 'CONSIGNADO CLT 48x';
    return 'CARTADA CLT';
  }
  return '*';
}

function findFGTSRate(rules: RuleFGTS[], banco: string, valor: number, tabelaChave: string, seguro: string, dataPgt: string | null): number {
  const b = banco.toUpperCase();
  const dt = dataPgt ? dataPgt.slice(0, 10) : '9999-12-31';
  const temSeguro = seguro === 'Sim';
  const candidates = rules
    .filter(r => r.banco.toUpperCase() === b && r.data_vigencia <= dt)
    .sort((a, b2) => b2.data_vigencia.localeCompare(a.data_vigencia));
  for (const r of candidates) {
    const keyMatch = r.tabela_chave === '*' || tabelaChave.toUpperCase().includes(r.tabela_chave.toUpperCase());
    const seguroMatch = r.seguro === 'Ambos' || (r.seguro === 'Sim' && temSeguro) || (r.seguro === 'Não' && !temSeguro);
    if (keyMatch && seguroMatch && valor >= r.min_valor && valor <= r.max_valor) return r.taxa;
  }
  return 0;
}

function findCLTRate(rules: RuleCLT[], banco: string, prazo: number, tabelaChave: string, seguro: string, dataPgt: string | null): number {
  const b = banco.toUpperCase();
  const dt = dataPgt ? dataPgt.slice(0, 10) : '9999-12-31';
  const temSeguro = seguro === 'Sim';
  const candidates = rules
    .filter(r => r.banco.toUpperCase() === b && r.data_vigencia <= dt)
    .sort((a, b2) => b2.data_vigencia.localeCompare(a.data_vigencia));
  for (const r of candidates) {
    const keyMatch = r.tabela_chave === '*' || tabelaChave.toUpperCase().includes(r.tabela_chave.toUpperCase());
    const seguroMatch = r.seguro === 'Ambos' || (r.seguro === 'Sim' && temSeguro) || (r.seguro === 'Não' && !temSeguro);
    if (keyMatch && seguroMatch && prazo >= r.prazo_min && prazo <= r.prazo_max) return r.taxa;
  }
  return 0;
}

function isMercantil(banco: string): boolean {
  return banco.toUpperCase().includes('MERCANTIL');
}

const fmtBRL = (v: number) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

// ==================== COMPONENT ====================
interface CRRelatorioProps { divergenciasOnly?: boolean; }

export default function CRRelatorio({ divergenciasOnly = false }: CRRelatorioProps) {
  const [search, setSearch] = useState('');
  const { sort, toggle: toggleSort } = useSortState();
  const [filterBanco, setFilterBanco] = useState('');
  const [filterProduto, setFilterProduto] = useState('');
  const [filterDifTipo, setFilterDifTipo] = useState<'all' | 'positive' | 'negative'>('all');

  // Fetch cr_relatorio as base
  const { data: relatorio = [], isLoading: l0 } = useQuery({
    queryKey: ['cr-relatorio-data'],
    queryFn: async () => {
      const { data } = await (supabase as any).from('cr_relatorio').select('*').limit(5000);
      return (data || []) as RelatorioRow[];
    }
  });

  // Fetch support data for comissão recebida
  const { data: geral = [], isLoading: l1 } = useQuery({ queryKey: ['cr-geral-report'], queryFn: async () => { const { data } = await supabase.from('cr_geral').select('ade, cod_contrato, cms_rep').limit(5000); return (data || []) as GeralRow[]; } });
  const { data: repasse = [], isLoading: l2 } = useQuery({ queryKey: ['cr-repasse-report'], queryFn: async () => { const { data } = await supabase.from('cr_repasse').select('ade, cod_contrato, cms_rep_favorecido').limit(5000); return (data || []) as RepasseRow[]; } });
  const { data: seguros = [], isLoading: l3 } = useQuery({ queryKey: ['cr-seguros-report'], queryFn: async () => { const { data } = await supabase.from('cr_seguros').select('descricao, valor_comissao').limit(5000); return (data || []) as SeguroRow[]; } });
  const { data: rulesFGTS = [], isLoading: l4 } = useQuery({ queryKey: ['cr-rules-fgts'], queryFn: async () => { const { data } = await supabase.from('cr_rules_fgts').select('*').order('data_vigencia', { ascending: false }); return (data || []) as RuleFGTS[]; } });
  const { data: rulesCLT = [], isLoading: l5 } = useQuery({ queryKey: ['cr-rules-clt'], queryFn: async () => { const { data } = await supabase.from('cr_rules_clt').select('*').order('data_vigencia', { ascending: false }); return (data || []) as RuleCLT[]; } });
  const isLoading = l0 || l1 || l2 || l3 || l4 || l5;

  // Build lookup maps: ADE/contrato → comissão values from Geral, Repasse, Seguros
  const geralByContract = useMemo(() => {
    const map = new Map<string, number>();
    for (const g of geral) {
      const key = g.ade || g.cod_contrato || '';
      if (key) map.set(key, (map.get(key) || 0) + (g.cms_rep || 0));
    }
    return map;
  }, [geral]);

  const repasseByContract = useMemo(() => {
    const map = new Map<string, number>();
    for (const r of repasse) {
      const key = r.ade || r.cod_contrato || '';
      if (key) map.set(key, (map.get(key) || 0) + (r.cms_rep_favorecido || 0));
    }
    return map;
  }, [repasse]);

  const seguroByAde = useMemo(() => {
    const map = new Map<string, number>();
    for (const s of seguros) {
      if (!s.descricao) continue;
      const desc = s.descricao.toUpperCase();
      // Extract ADE from description: "...ADE XXXXXXX-..."
      const adeMatch = desc.match(/ADE\s+(\d+)/);
      if (adeMatch) {
        const ade = adeMatch[1];
        map.set(ade, (map.get(ade) || 0) + (s.valor_comissao || 0));
      }
    }
    return map;
  }, [seguros]);

  const reportRows: ReportRow[] = useMemo(() => relatorio.map(r => {
    const contrato = r.num_contrato || '';
    const banco = (r.banco || '').toUpperCase();
    const produto = (r.produto || '').toUpperCase();
    const tabela = r.tabela || '';
    const valor = r.valor_liberado || 0;
    const prazo = r.prazo || 0;
    const seguro = r.seguro || 'Não';
    const dataPago = r.data_pago || null;

    // Mercantil: valor assegurado = valor / 0.7, else "Não é mercantil"
    const valorAssegurado = isMercantil(banco) ? Math.round(valor / 0.7 * 100) / 100 : 0;
    const valorCalc = isMercantil(banco) ? valorAssegurado : valor;

    // Lookup comissão recebida from Geral/Repasse/Seguros by contrato number
    const cmsGeral = geralByContract.get(contrato) || 0;
    const cmsRepasse = repasseByContract.get(contrato) || 0;
    const cmsSeguro = seguroByAde.get(contrato) || 0;
    const recebida = cmsGeral + cmsRepasse + cmsSeguro;

    // Calculate expected commission
    let esperadaClt = 0;
    let esperadaFgts = 0;
    const isProdFGTS = produto.includes('FGTS');

    if (isProdFGTS) {
      const tabelaChave = extractTableKeyFGTS(banco, tabela, seguro);
      // FGTS: Hub uses valor_liberado as range; others use prazo
      const isHub = banco.includes('HUB');
      const lookupValue = isHub ? valor : prazo;
      const rate = findFGTSRate(rulesFGTS, banco, lookupValue, tabelaChave, seguro, dataPago);
      // FGTS always multiplies by valor_liberado (never valor_assegurado)
      esperadaFgts = Math.round(valor * rate / 100 * 100) / 100;
    } else {
      const tabelaChave = extractTableKeyCLT(banco, tabela);
      esperadaClt = Math.round(valorCalc * findCLTRate(rulesCLT, banco, prazo, tabelaChave, seguro, dataPago) / 100 * 100) / 100;
    }
    const esperada = esperadaClt + esperadaFgts;

    return {
      num_contrato: contrato,
      nome: r.nome || '',
      banco,
      produto: isProdFGTS ? 'FGTS' : 'CLT',
      tabela,
      valor_liberado: valor,
      valor_assegurado: valorAssegurado,
      prazo,
      seguro,
      vendedor: r.vendedor || '',
      data_pago: dataPago || '',
      cms_geral: cmsGeral,
      cms_repasse: cmsRepasse,
      cms_seguro: cmsSeguro,
      comissao_recebida: recebida,
      esperada_clt: esperadaClt,
      esperada_fgts: esperadaFgts,
      comissao_esperada: esperada,
      diferenca: Math.round((recebida - esperada) * 100) / 100,
    };
  }), [relatorio, geralByContract, repasseByContract, seguroByAde, rulesFGTS, rulesCLT]);

  const filtered = useMemo(() => {
    let rows = divergenciasOnly ? reportRows.filter(r => Math.abs(r.diferenca) > 0.01) : reportRows;
    if (filterBanco) rows = rows.filter(r => r.banco === filterBanco);
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
  const bancos = useMemo(() => [...new Set(reportRows.map(r => r.banco))].sort(), [reportRows]);
  const totals = useMemo(() => ({
    recebida: filtered.reduce((s, r) => s + r.comissao_recebida, 0),
    esperada: filtered.reduce((s, r) => s + r.comissao_esperada, 0),
    diferenca: filtered.reduce((s, r) => s + r.diferenca, 0),
    liberado: filtered.reduce((s, r) => s + r.valor_liberado, 0),
    count: filtered.length,
  }), [filtered]);

  const handleExport = () => {
    const ws = XLSX.utils.json_to_sheet(sorted.map(r => ({
      'Data Pago': r.data_pago, 'Nº Contrato': r.num_contrato, Produto: r.produto,
      Banco: r.banco, Prazo: r.prazo, Tabela: r.tabela, 'Valor Lib.': r.valor_liberado,
      Seguro: r.seguro, Nome: r.nome, Vendedor: r.vendedor,
      'Vlr Assegurado': r.valor_assegurado || '',
      Comissão: r.cms_geral, 'CMS Repasse': r.cms_repasse, 'CMS Seguro': r.cms_seguro,
      Recebida: r.comissao_recebida, CLT: r.esperada_clt, FGTS: r.esperada_fgts,
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
  const emptyMsg = relatorio.length === 0
    ? 'Importe dados na aba "Relatório (Import)" primeiro.'
    : 'Importe dados nas abas Geral, Repasse e Seguros primeiro.';

  return (
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
        ) : relatorio.length === 0 ? (
          <p className="text-center text-muted-foreground py-8 text-sm">{emptyMsg}</p>
        ) : sorted.length === 0 ? (
          <p className="text-center text-muted-foreground py-8 text-sm">{divergenciasOnly ? 'Nenhuma divergência encontrada! 🎉' : 'Nenhum resultado para os filtros aplicados.'}</p>
        ) : (
          <div className="border rounded-lg max-h-[600px] overflow-auto">
          <TooltipProvider delayDuration={300}>
            <Table className="min-w-[1400px]">
              <TableHeader>
                <tr>
                  <TSHead label="Contrato" sortKey="num_contrato" sort={sort} toggle={toggleSort} tooltip="Nº do contrato / ADE" className="text-xs whitespace-nowrap" />
                  <TSHead label="Nome" sortKey="nome" sort={sort} toggle={toggleSort} tooltip="Nome do cliente" className="text-xs whitespace-nowrap" />
                  <TSHead label="Banco" sortKey="banco" sort={sort} toggle={toggleSort} tooltip="Banco do contrato" className="text-xs whitespace-nowrap" />
                  <TSHead label="Produto" sortKey="produto" sort={sort} toggle={toggleSort} tooltip="FGTS ou CLT" className="text-xs whitespace-nowrap" />
                  <TSHead label="Tabela" sortKey="tabela" sort={sort} toggle={toggleSort} tooltip="Nome da tabela do banco (essencial para regra)" className="text-xs whitespace-nowrap" />
                  <TSHead label="Valor Lib." sortKey="valor_liberado" sort={sort} toggle={toggleSort} tooltip="Valor liberado ao cliente" className="text-xs whitespace-nowrap text-right" />
                  <TSHead label="Seguro" sortKey="seguro" sort={sort} toggle={toggleSort} tooltip="Sim ou Não" className="text-xs whitespace-nowrap" />
                  <TSHead label="Vendedor" sortKey="vendedor" sort={sort} toggle={toggleSort} tooltip="Vendedor responsável" className="text-xs whitespace-nowrap" />
                  <TSHead label="Comissão" sortKey="cms_geral" sort={sort} toggle={toggleSort} tooltip="CMS da aba Geral" className="text-xs text-right whitespace-nowrap" />
                  <TSHead label="Repasse" sortKey="cms_repasse" sort={sort} toggle={toggleSort} tooltip="CMS da aba Repasse" className="text-xs text-right whitespace-nowrap" />
                  <TSHead label="Seguro$" sortKey="cms_seguro" sort={sort} toggle={toggleSort} tooltip="CMS da aba Seguros" className="text-xs text-right whitespace-nowrap" />
                  <TSHead label="Recebida" sortKey="comissao_recebida" sort={sort} toggle={toggleSort} tooltip="Soma: Comissão + Repasse + Seguro" className="text-xs whitespace-nowrap text-right" />
                  <TSHead label="Esperada" sortKey="comissao_esperada" sort={sort} toggle={toggleSort} tooltip="Calculada pelas regras FGTS/CLT" className="text-xs whitespace-nowrap text-right" />
                  <TSHead label="Diferença" sortKey="diferenca" sort={sort} toggle={toggleSort} tooltip="Recebida − Esperada" className="text-xs whitespace-nowrap text-right" />
                </tr>
              </TableHeader>
              <TableBody>
                {sorted.slice(0, 500).map((r, i) => (
                  <TableRow key={i} className={Math.abs(r.diferenca) > 0.01 ? 'bg-destructive/5' : ''}>
                    <TableCell className="text-xs font-mono">{r.num_contrato || '-'}</TableCell>
                    <TableCell className="text-xs max-w-[140px] truncate">{r.nome}</TableCell>
                    <TableCell className="text-xs">{r.banco}</TableCell>
                    <TableCell className="text-xs"><Badge variant={r.produto === 'FGTS' ? 'default' : 'secondary'} className="text-[10px]">{r.produto}</Badge></TableCell>
                    <TableCell className="text-xs max-w-[160px] truncate" title={r.tabela}>{r.tabela || '-'}</TableCell>
                    <TableCell className="text-xs text-right font-mono">{fmtBRL(r.valor_liberado)}</TableCell>
                    <TableCell className="text-xs">{r.seguro}</TableCell>
                    <TableCell className="text-xs max-w-[100px] truncate">{r.vendedor || '-'}</TableCell>
                    <TableCell className="text-xs text-right font-mono">{r.cms_geral ? fmtBRL(r.cms_geral) : '-'}</TableCell>
                    <TableCell className="text-xs text-right font-mono">{r.cms_repasse ? fmtBRL(r.cms_repasse) : '-'}</TableCell>
                    <TableCell className="text-xs text-right font-mono">{r.cms_seguro ? fmtBRL(r.cms_seguro) : '-'}</TableCell>
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
  );
}
