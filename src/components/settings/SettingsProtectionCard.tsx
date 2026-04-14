import { Shield, Activity, Users, Timer, Shuffle, Moon, Calendar, AlertTriangle } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Separator } from '@/components/ui/separator';
import { Slider } from '@/components/ui/slider';
import type { SystemSettings } from '@/hooks/useSettingsData';

interface Props {
  settings: SystemSettings;
  onChange: (s: SystemSettings) => void;
}

export default function SettingsProtectionCard({ settings, onChange }: Props) {
  const set = (partial: Partial<SystemSettings>) => onChange({ ...settings, ...partial });

  return (
    <Card className="border-border/50">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Shield className="w-5 h-5 text-primary" />
          Proteção Anti-Bloqueio
        </CardTitle>
        <CardDescription>12 configurações para evitar detecção e bloqueio</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-center justify-between p-3 rounded-lg bg-primary/5 border border-primary/20">
          <div className="flex items-center gap-2">
            <Activity className="w-4 h-4 text-primary" />
            <div>
              <Label className="text-sm font-medium">Modo Comportamento Humano</Label>
              <p className="text-xs text-muted-foreground">Ativa todas as simulações</p>
            </div>
          </div>
          <Switch checked={settings.human_pattern_mode} onCheckedChange={(c) => set({ human_pattern_mode: c })} />
        </div>

        <Separator />

        <div className="space-y-3">
          <Label className="flex items-center gap-2"><Users className="w-4 h-4" />Controle de Lotes</Label>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">Tamanho do lote</Label>
              <Input type="number" value={settings.batch_size} onChange={(e) => set({ batch_size: parseInt(e.target.value) || 0 })} />
            </div>
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">Pausa entre lotes (seg)</Label>
              <Input type="number" value={settings.batch_pause_seconds} onChange={(e) => set({ batch_pause_seconds: parseInt(e.target.value) || 0 })} />
            </div>
          </div>
        </div>

        <div className="space-y-3">
          <Label className="flex items-center gap-2"><Timer className="w-4 h-4" />Controle de Mensagens</Label>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">Msgs consecutivas</Label>
              <Input type="number" value={settings.consecutive_message_limit} onChange={(e) => set({ consecutive_message_limit: parseInt(e.target.value) || 0 })} />
            </div>
          </div>
        </div>

        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <Label className="flex items-center gap-2"><Shuffle className="w-4 h-4" />Simulação de Digitação</Label>
            <Switch checked={settings.typing_simulation} onCheckedChange={(c) => set({ typing_simulation: c })} />
          </div>
          {settings.typing_simulation && (
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1">
                <Label className="text-xs text-muted-foreground">Velocidade (chars/seg)</Label>
                <Input type="number" value={settings.typing_speed_chars_sec} onChange={(e) => set({ typing_speed_chars_sec: parseInt(e.target.value) || 0 })} />
              </div>
              <div className="space-y-1">
                <Label className="text-xs text-muted-foreground">Delay leitura (seg)</Label>
                <Input type="number" value={settings.read_delay_seconds} onChange={(e) => set({ read_delay_seconds: parseInt(e.target.value) || 0 })} />
              </div>
            </div>
          )}
        </div>

        <div className="flex items-center justify-between">
          <Label className="text-sm">Simular Online/Offline</Label>
          <Switch checked={settings.online_offline_simulation} onCheckedChange={(c) => set({ online_offline_simulation: c })} />
        </div>

        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <Label className="text-sm">Variação aleatória (%)</Label>
            <span className="text-sm font-medium">{settings.random_delay_variation}%</span>
          </div>
          <Slider value={[settings.random_delay_variation || 0]} onValueChange={([v]) => set({ random_delay_variation: v })} max={50} step={5} />
        </div>

        <div className="space-y-3">
          <Label className="flex items-center gap-2"><Calendar className="w-4 h-4" />Reduções de Volume</Label>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">Fim de semana (%)</Label>
              <Input type="number" value={settings.weekend_reduction_percent} onChange={(e) => set({ weekend_reduction_percent: parseInt(e.target.value) || 0 })} />
            </div>
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground flex items-center gap-1"><Moon className="w-3 h-3" /> Noturno (%)</Label>
              <Input type="number" value={settings.night_mode_reduction} onChange={(e) => set({ night_mode_reduction: parseInt(e.target.value) || 0 })} />
            </div>
          </div>
        </div>

        <div className="space-y-1">
          <Label className="flex items-center gap-2 text-sm"><AlertTriangle className="w-4 h-4" />Cooldown após erro (segundos)</Label>
          <Input type="number" value={settings.cooldown_after_error} onChange={(e) => set({ cooldown_after_error: parseInt(e.target.value) || 0 })} />
        </div>
      </CardContent>
    </Card>
  );
}
