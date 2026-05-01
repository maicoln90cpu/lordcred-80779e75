import { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Loader2, Power, PowerOff, Search } from 'lucide-react';
import { toast } from 'sonner';

interface Toggle {
  id: string;
  feature_key: string;
  feature_label: string;
  feature_group: string;
  is_enabled: boolean;
}

export default function MasterModulesTab() {
  const queryClient = useQueryClient();

  const { data: toggles = [], isLoading } = useQuery({
    queryKey: ['master-feature-toggles-admin'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('master_feature_toggles')
        .select('*')
        .order('feature_group', { ascending: true })
        .order('feature_label', { ascending: true });
      if (error) throw error;
      return data as Toggle[];
    },
  });

  const toggleMutation = useMutation({
    mutationFn: async ({ id, is_enabled }: { id: string; is_enabled: boolean }) => {
      const { error } = await supabase
        .from('master_feature_toggles')
        .update({ is_enabled, updated_at: new Date().toISOString() })
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['master-feature-toggles-admin'] });
      queryClient.invalidateQueries({ queryKey: ['master-feature-toggles'] });
    },
    onError: () => {
      toast.error('Erro ao atualizar módulo');
    },
  });

  const [search, setSearch] = useState('');

  const { groups, totalVisible, enabledCount, disabledCount } = useMemo(() => {
    const term = search.trim().toLowerCase();
    const filtered = term
      ? toggles.filter(
          (t) =>
            t.feature_label.toLowerCase().includes(term) ||
            t.feature_key.toLowerCase().includes(term) ||
            t.feature_group.toLowerCase().includes(term),
        )
      : toggles;

    const grouped: Record<string, Toggle[]> = {};
    filtered.forEach((t) => {
      if (!grouped[t.feature_group]) grouped[t.feature_group] = [];
      grouped[t.feature_group].push(t);
    });
    Object.values(grouped).forEach((arr) =>
      arr.sort((a, b) => a.feature_label.localeCompare(b.feature_label, 'pt-BR')),
    );

    return {
      groups: grouped,
      totalVisible: filtered.length,
      enabledCount: toggles.filter((t) => t.is_enabled).length,
      disabledCount: toggles.filter((t) => !t.is_enabled).length,
    };
  }, [toggles, search]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Summary + Search */}
      <div className="flex flex-col sm:flex-row sm:items-center gap-3 sm:justify-between">
        <div className="flex gap-2 flex-wrap">
          <Badge variant="outline" className="gap-1.5 px-3 py-1.5 text-sm">
            <Power className="w-3.5 h-3.5 text-green-500" />
            {enabledCount} ativos
          </Badge>
          <Badge variant="outline" className="gap-1.5 px-3 py-1.5 text-sm">
            <PowerOff className="w-3.5 h-3.5 text-muted-foreground" />
            {disabledCount} ocultos
          </Badge>
          {search && (
            <Badge variant="secondary" className="px-3 py-1.5 text-sm">
              {totalVisible} resultado{totalVisible !== 1 ? 's' : ''}
            </Badge>
          )}
        </div>
        <div className="relative w-full sm:w-72">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Buscar módulo..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
      </div>

      {/* Groups */}
      {Object.entries(groups).map(([group, items]) => {
        const allEnabled = items.every(i => i.is_enabled);
        const noneEnabled = items.every(i => !i.is_enabled);

        return (
          <Card key={group}>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-lg">{group}</CardTitle>
                  <CardDescription>
                    {items.filter(i => i.is_enabled).length}/{items.length} módulos ativos
                  </CardDescription>
                </div>
                {/* Group toggle */}
                <div className="flex items-center gap-2">
                  <span className="text-xs text-muted-foreground">
                    {allEnabled ? 'Todos ativos' : noneEnabled ? 'Todos ocultos' : 'Parcial'}
                  </span>
                  <Switch
                    checked={allEnabled}
                    onCheckedChange={(checked) => {
                      items.forEach(item => {
                        if (item.is_enabled !== checked) {
                          toggleMutation.mutate({ id: item.id, is_enabled: checked });
                        }
                      });
                      toast.success(
                        checked 
                          ? `Todos os módulos de "${group}" foram ativados`
                          : `Todos os módulos de "${group}" foram ocultados`
                      );
                    }}
                  />
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {items.map(item => (
                  <div
                    key={item.id}
                    className="flex items-center justify-between py-2 px-3 rounded-md border bg-background"
                  >
                    <div className="flex items-center gap-3">
                      {item.is_enabled ? (
                        <Power className="w-4 h-4 text-green-500" />
                      ) : (
                        <PowerOff className="w-4 h-4 text-muted-foreground" />
                      )}
                      <span className={item.is_enabled ? 'text-foreground' : 'text-muted-foreground'}>
                        {item.feature_label}
                      </span>
                    </div>
                    <Switch
                      checked={item.is_enabled}
                      onCheckedChange={(checked) => {
                        toggleMutation.mutate({ id: item.id, is_enabled: checked });
                        toast.success(
                          checked
                            ? `"${item.feature_label}" ativado`
                            : `"${item.feature_label}" ocultado para todos`
                        );
                      }}
                    />
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
