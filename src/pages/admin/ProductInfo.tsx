import { useState, useEffect, useCallback } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import DashboardLayout from '@/components/layout/DashboardLayout';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';
import { Plus, Trash2, Save, Loader2, Pencil, Check, X, GripVertical } from 'lucide-react';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';

interface Tab { id: string; tab_name: string; sort_order: number; }
interface Column { id: string; tab_id: string; column_name: string; sort_order: number; }
interface Row { id: string; tab_id: string; sort_order: number; }
interface Cell { id: string; row_id: string; column_id: string; content: string; }

export default function ProductInfo() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState<string>('');
  const [isSaving, setIsSaving] = useState(false);

  // Editable state
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

      // Upsert in batches of 50
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
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold">Info Produtos</h1>
            <p className="text-muted-foreground text-sm">Gerencie informações de produtos por categoria. Alterações refletem para toda a equipe.</p>
          </div>
          <Button onClick={handleSaveAllCells} disabled={isSaving || !hasPendingEdits}>
            {isSaving ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Save className="w-4 h-4 mr-2" />}
            Salvar Alterações {hasPendingEdits && `(${Object.keys(cellEdits).length})`}
          </Button>
        </div>

        <Tabs value={activeTab} onValueChange={(v) => { setCellEdits({}); setActiveTab(v); }}>
          <TabsList className="flex-wrap h-auto gap-1">
            {tabs.map(tab => (
              <TabsTrigger key={tab.id} value={tab.id} className="flex items-center gap-1">
                {editingTabId === tab.id ? (
                  <div className="flex items-center gap-1" onClick={e => e.stopPropagation()}>
                    <Input
                      value={editTabName}
                      onChange={e => setEditTabName(e.target.value)}
                      className="h-6 w-28 text-xs"
                      onKeyDown={e => { if (e.key === 'Enter') handleRenameTab(tab.id); if (e.key === 'Escape') setEditingTabId(null); }}
                      autoFocus
                    />
                    <Check className="w-3 h-3 cursor-pointer text-green-500" onClick={() => handleRenameTab(tab.id)} />
                    <X className="w-3 h-3 cursor-pointer text-destructive" onClick={() => setEditingTabId(null)} />
                  </div>
                ) : (
                  <>
                    {tab.tab_name}
                    <Pencil
                      className="w-3 h-3 opacity-50 hover:opacity-100 cursor-pointer ml-1"
                      onClick={(e) => { e.stopPropagation(); setEditingTabId(tab.id); setEditTabName(tab.tab_name); }}
                    />
                  </>
                )}
              </TabsTrigger>
            ))}
          </TabsList>

          {tabs.map(tab => (
            <TabsContent key={tab.id} value={tab.id}>
              <Card>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-lg">{tab.tab_name}</CardTitle>
                    <div className="flex gap-2">
                      <Button variant="outline" size="sm" onClick={handleAddColumn}>
                        <Plus className="w-4 h-4 mr-1" /> Coluna
                      </Button>
                      <Button variant="outline" size="sm" onClick={handleAddRow}>
                        <Plus className="w-4 h-4 mr-1" /> Linha
                      </Button>
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  {columns.length === 0 ? (
                    <p className="text-muted-foreground text-center py-8">Nenhuma coluna criada. Clique em "+ Coluna" para começar.</p>
                  ) : (
                    <div className="border rounded-lg overflow-auto max-h-[60vh]">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead className="w-10">#</TableHead>
                            {columns.map(col => (
                              <TableHead key={col.id} className="min-w-[140px]">
                                {editingColId === col.id ? (
                                  <div className="flex items-center gap-1">
                                    <Input
                                      value={editColName}
                                      onChange={e => setEditColName(e.target.value)}
                                      className="h-6 text-xs"
                                      onKeyDown={e => { if (e.key === 'Enter') handleRenameColumn(col.id); if (e.key === 'Escape') setEditingColId(null); }}
                                      autoFocus
                                    />
                                    <Check className="w-3 h-3 cursor-pointer text-green-500 shrink-0" onClick={() => handleRenameColumn(col.id)} />
                                    <X className="w-3 h-3 cursor-pointer text-destructive shrink-0" onClick={() => setEditingColId(null)} />
                                  </div>
                                ) : (
                                  <div className="flex items-center gap-1 group">
                                    <span>{col.column_name}</span>
                                    <Pencil
                                      className="w-3 h-3 opacity-0 group-hover:opacity-70 cursor-pointer"
                                      onClick={() => { setEditingColId(col.id); setEditColName(col.column_name); }}
                                    />
                                    <Trash2
                                      className="w-3 h-3 opacity-0 group-hover:opacity-70 cursor-pointer text-destructive"
                                      onClick={() => handleDeleteColumn(col.id)}
                                    />
                                  </div>
                                )}
                              </TableHead>
                            ))}
                            <TableHead className="w-10">Ações</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {rows.length === 0 ? (
                            <TableRow>
                              <TableCell colSpan={columns.length + 2} className="text-center text-muted-foreground py-8">
                                Nenhuma linha. Clique em "+ Linha" para adicionar.
                              </TableCell>
                            </TableRow>
                          ) : (
                            rows.map((row, idx) => (
                              <TableRow key={row.id}>
                                <TableCell className="text-xs text-muted-foreground">{idx + 1}</TableCell>
                                {columns.map(col => (
                                  <TableCell key={col.id} className="p-1">
                                    <Textarea
                                      value={getCellContent(row.id, col.id)}
                                      onChange={e => setCellValue(row.id, col.id, e.target.value)}
                                      className="min-h-[36px] text-sm resize-y border-transparent hover:border-border focus:border-primary"
                                      rows={1}
                                    />
                                  </TableCell>
                                ))}
                                <TableCell className="p-1">
                                  <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive hover:text-destructive" onClick={() => handleDeleteRow(row.id)}>
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
