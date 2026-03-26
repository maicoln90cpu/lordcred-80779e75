import DashboardLayout from '@/components/layout/DashboardLayout';
import { ClipboardList, Search } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { useState } from 'react';
import { invokeCorban } from '@/lib/invokeCorban';
import { toast } from 'sonner';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';

export default function SellerPropostas() {
  const [searchCpf, setSearchCpf] = useState('');
  const [loading, setLoading] = useState(false);
  const [propostas, setPropostas] = useState<any[]>([]);

  const handleSearch = async () => {
    if (!searchCpf.trim()) {
      toast.error('Informe um CPF para buscar');
      return;
    }
    setLoading(true);
    const { data, error } = await invokeCorban('getPropostas', {
      filters: { searchString: searchCpf.replace(/\D/g, '') }
    });
    setLoading(false);
    if (error) {
      toast.error('Erro ao buscar propostas', { description: error });
      return;
    }
    const list = Array.isArray(data) ? data : (data?.propostas || data?.data || []);
    setPropostas(list);
    if (list.length === 0) toast.info('Nenhuma proposta encontrada');
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
            <div className="flex gap-3">
              <Input
                placeholder="CPF do cliente..."
                value={searchCpf}
                onChange={(e) => setSearchCpf(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                className="max-w-xs"
              />
              <Button onClick={handleSearch} disabled={loading}>
                <Search className="w-4 h-4 mr-2" />
                {loading ? 'Buscando...' : 'Buscar'}
              </Button>
            </div>
          </CardContent>
        </Card>

        {propostas.length > 0 && (
          <Card>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Nome</TableHead>
                    <TableHead>Banco</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Valor</TableHead>
                    <TableHead>Parcela</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {propostas.map((p: any, i: number) => (
                    <TableRow key={i}>
                      <TableCell>{p.nome || p.cliente?.pessoais?.nome || '—'}</TableCell>
                      <TableCell>{p.banco || p.banco_nome || '—'}</TableCell>
                      <TableCell>{p.status || '—'}</TableCell>
                      <TableCell>{p.valor_liberado ? `R$ ${p.valor_liberado}` : '—'}</TableCell>
                      <TableCell>{p.valor_parcela ? `R$ ${p.valor_parcela}` : '—'}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        )}
      </div>
    </DashboardLayout>
  );
}
