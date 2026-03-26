import DashboardLayout from '@/components/layout/DashboardLayout';
import { Landmark, Search, Plus, Loader2, Calendar as CalendarIcon } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { useState, useEffect } from 'react';
import { format } from 'date-fns';
import { invokeCorban } from '@/lib/invokeCorban';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

interface Login {
  id: string;
  nome?: string;
  label?: string;
}

export default function CorbanFGTS() {
  const [searchCpf, setSearchCpf] = useState('');
  const [loading, setLoading] = useState(false);
  const [filaItems, setFilaItems] = useState<any[]>([]);
  const [insertCpf, setInsertCpf] = useState('');
  const [inserting, setInserting] = useState(false);
  const [instituicao, setInstituicao] = useState('facta');
  const [logins, setLogins] = useState<Login[]>([]);
  const [selectedLogin, setSelectedLogin] = useState('');
  const [loadingLogins, setLoadingLogins] = useState(false);
  const [dateFrom, setDateFrom] = useState<Date | undefined>(() => {
    const d = new Date(); d.setDate(d.getDate() - 30); return d;
  });
  const [dateTo, setDateTo] = useState<Date | undefined>(new Date());

  // Fetch logins when instituicao changes
  useEffect(() => {
    (async () => {
      setLoadingLogins(true);
      const { data, error } = await invokeCorban('listLogins', { instituicao });
      setLoadingLogins(false);
      if (!error && data) {
        const raw = Array.isArray(data) ? data : (data?.logins || data?.data || []);
        const list = Array.isArray(raw) ? raw.map((l: any) => typeof l === 'string' ? { id: l, nome: l } : l) : [];
        setLogins(list);
        if (list.length > 0) setSelectedLogin(String(list[0].id || ''));
      }
    })();
  }, [instituicao]);

  const handleSearchFila = async () => {
    setLoading(true);
    const filters: Record<string, any> = {
      instituicao,
    };
    if (searchCpf.trim()) filters.searchString = searchCpf.replace(/\D/g, '');
    if (dateFrom || dateTo) {
      filters.data = {};
      if (dateFrom) filters.data.startDate = format(dateFrom, 'yyyy-MM-dd');
      if (dateTo) filters.data.endDate = format(dateTo, 'yyyy-MM-dd');
      else filters.data.endDate = format(new Date(), 'yyyy-MM-dd');
    }

    const { data, error } = await invokeCorban('listQueueFGTS', { filters });
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
    if (!selectedLogin) {
      toast.error('Selecione um login');
      return;
    }
    setInserting(true);
    const { error } = await invokeCorban('insertQueueFGTS', {
      content: {
        cpf: insertCpf.replace(/\D/g, ''),
        instituicao,
        loginId: selectedLogin,
      }
    });
    setInserting(false);
    if (error) {
      toast.error('Erro ao incluir na fila', { description: error });
    } else {
      toast.success('CPF incluído na fila FGTS com sucesso!');
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
          <p className="text-muted-foreground text-sm mt-1">Gerenciar fila de consultas FGTS via NewCorban</p>
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
                <div className="flex flex-wrap gap-3 items-end">
                  <div className="space-y-1">
                    <label className="text-xs text-muted-foreground">CPF / Telefone</label>
                    <Input
                      placeholder="Buscar..."
                      value={searchCpf}
                      onChange={(e) => setSearchCpf(e.target.value)}
                      onKeyDown={(e) => e.key === 'Enter' && handleSearchFila()}
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
                    <label className="text-xs text-muted-foreground">Data início</label>
                    <Popover>
                      <PopoverTrigger asChild>
                        <Button variant="outline" size="sm" className={cn("w-36 justify-start text-left font-normal", !dateFrom && "text-muted-foreground")}>
                          <CalendarIcon className="mr-2 h-3.5 w-3.5" />
                          {dateFrom ? format(dateFrom, 'dd/MM/yyyy') : 'Início'}
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-auto p-0" align="start">
                        <Calendar mode="single" selected={dateFrom} onSelect={setDateFrom} disabled={(d) => d > new Date()} initialFocus />
                      </PopoverContent>
                    </Popover>
                  </div>

                  <div className="space-y-1">
                    <label className="text-xs text-muted-foreground">Data fim</label>
                    <Popover>
                      <PopoverTrigger asChild>
                        <Button variant="outline" size="sm" className={cn("w-36 justify-start text-left font-normal", !dateTo && "text-muted-foreground")}>
                          <CalendarIcon className="mr-2 h-3.5 w-3.5" />
                          {dateTo ? format(dateTo, 'dd/MM/yyyy') : 'Fim'}
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-auto p-0" align="start">
                        <Calendar mode="single" selected={dateTo} onSelect={setDateTo} disabled={(d) => d > new Date()} initialFocus />
                      </PopoverContent>
                    </Popover>
                  </div>

                  <Button onClick={handleSearchFila} disabled={loading}>
                    {loading ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Search className="w-4 h-4 mr-2" />}
                    {loading ? 'Buscando...' : 'Buscar'}
                  </Button>
                </div>
              </CardContent>
            </Card>

            {filaItems.length > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">{filaItems.length} item(ns) na fila</CardTitle>
                </CardHeader>
                <CardContent className="p-0">
                  <div className="overflow-x-auto">
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
                  </div>
                </CardContent>
              </Card>
            )}
          </TabsContent>

          <TabsContent value="incluir">
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Incluir CPF na Fila FGTS</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
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
                    <label className="text-xs text-muted-foreground">Login {loadingLogins && '(carregando...)'}</label>
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
