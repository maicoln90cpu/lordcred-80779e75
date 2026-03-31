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

interface NormalizedProposta {
  proposta_id: string | null;
  cpf: string | null;
  nome: string | null;
  telefone: string | null;
  banco: string | null;
  produto: string | null;
  status: string | null;
  valor_liberado: number | null;
  valor_parcela: number | null;
  prazo: number | string | null;
  data_cadastro: string | null;
  data_pagamento: string | null;
  convenio: string | null;
}

const fmtBRL = (v: number | null) => v != null ? `R$ ${Number(v).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}` : '—';

export default function CorbanPropostas() {
  const [searchCpf, setSearchCpf] = useState('');
  const [loading, setLoading] = useState(false);
  const [propostas, setPropostas] = useState<NormalizedProposta[]>([]);
  const [page, setPage] = useState(0);
  const PAGE_SIZE = 30;
  const [dateFrom, setDateFrom] = useState<Date | undefined>(() => {
    const d = new Date(); d.setDate(d.getDate() - 30); return d;
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
    const filters: Record<string, any> = {
      status: statusFilter ? [statusFilter] : [],
    };
    if (searchCpf.trim()) filters.searchString = searchCpf.replace(/\D/g, '');
    if (bancoFilter) filters.bancos = [bancoFilter];
    if (dateFrom || dateTo) {
      filters.data = {
        tipo: 'cadastro',
        startDate: dateFrom ? format(dateFrom, 'yyyy-MM-dd') : undefined,
        endDate: dateTo ? format(dateTo, 'yyyy-MM-dd') : undefined,
      };
    }

    const { data, error } = await invokeCorban('getPropostas', { filters });
    setLoading(false);
    setPage(0);
    if (error) {
      toast.error('Erro ao buscar propostas', { description: error });
      return;
    }
    const list: NormalizedProposta[] = Array.isArray(data) ? data : [];
    setPropostas(list);
    if (list.length === 0) {
      toast.info('Nenhuma proposta encontrada para os filtros informados');
    }
  };

  const totalPages = Math.ceil(propostas.length / PAGE_SIZE);
  const pagedPropostas = propostas.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);

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
                      <TableHead>Data Cadastro</TableHead>
                      <TableHead>Convênio</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {pagedPropostas.map((p, i) => (
                      <TableRow key={`${p.proposta_id || i}`}>
                        <TableCell className="font-mono text-xs">{p.cpf || '—'}</TableCell>
                        <TableCell>{p.nome || '—'}</TableCell>
                        <TableCell>{p.banco || '—'}</TableCell>
                        <TableCell>{p.produto || '—'}</TableCell>
                        <TableCell>
                          <Badge variant="outline" className="text-xs">{p.status || '—'}</Badge>
                        </TableCell>
                        <TableCell>{fmtBRL(p.valor_liberado)}</TableCell>
                        <TableCell>{fmtBRL(p.valor_parcela)}</TableCell>
                        <TableCell>{p.prazo || '—'}</TableCell>
                        <TableCell className="text-xs whitespace-nowrap">{p.data_cadastro || '—'}</TableCell>
                        <TableCell className="text-xs">{p.convenio || '—'}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
              {totalPages > 1 && (
                <div className="flex items-center justify-center gap-2 py-3 border-t">
                  <Button variant="outline" size="sm" disabled={page === 0} onClick={() => setPage(p => p - 1)}>Anterior</Button>
                  <span className="text-xs text-muted-foreground">Página {page + 1} de {totalPages}</span>
                  <Button variant="outline" size="sm" disabled={page >= totalPages - 1} onClick={() => setPage(p => p + 1)}>Próxima</Button>
                </div>
              )}
            </CardContent>
          </Card>
        )}
      </div>
    </DashboardLayout>
  );
}