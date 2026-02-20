import { useState } from 'react';
import { Download, Loader2, Database, FileDown } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';

const TABLES = [
  { name: 'chip_lifecycle_logs', label: 'Chip Lifecycle Logs', description: 'Logs de eventos do ciclo de vida dos chips' },
  { name: 'chips', label: 'Chips', description: 'Dados dos chips/instâncias WhatsApp' },
  { name: 'conversations', label: 'Conversations', description: 'Conversas do WhatsApp' },
  { name: 'external_numbers', label: 'External Numbers', description: 'Números externos para aquecimento' },
  { name: 'message_history', label: 'Message History', description: 'Histórico completo de mensagens' },
  { name: 'message_queue', label: 'Message Queue', description: 'Fila de mensagens pendentes' },
  { name: 'profiles', label: 'Profiles', description: 'Perfis de usuários' },
  { name: 'system_settings', label: 'System Settings', description: 'Configurações globais do sistema' },
  { name: 'user_roles', label: 'User Roles', description: 'Roles de acesso dos usuários' },
  { name: 'warming_messages', label: 'Warming Messages', description: 'Templates de mensagens de aquecimento' },
] as const;

type TableName = typeof TABLES[number]['name'];

function downloadCSV(data: Record<string, any>[], filename: string) {
  if (!data || data.length === 0) return;
  const headers = Object.keys(data[0]);
  const csvRows = [
    headers.join(','),
    ...data.map(row =>
      headers.map(h => {
        const val = row[h];
        if (val === null || val === undefined) return '';
        const str = String(val).replace(/"/g, '""');
        return `"${str}"`;
      }).join(',')
    ),
  ];
  const blob = new Blob([csvRows.join('\n')], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${filename}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

async function fetchAllRows(tableName: string) {
  const allData: Record<string, any>[] = [];
  let from = 0;
  const batchSize = 1000;
  while (true) {
    const { data, error } = await (supabase.from(tableName as any).select('*') as any).range(from, from + batchSize - 1);
    if (error) throw error;
    if (!data || data.length === 0) break;
    allData.push(...data);
    if (data.length < batchSize) break;
    from += batchSize;
  }
  return allData;
}

export default function ExportDataTab() {
  const { toast } = useToast();
  const [loadingTable, setLoadingTable] = useState<string | null>(null);
  const [exportingAll, setExportingAll] = useState(false);
  const [counts, setCounts] = useState<Record<string, number>>({});

  const handleExport = async (tableName: string) => {
    setLoadingTable(tableName);
    try {
      const data = await fetchAllRows(tableName);
      setCounts(prev => ({ ...prev, [tableName]: data.length }));
      if (data.length === 0) {
        toast({ title: `${tableName}`, description: 'Tabela vazia — nenhum dado para exportar' });
      } else {
        downloadCSV(data, tableName);
        toast({ title: 'Exportado!', description: `${data.length} registros de ${tableName}` });
      }
    } catch (err: any) {
      toast({ title: 'Erro na exportação', description: err.message, variant: 'destructive' });
    } finally {
      setLoadingTable(null);
    }
  };

  const handleExportAll = async () => {
    setExportingAll(true);
    let total = 0;
    try {
      for (const table of TABLES) {
        const data = await fetchAllRows(table.name);
        setCounts(prev => ({ ...prev, [table.name]: data.length }));
        if (data.length > 0) {
          downloadCSV(data, table.name);
          total += data.length;
        }
        // Small delay between downloads so browser handles them
        await new Promise(r => setTimeout(r, 300));
      }
      toast({ title: 'Exportação completa!', description: `${total} registros exportados de ${TABLES.length} tabelas` });
    } catch (err: any) {
      toast({ title: 'Erro na exportação', description: err.message, variant: 'destructive' });
    } finally {
      setExportingAll(false);
    }
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Database className="w-5 h-5" />
            Exportar Dados (CSV)
          </CardTitle>
          <CardDescription>
            Exporte todos os dados do banco de dados em formato CSV. Para tabelas grandes, a exportação é paginada automaticamente.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Button onClick={handleExportAll} disabled={exportingAll || !!loadingTable} className="w-full mb-6">
            {exportingAll ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <FileDown className="w-4 h-4 mr-2" />}
            Exportar Todas as Tabelas
          </Button>

          <div className="grid gap-3 sm:grid-cols-2">
            {TABLES.map(table => (
              <div
                key={table.name}
                className="flex items-center justify-between rounded-lg border p-3"
              >
                <div className="min-w-0 flex-1">
                  <p className="font-medium text-sm truncate">{table.label}</p>
                  <p className="text-xs text-muted-foreground truncate">{table.description}</p>
                  {counts[table.name] !== undefined && (
                    <Badge variant="secondary" className="mt-1 text-xs">
                      {counts[table.name]} registros
                    </Badge>
                  )}
                </div>
                <Button
                  variant="outline"
                  size="icon"
                  className="ml-2 shrink-0"
                  disabled={loadingTable === table.name || exportingAll}
                  onClick={() => handleExport(table.name)}
                >
                  {loadingTable === table.name ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Download className="w-4 h-4" />
                  )}
                </Button>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
