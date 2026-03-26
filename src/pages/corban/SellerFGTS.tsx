import DashboardLayout from '@/components/layout/DashboardLayout';
import { Landmark, Search, Plus } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { useState } from 'react';
import { invokeCorban } from '@/lib/invokeCorban';
import { toast } from 'sonner';
import { useCorbanFeatures } from '@/hooks/useCorbanFeatures';

export default function SellerFGTS() {
  const [searchCpf, setSearchCpf] = useState('');
  const [loading, setLoading] = useState(false);
  const [filaItems, setFilaItems] = useState<any[]>([]);
  const [insertCpf, setInsertCpf] = useState('');
  const [inserting, setInserting] = useState(false);
  const { isFeatureVisible } = useCorbanFeatures();

  const canInsert = isFeatureVisible('seller_consulta_fgts');

  const handleSearch = async () => {
    setLoading(true);
    const { data, error } = await invokeCorban('listQueueFGTS', {
      filters: { searchString: searchCpf.replace(/\D/g, '') }
    });
    setLoading(false);
    if (error) {
      toast.error('Erro ao buscar', { description: error });
      return;
    }
    const list = Array.isArray(data) ? data : (data?.fila || data?.data || []);
    setFilaItems(list);
    if (list.length === 0) toast.info('Nenhum item encontrado');
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
      toast.error('Erro ao enviar', { description: error });
    } else {
      toast.success('CPF enviado para consulta FGTS!');
      setInsertCpf('');
    }
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
              <div className="flex gap-3">
                <Input
                  placeholder="CPF..."
                  value={insertCpf}
                  onChange={(e) => setInsertCpf(e.target.value)}
                  className="max-w-xs"
                />
                <Button onClick={handleInsert} disabled={inserting}>
                  <Plus className="w-4 h-4 mr-2" />
                  {inserting ? 'Enviando...' : 'Consultar FGTS'}
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Minhas Consultas</CardTitle>
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
                <Search className="w-4 h-4 mr-2" />
                {loading ? 'Buscando...' : 'Buscar'}
              </Button>
            </div>

            {filaItems.length > 0 ? (
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
            ) : (
              <p className="text-sm text-muted-foreground text-center py-4">
                Busque por CPF para ver consultas FGTS
              </p>
            )}
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}
