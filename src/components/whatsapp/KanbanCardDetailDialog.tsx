import { useEffect, useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { MessageSquare, StickyNote, Phone, Tag, Trash2, Clock, Send, ArrowRightLeft } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import type { KanbanCard, KanbanColumn } from '@/hooks/useKanban';

interface Props {
  card: KanbanCard | null;
  columns: KanbanColumn[];
  labels: { label_id: string; name: string; color_hex: string | null }[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onOpenChat: (chipId: string, remoteJid: string) => void;
  onRemoveCard: (cardId: string) => void;
  onMoveCard: (cardId: string, columnId: string) => void;
}

interface Note {
  id: string;
  content: string;
  created_at: string;
}

function timeInColumn(updatedAt: string | null): string {
  if (!updatedAt) return '';
  const diff = Date.now() - new Date(updatedAt).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 60) return `${mins}min`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h`;
  const days = Math.floor(hrs / 24);
  return `${days}d`;
}

export default function KanbanCardDetailDialog({ card, columns, labels, open, onOpenChange, onOpenChat, onRemoveCard, onMoveCard }: Props) {
  const { user } = useAuth();
  const [notes, setNotes] = useState<Note[]>([]);
  const [newNote, setNewNote] = useState('');
  const [savingNote, setSavingNote] = useState(false);

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

  useEffect(() => {
    if (!open) setNewNote('');
  }, [open]);

  if (!card || !conv) return null;

  const name = conv.contact_name || conv.wa_name || conv.contact_phone || conv.remote_jid.split('@')[0];
  const phone = conv.contact_phone || conv.remote_jid.split('@')[0];
  const initials = name.slice(0, 2).toUpperCase();
  const col = columns.find(c => c.id === card.column_id);
  const colColor = col?.color_hex || '#6b7280';
  const cardLabels = (conv.label_ids || []).map(lid => labels.find(l => l.label_id === lid)).filter(Boolean);

  const handleSaveNote = async () => {
    if (!newNote.trim() || !user) return;
    setSavingNote(true);
    const { data } = await supabase
      .from('conversation_notes')
      .insert({ chip_id: conv.chip_id, remote_jid: conv.remote_jid, user_id: user.id, content: newNote.trim() })
      .select('id, content, created_at')
      .single();
    if (data) setNotes(prev => [data, ...prev]);
    setNewNote('');
    setSavingNote(false);
  };

  const handleRemove = () => {
    onRemoveCard(card.id);
    onOpenChange(false);
  };

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

        <ScrollArea className="max-h-[60vh]">
          <div className="px-5 pb-4 space-y-4">
            {/* Status + Move column */}
            <div className="space-y-2">
              <p className="text-xs text-muted-foreground flex items-center gap-1.5 font-medium uppercase tracking-wider">
                <ArrowRightLeft className="w-3 h-3" />Coluna
              </p>
              <div className="flex items-center gap-2">
                <Select value={card.column_id} onValueChange={(colId) => onMoveCard(card.id, colId)}>
                  <SelectTrigger className="flex-1 h-9 text-sm">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {columns.map(c => (
                      <SelectItem key={c.id} value={c.id}>
                        <span className="flex items-center gap-2">
                          <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: c.color_hex || '#6b7280' }} />
                          {c.name}
                        </span>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {card.updated_at && (
                  <span className="text-[11px] text-muted-foreground flex items-center gap-1 shrink-0 bg-secondary/50 px-2 py-1 rounded-md">
                    <Clock className="w-3 h-3" />há {timeInColumn(card.updated_at)}
                  </span>
                )}
              </div>
            </div>

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

            {/* Quick note input */}
            <div className="space-y-2">
              <p className="text-xs text-muted-foreground flex items-center gap-1.5 font-medium uppercase tracking-wider">
                <StickyNote className="w-3 h-3" />Notas ({notes.length})
              </p>
              <div className="flex gap-2">
                <Textarea
                  value={newNote}
                  onChange={(e) => setNewNote(e.target.value)}
                  placeholder="Adicionar nota rápida..."
                  className="min-h-[60px] text-sm resize-none"
                  onKeyDown={(e) => { if (e.key === 'Enter' && e.ctrlKey) handleSaveNote(); }}
                />
                <Button
                  variant="outline"
                  size="icon"
                  className="shrink-0 self-end h-9 w-9"
                  disabled={!newNote.trim() || savingNote}
                  onClick={handleSaveNote}
                >
                  <Send className="w-4 h-4" />
                </Button>
              </div>
              {notes.length > 0 && (
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
              )}
            </div>
          </div>
        </ScrollArea>

        <DialogFooter className="px-5 py-3 border-t border-border/30 bg-secondary/20">
          <Button variant="destructive" size="sm" onClick={handleRemove} className="mr-auto">
            <Trash2 className="w-4 h-4 mr-1.5" />Remover
          </Button>
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
