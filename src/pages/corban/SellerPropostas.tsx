import DashboardLayout from '@/components/layout/DashboardLayout';
import { ClipboardList, Search, Loader2, Settings2, Eye, EyeOff, ChevronRight, Calendar as CalendarIcon } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Checkbox } from '@/components/ui/checkbox';
import { useState, useMemo } from 'react';
import { format } from 'date-fns';
import { invokeCorban } from '@/lib/invokeCorban';
import { normalizeCorbanPropostasInput, type NormalizedCorbanProposta } from '@/lib/corbanPropostas';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { PayloadEditorDialog } from '@/components/corban/PayloadEditorDialog';
import { JsonTreeView } from '@/components/admin/JsonTreeView';

export default function SellerPropostas() {
  const [searchCpf, setSearchCpf] = useState('');
  const [loading, setLoading] = useState(false);
  const [propostas, setPropostas] = useState<NormalizedCorbanProposta[]>([]);
  const [dateFrom, setDateFrom] = useState<Date | undefined>(() => { const d = new Date(); d.setDate(d.getDate() - 30); return d; });
  const [dateTo, setDateTo] = useState<Date | undefined>(new Date());
  const [hiddenCols, setHiddenCols] = useState<Set<string>>(new Set());
  const [columnsOpen, setColumnsOpen] = useState(false);
  const [detailItem, setDetailItem] = useState<any>(null);
  const [payloadEditorOpen, setPayloadEditorOpen] = useState(false);

  const allColumns = useMemo(() => {
    const keys = new Set<string>();
    propostas.forEach(p => Object.keys(p).forEach(k => keys.add(k)));
    return Array.from(keys);
  }, [propostas]);

  const visibleColumns = useMemo(() => allColumns.filter(c => !hiddenCols.has(c)), [allColumns, hiddenCols]);

  const toggleCol = (col: string) => {
    setHiddenCols(prev => {
      const next = new Set(prev);
      if (next.has(col)) next.delete(col); else next.add(col);
      return next;
    });
  };

  const buildPayload = () => {
    const filters: Record<string, any> = { status: [], data: { tipo: 'cadastro' } };
    if (searchCpf.trim()) filters.searchString = searchCpf.replace(/\D/g, '');
    if (dateFrom) filters.data.startDate = format(dateFrom, 'yyyy-MM-dd');
    if (dateTo) filters.data.endDate = format(dateTo, 'yyyy-MM-dd');
    return { filters };
  };

  const executeSearch = async (payload: Record<string, unknown>) => {
    setLoading(true);
    const { data, error } = await invokeCorban('getPropostas', payload);
    setLoading(false);
    if (error) {
      toast.error('Erro ao buscar propostas', { description: error });
      return;
    }
    const list = normalizeCorbanPropostasInput(data);
    setPropostas(list);
    if (list.length === 0) toast.info('Nenhuma proposta encontrada');
  };

  const handleSearch = async () => {
    if (!searchCpf.trim()) {
      toast.error('Informe um CPF para buscar');
      return;
    }
    await executeSearch(buildPayload());
  };

  const renderCellValue = (value: unknown): string => {
    if (value === null || value === undefined) return '—';
    if (typeof value === 'boolean') return value ? 'Sim' : 'Não';
    if (typeof value === 'object') {
      if (Array.isArray(value)) return `[${value.length} itens]`;
      return JSON.stringify(value).substring(0, 80) + '…';
    }
    return String(value);
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <ClipboardList className="w-6 h-6 text-primary" />
            Minhas Propostas
          </h1>
          <p className="text-muted-foreground text-sm mt-1">Buscar e acompanhar propostas por CPF</p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Buscar por CPF</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-3 items-end">
              <div className="space-y-1">
                <label className="text-xs text-muted-foreground">CPF do cliente</label>
                <Input
                  placeholder="CPF do cliente..."
                  value={searchCpf}
                  onChange={(e) => setSearchCpf(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                  className="w-48"
                />
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

              <Button onClick={handleSearch} disabled={loading}>
                {loading ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Search className="w-4 h-4 mr-2" />}
                {loading ? 'Buscando...' : 'Buscar'}
              </Button>

              {propostas.length > 0 && (
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

        {propostas.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle className="text-base">{propostas.length} proposta(s)</CardTitle>
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
                    {propostas.map((p, i) => (
                      <TableRow key={`${(p as any).proposta_id || i}`} className="cursor-pointer hover:bg-muted/50" onClick={() => setDetailItem(p)}>
                        {visibleColumns.map(col => (
                          <TableCell key={col} className="text-xs max-w-[200px] truncate">
                            {renderCellValue((p as any)[col])}
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

        {/* Columns selector */}
        <Popover open={columnsOpen} onOpenChange={setColumnsOpen}>
          <PopoverContent className="w-64 p-0" align="start" side="bottom">
            <div className="p-3 border-b"><p className="text-sm font-medium">Colunas visíveis</p></div>
            <ScrollArea className="h-[280px] p-2">
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
              <SheetTitle>{(detailItem as any)?.nome || 'Detalhes da Proposta'}</SheetTitle>
            </SheetHeader>
            <div className="mt-4">
              <JsonTreeView data={detailItem} defaultExpanded maxDepth={5} />
            </div>
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
