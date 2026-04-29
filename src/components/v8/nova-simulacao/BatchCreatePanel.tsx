import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { RefreshCw, Play, Loader2, ChevronDown, ChevronRight, CalendarClock, ListOrdered } from 'lucide-react';
import { V8StatusGlossary } from '../V8StatusGlossary';
import type { analyzeV8Paste } from '@/lib/v8Parser';

type SimulationMode = 'none' | 'disbursed_amount' | 'installment_face_value';

interface ConfigOption {
  config_id: string;
  name: string;
  bank_name?: string | null;
}

interface Props {
  // form state
  batchName: string;
  setBatchName: (v: string) => void;
  configId: string;
  setConfigId: (v: string) => void;
  parcelas: number;
  setParcelas: (v: number) => void;
  simulationMode: SimulationMode;
  setSimulationMode: (v: SimulationMode) => void;
  simulationValue: string;
  setSimulationValue: (v: string) => void;
  pasteText: string;
  setPasteText: (v: string) => void;

  // configs / opções
  configs: ConfigOption[];
  parcelOptions: number[];
  selectedConfig: any | null;
  refreshing: boolean;
  refreshFromV8: () => void;

  // analise
  pasteAnalysis: ReturnType<typeof analyzeV8Paste>;
  blockingIssues: ReturnType<typeof analyzeV8Paste>['issues'];
  invalidDateIssue: ReturnType<typeof analyzeV8Paste>['issues'][number] | undefined;

  // toggle auto simulate
  autoSimulate: boolean;
  onToggleAutoSimulate: (v: boolean) => void;
  v8SettingsLoaded: boolean;

  // Etapa 2 (abr/2026): Auto-melhor — tenta proposta viável automaticamente em lote.
  autoBest: boolean;
  onToggleAutoBest: (v: boolean) => void;

  // ação
  running: boolean;
  onStart: () => void;
  /** Etapa 3 (item 7): agendar lote para horário futuro. Quando definido, mostra UI de agendamento. */
  onSchedule?: (scheduledForIso: string) => void;
  /** Etapa 4 (item 10): adicionar lote à fila sequencial. */
  onQueue?: () => void;
}

/**
 * Painel de criação de lote — formulário (CPFs + parâmetros).
 * Sem lógica de negócio: tudo entra por props/callbacks. O orquestrador
 * V8NovaSimulacaoTab decide o que fazer no submit.
 */
export default function BatchCreatePanel(props: Props) {
  const {
    batchName, setBatchName, configId, setConfigId, parcelas, setParcelas,
    simulationMode, setSimulationMode, simulationValue, setSimulationValue,
    pasteText, setPasteText,
    configs, parcelOptions, selectedConfig, refreshing, refreshFromV8,
    pasteAnalysis, blockingIssues, invalidDateIssue,
    autoSimulate, onToggleAutoSimulate, v8SettingsLoaded,
    autoBest, onToggleAutoBest,
    running, onStart, onSchedule, onQueue,
  } = props;
  const [advancedOpen, setAdvancedOpen] = useState(false);
  const maxParcelas = parcelOptions.length > 0 ? Math.max(...parcelOptions) : null;
  const usingMaxDefault = !advancedOpen && maxParcelas != null && parcelas === maxParcelas;

  // Etapa 3 (item 7): agendamento. Default = +30 min.
  const defaultScheduleStr = (() => {
    const d = new Date(Date.now() + 30 * 60 * 1000);
    // datetime-local no fuso local do browser. Convertemos com -03:00 no submit.
    const pad = (n: number) => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
  })();
  const [scheduleEnabled, setScheduleEnabled] = useState(false);
  const [scheduledLocal, setScheduledLocal] = useState<string>(defaultScheduleStr);

  function handleScheduleClick() {
    if (!onSchedule) return;
    if (!scheduledLocal) return;
    // Interpreta o input como horário em America/Sao_Paulo (sufixo -03:00).
    // Usuário digitou "18:00" → enviamos "...T18:00:00-03:00".
    const iso = `${scheduledLocal}:00-03:00`;
    onSchedule(iso);
  }

  return (
    <Card>
      <CardHeader className="flex-row justify-between items-center">
        <CardTitle>Configurar Simulação</CardTitle>
        <div className="flex items-center gap-2">
          <V8StatusGlossary />
          <Button variant="outline" size="sm" onClick={refreshFromV8} disabled={refreshing}>
            <RefreshCw className={`w-4 h-4 mr-2 ${refreshing ? 'animate-spin' : ''}`} />
            Atualizar tabelas V8
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <Label>Nome do lote</Label>
            <Input
              placeholder="Ex.: Lote 23/04 - manhã"
              value={batchName}
              onChange={(e) => setBatchName(e.target.value)}
            />
          </div>
          <div>
            <Label>Tabela V8</Label>
            <Select value={configId} onValueChange={setConfigId}>
              <SelectTrigger>
                <SelectValue placeholder="Selecione a tabela" />
              </SelectTrigger>
              <SelectContent>
                {configs.length === 0 && (
                  <SelectItem value="__none__" disabled>
                    Clique em "Atualizar tabelas V8"
                  </SelectItem>
                )}
                {configs.map((c) => (
                  <SelectItem key={c.config_id} value={c.config_id}>
                    {c.name}{c.bank_name ? ` · ${c.bank_name}` : ''}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {usingMaxDefault && (
              <p className="mt-1 text-xs text-muted-foreground">
                Parcelas: <strong>{parcelas}x</strong> (máximo da tabela — padrão).
              </p>
            )}
          </div>
        </div>

        {/* Etapa 2 (item 4): seletor de parcelas escondido por padrão.
            Default = Math.max(parcelOptions). Operador só abre se quiser sobrescrever.
            Etapa 1 (novo item 4): "Tipo da simulação" também movido para cá —
            padrão "Sem valor (V8 escolhe)". */}
        <div className="rounded-lg border border-dashed border-border">
          <button
            type="button"
            onClick={() => setAdvancedOpen((o) => !o)}
            className="w-full flex items-center justify-between px-3 py-2 text-sm font-medium hover:bg-muted/40 rounded-lg"
          >
            <span className="flex items-center gap-1.5">
              {advancedOpen ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
              Opções avançadas
            </span>
            <span className="text-xs text-muted-foreground">
              Parcelas: {parcelas}x{usingMaxDefault ? ' (máx)' : ''}
              {' · '}
              Tipo: {simulationMode === 'none' ? 'V8 escolhe' : simulationMode === 'disbursed_amount' ? 'valor liberado' : 'valor da parcela'}
            </span>
          </button>
          {advancedOpen && (
            <div className="px-3 pb-3 pt-1 grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Label>Parcelas</Label>
                <Select value={String(parcelas)} onValueChange={(v) => setParcelas(Number(v))}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {parcelOptions.map((p) => (
                      <SelectItem key={p} value={String(p)}>
                        {p}x{maxParcelas === p ? ' (máximo)' : ''}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="mt-1 text-xs text-muted-foreground">
                  {selectedConfig
                    ? `Disponíveis: ${parcelOptions.map((value) => `${value}x`).join(', ')}`
                    : 'Selecione uma tabela para ver as parcelas aceitas pela V8.'}
                </p>
                <p className="mt-1 text-[11px] text-amber-600 dark:text-amber-400">
                  ⓘ Por padrão usamos o máximo. Só altere se precisar de prazo menor para todo o lote.
                </p>
              </div>
              <div>
                <Label>Tipo da simulação</Label>
                <Select value={simulationMode} onValueChange={(value: SimulationMode) => setSimulationMode(value)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Sem valor (V8 escolhe cenário padrão)</SelectItem>
                    <SelectItem value="disbursed_amount">Valor liberado desejado</SelectItem>
                    <SelectItem value="installment_face_value">Valor da parcela desejada</SelectItem>
                  </SelectContent>
                </Select>
                {simulationMode !== 'none' && (
                  <div className="mt-2">
                    <Label>{simulationMode === 'disbursed_amount' ? 'Valor liberado desejado' : 'Valor da parcela desejada'}</Label>
                    <Input
                      inputMode="decimal"
                      placeholder={simulationMode === 'disbursed_amount' ? 'Ex.: 2500,00' : 'Ex.: 180,00'}
                      value={simulationValue}
                      onChange={(e) => setSimulationValue(e.target.value)}
                    />
                    <p className="mt-1 text-xs text-muted-foreground">
                      Opcional pela V8. Se não souber, escolha "Sem valor" acima e a V8 devolve cenários padrão.
                    </p>
                  </div>
                )}
                <p className="mt-1 text-[11px] text-muted-foreground">
                  Padrão: <strong>Sem valor</strong> — a V8 calcula no meio da faixa permitida pelo CPF.
                </p>
              </div>
            </div>
          )}
        </div>

        <div>
          <Label>Dados dos clientes (1 por linha)</Label>
          <Textarea
            rows={8}
            placeholder={`12345678901 João da Silva 15/03/1985 M 11999998888\n98765432100;Maria Souza;06/08/1990;F;11988887777\nCARLOS PEREIRA LIMA 11122233344 22/11/1978`}
            value={pasteText}
            onChange={(e) => setPasteText(e.target.value)}
            className="font-mono text-xs"
          />
          <div className="mt-1 space-y-0.5 text-xs text-muted-foreground">
            <p><strong>Formatos aceitos</strong> (1 cliente por linha):</p>
            <p>• <strong>Com separadores</strong> (espaço, tab, vírgula ou ponto-e-vírgula): tokens em qualquer ordem.</p>
            <p>• <strong>Concatenado</strong> (NOME+CPF+DATA sem separadores), comum em exports de ERP.</p>
            <p className="pt-1">
              Tokens reconhecidos: <strong>CPF</strong> (11 díg.), <strong>Data</strong> (dd/mm/aaaa ou yyyy-mm-dd),
              {' '}<strong>Gênero</strong> (M/F), <strong>Telefone</strong> (10-11 díg.), <strong>Nome</strong>.
            </p>
            <p>⚠️ <strong>CPF e data de nascimento são obrigatórios</strong> — a V8 rejeita simulação sem data.</p>
            <p className="pt-1 font-medium text-foreground">{pasteAnalysis.rows.length} CPFs válidos detectados</p>
            {invalidDateIssue && (
              <p className="font-medium text-destructive">
                Linha {invalidDateIssue.lineNumber}: {invalidDateIssue.message}
              </p>
            )}
            {!invalidDateIssue && blockingIssues.length > 0 && (
              <p className="font-medium text-destructive">
                Existem {blockingIssues.length} linha(s) em formato não aceito. Corrija antes de iniciar o lote.
              </p>
            )}
            {pasteText.trim().length > 0 && blockingIssues.length === 0 && (
              <p>
                Se alguma linha ficar como <strong>pending</strong>, isso significa que a consulta ainda está em análise na V8 e não deve ser tratada como falha definitiva.
              </p>
            )}
          </div>
        </div>

        {/* Etapa 2 (abr/2026): Auto-melhor — descobre a melhor proposta sozinho. */}
        <div className="flex items-center justify-between gap-3 rounded-lg border border-amber-300 bg-amber-50/50 dark:border-amber-700 dark:bg-amber-950/20 p-3">
          <div className="space-y-0.5">
            <Label className="text-sm font-medium flex items-center gap-1.5">
              🤖 Auto-melhor (encontra a melhor proposta sozinha)
            </Label>
            <p className="text-xs text-muted-foreground">
              Quando ligado: para cada CPF com margem confirmada, o sistema tenta automaticamente as melhores combinações <strong>valor × prazo</strong> (do maior para o menor) até a V8 aceitar uma. Equivalente a clicar 🔍 "Encontrar proposta viável" em cada CPF — só que em lote. <strong>Ignora os campos "Modo de simulação" e "Valor"</strong> (decide tudo sozinho).
            </p>
          </div>
          <Switch
            checked={autoBest}
            onCheckedChange={onToggleAutoBest}
          />
        </div>

        <div className="flex items-center justify-between gap-3 rounded-lg border border-border bg-muted/30 p-3">
          <div className="space-y-0.5">
            <Label className="text-sm font-medium">Simular automaticamente após consulta</Label>
            <p className="text-xs text-muted-foreground">
              Quando ligado: assim que cada margem volta da V8, o sistema dispara <code>/simulation</code> automaticamente (throttled). Quando desligado (recomendado): você revisa as margens e clica em "Simular selecionados". {autoBest && <span className="text-amber-700 dark:text-amber-400 font-medium">⚠️ Ignorado — Auto-melhor está ligado e cuida da simulação.</span>}
            </p>
          </div>
          <Switch
            checked={autoSimulate}
            onCheckedChange={onToggleAutoSimulate}
            disabled={!v8SettingsLoaded || autoBest}
          />
        </div>

        {/* Etapa 3 (item 7): bloco de agendamento. Operador escolhe data/hora futura
            e o lote só inicia quando o launcher (pg_cron) chegar a esse horário. */}
        {onSchedule && (
          <div className="rounded-lg border border-border bg-muted/20 p-3 space-y-2">
            <div className="flex items-center justify-between gap-3">
              <div className="space-y-0.5">
                <Label className="text-sm font-medium flex items-center gap-1.5">
                  <CalendarClock className="w-4 h-4" /> Agendar para horário futuro
                </Label>
                <p className="text-xs text-muted-foreground">
                  Quando ligado, o lote fica em "Agendado" e só dispara as consultas no horário escolhido. Use para iniciar lotes fora do horário comercial ou em janelas controladas.
                </p>
              </div>
              <Switch checked={scheduleEnabled} onCheckedChange={setScheduleEnabled} />
            </div>
            {scheduleEnabled && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-1">
                <div>
                  <Label className="text-xs">Data e hora (horário de Brasília)</Label>
                  <Input
                    type="datetime-local"
                    value={scheduledLocal}
                    onChange={(e) => setScheduledLocal(e.target.value)}
                  />
                  <p className="mt-1 text-[11px] text-muted-foreground">
                    O sistema confere a cada minuto e dispara assim que chegar o horário.
                  </p>
                </div>
              </div>
            )}
          </div>
        )}

        {scheduleEnabled && onSchedule ? (
          <Button
            onClick={handleScheduleClick}
            disabled={running || blockingIssues.length > 0 || !scheduledLocal}
            size="lg"
            className="w-full"
            variant="default"
          >
            <CalendarClock className="w-4 h-4 mr-2" />
            Agendar lote para {scheduledLocal.replace('T', ' às ')}
          </Button>
        ) : (
          <div className="flex flex-col gap-2 sm:flex-row">
            <Button onClick={onStart} disabled={running || blockingIssues.length > 0} size="lg" className="flex-1">
              {running ? (
                <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Processando...</>
              ) : (
                <><Play className="w-4 h-4 mr-2" />Iniciar Simulação</>
              )}
            </Button>
            {onQueue && (
              <Button
                onClick={onQueue}
                disabled={running || blockingIssues.length > 0}
                size="lg"
                variant="outline"
                className="sm:w-64"
                title="Cria o lote em modo fila — começa sozinho quando o lote atual terminar"
              >
                <ListOrdered className="w-4 h-4 mr-2" />
                Adicionar à fila
              </Button>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
