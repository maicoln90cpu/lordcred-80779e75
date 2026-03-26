import DashboardLayout from '@/components/layout/DashboardLayout';
import { Cog, Save } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { useCorbanFeatures, CorbanFeature } from '@/hooks/useCorbanFeatures';
import { supabase } from '@/integrations/supabase/client';
import { useState, useEffect } from 'react';
import { toast } from 'sonner';
import { useAuth } from '@/contexts/AuthContext';

const CATEGORY_LABELS: Record<string, string> = {
  admin_consultas: '📊 Admin — Consultas',
  admin_sync: '🔄 Admin — Sincronização',
  admin_fgts: '🏦 Admin — FGTS',
  admin_config: '⚙️ Admin — Configuração',
  seller_consultas: '🔍 Vendedor — Consultas',
  seller_fgts: '🏦 Vendedor — FGTS',
  seller_acoes: '⚡ Vendedor — Ações',
  seller_acompanhamento: '📋 Vendedor — Acompanhamento',
};

export default function CorbanConfig() {
  const { features, featuresByCategory, isLoading, refetch } = useCorbanFeatures();
  const { isMaster } = useAuth();
  const [localFeatures, setLocalFeatures] = useState<Record<string, { sellers: boolean; support: boolean }>>({});
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (features.length > 0) {
      const map: Record<string, { sellers: boolean; support: boolean }> = {};
      features.forEach(f => {
        map[f.feature_key] = { sellers: f.visible_to_sellers, support: f.visible_to_support };
      });
      setLocalFeatures(map);
    }
  }, [features]);

  const toggleSeller = (key: string) => {
    setLocalFeatures(prev => ({
      ...prev,
      [key]: { ...prev[key], sellers: !prev[key]?.sellers }
    }));
  };

  const toggleSupport = (key: string) => {
    setLocalFeatures(prev => ({
      ...prev,
      [key]: { ...prev[key], support: !prev[key]?.support }
    }));
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      for (const feature of features) {
        const local = localFeatures[feature.feature_key];
        if (!local) continue;
        if (local.sellers !== feature.visible_to_sellers || local.support !== feature.visible_to_support) {
          await supabase
            .from('corban_feature_config')
            .update({
              visible_to_sellers: local.sellers,
              visible_to_support: local.support,
              updated_at: new Date().toISOString(),
            })
            .eq('feature_key', feature.feature_key);
        }
      }
      toast.success('Configurações salvas com sucesso!');
      refetch();
    } catch (err: any) {
      toast.error('Erro ao salvar', { description: err.message });
    }
    setSaving(false);
  };

  if (isLoading) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center py-12">
          <p className="text-muted-foreground">Carregando configurações...</p>
        </div>
      </DashboardLayout>
    );
  }

  const categories = Object.keys(featuresByCategory).sort();

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2">
              <Cog className="w-6 h-6 text-primary" />
              Configuração Corban
            </h1>
            <p className="text-muted-foreground text-sm mt-1">Controlar visibilidade das features por role</p>
          </div>
          <Button onClick={handleSave} disabled={saving}>
            <Save className="w-4 h-4 mr-2" />
            {saving ? 'Salvando...' : 'Salvar Configuração'}
          </Button>
        </div>

        <div className="grid gap-6">
          {categories.map(cat => {
            const catFeatures = featuresByCategory[cat] || [];
            return (
              <Card key={cat}>
                <CardHeader>
                  <CardTitle className="text-base">{CATEGORY_LABELS[cat] || cat}</CardTitle>
                  <CardDescription>
                    {cat.startsWith('admin_') ? 'Features visíveis apenas para Admin/Master' : 'Features que podem ser habilitadas para vendedores'}
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    <div className="grid grid-cols-[1fr,80px,80px] gap-2 text-xs font-medium text-muted-foreground border-b pb-2">
                      <span>Feature</span>
                      <span className="text-center">Vendedor</span>
                      <span className="text-center">Suporte</span>
                    </div>
                    {catFeatures.map((f: CorbanFeature) => {
                      const local = localFeatures[f.feature_key];
                      return (
                        <div key={f.feature_key} className="grid grid-cols-[1fr,80px,80px] gap-2 items-center">
                          <div>
                            <p className="text-sm font-medium">{f.feature_label}</p>
                            {f.description && (
                              <p className="text-xs text-muted-foreground">{f.description}</p>
                            )}
                          </div>
                          <div className="flex justify-center">
                            <Switch
                              checked={local?.sellers ?? false}
                              onCheckedChange={() => toggleSeller(f.feature_key)}
                            />
                          </div>
                          <div className="flex justify-center">
                            <Switch
                              checked={local?.support ?? true}
                              onCheckedChange={() => toggleSupport(f.feature_key)}
                            />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      </div>
    </DashboardLayout>
  );
}
