/**
 * V8WebhooksTab — aba "Webhooks" da página V8 Simulador.
 *
 * Frente D: tela leiga (não-dev) que lista os últimos webhooks recebidos da V8
 * Sistema. Antes, para investigar "esse contrato chegou?" o operador tinha que
 * abrir /admin/audit-logs e filtrar — confuso e cheio de ruído de outras
 * integrações. Aqui tudo já vem pré-filtrado e em linguagem de operação:
 *
 *   Data · Tipo (consulta/operação) · CPF · Status V8 · Resultado
 *
 * Lê v8_webhook_logs direto via RLS (mesma política das outras tabelas v8_*).
 * Mostra detalhe (payload bruto) num drawer simples — opcional.
 */
import { useEffect, useMemo, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Loader2, RefreshCw, Search } from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';

type WebhookLog = {
  id: string;
  event_type: string | null;
  status: string | null;
  consult_id: string | null;
  operation_id: string | null;
  v8_simulation_id: string | null;
  payload: any;
  processed: boolean | null;
  process_error: string | null;
  received_at: string;
};

const TYPE_LABEL: Record<string, string> = {
  consult: 'Consulta',
  operation: 'Operação',
  registration: 'Registro',
  invalid: 'Inválido',
};

function formatDateTime(iso?: string | null) {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleString('pt-BR');
}

function maskCpf(payload: any): string {
  // Tenta extrair CPF/document number do payload bruto.
  const candidates = [
    payload?.documentNumber,
    payload?.document_number,
    payload?.cpf,
    payload?.borrower?.document_number,
    payload?.borrower?.documentNumber,
  ];
  for (const c of candidates) {
    if (typeof c === 'string' && c.length >= 11) {
      const digits = c.replace(/\D/g, '');
      if (digits.length === 11) {
        return digits.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, '$1.$2.$3-$4');
      }
    }
  }
  return '—';
}

function getResultBadge(log: WebhookLog) {
  if (log.process_error) {
    return <Badge variant="destructive">Erro ao processar</Badge>;
  }
  if (log.processed) {
    return <Badge className="bg-emerald-500/15 text-emerald-700 border-emerald-500/40" variant="outline">Processado</Badge>;
  }
  return <Badge variant="secondary">Pendente</Badge>;
}

function getTypeBadge(t: string | null) {
  const label = TYPE_LABEL[String(t || '').toLowerCase()] || (t || '—');
  if (t === 'operation') return <Badge variant="outline" className="border-blue-500/40 text-blue-700">{label}</Badge>;
  if (t === 'consult') return <Badge variant="outline" className="border-purple-500/40 text-purple-700">{label}</Badge>;
  if (t === 'invalid') return <Badge variant="destructive">{label}</Badge>;
  return <Badge variant="outline">{label}</Badge>;
}

export default function V8WebhooksTab() {
  const [logs, setLogs] = useState<WebhookLog[]>([]);
  const [loading, setLoading] = useState(false);
  const [typeFilter, setTypeFilter] = useState<string>('__all__');
  const [statusFilter, setStatusFilter] = useState<string>('__all__');
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState<WebhookLog | null>(null);
  const [replaying, setReplaying] = useState(false);

  async function load() {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('v8_webhook_logs')
        .select('id, event_type, status, consult_id, operation_id, v8_simulation_id, payload, processed, process_error, received_at')
        .order('received_at', { ascending: false })
        .limit(200);
      if (error) throw error;
      setLogs((data ?? []) as WebhookLog[]);
    } catch (err: any) {
      toast.error(`Falha ao carregar webhooks: ${err?.message || err}`);
    } finally {
      setLoading(false);
    }
  }

  async function handleReplayPending() {
    if (!confirm('Reprocessar todos os webhooks pendentes dos últimos 7 dias?\n\nIsso tenta gravar de novo cada evento que ficou marcado como pendente.')) return;
    setReplaying(true);
    try {
      const { data, error } = await supabase.functions.invoke('v8-webhook', {
        body: { action: 'replay_pending', limit: 500 },
      });
      if (error) throw error;
      toast.success(`Replay concluído: ${data?.success ?? 0} ok · ${data?.failed ?? 0} ainda com erro (de ${data?.total ?? 0})`);
      await load();
    } catch (err: any) {
      toast.error(`Falha no replay: ${err?.message || err}`);
    } finally {
      setReplaying(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    const digits = term.replace(/\D/g, '');
    return logs.filter((log) => {
      if (typeFilter !== '__all__' && log.event_type !== typeFilter) return false;
      if (statusFilter === 'processed' && !log.processed) return false;
      if (statusFilter === 'pending' && log.processed) return false;
      if (statusFilter === 'error' && !log.process_error) return false;
      if (term) {
        const cpf = maskCpf(log.payload).replace(/\D/g, '');
        const status = String(log.status || '').toLowerCase();
        const consult = String(log.consult_id || '').toLowerCase();
        const operation = String(log.operation_id || '').toLowerCase();
        const matches = status.includes(term)
          || consult.includes(term)
          || operation.includes(term)
          || (digits.length > 0 && cpf.includes(digits));
        if (!matches) return false;
      }
      return true;
    });
  }, [logs, typeFilter, statusFilter, search]);

  const stats = useMemo(() => {
    const total = logs.length;
    const processed = logs.filter((l) => l.processed).length;
    const pending = logs.filter((l) => !l.processed && !l.process_error).length;
    const error = logs.filter((l) => !!l.process_error).length;
    return { total, processed, pending, error };
  }, [logs]);

  return (
    <div className="space-y-4">
      <div className="rounded-md border border-blue-500/30 bg-blue-500/10 p-3 text-xs leading-relaxed">
        <strong>O que aparece aqui?</strong> Cada vez que a V8 nos avisa de algo
        (uma consulta concluiu, um contrato foi pago, etc.), gravamos o evento aqui.
        Se algum contrato "sumiu" ou um status não atualizou, é o primeiro lugar para conferir.
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <span>Webhooks recebidos da V8</span>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={load} disabled={loading}>
                {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
                <span className="ml-2">Atualizar</span>
              </Button>
              <Button variant="outline" size="sm" onClick={handleReplayPending} disabled={replaying}>
                {replaying ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                Reprocessar pendentes
              </Button>
            </div>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-wrap items-center gap-2 text-xs">
            <Badge variant="outline">{stats.total} total</Badge>
            <Badge className="bg-emerald-500/15 text-emerald-700 border-emerald-500/40" variant="outline">{stats.processed} processados</Badge>
            <Badge variant="secondary">{stats.pending} pendentes</Badge>
            {stats.error > 0 && <Badge variant="destructive">{stats.error} com erro</Badge>}
          </div>

          <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
            <div>
              <Select value={typeFilter} onValueChange={setTypeFilter}>
                <SelectTrigger><SelectValue placeholder="Tipo" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="__all__">Todos os tipos</SelectItem>
                  <SelectItem value="consult">Consulta</SelectItem>
                  <SelectItem value="operation">Operação</SelectItem>
                  <SelectItem value="registration">Registro</SelectItem>
                  <SelectItem value="invalid">Inválido</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger><SelectValue placeholder="Resultado" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="__all__">Todos os resultados</SelectItem>
                  <SelectItem value="processed">Processados</SelectItem>
                  <SelectItem value="pending">Pendentes</SelectItem>
                  <SelectItem value="error">Com erro</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="relative">
              <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="CPF, status V8 ou ID"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-8"
              />
            </div>
          </div>

          <div className="border rounded overflow-x-auto">
            <table className="w-full text-xs">
              <thead className="bg-muted">
                <tr>
                  <th className="px-2 py-1 text-left">Data</th>
                  <th className="px-2 py-1 text-left">Tipo</th>
                  <th className="px-2 py-1 text-left">CPF</th>
                  <th className="px-2 py-1 text-left">Status V8</th>
                  <th className="px-2 py-1 text-left">Resultado</th>
                  <th className="px-2 py-1 text-right">Ação</th>
                </tr>
              </thead>
              <tbody>
                {loading && (
                  <tr><td colSpan={6} className="px-3 py-8 text-center text-muted-foreground">
                    <Loader2 className="inline h-4 w-4 animate-spin mr-2" />Carregando...
                  </td></tr>
                )}
                {!loading && filtered.length === 0 && (
                  <tr><td colSpan={6} className="px-3 py-8 text-center text-muted-foreground">
                    Nenhum webhook encontrado com esses filtros.
                  </td></tr>
                )}
                {!loading && filtered.map((log) => (
                  <tr key={log.id} className="border-t">
                    <td className="px-2 py-1 whitespace-nowrap">{formatDateTime(log.received_at)}</td>
                    <td className="px-2 py-1">{getTypeBadge(log.event_type)}</td>
                    <td className="px-2 py-1 font-mono">{maskCpf(log.payload)}</td>
                    <td className="px-2 py-1">{log.status || '—'}</td>
                    <td className="px-2 py-1">{getResultBadge(log)}</td>
                    <td className="px-2 py-1 text-right">
                      <Button variant="outline" size="sm" onClick={() => setSelected(log)}>
                        Ver detalhes
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      <Dialog open={!!selected} onOpenChange={(open) => !open && setSelected(null)}>
        <DialogContent className="max-w-3xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Detalhe do webhook</DialogTitle>
            <DialogDescription>Conteúdo bruto que a V8 enviou.</DialogDescription>
          </DialogHeader>
          {selected && (
            <div className="space-y-3 text-xs">
              <div className="grid grid-cols-2 gap-2">
                <div><strong>Recebido em:</strong> {formatDateTime(selected.received_at)}</div>
                <div><strong>Tipo:</strong> {selected.event_type || '—'}</div>
                <div><strong>Status V8:</strong> {selected.status || '—'}</div>
                <div><strong>Resultado:</strong> {selected.processed ? 'Processado' : 'Pendente'}</div>
                {selected.consult_id && <div className="col-span-2"><strong>consult_id:</strong> <code>{selected.consult_id}</code></div>}
                {selected.operation_id && <div className="col-span-2"><strong>operation_id:</strong> <code>{selected.operation_id}</code></div>}
                {selected.process_error && (
                  <div className="col-span-2 text-destructive"><strong>Erro:</strong> {selected.process_error}</div>
                )}
              </div>
              <div>
                <strong>Payload:</strong>
                <pre className="mt-1 p-2 bg-muted rounded text-[10px] overflow-x-auto max-h-96">
                  {JSON.stringify(selected.payload, null, 2)}
                </pre>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
