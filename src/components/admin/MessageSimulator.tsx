import { useMemo } from 'react';
import { Activity, CheckCircle, Smartphone } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';

interface Chip {
  id: string;
  activated_at: string | null;
  status: string;
  warming_phase?: string;
}

interface Settings {
  messages_day_novo?: number;
  messages_day_1_3: number;
  messages_day_4_7: number;
  messages_day_aquecido?: number;
  messages_day_8_plus: number;
  start_hour: number;
  end_hour: number;
}

interface MessageSimulatorProps {
  settings: Settings;
  chips: Chip[];
}

const PHASE_LABELS: Record<string, string> = {
  novo: 'Novo',
  iniciante: 'Iniciante',
  crescimento: 'Crescimento',
  aquecido: 'Aquecido',
  maduro: 'Maduro',
};

function getDailyLimitForPhase(phase: string, settings: Settings): number {
  switch (phase) {
    case 'novo': return (settings as any).messages_day_novo ?? 5;
    case 'iniciante': return settings.messages_day_1_3;
    case 'crescimento': return settings.messages_day_4_7;
    case 'aquecido': return (settings as any).messages_day_aquecido ?? 80;
    case 'maduro': return settings.messages_day_8_plus;
    default: return (settings as any).messages_day_novo ?? 5;
  }
}

function calculateEstimate(settings: Settings, chips: Chip[]) {
  const connectedChips = chips.filter(c => c.status === 'connected');

  if (connectedChips.length === 0) {
    return {
      totalDailyMessages: 0,
      operatingHours: settings.end_hour - settings.start_hour,
      messagesPerHour: 0,
      phases: {} as Record<string, number>,
      connectedCount: 0,
      phaseIntervals: {} as Record<string, number>,
    };
  }

  let totalDailyMessages = 0;
  const phases: Record<string, number> = {};

  connectedChips.forEach(chip => {
    const phase = chip.warming_phase || 'novo';
    phases[phase] = (phases[phase] || 0) + 1;
    totalDailyMessages += getDailyLimitForPhase(phase, settings);
  });

  const operatingHours = settings.end_hour - settings.start_hour;
  const messagesPerHour = operatingHours > 0 ? totalDailyMessages / operatingHours : 0;

  // Calculate average interval per phase
  const phaseIntervals: Record<string, number> = {};
  Object.keys(phases).forEach(phase => {
    const dailyLimit = getDailyLimitForPhase(phase, settings);
    if (operatingHours > 0 && dailyLimit > 0) {
      phaseIntervals[phase] = Math.round((operatingHours * 3600) / dailyLimit);
    }
  });

  return {
    totalDailyMessages,
    operatingHours,
    messagesPerHour,
    phases,
    connectedCount: connectedChips.length,
    phaseIntervals,
  };
}

export default function MessageSimulator({ settings, chips }: MessageSimulatorProps) {
  const estimate = useMemo(() => calculateEstimate(settings, chips), [settings, chips]);

  if (estimate.connectedCount === 0) {
    return (
      <Card className="border-border/50">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Activity className="w-5 h-5 text-primary" />
            Simulador de Volume
          </CardTitle>
          <CardDescription>Estimativa de mensagens por dia</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="text-center py-6 text-muted-foreground">
            <Smartphone className="w-10 h-10 mx-auto mb-2 opacity-50" />
            <p>Nenhum chip conectado</p>
            <p className="text-sm">Conecte chips para ver a estimativa</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="border-border/50">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Activity className="w-5 h-5 text-primary" />
          Simulador de Volume
        </CardTitle>
        <CardDescription>Estimativa com distribuição inteligente ao longo do dia</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">Chips conectados:</span>
            <span className="font-medium">{estimate.connectedCount}</span>
          </div>
          <div className="flex flex-wrap gap-1">
            {Object.entries(estimate.phases).map(([phase, count]) => (
              <Badge key={phase} variant="secondary" className="text-xs">
                {count}x {PHASE_LABELS[phase] || phase} ({getDailyLimitForPhase(phase, settings)} msgs)
              </Badge>
            ))}
          </div>
        </div>

        <div className="grid gap-2 text-sm">
          <div className="flex items-center justify-between">
            <span className="text-muted-foreground">Meta diária total:</span>
            <span className="font-medium">{estimate.totalDailyMessages} mensagens</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-muted-foreground">Horas de operação:</span>
            <span className="font-medium">
              {estimate.operatingHours}h ({settings.start_hour.toString().padStart(2, '0')}:00 - {settings.end_hour.toString().padStart(2, '0')}:00)
            </span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-muted-foreground">Mensagens/hora:</span>
            <span className="font-medium">~{estimate.messagesPerHour.toFixed(1)} msg/hora</span>
          </div>
        </div>

        {/* Average interval per phase */}
        {Object.keys(estimate.phaseIntervals).length > 0 && (
          <div className="space-y-2">
            <span className="text-sm text-muted-foreground">Intervalo médio calculado por fase:</span>
            <div className="grid gap-1">
              {Object.entries(estimate.phaseIntervals).map(([phase, seconds]) => (
                <div key={phase} className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">{PHASE_LABELS[phase] || phase}:</span>
                  <span className="font-medium">
                    {seconds >= 60 ? `${Math.round(seconds / 60)} min` : `${seconds}s`}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="flex items-center gap-2 text-sm">
          <Badge variant="outline" className="gap-1 border-primary text-primary">
            <CheckCircle className="w-3 h-3" />
            Distribuição automática ativa
          </Badge>
        </div>
      </CardContent>
    </Card>
  );
}
