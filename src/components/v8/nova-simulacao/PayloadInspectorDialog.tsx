import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import {
  Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Loader2 } from 'lucide-react';
import { JsonTreeView } from '@/components/admin/JsonTreeView';

interface AttemptRow {
  id: string;
  attempt_number: number | null;
  triggered_by: string | null;
  status: string | null;
  error_kind: string | null;
  error_message: string | null;
  http_status: number | null;
  duration_ms: number | null;
  created_at: string;
  request_payload: any;
  response_body: any;
}

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Linha completa de v8_simulations a inspecionar. */
  simulation: any | null;
}

/**
 * Modal de inspeção de payload — abre ao clicar no olho da coluna "Payload".
 * Mostra de onde vem cada parte do "Motivo": resumo, mensagens, raw_response e
 * a última tentativa registrada em v8_simulation_attempts.
 */
export default function PayloadInspectorDialog({ open, onOpenChange, simulation }: Props) {
  const [attempts, setAttempts] = useState<AttemptRow[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!open || !simulation?.id) {
      setAttempts([]);
      return;
    }
    let cancelled = false;
    (async () => {
      setLoading(true);
      const { data } = await supabase
        .from('v8_simulation_attempts')
        .select('id, attempt_number, triggered_by, status, error_kind, error_message, http_status, duration_ms, created_at, request_payload, response_body')
        .eq('simulation_id', simulation.id)
        .order('attempt_number', { ascending: false })
        .order('created_at', { ascending: false })
        .limit(10);
      if (!cancelled) {
        setAttempts((data ?? []) as AttemptRow[]);
        setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [open, simulation?.id]);

  if (!simulation) return null;
  const s = simulation;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Payload da simulação</DialogTitle>
          <DialogDescription>
            Tudo que o sistema recebeu/gravou para este CPF — útil para entender de
            onde vem o texto do "Motivo".
          </DialogDescription>
        </DialogHeader>

        {/* Resumo */}
        <div className="rounded-lg border border-border bg-muted/20 p-3 text-sm space-y-1">
          <div className="flex flex-wrap gap-x-4 gap-y-1">
            <div><span className="text-muted-foreground">CPF:</span> <span className="font-mono">{s.cpf}</span></div>
            <div><span className="text-muted-foreground">Nome:</span> {s.name ?? '—'}</div>
            <div><span className="text-muted-foreground">Status:</span> <Badge variant="outline">{s.status}</Badge></div>
            <div><span className="text-muted-foreground">Tentativas:</span> {s.attempt_count ?? 0}</div>
            <div><span className="text-muted-foreground">Etapa:</span> {s.last_step ?? '—'}</div>
          </div>
          <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs">
            <div><span className="text-muted-foreground">error_kind:</span> {s.error_kind ?? '—'}</div>
            <div><span className="text-muted-foreground">webhook_status:</span> {s.webhook_status ?? '—'}</div>
            <div><span className="text-muted-foreground">consult_id:</span> <span className="font-mono">{s.consult_id ?? '—'}</span></div>
            <div><span className="text-muted-foreground">v8_simulation_id:</span> <span className="font-mono">{s.v8_simulation_id ?? '—'}</span></div>
          </div>
        </div>

        {/* Motivos / mensagens */}
        <div className="space-y-2">
          <h3 className="text-sm font-semibold">Mensagens (origem do "Motivo" na tabela)</h3>
          <div className="text-xs space-y-1">
            <div className="rounded border border-border p-2">
              <div className="text-muted-foreground mb-1">error_message (geral)</div>
              <pre className="whitespace-pre-wrap font-mono">{s.error_message || <span className="text-muted-foreground italic">—</span>}</pre>
            </div>
            <div className="rounded border border-border p-2">
              <div className="text-muted-foreground mb-1">simulate_error_message (somente da etapa /simulation)</div>
              <pre className="whitespace-pre-wrap font-mono">{s.simulate_error_message || <span className="text-muted-foreground italic">—</span>}</pre>
            </div>
          </div>
        </div>

        {/* raw_response */}
        <div className="space-y-2">
          <h3 className="text-sm font-semibold">raw_response (último payload gravado pela edge / webhook)</h3>
          <div className="rounded border border-border p-2 max-h-72 overflow-auto">
            {s.raw_response
              ? <JsonTreeView data={s.raw_response} defaultExpanded={false} maxDepth={2} />
              : <span className="text-xs text-muted-foreground italic">sem raw_response</span>}
          </div>
        </div>

        {/* Tentativas */}
        <div className="space-y-2">
          <h3 className="text-sm font-semibold">Tentativas registradas (v8_simulation_attempts)</h3>
          {loading ? (
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <Loader2 className="w-3 h-3 animate-spin" /> carregando…
            </div>
          ) : attempts.length === 0 ? (
            <div className="text-xs text-muted-foreground italic">Nenhuma tentativa registrada ainda.</div>
          ) : (
            <div className="space-y-2">
              {attempts.map((a) => (
                <div key={a.id} className="rounded border border-border p-2 space-y-1">
                  <div className="flex flex-wrap items-center gap-2 text-xs">
                    <Badge variant="outline">#{a.attempt_number ?? '?'}</Badge>
                    <Badge variant={a.status === 'success' ? 'default' : a.status === 'failed' ? 'destructive' : 'secondary'}>
                      {a.status ?? '—'}
                    </Badge>
                    <span className="text-muted-foreground">por {a.triggered_by ?? '—'}</span>
                    {a.http_status != null && <span className="text-muted-foreground">HTTP {a.http_status}</span>}
                    {a.duration_ms != null && <span className="text-muted-foreground">{a.duration_ms}ms</span>}
                    <span className="text-muted-foreground">{new Date(a.created_at).toLocaleString('pt-BR')}</span>
                  </div>
                  {a.error_message && (
                    <pre className="text-[11px] whitespace-pre-wrap font-mono text-amber-600">{a.error_message}</pre>
                  )}
                  <details className="text-xs">
                    <summary className="cursor-pointer text-muted-foreground">request_payload</summary>
                    <div className="mt-1 max-h-48 overflow-auto"><JsonTreeView data={a.request_payload} defaultExpanded={false} maxDepth={2} /></div>
                  </details>
                  <details className="text-xs">
                    <summary className="cursor-pointer text-muted-foreground">response_body</summary>
                    <div className="mt-1 max-h-48 overflow-auto"><JsonTreeView data={a.response_body} defaultExpanded={false} maxDepth={2} /></div>
                  </details>
                </div>
              ))}
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
