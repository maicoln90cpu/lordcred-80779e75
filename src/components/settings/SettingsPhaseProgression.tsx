import { useEffect, useState } from 'react';
import { TrendingUp, Loader2, Save } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

interface PhaseRule {
  id: string;
  phase_from: string;
  phase_to: string;
  min_days: number;
  min_avg_messages: number;
  sort_order: number;
}

const PHASE_LABELS: Record<string, string> = {
  novo: '🔵 Novo',
  iniciante: '🟡 Iniciante',
  crescimento: '🟠 Crescimento',
  aquecido: '🔴 Aquecido',
};

export default function SettingsPhaseProgression() {
  const { toast } = useToast();
  const [rules, setRules] = useState<PhaseRule[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetchRules();
  }, []);

  const fetchRules = async () => {
    const { data } = await supabase
      .from('warming_phase_rules')
      .select('*')
      .order('sort_order', { ascending: true });
    if (data) setRules(data as PhaseRule[]);
    setLoading(false);
  };

  const updateRule = (id: string, field: 'min_days' | 'min_avg_messages', value: number) => {
    setRules(prev => prev.map(r => r.id === id ? { ...r, [field]: value } : r));
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      for (const rule of rules) {
        await supabase
          .from('warming_phase_rules')
          .update({ min_days: rule.min_days, min_avg_messages: rule.min_avg_messages })
          .eq('id', rule.id);
      }
      toast({ title: 'Regras salvas', description: 'As regras de progressão foram atualizadas' });
    } catch {
      toast({ title: 'Erro', description: 'Não foi possível salvar', variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  // Calculate cumulative days
  const getCumulativeDays = (index: number) => {
    let total = 0;
    for (let i = 0; i <= index; i++) {
      total += rules[i]?.min_days || 0;
    }
    return total;
  };

  if (loading) {
    return (
      <Card className="border-border/50 lg:col-span-2">
        <CardContent className="flex items-center justify-center py-8">
          <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="border-border/50 lg:col-span-2">
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <TrendingUp className="w-5 h-5 text-primary" />
              Progressão Automática de Fases
            </CardTitle>
            <CardDescription>
              Chips são promovidos automaticamente quando atingem os critérios de dias + média de mensagens/dia
            </CardDescription>
          </div>
          <Button size="sm" onClick={handleSave} disabled={saving}>
            {saving ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Save className="w-4 h-4 mr-2" />}
            Salvar
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {rules.map((rule, index) => (
            <div key={rule.id} className="p-3 rounded-lg border border-border/50 space-y-3">
              <p className="text-sm font-medium">
                {PHASE_LABELS[rule.phase_from] || rule.phase_from} → {PHASE_LABELS[rule.phase_to] || rule.phase_to}
              </p>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label className="text-xs text-muted-foreground">Dias mínimos</Label>
                  <Input
                    type="number"
                    min={1}
                    value={rule.min_days}
                    onChange={(e) => updateRule(rule.id, 'min_days', parseInt(e.target.value) || 1)}
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs text-muted-foreground">Média msgs/dia</Label>
                  <Input
                    type="number"
                    min={1}
                    value={rule.min_avg_messages}
                    onChange={(e) => updateRule(rule.id, 'min_avg_messages', parseInt(e.target.value) || 1)}
                  />
                </div>
              </div>
              <p className="text-xs text-muted-foreground">
                Promoção após ~{getCumulativeDays(index)} dias desde ativação
              </p>
            </div>
          ))}
        </div>

        <div className="p-3 rounded-lg bg-primary/5 border border-primary/20">
          <p className="text-xs text-muted-foreground">
            💡 Fluxo: Novo ({rules[0]?.min_days}d) → Iniciante (+{rules[1]?.min_days}d) → Crescimento (+{rules[2]?.min_days}d) → Aquecido (+{rules[3]?.min_days}d) → Maduro
          </p>
          <p className="text-xs text-muted-foreground mt-1">
            📊 A média de mensagens é calculada sobre os últimos N dias de cada fase. Promoções são registradas em <em>chip_lifecycle_logs</em>.
          </p>
        </div>
      </CardContent>
    </Card>
  );
}
