import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Save, Loader2, Webhook, RefreshCw, CheckCircle2, AlertCircle } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import V8RetrySettingsCard from './V8RetrySettingsCard';
import V8DatabaseHealthCard from './V8DatabaseHealthCard';
import { useV8Settings } from '@/hooks/useV8Settings';

interface WebhookRegistration {
  webhook_type: string;
  registered_url: string;
  last_registered_at: string | null;
  last_status: string | null;
  last_error: string | null;
  last_test_received_at: string | null;
  last_confirm_received_at: string | null;
}

export default function V8ConfigTab() {
  const [margin, setMargin] = useState<number>(5);
  const [rowId, setRowId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [registering, setRegistering] = useState(false);
  const [webhookStatus, setWebhookStatus] = useState<WebhookRegistration[]>([]);
  const [lastLog, setLastLog] = useState<{ event_type: string; status: string | null; received_at: string } | null>(null);

  useEffect(() => {
    (async () => {
      setLoading(true);
      const { data } = await supabase
        .from('v8_margin_config')
        .select('id, margin_percent')
        .limit(1)
        .maybeSingle();
      if (data) {
        setRowId(data.id);
        setMargin(Number(data.margin_percent));
      }
      setLoading(false);
      void refreshWebhookStatus();
    })();
  }, []);

  async function refreshWebhookStatus() {
    const { data } = await supabase.functions.invoke('v8-clt-api', {
      body: { action: 'get_webhook_status' },
    });
    if (data?.success) {
      setWebhookStatus(data.data?.registrations ?? []);
      setLastLog(data.data?.last_log ?? null);
    }
  }

  async function handleSave() {
    setSaving(true);
    try {
      if (rowId) {
        const { error } = await supabase
          .from('v8_margin_config')
          .update({ margin_percent: margin })
          .eq('id', rowId);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('v8_margin_config')
          .insert({ margin_percent: margin });
        if (error) throw error;
      }
      toast.success('Margem salva');
    } catch (err: any) {
      toast.error(`Erro: ${err?.message || err}`);
    } finally {
      setSaving(false);
    }
  }

  async function handleRegisterWebhooks() {
    setRegistering(true);
    try {
      const { data, error } = await supabase.functions.invoke('v8-clt-api', {
        body: { action: 'register_webhooks' },
      });
      if (error) throw error;
      if (data?.success) {
        toast.success('Webhooks registrados na V8 — aguarde o handshake.');
      } else {
        toast.error(data?.error || 'Falha ao registrar webhooks');
      }
      await refreshWebhookStatus();
    } catch (err: any) {
      toast.error(`Erro: ${err?.message || err}`);
    } finally {
      setRegistering(false);
    }
  }

  function formatRelative(iso: string | null): string {
    if (!iso) return '—';
    const diff = Date.now() - new Date(iso).getTime();
    const min = Math.floor(diff / 60000);
    if (min < 1) return 'agora';
    if (min < 60) return `há ${min} min`;
    const h = Math.floor(min / 60);
    if (h < 24) return `há ${h}h`;
    return `há ${Math.floor(h / 24)}d`;
  }

  return (
    <div className="space-y-4 max-w-3xl">
      <Card>
        <CardHeader>
          <CardTitle>Margem da empresa</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <Label>Margem (%)</Label>
            <Input
              type="number"
              step="0.01"
              min="0"
              max="100"
              value={margin}
              onChange={(e) => setMargin(Number(e.target.value))}
              disabled={loading}
            />
            <p className="text-xs text-muted-foreground mt-1">
              Percentual descontado do valor liberado para calcular o valor a cobrar do cliente.
            </p>
          </div>
          <Button onClick={handleSave} disabled={saving || loading}>
            {saving ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Save className="w-4 h-4 mr-2" />}
            Salvar
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Webhook className="w-5 h-5" />
            Webhooks V8 (status em tempo real)
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-muted-foreground">
            Quando uma consulta ou proposta muda de status na V8, o sistema é notificado
            automaticamente — sem precisar consultar manualmente. O caso "Maicon" só será
            atualizado quando a V8 enviar o webhook de conclusão.
          </p>

          <div className="flex gap-2">
            <Button onClick={handleRegisterWebhooks} disabled={registering}>
              {registering ? (
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              ) : (
                <Webhook className="w-4 h-4 mr-2" />
              )}
              Registrar / re-registrar webhooks na V8
            </Button>
            <Button variant="outline" onClick={refreshWebhookStatus}>
              <RefreshCw className="w-4 h-4 mr-2" />
              Atualizar status
            </Button>
          </div>

          {lastLog && (
            <div className="rounded-md border bg-muted/30 p-3 text-sm">
              <strong>Última notificação V8 recebida:</strong>{' '}
              <span className="font-mono">{lastLog.event_type}</span>
              {lastLog.status && <> · status <span className="font-mono">{lastLog.status}</span></>}
              {' · '}
              {formatRelative(lastLog.received_at)}
            </div>
          )}

          <div className="space-y-2">
            {webhookStatus.length === 0 && (
              <div className="text-sm text-muted-foreground">
                Nenhum webhook registrado ainda. Clique em "Registrar" acima.
              </div>
            )}
            {webhookStatus.map((reg) => (
              <div key={reg.webhook_type} className="rounded-md border p-3 text-sm space-y-1">
                <div className="flex items-center gap-2">
                  <strong className="capitalize">{reg.webhook_type}</strong>
                  {reg.last_status === 'success' ? (
                    <Badge variant="default" className="gap-1">
                      <CheckCircle2 className="w-3 h-3" /> registrado
                    </Badge>
                  ) : reg.last_status === 'failed' ? (
                    <Badge variant="destructive" className="gap-1">
                      <AlertCircle className="w-3 h-3" /> falhou
                    </Badge>
                  ) : (
                    <Badge variant="secondary">pendente</Badge>
                  )}
                </div>
                <div className="text-xs text-muted-foreground break-all font-mono">
                  {reg.registered_url}
                </div>
                <div className="text-xs text-muted-foreground">
                  Registrado: {formatRelative(reg.last_registered_at)} · Teste recebido:{' '}
                  {formatRelative(reg.last_test_received_at)} · Confirmado:{' '}
                  {formatRelative(reg.last_confirm_received_at)}
                </div>
                {reg.last_error && (
                  <div className="text-xs text-destructive">Erro: {reg.last_error}</div>
                )}
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      <V8RetrySettingsCard />

      <CreateOperationSettingsCard />

      <CpfDedupeSettingsCard />

      <AutoBestAlwaysOnCard />
      <ParallelBatchesCard />

      <V8DatabaseHealthCard />
    </div>
  );
}

/** Etapa C — bloqueio de CPFs duplicados em janela configurável. */
function CpfDedupeSettingsCard() {
  const { settings, saving, save } = useV8Settings();
  if (!settings) return null;
  return (
    <Card>
      <CardHeader>
        <CardTitle>Duplicidade de CPF (janela configurável)</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <label className="flex items-start gap-3 cursor-pointer">
          <input
            type="checkbox"
            checked={!!settings.cpf_dedupe_enabled}
            disabled={saving}
            onChange={(e) => void save({ cpf_dedupe_enabled: e.target.checked })}
            className="mt-1 h-4 w-4"
          />
          <div>
            <div className="text-sm font-medium">Bloquear CPFs já consultados recentemente</div>
            <p className="text-xs text-muted-foreground">
              Quando ativo, CPFs com consulta em status <strong>SUCCESS</strong> ou <strong>PENDING</strong>
              {' '}dentro da janela abaixo são marcados como "duplicate_recent" e <strong>não</strong> geram nova consulta na V8.
              Evita abrir 2, 3, 5 propostas para a mesma pessoa por colagem repetida.
            </p>
          </div>
        </label>
        <div className="max-w-xs">
          <Label>Janela (dias)</Label>
          <Input
            type="number"
            min={1}
            max={90}
            value={settings.cpf_dedupe_window_days}
            disabled={saving || !settings.cpf_dedupe_enabled}
            onChange={(e) => {
              const v = Math.max(1, Math.min(90, Number(e.target.value) || 7));
              void save({ cpf_dedupe_window_days: v });
            }}
          />
          <p className="text-xs text-muted-foreground mt-1">
            Padrão: 7 dias. Aumente para janelas maiores (ex.: 30) ou diminua se quiser permitir reconsultas frequentes.
          </p>
        </div>
      </CardContent>
    </Card>
  );
}

/** Etapa 2 (mai/2026) — Auto-melhor sempre ligado em qualquer simulação com margem. */
function AutoBestAlwaysOnCard() {
  const { settings, saving, save } = useV8Settings();
  if (!settings) return null;
  return (
    <Card>
      <CardHeader>
        <CardTitle>Auto-melhor automático (Operações + Pool)</CardTitle>
      </CardHeader>
      <CardContent>
        <label className="flex items-start gap-3 cursor-pointer">
          <input
            type="checkbox"
            checked={!!settings.auto_best_always_on}
            disabled={saving}
            onChange={(e) => void save({ auto_best_always_on: e.target.checked })}
            className="mt-1 h-4 w-4"
          />
          <div>
            <div className="text-sm font-medium">
              Sempre rodar Auto-melhor para toda simulação com margem
            </div>
            <p className="text-xs text-muted-foreground">
              Quando ligado, qualquer CPF que voltar com margem disponível (status <strong>SUCCESS</strong> ou <strong>CONSENT_APPROVED</strong>)
              entra automaticamente na fila do worker Auto-melhor — inclusive simulações criadas pelo <strong>Pool</strong>,
              pela aba <strong>Operações</strong> ou importações manuais (sem lote). O <code>sim_id</code> é gerado em ~1 min sem clique do operador.
            </p>
            <p className="text-[11px] text-muted-foreground mt-1">
              Desligue se quiser controlar manualmente quando gerar a melhor combinação valor × prazo.
            </p>
          </div>
        </label>
      </CardContent>
    </Card>
  );
}

/** Etapa 2 (mai/2026) — Paralelismo de lotes V8 por operador (1 a 3). */
function ParallelBatchesCard() {
  const { settings, saving, save } = useV8Settings();
  if (!settings) return null;
  const value = settings.max_concurrent_batches_per_owner ?? 2;
  return (
    <Card>
      <CardHeader>
        <CardTitle>Paralelismo de lotes (Nova Simulação)</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <p className="text-xs text-muted-foreground">
          Quantos lotes o mesmo operador pode rodar <strong>ao mesmo tempo</strong>. Enquanto o lote 1 aguarda
          resposta da V8 (via webhook), o próximo já começa a disparar — ganha agilidade sem sobrecarregar a V8
          (throttle global de {settings.consult_throttle_ms}ms entre consultas continua ativo).
        </p>
        <div className="flex gap-2">
          {[1, 2, 3].map((n) => (
            <button
              key={n}
              type="button"
              disabled={saving}
              onClick={() => void save({ max_concurrent_batches_per_owner: n })}
              className={`px-4 py-2 rounded-md border text-sm font-medium transition ${
                value === n ? 'bg-primary text-primary-foreground border-primary' : 'bg-card hover:bg-muted'
              }`}
            >
              {n}x {n === 1 ? '(sequencial)' : 'em paralelo'}
            </button>
          ))}
        </div>
        <p className="text-[11px] text-muted-foreground">
          Padrão: <strong>2x</strong>. Recomendado para a maioria dos casos. Use 3x apenas se a equipe operar lotes pequenos (&lt; 50 CPFs).
        </p>
      </CardContent>
    </Card>
  );
}
function CreateOperationSettingsCard() {
  const { settings, saving, save } = useV8Settings();
  if (!settings) return null;
  return (
    <Card>
      <CardHeader>
        <CardTitle>Criação de Propostas</CardTitle>
      </CardHeader>
      <CardContent>
        <label className="flex items-start gap-3 cursor-pointer">
          <input
            type="checkbox"
            checked={!!settings.require_documents_on_create}
            disabled={saving}
            onChange={(e) => void save({ require_documents_on_create: e.target.checked })}
            className="mt-1 h-4 w-4"
          />
          <div>
            <div className="text-sm font-medium">Exigir documentos no envio</div>
            <p className="text-xs text-muted-foreground">
              Quando ativo, o envio do formulário "Criar Proposta" só é aceito com pelo menos
              1 documento anexado. Quando desativo, os documentos podem ser enviados depois pela aba
              de pendências.
            </p>
          </div>
        </label>
      </CardContent>
    </Card>
  );
}
