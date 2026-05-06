import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Accordion, AccordionItem, AccordionTrigger, AccordionContent } from '@/components/ui/accordion';
import { Loader2, Save, Zap, Volume2, RefreshCw, Timer, Settings2, Rocket } from 'lucide-react';
import { Slider } from '@/components/ui/slider';
import { toast } from 'sonner';
import { useV8Settings } from '@/hooks/useV8Settings';

/**
 * Card de Auto-retry refatorado em 4 seções colapsáveis:
 *  1. Liga/desliga + ciclo global    → o que o robô faz e quantos ciclos tenta.
 *  2. Ritmo (backoff + lote)         → tempo entre tentativas e tamanho do lote.
 *  3. Notificações                   → som ao terminar lote.
 *  4. Avançado (recolhido)           → persistência interna por endpoint V8 (3/15/15).
 *
 * A explicação inline da diferença entre "máx. tentativas por simulação"
 * (ciclo completo consult+authorize+simulate) e "retentativas internas
 * por etapa" (uma única chamada HTTP) fica no topo do card e dentro do
 * accordion Avançado, para evitar confusão.
 */
export default function V8RetrySettingsCard() {
  const { settings, loading, saving, save, defaults } = useV8Settings();
  const [maxAttempts, setMaxAttempts] = useState(defaults.max_auto_retry_attempts);
  const [minBackoff, setMinBackoff] = useState(defaults.retry_min_backoff_seconds);
  const [maxBackoff, setMaxBackoff] = useState(defaults.retry_max_backoff_seconds);
  const [batchSize, setBatchSize] = useState(defaults.retry_batch_size);
  const [enabled, setEnabled] = useState(defaults.background_retry_enabled);
  const [soundOn, setSoundOn] = useState(defaults.sound_on_complete);
  const [retConsult, setRetConsult] = useState(defaults.max_retries_consult);
  const [retAuthorize, setRetAuthorize] = useState(defaults.max_retries_authorize);
  const [retSimulate, setRetSimulate] = useState(defaults.max_retries_simulate);
  const [forceDispatchOn, setForceDispatchOn] = useState(defaults.force_dispatch_enabled);
  const [forceDispatchAfter, setForceDispatchAfter] = useState(defaults.force_dispatch_after_seconds);

  useEffect(() => {
    if (!settings) return;
    setMaxAttempts(settings.max_auto_retry_attempts);
    setMinBackoff(settings.retry_min_backoff_seconds);
    setMaxBackoff(settings.retry_max_backoff_seconds);
    setBatchSize(settings.retry_batch_size);
    setEnabled(settings.background_retry_enabled);
    setSoundOn(settings.sound_on_complete ?? false);
    setRetConsult(settings.max_retries_consult ?? 3);
    setRetAuthorize(settings.max_retries_authorize ?? 15);
    setRetSimulate(settings.max_retries_simulate ?? 15);
    setForceDispatchOn(settings.force_dispatch_enabled ?? true);
    setForceDispatchAfter(settings.force_dispatch_after_seconds ?? 300);
  }, [settings]);

  async function handleSave() {
    if (maxBackoff < minBackoff) {
      toast.error('Backoff máximo deve ser maior ou igual ao mínimo');
      return;
    }
    const inRange = (n: number) => Number.isFinite(n) && n >= 1 && n <= 30;
    if (!inRange(retConsult) || !inRange(retAuthorize) || !inRange(retSimulate)) {
      toast.error('Retentativas internas devem estar entre 1 e 30');
      return;
    }
    if (forceDispatchAfter < 60 || forceDispatchAfter > 1800) {
      toast.error('Janela de force-dispatch deve estar entre 60 e 1800 segundos');
      return;
    }
    const ok = await save({
      max_auto_retry_attempts: maxAttempts,
      retry_min_backoff_seconds: minBackoff,
      retry_max_backoff_seconds: maxBackoff,
      retry_batch_size: batchSize,
      background_retry_enabled: enabled,
      sound_on_complete: soundOn,
      max_retries_consult: retConsult,
      max_retries_authorize: retAuthorize,
      max_retries_simulate: retSimulate,
      force_dispatch_enabled: forceDispatchOn,
      force_dispatch_after_seconds: forceDispatchAfter,
    });
    if (ok) toast.success('Configurações salvas');
    else toast.error('Falha ao salvar (verifique permissões)');
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Zap className="w-5 h-5" />
          Auto-retry em background
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="rounded border border-border/60 bg-muted/30 p-3 text-sm text-muted-foreground">
          <p>
            Existem <strong>dois níveis</strong> de tentativa no sistema — não confunda:
          </p>
          <ul className="mt-2 space-y-1 list-disc list-inside text-xs">
            <li>
              <strong>Ciclo completo</strong> (consult + authorize + simulate) — controlado abaixo
              em "Máximo de tentativas por simulação". A cada falha, o robô espera o backoff
              e <strong>recomeça do zero</strong>. Default: 15 ciclos.
            </li>
            <li>
              <strong>Persistência interna por chamada HTTP</strong> — controlado em "Avançado"
              no fim deste card. Quando uma única chamada (ex.: <code>/consult</code>) recebe
              429 ou 5xx, o servidor tenta sozinho N vezes <strong>antes</strong> de marcar como falha
              e devolver para o ciclo. Default: 3 / 15 / 15.
            </li>
          </ul>
        </div>

        <Accordion type="multiple" defaultValue={['secao-1', 'secao-2']} className="w-full">
          {/* === SEÇÃO 1: Ciclo global === */}
          <AccordionItem value="secao-1">
            <AccordionTrigger className="hover:no-underline">
              <span className="flex items-center gap-2">
                <RefreshCw className="w-4 h-4 text-muted-foreground" />
                <span>1. Ciclo global do robô</span>
              </span>
            </AccordionTrigger>
            <AccordionContent className="space-y-4">
              <p className="text-sm text-muted-foreground">
                O cron roda a cada ~1 minuto e procura simulações que falharam por instabilidade
                temporária da V8 (rate-limit, 5xx, "ainda em análise"). Cada vez que ele acha
                uma, conta como <strong>1 ciclo</strong>.
              </p>

              <div className="flex items-center gap-3">
                <Switch checked={enabled} onCheckedChange={setEnabled} disabled={loading} />
                <Label>Ativar auto-retry em background (cron)</Label>
              </div>

              <div>
                <Label>Máximo de tentativas por simulação (ciclos completos)</Label>
                <Input
                  type="number"
                  min={1}
                  max={100}
                  value={maxAttempts}
                  onChange={(e) => setMaxAttempts(Number(e.target.value))}
                  disabled={loading}
                />
                <p className="text-xs text-muted-foreground mt-1">
                  Acima disso a simulação fica como "falha definitiva" e só volta se alguém
                  clicar em "Retentar falhados". <strong>Cada ciclo</strong> aqui dispara as 3
                  chamadas (consult → authorize → simulate) — completamente diferente da
                  persistência interna em "Avançado".
                </p>
              </div>
            </AccordionContent>
          </AccordionItem>

          {/* === SEÇÃO 2: Ritmo === */}
          <AccordionItem value="secao-2">
            <AccordionTrigger className="hover:no-underline">
              <span className="flex items-center gap-2">
                <Timer className="w-4 h-4 text-muted-foreground" />
                <span>2. Ritmo (backoff e lote)</span>
              </span>
            </AccordionTrigger>
            <AccordionContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label>Backoff mínimo (segundos)</Label>
                  <Input
                    type="number"
                    min={1}
                    value={minBackoff}
                    onChange={(e) => setMinBackoff(Number(e.target.value))}
                    disabled={loading}
                  />
                  <p className="text-xs text-muted-foreground mt-1">
                    Tempo mínimo de espera entre 2 ciclos da mesma simulação.
                  </p>
                </div>

                <div>
                  <Label>Backoff máximo (segundos)</Label>
                  <Input
                    type="number"
                    min={1}
                    value={maxBackoff}
                    onChange={(e) => setMaxBackoff(Number(e.target.value))}
                    disabled={loading}
                  />
                  <p className="text-xs text-muted-foreground mt-1">
                    Teto da espera (o tempo cresce a cada falha até atingir esse limite).
                  </p>
                </div>

                <div className="md:col-span-2">
                  <Label>Lote por execução do cron</Label>
                  <Input
                    type="number"
                    min={1}
                    max={200}
                    value={batchSize}
                    onChange={(e) => setBatchSize(Number(e.target.value))}
                    disabled={loading}
                  />
                  <p className="text-xs text-muted-foreground mt-1">
                    Quantas simulações o cron processa por execução (a cada minuto).
                    Valores altos aceleram a fila mas aumentam pressão na V8.
                  </p>
                </div>
              </div>
            </AccordionContent>
          </AccordionItem>

          {/* === SEÇÃO 3: Notificações === */}
          <AccordionItem value="secao-3">
            <AccordionTrigger className="hover:no-underline">
              <span className="flex items-center gap-2">
                <Volume2 className="w-4 h-4 text-muted-foreground" />
                <span>3. Notificações sonoras</span>
              </span>
            </AccordionTrigger>
            <AccordionContent>
              <div className="flex items-center gap-3">
                <Switch checked={soundOn} onCheckedChange={setSoundOn} disabled={loading} />
                <div className="flex-1">
                  <Label className="cursor-pointer">Tocar som ao concluir lote</Label>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Beep curto no navegador ao final de cada lote (sucesso ou falha).
                    Útil para acompanhar lotes em segundo plano.
                  </p>
                </div>
              </div>
            </AccordionContent>
          </AccordionItem>

          {/* === SEÇÃO 3.5: Force-dispatch automático === */}
          <AccordionItem value="secao-force-dispatch">
            <AccordionTrigger className="hover:no-underline">
              <span className="flex items-center gap-2">
                <Rocket className="w-4 h-4 text-muted-foreground" />
                <span>4. Força-dispatch (pendentes presas)</span>
              </span>
            </AccordionTrigger>
            <AccordionContent className="space-y-4">
              <p className="text-sm text-muted-foreground">
                Quando o lote dispara mas a V8 não responde nem manda webhook, a linha
                fica em "Aguardando V8" para sempre. Esta regra força um novo disparo
                após a janela definida abaixo — sem você precisar clicar em
                "Forçar dispatch" no histórico.
              </p>

              <div className="flex items-center gap-3">
                <Switch
                  checked={forceDispatchOn}
                  onCheckedChange={setForceDispatchOn}
                  disabled={loading}
                />
                <Label>Ativar force-dispatch automático</Label>
              </div>

              <div className={forceDispatchOn ? '' : 'opacity-50 pointer-events-none'}>
                <div className="flex items-center justify-between mb-2">
                  <Label>Janela para considerar "presa" (segundos)</Label>
                  <span className="text-sm font-medium tabular-nums">
                    {forceDispatchAfter}s
                    <span className="text-muted-foreground ml-1">
                      ({Math.round(forceDispatchAfter / 60)} min)
                    </span>
                  </span>
                </div>
                <Slider
                  min={60}
                  max={1800}
                  step={30}
                  value={[forceDispatchAfter]}
                  onValueChange={(v) => setForceDispatchAfter(v[0] ?? 300)}
                  disabled={loading || !forceDispatchOn}
                />
                <div className="flex justify-between text-[11px] text-muted-foreground mt-1">
                  <span>60s</span>
                  <span>5 min (default)</span>
                  <span>30 min</span>
                </div>
                <p className="text-xs text-muted-foreground mt-2">
                  Recomendado: <strong>5 min</strong>. Valores muito baixos podem disparar
                  antes do webhook real chegar; valores muito altos atrasam destravamento.
                </p>
              </div>
            </AccordionContent>
          </AccordionItem>

          <AccordionItem value="secao-avancado">
            <AccordionTrigger className="hover:no-underline">
              <span className="flex items-center gap-2">
                <Settings2 className="w-4 h-4 text-muted-foreground" />
                <span>5. Avançado — persistência interna por etapa V8</span>
              </span>
            </AccordionTrigger>
            <AccordionContent className="space-y-4">
              <div className="rounded border border-amber-500/40 bg-amber-500/5 p-3 text-xs">
                <p className="font-medium text-foreground mb-1">⚠️ Configuração avançada</p>
                <p className="text-muted-foreground">
                  Estes 3 valores controlam quantas vezes o servidor tenta a <strong>mesma chamada
                  HTTP</strong> (não o ciclo inteiro) antes de marcar como falha. Se subir muito
                  vai segurar pedidos travados — se baixar demais vai falhar à toa em
                  instabilidades de 1 segundo. Valores entre 1 e 30.
                </p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <Label>Consulta de margem (/consult)</Label>
                  <Input
                    type="number"
                    min={1}
                    max={30}
                    value={retConsult}
                    onChange={(e) => setRetConsult(Number(e.target.value))}
                    disabled={loading}
                  />
                  <p className="text-xs text-muted-foreground mt-1">
                    <strong>Etapa 1.</strong> Falhar rápido aqui é OK (default <strong>3</strong>) — o
                    auto-retry de fundo reabre o ciclo depois.
                  </p>
                </div>

                <div>
                  <Label>Aceite do termo (/authorize)</Label>
                  <Input
                    type="number"
                    min={1}
                    max={30}
                    value={retAuthorize}
                    onChange={(e) => setRetAuthorize(Number(e.target.value))}
                    disabled={loading}
                  />
                  <p className="text-xs text-muted-foreground mt-1">
                    <strong>Etapa 2.</strong> Já temos consultId aberto — perder agora desperdiça
                    a etapa 1. Insiste mais (default <strong>15</strong>).
                  </p>
                </div>

                <div>
                  <Label>Cálculo da parcela (/simulation)</Label>
                  <Input
                    type="number"
                    min={1}
                    max={30}
                    value={retSimulate}
                    onChange={(e) => setRetSimulate(Number(e.target.value))}
                    disabled={loading}
                  />
                  <p className="text-xs text-muted-foreground mt-1">
                    <strong>Etapa 3.</strong> Mesma lógica: já passamos pelas 2 anteriores,
                    vale insistir muito (default <strong>15</strong>).
                  </p>
                </div>
              </div>
            </AccordionContent>
          </AccordionItem>
        </Accordion>

        <div className="pt-2">
          <Button onClick={handleSave} disabled={saving || loading}>
            {saving ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Save className="w-4 h-4 mr-2" />}
            Salvar configurações
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
