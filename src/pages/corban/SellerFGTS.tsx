import DashboardLayout from '@/components/layout/DashboardLayout';
import { Landmark, Search, Plus, Loader2 } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { useState, useEffect } from 'react';
import { invokeCorban } from '@/lib/invokeCorban';
import { toast } from 'sonner';
import { useCorbanFeatures } from '@/hooks/useCorbanFeatures';

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
  const [inserting, setInserting] = useState(false);
  const [instituicao, setInstituicao] = useState('facta');
  const [logins, setLogins] = useState<Login[]>([]);
  const [selectedLogin, setSelectedLogin] = useState('');
  const { isFeatureVisible } = useCorbanFeatures();

  const canInsert = isFeatureVisible('seller_consulta_fgts');

  useEffect(() => {
    if (!canInsert) return;
    (async () => {
      const { data } = await invokeCorban('listLogins', { instituicao });
      if (data) {
        const list = Array.isArray(data) ? data : (data?.logins || data?.data || []);
        setLogins(list);
        if (list.length > 0) setSelectedLogin(String(list[0].id || ''));
      }
    })();
  }, [instituicao, canInsert]);

  const handleSearch = async () => {
    setLoading(true);
    const { data, error } = await invokeCorban('listQueueFGTS', {
      filters: { searchString: searchCpf.replace(/\D/g, ''), instituicao }
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
      content: { cpf: insertCpf.replace(/\D/g, ''), instituicao, loginId: selectedLogin }
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
              <div className="flex flex-wrap gap-3 items-end">
                <div className="space-y-1">
                  <label className="text-xs text-muted-foreground">CPF</label>
                  <Input
                    placeholder="Somente números..."
                    value={insertCpf}
                    onChange={(e) => setInsertCpf(e.target.value)}
                    className="w-48"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-xs text-muted-foreground">Instituição</label>
                  <Select value={instituicao} onValueChange={setInstituicao}>
                    <SelectTrigger className="w-36">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="facta">Facta</SelectItem>
                      <SelectItem value="mercantil">Mercantil</SelectItem>
                      <SelectItem value="pan">Pan</SelectItem>
                    </SelectContent>
                  </Select>
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
                {loading ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Search className="w-4 h-4 mr-2" />}
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
                    <TableHead>Valor</TableHead>
                    <TableHead>Data</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filaItems.map((item: any, i: number) => (
                    <TableRow key={i}>
                      <TableCell className="font-mono text-xs">{item.cpf || '—'}</TableCell>
                      <TableCell>{item.instituicao || instituicao}</TableCell>
                      <TableCell>
                        <Badge variant="outline" className="text-xs">{item.status || '—'}</Badge>
                      </TableCell>
                      <TableCell>{item.valor ? `R$ ${Number(item.valor).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}` : '—'}</TableCell>
                      <TableCell className="text-xs">{item.data || item.created_at || '—'}</TableCell>
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
