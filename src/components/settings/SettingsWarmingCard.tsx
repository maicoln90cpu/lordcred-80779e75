import { Clock, Zap } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Separator } from '@/components/ui/separator';
import type { SystemSettings } from '@/hooks/useSettingsData';
import { BRAZIL_TIMEZONES } from '@/hooks/useSettingsData';

interface Props {
  settings: SystemSettings;
  onChange: (s: SystemSettings) => void;
}

export default function SettingsWarmingCard({ settings, onChange }: Props) {
  const set = (partial: Partial<SystemSettings>) => onChange({ ...settings, ...partial });

  return (
    <Card className="border-border/50">
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Zap className="w-5 h-5 text-primary" />
              Aquecimento
            </CardTitle>
            <CardDescription>Configure o modo e regras de aquecimento</CardDescription>
          </div>
          <div className="flex items-center gap-2">
            <Label htmlFor="warming-active" className="text-sm">
              {settings.is_warming_active ? 'Ativo' : 'Pausado'}
            </Label>
            <Switch
              id="warming-active"
              checked={settings.is_warming_active}
              onCheckedChange={(checked) => set({ is_warming_active: checked })}
            />
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <Label>Modo de Aquecimento</Label>
          <Select value={settings.warming_mode} onValueChange={(v) => set({ warming_mode: v })}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="same_user">Entre chips do mesmo usuário</SelectItem>
              <SelectItem value="between_users">Entre chips de usuários diferentes</SelectItem>
              <SelectItem value="external">Para números externos</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <Label className="flex items-center gap-2"><Clock className="w-4 h-4" />Fuso Horário</Label>
          <Select value={settings.timezone || 'America/Sao_Paulo'} onValueChange={(v) => set({ timezone: v })}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              {BRAZIL_TIMEZONES.map((tz) => (
                <SelectItem key={tz.value} value={tz.value}>{tz.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <p className="text-xs text-muted-foreground">Todas as operações de horário usarão este fuso</p>
        </div>

        <Separator />

        <div className="space-y-2">
          <Label className="flex items-center gap-2"><Clock className="w-4 h-4" />Horário de Funcionamento</Label>
          <div className="grid grid-cols-2 gap-4">
            {(['start_hour', 'end_hour'] as const).map((field) => (
              <div key={field} className="space-y-1">
                <Label className="text-xs text-muted-foreground">{field === 'start_hour' ? 'Início' : 'Fim'}</Label>
                <Select value={settings[field].toString()} onValueChange={(v) => set({ [field]: parseInt(v) })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {Array.from({ length: 24 }, (_, i) => (
                      <SelectItem key={i} value={i.toString()}>{i.toString().padStart(2, '0')}:00</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            ))}
          </div>
        </div>

        <Separator />

        <div className="space-y-3">
          <Label>Limites de Mensagens por Dia (por fase)</Label>
          <p className="text-xs text-muted-foreground">Defina a fase de cada chip em "Meus Chips". O sistema distribui as mensagens ao longo do dia automaticamente.</p>
          <div className="grid gap-3">
            {[
              { label: '🔵 Novo:', key: 'messages_day_novo' as const },
              { label: '🟡 Iniciante:', key: 'messages_day_1_3' as const },
              { label: '🟠 Crescimento:', key: 'messages_day_4_7' as const },
              { label: '🔴 Aquecido:', key: 'messages_day_aquecido' as const },
              { label: '🟢 Maduro:', key: 'messages_day_8_plus' as const },
            ].map(({ label, key }) => (
              <div key={key} className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">{label}</span>
                <Input
                  type="number"
                  className="w-20"
                  value={(settings as any)[key]}
                  onChange={(e) => set({ [key]: parseInt(e.target.value) || 0 })}
                />
              </div>
            ))}
          </div>
        </div>

        <div className="p-3 rounded-lg bg-primary/5 border border-primary/20">
          <p className="text-xs text-muted-foreground">
            💡 O sistema calcula automaticamente os intervalos entre mensagens para distribuir o volume ao longo do dia, com variação aleatória para parecer natural.
          </p>
        </div>
      </CardContent>
    </Card>
  );
}
