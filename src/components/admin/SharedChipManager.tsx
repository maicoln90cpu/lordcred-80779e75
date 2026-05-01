import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Checkbox } from '@/components/ui/checkbox';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { Loader2, Users, Smartphone, Share2, Shield, Save, Lock, RotateCw } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

interface ChipRow {
  id: string;
  instance_name: string;
  nickname: string | null;
  phone_number: string | null;
  provider: string;
  is_shared: boolean;
  shared_user_ids: string[];
  shared_block_send: boolean;
  round_robin_enabled: boolean;
  round_robin_timeout_minutes: number;
  status: string;
  user_id: string;
}

interface Profile {
  user_id: string;
  email: string;
  name: string | null;
}

export default function SharedChipManager() {
  const { toast } = useToast();
  const [chips, setChips] = useState<ChipRow[]>([]);
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<string | null>(null);
  const [expandedChip, setExpandedChip] = useState<string | null>(null);
  const [localSharedIds, setLocalSharedIds] = useState<Record<string, string[]>>({});
  const [vendorSearch, setVendorSearch] = useState<Record<string, string>>({});

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    const [chipsRes, profilesRes, blockedRes] = await Promise.all([
      supabase
        .from('chips')
        .select('id, instance_name, nickname, phone_number, provider, is_shared, shared_user_ids, shared_block_send, round_robin_enabled, round_robin_timeout_minutes, status, user_id')
        .order('instance_name'),
      // RPC oculta automaticamente users com role 'master'
      supabase.rpc('get_visible_profiles'),
      supabase.from('profiles').select('user_id, is_blocked'),
    ]);

    const chipsData = (chipsRes.data || []) as unknown as ChipRow[];
    setChips(chipsData);
    const blockedSet = new Set((blockedRes.data || []).filter((p: any) => p.is_blocked).map((p: any) => p.user_id));
    const filteredProfiles = ((profilesRes.data as any[]) || [])
      .filter(p => !blockedSet.has(p.user_id))
      .map(p => ({ user_id: p.user_id, email: p.email, name: p.name }));
    setProfiles(filteredProfiles);

    // Init local state
    const ids: Record<string, string[]> = {};
    chipsData.forEach(c => {
      ids[c.id] = c.shared_user_ids || [];
    });
    setLocalSharedIds(ids);
    setLoading(false);
  };

  const toggleShared = async (chip: ChipRow) => {
    const newVal = !chip.is_shared;
    await supabase
      .from('chips')
      .update({ is_shared: newVal } as any)
      .eq('id', chip.id);

    setChips(prev => prev.map(c =>
      c.id === chip.id ? { ...c, is_shared: newVal } : c
    ));

    toast({
      title: newVal ? 'Chip marcado como compartilhado' : 'Chip não é mais compartilhado',
    });
  };

  const toggleUser = (chipId: string, userId: string) => {
    setLocalSharedIds(prev => {
      const current = prev[chipId] || [];
      const next = current.includes(userId)
        ? current.filter(id => id !== userId)
        : [...current, userId];
      return { ...prev, [chipId]: next };
    });
  };

  const saveSharedUsers = async (chipId: string) => {
    setSaving(chipId);
    const ids = localSharedIds[chipId] || [];
    await supabase
      .from('chips')
      .update({ shared_user_ids: ids } as any)
      .eq('id', chipId);

    setChips(prev => prev.map(c =>
      c.id === chipId ? { ...c, shared_user_ids: ids } : c
    ));

    toast({ title: `${ids.length} usuário(s) salvos para o chip compartilhado` });
    setSaving(null);
  };

  const toggleBlockSend = async (chip: ChipRow) => {
    const newVal = !chip.shared_block_send;
    await supabase
      .from('chips')
      .update({ shared_block_send: newVal } as any)
      .eq('id', chip.id);
    setChips(prev => prev.map(c =>
      c.id === chip.id ? { ...c, shared_block_send: newVal } : c
    ));
    toast({ title: newVal ? 'Bloqueio de envio ativado' : 'Bloqueio de envio desativado' });
  };

  if (loading) {
    return (
      <div className="flex justify-center py-12">
        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const sharedChips = chips.filter(c => c.is_shared);
  const availableChips = chips.filter(c => !c.is_shared);

  const renderChipList = (chipList: ChipRow[], type: 'shared' | 'available') => {
    if (type === 'shared' && chipList.length === 0) {
      return <p className="text-sm text-muted-foreground text-center py-4">Nenhum chip compartilhado deste tipo</p>;
    }
    if (type === 'available' && chipList.length === 0) {
      return <p className="text-sm text-muted-foreground text-center py-4">Nenhum chip disponível deste tipo</p>;
    }
    if (type === 'available') {
      return (
        <div className="grid gap-2">
          {chipList.map(chip => {
            const ownerProfile = profiles.find(p => p.user_id === chip.user_id);
            return (
              <Card key={chip.id} className="border-border/50">
                <CardContent className="py-3 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <Smartphone className="w-4 h-4 text-muted-foreground" />
                    <div>
                      <p className="text-sm font-medium">{chip.nickname || chip.phone_number || chip.instance_name}</p>
                      <p className="text-xs text-muted-foreground">
                        {ownerProfile?.name || ownerProfile?.email || '—'}
                        {chip.provider === 'meta' && <Badge variant="outline" className="ml-2 text-[10px] py-0">META</Badge>}
                      </p>
                    </div>
                  </div>
                  <Button variant="outline" size="sm" onClick={() => toggleShared(chip)}>
                    <Share2 className="w-3.5 h-3.5 mr-1.5" /> Compartilhar
                  </Button>
                </CardContent>
              </Card>
            );
          })}
        </div>
      );
    }
    // shared list
    return chipList.map(chip => {
      const isExpanded = expandedChip === chip.id;
      const userIds = localSharedIds[chip.id] || [];
      const ownerProfile = profiles.find(p => p.user_id === chip.user_id);
      return (
        <Card key={chip.id} className="border-primary/20">
          <CardContent className="pt-4 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-primary/10">
                  <Smartphone className="w-4 h-4 text-primary" />
                </div>
                <div>
                  <p className="font-medium text-sm">{chip.nickname || chip.phone_number || chip.instance_name}</p>
                  <p className="text-xs text-muted-foreground">
                    Dono: {ownerProfile?.name || ownerProfile?.email || 'Desconhecido'}
                    {chip.provider === 'meta' && <Badge variant="outline" className="ml-2 text-[10px] py-0">META</Badge>}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Badge variant={chip.status === 'connected' ? 'default' : 'destructive'} className="text-[10px]">
                  {chip.status === 'connected' ? 'Online' : 'Offline'}
                </Badge>
                <Badge variant="outline" className="text-[10px]">
                  <Users className="w-3 h-3 mr-1" /> {userIds.length} usuário(s)
                </Badge>
                <Switch checked={chip.is_shared} onCheckedChange={() => toggleShared(chip)} />
              </div>
            </div>
            {/* Block send toggle */}
            <div className="flex items-center gap-2 px-1">
              <Lock className="w-3.5 h-3.5 text-muted-foreground" />
              <span className="text-xs text-muted-foreground flex-1">Bloquear envio se outro operador já assumiu</span>
              <Switch checked={chip.shared_block_send} onCheckedChange={() => toggleBlockSend(chip)} />
            </div>
            {/* Round-robin toggle */}
            <div className="flex items-center gap-2 px-1">
              <RotateCw className="w-3.5 h-3.5 text-muted-foreground" />
              <span className="text-xs text-muted-foreground flex-1">Round-Robin automático (distribuição entre vendedores)</span>
              <Switch checked={chip.round_robin_enabled} onCheckedChange={async () => {
                const newVal = !chip.round_robin_enabled;
                await supabase.from('chips').update({ round_robin_enabled: newVal } as any).eq('id', chip.id);
                setChips(prev => prev.map(c => c.id === chip.id ? { ...c, round_robin_enabled: newVal } : c));
                toast({ title: newVal ? 'Round-Robin ativado' : 'Round-Robin desativado' });
              }} />
            </div>
            {chip.round_robin_enabled && (
              <div className="flex items-center gap-2 px-1">
                <Label className="text-xs text-muted-foreground whitespace-nowrap">Timeout reatribuição:</Label>
                <Input
                  type="number"
                  min={1}
                  max={120}
                  className="h-7 w-20 text-xs"
                  value={chip.round_robin_timeout_minutes}
                  onChange={async (e) => {
                    const val = Math.max(1, Math.min(120, parseInt(e.target.value) || 10));
                    await supabase.from('chips').update({ round_robin_timeout_minutes: val } as any).eq('id', chip.id);
                    setChips(prev => prev.map(c => c.id === chip.id ? { ...c, round_robin_timeout_minutes: val } : c));
                  }}
                />
                <span className="text-xs text-muted-foreground">min</span>
              </div>
            )}
            <Button
              variant={isExpanded ? 'ghost' : 'outline'}
              size="sm"
              className="w-full text-xs"
              onClick={() => setExpandedChip(isExpanded ? null : chip.id)}
            >
              <Users className="w-3.5 h-3.5 mr-1.5" />
              {isExpanded ? 'Recolher' : `Gerenciar usuários autorizados (${userIds.length} selecionados)`}
            </Button>
            {isExpanded && (
              <div className="space-y-2 border-t pt-3">
                <div className="flex items-center gap-2 mb-1">
                  <Shield className="w-4 h-4 text-muted-foreground" />
                  <span className="text-xs font-medium text-muted-foreground">Selecione quem pode atender por este número:</span>
                </div>
                <Input
                  placeholder="🔍 Buscar vendedor por nome ou email..."
                  value={vendorSearch[chip.id] || ''}
                  onChange={e => setVendorSearch(prev => ({ ...prev, [chip.id]: e.target.value }))}
                  className="h-9 text-sm sticky top-0 z-10 bg-background"
                  autoFocus
                />
                <ScrollArea className="h-[200px]">
                  <div className="space-y-1">
                    {profiles
                      .filter(p => {
                        const q = (vendorSearch[chip.id] || '').toLowerCase();
                        if (!q) return true;
                        return (p.name || '').toLowerCase().includes(q) || p.email.toLowerCase().includes(q);
                      })
                      .map(p => (
                      <label key={p.user_id} className="flex items-center gap-3 p-2 rounded-lg hover:bg-muted/50 cursor-pointer">
                        <Checkbox checked={userIds.includes(p.user_id)} onCheckedChange={() => toggleUser(chip.id, p.user_id)} />
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-medium truncate">{p.name || p.email}</p>
                          {p.name && <p className="text-xs text-muted-foreground truncate">{p.email}</p>}
                        </div>
                      </label>
                    ))}
                  </div>
                </ScrollArea>
                <Button size="sm" className="w-full" onClick={() => saveSharedUsers(chip.id)} disabled={saving === chip.id}>
                  {saving === chip.id ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Save className="w-4 h-4 mr-2" />}
                  Salvar ({userIds.length} selecionados)
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      );
    });
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <Share2 className="w-5 h-5 text-primary" />
            Fila de Atendimento Compartilhada
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            Marque chips como "compartilhados" para que múltiplos vendedores possam atender pelo mesmo número.
            Cada mensagem enviada registra quem a enviou para auditoria completa.
          </p>
        </CardContent>
      </Card>

      {/* Tabs by provider */}
      <Tabs defaultValue="all" className="space-y-4">
        <TabsList>
          <TabsTrigger value="all">Todos ({chips.length})</TabsTrigger>
          <TabsTrigger value="uazapi">UazAPI ({chips.filter(c => c.provider === 'uazapi').length})</TabsTrigger>
          <TabsTrigger value="meta">Meta Oficial ({chips.filter(c => c.provider === 'meta').length})</TabsTrigger>
        </TabsList>

        {['all', 'uazapi', 'meta'].map(tab => (
          <TabsContent key={tab} value={tab} className="space-y-6">
            {/* Shared */}
            {sharedChips.filter(c => tab === 'all' || c.provider === tab).length > 0 && (
              <div className="space-y-3">
                <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">
                  Compartilhados Ativos ({sharedChips.filter(c => tab === 'all' || c.provider === tab).length})
                </h3>
                {renderChipList(sharedChips.filter(c => tab === 'all' || c.provider === tab), 'shared')}
              </div>
            )}
            {/* Available */}
            <div className="space-y-3">
              <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">
                Disponíveis para Compartilhar
              </h3>
              {renderChipList(availableChips.filter(c => tab === 'all' || c.provider === tab), 'available')}
            </div>
          </TabsContent>
        ))}
      </Tabs>
    </div>
  );
}
