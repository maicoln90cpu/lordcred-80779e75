import { useState, useEffect } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import DashboardLayout from '@/components/layout/DashboardLayout';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';
import { Plus, Trash2, Save, Loader2, Pencil, Check, X, PackageSearch, Columns3, Rows3 } from 'lucide-react';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';

interface Tab { id: string; tab_name: string; sort_order: number; }
interface Column { id: string; tab_id: string; column_name: string; sort_order: number; }
interface Row { id: string; tab_id: string; sort_order: number; }
interface Cell { id: string; row_id: string; column_id: string; content: string; }

export default function ProductInfo() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState<string>('');
  const [isSaving, setIsSaving] = useState(false);

  const [editingTabId, setEditingTabId] = useState<string | null>(null);
  const [editTabName, setEditTabName] = useState('');
  const [editingColId, setEditingColId] = useState<string | null>(null);
  const [editColName, setEditColName] = useState('');
  const [cellEdits, setCellEdits] = useState<Record<string, string>>({});

  const { data: tabs = [], isLoading: loadingTabs } = useQuery({
    queryKey: ['product-info-tabs'],
    queryFn: async () => {
      const { data, error } = await supabase.from('product_info_tabs').select('*').order('sort_order');
      if (error) throw error;
      return data as Tab[];
    }
  });

  useEffect(() => {
    if (tabs.length > 0 && !activeTab) setActiveTab(tabs[0].id);
  }, [tabs, activeTab]);

  const { data: columns = [] } = useQuery({
    queryKey: ['product-info-columns', activeTab],
    queryFn: async () => {
      if (!activeTab) return [];
      const { data, error } = await supabase.from('product_info_columns').select('*').eq('tab_id', activeTab).order('sort_order');
      if (error) throw error;
      return data as Column[];
    },
    enabled: !!activeTab,
  });

  const { data: rows = [] } = useQuery({
    queryKey: ['product-info-rows', activeTab],
    queryFn: async () => {
      if (!activeTab) return [];
      const { data, error } = await supabase.from('product_info_rows').select('*').eq('tab_id', activeTab).order('sort_order');
      if (error) throw error;
      return data as Row[];
    },
    enabled: !!activeTab,
  });

  const { data: cells = [] } = useQuery({
    queryKey: ['product-info-cells', activeTab],
    queryFn: async () => {
      if (!activeTab || rows.length === 0) return [];
      const rowIds = rows.map(r => r.id);
      const { data, error } = await supabase.from('product_info_cells').select('*').in('row_id', rowIds);
      if (error) throw error;
      return data as Cell[];
    },
    enabled: !!activeTab && rows.length > 0,
  });

  const getCellContent = (rowId: string, colId: string) => {
    const key = `${rowId}::${colId}`;
    if (key in cellEdits) return cellEdits[key];
    const cell = cells.find(c => c.row_id === rowId && c.column_id === colId);
    return cell?.content || '';
  };

  const setCellValue = (rowId: string, colId: string, value: string) => {
    setCellEdits(prev => ({ ...prev, [`${rowId}::${colId}`]: value }));
  };

  const handleAddRow = async () => {
    if (!activeTab) return;
    const maxOrder = rows.length > 0 ? Math.max(...rows.map(r => r.sort_order)) + 1 : 0;
    const { error } = await supabase.from('product_info_rows').insert({ tab_id: activeTab, sort_order: maxOrder });
    if (error) { toast({ title: 'Erro', description: error.message, variant: 'destructive' }); return; }
    queryClient.invalidateQueries({ queryKey: ['product-info-rows', activeTab] });
  };

  const handleDeleteRow = async (rowId: string) => {
    const { error } = await supabase.from('product_info_rows').delete().eq('id', rowId);
    if (error) { toast({ title: 'Erro', description: error.message, variant: 'destructive' }); return; }
    setCellEdits(prev => {
      const next = { ...prev };
      Object.keys(next).forEach(k => { if (k.startsWith(rowId)) delete next[k]; });
      return next;
    });
    queryClient.invalidateQueries({ queryKey: ['product-info-rows', activeTab] });
    queryClient.invalidateQueries({ queryKey: ['product-info-cells', activeTab] });
  };

  const handleAddColumn = async () => {
    if (!activeTab) return;
    const maxOrder = columns.length > 0 ? Math.max(...columns.map(c => c.sort_order)) + 1 : 0;
    const { error } = await supabase.from('product_info_columns').insert({ tab_id: activeTab, column_name: 'Nova Coluna', sort_order: maxOrder });
    if (error) { toast({ title: 'Erro', description: error.message, variant: 'destructive' }); return; }
    queryClient.invalidateQueries({ queryKey: ['product-info-columns', activeTab] });
  };

  const handleDeleteColumn = async (colId: string) => {
    const { error } = await supabase.from('product_info_columns').delete().eq('id', colId);
    if (error) { toast({ title: 'Erro', description: error.message, variant: 'destructive' }); return; }
    queryClient.invalidateQueries({ queryKey: ['product-info-columns', activeTab] });
    queryClient.invalidateQueries({ queryKey: ['product-info-cells', activeTab] });
  };

  const handleRenameColumn = async (colId: string) => {
    if (!editColName.trim()) return;
    const { error } = await supabase.from('product_info_columns').update({ column_name: editColName.trim() }).eq('id', colId);
    if (error) { toast({ title: 'Erro', description: error.message, variant: 'destructive' }); return; }
    setEditingColId(null);
    queryClient.invalidateQueries({ queryKey: ['product-info-columns', activeTab] });
  };

  const handleRenameTab = async (tabId: string) => {
    if (!editTabName.trim()) return;
    const { error } = await supabase.from('product_info_tabs').update({ tab_name: editTabName.trim() }).eq('id', tabId);
    if (error) { toast({ title: 'Erro', description: error.message, variant: 'destructive' }); return; }
    setEditingTabId(null);
    queryClient.invalidateQueries({ queryKey: ['product-info-tabs'] });
  };

  const handleSaveAllCells = async () => {
    if (Object.keys(cellEdits).length === 0) {
      toast({ title: 'Nada para salvar' });
      return;
    }
    setIsSaving(true);
    try {
      const upserts = Object.entries(cellEdits).map(([key, content]) => {
        const [row_id, column_id] = key.split('::');
        return { row_id, column_id, content, updated_at: new Date().toISOString() };
      });

      for (let i = 0; i < upserts.length; i += 50) {
        const batch = upserts.slice(i, i + 50);
        const { error } = await supabase.from('product_info_cells').upsert(batch, { onConflict: 'row_id,column_id' });
        if (error) throw error;
      }

      setCellEdits({});
      queryClient.invalidateQueries({ queryKey: ['product-info-cells', activeTab] });
      toast({ title: 'Salvo!', description: `${upserts.length} células atualizadas` });
    } catch (err: any) {
      toast({ title: 'Erro ao salvar', description: err.message, variant: 'destructive' });
    }
    setIsSaving(false);
  };

  const hasPendingEdits = Object.keys(cellEdits).length > 0;
  const currentTab = tabs.find(t => t.id === activeTab);

  if (loadingTabs) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center h-64">
          <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-primary/10">
              <PackageSearch className="w-6 h-6 text-primary" />
            </div>
            <div>
              <h1 className="text-2xl font-bold">Info Produtos</h1>
              <p className="text-muted-foreground text-sm">Gerencie informações de produtos por categoria</p>
            </div>
          </div>
          <Button
            onClick={handleSaveAllCells}
            disabled={isSaving || !hasPendingEdits}
            className="gap-2"
            size="sm"
          >
            {isSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
            Salvar {hasPendingEdits && (
              <Badge variant="secondary" className="ml-1 text-xs px-1.5 py-0">
                {Object.keys(cellEdits).length}
              </Badge>
            )}
          </Button>
        </div>

        <Tabs value={activeTab} onValueChange={(v) => { setCellEdits({}); setActiveTab(v); }}>
          <TabsList className="flex-wrap h-auto gap-1.5 bg-muted/50 p-1.5 rounded-xl">
            {tabs.map(tab => (
              <TabsTrigger key={tab.id} value={tab.id} className="flex items-center gap-1.5 rounded-lg data-[state=active]:bg-background data-[state=active]:shadow-sm transition-all">
                {editingTabId === tab.id ? (
                  <div className="flex items-center gap-1" onClick={e => e.stopPropagation()}>
                    <Input
                      value={editTabName}
                      onChange={e => setEditTabName(e.target.value)}
                      className="h-6 w-28 text-xs"
                      onKeyDown={e => { if (e.key === 'Enter') handleRenameTab(tab.id); if (e.key === 'Escape') setEditingTabId(null); }}
                      autoFocus
                    />
                    <Check className="w-3.5 h-3.5 cursor-pointer text-green-500" onClick={() => handleRenameTab(tab.id)} />
                    <X className="w-3.5 h-3.5 cursor-pointer text-destructive" onClick={() => setEditingTabId(null)} />
                  </div>
                ) : (
                  <>
                    {tab.tab_name}
                    <Pencil
                      className="w-3 h-3 opacity-0 group-hover:opacity-100 hover:opacity-100 cursor-pointer text-muted-foreground hover:text-foreground transition-opacity ml-0.5"
                      onClick={(e) => { e.stopPropagation(); setEditingTabId(tab.id); setEditTabName(tab.tab_name); }}
                    />
                  </>
                )}
              </TabsTrigger>
            ))}
          </TabsList>

          {tabs.map(tab => (
            <TabsContent key={tab.id} value={tab.id} className="mt-4">
              <Card className="border-border/50 shadow-sm">
                <CardHeader className="pb-3 border-b border-border/50 bg-muted/30">
                  <div className="flex items-center justify-between">
                    <div>
                      <CardTitle className="text-base font-semibold">{tab.tab_name}</CardTitle>
                      <CardDescription className="text-xs mt-0.5">
                        {columns.length} coluna(s) · {rows.length} linha(s)
                      </CardDescription>
                    </div>
                    <div className="flex gap-2">
                      <Button variant="outline" size="sm" onClick={handleAddColumn} className="gap-1.5 h-8 text-xs">
                        <Columns3 className="w-3.5 h-3.5" /> Coluna
                      </Button>
                      <Button variant="outline" size="sm" onClick={handleAddRow} className="gap-1.5 h-8 text-xs">
                        <Rows3 className="w-3.5 h-3.5" /> Linha
                      </Button>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="p-0">
                  {columns.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
                      <Columns3 className="w-10 h-10 mb-3 opacity-30" />
                      <p className="text-sm">Nenhuma coluna criada</p>
                      <p className="text-xs mt-1">Clique em "Coluna" para começar</p>
                    </div>
                  ) : (
                    <div className="overflow-auto max-h-[65vh]">
                      <Table>
                        <TableHeader className="sticky top-0 z-10">
                          <TableRow className="bg-muted/60 hover:bg-muted/60 border-b border-border/50">
                            <TableHead className="w-10 text-center text-xs font-medium text-muted-foreground">#</TableHead>
                            {columns.map(col => (
                              <TableHead key={col.id} className="min-w-[160px] text-xs font-semibold uppercase tracking-wide text-foreground/80">
                                {editingColId === col.id ? (
                                  <div className="flex items-center gap-1">
                                    <Input
                                      value={editColName}
                                      onChange={e => setEditColName(e.target.value)}
                                      className="h-6 text-xs"
                                      onKeyDown={e => { if (e.key === 'Enter') handleRenameColumn(col.id); if (e.key === 'Escape') setEditingColId(null); }}
                                      autoFocus
                                    />
                                    <Check className="w-3.5 h-3.5 cursor-pointer text-green-500 shrink-0" onClick={() => handleRenameColumn(col.id)} />
                                    <X className="w-3.5 h-3.5 cursor-pointer text-destructive shrink-0" onClick={() => setEditingColId(null)} />
                                  </div>
                                ) : (
                                  <div className="flex items-center gap-1.5 group/col">
                                    <span>{col.column_name}</span>
                                    <div className="flex items-center gap-0.5 opacity-0 group-hover/col:opacity-100 transition-opacity">
                                      <Pencil
                                        className="w-3 h-3 cursor-pointer text-muted-foreground hover:text-foreground"
                                        onClick={() => { setEditingColId(col.id); setEditColName(col.column_name); }}
                                      />
                                      <Trash2
                                        className="w-3 h-3 cursor-pointer text-destructive/70 hover:text-destructive"
                                        onClick={() => handleDeleteColumn(col.id)}
                                      />
                                    </div>
                                  </div>
                                )}
                              </TableHead>
                            ))}
                            <TableHead className="w-12 text-center text-xs font-medium text-muted-foreground">Ações</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {rows.length === 0 ? (
                            <TableRow>
                              <TableCell colSpan={columns.length + 2} className="text-center text-muted-foreground py-12">
                                <Rows3 className="w-8 h-8 mx-auto mb-2 opacity-30" />
                                <p className="text-sm">Nenhuma linha</p>
                                <p className="text-xs mt-1">Clique em "Linha" para adicionar</p>
                              </TableCell>
                            </TableRow>
                          ) : (
                            rows.map((row, idx) => (
                              <TableRow key={row.id} className="group/row hover:bg-muted/20 even:bg-muted/10 border-b border-border/30">
                                <TableCell className="text-center text-xs text-muted-foreground font-mono w-10">{idx + 1}</TableCell>
                                {columns.map(col => (
                                  <TableCell key={col.id} className="p-1.5">
                                    <Textarea
                                      value={getCellContent(row.id, col.id)}
                                      onChange={e => setCellValue(row.id, col.id, e.target.value)}
                                      className="min-h-[32px] text-sm resize-y border-transparent bg-transparent hover:bg-background hover:border-border/50 focus:bg-background focus:border-primary/50 transition-colors rounded-md px-2 py-1.5"
                                      rows={1}
                                    />
                                  </TableCell>
                                ))}
                                <TableCell className="p-1.5 text-center w-12">
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    className="h-7 w-7 text-muted-foreground hover:text-destructive opacity-0 group-hover/row:opacity-100 transition-opacity"
                                    onClick={() => handleDeleteRow(row.id)}
                                  >
                                    <Trash2 className="w-3.5 h-3.5" />
                                  </Button>
                                </TableCell>
                              </TableRow>
                            ))
                          )}
                        </TableBody>
                      </Table>
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>
          ))}
        </Tabs>
      </div>
    </DashboardLayout>
  );
}
