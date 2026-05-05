import { useState, useEffect, useMemo, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea, ScrollBar } from '@/components/ui/scroll-area';
import { Loader2, FileText, Download, Search } from 'lucide-react';
import { ArrowUpDown, ArrowUp, ArrowDown } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { useTableState } from '@/hooks/useTableState';
import { TablePagination } from '@/components/common/TablePagination';

interface SnapshotRow {
  id: string;
  proposta_id: string | null;
  cpf: string | null;
  nome: string | null;
  banco: string | null;
  produto: string | null;
  status: string | null;
  valor_liberado: number | null;
  valor_parcela: number | null;
  prazo: string | null;
  vendedor_nome: string | null;
  data_cadastro: string | null;
  convenio: string | null;
  snapshot_date: string;
  updated_at: string | null;
}

interface CachedAsset {
  asset_id: string;
  asset_label: string;
}

const fmtBRL = (v: number | null) => v != null ? `R$ ${Number(v).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}` : '—';

const PERIOD_OPTIONS = [
  { value: '7', label: 'Últimos 7 dias' },
  { value: '30', label: 'Últimos 30 dias' },
  { value: '60', label: 'Últimos 60 dias' },
  { value: '90', label: 'Últimos 90 dias' },
  { value: 'all', label: 'Todos' },
];

export function CorbanReportTab() {
  const [rows, setRows] = useState<SnapshotRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState('');
  const [bancoFilter, setBancoFilter] = useState('');
  const [vendedorFilter, setVendedorFilter] = useState('');
  const [periodFilter, setPeriodFilter] = useState('30');
  const [searchText, setSearchText] = useState('');
  const [cachedStatus, setCachedStatus] = useState<CachedAsset[]>([]);
  const table = useTableState<SnapshotRow>({
    pageSize: 50,
    resetPageOn: [statusFilter, bancoFilter, vendedorFilter, searchText, periodFilter],
  });
  const { sort, toggleSort, page, setPage } = table;

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      let query = supabase
        .from('corban_propostas_snapshot')
        .select('id, proposta_id, cpf, nome, banco, produto, status, valor_liberado, valor_parcela, prazo, vendedor_nome, data_cadastro, convenio, snapshot_date, updated_at')
        .order('snapshot_date', { ascending: false });

      if (periodFilter !== 'all') {
        const daysAgo = new Date();
        daysAgo.setDate(daysAgo.getDate() - parseInt(periodFilter));
        query = query.gte('snapshot_date', daysAgo.toISOString());
      }

      // Batch fetch to avoid 1000-row limit
      let allData: SnapshotRow[] = [];
      let from = 0;
      const batchSize = 1000;
      while (true) {
        const { data, error } = await query.range(from, from + batchSize - 1);
        if (error) throw error;
        if (!data || data.length === 0) break;
        allData = allData.concat(data as SnapshotRow[]);
        if (data.length < batchSize) break;
        from += batchSize;
      }

      setRows(allData);
    } catch (err: any) {
      toast.error('Erro ao carregar registros', { description: err.message });
    } finally {
      setLoading(false);
    }
  }, [periodFilter]);

  useEffect(() => { fetchData(); }, [fetchData]);

  useEffect(() => {
    supabase.from('corban_assets_cache').select('asset_id, asset_label').eq('asset_type', 'status').order('asset_label')
      .then(({ data }) => setCachedStatus(data || []));
  }, []);

  const resolveStatus = (key: string | null) => {
    if (!key) return '—';
    return cachedStatus.find(s => s.asset_id === key)?.asset_label || key;
  };

  // Unique values for filters
  const uniqueStatus = useMemo(() => [...new Set(rows.map(r => r.status).filter(Boolean))].sort() as string[], [rows]);
  const uniqueBancos = useMemo(() => [...new Set(rows.map(r => r.banco).filter(Boolean))].sort() as string[], [rows]);
  const uniqueVendedores = useMemo(() => [...new Set(rows.map(r => r.vendedor_nome).filter(Boolean))].sort() as string[], [rows]);

  const filtered = useMemo(() => {
    let result = rows;
    if (statusFilter) result = result.filter(r => r.status === statusFilter);
    if (bancoFilter) result = result.filter(r => r.banco === bancoFilter);
    if (vendedorFilter) result = result.filter(r => r.vendedor_nome === vendedorFilter);
    if (searchText.trim()) {
      const term = searchText.toLowerCase();
      result = result.filter(r =>
        (r.nome || '').toLowerCase().includes(term) ||
        (r.cpf || '').includes(term) ||
        (r.proposta_id || '').toLowerCase().includes(term)
      );
    }
    return result;
  }, [rows, statusFilter, bancoFilter, vendedorFilter, searchText]);

  const { sorted, paged, totalPages } = table.apply(filtered);

  const handleExportXlsx = async () => {
    try {
      const XLSX = await import('xlsx');
      const exportData = sorted.map(r => ({
        'ID Proposta': r.proposta_id || '',
        'CPF': r.cpf || '',
        'Nome': r.nome || '',
        'Banco': r.banco || '',
        'Produto': r.produto || '',
        'Status': resolveStatus(r.status),
        'Valor Liberado': r.valor_liberado || 0,
        'Parcela': r.valor_parcela || 0,
        'Prazo': r.prazo || '',
        'Vendedor': r.vendedor_nome || '',
        'Data Cadastro': r.data_cadastro || '',
        'Convênio': r.convenio || '',
        'Data Snapshot': r.snapshot_date ? new Date(r.snapshot_date).toLocaleDateString('pt-BR') : '',
      }));
      const ws = XLSX.utils.json_to_sheet(exportData);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, 'Relatório');
      XLSX.writeFile(wb, `corban_relatorio_${new Date().toISOString().slice(0, 10)}.xlsx`);
      toast.success('XLSX exportado com sucesso!');
    } catch (err: any) {
      toast.error('Erro ao exportar', { description: err.message });
    }
  };

  const columns: { key: keyof SnapshotRow; label: string; format?: 'brl' | 'status' | 'date' }[] = [
    { key: 'cpf', label: 'CPF' },
    { key: 'nome', label: 'Nome' },
    { key: 'banco', label: 'Banco' },
    { key: 'produto', label: 'Produto' },
    { key: 'status', label: 'Status', format: 'status' },
    { key: 'valor_liberado', label: 'Valor Lib.', format: 'brl' },
    { key: 'valor_parcela', label: 'Parcela', format: 'brl' },
    { key: 'prazo', label: 'Prazo' },
    { key: 'vendedor_nome', label: 'Vendedor' },
    { key: 'data_cadastro', label: 'Data Cadastro' },
    { key: 'convenio', label: 'Convênio' },
    { key: 'snapshot_date', label: 'Snapshot', format: 'date' },
  ];

  const formatCell = (col: typeof columns[0], row: SnapshotRow) => {
    const v = row[col.key];
    if (v == null || v === '') return '—';
    if (col.format === 'brl') return fmtBRL(v as number);
    if (col.format === 'status') return <Badge variant="outline" className="text-xs">{resolveStatus(v as string)}</Badge>;
    if (col.format === 'date') return new Date(v as string).toLocaleDateString('pt-BR');
    return String(v);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
        <span className="ml-2 text-muted-foreground">Carregando registros...</span>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Filters */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Filtros</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-3 items-end">
            <div className="space-y-1">
              <label className="text-xs text-muted-foreground">Buscar (Nome/CPF/ID)</label>
              <div className="relative">
                <Search className="absolute left-2 top-2.5 w-3.5 h-3.5 text-muted-foreground" />
                <Input
                  placeholder="Buscar..."
                  value={searchText}
                  onChange={e => setSearchText(e.target.value)}
                  className="w-48 pl-7"
                />
              </div>
            </div>

            <div className="space-y-1">
              <label className="text-xs text-muted-foreground">Status</label>
              <Select value={statusFilter} onValueChange={v => setStatusFilter(v === '__all__' ? '' : v)}>
                <SelectTrigger className="w-44"><SelectValue placeholder="Todos" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="__all__">Todos</SelectItem>
                  {uniqueStatus.map(s => (
                    <SelectItem key={s} value={s}>{resolveStatus(s)}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1">
              <label className="text-xs text-muted-foreground">Banco</label>
              <Select value={bancoFilter} onValueChange={v => setBancoFilter(v === '__all__' ? '' : v)}>
                <SelectTrigger className="w-44"><SelectValue placeholder="Todos" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="__all__">Todos</SelectItem>
                  {uniqueBancos.map(b => (
                    <SelectItem key={b} value={b}>{b}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1">
              <label className="text-xs text-muted-foreground">Vendedor</label>
              <Select value={vendedorFilter} onValueChange={v => setVendedorFilter(v === '__all__' ? '' : v)}>
                <SelectTrigger className="w-44"><SelectValue placeholder="Todos" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="__all__">Todos</SelectItem>
                  {uniqueVendedores.map(v => (
                    <SelectItem key={v} value={v}>{v}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1">
              <label className="text-xs text-muted-foreground">Período</label>
              <Select value={periodFilter} onValueChange={setPeriodFilter}>
                <SelectTrigger className="w-44"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {PERIOD_OPTIONS.map(p => (
                    <SelectItem key={p.value} value={p.value}>{p.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <Button variant="outline" size="sm" onClick={handleExportXlsx} className="gap-1">
              <Download className="w-4 h-4" /> Exportar XLSX
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Summary */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Card>
          <CardContent className="p-3">
            <p className="text-lg font-bold">{filtered.length}</p>
            <p className="text-[10px] text-muted-foreground">Registros Filtrados</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-3">
            <p className="text-lg font-bold text-emerald-500">
              {fmtBRL(filtered.reduce((s, r) => s + (r.valor_liberado || 0), 0))}
            </p>
            <p className="text-[10px] text-muted-foreground">Valor Total</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-3">
            <p className="text-lg font-bold">{new Set(filtered.map(r => r.banco).filter(Boolean)).size}</p>
            <p className="text-[10px] text-muted-foreground">Bancos</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-3">
            <p className="text-lg font-bold">{new Set(filtered.map(r => r.vendedor_nome).filter(Boolean)).size}</p>
            <p className="text-[10px] text-muted-foreground">Vendedores</p>
          </CardContent>
        </Card>
      </div>

      {/* Table */}
      <Card>
        <CardContent className="p-0">
          {filtered.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
              <FileText className="w-10 h-10 opacity-40 mb-2" />
              <p className="text-sm">Nenhum registro encontrado</p>
              <p className="text-xs">Ajuste os filtros ou salve snapshots primeiro</p>
            </div>
          ) : (
            <>
              <ScrollArea className="w-full">
                <Table>
                  <TableHeader>
                    <TableRow>
                      {columns.map(col => {
                        const Icon = sort.key === col.key ? (sort.dir === 'asc' ? ArrowUp : ArrowDown) : ArrowUpDown;
                        return (
                          <TableHead
                            key={col.key}
                            className="whitespace-nowrap text-xs cursor-pointer select-none hover:bg-muted/50"
                            onClick={() => toggleSort(col.key)}
                          >
                            <span className="inline-flex items-center gap-1">
                              {col.label}
                              <Icon className={`w-3 h-3 ${sort.key === col.key ? 'text-foreground' : 'text-muted-foreground/50'}`} />
                            </span>
                          </TableHead>
                        );
                      })}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {paged.map((row) => (
                      <TableRow key={row.id}>
                        {columns.map(col => (
                          <TableCell key={col.key} className="text-xs whitespace-nowrap max-w-[200px] truncate">
                            {formatCell(col, row)}
                          </TableCell>
                        ))}
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
                <ScrollBar orientation="horizontal" />
              </ScrollArea>
              <TablePagination page={page} totalPages={totalPages} total={filtered.length} onChange={setPage} />

            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
