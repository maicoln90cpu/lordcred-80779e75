/**
 * V8WebhooksTab — aba "Webhooks" da página V8 Simulador.
 *
 * Frente D (entrega original): tela leiga (não-dev) que lista os últimos webhooks
 * recebidos da V8 Sistema.
 *
 * Frentes 1 + 2 (correções desta iteração):
 *  - CPF: a V8 NÃO envia CPF nos webhooks. Enriquecemos cruzando consult_id com
 *    v8_simulations e operation_id com v8_operations_local para mostrar o CPF
 *    que já guardamos no nosso banco.
 *  - Contadores reais por tipo: buscamos COUNT agregado direto do banco para
 *    mostrar quantos consult/operation/registration/invalid existem de verdade
 *    (independente do limite de 200 da listagem).
 *  - Filtro de tipo passa a refazer a busca no banco (não filtra em memória),
 *    para que "Operação" sempre retorne os 200 últimos daquele tipo, mesmo se
 *    'consult' for 99% do volume.
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
  // Frente E: cpf agora é coluna nativa, populada por trigger BEFORE INSERT
  // (v8_webhook_logs_set_cpf) + backfill em webhooks antigos.
  cpf: string | null;
  // Frente D: payload (JSONB grande) NÃO vem na listagem para reduzir egress.
  // Só é carregado sob demanda quando o usuário clica em "Ver detalhes".
  payload?: any;
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

const ALL_TYPES = ['consult', 'operation', 'registration', 'invalid'] as const;

function formatDateTime(iso?: string | null) {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleString('pt-BR');
}

function maskCpfDigits(digits?: string | null): string {
  if (!digits) return '—';
  const clean = String(digits).replace(/\D/g, '');
  if (clean.length !== 11) return '—';
  return clean.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, '$1.$2.$3-$4');
}

function cpfFromPayload(payload: any): string | null {
  // Fallback: se a V8 algum dia mandar CPF no payload, aproveitamos.
  const candidates = [
    payload?.documentNumber,
    payload?.document_number,
    payload?.cpf,
    payload?.borrower?.document_number,
    payload?.borrower?.documentNumber,
  ];
  for (const c of candidates) {
    if (typeof c === 'string') {
      const digits = c.replace(/\D/g, '');
      if (digits.length === 11) return digits;
    }
  }
  return null;
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
  // Frente D: payload é carregado sob demanda quando o usuário clica em "Ver detalhes"
  const [selectedPayload, setSelectedPayload] = useState<{ loading: boolean; data: any | null }>({ loading: false, data: null });
  const [replaying, setReplaying] = useState(false);
  const [cpfMap, setCpfMap] = useState<Record<string, string>>({}); // log.id -> cpf digits
  const [typeCounts, setTypeCounts] = useState<Record<string, number>>({});

  async function openDetails(log: WebhookLog) {
    setSelected(log);
    setSelectedPayload({ loading: true, data: null });
    const { data } = await supabase
      .from('v8_webhook_logs')
      .select('payload')
      .eq('id', log.id)
      .maybeSingle();
    setSelectedPayload({ loading: false, data: data?.payload ?? null });
  }

  /**
   * Busca contadores reais por tipo em UMA única consulta agregada.
   *
   * Antes: 4 SELECT count(*) ... WHERE event_type=X em paralelo. Sem índice
   * em event_type a tabela (252 MB / 110k linhas) fazia 4 seq-scans e
   * o PostgREST estourava timeout — contadores apareciam zerados.
   *
   * Depois (Frente A): RPC v8_webhook_type_counts() com GROUP BY +
   * idx_v8_webhook_logs_event_type. Resposta em milissegundos.
   */
  async function loadTypeCounts() {
    try {
      const { data, error } = await supabase.rpc('v8_webhook_type_counts');
      if (error) throw error;
      const map: Record<string, number> = {};
      for (const t of ALL_TYPES) map[t] = 0; // garante chaves mesmo sem dados
      (data ?? []).forEach((row: any) => {
        const key = String(row?.event_type ?? '').toLowerCase();
        if (ALL_TYPES.includes(key as any)) {
          map[key] = Number(row?.total ?? 0);
        }
      });
      setTypeCounts(map);
    } catch (err) {
      // Fallback resiliente: se a RPC falhar, evita travar a tela.
      console.error('[V8 webhooks] loadTypeCounts falhou:', err);
      setTypeCounts({ consult: 0, operation: 0, registration: 0, invalid: 0 });
    }
  }

  /**
   * Descobre CPF de cada webhook cruzando IDs com nosso banco:
   *  1. consult_id (direto) → v8_simulations.cpf
   *  2. operation_id → v8_operations_local.consult_id → v8_simulations.cpf
   *
   * Em v8_operations_local não temos CPF próprio; ele vive na simulação que
   * originou a operação. Por isso o passo 2 faz dois lookups encadeados.
   */
  async function enrichCpfs(rows: WebhookLog[]) {
    const directConsultIds = rows.map((r) => r.consult_id).filter((x): x is string => !!x);
    const operationIds = Array.from(new Set(rows.map((r) => r.operation_id).filter((x): x is string => !!x)));

    // Passo 2a: operation_id -> consult_id
    const opToConsult: Record<string, string> = {};
    if (operationIds.length > 0) {
      const { data } = await supabase
        .from('v8_operations_local')
        .select('operation_id, consult_id')
        .in('operation_id', operationIds);
      (data ?? []).forEach((row: any) => {
        if (row?.operation_id && row?.consult_id) opToConsult[row.operation_id] = row.consult_id;
      });
    }

    // Conjunto final de consult_ids para olhar em v8_simulations.
    const allConsultIds = Array.from(new Set([
      ...directConsultIds,
      ...Object.values(opToConsult),
    ]));

    // Passo 1 + 2b: consult_id -> cpf
    const consultToCpf: Record<string, string> = {};
    if (allConsultIds.length > 0) {
      const { data } = await supabase
        .from('v8_simulations')
        .select('consult_id, cpf')
        .in('consult_id', allConsultIds);
      (data ?? []).forEach((row: any) => {
        if (row?.consult_id && row?.cpf) {
          consultToCpf[row.consult_id] = String(row.cpf).replace(/\D/g, '');
        }
      });
    }

    const map: Record<string, string> = {};
    rows.forEach((r) => {
      // Frente D: payload não vem mais na listagem, então o fallback
      // cpfFromPayload foi removido. Na prática a V8 nunca envia CPF
      // mesmo (verificado: 110k webhooks, 0 com CPF no payload).
      const viaConsult = r.consult_id ? consultToCpf[r.consult_id] : undefined;
      const viaOperation = r.operation_id
        ? consultToCpf[opToConsult[r.operation_id] ?? '']
        : undefined;
      const cpf = viaConsult || viaOperation;
      if (cpf) map[r.id] = cpf;
    });
    setCpfMap(map);
  }

  async function load() {
    setLoading(true);
    try {
      // Frente D: payload (JSONB) excluído da listagem — reduz egress em ~80%
      // (cada payload V8 é 2-10 KB; 200 linhas = até 2 MB extras à toa).
      // O payload é buscado sob demanda em handleOpenDetails().
      let query = supabase
        .from('v8_webhook_logs')
        .select('id, event_type, status, consult_id, operation_id, v8_simulation_id, processed, process_error, received_at')
        .order('received_at', { ascending: false })
        .limit(200);

      if (typeFilter !== '__all__') {
        query = query.eq('event_type', typeFilter);
      }

      const { data, error } = await query;
      if (error) throw error;
      const rows = (data ?? []) as WebhookLog[];
      setLogs(rows);
      // Enriquece CPF e atualiza contadores em paralelo (sem bloquear a tela).
      void enrichCpfs(rows);
      void loadTypeCounts();
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

  // Recarrega quando o filtro de tipo muda (busca no banco filtrada).
  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [typeFilter]);

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    const digits = term.replace(/\D/g, '');
    return logs.filter((log) => {
      // typeFilter já foi aplicado no banco — não refiltrar aqui.
      if (statusFilter === 'processed' && !log.processed) return false;
      if (statusFilter === 'pending' && log.processed) return false;
      if (statusFilter === 'error' && !log.process_error) return false;
      if (term) {
        const cpf = cpfMap[log.id] || '';
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
  }, [logs, statusFilter, search, cpfMap]);

  const stats = useMemo(() => {
    const total = logs.length;
    const processed = logs.filter((l) => l.processed).length;
    const pending = logs.filter((l) => !l.processed && !l.process_error).length;
    const error = logs.filter((l) => !!l.process_error).length;
    return { total, processed, pending, error };
  }, [logs]);

  const totalAllTypes = ALL_TYPES.reduce((acc, t) => acc + (typeCounts[t] ?? 0), 0);

  return (
    <div className="space-y-4">
      <div className="rounded-md border border-blue-500/30 bg-blue-500/10 p-3 text-xs leading-relaxed">
        <strong>O que aparece aqui?</strong> Cada vez que a V8 nos avisa de algo
        (uma consulta concluiu, um contrato foi pago, etc.), gravamos o evento aqui.
        Se algum contrato "sumiu" ou um status não atualizou, é o primeiro lugar para conferir.
        <br />
        <span className="opacity-80">
          Observação: a V8 não envia CPF no aviso — buscamos o CPF cruzando com
          a consulta ou contrato que já temos no nosso banco. Se não acharmos,
          mostramos "—" (geralmente significa que a consulta foi aberta em outra plataforma).
        </span>
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
          {/* Totais REAIS por tipo (do banco inteiro, não dos 200 carregados) */}
          <div className="flex flex-wrap items-center gap-2 text-xs">
            <Badge variant="outline" className="font-semibold">
              {totalAllTypes.toLocaleString('pt-BR')} no banco
            </Badge>
            {ALL_TYPES.map((t) => (
              <Badge key={t} variant="outline" className="gap-1">
                <span className="opacity-70">{TYPE_LABEL[t]}:</span>
                <strong>{(typeCounts[t] ?? 0).toLocaleString('pt-BR')}</strong>
              </Badge>
            ))}
          </div>

          {/* Stats da listagem visível */}
          <div className="flex flex-wrap items-center gap-2 text-xs border-t pt-3">
            <span className="text-muted-foreground">Listagem visível:</span>
            <Badge variant="outline">{stats.total} carregados</Badge>
            <Badge className="bg-emerald-500/15 text-emerald-700 border-emerald-500/40" variant="outline">{stats.processed} processados</Badge>
            <Badge variant="secondary">{stats.pending} pendentes</Badge>
            {stats.error > 0 && <Badge variant="destructive">{stats.error} com erro</Badge>}
            {typeFilter !== '__all__' && (
              <Badge variant="outline" className="border-amber-500/40 text-amber-700">
                Filtrado: {TYPE_LABEL[typeFilter] || typeFilter}
              </Badge>
            )}
          </div>

          <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
            <div>
              <Select value={typeFilter} onValueChange={setTypeFilter}>
                <SelectTrigger><SelectValue placeholder="Tipo" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="__all__">Todos os tipos</SelectItem>
                  {ALL_TYPES.map((t) => (
                    <SelectItem key={t} value={t}>
                      {TYPE_LABEL[t]} ({(typeCounts[t] ?? 0).toLocaleString('pt-BR')})
                    </SelectItem>
                  ))}
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
                {!loading && filtered.map((log) => {
                  const cpf = cpfMap[log.id];
                  return (
                  <tr key={log.id} className="border-t">
                    <td className="px-2 py-1 whitespace-nowrap">{formatDateTime(log.received_at)}</td>
                    <td className="px-2 py-1">{getTypeBadge(log.event_type)}</td>
                    <td className="px-2 py-1 font-mono">
                      {cpf ? (
                        maskCpfDigits(cpf)
                      ) : (
                        <span
                          className="text-muted-foreground cursor-help"
                          title="Sem CPF: a V8 não envia CPF nos webhooks. Provavelmente esta consulta foi aberta fora do LordCred (em outra plataforma ou direto na V8). Se for um contrato seu, abra os detalhes para ver o consult_id e cruzar manualmente."
                        >
                          —
                        </span>
                      )}
                    </td>
                    <td className="px-2 py-1">{log.status || '—'}</td>
                    <td className="px-2 py-1">{getResultBadge(log)}</td>
                    <td className="px-2 py-1 text-right">
                      <Button variant="outline" size="sm" onClick={() => openDetails(log)}>
                        Ver detalhes
                      </Button>
                    </td>
                  </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      <Dialog open={!!selected} onOpenChange={(open) => { if (!open) { setSelected(null); setSelectedPayload({ loading: false, data: null }); } }}>
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
                <div className="col-span-2"><strong>CPF (do nosso banco):</strong> <code>{maskCpfDigits(cpfMap[selected.id])}</code></div>
                {selected.consult_id && <div className="col-span-2"><strong>consult_id:</strong> <code>{selected.consult_id}</code></div>}
                {selected.operation_id && <div className="col-span-2"><strong>operation_id:</strong> <code>{selected.operation_id}</code></div>}
                {selected.process_error && (
                  <div className="col-span-2 text-destructive"><strong>Erro:</strong> {selected.process_error}</div>
                )}
              </div>
              <div>
                <strong>Payload:</strong>
                {selectedPayload.loading ? (
                  <div className="mt-1 p-4 bg-muted rounded text-center text-muted-foreground">
                    <Loader2 className="inline h-4 w-4 animate-spin mr-2" />Carregando payload...
                  </div>
                ) : (
                  <pre className="mt-1 p-2 bg-muted rounded text-[10px] overflow-x-auto max-h-96">
                    {JSON.stringify(selectedPayload.data, null, 2)}
                  </pre>
                )}
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
