import { memo, DragEvent } from 'react';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';
import { StickyNote, Clock } from 'lucide-react';
import type { KanbanCard as KanbanCardType } from '@/hooks/useKanban';

interface Props {
  card: KanbanCardType;
  labels: { label_id: string; name: string; color_hex: string | null }[];
  columnColor?: string;
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

function isInactive(lastMessageAt: string | null): boolean {
  if (!lastMessageAt) return true;
  const diff = Date.now() - new Date(lastMessageAt).getTime();
  return diff > 3 * 24 * 60 * 60 * 1000; // 3 days
}

export default memo(function KanbanCard({ card, labels, columnColor, onClick }: Props) {
  const conv = card.conversation;
  if (!conv) return null;

  const name = conv.contact_name || conv.wa_name || conv.contact_phone || conv.remote_jid.split('@')[0];
  const phone = conv.contact_phone || conv.remote_jid.split('@')[0];
  const initials = name.slice(0, 2).toUpperCase();
  const accentColor = columnColor || '#6b7280';
  const inactive = isInactive(conv.last_message_at);

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
      className={`group relative bg-card border border-border/40 rounded-lg p-3 cursor-grab active:cursor-grabbing hover:shadow-lg hover:shadow-black/5 hover:border-border/60 transition-all duration-200 space-y-2.5 overflow-hidden ${inactive ? 'opacity-60' : ''}`}
    >
      {/* Left accent stripe */}
      <div
        className="absolute left-0 top-2 bottom-2 w-[3px] rounded-r-full transition-all group-hover:top-1 group-hover:bottom-1"
        style={{ backgroundColor: accentColor }}
      />

      <div className="flex items-center gap-2.5 pl-2">
        <Avatar className="h-9 w-9 shrink-0 ring-2 ring-offset-1 ring-offset-card" style={{ ['--tw-ring-color' as any]: `${accentColor}30` }}>
          {conv.profile_pic_url && <AvatarImage src={conv.profile_pic_url} />}
          <AvatarFallback className="text-xs font-semibold" style={{ backgroundColor: `${accentColor}15`, color: accentColor }}>
            {initials}
          </AvatarFallback>
        </Avatar>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold truncate text-foreground leading-tight">{name}</p>
          <p className="text-[11px] text-muted-foreground truncate mt-0.5">{formatPhone(phone)}</p>
        </div>
        <div className="flex flex-col items-end gap-0.5 shrink-0">
          {conv.last_message_at && (
            <span className="text-[10px] text-muted-foreground/70 font-medium">{timeAgo(conv.last_message_at)}</span>
          )}
          {inactive && (
            <span className="flex items-center gap-0.5 text-[9px] text-amber-500 font-medium">
              <Clock className="w-2.5 h-2.5" />inativo
            </span>
          )}
        </div>
      </div>

      {conv.last_message_text && (
        <p className="text-xs text-muted-foreground line-clamp-2 pl-2 leading-relaxed">{conv.last_message_text}</p>
      )}

      <div className="flex items-center gap-1.5 flex-wrap pl-2">
        {cardLabels.map((l: any) => (
          <span
            key={l.label_id}
            className="text-[10px] font-medium px-1.5 py-0.5 rounded-md"
            style={{ backgroundColor: `${l.color_hex || '#6b7280'}15`, color: l.color_hex || '#6b7280' }}
          >
            {l.name}
          </span>
        ))}
        {card.notesCount && card.notesCount > 0 && (
          <span className="flex items-center gap-0.5 text-[10px] text-muted-foreground/70">
            <StickyNote className="w-3 h-3" />{card.notesCount}
          </span>
        )}
        {(conv.unread_count || 0) > 0 && (
          <span
            className="ml-auto text-[10px] font-bold h-5 min-w-[20px] px-1.5 rounded-full flex items-center justify-center text-white"
            style={{ backgroundColor: '#25D366' }}
          >
            {conv.unread_count}
          </span>
        )}
      </div>
    </div>
  );
});
