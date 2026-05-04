/**
 * NoneAuditTab — lista vendas V2 com rate_match_level = 'none' e diagnóstico
 * de por que cada filtro falhou (banco, prazo, tabela, valor, seguro, data).
 *
 * Útil para auditar rapidamente o que ainda falta cadastrar/ajustar nas taxas V2.
 */
import { useEffect, useMemo, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Loader2, RefreshCw, Download, AlertTriangle } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { extractTableKey } from '@/lib/commissionTriggerLogic';

interface SaleRow {
  id: string;
  sale_date: string;
  product: string;
  bank: string;
  table_name: string | null;
  term: number | null;
  released_value: number;
  has_insurance: boolean;
  client_name: string | null;
  client_cpf: string | null;
  seller_id: string;
  rate_match_level: string | null;
}

interface RateRow {
  effective_date: string;
  bank: string;
  table_key: string | null;
  term_min: number;
  term_max: number;
  min_value: number;
  max_value: number;
  has_insurance: boolean;
  rate: number;
}

interface DiagnosisFlag {
  ok: boolean;
  detail: string;
}

interface SaleDiagnosis {
  bank: DiagnosisFlag;
  date: DiagnosisFlag;
  insurance: DiagnosisFlag;
  term: DiagnosisFlag;
  value: DiagnosisFlag;
  tableKey: DiagnosisFlag;
  candidatesSameBank: number;
  suggestion: string;
}

const BANK_ALIASES: Record<string, string[]> = {
  'LOTUS MAIS': ['LOTUS', 'LOTUS MAIS'],
  'HUB CREDITO': ['HUB', 'HUB CREDITO'],
  'V8 BANK': ['V8', 'V8 BANK'],
};

function normBank(b: string): string[] {
  const u = (b || '').toUpperCase().trim();
  return BANK_ALIASES[u] || [u];
}

function diagnose(sale: SaleRow, rates: RateRow[]): SaleDiagnosis {
  const banks = normBank(sale.bank);
  const ins = !!sale.has_insurance;
  const saleDate = (sale.sale_date || '').slice(0, 10);
  let term = sale.term ?? 0;
  if (sale.product?.toUpperCase() === 'FGTS' && term >= 1 && term <= 5) term = term * 12;
  const value = Number(sale.released_value || 0);
  const tk = extractTableKey(sale.table_name ?? sale.bank);

  const sameBank = rates.filter(r => banks.includes((r.bank || '').toUpperCase().trim()));
  const sameBankIns = sameBank.filter(r => r.has_insurance === ins);
  const sameBankInsDate = sameBankIns.filter(r => r.effective_date.slice(0, 10) <= saleDate);
  const sameBankInsDateTerm = sameBankInsDate.filter(r => term >= r.term_min && term <= r.term_max);
  const sameBankInsDateTermValue = sameBankInsDateTerm.filter(r => value >= r.min_value && value <= r.max_value);
  const matchTk = tk
    ? sameBankInsDateTermValue.filter(r => r.table_key && r.table_key.toUpperCase() === tk)
    : [];

  const bankFlag: DiagnosisFlag = sameBank.length > 0
    ? { ok: true, detail: `${sameBank.length} taxa(s) p/ ${banks.join('/')}` }
    : { ok: false, detail: `Nenhuma taxa cadastrada p/ "${sale.bank}" (aliases: ${banks.join(', ')})` };

  const insFlag: DiagnosisFlag = sameBankIns.length > 0
    ? { ok: true, detail: `seguro=${ins ? 'sim' : 'não'} OK` }
    : { ok: false, detail: `Nenhuma taxa com seguro=${ins ? 'sim' : 'não'} p/ banco` };

  const dateFlag: DiagnosisFlag = sameBankInsDate.length > 0
    ? { ok: true, detail: `vigência ≤ ${saleDate} OK (${sameBankInsDate.length})` }
    : { ok: false, detail: `Nenhuma vigência ≤ ${saleDate} (taxas começam após a venda)` };

  const termFlag: DiagnosisFlag = sameBankInsDateTerm.length > 0
    ? { ok: true, detail: `prazo ${term} cabe em alguma faixa` }
    : { ok: false, detail: `Prazo ${term}m fora de todas as faixas (${sameBankInsDate.map(r => `${r.term_min}-${r.term_max}`).slice(0, 3).join(', ') || 'n/d'})` };

  const valueFlag: DiagnosisFlag = sameBankInsDateTermValue.length > 0
    ? { ok: true, detail: `valor R$ ${value.toFixed(2)} cabe` }
    : { ok: false, detail: `Valor R$ ${value.toFixed(2)} fora das faixas` };

  const tkFlag: DiagnosisFlag = !tk
    ? { ok: true, detail: 'sem table_key (genérico)' }
    : matchTk.length > 0
      ? { ok: true, detail: `table_key "${tk}" OK` }
      : { ok: false, detail: `table_key "${tk}" não existe (cadastradas: ${[...new Set(sameBankInsDate.map(r => r.table_key).filter(Boolean))].slice(0, 4).join(', ') || 'nenhuma'})` };

  // Sugestão prioritária
  let suggestion = '';
  if (!bankFlag.ok) suggestion = `Cadastrar taxa para banco "${sale.bank}".`;
  else if (!insFlag.ok) suggestion = `Cadastrar variante com seguro=${ins ? 'sim' : 'não'}.`;
  else if (!dateFlag.ok) suggestion = `Adicionar vigência anterior a ${saleDate}.`;
  else if (!termFlag.ok) suggestion = `Ampliar faixa de prazo para incluir ${term} meses.`;
  else if (!valueFlag.ok) suggestion = `Ampliar faixa de valor para R$ ${value.toFixed(2)}.`;
  else if (!tkFlag.ok) suggestion = `Cadastrar tabela "${tk}" ou ajustar nome na venda.`;
  else suggestion = 'Inspecionar manualmente — todos os filtros passam isoladamente.';

  return {
    bank: bankFlag, date: dateFlag, insurance: insFlag,
    term: termFlag, value: valueFlag, tableKey: tkFlag,
    candidatesSameBank: sameBank.length, suggestion,
  };
}

function FlagBadge({ f, label }: { f: DiagnosisFlag; label: string }) {
  return (
    <Badge variant={f.ok ? 'secondary' : 'destructive'} className="text-[10px] font-normal" title={f.detail}>
      {f.ok ? '✓' : '✗'} {label}
    </Badge>
  );
}

interface Props {
  getSellerName: (id: string) => string;
}

export default function NoneAuditTab({ getSellerName }: Props) {
  const [loading, setLoading] = useState(false);
  const [sales, setSales] = useState<SaleRow[]>([]);
  const [ratesFgts, setRatesFgts] = useState<RateRow[]>([]);
  const [ratesClt, setRatesClt] = useState<RateRow[]>([]);
  const [search, setSearch] = useState('');

  const load = async () => {
    setLoading(true);
    try {
      const [salesRes, fgtsRes, cltRes] = await Promise.all([
        supabase.from('commission_sales_v2')
          .select('id, sale_date, product, bank, table_name, term, released_value, has_insurance, client_name, client_cpf, seller_id, rate_match_level')
          .or('rate_match_level.eq.none,rate_match_level.is.null')
          .order('sale_date', { ascending: false })
          .limit(2000),
        supabase.from('commission_rates_fgts_v2').select('effective_date, bank, table_key, term_min, term_max, min_value, max_value, has_insurance, rate'),
        supabase.from('commission_rates_clt_v2').select('effective_date, bank, table_key, term_min, term_max, min_value, max_value, has_insurance, rate'),
      ]);
      setSales((salesRes.data || []) as SaleRow[]);
      setRatesFgts((fgtsRes.data || []) as RateRow[]);
      setRatesClt((cltRes.data || []) as RateRow[]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const enriched = useMemo(() => {
    return sales
      .map(s => {
        const rates = (s.product || '').toUpperCase() === 'FGTS' ? ratesFgts : ratesClt;
        return { sale: s, diag: diagnose(s, rates) };
      });
  }, [sales, ratesFgts, ratesClt]);

  const filtered = useMemo(() => {
    const q = search.toLowerCase().trim();
    if (!q) return enriched;
    return enriched.filter(({ sale }) =>
      [sale.bank, sale.table_name, sale.client_name, sale.client_cpf, getSellerName(sale.seller_id)]
        .filter(Boolean).join(' ').toLowerCase().includes(q),
    );
  }, [enriched, search, getSellerName]);

  const exportCsv = () => {
    const headers = ['Data', 'Vendedor', 'Produto', 'Banco', 'Tabela', 'Prazo', 'Valor', 'Seguro', 'Cliente', 'CPF', 'Banco_OK', 'Seguro_OK', 'Data_OK', 'Prazo_OK', 'Valor_OK', 'TableKey_OK', 'Sugestão'];
    const rows = filtered.map(({ sale, diag }) => [
      sale.sale_date.slice(0, 10),
      getSellerName(sale.seller_id),
      sale.product,
      sale.bank,
      sale.table_name || '',
      sale.term ?? '',
      sale.released_value,
      sale.has_insurance ? 'Sim' : 'Não',
      sale.client_name || '',
      sale.client_cpf || '',
      diag.bank.ok ? 'OK' : diag.bank.detail,
      diag.insurance.ok ? 'OK' : diag.insurance.detail,
      diag.date.ok ? 'OK' : diag.date.detail,
      diag.term.ok ? 'OK' : diag.term.detail,
      diag.value.ok ? 'OK' : diag.value.detail,
      diag.tableKey.ok ? 'OK' : diag.tableKey.detail,
      diag.suggestion,
    ]);
    const csv = [headers, ...rows].map(r => r.map(c => `"${String(c).replace(/"/g, '""')}"`).join(',')).join('\n');
    const blob = new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = `v2-none-audit-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click(); URL.revokeObjectURL(url);
  };

  const summary = useMemo(() => {
    const total = filtered.length;
    const noBank = filtered.filter(x => !x.diag.bank.ok).length;
    const noIns = filtered.filter(x => x.diag.bank.ok && !x.diag.insurance.ok).length;
    const noDate = filtered.filter(x => x.diag.bank.ok && x.diag.insurance.ok && !x.diag.date.ok).length;
    const noTerm = filtered.filter(x => x.diag.bank.ok && x.diag.insurance.ok && x.diag.date.ok && !x.diag.term.ok).length;
    const noValue = filtered.filter(x => x.diag.term.ok && !x.diag.value.ok).length;
    const noTk = filtered.filter(x => x.diag.value.ok && !x.diag.tableKey.ok).length;
    return { total, noBank, noIns, noDate, noTerm, noValue, noTk };
  }, [filtered]);

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between flex-wrap gap-2">
          <CardTitle className="flex items-center gap-2">
            <AlertTriangle className="w-5 h-5 text-amber-500" />
            Vendas V2 sem taxa (none) — Auditoria
          </CardTitle>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={load} disabled={loading}>
              {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
              Recarregar
            </Button>
            <Button variant="outline" size="sm" onClick={exportCsv} disabled={!filtered.length}>
              <Download className="w-4 h-4" /> CSV
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-2 md:grid-cols-7 gap-2 text-sm">
          <div className="rounded border p-2"><div className="text-muted-foreground text-xs">Total none</div><div className="font-bold">{summary.total}</div></div>
          <div className="rounded border p-2"><div className="text-muted-foreground text-xs">Banco ✗</div><div className="font-bold text-destructive">{summary.noBank}</div></div>
          <div className="rounded border p-2"><div className="text-muted-foreground text-xs">Seguro ✗</div><div className="font-bold text-destructive">{summary.noIns}</div></div>
          <div className="rounded border p-2"><div className="text-muted-foreground text-xs">Vigência ✗</div><div className="font-bold text-destructive">{summary.noDate}</div></div>
          <div className="rounded border p-2"><div className="text-muted-foreground text-xs">Prazo ✗</div><div className="font-bold text-destructive">{summary.noTerm}</div></div>
          <div className="rounded border p-2"><div className="text-muted-foreground text-xs">Valor ✗</div><div className="font-bold text-destructive">{summary.noValue}</div></div>
          <div className="rounded border p-2"><div className="text-muted-foreground text-xs">Tabela ✗</div><div className="font-bold text-destructive">{summary.noTk}</div></div>
        </div>

        <Input
          placeholder="Filtrar por banco, tabela, cliente, CPF, vendedor..."
          value={search}
          onChange={e => setSearch(e.target.value)}
        />

        <div className="rounded border overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Data</TableHead>
                <TableHead>Vendedor</TableHead>
                <TableHead>Produto</TableHead>
                <TableHead>Banco</TableHead>
                <TableHead>Tabela</TableHead>
                <TableHead className="text-right">Prazo</TableHead>
                <TableHead className="text-right">Valor</TableHead>
                <TableHead>Seguro</TableHead>
                <TableHead>Diagnóstico</TableHead>
                <TableHead>Sugestão</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading && (
                <TableRow><TableCell colSpan={10} className="text-center py-8"><Loader2 className="w-5 h-5 animate-spin mx-auto" /></TableCell></TableRow>
              )}
              {!loading && !filtered.length && (
                <TableRow><TableCell colSpan={10} className="text-center py-8 text-muted-foreground">Nenhuma venda none encontrada 🎉</TableCell></TableRow>
              )}
              {!loading && filtered.map(({ sale, diag }) => (
                <TableRow key={sale.id}>
                  <TableCell className="text-xs">{sale.sale_date.slice(0, 10)}</TableCell>
                  <TableCell className="text-xs">{getSellerName(sale.seller_id)}</TableCell>
                  <TableCell className="text-xs">{sale.product}</TableCell>
                  <TableCell className="text-xs font-medium">{sale.bank}</TableCell>
                  <TableCell className="text-xs max-w-[180px] truncate" title={sale.table_name || ''}>{sale.table_name || '—'}</TableCell>
                  <TableCell className="text-xs text-right">{sale.term ?? '—'}</TableCell>
                  <TableCell className="text-xs text-right">R$ {Number(sale.released_value).toFixed(2)}</TableCell>
                  <TableCell className="text-xs">{sale.has_insurance ? 'Sim' : 'Não'}</TableCell>
                  <TableCell>
                    <div className="flex flex-wrap gap-1">
                      <FlagBadge f={diag.bank} label="banco" />
                      <FlagBadge f={diag.insurance} label="seg" />
                      <FlagBadge f={diag.date} label="data" />
                      <FlagBadge f={diag.term} label="prazo" />
                      <FlagBadge f={diag.value} label="valor" />
                      <FlagBadge f={diag.tableKey} label="tabela" />
                    </div>
                  </TableCell>
                  <TableCell className="text-xs max-w-[260px]">{diag.suggestion}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  );
}
