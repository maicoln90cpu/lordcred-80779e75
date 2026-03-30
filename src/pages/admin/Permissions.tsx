import { useEffect, useState } from 'react';
import DashboardLayout from '@/components/layout/DashboardLayout';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { Shield, Save, Loader2, Users, Search } from 'lucide-react';
import { Input } from '@/components/ui/input';

interface FeaturePermission {
  id: string;
  feature_key: string;
  feature_label: string;
  feature_group: string;
  allowed_user_ids: string[];
}

interface Profile {
  user_id: string;
  name: string | null;
  email: string;
  role: string;
}

export default function Permissions() {
  const { toast } = useToast();
  const { isMaster } = useAuth();
  const [features, setFeatures] = useState<FeaturePermission[]>([]);
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [dirty, setDirty] = useState<Set<string>>(new Set());
  const [searchUser, setSearchUser] = useState('');

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    const [featRes, profRes, rolesRes] = await Promise.all([
      supabase.from('feature_permissions').select('*').order('feature_group').order('feature_label'),
      supabase.from('profiles').select('user_id, name, email').order('name'),
      supabase.from('user_roles').select('user_id, role'),
    ]);

    if (featRes.data) {
      setFeatures(featRes.data.map(f => ({
        ...f,
        allowed_user_ids: (f as any).allowed_user_ids || [],
      })));
    }

    const rolesMap: Record<string, string> = {};
    (rolesRes.data || []).forEach(r => { rolesMap[r.user_id] = r.role; });

    // Get master user IDs to filter them out for non-masters
    let masterIds = new Set<string>();
    if (!isMaster) {
      const { data: mIds } = await supabase.rpc('get_master_user_ids');
      masterIds = new Set<string>((mIds as string[]) || []);
    }

    if (profRes.data) {
      setProfiles(
        profRes.data
          .filter(p => !masterIds.has(p.user_id))
          .map(p => ({ ...p, role: rolesMap[p.user_id] || 'seller' }))
      );
    }
    setLoading(false);
  };

  const toggleUser = (featureId: string, userId: string) => {
    setFeatures(prev => prev.map(f => {
      if (f.id !== featureId) return f;
      const ids = f.allowed_user_ids.includes(userId)
        ? f.allowed_user_ids.filter(id => id !== userId)
        : [...f.allowed_user_ids, userId];
      return { ...f, allowed_user_ids: ids };
    }));
    setDirty(prev => new Set(prev).add(featureId));
  };

  const toggleAllUsersForFeature = (featureId: string, userIds: string[], checked: boolean) => {
    setFeatures(prev => prev.map(f => {
      if (f.id !== featureId) return f;
      const current = new Set(f.allowed_user_ids);
      userIds.forEach(id => checked ? current.add(id) : current.delete(id));
      return { ...f, allowed_user_ids: Array.from(current) };
    }));
    setDirty(prev => new Set(prev).add(featureId));
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const dirtyFeatures = features.filter(f => dirty.has(f.id));
      for (const f of dirtyFeatures) {
        const { error } = await supabase
          .from('feature_permissions')
          .update({ allowed_user_ids: f.allowed_user_ids, updated_at: new Date().toISOString() } as any)
          .eq('id', f.id);
        if (error) throw error;
      }
      toast({ title: 'Permissões salvas', description: `${dirtyFeatures.length} funcionalidade(s) atualizada(s)` });
      setDirty(new Set());
    } catch (error: any) {
      toast({ title: 'Erro', description: error.message, variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  const getRoleLabel = (role: string) => {
    switch (role) {
      case 'master': return 'Master';
      case 'admin': return 'Admin';
      case 'support': return 'Suporte';
      default: return 'Vendedor';
    }
  };

  const getRoleBadgeVariant = (role: string): 'default' | 'secondary' | 'outline' | 'destructive' => {
    switch (role) {
      case 'master': return 'destructive';
      case 'admin': return 'default';
      case 'support': return 'secondary';
      default: return 'outline';
    }
  };

  // Group features
  const groups = features.reduce<Record<string, FeaturePermission[]>>((acc, f) => {
    (acc[f.feature_group] = acc[f.feature_group] || []).push(f);
    return acc;
  }, {});

  const filteredProfiles = profiles.filter(p => {
    if (!searchUser) return true;
    const s = searchUser.toLowerCase();
    return (p.name?.toLowerCase().includes(s)) || p.email.toLowerCase().includes(s);
  });

  if (loading) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center py-20 text-muted-foreground">
          <Loader2 className="w-6 h-6 animate-spin mr-2" /> Carregando permissões...
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="space-y-4">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div className="flex items-center gap-3">
            <Shield className="w-6 h-6 text-primary" />
            <div>
              <h1 className="text-2xl font-bold">Permissões do Sistema</h1>
              <p className="text-sm text-muted-foreground">{features.length} funcionalidades mapeadas · {profiles.length} usuários</p>
            </div>
          </div>
          <Button onClick={handleSave} disabled={saving || dirty.size === 0}>
            {saving ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Save className="w-4 h-4 mr-2" />}
            Salvar ({dirty.size} alteração{dirty.size !== 1 ? 's' : ''})
          </Button>
        </div>

        <div className="p-3 bg-muted rounded-md text-sm text-muted-foreground">
          <strong>ℹ️ Fase 1 — Cadastro de permissões:</strong> Configure quais usuários podem acessar cada funcionalidade.
          O enforcement (bloqueio efetivo no menu e rotas) será ativado na Fase 2 após todas as permissões serem configuradas.
        </div>

        <div className="relative max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Buscar usuário..."
            value={searchUser}
            onChange={e => setSearchUser(e.target.value)}
            className="pl-9"
          />
        </div>

        <Accordion type="multiple" defaultValue={Object.keys(groups)} className="space-y-2">
          {Object.entries(groups).map(([groupName, groupFeatures]) => (
            <AccordionItem key={groupName} value={groupName} className="border rounded-lg overflow-hidden">
              <AccordionTrigger className="px-4 py-3 hover:no-underline bg-card">
                <div className="flex items-center gap-2">
                  <span className="font-semibold">{groupName}</span>
                  <Badge variant="secondary" className="text-xs">{groupFeatures.length}</Badge>
                </div>
              </AccordionTrigger>
              <AccordionContent className="p-0">
                {groupFeatures.map(feature => {
                  const allFilteredSelected = filteredProfiles.length > 0 && filteredProfiles.every(p => feature.allowed_user_ids.includes(p.user_id));
                  return (
                    <div key={feature.id} className="border-t">
                      <div className="px-4 py-3 bg-muted/30">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <span className="font-medium text-sm">{feature.feature_label}</span>
                            <Badge variant="outline" className="text-xs">
                              {feature.allowed_user_ids.length} usuário(s)
                            </Badge>
                            {dirty.has(feature.id) && <Badge variant="destructive" className="text-xs">alterado</Badge>}
                          </div>
                          <div className="flex items-center gap-2">
                            <Button
                              variant="ghost"
                              size="sm"
                              className="text-xs h-7"
                              onClick={() => toggleAllUsersForFeature(feature.id, filteredProfiles.map(p => p.user_id), !allFilteredSelected)}
                            >
                              {allFilteredSelected ? 'Desmarcar todos' : 'Marcar todos'}
                            </Button>
                          </div>
                        </div>
                      </div>
                      <div className="px-4 py-2 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-1">
                        {filteredProfiles.map(profile => (
                          <label
                            key={profile.user_id}
                            className="flex items-center gap-2 p-1.5 rounded hover:bg-muted/50 cursor-pointer text-sm"
                          >
                            <Checkbox
                              checked={feature.allowed_user_ids.includes(profile.user_id)}
                              onCheckedChange={() => toggleUser(feature.id, profile.user_id)}
                            />
                            <span className="truncate">{profile.name || profile.email}</span>
                            <Badge variant={getRoleBadgeVariant(profile.role)} className="text-[10px] px-1 py-0 shrink-0">
                              {getRoleLabel(profile.role)}
                            </Badge>
                          </label>
                        ))}
                        {filteredProfiles.length === 0 && (
                          <p className="text-xs text-muted-foreground col-span-full py-2">Nenhum usuário encontrado</p>
                        )}
                      </div>
                    </div>
                  );
                })}
              </AccordionContent>
            </AccordionItem>
          ))}
        </Accordion>
      </div>
    </DashboardLayout>
  );
}
