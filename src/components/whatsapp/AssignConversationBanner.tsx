import { useState, useEffect } from 'react';
import { UserCheck, Users } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';

interface AssignConversationBannerProps {
  chipId: string;
  conversationId: string;
  remoteJid: string;
}

export default function AssignConversationBanner({ chipId, conversationId, remoteJid }: AssignConversationBannerProps) {
  const { user } = useAuth();
  const { toast } = useToast();
  const [isShared, setIsShared] = useState(false);
  const [assignedUserId, setAssignedUserId] = useState<string | null>(null);
  const [assignedName, setAssignedName] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!chipId) return;
    const checkShared = async () => {
      const { data: chip } = await supabase
        .from('chips')
        .select('is_shared')
        .eq('id', chipId)
        .single();
      setIsShared(chip?.is_shared || false);
    };
    checkShared();
  }, [chipId]);

  useEffect(() => {
    if (!conversationId || !isShared) return;
    const fetchAssignment = async () => {
      const { data: conv } = await supabase
        .from('conversations')
        .select('assigned_user_id')
        .eq('id', conversationId)
        .single();
      const uid = conv?.assigned_user_id || null;
      setAssignedUserId(uid);
      if (uid) {
        const { data: profile } = await supabase
          .from('profiles')
          .select('full_name')
          .eq('user_id', uid)
          .single();
        setAssignedName(profile?.full_name || 'Usuário');
      } else {
        setAssignedName(null);
      }
    };
    fetchAssignment();
  }, [conversationId, isShared]);

  const handleAssign = async () => {
    if (!user || !conversationId) return;
    setLoading(true);
    try {
      await supabase
        .from('conversations')
        .update({ assigned_user_id: user.id })
        .eq('id', conversationId);

      // Log audit
      await supabase.from('conversation_audit_log').insert({
        conversation_id: conversationId,
        user_id: user.id,
        action: 'assign',
        message_preview: `Assumiu o atendimento`,
        details: { chip_id: chipId, remote_jid: remoteJid },
      });

      setAssignedUserId(user.id);
      setAssignedName('Você');
      toast({ title: 'Atendimento assumido com sucesso' });
    } catch {
      toast({ title: 'Erro ao assumir atendimento', variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  const handleRelease = async () => {
    if (!user || !conversationId) return;
    setLoading(true);
    try {
      await supabase
        .from('conversations')
        .update({ assigned_user_id: null })
        .eq('id', conversationId);

      await supabase.from('conversation_audit_log').insert({
        conversation_id: conversationId,
        user_id: user.id,
        action: 'release',
        message_preview: `Liberou o atendimento`,
        details: { chip_id: chipId, remote_jid: remoteJid },
      });

      setAssignedUserId(null);
      setAssignedName(null);
      toast({ title: 'Atendimento liberado' });
    } catch {
      toast({ title: 'Erro ao liberar atendimento', variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  if (!isShared) return null;

  const isAssignedToMe = assignedUserId === user?.id;
  const isAssignedToOther = assignedUserId && !isAssignedToMe;

  return (
    <div className="flex items-center gap-2 px-4 py-2 border-b border-border/30 bg-accent/10">
      <Users className="w-4 h-4 text-muted-foreground shrink-0" />
      <span className="text-xs text-muted-foreground">Chip compartilhado</span>
      {assignedUserId ? (
        <>
          <Badge variant="outline" className="text-xs gap-1">
            <UserCheck className="w-3 h-3" />
            {isAssignedToMe ? 'Você' : assignedName}
          </Badge>
          {isAssignedToMe && (
            <Button size="sm" variant="ghost" className="h-6 text-xs ml-auto" onClick={handleRelease} disabled={loading}>
              Liberar
            </Button>
          )}
          {isAssignedToOther && (
            <Button size="sm" variant="outline" className="h-6 text-xs ml-auto" onClick={handleAssign} disabled={loading}>
              Assumir mesmo assim
            </Button>
          )}
        </>
      ) : (
        <Button size="sm" variant="default" className="h-6 text-xs ml-auto gap-1" onClick={handleAssign} disabled={loading}>
          <UserCheck className="w-3 h-3" />
          Assumir Atendimento
        </Button>
      )}
    </div>
  );
}
