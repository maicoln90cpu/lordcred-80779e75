import DashboardLayout from '@/components/layout/DashboardLayout';
import { Landmark, Search, Plus, Loader2, Eye, EyeOff, ChevronRight, Settings2 } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Checkbox } from '@/components/ui/checkbox';
import { useState, useEffect, useMemo } from 'react';
import { invokeCorban } from '@/lib/invokeCorban';
import { toast } from 'sonner';
import { useCorbanFeatures } from '@/hooks/useCorbanFeatures';
import { InstitutionSelect } from '@/components/corban/InstitutionSelect';
import { JsonTreeView } from '@/components/admin/JsonTreeView';
import { PayloadEditorDialog } from '@/components/corban/PayloadEditorDialog';

interface Login {
  id: string;
  nome?: string;
  label?: string;
}

export default function SellerFGTS() {
  const [searchCpf, setSearchCpf] = useState('');
  const [loading, setLoading] = useState(false);
  const [filaItems, setFilaItems] = useState<any[]>([]);
  const [insertCpf, setInsertCpf] = useState('');
  const [insertTelefone, setInsertTelefone] = useState('');
  const [inserting, setInserting] = useState(false);
  const [instituicao, setInstituicao] = useState('facta');
  const [logins, setLogins] = useState<Login[]>([]);
  const [selectedLogin, setSelectedLogin] = useState('');
  const [hiddenCols, setHiddenCols] = useState<Set<string>>(new Set());
  const [columnsOpen, setColumnsOpen] = useState(false);
  const [detailItem, setDetailItem] = useState<any>(null);
  const [payloadEditorOpen, setPayloadEditorOpen] = useState(false);
  const { isFeatureVisible } = useCorbanFeatures();

  const canInsert = isFeatureVisible('seller_consulta_fgts');

  const allColumns = useMemo(() => {
    const keys = new Set<string>();
    filaItems.forEach(item => Object.keys(item).forEach(k => keys.add(k)));
    return Array.from(keys);
  }, [filaItems]);

  const visibleColumns = useMemo(() => allColumns.filter(c => !hiddenCols.has(c)), [allColumns, hiddenCols]);

  useEffect(() => {
    if (!canInsert) return;
    (async () => {
      const { data } = await invokeCorban('listLogins', { instituicao });
      if (data) {
        const raw = Array.isArray(data) ? data : (data?.logins || data?.data || []);
        const list = Array.isArray(raw) ? raw.map((l: any) => typeof l === 'string' ? { id: l, nome: l } : l) : [];
        setLogins(list);
        if (list.length > 0) setSelectedLogin(String(list[0].id || ''));
      }
    })();
  }, [instituicao, canInsert]);

  const buildPayload = () => {
    const today = new Date().toISOString().split('T')[0];
    return {
      filters: {
        searchString: searchCpf.replace(/\D/g, ''),
        instituicao,
        data: { startDate: today, endDate: today }
      }
    };
  };

  const executeSearch = async (payload: Record<string, unknown>) => {
    setLoading(true);
    const { data, error } = await invokeCorban('listQueueFGTS', payload);
    setLoading(false);
    if (error) { toast.error('Erro ao buscar', { description: error }); return; }
    const list = Array.isArray(data) ? data : (data?.fila || data?.data || []);
    setFilaItems(list);
    if (list.length === 0) toast.info('Nenhum item encontrado');
  };

  const handleSearch = async () => {
    await executeSearch(buildPayload());
  };

  const handleInsert = async () => {
    if (!insertCpf.trim()) { toast.error('Informe um CPF'); return; }
    setInserting(true);
    const { error } = await invokeCorban('insertQueueFGTS', {
      tabela: 'fgts',
      content: {
        cpf: insertCpf.replace(/\D/g, ''),
        telefone: insertTelefone.replace(/\D/g, ''),
        instituicao,
        login_banco: selectedLogin
      }
    });
    setInserting(false);
    if (error) {
      toast.error('Erro ao enviar', { description: error });
    } else {
      toast.success('CPF enviado para consulta FGTS!');
      setInsertCpf('');
      setInsertTelefone('');
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
            Consulta FGTS
          </h1>
          <p className="text-muted-foreground text-sm mt-1">Consultar e enviar CPFs para fila FGTS</p>
        </div>

        {canInsert && (
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Enviar CPF para Consulta</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex flex-wrap gap-3 items-end">
                <div className="space-y-1">
                  <label className="text-xs text-muted-foreground">CPF</label>
                  <Input placeholder="Somente números..." value={insertCpf} onChange={(e) => setInsertCpf(e.target.value)} className="w-48" />
                </div>
                <div className="space-y-1">
                  <label className="text-xs text-muted-foreground">Telefone</label>
                  <Input placeholder="DDD + número..." value={insertTelefone} onChange={(e) => setInsertTelefone(e.target.value)} className="w-48" />
                </div>
                <div className="space-y-1">
                  <label className="text-xs text-muted-foreground">Instituição</label>
                  <InstitutionSelect value={instituicao} onChange={setInstituicao} className="w-52" />
                </div>
                <div className="space-y-1">
                  <label className="text-xs text-muted-foreground">Login</label>
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
                <Button onClick={handleInsert} disabled={inserting || !selectedLogin}>
                  {inserting ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Plus className="w-4 h-4 mr-2" />}
                  {inserting ? 'Enviando...' : 'Consultar FGTS'}
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center justify-between">
              <span>Minhas Consultas</span>
              <div className="flex gap-2">
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
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex gap-3 mb-4">
              <Input
                placeholder="Buscar por CPF..."
                value={searchCpf}
                onChange={(e) => setSearchCpf(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                className="max-w-xs"
              />
              <Button variant="outline" onClick={handleSearch} disabled={loading}>
                {loading ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Search className="w-4 h-4 mr-2" />}
                {loading ? 'Buscando...' : 'Buscar'}
              </Button>
            </div>

            {filaItems.length > 0 ? (
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
            ) : (
              <p className="text-sm text-muted-foreground text-center py-4">
                Busque por CPF para ver consultas FGTS
              </p>
            )}
          </CardContent>
        </Card>

        {/* Columns selector */}
        <Popover open={columnsOpen} onOpenChange={setColumnsOpen}>
          <PopoverContent className="w-64 p-0" align="start" side="bottom">
            <div className="p-3 border-b"><p className="text-sm font-medium">Colunas visíveis</p></div>
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
          initialPayload={buildPayload()}
          onSend={async (payload) => { await executeSearch(payload); }}
          title="Editar Payload — FGTS"
        />
      </div>
    </DashboardLayout>
  );
}
