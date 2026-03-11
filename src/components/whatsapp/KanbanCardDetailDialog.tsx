import { useEffect, useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';
import { ScrollArea } from '@/components/ui/scroll-area';
import { MessageSquare, StickyNote, Phone, Tag } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import type { KanbanCard, KanbanColumn } from '@/hooks/useKanban';

interface Props {
  card: KanbanCard | null;
  columns: KanbanColumn[];
  labels: { label_id: string; name: string; color_hex: string | null }[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onOpenChat: (chipId: string, remoteJid: string) => void;
}

interface Note {
  id: string;
  content: string;
  created_at: string;
}

export default function KanbanCardDetailDialog({ card, columns, labels, open, onOpenChange, onOpenChat }: Props) {
  const [notes, setNotes] = useState<Note[]>([]);

  const conv = card?.conversation;

  useEffect(() => {
    if (!conv || !open) return;
    supabase
      .from('conversation_notes')
      .select('id, content, created_at')
      .eq('chip_id', conv.chip_id)
      .eq('remote_jid', conv.remote_jid)
      .order('created_at', { ascending: false })
      .limit(20)
      .then(({ data }) => setNotes(data || []));
  }, [conv, open]);

  if (!card || !conv) return null;

  const name = conv.contact_name || conv.wa_name || conv.contact_phone || conv.remote_jid.split('@')[0];
  const phone = conv.contact_phone || conv.remote_jid.split('@')[0];
  const initials = name.slice(0, 2).toUpperCase();
  const col = columns.find(c => c.id === card.column_id);
  const cardLabels = (conv.label_ids || []).map(lid => labels.find(l => l.label_id === lid)).filter(Boolean);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-3">
            <Avatar className="h-10 w-10">
              {conv.profile_pic_url && <AvatarImage src={conv.profile_pic_url} />}
              <AvatarFallback className="bg-muted">{initials}</AvatarFallback>
            </Avatar>
            <div className="min-w-0">
              <p className="text-base font-semibold truncate">{name}</p>
              <p className="text-xs text-muted-foreground flex items-center gap-1"><Phone className="w-3 h-3" />{phone}</p>
            </div>
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* Status */}
          {col && (
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-full" style={{ backgroundColor: col.color_hex || '#6b7280' }} />
              <span className="text-sm font-medium">{col.name}</span>
            </div>
          )}

          {/* Labels */}
          {cardLabels.length > 0 && (
            <div className="space-y-1">
              <p className="text-xs text-muted-foreground flex items-center gap-1"><Tag className="w-3 h-3" />Etiquetas</p>
              <div className="flex flex-wrap gap-1">
                {cardLabels.map((l: any) => (
                  <span key={l.label_id} className="text-xs px-2 py-0.5 rounded-full" style={{ backgroundColor: `${l.color_hex || '#6b7280'}20`, color: l.color_hex || '#6b7280' }}>
                    {l.name}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Last message */}
          {conv.last_message_text && (
            <div className="space-y-1">
              <p className="text-xs text-muted-foreground flex items-center gap-1"><MessageSquare className="w-3 h-3" />Última mensagem</p>
              <p className="text-sm bg-muted/50 rounded-lg p-2">{conv.last_message_text}</p>
              {conv.last_message_at && <p className="text-[10px] text-muted-foreground">{new Date(conv.last_message_at).toLocaleString('pt-BR')}</p>}
            </div>
          )}

          {/* Notes */}
          {notes.length > 0 && (
            <div className="space-y-1">
              <p className="text-xs text-muted-foreground flex items-center gap-1"><StickyNote className="w-3 h-3" />Notas ({notes.length})</p>
              <ScrollArea className="max-h-32">
                <div className="space-y-1">
                  {notes.map(n => (
                    <div key={n.id} className="text-xs bg-muted/50 rounded p-2">
                      <p>{n.content}</p>
                      <p className="text-[10px] text-muted-foreground mt-1">{new Date(n.created_at!).toLocaleString('pt-BR')}</p>
                    </div>
                  ))}
                </div>
              </ScrollArea>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Fechar</Button>
          <Button onClick={() => { onOpenChat(conv.chip_id, conv.remote_jid); onOpenChange(false); }}>
            <MessageSquare className="w-4 h-4 mr-1.5" />Abrir conversa
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
