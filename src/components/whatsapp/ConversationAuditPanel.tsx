import { useState, useEffect } from 'react';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { supabase } from '@/integrations/supabase/client';
import { UserCheck, LogOut, Send, Clock } from 'lucide-react';

interface AuditEntry {
  id: string;
  action: string;
  message_preview: string | null;
  created_at: string;
  user_id: string;
  user_name?: string;
}

interface ConversationAuditPanelProps {
  conversationId: string;
  open: boolean;
  onClose: () => void;
}

const actionConfig: Record<string, { label: string; icon: typeof UserCheck; color: string }> = {
  assign: { label: 'Assumiu', icon: UserCheck, color: 'text-green-400' },
  release: { label: 'Liberou', icon: LogOut, color: 'text-orange-400' },
  send_message: { label: 'Enviou', icon: Send, color: 'text-blue-400' },
};

export default function ConversationAuditPanel({ conversationId, open, onClose }: ConversationAuditPanelProps) {
  const [entries, setEntries] = useState<AuditEntry[]>([]);

  useEffect(() => {
    if (!open || !conversationId) return;
    const fetch = async () => {
      const { data } = await supabase
        .from('conversation_audit_log')
        .select('*')
        .eq('conversation_id', conversationId)
        .order('created_at', { ascending: false })
        .limit(50);

      if (!data || data.length === 0) { setEntries([]); return; }

      // Fetch user names
      const userIds = [...new Set(data.map(d => d.user_id))];
      const { data: profiles } = await supabase
        .from('profiles')
        .select('user_id, name')
        .in('user_id', userIds);

      const nameMap: Record<string, string> = {};
      profiles?.forEach(p => { nameMap[p.user_id] = p.name || 'Usuário'; });

      setEntries(data.map(d => ({ ...d, user_name: nameMap[d.user_id] || 'Usuário' })));
    };
    fetch();
  }, [open, conversationId]);

  if (!open) return null;

  return (
    <div className="w-72 border-l border-border/30 bg-card/50 flex flex-col">
      <div className="flex items-center justify-between px-3 py-2 border-b border-border/30">
        <h3 className="text-sm font-semibold">Auditoria</h3>
        <button onClick={onClose} className="text-xs text-muted-foreground hover:text-foreground">Fechar</button>
      </div>
      <ScrollArea className="flex-1">
        <div className="p-3 space-y-2">
          {entries.length === 0 && (
            <p className="text-xs text-muted-foreground text-center py-4">Nenhum registro</p>
          )}
          {entries.map(entry => {
            const config = actionConfig[entry.action] || { label: entry.action, icon: Clock, color: 'text-muted-foreground' };
            const Icon = config.icon;
            return (
              <div key={entry.id} className="flex items-start gap-2 text-xs">
                <Icon className={`w-3.5 h-3.5 mt-0.5 shrink-0 ${config.color}`} />
                <div className="min-w-0">
                  <p className="font-medium">{entry.user_name} <span className="text-muted-foreground font-normal">{config.label}</span></p>
                  {entry.message_preview && (
                    <p className="text-muted-foreground truncate">{entry.message_preview}</p>
                  )}
                  <p className="text-muted-foreground/60">
                    {new Date(entry.created_at).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}
                  </p>
                </div>
              </div>
            );
          })}
        </div>
      </ScrollArea>
    </div>
  );
}
