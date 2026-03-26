import { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Loader2 } from 'lucide-react';
import { ScrollArea } from '@/components/ui/scroll-area';

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
      <DialogContent className="max-w-5xl max-h-[85vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>Info Produtos</DialogTitle>
        </DialogHeader>

        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <Tabs value={activeTab} onValueChange={setActiveTab} className="flex-1 min-h-0 flex flex-col">
            <TabsList className="flex-wrap h-auto gap-1 shrink-0">
              {tabs.map(tab => (
                <TabsTrigger key={tab.id} value={tab.id}>{tab.tab_name}</TabsTrigger>
              ))}
            </TabsList>

            {tabs.map(tab => (
              <TabsContent key={tab.id} value={tab.id} className="flex-1 min-h-0">
                <ScrollArea className="h-[60vh]">
                  {columns.length === 0 ? (
                    <p className="text-muted-foreground text-center py-8">Nenhuma informação cadastrada nesta aba.</p>
                  ) : rows.length === 0 ? (
                    <p className="text-muted-foreground text-center py-8">Nenhum dado cadastrado.</p>
                  ) : (
                    <div className="border rounded-lg overflow-auto">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            {columns.map(col => (
                              <TableHead key={col.id} className="min-w-[120px] font-semibold">{col.column_name}</TableHead>
                            ))}
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {rows.map(row => (
                            <TableRow key={row.id}>
                              {columns.map(col => (
                                <TableCell key={col.id} className="whitespace-pre-wrap text-sm">
                                  {getCellContent(row.id, col.id) || <span className="text-muted-foreground">—</span>}
                                </TableCell>
                              ))}
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
      </DialogContent>
    </Dialog>
  );
}
