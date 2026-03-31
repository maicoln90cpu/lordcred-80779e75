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

// ==================== TYPES ====================
interface GeralRow { id: string; ade: string | null; cod_contrato: string | null; cpf: string | null; nome_cliente: string | null; banco: string | null; prod_liq: number | null; prazo: number | null; tipo_operacao: string | null; convenio: string | null; cms_rep: number | null; data_pgt_cliente: string | null; }
interface RepasseRow { id: string; ade: string | null; cod_contrato: string | null; cms_rep_favorecido: number | null; }
interface SeguroRow { id: string; descricao: string | null; valor_comissao: number | null; }
interface RuleFGTS { banco: string; tabela_chave: string; seguro: string; min_valor: number; max_valor: number; taxa: number; data_vigencia: string; }
interface RuleCLT { banco: string; tabela_chave: string; seguro: string; prazo_min: number; prazo_max: number; taxa: number; data_vigencia: string; }

interface ReportRow {
  ade: string; cod_contrato: string; cpf: string; nome: string; banco: string; produto: string;
  valor_liberado: number; prazo: number; cms_geral: number; cms_repasse: number; cms_seguro: number;
  comissao_recebida: number; comissao_esperada: number; diferenca: number;
}

// ==================== CALCULATION ENGINE ====================
function identifyProduct(tipo: string | null, convenio: string | null): string {
  const t = (tipo || '').toUpperCase(); const c = (convenio || '').toUpperCase();
  if (t.includes('FGTS') || c.includes('FGTS')) return 'FGTS'; return 'CLT';
}
function hasInsurance(convenio: string | null): boolean {
  const c = (convenio || '').toUpperCase();
  return c.includes('SEGURO') || c.includes('COM SEG') || c.includes('C/SEG');
}
function extractTableKey(convenio: string | null): string { return (convenio || '*').trim(); }

function findFGTSRate(rules: RuleFGTS[], banco: string, valor: number, tabela: string, temSeguro: boolean, dataPgt: string | null): number {
  const b = banco.toUpperCase(); const dt = dataPgt ? dataPgt.slice(0, 10) : '9999-12-31';
  const candidates = rules.filter(r => r.banco.toUpperCase() === b && r.data_vigencia <= dt).sort((a, b2) => b2.data_vigencia.localeCompare(a.data_vigencia));
  for (const r of candidates) {
    if ((r.tabela_chave === '*' || tabela.toUpperCase().includes(r.tabela_chave.toUpperCase())) &&
        (r.seguro === 'Ambos' || (r.seguro === 'Sim' && temSeguro) || (r.seguro === 'Não' && !temSeguro)) &&
        valor >= r.min_valor && valor <= r.max_valor) return r.taxa;
  }
  return 0;
}
function findCLTRate(rules: RuleCLT[], banco: string, prazo: number, tabela: string, temSeguro: boolean, dataPgt: string | null): number {
  const b = banco.toUpperCase(); const dt = dataPgt ? dataPgt.slice(0, 10) : '9999-12-31';
  const candidates = rules.filter(r => r.banco.toUpperCase() === b && r.data_vigencia <= dt).sort((a, b2) => b2.data_vigencia.localeCompare(a.data_vigencia));
  for (const r of candidates) {
    if ((r.tabela_chave === '*' || tabela.toUpperCase().includes(r.tabela_chave.toUpperCase())) &&
        (r.seguro === 'Ambos' || (r.seguro === 'Sim' && temSeguro) || (r.seguro === 'Não' && !temSeguro)) &&
        prazo >= r.prazo_min && prazo <= r.prazo_max) return r.taxa;
  }
  return 0;
}

const fmtBRL = (v: number) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

// ==================== COMPONENT ====================
interface CRRelatorioProps { divergenciasOnly?: boolean; }

export default function CRRelatorio({ divergenciasOnly = false }: CRRelatorioProps) {
  const [search, setSearch] = useState('');
  const { sort, toggle: toggleSort } = useSortState();
  const [filterBanco, setFilterBanco] = useState('');

  const { data: geral = [], isLoading: l1 } = useQuery({ queryKey: ['cr-geral-report'], queryFn: async () => { const { data } = await supabase.from('cr_geral').select('id, ade, cod_contrato, cpf, nome_cliente, banco, prod_liq, prazo, tipo_operacao, convenio, cms_rep, data_pgt_cliente').limit(5000); return (data || []) as GeralRow[]; } });
  const { data: repasse = [], isLoading: l2 } = useQuery({ queryKey: ['cr-repasse-report'], queryFn: async () => { const { data } = await supabase.from('cr_repasse').select('id, ade, cod_contrato, cms_rep_favorecido').limit(5000); return (data || []) as RepasseRow[]; } });
  const { data: seguros = [], isLoading: l3 } = useQuery({ queryKey: ['cr-seguros-report'], queryFn: async () => { const { data } = await supabase.from('cr_seguros').select('id, descricao, valor_comissao').limit(5000); return (data || []) as SeguroRow[]; } });
  const { data: rulesFGTS = [], isLoading: l4 } = useQuery({ queryKey: ['cr-rules-fgts'], queryFn: async () => { const { data } = await supabase.from('cr_rules_fgts').select('*').order('data_vigencia', { ascending: false }); return (data || []) as RuleFGTS[]; } });
  const { data: rulesCLT = [], isLoading: l5 } = useQuery({ queryKey: ['cr-rules-clt'], queryFn: async () => { const { data } = await supabase.from('cr_rules_clt').select('*').order('data_vigencia', { ascending: false }); return (data || []) as RuleCLT[]; } });
  const isLoading = l1 || l2 || l3 || l4 || l5;

  const repasseByAde = useMemo(() => { const map = new Map<string, number>(); for (const r of repasse) if (r.ade) map.set(r.ade, (map.get(r.ade) || 0) + (r.cms_rep_favorecido || 0)); return map; }, [repasse]);
  const seguroByAde = useMemo(() => { const map = new Map<string, number>(); for (const s of seguros) if (s.descricao) { const desc = s.descricao.toUpperCase(); for (const g of geral) if (g.ade && desc.includes(g.ade.toUpperCase())) map.set(g.ade, (map.get(g.ade) || 0) + (s.valor_comissao || 0)); } return map; }, [seguros, geral]);

  const reportRows: ReportRow[] = useMemo(() => geral.map(g => {
    const ade = g.ade || ''; const banco = (g.banco || '').toUpperCase(); const valor = g.prod_liq || 0; const prazo = g.prazo || 0;
    const produto = identifyProduct(g.tipo_operacao, g.convenio); const temSeguro = hasInsurance(g.convenio); const tabela = extractTableKey(g.convenio);
    const valorCalc = banco === 'MERCANTIL' ? valor / 0.7 : valor;
    const cmsGeral = g.cms_rep || 0; const cmsRepasse = repasseByAde.get(ade) || 0; const cmsSeguro = seguroByAde.get(ade) || 0;
    const recebida = cmsGeral + cmsRepasse + cmsSeguro;
    let esperada = 0;
    if (produto === 'FGTS') { esperada = Math.round(valorCalc * findFGTSRate(rulesFGTS, banco, valorCalc, tabela, temSeguro, g.data_pgt_cliente) / 100 * 100) / 100; }
    else { esperada = Math.round(valorCalc * findCLTRate(rulesCLT, banco, prazo, tabela, temSeguro, g.data_pgt_cliente) / 100 * 100) / 100; }
    return { ade, cod_contrato: g.cod_contrato || '', cpf: g.cpf || '', nome: g.nome_cliente || '', banco, produto, valor_liberado: valor, prazo, cms_geral: cmsGeral, cms_repasse: cmsRepasse, cms_seguro: cmsSeguro, comissao_recebida: recebida, comissao_esperada: esperada, diferenca: Math.round((recebida - esperada) * 100) / 100 };
  }), [geral, repasseByAde, seguroByAde, rulesFGTS, rulesCLT]);

  const filtered = useMemo(() => {
    let rows = divergenciasOnly ? reportRows.filter(r => Math.abs(r.diferenca) > 0.01) : reportRows;
    if (filterBanco) rows = rows.filter(r => r.banco === filterBanco);
    if (search) { const q = search.toLowerCase(); rows = rows.filter(r => r.ade.toLowerCase().includes(q) || r.nome.toLowerCase().includes(q) || r.cpf.includes(q) || r.cod_contrato.toLowerCase().includes(q)); }
    return rows;
  }, [reportRows, divergenciasOnly, filterBanco, search]);

  const sorted = applySortToData(filtered, sort);
  const bancos = useMemo(() => [...new Set(reportRows.map(r => r.banco))].sort(), [reportRows]);
  const totals = useMemo(() => ({ recebida: filtered.reduce((s, r) => s + r.comissao_recebida, 0), esperada: filtered.reduce((s, r) => s + r.comissao_esperada, 0), diferenca: filtered.reduce((s, r) => s + r.diferenca, 0), count: filtered.length }), [filtered]);

  const handleExport = () => {
    const ws = XLSX.utils.json_to_sheet(sorted.map(r => ({ ADE: r.ade, Contrato: r.cod_contrato, CPF: r.cpf, Nome: r.nome, Banco: r.banco, Produto: r.produto, 'Valor Lib.': r.valor_liberado, Prazo: r.prazo, 'CMS Geral': r.cms_geral, 'CMS Repasse': r.cms_repasse, 'CMS Seguro': r.cms_seguro, 'Recebida': r.comissao_recebida, 'Esperada': r.comissao_esperada, 'Diferença': r.diferenca })));
    const wb = XLSX.utils.book_new(); XLSX.utils.book_append_sheet(wb, ws, divergenciasOnly ? 'Divergências' : 'Relatório');
    XLSX.writeFile(wb, divergenciasOnly ? 'divergencias.xlsx' : 'relatorio_comissoes.xlsx');
  };

  const title = divergenciasOnly ? 'Divergências' : 'Relatório de Comissões';
  const desc = divergenciasOnly ? 'Contratos com diferença entre comissão recebida e esperada.' : 'Cruzamento automático: Geral + Repasse + Seguros + Regras → Comissão Esperada vs Recebida.';

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
            <TipWrap tip="Soma de CMS Geral + Repasse + Seguro"><Badge variant="secondary" className="text-xs">Recebida: {fmtBRL(totals.recebida)}</Badge></TipWrap>
            <TipWrap tip="Calculada pelas regras FGTS/CLT cadastradas"><Badge variant="secondary" className="text-xs">Esperada: {fmtBRL(totals.esperada)}</Badge></TipWrap>
            <TipWrap tip="Recebida − Esperada (positivo = recebeu mais)"><Badge variant={totals.diferenca >= 0 ? 'default' : 'destructive'} className="text-xs">Δ {fmtBRL(totals.diferenca)}</Badge></TipWrap>
          </div>
        </div>
        <div className="flex items-center gap-2 pt-2">
          <div className="relative"><Search className="absolute left-2.5 top-2.5 w-4 h-4 text-muted-foreground" /><Input placeholder="Buscar ADE, nome, CPF..." value={search} onChange={e => setSearch(e.target.value)} className="pl-8 w-56 h-9" /></div>
          <select value={filterBanco} onChange={e => setFilterBanco(e.target.value)} className="h-9 rounded-md border border-input bg-background px-3 text-sm">
            <option value="">Todos os bancos</option>
            {bancos.map(b => <option key={b} value={b}>{b}</option>)}
          </select>
          <Button variant="outline" size="sm" onClick={handleExport} disabled={sorted.length === 0}><Download className="w-4 h-4 mr-1" /> Exportar</Button>
        </div>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="flex justify-center py-8"><Loader2 className="w-6 h-6 animate-spin text-muted-foreground" /></div>
        ) : geral.length === 0 ? (
          <p className="text-center text-muted-foreground py-8 text-sm">Importe dados nas abas Geral, Repasse e Seguros primeiro.</p>
        ) : sorted.length === 0 ? (
          <p className="text-center text-muted-foreground py-8 text-sm">{divergenciasOnly ? 'Nenhuma divergência encontrada! 🎉' : 'Nenhum resultado para os filtros aplicados.'}</p>
        ) : (
          <div className="border rounded-lg max-h-[600px] overflow-auto">
            <Table>
              <TableHeader>
                <tr>
                  <TSHead label="ADE" sortKey="ade" sort={sort} toggle={toggleSort} tooltip={TOOLTIPS_RELATORIO.ade} className="text-xs whitespace-nowrap" />
                  <TSHead label="Nome" sortKey="nome" sort={sort} toggle={toggleSort} tooltip={TOOLTIPS_RELATORIO.nome} className="text-xs whitespace-nowrap" />
                  <TSHead label="Banco" sortKey="banco" sort={sort} toggle={toggleSort} tooltip={TOOLTIPS_RELATORIO.banco} className="text-xs whitespace-nowrap" />
                  <TSHead label="Produto" sortKey="produto" sort={sort} toggle={toggleSort} tooltip={TOOLTIPS_RELATORIO.produto} className="text-xs whitespace-nowrap" />
                  <TSHead label="Valor Lib." sortKey="valor_liberado" sort={sort} toggle={toggleSort} tooltip={TOOLTIPS_RELATORIO.valor_liberado} className="text-xs whitespace-nowrap text-right" />
                  <TSHead label="CMS Geral" sortKey="cms_geral" sort={sort} toggle={toggleSort} tooltip={TOOLTIPS_RELATORIO.cms_geral} className="text-xs text-right whitespace-nowrap" />
                  <TSHead label="CMS Rep." sortKey="cms_repasse" sort={sort} toggle={toggleSort} tooltip={TOOLTIPS_RELATORIO.cms_repasse} className="text-xs text-right whitespace-nowrap" />
                  <TSHead label="CMS Seg." sortKey="cms_seguro" sort={sort} toggle={toggleSort} tooltip={TOOLTIPS_RELATORIO.cms_seguro} className="text-xs text-right whitespace-nowrap" />
                  <TSHead label="Recebida" sortKey="comissao_recebida" sort={sort} toggle={toggleSort} tooltip={TOOLTIPS_RELATORIO.comissao_recebida} className="text-xs whitespace-nowrap text-right" />
                  <TSHead label="Esperada" sortKey="comissao_esperada" sort={sort} toggle={toggleSort} tooltip={TOOLTIPS_RELATORIO.comissao_esperada} className="text-xs whitespace-nowrap text-right" />
                  <TSHead label="Diferença" sortKey="diferenca" sort={sort} toggle={toggleSort} tooltip={TOOLTIPS_RELATORIO.diferenca} className="text-xs whitespace-nowrap text-right" />
                </tr>
              </TableHeader>
              <TableBody>
                {sorted.slice(0, 500).map((r, i) => (
                  <TableRow key={i} className={Math.abs(r.diferenca) > 0.01 ? 'bg-destructive/5' : ''}>
                    <TableCell className="text-xs font-mono">{r.ade || '-'}</TableCell>
                    <TableCell className="text-xs max-w-[150px] truncate">{r.nome}</TableCell>
                    <TableCell className="text-xs">{r.banco}</TableCell>
                    <TableCell className="text-xs"><Badge variant={r.produto === 'FGTS' ? 'default' : 'secondary'} className="text-[10px]">{r.produto}</Badge></TableCell>
                    <TableCell className="text-xs text-right font-mono">{fmtBRL(r.valor_liberado)}</TableCell>
                    <TableCell className="text-xs text-right font-mono">{fmtBRL(r.cms_geral)}</TableCell>
                    <TableCell className="text-xs text-right font-mono">{fmtBRL(r.cms_repasse)}</TableCell>
                    <TableCell className="text-xs text-right font-mono">{fmtBRL(r.cms_seguro)}</TableCell>
                    <TableCell className="text-xs text-right font-mono">{fmtBRL(r.comissao_recebida)}</TableCell>
                    <TableCell className="text-xs text-right font-mono">{fmtBRL(r.comissao_esperada)}</TableCell>
                    <TableCell className={`text-xs text-right font-mono font-bold ${r.diferenca > 0.01 ? 'text-green-600' : r.diferenca < -0.01 ? 'text-destructive' : ''}`}>{fmtBRL(r.diferenca)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
            {sorted.length > 500 && <p className="text-center text-xs text-muted-foreground py-2">Mostrando 500 de {sorted.length}...</p>}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
