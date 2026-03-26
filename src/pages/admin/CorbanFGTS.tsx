import DashboardLayout from '@/components/layout/DashboardLayout';
import { Landmark, Search, Plus } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { useState } from 'react';
import { invokeCorban } from '@/lib/invokeCorban';
import { toast } from 'sonner';

export default function CorbanFGTS() {
  const [searchCpf, setSearchCpf] = useState('');
  const [loading, setLoading] = useState(false);
  const [filaItems, setFilaItems] = useState<any[]>([]);
  const [insertCpf, setInsertCpf] = useState('');
  const [inserting, setInserting] = useState(false);

  const handleSearchFila = async () => {
    setLoading(true);
    const { data, error } = await invokeCorban('listQueueFGTS', {
      filters: { searchString: searchCpf.replace(/\D/g, '') }
    });
    setLoading(false);
    if (error) {
      toast.error('Erro ao buscar fila FGTS', { description: error });
      return;
    }
    const list = Array.isArray(data) ? data : (data?.fila || data?.data || []);
    setFilaItems(list);
    if (list.length === 0) toast.info('Nenhum item encontrado na fila');
  };

  const handleInsert = async () => {
    if (!insertCpf.trim()) {
      toast.error('Informe um CPF');
      return;
    }
    setInserting(true);
    const { error } = await invokeCorban('insertQueueFGTS', {
      content: { cpf: insertCpf.replace(/\D/g, ''), instituicao: 'facta' }
    });
    setInserting(false);
    if (error) {
      toast.error('Erro ao incluir na fila', { description: error });
    } else {
      toast.success('CPF incluído na fila FGTS!');
      setInsertCpf('');
    }
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Landmark className="w-6 h-6 text-primary" />
            FGTS — Corban
          </h1>
          <p className="text-muted-foreground text-sm mt-1">Gerenciar fila de consultas FGTS</p>
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
                <div className="flex gap-3">
                  <Input
                    placeholder="CPF ou telefone..."
                    value={searchCpf}
                    onChange={(e) => setSearchCpf(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && handleSearchFila()}
                    className="max-w-xs"
                  />
                  <Button onClick={handleSearchFila} disabled={loading}>
                    <Search className="w-4 h-4 mr-2" />
                    {loading ? 'Buscando...' : 'Buscar'}
                  </Button>
                </div>
              </CardContent>
            </Card>

            {filaItems.length > 0 && (
              <Card>
                <CardContent className="p-0">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>CPF</TableHead>
                        <TableHead>Instituição</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Data</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filaItems.map((item: any, i: number) => (
                        <TableRow key={i}>
                          <TableCell className="font-mono text-xs">{item.cpf || '—'}</TableCell>
                          <TableCell>{item.instituicao || '—'}</TableCell>
                          <TableCell>{item.status || '—'}</TableCell>
                          <TableCell>{item.data || item.created_at || '—'}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>
            )}
          </TabsContent>

          <TabsContent value="incluir">
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Incluir CPF na Fila FGTS</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex gap-3">
                  <Input
                    placeholder="CPF..."
                    value={insertCpf}
                    onChange={(e) => setInsertCpf(e.target.value)}
                    className="max-w-xs"
                  />
                  <Button onClick={handleInsert} disabled={inserting}>
                    <Plus className="w-4 h-4 mr-2" />
                    {inserting ? 'Enviando...' : 'Enviar para Fila'}
                  </Button>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </DashboardLayout>
  );
}
