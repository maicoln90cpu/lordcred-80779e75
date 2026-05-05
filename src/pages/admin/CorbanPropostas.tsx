import DashboardLayout from '@/components/layout/DashboardLayout';
import { ClipboardList, Search, Calendar as CalendarIcon, Loader2, Settings2, Columns3, ChevronDown, ExternalLink, Camera } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Checkbox } from '@/components/ui/checkbox';
import { ScrollArea, ScrollBar } from '@/components/ui/scroll-area';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Separator } from '@/components/ui/separator';
import { useState, useEffect, useCallback, useMemo } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useTableState } from '@/hooks/useTableState';
import { TablePagination } from '@/components/common/TablePagination';
import { ArrowUpDown, ArrowUp, ArrowDown } from 'lucide-react';
import { format, subDays } from 'date-fns';
import { normalizeCorbanPropostasInput, type NormalizedCorbanProposta } from '@/lib/corbanPropostas';
import { invokeCorban } from '@/lib/invokeCorban';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { PayloadEditorDialog } from '@/components/corban/PayloadEditorDialog';

interface CachedAsset {
  asset_id: string;
  asset_label: string;
}

const fmtBRL = (v: number | null) => v != null ? `R$ ${Number(v).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}` : '—';

// All available columns grouped
const ALL_COLUMNS: { key: keyof NormalizedCorbanProposta; label: string; group: string; default?: boolean; format?: 'brl' | 'text' }[] = [
  // Essenciais (default visíveis)
  { key: 'cpf', label: 'CPF', group: 'Essencial', default: true },
  { key: 'nome', label: 'Nome', group: 'Essencial', default: true },
  { key: 'banco', label: 'Banco', group: 'Essencial', default: true },
  { key: 'produto', label: 'Produto', group: 'Essencial', default: true },
  { key: 'status', label: 'Status', group: 'Essencial', default: true },
  { key: 'valor_liberado', label: 'Valor Lib.', group: 'Essencial', default: true, format: 'brl' },
  { key: 'valor_parcela', label: 'Parcela', group: 'Essencial', default: true, format: 'brl' },
  { key: 'prazo', label: 'Prazo', group: 'Essencial', default: true },
  { key: 'data_cadastro', label: 'Data Cadastro', group: 'Essencial', default: true },
  { key: 'convenio', label: 'Convênio', group: 'Essencial', default: true },

  // Proposta
  { key: 'proposta_id', label: 'ID Proposta', group: 'Proposta' },
  { key: 'proposta_id_banco', label: 'ID Banco', group: 'Proposta' },
  { key: 'valor_financiado', label: 'Valor Financiado', group: 'Proposta', format: 'brl' },
  { key: 'taxa', label: 'Taxa', group: 'Proposta' },
  { key: 'seguro', label: 'Seguro', group: 'Proposta' },
  { key: 'tabela_nome', label: 'Tabela', group: 'Proposta' },
  { key: 'tipo_liberacao', label: 'Tipo Liberação', group: 'Proposta' },
  { key: 'comissoes', label: 'Comissões', group: 'Proposta' },
  { key: 'link_formalizacao', label: 'Link Formalização', group: 'Proposta' },

  // Equipe
  { key: 'vendedor_nome', label: 'Vendedor', group: 'Equipe' },
  { key: 'digitador_nome', label: 'Digitador', group: 'Equipe' },
  { key: 'equipe_nome', label: 'Equipe', group: 'Equipe' },
  { key: 'promotora_nome', label: 'Promotora', group: 'Equipe' },
  { key: 'origem', label: 'Origem', group: 'Equipe' },

  // Datas
  { key: 'data_pagamento', label: 'Data Pagamento', group: 'Datas' },
  { key: 'data_formalizacao', label: 'Data Formalização', group: 'Datas' },
  { key: 'data_averbacao', label: 'Data Averbação', group: 'Datas' },
  { key: 'data_status', label: 'Data Status', group: 'Datas' },

  // API
  { key: 'status_api', label: 'Status API (cod)', group: 'API' },
  { key: 'status_api_descricao', label: 'Status API (desc)', group: 'API' },
  { key: 'data_atualizacao_api', label: 'Atualização API', group: 'API' },

  // Averbação
  { key: 'agencia', label: 'Agência', group: 'Averbação' },
  { key: 'conta', label: 'Conta', group: 'Averbação' },
  { key: 'banco_averbacao', label: 'Banco Averbação', group: 'Averbação' },
  { key: 'pix', label: 'PIX', group: 'Averbação' },

  // Cliente
  { key: 'telefone', label: 'Telefone', group: 'Cliente' },
  { key: 'nascimento', label: 'Nascimento', group: 'Cliente' },
  { key: 'cliente_sexo', label: 'Sexo', group: 'Cliente' },
  { key: 'nome_mae', label: 'Nome da Mãe', group: 'Cliente' },
  { key: 'renda', label: 'Renda', group: 'Cliente', format: 'brl' },
  { key: 'endereco_completo', label: 'Endereço', group: 'Cliente' },

  // Outros
  { key: 'tipo_cadastro', label: 'Tipo Cadastro', group: 'Outros' },
  { key: 'observacoes', label: 'Observações', group: 'Outros' },
];

const DEFAULT_VISIBLE = new Set(ALL_COLUMNS.filter(c => c.default).map(c => c.key));
const GROUPS = [...new Set(ALL_COLUMNS.map(c => c.group))];

function DetailSection({ title, items }: { title: string; items: { label: string; value: string | number | null | undefined }[] }) {
  const hasAny = items.some(i => i.value != null && i.value !== '' && i.value !== '—');
  if (!hasAny) return null;
  return (
    <div className="space-y-2">
      <h4 className="text-sm font-semibold text-primary">{title}</h4>
      <div className="grid grid-cols-2 gap-x-4 gap-y-1">
        {items.map((item, i) => (
          <div key={i}>
            <span className="text-[10px] text-muted-foreground uppercase">{item.label}</span>
            <p className="text-sm truncate">{item.value ?? '—'}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

interface HistoryEntry {
  from: string | null;
  to: string | null;
  at: string;
}

function SnapshotTimeline({ propostaId, resolveCachedLabel }: { propostaId: string | null | undefined; resolveCachedLabel: (v: string) => string }) {
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!propostaId) return;
    setLoading(true);
    supabase
      .from('corban_propostas_snapshot')
      .select('snapshot_history')
      .eq('proposta_id', propostaId)
      .limit(1)
      .then(({ data }) => {
        setLoading(false);
        if (data && data.length > 0) {
          const raw = (data[0] as any).snapshot_history;
          if (Array.isArray(raw) && raw.length > 0) {
            setHistory(raw as HistoryEntry[]);
          } else {
            setHistory([]);
          }
        }
      });
  }, [propostaId]);

  if (!propostaId) return null;
  if (loading) return <div className="text-xs text-muted-foreground py-2">Carregando histórico...</div>;
  if (history.length === 0) return null;

  return (
    <>
      <Separator />
      <div className="space-y-2">
        <h4 className="text-sm font-semibold text-primary">📊 Histórico de Status</h4>
        <div className="relative pl-4 space-y-3">
          {/* Vertical line */}
          <div className="absolute left-[7px] top-1 bottom-1 w-0.5 bg-border" />
          {[...history].reverse().map((entry, i) => {
            const date = entry.at ? new Date(entry.at) : null;
            const isFirst = i === 0;
            return (
              <div key={i} className="relative flex items-start gap-3">
                <div className={cn(
                  "absolute -left-4 top-1 w-3 h-3 rounded-full border-2 border-background z-10",
                  isFirst ? "bg-primary" : "bg-muted-foreground/40"
                )} />
                <div className="ml-2">
                  <p className="text-xs font-medium">
                    {resolveCachedLabel(entry.to || '')}
                  </p>
                  {entry.from && (
                    <p className="text-[10px] text-muted-foreground">
                      antes: {resolveCachedLabel(entry.from)}
                    </p>
                  )}
                  {date && (
                    <p className="text-[10px] text-muted-foreground">
                      {date.toLocaleDateString('pt-BR')} às {date.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                    </p>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </>
  );
}

export default function CorbanPropostas() {
  const { user } = useAuth();
  const [searchCpf, setSearchCpf] = useState('');
  const [loading, setLoading] = useState(false);
  const [savingSnapshot, setSavingSnapshot] = useState(false);
  const [propostas, setPropostas] = useState<NormalizedCorbanProposta[]>([]);
  const PAGE_SIZE = 30;
  const [dateFrom, setDateFrom] = useState<Date | undefined>(() => {
    const d = new Date(); d.setDate(d.getDate() - 30); return d;
  });
  const [dateTo, setDateTo] = useState<Date | undefined>(new Date());
  const [statusFilter, setStatusFilter] = useState<string>('');
  const [bancoFilter, setBancoFilter] = useState<string>('');
  const [cachedStatus, setCachedStatus] = useState<CachedAsset[]>([]);
  const [cachedBancos, setCachedBancos] = useState<CachedAsset[]>([]);
  const [payloadEditorOpen, setPayloadEditorOpen] = useState(false);
  const [visibleColumns, setVisibleColumns] = useState<Set<string>>(new Set(DEFAULT_VISIBLE));
  const [selectedProposta, setSelectedProposta] = useState<NormalizedCorbanProposta | null>(null);
  const table = useTableState<NormalizedCorbanProposta>({
    pageSize: PAGE_SIZE,
    resetPageOn: [statusFilter, bancoFilter, searchCpf, dateFrom?.toISOString(), dateTo?.toISOString()],
  });
  const { sort, toggleSort, page, setPage } = table;

  useEffect(() => {
    (async () => {
      const [statusRes, bancosRes] = await Promise.all([
        supabase.from('corban_assets_cache').select('asset_id, asset_label').eq('asset_type', 'status').order('asset_label'),
        supabase.from('corban_assets_cache').select('asset_id, asset_label').eq('asset_type', 'bancos').order('asset_label'),
      ]);
      setCachedStatus(statusRes.data || []);
      setCachedBancos(bancosRes.data || []);
    })();
  }, []);

  const resolveCachedLabel = (items: CachedAsset[], value: string | null) => {
    if (!value) return '—';
    return items.find((item) => item.asset_id === value)?.asset_label || value;
  };

  const toggleColumn = useCallback((key: string) => {
    setVisibleColumns(prev => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key); else next.add(key);
      return next;
    });
  }, []);

  const toggleGroup = useCallback((group: string) => {
    const groupKeys = ALL_COLUMNS.filter(c => c.group === group).map(c => c.key as string);
    setVisibleColumns(prev => {
      const next = new Set(prev);
      const allVisible = groupKeys.every(k => next.has(k));
      groupKeys.forEach(k => allVisible ? next.delete(k) : next.add(k));
      return next;
    });
  }, []);

  const activeColumns = ALL_COLUMNS.filter(c => visibleColumns.has(c.key as string));

  const buildPayload = () => {
    const filters: Record<string, any> = {
      status: [],
      data: {
        tipo: 'cadastro',
        startDate: dateFrom ? format(dateFrom, 'yyyy-MM-dd') : '',
        endDate: dateTo ? format(dateTo, 'yyyy-MM-dd') : '',
      },
    };
    if (statusFilter) filters.status = [statusFilter];
    if (bancoFilter) filters.banco = bancoFilter;
    if (searchCpf.trim()) filters.searchString = searchCpf.trim();
    return { exactPayload: true, filters };
  };

  const [totalFetched, setTotalFetched] = useState(0);

  const executeSearch = async (payload: Record<string, unknown>) => {
    setLoading(true);
    const { data, error } = await invokeCorban('getPropostas', payload);
    setLoading(false);
    setPage(0);
    if (error) {
      toast.error('Erro ao buscar propostas', { description: error });
      return;
    }
    let list = normalizeCorbanPropostasInput(data);
    setTotalFetched(list.length);
    // Client-side CPF filtering (API may ignore searchString)
    const cpfSearch = searchCpf.replace(/\D/g, '').trim();
    if (cpfSearch.length >= 3) {
      list = list.filter(p => {
        const pCpf = (p.cpf || '').replace(/\D/g, '');
        return pCpf.includes(cpfSearch);
      });
    }
    setPropostas(list);
    if (list.length === 0) {
      toast.info('Nenhuma proposta encontrada para os filtros informados');
    }
  };

  const handleSearch = async () => {
    if (!dateFrom || !dateTo) {
      toast.error('Informe data inicial e final para buscar');
      return;
    }
    if (dateFrom > dateTo) {
      toast.error('A data inicial não pode ser maior que a data final');
      return;
    }
    await executeSearch(buildPayload());
  };

  const handleSaveSnapshot = async () => {
    if (propostas.length === 0) {
      toast.error('Nenhuma proposta carregada. Faça uma busca primeiro.');
      return;
    }
    setSavingSnapshot(true);
    try {
      const rows = propostas.map(p => ({
        proposta_id: p.proposta_id || null,
        cpf: p.cpf || null,
        nome: p.nome || null,
        banco: p.banco || null,
        produto: p.produto || null,
        status: p.status || null,
        valor_liberado: p.valor_liberado || null,
        valor_parcela: p.valor_parcela || null,
        prazo: p.prazo != null ? String(p.prazo) : null,
        vendedor_nome: p.vendedor_nome || null,
        data_cadastro: p.data_cadastro || null,
        convenio: p.convenio || null,
        raw_data: p as any,
        created_by: user?.id || null,
      }));

      // Separate rows with and without proposta_id
      const withId = rows.filter(r => r.proposta_id);
      const withoutId = rows.filter(r => !r.proposta_id);
      let insertErr: any = null;
      if (withId.length > 0) {
        const { error } = await supabase.from('corban_propostas_snapshot' as any).upsert(withId as any, { onConflict: 'proposta_id' });
        if (error) insertErr = error;
      }
      if (!insertErr && withoutId.length > 0) {
        const { error } = await supabase.from('corban_propostas_snapshot' as any).insert(withoutId as any);
        if (error) insertErr = error;
      }
      if (insertErr) { toast.error('Erro ao salvar snapshot', { description: insertErr.message }); return; }
      toast.success(`Snapshot salvo com ${rows.length} propostas`);
    } finally {
      setSavingSnapshot(false);
    }
  };

  const formatCellValue = (col: typeof ALL_COLUMNS[0], p: NormalizedCorbanProposta) => {
    const value = p[col.key];
    if (value == null || value === '') return '—';
    if (col.format === 'brl') return fmtBRL(value as number);
    if (col.key === 'status') return <Badge variant="outline" className="text-xs">{resolveCachedLabel(cachedStatus, value as string)}</Badge>;
    if (col.key === 'link_formalizacao' && value) {
      return (
        <a href={value as string} target="_blank" rel="noreferrer" className="text-primary underline text-xs flex items-center gap-1" onClick={e => e.stopPropagation()}>
          <ExternalLink className="w-3 h-3" /> Abrir
        </a>
      );
    }
    return String(value);
  };

  const { paged: pagedPropostas, totalPages } = table.apply(propostas);

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <ClipboardList className="w-6 h-6 text-primary" />
            Propostas Corban
          </h1>
          <p className="text-muted-foreground text-sm mt-1">Consultar propostas na plataforma NewCorban</p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Filtros de Busca</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex flex-wrap gap-3 items-end">
              <div className="space-y-1">
                <label className="text-xs text-muted-foreground">CPF / Telefone</label>
                <Input
                  placeholder="Buscar..."
                  value={searchCpf}
                  onChange={(e) => setSearchCpf(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                  className="w-48"
                />
              </div>

              {cachedStatus.length > 0 && (
                <div className="space-y-1">
                  <label className="text-xs text-muted-foreground">Status</label>
                  <Select value={statusFilter} onValueChange={(v) => setStatusFilter(v === '__all__' ? '' : v)}>
                    <SelectTrigger className="w-48">
                      <SelectValue placeholder="Todos" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="__all__">Todos</SelectItem>
                      {[...cachedStatus].sort((a, b) => a.asset_label.localeCompare(b.asset_label, 'pt-BR')).map(s => (
                        <SelectItem key={s.asset_id} value={s.asset_id}>{s.asset_label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}

              {cachedBancos.length > 0 && (
                <div className="space-y-1">
                  <label className="text-xs text-muted-foreground">Banco</label>
                  <Select value={bancoFilter} onValueChange={(v) => setBancoFilter(v === '__all__' ? '' : v)}>
                    <SelectTrigger className="w-48">
                      <SelectValue placeholder="Todos" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="__all__">Todos</SelectItem>
                      {[...cachedBancos].sort((a, b) => a.asset_label.localeCompare(b.asset_label, 'pt-BR')).map(b => (
                        <SelectItem key={b.asset_id} value={b.asset_id}>{b.asset_label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}

              <div className="space-y-1">
                <label className="text-xs text-muted-foreground">Data início</label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button variant="outline" size="sm" className={cn("w-36 justify-start text-left font-normal", !dateFrom && "text-muted-foreground")}>
                      <CalendarIcon className="mr-2 h-3.5 w-3.5" />
                      {dateFrom ? format(dateFrom, 'dd/MM/yyyy') : 'Início'}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar mode="single" selected={dateFrom} onSelect={setDateFrom} disabled={(d) => d > new Date()} initialFocus />
                  </PopoverContent>
                </Popover>
              </div>

              <div className="space-y-1">
                <label className="text-xs text-muted-foreground">Data fim</label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button variant="outline" size="sm" className={cn("w-36 justify-start text-left font-normal", !dateTo && "text-muted-foreground")}>
                      <CalendarIcon className="mr-2 h-3.5 w-3.5" />
                      {dateTo ? format(dateTo, 'dd/MM/yyyy') : 'Fim'}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar mode="single" selected={dateTo} onSelect={setDateTo} disabled={(d) => d > new Date()} initialFocus />
                  </PopoverContent>
                </Popover>
              </div>

              <Button onClick={handleSearch} disabled={loading}>
                {loading ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Search className="w-4 h-4 mr-2" />}
                {loading ? 'Buscando...' : 'Buscar'}
              </Button>
              <Button variant="outline" size="sm" onClick={() => setPayloadEditorOpen(true)} title="Editar payload manualmente">
                <Settings2 className="w-4 h-4 mr-1" /> Payload
              </Button>
              <Button variant="outline" size="sm" onClick={handleSaveSnapshot} disabled={savingSnapshot} title="Buscar e salvar snapshot dos últimos 30 dias">
                {savingSnapshot ? <Loader2 className="w-4 h-4 mr-1 animate-spin" /> : <Camera className="w-4 h-4 mr-1" />}
                {savingSnapshot ? 'Salvando...' : 'Salvar Snapshot'}
              </Button>
            </div>
          </CardContent>
        </Card>

        {propostas.length > 0 && (
          <>
            {/* Summary KPI cards */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <Card>
                <CardContent className="p-3">
                  <p className="text-lg font-bold">{propostas.length}</p>
                  <p className="text-[10px] text-muted-foreground">Total Propostas</p>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="p-3">
                  <p className="text-lg font-bold text-emerald-500">
                    {fmtBRL(propostas.reduce((s, p) => s + (p.valor_liberado || 0), 0))}
                  </p>
                  <p className="text-[10px] text-muted-foreground">Valor Total Liberado</p>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="p-3">
                  <p className="text-lg font-bold">
                    {new Set(propostas.map(p => p.banco).filter(Boolean)).size}
                  </p>
                  <p className="text-[10px] text-muted-foreground">Bancos</p>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="p-3">
                  <div className="flex flex-wrap gap-1">
                    {Object.entries(
                      propostas.reduce<Record<string, number>>((acc, p) => {
                        const s = resolveCachedLabel(cachedStatus, p.status);
                        acc[s] = (acc[s] || 0) + 1;
                        return acc;
                      }, {})
                    ).sort(([, a], [, b]) => b - a).slice(0, 3).map(([label, count]) => (
                      <Badge key={label} variant="outline" className="text-[10px]">{label}: {count}</Badge>
                    ))}
                  </div>
                  <p className="text-[10px] text-muted-foreground mt-1">Top Status</p>
                </CardContent>
              </Card>
            </div>

            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle className="text-base">
                    {propostas.length} proposta(s) encontrada(s)
                    {totalFetched > propostas.length && (
                      <span className="text-xs text-muted-foreground font-normal ml-2">(filtrado de {totalFetched} total)</span>
                    )}
                  </CardTitle>
                  {/* Column selector */}
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button variant="outline" size="sm">
                        <Columns3 className="w-4 h-4 mr-1" /> Colunas ({activeColumns.length})
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-72 p-0" align="end">
                      <ScrollArea className="h-[400px]">
                        <div className="p-3 space-y-3">
                          {GROUPS.map(group => {
                            const groupCols = ALL_COLUMNS.filter(c => c.group === group);
                            const allChecked = groupCols.every(c => visibleColumns.has(c.key as string));
                            return (
                              <div key={group}>
                                <div
                                  className="flex items-center gap-2 cursor-pointer mb-1"
                                  onClick={() => toggleGroup(group)}
                                >
                                  <Checkbox checked={allChecked} className="h-3.5 w-3.5" />
                                  <span className="text-xs font-semibold text-primary">{group}</span>
                                </div>
                                <div className="ml-5 space-y-0.5">
                                  {groupCols.map(col => (
                                    <div
                                      key={col.key}
                                      className="flex items-center gap-2 cursor-pointer py-0.5"
                                      onClick={() => toggleColumn(col.key as string)}
                                    >
                                      <Checkbox checked={visibleColumns.has(col.key as string)} className="h-3 w-3" />
                                      <span className="text-xs text-muted-foreground">{col.label}</span>
                                    </div>
                                  ))}
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </ScrollArea>
                    </PopoverContent>
                  </Popover>
                </div>
              </CardHeader>
              <CardContent className="p-0">
                <ScrollArea className="w-full">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        {activeColumns.map(col => {
                          const Icon = sort.key === col.key ? (sort.dir === 'asc' ? ArrowUp : ArrowDown) : ArrowUpDown;
                          return (
                            <TableHead
                              key={col.key}
                              className="whitespace-nowrap text-xs cursor-pointer select-none hover:bg-muted/50"
                              onClick={() => toggleSort(col.key as string)}
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
                      {pagedPropostas.map((p, i) => (
                        <TableRow
                          key={`${p.proposta_id || i}`}
                          className="cursor-pointer hover:bg-muted/50"
                          onClick={() => setSelectedProposta(p)}
                        >
                          {activeColumns.map(col => (
                            <TableCell key={col.key} className="text-xs whitespace-nowrap max-w-[200px] truncate">
                              {formatCellValue(col, p)}
                            </TableCell>
                          ))}
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                  <ScrollBar orientation="horizontal" />
                </ScrollArea>
                <TablePagination page={page} totalPages={totalPages} total={propostas.length} onChange={setPage} />

              </CardContent>
            </Card>
          </>
        )}

        {/* Detail drawer */}
        <Sheet open={!!selectedProposta} onOpenChange={() => setSelectedProposta(null)}>
          <SheetContent className="sm:max-w-lg overflow-y-auto">
            <SheetHeader>
              <SheetTitle className="text-lg">Detalhes da Proposta</SheetTitle>
            </SheetHeader>
            {selectedProposta && (
              <div className="mt-4 space-y-4">
                <DetailSection title="📋 Proposta" items={[
                  { label: 'ID', value: selectedProposta.proposta_id },
                  { label: 'ID Banco', value: selectedProposta.proposta_id_banco },
                  { label: 'Banco', value: selectedProposta.banco },
                  { label: 'Produto', value: selectedProposta.produto },
                  { label: 'Convênio', value: selectedProposta.convenio },
                  { label: 'Tabela', value: selectedProposta.tabela_nome },
                  { label: 'Status', value: resolveCachedLabel(cachedStatus, selectedProposta.status) },
                  { label: 'Valor Liberado', value: fmtBRL(selectedProposta.valor_liberado) },
                  { label: 'Valor Financiado', value: fmtBRL(selectedProposta.valor_financiado ?? null) },
                  { label: 'Parcela', value: fmtBRL(selectedProposta.valor_parcela) },
                  { label: 'Prazo', value: selectedProposta.prazo },
                  { label: 'Taxa', value: selectedProposta.taxa },
                  { label: 'Seguro', value: selectedProposta.seguro },
                  { label: 'Tipo Liberação', value: selectedProposta.tipo_liberacao },
                  { label: 'Comissões', value: selectedProposta.comissoes },
                ]} />
                <Separator />
                <DetailSection title="👤 Cliente" items={[
                  { label: 'Nome', value: selectedProposta.nome },
                  { label: 'CPF', value: selectedProposta.cpf },
                  { label: 'Telefone', value: selectedProposta.telefone },
                  { label: 'Nascimento', value: selectedProposta.nascimento },
                  { label: 'Sexo', value: selectedProposta.cliente_sexo },
                  { label: 'Nome da Mãe', value: selectedProposta.nome_mae },
                  { label: 'Renda', value: selectedProposta.renda != null ? fmtBRL(selectedProposta.renda) : null },
                  { label: 'Endereço', value: selectedProposta.endereco_completo },
                ]} />
                <Separator />
                <DetailSection title="📅 Datas" items={[
                  { label: 'Cadastro', value: selectedProposta.data_cadastro },
                  { label: 'Pagamento', value: selectedProposta.data_pagamento },
                  { label: 'Formalização', value: selectedProposta.data_formalizacao },
                  { label: 'Averbação', value: selectedProposta.data_averbacao },
                  { label: 'Status', value: selectedProposta.data_status },
                  { label: 'Atualização API', value: selectedProposta.data_atualizacao_api },
                ]} />
                <Separator />
                <DetailSection title="🏦 Averbação" items={[
                  { label: 'Banco', value: selectedProposta.banco_averbacao },
                  { label: 'Agência', value: selectedProposta.agencia },
                  { label: 'Conta', value: selectedProposta.conta },
                  { label: 'PIX', value: selectedProposta.pix },
                ]} />
                <Separator />
                <DetailSection title="👥 Equipe" items={[
                  { label: 'Vendedor', value: selectedProposta.vendedor_nome },
                  { label: 'Digitador', value: selectedProposta.digitador_nome },
                  { label: 'Equipe', value: selectedProposta.equipe_nome },
                  { label: 'Promotora', value: selectedProposta.promotora_nome },
                  { label: 'Origem', value: selectedProposta.origem },
                ]} />
                <Separator />
                <DetailSection title="🔌 API" items={[
                  { label: 'Status API', value: selectedProposta.status_api },
                  { label: 'Descrição', value: selectedProposta.status_api_descricao },
                  { label: 'Tipo Cadastro', value: selectedProposta.tipo_cadastro },
                ]} />
                {selectedProposta.observacoes && (
                  <>
                    <Separator />
                    <div className="space-y-1">
                      <h4 className="text-sm font-semibold text-primary">📝 Observações</h4>
                      <p className="text-xs text-muted-foreground whitespace-pre-wrap">{selectedProposta.observacoes}</p>
                    </div>
                  </>
                )}
                {selectedProposta.link_formalizacao && (
                  <>
                    <Separator />
                    <a href={selectedProposta.link_formalizacao} target="_blank" rel="noreferrer">
                      <Button variant="outline" size="sm" className="w-full">
                        <ExternalLink className="w-4 h-4 mr-2" /> Abrir Link de Formalização
                      </Button>
                    </a>
                  </>
                )}
                {/* Timeline de Status (snapshot_history) */}
                <SnapshotTimeline propostaId={selectedProposta.proposta_id} resolveCachedLabel={(v: string) => resolveCachedLabel(cachedStatus, v)} />
              </div>
            )}
          </SheetContent>
        </Sheet>

        <PayloadEditorDialog
          open={payloadEditorOpen}
          onOpenChange={setPayloadEditorOpen}
          initialPayload={buildPayload()}
          onSend={async (payload) => { await executeSearch(payload); }}
          title="Editar Payload — Propostas"
        />
      </div>
    </DashboardLayout>
  );
}
