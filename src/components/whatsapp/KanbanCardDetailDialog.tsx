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
  const colColor = col?.color_hex || '#6b7280';
  const cardLabels = (conv.label_ids || []).map(lid => labels.find(l => l.label_id === lid)).filter(Boolean);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md p-0 overflow-hidden">
        {/* Colored top accent */}
        <div className="h-1.5" style={{ background: `linear-gradient(90deg, ${colColor}, ${colColor}80)` }} />

        <div className="px-5 pt-4 pb-2">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-3.5">
              <Avatar className="h-12 w-12 ring-2 ring-offset-2 ring-offset-background" style={{ ['--tw-ring-color' as any]: `${colColor}40` }}>
                {conv.profile_pic_url && <AvatarImage src={conv.profile_pic_url} />}
                <AvatarFallback className="text-sm font-bold" style={{ backgroundColor: `${colColor}15`, color: colColor }}>
                  {initials}
                </AvatarFallback>
              </Avatar>
              <div className="min-w-0">
                <p className="text-base font-bold truncate">{name}</p>
                <p className="text-xs text-muted-foreground flex items-center gap-1.5 mt-0.5">
                  <Phone className="w-3 h-3" />{phone}
                </p>
              </div>
            </DialogTitle>
          </DialogHeader>
        </div>

        <div className="px-5 pb-4 space-y-4">
          {/* Status */}
          {col && (
            <div className="flex items-center gap-2.5 px-3 py-2 rounded-lg" style={{ backgroundColor: `${colColor}10` }}>
              <div className="w-3 h-3 rounded-full" style={{ backgroundColor: colColor, boxShadow: `0 0 6px ${colColor}50` }} />
              <span className="text-sm font-semibold" style={{ color: colColor }}>{col.name}</span>
            </div>
          )}

          {/* Labels */}
          {cardLabels.length > 0 && (
            <div className="space-y-2">
              <p className="text-xs text-muted-foreground flex items-center gap-1.5 font-medium uppercase tracking-wider">
                <Tag className="w-3 h-3" />Etiquetas
              </p>
              <div className="flex flex-wrap gap-1.5">
                {cardLabels.map((l: any) => (
                  <span key={l.label_id} className="text-xs font-medium px-2.5 py-1 rounded-md" style={{ backgroundColor: `${l.color_hex || '#6b7280'}15`, color: l.color_hex || '#6b7280' }}>
                    {l.name}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Last message */}
          {conv.last_message_text && (
            <div className="space-y-2">
              <p className="text-xs text-muted-foreground flex items-center gap-1.5 font-medium uppercase tracking-wider">
                <MessageSquare className="w-3 h-3" />Última mensagem
              </p>
              <div className="bg-secondary/50 rounded-lg p-3 border border-border/30">
                <p className="text-sm leading-relaxed">{conv.last_message_text}</p>
                {conv.last_message_at && (
                  <p className="text-[10px] text-muted-foreground mt-2">{new Date(conv.last_message_at).toLocaleString('pt-BR')}</p>
                )}
              </div>
            </div>
          )}

          {/* Notes */}
          {notes.length > 0 && (
            <div className="space-y-2">
              <p className="text-xs text-muted-foreground flex items-center gap-1.5 font-medium uppercase tracking-wider">
                <StickyNote className="w-3 h-3" />Notas ({notes.length})
              </p>
              <ScrollArea className="max-h-32">
                <div className="space-y-1.5">
                  {notes.map(n => (
                    <div key={n.id} className="text-xs bg-secondary/40 rounded-lg p-2.5 border border-border/20">
                      <p className="leading-relaxed">{n.content}</p>
                      <p className="text-[10px] text-muted-foreground mt-1.5">{new Date(n.created_at!).toLocaleString('pt-BR')}</p>
                    </div>
                  ))}
                </div>
              </ScrollArea>
            </div>
          )}
        </div>

        <DialogFooter className="px-5 py-3 border-t border-border/30 bg-secondary/20">
          <Button variant="outline" onClick={() => onOpenChange(false)} className="border-border/40">Fechar</Button>
          <Button
            onClick={() => { onOpenChat(conv.chip_id, conv.remote_jid); onOpenChange(false); }}
            className="shadow-md"
          >
            <MessageSquare className="w-4 h-4 mr-1.5" />Abrir conversa
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
