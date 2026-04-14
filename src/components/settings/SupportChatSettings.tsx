import { useEffect, useState } from 'react';
import { Users, Loader2 } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

export default function SupportChatSettings() {
  const { toast } = useToast();
  const [supportUserId, setSupportUserId] = useState<string>('');
  const [settingsId, setSettingsId] = useState<string | null>(null);
  const [allProfiles, setAllProfiles] = useState<{ user_id: string; name: string | null; email: string }[]>([]);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    (async () => {
      const [{ data: settings }, { data: profiles }, { data: masterIds }] = await Promise.all([
        supabase.from('system_settings').select('id,support_chat_user_id').maybeSingle(),
        supabase.rpc('get_all_chat_profiles' as any),
        supabase.rpc('get_master_user_ids'),
      ]);
      if (settings?.id) {
        setSettingsId(settings.id);
        if (settings.support_chat_user_id) setSupportUserId(settings.support_chat_user_id);
      }
      if (profiles) {
        const masterSet = new Set((masterIds as string[]) || []);
        setAllProfiles((profiles as any[]).filter(p => !masterSet.has(p.user_id)));
      }
    })();
  }, []);

  const handleSave = async () => {
    if (!supportUserId) { toast({ title: 'Selecione um usuário', variant: 'destructive' }); return; }
    if (!settingsId) { toast({ title: 'Configuração não encontrada', description: 'Recarregue a página', variant: 'destructive' }); return; }
    setSaving(true);
    const { error } = await supabase.from('system_settings').update({ support_chat_user_id: supportUserId } as any).eq('id', settingsId);
    if (error) toast({ title: 'Erro', description: error.message, variant: 'destructive' });
    else toast({ title: 'Responsável pelo suporte atualizado' });
    setSaving(false);
  };

  return (
    <Card className="border-border/50">
      <CardHeader>
        <CardTitle className="flex items-center gap-2"><Users className="w-5 h-5 text-primary" />Suporte do Chat Interno</CardTitle>
        <CardDescription>Defina o responsável pelo suporte que aparecerá como botão para vendedores</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <Label>Responsável pelo Suporte</Label>
          <Select value={supportUserId} onValueChange={setSupportUserId}>
            <SelectTrigger><SelectValue placeholder="Selecione um usuário" /></SelectTrigger>
            <SelectContent>
              {allProfiles.map(p => (
                <SelectItem key={p.user_id} value={p.user_id}>{p.name || p.email}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <Button onClick={handleSave} disabled={saving || !supportUserId}>
          {saving && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
          Salvar
        </Button>
      </CardContent>
    </Card>
  );
}
