import { TrendingUp } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import type { SystemSettings } from '@/hooks/useSettingsData';

interface Props {
  settings: SystemSettings;
  onChange: (s: SystemSettings) => void;
}

export default function SettingsPhaseProgression({ settings, onChange }: Props) {
  const set = (partial: Partial<SystemSettings>) => onChange({ ...settings, ...partial });

  return (
    <Card className="border-border/50 lg:col-span-2">
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <TrendingUp className="w-5 h-5 text-primary" />
              Progressão Automática de Fases
            </CardTitle>
            <CardDescription>Promove os chips automaticamente de fase com base nos dias desde a ativação</CardDescription>
          </div>
          <div className="flex items-center gap-2">
            <Label htmlFor="auto-progression" className="text-sm">
              {(settings as any).auto_phase_progression ? 'Ativo' : 'Desativado'}
            </Label>
            <Switch
              id="auto-progression"
              checked={(settings as any).auto_phase_progression}
              onCheckedChange={(c) => set({ auto_phase_progression: c })}
            />
          </div>
        </div>
      </CardHeader>
      {(settings as any).auto_phase_progression && (
        <CardContent className="space-y-4">
          <p className="text-xs text-muted-foreground">
            Defina quantos dias o chip deve permanecer em cada fase antes de ser promovido automaticamente.
          </p>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {[
              { label: '🔵 Novo (dias)', key: 'days_phase_novo' as const },
              { label: '🟡 Iniciante (dias)', key: 'days_phase_iniciante' as const },
              { label: '🟠 Crescimento (dias)', key: 'days_phase_crescimento' as const },
              { label: '🔴 Aquecido (dias)', key: 'days_phase_aquecido' as const },
            ].map(({ label, key }) => (
              <div key={key} className="space-y-1">
                <Label className="text-xs text-muted-foreground">{label}</Label>
                <Input
                  type="number"
                  value={(settings as any)[key]}
                  onChange={(e) => set({ [key]: parseInt(e.target.value) || 0 })}
                />
              </div>
            ))}
          </div>
          <div className="p-3 rounded-lg bg-primary/5 border border-primary/20">
            <p className="text-xs text-muted-foreground">
              💡 Fluxo: Novo ({(settings as any).days_phase_novo}d) → Iniciante ({(settings as any).days_phase_iniciante}d) → Crescimento ({(settings as any).days_phase_crescimento}d) → Aquecido ({(settings as any).days_phase_aquecido}d) → Maduro
            </p>
          </div>
        </CardContent>
      )}
    </Card>
  );
}
