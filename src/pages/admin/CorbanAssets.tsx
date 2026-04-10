import DashboardLayout from '@/components/layout/DashboardLayout';
import { Database, RefreshCw, Loader2, Settings2, Eye, EyeOff, ChevronRight } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Checkbox } from '@/components/ui/checkbox';
import { useState, useMemo } from 'react';
import { invokeCorban } from '@/lib/invokeCorban';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { useQuery } from '@tanstack/react-query';
import { PayloadEditorDialog } from '@/components/corban/PayloadEditorDialog';
import { JsonTreeView } from '@/components/admin/JsonTreeView';

const ASSET_TYPES = [
  { key: 'status', label: 'Status' },
  { key: 'bancos', label: 'Bancos' },
  { key: 'convenios', label: 'Convênios' },
  { key: 'produtos', label: 'Produtos' },
  { key: 'equipes', label: 'Equipes' },
  { key: 'origens', label: 'Origens' },
  { key: 'tabelas', label: 'Tabelas' },
  { key: 'franquias', label: 'Franquias' },
];

export default function CorbanAssets() {
  const [syncing, setSyncing] = useState<string | null>(null);
  const [syncingAll, setSyncingAll] = useState(false);
  const [activeTab, setActiveTab] = useState('status');
  const [payloadEditorOpen, setPayloadEditorOpen] = useState(false);
  const [hiddenCols, setHiddenCols] = useState<Record<string, Set<string>>>({});
  const [columnsOpen, setColumnsOpen] = useState(false);
  const [detailItem, setDetailItem] = useState<any>(null);

  const { data: cachedAssets = [], refetch } = useQuery({
    queryKey: ['corban-assets-cache', activeTab],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('corban_assets_cache')
        .select('*')
        .eq('asset_type', activeTab)
        .order('asset_label');
      if (error) throw error;
      return data || [];
    },
  });

  // Extract ALL columns from raw_data across all items for current tab
  const allColumns = useMemo(() => {
    const keys = new Set<string>();
    keys.add('asset_id');
    keys.add('asset_label');
    cachedAssets.forEach((a: any) => {
      if (a.raw_data && typeof a.raw_data === 'object' && !Array.isArray(a.raw_data)) {
        Object.keys(a.raw_data).forEach(k => keys.add(k));
      }
    });
    keys.add('synced_at');
    return Array.from(keys);
  }, [cachedAssets]);

  const tabHiddenCols = hiddenCols[activeTab] || new Set<string>();
  const visibleColumns = useMemo(() => allColumns.filter(c => !tabHiddenCols.has(c)), [allColumns, tabHiddenCols]);

  const toggleCol = (col: string) => {
    setHiddenCols(prev => {
      const tabSet = new Set(prev[activeTab] || []);
      if (tabSet.has(col)) tabSet.delete(col); else tabSet.add(col);
      return { ...prev, [activeTab]: tabSet };
    });
  };

  const getCellValue = (asset: any, col: string): unknown => {
    if (col === 'asset_id') return asset.asset_id;
    if (col === 'asset_label') return asset.asset_label;
    if (col === 'synced_at') return asset.synced_at ? new Date(asset.synced_at).toLocaleString('pt-BR') : '—';
    return asset.raw_data?.[col] ?? null;
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

  const syncAsset = async (assetType: string): Promise<number> => {
    const { data, error } = await invokeCorban('getAssets', { asset: assetType });
    if (error) {
      toast.error(`Erro ao sincronizar ${assetType}`, { description: error });
      return 0;
    }
    const items = Array.isArray(data) ? data : [];
    let synced = 0;
    for (const item of items) {
      const assetId = String(item.asset_id || item.id || item.codigo || item.empresa_id || item.value || '');
      const assetLabel = String(item.asset_label || item.tabulacao || item.nome || item.descricao || item.label || item.name || '');
      if (assetId && assetLabel) {
        await supabase.from('corban_assets_cache').upsert({
          asset_type: assetType,
          asset_id: assetId,
          asset_label: assetLabel,
          raw_data: item,
          synced_at: new Date().toISOString(),
        }, { onConflict: 'asset_type,asset_id' });
        synced++;
      }
    }
    return synced;
  };

  const handleSync = async (assetType: string) => {
    setSyncing(assetType);
    const count = await syncAsset(assetType);
    if (count > 0) {
      toast.success(`${count} itens sincronizados para ${assetType}`);
      refetch();
    }
    setSyncing(null);
  };

  const handleSyncAll = async () => {
    setSyncingAll(true);
    let totalSynced = 0;
    for (const t of ASSET_TYPES) {
      const count = await syncAsset(t.key);
      totalSynced += count;
    }
    toast.success(`Sincronização completa: ${totalSynced} itens atualizados`);
    refetch();
    setSyncingAll(false);
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2">
              <Database className="w-6 h-6 text-primary" />
              Assets / Tabelas — Corban
            </h1>
            <p className="text-muted-foreground text-sm mt-1">Sincronizar e visualizar dados da NewCorban</p>
          </div>
          <Button onClick={handleSyncAll} disabled={syncingAll} variant="default" size="sm">
            {syncingAll ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <RefreshCw className="w-4 h-4 mr-2" />}
            {syncingAll ? 'Sincronizando tudo...' : 'Sincronizar Todos'}
          </Button>
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <div className="flex items-center justify-between flex-wrap gap-2">
            <TabsList className="flex-wrap h-auto">
              {ASSET_TYPES.map(t => (
                <TabsTrigger key={t.key} value={t.key}>{t.label}</TabsTrigger>
              ))}
            </TabsList>
            <div className="flex gap-2">
              {cachedAssets.length > 0 && (
                <Button variant="outline" size="sm" onClick={() => setColumnsOpen(!columnsOpen)}>
                  {tabHiddenCols.size > 0 ? <EyeOff className="w-4 h-4 mr-1" /> : <Eye className="w-4 h-4 mr-1" />}
                  Colunas ({visibleColumns.length}/{allColumns.length})
                </Button>
              )}
              <Button variant="outline" size="sm" onClick={() => handleSync(activeTab)} disabled={syncing === activeTab || syncingAll}>
                <RefreshCw className={`w-4 h-4 mr-2 ${syncing === activeTab ? 'animate-spin' : ''}`} />
                {syncing === activeTab ? 'Sincronizando...' : 'Sincronizar'}
              </Button>
              <Button variant="outline" size="sm" onClick={() => setPayloadEditorOpen(true)} title="Editar payload manualmente">
                <Settings2 className="w-4 h-4 mr-1" /> Payload
              </Button>
            </div>
          </div>

          {ASSET_TYPES.map(t => (
            <TabsContent key={t.key} value={t.key}>
              <Card>
                <CardHeader>
                  <CardTitle className="text-base flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span>{t.label}</span>
                      <Badge variant="secondary" className="text-xs">{cachedAssets.length} itens</Badge>
                    </div>
                    {cachedAssets[0]?.synced_at && (
                      <span className="text-xs text-muted-foreground font-normal">
                        Última sync: {new Date(cachedAssets[0].synced_at).toLocaleString('pt-BR')}
                      </span>
                    )}
                  </CardTitle>
                </CardHeader>
                <CardContent className="p-0">
                  {cachedAssets.length === 0 ? (
                    <p className="p-6 text-center text-muted-foreground text-sm">
                      Nenhum dado em cache. Clique em "Sincronizar" para buscar da NewCorban.
                    </p>
                  ) : (
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
                          {cachedAssets.map((a: any) => (
                            <TableRow key={a.id} className="cursor-pointer hover:bg-muted/50" onClick={() => setDetailItem(a)}>
                              {visibleColumns.map(col => (
                                <TableCell key={col} className="text-xs max-w-[200px] truncate">
                                  {renderCellValue(getCellValue(a, col))}
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
                  )}
                </CardContent>
              </Card>
            </TabsContent>
          ))}
        </Tabs>

        {/* Columns selector */}
        <Popover open={columnsOpen} onOpenChange={setColumnsOpen}>
          <PopoverContent className="w-64 p-0" align="end" side="bottom">
            <div className="p-3 border-b"><p className="text-sm font-medium">Colunas visíveis</p></div>
            <ScrollArea className="h-[280px] p-2">
              {allColumns.map(col => (
                <label key={col} className="flex items-center gap-2 px-2 py-1 text-sm hover:bg-accent rounded cursor-pointer">
                  <Checkbox checked={!tabHiddenCols.has(col)} onCheckedChange={() => toggleCol(col)} />
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
              <SheetTitle>{detailItem?.asset_label || 'Detalhes do Asset'}</SheetTitle>
            </SheetHeader>
            <div className="mt-4">
              <JsonTreeView data={detailItem?.raw_data || detailItem} defaultExpanded maxDepth={5} />
            </div>
          </SheetContent>
        </Sheet>

        <PayloadEditorDialog
          open={payloadEditorOpen}
          onOpenChange={setPayloadEditorOpen}
          initialPayload={{ asset: activeTab }}
          onSend={async (payload) => {
            const assetType = (payload as any).asset || activeTab;
            const count = await syncAsset(assetType);
            if (count > 0) { toast.success(`${count} itens sincronizados`); refetch(); }
          }}
          title="Editar Payload — Assets"
        />
      </div>
    </DashboardLayout>
  );
}
