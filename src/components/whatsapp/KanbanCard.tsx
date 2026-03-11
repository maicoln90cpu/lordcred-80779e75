import { memo, DragEvent } from 'react';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { StickyNote, MessageSquare } from 'lucide-react';
import type { KanbanCard as KanbanCardType } from '@/hooks/useKanban';

interface Props {
  card: KanbanCardType;
  labels: { label_id: string; name: string; color_hex: string | null }[];
  onClick: (card: KanbanCardType) => void;
}

function formatPhone(raw: string): string {
  if (!raw) return '';
  const d = raw.replace(/\D/g, '');
  if (d.length >= 12) {
    return `+${d.slice(0, 2)} ${d.slice(2, 4)} ${d.slice(4, 9)}-${d.slice(9)}`;
  }
  return raw;
}

function timeAgo(dateStr: string | null): string {
  if (!dateStr) return '';
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'agora';
  if (mins < 60) return `${mins}m`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h`;
  const days = Math.floor(hrs / 24);
  return `${days}d`;
}

export default memo(function KanbanCard({ card, labels, onClick }: Props) {
  const conv = card.conversation;
  if (!conv) return null;

  const name = conv.contact_name || conv.wa_name || conv.contact_phone || conv.remote_jid.split('@')[0];
  const phone = conv.contact_phone || conv.remote_jid.split('@')[0];
  const initials = name.slice(0, 2).toUpperCase();

  const cardLabels = (conv.label_ids || [])
    .map(lid => labels.find(l => l.label_id === lid))
    .filter(Boolean);

  const handleDragStart = (e: DragEvent) => {
    e.dataTransfer.setData('text/plain', card.id);
    e.dataTransfer.effectAllowed = 'move';
    (e.currentTarget as HTMLElement).style.opacity = '0.5';
  };

  const handleDragEnd = (e: DragEvent) => {
    (e.currentTarget as HTMLElement).style.opacity = '1';
  };

  return (
    <div
      draggable
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
      onClick={() => onClick(card)}
      className="bg-card border border-border/60 rounded-lg p-3 cursor-grab active:cursor-grabbing hover:shadow-md transition-shadow space-y-2"
    >
      <div className="flex items-center gap-2">
        <Avatar className="h-8 w-8 shrink-0">
          {conv.profile_pic_url && <AvatarImage src={conv.profile_pic_url} />}
          <AvatarFallback className="text-xs bg-muted">{initials}</AvatarFallback>
        </Avatar>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-medium truncate text-foreground">{name}</p>
          <p className="text-xs text-muted-foreground truncate">{formatPhone(phone)}</p>
        </div>
        {conv.last_message_at && (
          <span className="text-[10px] text-muted-foreground shrink-0">{timeAgo(conv.last_message_at)}</span>
        )}
      </div>

      {conv.last_message_text && (
        <p className="text-xs text-muted-foreground line-clamp-2">{conv.last_message_text}</p>
      )}

      <div className="flex items-center gap-1 flex-wrap">
        {cardLabels.map((l: any) => (
          <span key={l.label_id} className="text-[10px] px-1.5 py-0.5 rounded-full" style={{ backgroundColor: `${l.color_hex || '#6b7280'}20`, color: l.color_hex || '#6b7280' }}>
            {l.name}
          </span>
        ))}
        {card.notesCount && card.notesCount > 0 && (
          <span className="flex items-center gap-0.5 text-[10px] text-muted-foreground">
            <StickyNote className="w-3 h-3" />{card.notesCount}
          </span>
        )}
        {(conv.unread_count || 0) > 0 && (
          <Badge variant="default" className="text-[10px] h-4 px-1.5 ml-auto">{conv.unread_count}</Badge>
        )}
      </div>
    </div>
  );
});
