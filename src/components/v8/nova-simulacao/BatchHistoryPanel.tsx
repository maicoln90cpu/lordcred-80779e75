import { useMemo, useState } from 'react';
import { ArrowLeft, History, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { useV8Batches, useV8BatchSimulations } from '@/hooks/useV8Batches';
import BatchProgressTable from './BatchProgressTable';
import { downloadBatchCsv } from '@/lib/v8BatchExport';

/**
 * Histórico de Lotes — Onda B (mai/2026).
 * Lista os últimos 50 lotes na ORDEM em que foram criados (mais novos no topo)
 * e, ao clicar em um deles, renderiza a MESMA BatchProgressTable usada na
 * criação do lote, com realtime ligado pelo hook useV8BatchSimulations.
 */
export default function BatchHistoryPanel() {
  const { batches, loading } = useV8Batches();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const { simulations, lastUpdateAt } = useV8BatchSimulations(selectedId);

  const selected = useMemo(
    () => batches.find((b) => b.id === selectedId) ?? null,
    [batches, selectedId],
  );

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
          parcelas={selected.installments ?? 0}
          lastUpdateAt={lastUpdateAt}
          maxAutoRetry={3}
          awaitingManualSim={0}
          showManualWarning={false}
          onCheckStatus={() => {}}
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

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          <History className="w-4 h-4 text-muted-foreground" /> Histórico de Lotes
        </CardTitle>
        <p className="text-xs text-muted-foreground">
          Últimos 50 lotes em ordem de criação. Clique em um lote para ver o progresso (com atualização em tempo real).
        </p>
      </CardHeader>
      <CardContent>
        {loading && batches.length === 0 ? (
          <div className="flex items-center gap-2 text-sm text-muted-foreground py-6">
            <Loader2 className="w-4 h-4 animate-spin" /> Carregando lotes...
          </div>
        ) : batches.length === 0 ? (
          <div className="text-sm text-muted-foreground py-6 text-center">Nenhum lote ainda.</div>
        ) : (
          <div className="border rounded-md overflow-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Lote</TableHead>
                  <TableHead>Tabela</TableHead>
                  <TableHead className="text-right">Total</TableHead>
                  <TableHead className="text-right">Sucesso</TableHead>
                  <TableHead className="text-right">Falha</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Criado em</TableHead>
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
                    <TableCell>{statusBadge(b.status)}</TableCell>
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
        )}
      </CardContent>
    </Card>
  );
}
