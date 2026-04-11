import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from 'sonner';
import { Loader2, Wand2, Save, CheckCircle, AlertTriangle, Users } from 'lucide-react';

interface SellerMapping {
  id: string;
  corban_name: string;
  user_id: string | null;
  similarity_score: number | null;
  updated_at: string;
}

interface Profile {
  user_id: string;
  name: string;
  email: string;
}

export function SellerMappingTab() {
  const queryClient = useQueryClient();
  const [localChanges, setLocalChanges] = useState<Record<string, string | null>>({});

  const { data: mappings = [], isLoading: loadingMappings } = useQuery({
    queryKey: ['corban-seller-mapping'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('corban_seller_mapping')
        .select('*')
        .order('corban_name');
      if (error) throw error;
      return data as SellerMapping[];
    },
  });

  const { data: profiles = [] } = useQuery({
    queryKey: ['profiles-for-mapping'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('profiles')
        .select('user_id, name, email')
        .order('name');
      if (error) throw error;
      return data as Profile[];
    },
  });

  const autoMatchMutation = useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.rpc('auto_match_corban_sellers');
      if (error) throw error;
      return data;
    },
    onSuccess: (data: any) => {
      queryClient.invalidateQueries({ queryKey: ['corban-seller-mapping'] });
      setLocalChanges({});
      toast.success(`Auto-Match concluído`, {
        description: `${data?.inserted || 0} novos vendedores, ${data?.matched || 0} associados automaticamente`,
      });
    },
    onError: (e: any) => toast.error('Erro no auto-match', { description: e.message }),
  });

  const saveMutation = useMutation({
    mutationFn: async () => {
      const entries = Object.entries(localChanges);
      for (const [mappingId, userId] of entries) {
        const { error } = await supabase
          .from('corban_seller_mapping')
          .update({ user_id: userId || null, similarity_score: userId ? 1 : 0 })
          .eq('id', mappingId);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['corban-seller-mapping'] });
      setLocalChanges({});
      toast.success('Mapeamento salvo com sucesso!');
    },
    onError: (e: any) => toast.error('Erro ao salvar', { description: e.message }),
  });

  const getEffectiveUserId = (m: SellerMapping) =>
    localChanges[m.id] !== undefined ? localChanges[m.id] : m.user_id;

  const mappedCount = mappings.filter(m => getEffectiveUserId(m)).length;
  const hasDirty = Object.keys(localChanges).length > 0;

  if (loadingMappings) {
    return <div className="flex items-center justify-center py-12"><Loader2 className="w-6 h-6 animate-spin text-muted-foreground" /></div>;
  }

  return (
    <div className="space-y-4">
      {/* Summary + Actions */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Users className="w-5 h-5 text-primary" />
              Mapeamento de Vendedores
            </div>
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => autoMatchMutation.mutate()}
                disabled={autoMatchMutation.isPending}
              >
                {autoMatchMutation.isPending ? <Loader2 className="w-3.5 h-3.5 mr-1 animate-spin" /> : <Wand2 className="w-3.5 h-3.5 mr-1" />}
                Auto-Match
              </Button>
              <Button
                size="sm"
                onClick={() => saveMutation.mutate()}
                disabled={!hasDirty || saveMutation.isPending}
              >
                {saveMutation.isPending ? <Loader2 className="w-3.5 h-3.5 mr-1 animate-spin" /> : <Save className="w-3.5 h-3.5 mr-1" />}
                Salvar
              </Button>
            </div>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground mb-3">
            Associe cada vendedor vindo da Corban ao usuário correspondente no sistema.
            O botão "Auto-Match" busca automaticamente o usuário com nome mais parecido.
          </p>
          <div className="flex gap-3 text-sm">
            <Badge variant="default">{mappings.length} vendedores</Badge>
            <Badge variant="secondary" className="gap-1">
              <CheckCircle className="w-3 h-3" /> {mappedCount} mapeados
            </Badge>
            {mappings.length - mappedCount > 0 && (
              <Badge variant="outline" className="gap-1 text-amber-400 border-amber-400/30">
                <AlertTriangle className="w-3 h-3" /> {mappings.length - mappedCount} pendentes
              </Badge>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Mapping Table */}
      <Card>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border/50">
                  <th className="text-left p-3 font-medium text-muted-foreground">Vendedor Corban</th>
                  <th className="text-left p-3 font-medium text-muted-foreground">Usuário no Sistema</th>
                  <th className="text-center p-3 font-medium text-muted-foreground">Score</th>
                  <th className="text-center p-3 font-medium text-muted-foreground">Status</th>
                </tr>
              </thead>
              <tbody>
                {mappings.map(m => {
                  const effectiveUserId = getEffectiveUserId(m);
                  const isDirty = localChanges[m.id] !== undefined;
                  return (
                    <tr key={m.id} className={`border-b border-border/30 ${isDirty ? 'bg-primary/5' : ''}`}>
                      <td className="p-3 font-medium">{m.corban_name}</td>
                      <td className="p-3">
                        <Select
                          value={effectiveUserId || '_none_'}
                          onValueChange={v => {
                            const newVal = v === '_none_' ? null : v;
                            setLocalChanges(prev => ({ ...prev, [m.id]: newVal }));
                          }}
                        >
                          <SelectTrigger className="w-full max-w-xs">
                            <SelectValue placeholder="Selecione um usuário" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="_none_">— Nenhum —</SelectItem>
                            {profiles.map(p => (
                              <SelectItem key={p.user_id} value={p.user_id}>
                                {p.name || p.email}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </td>
                      <td className="p-3 text-center">
                        {m.similarity_score ? (
                          <Badge variant="outline" className="text-xs">
                            {Math.round((m.similarity_score as number) * 100)}%
                          </Badge>
                        ) : '—'}
                      </td>
                      <td className="p-3 text-center">
                        {effectiveUserId ? (
                          <CheckCircle className="w-4 h-4 text-green-500 mx-auto" />
                        ) : (
                          <AlertTriangle className="w-4 h-4 text-amber-400 mx-auto" />
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          {mappings.length === 0 && (
            <div className="p-8 text-center text-muted-foreground">
              Nenhum vendedor encontrado. Clique "Auto-Match" para buscar vendedores dos snapshots.
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
