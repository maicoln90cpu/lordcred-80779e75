import { useMemo, useState } from 'react';
import { ArrowLeft, ArrowDown, ArrowUp, ChevronLeft, ChevronRight, History, Loader2, Search, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { useV8Batches, useV8BatchSimulations } from '@/hooks/useV8Batches';
import BatchProgressTable from './BatchProgressTable';
import { downloadBatchCsv } from '@/lib/v8BatchExport';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

const PAGE_SIZE = 50;
const STATUS_ALL = '__all__';

/**
 * Histórico de Lotes — com filtros (nome/status) e paginação server-side.
 * Os filtros aplicam ILIKE no name e EQ no status. A paginação usa range()
 * + count exact para mostrar "Página X de Y".
 */
type SortCol = 'name' | 'config_name' | 'total_count' | 'success_count' | 'failure_count' | 'status' | 'created_at';

export default function BatchHistoryPanel() {
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>(STATUS_ALL);
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [orderBy, setOrderBy] = useState<SortCol>('created_at');
  const [orderDir, setOrderDir] = useState<'asc' | 'desc'>('desc');
  const [page, setPage] = useState(0);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const { batches, totalCount, loading } = useV8Batches({
    page,
    pageSize: PAGE_SIZE,
    search,
    status: statusFilter === STATUS_ALL ? '' : statusFilter,
    dateFrom, dateTo, orderBy, orderDir,
  });
  const { simulations, batch: selectedBatchMeta, lastUpdateAt } = useV8BatchSimulations(selectedId);

  const toggleSort = (col: SortCol) => {
    if (orderBy === col) {
      setOrderDir(d => d === 'asc' ? 'desc' : 'asc');
    } else {
      setOrderBy(col);
      setOrderDir(col === 'created_at' || col === 'name' || col === 'config_name' || col === 'status' ? 'desc' : 'desc');
    }
    setPage(0);
  };
  const sortIcon = (col: SortCol) => orderBy !== col ? null : (orderDir === 'asc' ? <ArrowUp className="inline w-3 h-3 ml-1" /> : <ArrowDown className="inline w-3 h-3 ml-1" />);
  const clearFilters = () => { setSearch(''); setStatusFilter(STATUS_ALL); setDateFrom(''); setDateTo(''); setPage(0); };
  const hasFilters = !!search || statusFilter !== STATUS_ALL || dateFrom || dateTo;

  const selected = useMemo(
    () => batches.find((b) => b.id === selectedId) ?? null,
    [batches, selectedId],
  );

  const totalPages = Math.max(1, Math.ceil(totalCount / PAGE_SIZE));

  const statusBadge = (status: string) => {
    const map: Record<string, { variant: 'default' | 'secondary' | 'outline' | 'destructive'; label: string }> = {
      processing: { variant: 'default', label: 'em execução' },
      scheduled: { variant: 'secondary', label: 'agendado' },
      queued: { variant: 'secondary', label: 'na fila' },
      completed: { variant: 'outline', label: 'concluído' },
      canceled: { variant: 'outline', label: 'cancelado' },
      failed: { variant: 'destructive', label: 'falhou' },
    };
    const cfg = map[status] ?? { variant: 'outline' as const, label: status };
    return <Badge variant={cfg.variant} className="text-[10px] capitalize">{cfg.label}</Badge>;
  };

  if (selected) {
    return (
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <Button variant="ghost" size="sm" onClick={() => setSelectedId(null)} className="gap-1">
            <ArrowLeft className="w-4 h-4" /> Voltar para histórico
          </Button>
          <div className="text-xs text-muted-foreground">
            Lote: <strong className="text-foreground">{selected.name}</strong>
            {' · '}criado em {new Date(selected.created_at).toLocaleString('pt-BR')}
          </div>
        </div>
        <BatchProgressTable
          simulations={simulations}
          batch={selectedBatchMeta}
          parcelas={selected.installments ?? 0}
          lastUpdateAt={lastUpdateAt}
          maxAutoRetry={3}
          awaitingManualSim={0}
          showManualWarning={false}
          onCheckStatus={() => {}}
          onResumeBatch={async (bid) => {
            const { error } = await supabase.from('v8_batches')
              .update({ is_paused: false, paused_at: null, paused_by: null })
              .eq('id', bid);
            if (error) toast.error('Falha ao retomar: ' + error.message);
            else toast.success('▶ Lote retomado');
          }}
          actionsSlot={
            <Button
              variant="outline"
              size="sm"
              disabled={simulations.length === 0}
              onClick={() => downloadBatchCsv(simulations, selected.name)}
            >
              Exportar CSV
            </Button>
          }
        />
      </div>
    );
  }

  const fromIdx = totalCount === 0 ? 0 : page * PAGE_SIZE + 1;
  const toIdx = Math.min((page + 1) * PAGE_SIZE, totalCount);

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          <History className="w-4 h-4 text-muted-foreground" /> Histórico de Lotes
        </CardTitle>
        <p className="text-xs text-muted-foreground">
          Lotes em ordem de criação. Use os filtros para localizar e clique para ver o progresso (com atualização em tempo real).
        </p>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="flex flex-wrap gap-2 items-center">
          <div className="relative flex-1 min-w-[220px]">
            <Search className="w-4 h-4 absolute left-2 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Buscar por nome do lote..."
              value={search}
              onChange={(e) => { setSearch(e.target.value); setPage(0); }}
              className="pl-8 h-9"
            />
          </div>
          <Select
            value={statusFilter}
            onValueChange={(v) => { setStatusFilter(v); setPage(0); }}
          >
            <SelectTrigger className="w-[180px] h-9">
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={STATUS_ALL}>Todos os status</SelectItem>
              <SelectItem value="processing">Em execução</SelectItem>
              <SelectItem value="scheduled">Agendado</SelectItem>
              <SelectItem value="queued">Na fila</SelectItem>
              <SelectItem value="completed">Concluído</SelectItem>
              <SelectItem value="canceled">Cancelado</SelectItem>
              <SelectItem value="failed">Falhou</SelectItem>
            </SelectContent>
          </Select>
          <div className="flex items-center gap-1 text-xs">
            <span className="text-muted-foreground">De:</span>
            <Input type="date" value={dateFrom} onChange={(e) => { setDateFrom(e.target.value); setPage(0); }} className="h-9 w-[140px]" />
            <span className="text-muted-foreground">Até:</span>
            <Input type="date" value={dateTo} onChange={(e) => { setDateTo(e.target.value); setPage(0); }} className="h-9 w-[140px]" />
          </div>
          {hasFilters && (
            <Button variant="ghost" size="sm" onClick={clearFilters} className="gap-1 h-9">
              <X className="w-3 h-3" /> Limpar
            </Button>
          )}
          <div className="text-xs text-muted-foreground ml-auto">
            {totalCount > 0 ? <>Mostrando <strong>{fromIdx}–{toIdx}</strong> de <strong>{totalCount}</strong></> : null}
          </div>
        </div>

        {loading && batches.length === 0 ? (
          <div className="flex items-center gap-2 text-sm text-muted-foreground py-6">
            <Loader2 className="w-4 h-4 animate-spin" /> Carregando lotes...
          </div>
        ) : batches.length === 0 ? (
          <div className="text-sm text-muted-foreground py-6 text-center">
            {search || statusFilter !== STATUS_ALL ? 'Nenhum lote para os filtros aplicados.' : 'Nenhum lote ainda.'}
          </div>
        ) : (
          <>
            <div className="border rounded-md overflow-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="cursor-pointer select-none" onClick={() => toggleSort('name')}>Lote{sortIcon('name')}</TableHead>
                    <TableHead className="cursor-pointer select-none" onClick={() => toggleSort('config_name')}>Tabela{sortIcon('config_name')}</TableHead>
                    <TableHead className="text-right cursor-pointer select-none" onClick={() => toggleSort('total_count')}>Total{sortIcon('total_count')}</TableHead>
                    <TableHead className="text-right cursor-pointer select-none" onClick={() => toggleSort('success_count')}>Sucesso{sortIcon('success_count')}</TableHead>
                    <TableHead className="text-right cursor-pointer select-none" onClick={() => toggleSort('failure_count')}>Falha{sortIcon('failure_count')}</TableHead>
                    <TableHead className="cursor-pointer select-none" onClick={() => toggleSort('status')}>Status{sortIcon('status')}</TableHead>
                    <TableHead className="cursor-pointer select-none" onClick={() => toggleSort('created_at')}>Criado em{sortIcon('created_at')}</TableHead>
                    <TableHead className="text-right">Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {batches.map((b) => (
                    <TableRow key={b.id} className="cursor-pointer hover:bg-muted/40" onClick={() => setSelectedId(b.id)}>
                      <TableCell className="font-medium">{b.name}</TableCell>
                      <TableCell className="text-xs text-muted-foreground">{b.config_name ?? '—'}</TableCell>
                      <TableCell className="text-right tabular-nums">{b.total_count}</TableCell>
                      <TableCell className="text-right tabular-nums text-emerald-600">{b.success_count}</TableCell>
                      <TableCell className="text-right tabular-nums text-destructive">{b.failure_count}</TableCell>
                      <TableCell className="space-x-1">
                        {statusBadge(b.status)}
                        {(b as any).is_paused && (
                          <Badge variant="outline" className="text-[10px] border-amber-500/60 text-amber-700 dark:text-amber-400 bg-amber-500/10">⏸ pausado</Badge>
                        )}
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground">
                        {new Date(b.created_at).toLocaleString('pt-BR')}
                      </TableCell>
                      <TableCell className="text-right">
                        <Button size="sm" variant="ghost" onClick={(e) => { e.stopPropagation(); setSelectedId(b.id); }}>
                          Ver progresso
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>

            <div className="flex items-center justify-between pt-1">
              <div className="text-xs text-muted-foreground">
                Página <strong>{page + 1}</strong> de <strong>{totalPages}</strong>
              </div>
              <div className="flex gap-1">
                <Button
                  variant="outline"
                  size="sm"
                  disabled={page === 0 || loading}
                  onClick={() => setPage((p) => Math.max(0, p - 1))}
                >
                  <ChevronLeft className="w-4 h-4" /> Anterior
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={page + 1 >= totalPages || loading}
                  onClick={() => setPage((p) => p + 1)}
                >
                  Próxima <ChevronRight className="w-4 h-4" />
                </Button>
              </div>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}
