import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Loader2, Save, Zap, Volume2 } from 'lucide-react';
import { toast } from 'sonner';
import { useV8Settings } from '@/hooks/useV8Settings';

export default function V8RetrySettingsCard() {
  const { settings, loading, saving, save, defaults } = useV8Settings();
  const [maxAttempts, setMaxAttempts] = useState(defaults.max_auto_retry_attempts);
  const [minBackoff, setMinBackoff] = useState(defaults.retry_min_backoff_seconds);
  const [maxBackoff, setMaxBackoff] = useState(defaults.retry_max_backoff_seconds);
  const [batchSize, setBatchSize] = useState(defaults.retry_batch_size);
  const [enabled, setEnabled] = useState(defaults.background_retry_enabled);
  const [soundOn, setSoundOn] = useState(defaults.sound_on_complete);

  useEffect(() => {
    if (!settings) return;
    setMaxAttempts(settings.max_auto_retry_attempts);
    setMinBackoff(settings.retry_min_backoff_seconds);
    setMaxBackoff(settings.retry_max_backoff_seconds);
    setBatchSize(settings.retry_batch_size);
    setEnabled(settings.background_retry_enabled);
    setSoundOn(settings.sound_on_complete ?? false);
  }, [settings]);

  async function handleSave() {
    if (maxBackoff < minBackoff) {
      toast.error('Backoff máximo deve ser maior ou igual ao mínimo');
      return;
    }
    const ok = await save({
      max_auto_retry_attempts: maxAttempts,
      retry_min_backoff_seconds: minBackoff,
      retry_max_backoff_seconds: maxBackoff,
      retry_batch_size: batchSize,
      background_retry_enabled: enabled,
      sound_on_complete: soundOn,
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
      <CardContent className="space-y-4">
        <p className="text-sm text-muted-foreground">
          Quando ativado, um robô verifica a cada 1 minuto as simulações que falharam por
          instabilidade temporária da V8 (rate limit, 5xx, "ainda em análise") e re-dispara
          automaticamente — mesmo com o navegador fechado.
        </p>

        <div className="flex items-center gap-3">
          <Switch checked={enabled} onCheckedChange={setEnabled} disabled={loading} />
          <Label>Ativar auto-retry em background (cron)</Label>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <Label>Máximo de tentativas por simulação</Label>
            <Input
              type="number"
              min={1}
              max={100}
              value={maxAttempts}
              onChange={(e) => setMaxAttempts(Number(e.target.value))}
              disabled={loading}
            />
            <p className="text-xs text-muted-foreground mt-1">
              Acima disso, vira responsabilidade humana (clicar em "Retentar falhados").
            </p>
          </div>

          <div>
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
              Quantas simulações o cron processa em cada minuto.
            </p>
          </div>

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
              Tempo mínimo entre tentativas da mesma simulação.
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
              Teto do backoff exponencial (loop frontend de fallback).
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3 rounded border border-border/60 bg-muted/30 p-3">
          <Volume2 className="w-4 h-4 text-muted-foreground" />
          <div className="flex-1">
            <Label className="cursor-pointer">Tocar som ao concluir lote</Label>
            <p className="text-xs text-muted-foreground mt-0.5">
              Quando ativo, um beep curto é tocado no navegador ao final de cada lote (sucesso ou falha). Útil para acompanhar lotes em segundo plano.
            </p>
          </div>
          <Switch checked={soundOn} onCheckedChange={setSoundOn} disabled={loading} />
        </div>

        <Button onClick={handleSave} disabled={saving || loading}>
          {saving ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Save className="w-4 h-4 mr-2" />}
          Salvar configurações
        </Button>
      </CardContent>
    </Card>
  );
}
