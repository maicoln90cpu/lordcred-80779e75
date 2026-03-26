import { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Loader2, PackageSearch } from 'lucide-react';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';

interface Tab { id: string; tab_name: string; sort_order: number; }
interface Column { id: string; tab_id: string; column_name: string; sort_order: number; }
interface Row { id: string; tab_id: string; sort_order: number; }
interface Cell { id: string; row_id: string; column_id: string; content: string; }

interface ProductInfoPanelProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export default function ProductInfoPanel({ open, onOpenChange }: ProductInfoPanelProps) {
  const [activeTab, setActiveTab] = useState<string>('');

  const { data: tabs = [], isLoading } = useQuery({
    queryKey: ['product-info-tabs'],
    queryFn: async () => {
      const { data, error } = await supabase.from('product_info_tabs').select('*').order('sort_order');
      if (error) throw error;
      return data as Tab[];
    },
    enabled: open,
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
    enabled: !!activeTab && open,
  });

  const { data: rows = [] } = useQuery({
    queryKey: ['product-info-rows', activeTab],
    queryFn: async () => {
      if (!activeTab) return [];
      const { data, error } = await supabase.from('product_info_rows').select('*').eq('tab_id', activeTab).order('sort_order');
      if (error) throw error;
      return data as Row[];
    },
    enabled: !!activeTab && open,
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
    enabled: !!activeTab && rows.length > 0 && open,
  });

  const getCellContent = (rowId: string, colId: string) => {
    const cell = cells.find(c => c.row_id === rowId && c.column_id === colId);
    return cell?.content || '';
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-7xl max-h-[85vh] flex flex-col gap-0 p-0 overflow-hidden">
        {/* Header */}
        <div className="flex items-center gap-3 px-6 py-4 border-b border-border/50 bg-muted/30">
          <div className="p-2 rounded-lg bg-primary/10">
            <PackageSearch className="w-5 h-5 text-primary" />
          </div>
          <div>
            <DialogTitle className="text-lg font-semibold">Info Produtos</DialogTitle>
            <p className="text-xs text-muted-foreground mt-0.5">Consulta de informações de produtos</p>
          </div>
        </div>

        <div className="flex-1 min-h-0 px-6 py-4">
          {isLoading ? (
            <div className="flex items-center justify-center py-16">
              <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
            </div>
          ) : (
            <Tabs value={activeTab} onValueChange={setActiveTab} className="flex-1 min-h-0 flex flex-col">
              <TabsList className="flex-wrap h-auto gap-1 bg-muted/50 p-1.5 rounded-xl shrink-0">
                {tabs.map(tab => (
                  <TabsTrigger key={tab.id} value={tab.id} className="text-xs rounded-lg data-[state=active]:bg-background data-[state=active]:shadow-sm transition-all">
                    {tab.tab_name}
                  </TabsTrigger>
                ))}
              </TabsList>

              {tabs.map(tab => (
                <TabsContent key={tab.id} value={tab.id} className="flex-1 min-h-0 mt-3">
                  <ScrollArea className="h-[65vh]">
                    {columns.length === 0 ? (
                      <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
                        <PackageSearch className="w-10 h-10 mb-3 opacity-20" />
                        <p className="text-sm">Nenhuma informação cadastrada nesta aba</p>
                      </div>
                    ) : rows.length === 0 ? (
                      <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
                        <p className="text-sm">Nenhum dado cadastrado</p>
                      </div>
                    ) : (
                      <div className="border rounded-lg overflow-hidden border-border/50">
                        <Table>
                          <TableHeader>
                             <TableRow className="bg-gradient-to-r from-primary/5 to-transparent hover:from-primary/5 border-b border-border/50">
                              {columns.map(col => (
                                <TableHead key={col.id} className="min-w-[130px] text-xs font-semibold uppercase tracking-wide text-foreground/80 py-3.5 px-5 text-center">
                                  {col.column_name}
                                </TableHead>
                              ))}
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {rows.map((row, idx) => (
                              <TableRow key={row.id} className="even:bg-muted/15 hover:bg-muted/25 border-b border-border/20 transition-colors">
                                {columns.map(col => {
                                  const content = getCellContent(row.id, col.id);
                                  return (
                                    <TableCell key={col.id} className="whitespace-pre-wrap text-sm py-3 px-5 text-center align-middle">
                                      {content || <span className="text-muted-foreground/50">—</span>}
                                    </TableCell>
                                  );
                                })}
                              </TableRow>
                            ))}
                          </TableBody>
                        </Table>
                      </div>
                    )}
                  </ScrollArea>
                </TabsContent>
              ))}
            </Tabs>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
