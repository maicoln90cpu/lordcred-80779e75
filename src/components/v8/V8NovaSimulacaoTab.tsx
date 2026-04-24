import { useEffect, useMemo, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { RefreshCw, Play, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { useV8Configs } from '@/hooks/useV8Configs';
import { useV8BatchSimulations } from '@/hooks/useV8Batches';
import { analyzeV8Paste, parseV8Paste } from '@/lib/v8Parser';

const DEFAULT_PARCEL_OPTIONS = [12, 24, 36, 48, 60, 72, 84, 96];
const MAX_CONCURRENCY = 3;

export default function V8NovaSimulacaoTab() {
  const { configs, refreshing, refreshFromV8 } = useV8Configs();
  const [batchName, setBatchName] = useState('');
  const [configId, setConfigId] = useState('');
  const [parcelas, setParcelas] = useState(24);
  const [pasteText, setPasteText] = useState('');
  const [activeBatchId, setActiveBatchId] = useState<string | null>(null);
  const [running, setRunning] = useState(false);

  const { simulations } = useV8BatchSimulations(activeBatchId);
  const pasteAnalysis = useMemo(() => analyzeV8Paste(pasteText), [pasteText]);
  const invalidDateIssue = pasteAnalysis.issues.find((issue) => issue.code === 'invalid_date');
  const blockingIssues = pasteAnalysis.issues.filter(
    (issue) => issue.code === 'invalid_date' || issue.code === 'invalid_format' || issue.code === 'missing_birth_date',
  );

  const selectedConfig = useMemo(
    () => configs.find((c) => c.config_id === configId) ?? null,
    [configs, configId],
  );

  const parcelOptions = useMemo<number[]>(() => {
    const rawOptions: number[] = Array.isArray(selectedConfig?.raw_data?.number_of_installments)
      ? selectedConfig.raw_data.number_of_installments
          .map((value: string | number) => Number(value))
          .filter((value: number) => Number.isInteger(value) && value > 0)
      : [];

    if (rawOptions.length > 0) {
      return [...new Set<number>(rawOptions)].sort((a: number, b: number) => a - b);
    }

    if (selectedConfig?.min_term != null && selectedConfig?.max_term != null) {
      const ranged = DEFAULT_PARCEL_OPTIONS.filter(
        (value) => value >= Number(selectedConfig.min_term) && value <= Number(selectedConfig.max_term),
      );
      if (ranged.length > 0) return ranged;
    }

    return DEFAULT_PARCEL_OPTIONS;
  }, [selectedConfig]);

  useEffect(() => {
    if (parcelOptions.length > 0 && !parcelOptions.includes(parcelas)) {
      setParcelas(parcelOptions[0]);
    }
  }, [parcelOptions, parcelas]);

  const total = simulations.length;
  const done = simulations.filter((s) => s.status === 'success' || s.status === 'failed').length;
  const success = simulations.filter((s) => s.status === 'success').length;
  const failed = simulations.filter((s) => s.status === 'failed').length;
  const pct = total > 0 ? Math.round((done / total) * 100) : 0;

  async function handleStart() {
    const rows = pasteAnalysis.rows;
    if (rows.length === 0) {
      toast.error('Cole pelo menos 1 CPF válido');
      return;
    }
    if (blockingIssues.length > 0) {
      toast.error(`Corrija ${blockingIssues.length} linha(s) inválida(s) antes de enviar o lote`);
      return;
    }
    if (!configId) {
      toast.error('Escolha uma tabela');
      return;
    }
    if (!batchName.trim()) {
      toast.error('Dê um nome ao lote');
      return;
    }

    setRunning(true);
    const cfgLabel = configs.find((c) => c.config_id === configId)?.name;

    try {
      const { data, error } = await supabase.functions.invoke('v8-clt-api', {
        body: {
          action: 'create_batch',
          params: {
            name: batchName.trim(),
            config_id: configId,
            config_label: cfgLabel,
            parcelas,
            rows,
          },
        },
      });
      if (error) throw error;
      if (!data?.success) throw new Error(data?.error || 'Falha ao criar lote');

      const batchId = data.data.batch_id as string;
      setActiveBatchId(batchId);
      toast.success(`Lote criado com ${data.data.total} CPFs. Iniciando...`);

      const { data: sims } = await supabase
        .from('v8_simulations')
        .select('id, cpf, name, birth_date')
        .eq('batch_id', batchId)
        .order('created_at', { ascending: true });

      if (!sims) throw new Error('Falha ao carregar simulações');

      let idx = 0;
      const workers = Array.from({ length: MAX_CONCURRENCY }, async () => {
        while (idx < sims.length) {
          const myIdx = idx++;
          const sim = sims[myIdx];
          try {
            // Recupera tokens extras (gênero/telefone) parseados na hora da colagem
            const parsedRow = rows.find((r) => r.cpf === sim.cpf);
            await supabase.functions.invoke('v8-clt-api', {
              body: {
                action: 'simulate_one',
                params: {
                  cpf: sim.cpf,
                  nome: sim.name,
                  data_nascimento: sim.birth_date,
                  genero: parsedRow?.genero,
                  telefone: parsedRow?.telefone,
                  config_id: configId,
                  parcelas,
                  batch_id: batchId,
                  simulation_id: sim.id,
                },
              },
            });
          } catch (err) {
            console.error('Sim err', sim.cpf, err);
          }
        }
      });

      await Promise.all(workers);
      toast.success('Lote concluído!');
    } catch (err: any) {
      toast.error(`Erro: ${err?.message || err}`);
    } finally {
      setRunning(false);
    }
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="flex-row justify-between items-center">
          <CardTitle>Configurar Simulação</CardTitle>
          <Button variant="outline" size="sm" onClick={refreshFromV8} disabled={refreshing}>
            <RefreshCw className={`w-4 h-4 mr-2 ${refreshing ? 'animate-spin' : ''}`} />
            Atualizar tabelas V8
          </Button>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
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
                      {c.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Parcelas</Label>
              <Select value={String(parcelas)} onValueChange={(v) => setParcelas(Number(v))}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {parcelOptions.map((p) => (
                    <SelectItem key={p} value={String(p)}>
                      {p}x
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="mt-1 text-xs text-muted-foreground">
                {selectedConfig
                  ? `Parcelas disponíveis nesta tabela: ${parcelOptions.map((value) => `${value}x`).join(', ')}`
                  : 'Selecione uma tabela para ver apenas as parcelas realmente aceitas pela V8.'}
              </p>
            </div>
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
              <p>
                <strong>Formatos aceitos</strong> (1 cliente por linha):
              </p>
              <p>• <strong>Com separadores</strong> (espaço, tab, vírgula ou ponto-e-vírgula): tokens em qualquer ordem.</p>
              <p>• <strong>Concatenado</strong> (NOME+CPF+DATA sem separadores), comum em exports de ERP.</p>
              <p className="pt-1">
                Tokens reconhecidos: <strong>CPF</strong> (11 díg.), <strong>Data</strong> (dd/mm/aaaa ou yyyy-mm-dd),
                {' '}<strong>Gênero</strong> (M/F), <strong>Telefone</strong> (10-11 díg.), <strong>Nome</strong>.
              </p>
              <p>⚠️ <strong>CPF e data de nascimento são obrigatórios</strong> — a V8 rejeita simulação sem data.</p>
              <p className="pt-1 font-medium text-foreground">
                {parseV8Paste(pasteText).length} CPFs válidos detectados
              </p>
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
            </div>
          </div>

          <Button onClick={handleStart} disabled={running || blockingIssues.length > 0} size="lg" className="w-full">
            {running ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Processando...
              </>
            ) : (
              <>
                <Play className="w-4 h-4 mr-2" />
                Iniciar Simulação
              </>
            )}
          </Button>
        </CardContent>
      </Card>

      {activeBatchId && (
        <Card>
          <CardHeader>
            <CardTitle>Progresso do Lote</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex justify-between text-sm">
              <span>{done} / {total} ({pct}%)</span>
              <div className="flex gap-2">
                <Badge variant="default">{success} ok</Badge>
                <Badge variant="destructive">{failed} falha</Badge>
              </div>
            </div>
            <Progress value={pct} />
            <div className="max-h-96 overflow-y-auto border rounded">
              <table className="w-full text-xs">
                <thead className="bg-muted sticky top-0">
                  <tr>
                    <th className="px-2 py-1 text-left">CPF</th>
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
                      <td className="px-2 py-1">
                        <Badge
                          variant={s.status === 'success' ? 'default' : s.status === 'failed' ? 'destructive' : 'secondary'}
                        >
                          {s.status}
                        </Badge>
                      </td>
                      <td className="px-2 py-1 text-right">{s.released_value != null ? `R$ ${Number(s.released_value).toFixed(2)}` : '—'}</td>
                      <td className="px-2 py-1 text-right">{s.installment_value != null ? `R$ ${Number(s.installment_value).toFixed(2)}` : '—'}</td>
                      <td className="px-2 py-1 text-right">{s.company_margin != null ? `R$ ${Number(s.company_margin).toFixed(2)}` : '—'}</td>
                      <td className="px-2 py-1 text-right">{s.amount_to_charge != null ? `R$ ${Number(s.amount_to_charge).toFixed(2)}` : '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
