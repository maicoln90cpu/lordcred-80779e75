import { useState } from 'react';
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
import { parseV8Paste } from '@/lib/v8Parser';

const PARCEL_OPTIONS = [12, 24, 36, 48, 60, 72, 84, 96];
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

  const total = simulations.length;
  const done = simulations.filter((s) => s.status === 'success' || s.status === 'failed').length;
  const success = simulations.filter((s) => s.status === 'success').length;
  const failed = simulations.filter((s) => s.status === 'failed').length;
  const pct = total > 0 ? Math.round((done / total) * 100) : 0;

  async function handleStart() {
    const rows = parseV8Paste(pasteText);
    if (rows.length === 0) {
      toast.error('Cole pelo menos 1 CPF válido');
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
            await supabase.functions.invoke('v8-clt-api', {
              body: {
                action: 'simulate_one',
                params: {
                  cpf: sim.cpf,
                  nome: sim.name,
                  data_nascimento: sim.birth_date,
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
                  {PARCEL_OPTIONS.map((p) => (
                    <SelectItem key={p} value={String(p)}>
                      {p}x
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div>
            <Label>CPFs (1 por linha — formatos: CPF | CPF Nome | CPF Nome dd/mm/aaaa)</Label>
            <Textarea
              rows={8}
              placeholder={`12345678901\n98765432100\tMaria Silva\t15/03/1985`}
              value={pasteText}
              onChange={(e) => setPasteText(e.target.value)}
              className="font-mono text-xs"
            />
            <p className="text-xs text-muted-foreground mt-1">
              {parseV8Paste(pasteText).length} CPFs válidos detectados
            </p>
          </div>

          <Button onClick={handleStart} disabled={running} size="lg" className="w-full">
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
