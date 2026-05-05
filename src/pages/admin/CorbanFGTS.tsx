import DashboardLayout from '@/components/layout/DashboardLayout';
import { Landmark, Search, Plus, Loader2, Calendar as CalendarIcon, Settings2, Eye, EyeOff, ChevronRight, Copy, CheckCircle, AlertTriangle } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Checkbox } from '@/components/ui/checkbox';
import { Textarea } from '@/components/ui/textarea';
import { useState, useEffect, useMemo } from 'react';
import { format } from 'date-fns';
import { invokeCorban } from '@/lib/invokeCorban';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { PayloadEditorDialog } from '@/components/corban/PayloadEditorDialog';
import { InstitutionSelect } from '@/components/corban/InstitutionSelect';
import { JsonTreeView } from '@/components/admin/JsonTreeView';
import { useTableState } from '@/hooks/useTableState';
import { TablePagination } from '@/components/common/TablePagination';
import { ArrowUpDown, ArrowUp, ArrowDown } from 'lucide-react';

interface Login {
  id: string;
  nome?: string;
  label?: string;
}

interface BatchResult {
  cpf: string;
  success: boolean;
  error?: string;
}

export default function CorbanFGTS() {
  const [searchCpf, setSearchCpf] = useState('');
  const [loading, setLoading] = useState(false);
  const [filaItems, setFilaItems] = useState<any[]>([]);
  const [insertCpf, setInsertCpf] = useState('');
  const [batchCpfs, setBatchCpfs] = useState('');
  const [inserting, setInserting] = useState(false);
  const [batchResults, setBatchResults] = useState<BatchResult[]>([]);
  const [instituicao, setInstituicao] = useState('facta');
  const [logins, setLogins] = useState<Login[]>([]);
  const [selectedLogin, setSelectedLogin] = useState('');
  const [loadingLogins, setLoadingLogins] = useState(false);
  const [dateFrom, setDateFrom] = useState<Date | undefined>(new Date());
  const [dateTo, setDateTo] = useState<Date | undefined>(new Date());
  const [payloadEditorOpen, setPayloadEditorOpen] = useState(false);
  const [columnsOpen, setColumnsOpen] = useState(false);
  const [hiddenCols, setHiddenCols] = useState<Set<string>>(new Set());
  const [detailItem, setDetailItem] = useState<any>(null);
  const [insertMode, setInsertMode] = useState<'single' | 'batch'>('single');

  const allColumns = useMemo(() => {
    const keys = new Set<string>();
    filaItems.forEach(item => Object.keys(item).forEach(k => keys.add(k)));
    return Array.from(keys);
  }, [filaItems]);

  const visibleColumns = useMemo(() => allColumns.filter(c => !hiddenCols.has(c)), [allColumns, hiddenCols]);

  // Summary stats from filaItems
  const filaStats = useMemo(() => {
    if (filaItems.length === 0) return null;
    const statusMap: Record<string, number> = {};
    filaItems.forEach(item => {
      const s = item.status || item.situacao || item.status_descricao || 'desconhecido';
      statusMap[String(s)] = (statusMap[String(s)] || 0) + 1;
    });
    return { total: filaItems.length, porStatus: statusMap };
  }, [filaItems]);

  useEffect(() => {
    (async () => {
      setLoadingLogins(true);
      const { data, error } = await invokeCorban('listLogins', { instituicao });
      setLoadingLogins(false);
      if (!error && data) {
        const raw = Array.isArray(data) ? data : (data?.logins || data?.data || []);
        const list = Array.isArray(raw) ? raw.map((l: any) => typeof l === 'string' ? { id: l, nome: l } : l) : [];
        setLogins(list);
        if (list.length > 0) setSelectedLogin(String(list[0].id || ''));
      }
    })();
  }, [instituicao]);

  const buildFilaPayload = () => {
    const filters: Record<string, any> = { instituicao };
    if (searchCpf.trim()) filters.searchString = searchCpf.replace(/\D/g, '');
    if (dateFrom || dateTo) {
      filters.data = {};
      if (dateFrom) filters.data.startDate = format(dateFrom, 'yyyy-MM-dd');
      if (dateTo) filters.data.endDate = format(dateTo, 'yyyy-MM-dd');
      else filters.data.endDate = format(new Date(), 'yyyy-MM-dd');
    }
    return { filters };
  };

  const executeFilaSearch = async (payload: Record<string, unknown>) => {
    setLoading(true);
    const { data, error } = await invokeCorban('listQueueFGTS', payload);
    setLoading(false);
    if (error) {
      toast.error('Erro ao buscar fila FGTS', { description: error });
      return;
    }
    const list = Array.isArray(data) ? data : (data?.fila || data?.data || []);
    setFilaItems(list);
    if (list.length === 0) toast.info('Nenhum item encontrado na fila');
  };

  const handleSearchFila = async () => {
    await executeFilaSearch(buildFilaPayload());
  };

  const handleInsertSingle = async () => {
    if (!insertCpf.trim()) { toast.error('Informe um CPF'); return; }
    if (!selectedLogin) { toast.error('Selecione um login'); return; }
    setInserting(true);
    const { error } = await invokeCorban('insertQueueFGTS', {
      content: { cpf: insertCpf.replace(/\D/g, ''), instituicao, login_banco: selectedLogin }
    });
    setInserting(false);
    if (error) {
      toast.error('Erro ao incluir na fila', { description: error });
    } else {
      toast.success('CPF incluído na fila FGTS com sucesso!');
      setInsertCpf('');
    }
  };

  const handleInsertBatch = async () => {
    if (!batchCpfs.trim()) { toast.error('Informe ao menos um CPF'); return; }
    if (!selectedLogin) { toast.error('Selecione um login'); return; }

    // Parse CPFs from text (one per line, comma-separated, or space-separated)
    const cpfList = batchCpfs
      .split(/[\n,;]+/)
      .map(c => c.replace(/\D/g, '').trim())
      .filter(c => c.length >= 11);

    if (cpfList.length === 0) { toast.error('Nenhum CPF válido encontrado'); return; }

    setInserting(true);
    setBatchResults([]);
    const results: BatchResult[] = [];

    for (const cpf of cpfList) {
      const { error } = await invokeCorban('insertQueueFGTS', {
        content: { cpf, instituicao, login_banco: selectedLogin }
      });
      results.push({ cpf, success: !error, error: error || undefined });
    }

    setBatchResults(results);
    setInserting(false);

    const successCount = results.filter(r => r.success).length;
    const errorCount = results.filter(r => !r.success).length;

    if (errorCount === 0) {
      toast.success(`${successCount} CPF(s) incluídos com sucesso!`);
      setBatchCpfs('');
    } else {
      toast.warning(`${successCount} incluídos, ${errorCount} com erro`);
    }
  };

  const renderCellValue = (value: unknown): string => {
    if (value === null || value === undefined) return '—';
    if (typeof value === 'object') return JSON.stringify(value).substring(0, 80);
    return String(value);
  };

  const toggleCol = (col: string) => {
    setHiddenCols(prev => {
      const next = new Set(prev);
      if (next.has(col)) next.delete(col); else next.add(col);
      return next;
    });
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Landmark className="w-6 h-6 text-primary" />
            FGTS — Corban
          </h1>
          <p className="text-muted-foreground text-sm mt-1">Gerenciar fila de consultas FGTS via NewCorban</p>
        </div>

        <Tabs defaultValue="fila">
          <TabsList>
            <TabsTrigger value="fila">Fila FGTS</TabsTrigger>
            <TabsTrigger value="incluir">Incluir na Fila</TabsTrigger>
          </TabsList>

          <TabsContent value="fila" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Buscar na Fila</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex flex-wrap gap-3 items-end">
                  <div className="space-y-1">
                    <label className="text-xs text-muted-foreground">CPF / Telefone</label>
                    <Input
                      placeholder="Buscar..."
                      value={searchCpf}
                      onChange={(e) => setSearchCpf(e.target.value)}
                      onKeyDown={(e) => e.key === 'Enter' && handleSearchFila()}
                      className="w-48"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="text-xs text-muted-foreground">Instituição</label>
                    <InstitutionSelect value={instituicao} onChange={setInstituicao} className="w-52" />
                  </div>

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

                  <Button onClick={handleSearchFila} disabled={loading}>
                    {loading ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Search className="w-4 h-4 mr-2" />}
                    {loading ? 'Buscando...' : 'Buscar'}
                  </Button>
                  {filaItems.length > 0 && (
                    <Button variant="outline" size="sm" onClick={() => setColumnsOpen(true)}>
                      {hiddenCols.size > 0 ? <EyeOff className="w-4 h-4 mr-1" /> : <Eye className="w-4 h-4 mr-1" />}
                      Colunas ({visibleColumns.length}/{allColumns.length})
                    </Button>
                  )}
                  <Button variant="outline" size="sm" onClick={() => setPayloadEditorOpen(true)} title="Editar payload manualmente">
                    <Settings2 className="w-4 h-4 mr-1" /> Payload
                  </Button>
                </div>
              </CardContent>
            </Card>

            {/* Summary stats */}
            {filaStats && (
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <Card>
                  <CardContent className="p-3">
                    <p className="text-lg font-bold">{filaStats.total}</p>
                    <p className="text-[10px] text-muted-foreground">Total na Fila</p>
                  </CardContent>
                </Card>
                {Object.entries(filaStats.porStatus).sort(([, a], [, b]) => b - a).slice(0, 3).map(([status, count]) => (
                  <Card key={status}>
                    <CardContent className="p-3">
                      <p className="text-lg font-bold">{count}</p>
                      <p className="text-[10px] text-muted-foreground truncate" title={status}>{status}</p>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}

            {filaItems.length > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">{filaItems.length} item(ns) na fila</CardTitle>
                </CardHeader>
                <CardContent className="p-0">
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          {visibleColumns.map(col => (
                            <TableHead key={col} className="text-xs whitespace-nowrap">{col}</TableHead>
                          ))}
                          <TableHead className="w-8" />
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {filaItems.map((item: any, i: number) => (
                          <TableRow key={i} className="cursor-pointer hover:bg-muted/50" onClick={() => setDetailItem(item)}>
                            {visibleColumns.map(col => (
                              <TableCell key={col} className="text-xs max-w-[200px] truncate">
                                {renderCellValue(item[col])}
                              </TableCell>
                            ))}
                            <TableCell>
                              <ChevronRight className="w-4 h-4 text-muted-foreground" />
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                </CardContent>
              </Card>
            )}
          </TabsContent>

          <TabsContent value="incluir" className="space-y-4">
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle className="text-base">Incluir CPF na Fila FGTS</CardTitle>
                  <div className="flex border rounded-lg overflow-hidden">
                    <button
                      onClick={() => setInsertMode('single')}
                      className={`px-3 py-1.5 text-xs font-medium transition-colors ${insertMode === 'single' ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground hover:bg-accent'}`}
                    >
                      Individual
                    </button>
                    <button
                      onClick={() => setInsertMode('batch')}
                      className={`px-3 py-1.5 text-xs font-medium transition-colors ${insertMode === 'batch' ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground hover:bg-accent'}`}
                    >
                      Em Lote
                    </button>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex flex-wrap gap-3 items-end">
                  <div className="space-y-1">
                    <label className="text-xs text-muted-foreground">Instituição</label>
                    <InstitutionSelect value={instituicao} onChange={setInstituicao} className="w-52" />
                  </div>

                  <div className="space-y-1">
                    <label className="text-xs text-muted-foreground">Login {loadingLogins && '(carregando...)'}</label>
                    <Select value={selectedLogin} onValueChange={setSelectedLogin} disabled={logins.length === 0}>
                      <SelectTrigger className="w-48">
                        <SelectValue placeholder={logins.length === 0 ? 'Nenhum login' : 'Selecione'} />
                      </SelectTrigger>
                      <SelectContent>
                        {logins.map(l => (
                          <SelectItem key={l.id} value={String(l.id)}>{l.nome || l.label || l.id}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                {insertMode === 'single' ? (
                  <div className="flex gap-3 items-end">
                    <div className="space-y-1 flex-1 max-w-xs">
                      <label className="text-xs text-muted-foreground">CPF</label>
                      <Input placeholder="Somente números..." value={insertCpf} onChange={(e) => setInsertCpf(e.target.value)} />
                    </div>
                    <Button onClick={handleInsertSingle} disabled={inserting || !selectedLogin}>
                      {inserting ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Plus className="w-4 h-4 mr-2" />}
                      {inserting ? 'Enviando...' : 'Enviar para Fila'}
                    </Button>
                  </div>
                ) : (
                  <div className="space-y-3">
                    <div className="space-y-1">
                      <label className="text-xs text-muted-foreground">CPFs (um por linha ou separados por vírgula)</label>
                      <Textarea
                        placeholder={"12345678901\n98765432100\n11122233344"}
                        value={batchCpfs}
                        onChange={(e) => setBatchCpfs(e.target.value)}
                        rows={6}
                        className="font-mono text-xs"
                      />
                      <p className="text-[10px] text-muted-foreground">
                        {batchCpfs.split(/[\n,;]+/).map(c => c.replace(/\D/g, '').trim()).filter(c => c.length >= 11).length} CPF(s) detectados
                      </p>
                    </div>
                    <Button onClick={handleInsertBatch} disabled={inserting || !selectedLogin}>
                      {inserting ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Copy className="w-4 h-4 mr-2" />}
                      {inserting ? 'Enviando lote...' : 'Enviar Lote para Fila'}
                    </Button>
                  </div>
                )}

                {/* Batch results */}
                {batchResults.length > 0 && (
                  <Card className="border-dashed">
                    <CardHeader className="pb-2">
                      <CardTitle className="text-sm">Resultado do Lote</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-1 max-h-[200px] overflow-y-auto">
                        {batchResults.map((r, i) => (
                          <div key={i} className="flex items-center gap-2 text-xs">
                            {r.success ? (
                              <CheckCircle className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
                            ) : (
                              <AlertTriangle className="w-3.5 h-3.5 text-destructive shrink-0" />
                            )}
                            <span className="font-mono">{r.cpf}</span>
                            {r.error && <span className="text-destructive truncate">— {r.error}</span>}
                          </div>
                        ))}
                      </div>
                      <div className="mt-2 pt-2 border-t flex gap-3 text-xs text-muted-foreground">
                        <span className="text-emerald-500 font-medium">{batchResults.filter(r => r.success).length} sucesso</span>
                        <span className="text-destructive font-medium">{batchResults.filter(r => !r.success).length} erro</span>
                      </div>
                    </CardContent>
                  </Card>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>

        {/* Columns selector popover */}
        <Popover open={columnsOpen} onOpenChange={setColumnsOpen}>
          <PopoverContent className="w-64 p-0" align="start" side="bottom">
            <div className="p-3 border-b">
              <p className="text-sm font-medium">Colunas visíveis</p>
            </div>
            <ScrollArea className="h-[240px] p-2">
              {allColumns.map(col => (
                <label key={col} className="flex items-center gap-2 px-2 py-1 text-sm hover:bg-accent rounded cursor-pointer">
                  <Checkbox checked={!hiddenCols.has(col)} onCheckedChange={() => toggleCol(col)} />
                  <span className="truncate">{col}</span>
                </label>
              ))}
            </ScrollArea>
          </PopoverContent>
        </Popover>

        {/* Detail drawer */}
        <Sheet open={!!detailItem} onOpenChange={(o) => !o && setDetailItem(null)}>
          <SheetContent className="sm:max-w-lg overflow-y-auto">
            <SheetHeader>
              <SheetTitle>Detalhes do Item FGTS</SheetTitle>
            </SheetHeader>
            <div className="mt-4">
              <JsonTreeView data={detailItem} defaultExpanded maxDepth={4} />
            </div>
          </SheetContent>
        </Sheet>

        <PayloadEditorDialog
          open={payloadEditorOpen}
          onOpenChange={setPayloadEditorOpen}
          initialPayload={buildFilaPayload()}
          onSend={async (payload) => { await executeFilaSearch(payload); }}
          title="Editar Payload — FGTS"
        />
      </div>
    </DashboardLayout>
  );
}
