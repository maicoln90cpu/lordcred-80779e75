import DashboardLayout from '@/components/layout/DashboardLayout';
import { ClipboardList, Search, Calendar as CalendarIcon, Loader2 } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { useState, useEffect } from 'react';
import { format } from 'date-fns';
import { invokeCorban } from '@/lib/invokeCorban';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

interface CachedAsset {
  asset_id: string;
  asset_label: string;
}

export default function CorbanPropostas() {
  const [searchCpf, setSearchCpf] = useState('');
  const [loading, setLoading] = useState(false);
  const [propostas, setPropostas] = useState<any[]>([]);
  const [dateFrom, setDateFrom] = useState<Date | undefined>(() => {
    const d = new Date(); d.setDate(d.getDate() - 90); return d;
  });
  const [dateTo, setDateTo] = useState<Date | undefined>(new Date());
  const [statusFilter, setStatusFilter] = useState<string>('');
  const [bancoFilter, setBancoFilter] = useState<string>('');
  const [cachedStatus, setCachedStatus] = useState<CachedAsset[]>([]);
  const [cachedBancos, setCachedBancos] = useState<CachedAsset[]>([]);

  useEffect(() => {
    (async () => {
      const [statusRes, bancosRes] = await Promise.all([
        supabase.from('corban_assets_cache').select('asset_id, asset_label').eq('asset_type', 'status').order('asset_label'),
        supabase.from('corban_assets_cache').select('asset_id, asset_label').eq('asset_type', 'bancos').order('asset_label'),
      ]);
      setCachedStatus(statusRes.data || []);
      setCachedBancos(bancosRes.data || []);
    })();
  }, []);

  const handleSearch = async () => {
    if (!searchCpf.trim() && !statusFilter && !bancoFilter && !dateFrom) {
      toast.error('Informe ao menos um filtro para buscar');
      return;
    }
    setLoading(true);
    const filters: Record<string, any> = {};
    if (searchCpf.trim()) filters.searchString = searchCpf.replace(/\D/g, '');
    if (statusFilter) filters.status = [statusFilter];
    if (bancoFilter) filters.bancos = [bancoFilter];
    if (dateFrom || dateTo) {
      filters.data = {};
      if (dateFrom) filters.data.startDate = format(dateFrom, 'yyyy-MM-dd');
      if (dateTo) filters.data.endDate = format(dateTo, 'yyyy-MM-dd');
    }

    const { data, error } = await invokeCorban('getPropostas', { filters });
    setLoading(false);
    if (error) {
      toast.error('Erro ao buscar propostas', { description: error });
      return;
    }
    const list = Array.isArray(data) 
      ? data 
      : (data?.propostas || data?.data || data?.result || data?.results || []);
    setPropostas(list);
    if (list.length === 0 && data) {
      console.warn('[CorbanPropostas] Response structure:', JSON.stringify(data).substring(0, 500));
      toast.info('Nenhuma proposta encontrada para os filtros informados');
    } else if (list.length === 0) {
      toast.info('Nenhuma proposta encontrada para os filtros informados');
    }
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <ClipboardList className="w-6 h-6 text-primary" />
            Propostas Corban
          </h1>
          <p className="text-muted-foreground text-sm mt-1">Consultar propostas na plataforma NewCorban</p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Filtros de Busca</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex flex-wrap gap-3 items-end">
              <div className="space-y-1">
                <label className="text-xs text-muted-foreground">CPF / Telefone</label>
                <Input
                  placeholder="Buscar..."
                  value={searchCpf}
                  onChange={(e) => setSearchCpf(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                  className="w-48"
                />
              </div>

              {cachedStatus.length > 0 && (
                <div className="space-y-1">
                  <label className="text-xs text-muted-foreground">Status</label>
                  <Select value={statusFilter} onValueChange={setStatusFilter}>
                    <SelectTrigger className="w-48">
                      <SelectValue placeholder="Todos" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="">Todos</SelectItem>
                      {cachedStatus.map(s => (
                        <SelectItem key={s.asset_id} value={s.asset_id}>{s.asset_label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}

              {cachedBancos.length > 0 && (
                <div className="space-y-1">
                  <label className="text-xs text-muted-foreground">Banco</label>
                  <Select value={bancoFilter} onValueChange={setBancoFilter}>
                    <SelectTrigger className="w-48">
                      <SelectValue placeholder="Todos" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="">Todos</SelectItem>
                      {cachedBancos.map(b => (
                        <SelectItem key={b.asset_id} value={b.asset_id}>{b.asset_label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}

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

              <Button onClick={handleSearch} disabled={loading}>
                {loading ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Search className="w-4 h-4 mr-2" />}
                {loading ? 'Buscando...' : 'Buscar'}
              </Button>
            </div>
          </CardContent>
        </Card>

        {propostas.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle className="text-base">{propostas.length} proposta(s) encontrada(s)</CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>CPF</TableHead>
                      <TableHead>Nome</TableHead>
                      <TableHead>Banco</TableHead>
                      <TableHead>Produto</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Valor Lib.</TableHead>
                      <TableHead>Parcela</TableHead>
                      <TableHead>Prazo</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {propostas.map((p: any, i: number) => (
                      <TableRow key={i}>
                        <TableCell className="font-mono text-xs">{p.cpf || p.cliente?.pessoais?.cpf || '—'}</TableCell>
                        <TableCell>{p.nome || p.cliente?.pessoais?.nome || '—'}</TableCell>
                        <TableCell>{p.banco || p.banco_nome || '—'}</TableCell>
                        <TableCell>{p.produto || '—'}</TableCell>
                        <TableCell>
                          <Badge variant="outline" className="text-xs">{p.status || p.status_nome || '—'}</Badge>
                        </TableCell>
                        <TableCell>{p.valor_liberado ? `R$ ${Number(p.valor_liberado).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}` : '—'}</TableCell>
                        <TableCell>{p.valor_parcela ? `R$ ${Number(p.valor_parcela).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}` : '—'}</TableCell>
                        <TableCell>{p.prazos || p.prazo || '—'}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </DashboardLayout>
  );
}
