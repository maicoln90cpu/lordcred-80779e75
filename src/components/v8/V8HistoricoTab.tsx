import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ChevronDown, ChevronRight } from 'lucide-react';
import { useV8Batches, useV8BatchSimulations } from '@/hooks/useV8Batches';

function BatchDetail({ batchId }: { batchId: string }) {
  const { simulations } = useV8BatchSimulations(batchId);
  return (
    <div className="border rounded mt-2 overflow-x-auto">
      <table className="w-full text-xs">
        <thead className="bg-muted">
          <tr>
            <th className="px-2 py-1 text-left">CPF</th>
            <th className="px-2 py-1 text-left">Nome</th>
            <th className="px-2 py-1 text-left">Status</th>
            <th className="px-2 py-1 text-right">Liberado</th>
            <th className="px-2 py-1 text-right">Parcela</th>
            <th className="px-2 py-1 text-right">Margem</th>
            <th className="px-2 py-1 text-right">A cobrar</th>
          </tr>
        </thead>
        <tbody>
          {simulations.map((s) => (
            <tr key={s.id} className="border-t">
              <td className="px-2 py-1 font-mono">{s.cpf}</td>
              <td className="px-2 py-1">{s.nome || '—'}</td>
              <td className="px-2 py-1">
                <Badge
                  variant={s.status === 'success' ? 'default' : s.status === 'failed' ? 'destructive' : 'secondary'}
                  className={s.status === 'success' ? 'bg-green-600' : ''}
                >
                  {s.status}
                </Badge>
              </td>
              <td className="px-2 py-1 text-right">{s.valor_liberado != null ? `R$ ${s.valor_liberado.toFixed(2)}` : '—'}</td>
              <td className="px-2 py-1 text-right">{s.valor_parcela != null ? `R$ ${s.valor_parcela.toFixed(2)}` : '—'}</td>
              <td className="px-2 py-1 text-right">{s.margem_empresa != null ? `R$ ${s.margem_empresa.toFixed(2)}` : '—'}</td>
              <td className="px-2 py-1 text-right">{s.valor_a_cobrar != null ? `R$ ${s.valor_a_cobrar.toFixed(2)}` : '—'}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default function V8HistoricoTab() {
  const { batches, loading } = useV8Batches();
  const [expanded, setExpanded] = useState<string | null>(null);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Histórico de Lotes</CardTitle>
      </CardHeader>
      <CardContent>
        {loading && <p className="text-sm text-muted-foreground">Carregando...</p>}
        {!loading && batches.length === 0 && (
          <p className="text-sm text-muted-foreground">Nenhum lote encontrado.</p>
        )}
        <div className="space-y-2">
          {batches.map((b) => {
            const successRate = b.total_count > 0 ? Math.round((b.success_count / b.total_count) * 100) : 0;
            const isOpen = expanded === b.id;
            return (
              <div key={b.id} className="border rounded">
                <button
                  type="button"
                  onClick={() => setExpanded(isOpen ? null : b.id)}
                  className="w-full flex items-center gap-2 p-3 hover:bg-muted/50 transition-colors text-left"
                >
                  {isOpen ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                  <div className="flex-1">
                    <div className="font-medium text-sm">{b.name}</div>
                    <div className="text-xs text-muted-foreground">
                      {b.config_label || b.config_id} • {b.parcelas}x • {new Date(b.created_at).toLocaleString('pt-BR')}
                    </div>
                  </div>
                  <Badge variant={b.status === 'completed' ? 'default' : 'secondary'} className={b.status === 'completed' ? 'bg-green-600' : ''}>
                    {b.status}
                  </Badge>
                  <Badge variant="outline">{b.success_count}/{b.total_count} ok</Badge>
                  <Badge variant="outline">{successRate}%</Badge>
                </button>
                {isOpen && <div className="px-3 pb-3"><BatchDetail batchId={b.id} /></div>}
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}
