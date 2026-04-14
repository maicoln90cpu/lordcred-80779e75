import { useState } from 'react';
import { Pin, Archive, Star, MoreVertical, Pencil, Tag, BellOff, Ban, Trash2, VolumeX, MessageSquare, Columns3 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger, DropdownMenuSub, DropdownMenuSubTrigger, DropdownMenuSubContent } from '@/components/ui/dropdown-menu';
import LabelBadge from './LabelBadge';
import type { ExtendedChat, LabelItem } from '@/hooks/useConversations';

interface ChatContactItemProps {
  chat: ExtendedChat;
  isSelected: boolean;
  labels: LabelItem[];
  kanbanColumns: { id: string; name: string; color_hex: string | null }[];
  formatTime: (dateStr: string | null) => string;
  onSelect: () => void;
  onPin: () => void;
  onStar: () => void;
  onArchive: (archive: boolean) => void;
  onMarkUnread: () => void;
  onRename: (newName: string) => void;
  onToggleLabel: (labelId: string) => void;
  onMute: (duration: number) => void;
  onBlock: (block: boolean) => void;
  onDelete: () => void;
  onAddToKanban: (columnId: string) => void;
  onRemoveFromKanban: () => void;
  onManageLabels: () => void;
}

export default function ChatContactItem({
  chat, isSelected, labels, kanbanColumns, formatTime,
  onSelect, onPin, onStar, onArchive, onMarkUnread, onRename,
  onToggleLabel, onMute, onBlock, onDelete, onAddToKanban,
  onRemoveFromKanban, onManageLabels,
}: ChatContactItemProps) {
  const [editing, setEditing] = useState(false);
  const [editName, setEditName] = useState(chat.name);

  const getLabelName = (labelId: string) => labels.find(l => l.label_id === labelId);

  return (
    <div className="group relative">
      <button
        onClick={onSelect}
        className={cn(
          "w-full flex items-center gap-3 px-3 py-3 text-left transition-all duration-150",
          isSelected ? "bg-primary/10 border-l-2 border-primary" : "hover:bg-secondary/40 border-l-2 border-transparent",
          chat.unreadCount > 0 && "bg-primary/5"
        )}
      >
        <Avatar className="w-10 h-10 shrink-0 ring-1 ring-border/30">
          {chat.profilePicUrl && <AvatarImage src={chat.profilePicUrl} alt={chat.name} />}
          <AvatarFallback className="bg-gradient-to-br from-primary/20 to-primary/5 text-primary text-sm font-semibold">
            {chat.name.charAt(0).toUpperCase()}
          </AvatarFallback>
        </Avatar>
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1 min-w-0 flex-1 overflow-hidden">
              {chat.is_blocked && <Ban className="w-3 h-3 text-destructive shrink-0" />}
              {chat.is_muted && <VolumeX className="w-3 h-3 text-muted-foreground shrink-0" />}
              {chat.is_pinned && <Pin className="w-3 h-3 text-muted-foreground shrink-0" />}
              {chat.is_starred && <Star className="w-3 h-3 text-yellow-500 shrink-0 fill-yellow-500" />}
              <span className={cn("text-sm truncate", chat.unreadCount > 0 ? "font-bold text-foreground" : "font-medium")}>{chat.name}</span>
            </div>
            <span className="text-xs text-muted-foreground shrink-0 ml-2">{formatTime(chat.lastMessageAt)}</span>
          </div>
          <div className="flex items-center justify-between mt-0.5">
            <span className={cn("text-xs truncate flex-1 min-w-0", chat.unreadCount > 0 ? "text-foreground font-medium" : "text-muted-foreground")}>
              {chat.lastMessage || chat.phone || 'Abrir conversa'}
            </span>
            {chat.unreadCount > 0 && (
              <span className="ml-2 min-w-[20px] h-5 px-1.5 rounded-full text-[11px] font-bold flex items-center justify-center shrink-0" style={{ backgroundColor: '#25D366', color: '#ffffff' }}>
                {chat.unreadCount > 99 ? '99+' : chat.unreadCount}
              </span>
            )}
          </div>
          <div className="flex gap-1 mt-1 overflow-hidden items-center">
            {chat.custom_status && (() => {
              const col = kanbanColumns.find(c => c.name === chat.custom_status);
              if (!col) return null;
              return (
                <span className="inline-flex items-center gap-1 text-[10px] font-medium px-1.5 py-0.5 rounded-full bg-muted/80" style={{ color: col.color_hex || undefined }}>
                  <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ backgroundColor: col.color_hex || '#6b7280' }} />
                  {col.name}
                </span>
              );
            })()}
            {chat.label_ids && chat.label_ids.slice(0, 3).map(lid => {
              const label = getLabelName(lid);
              return label ? <LabelBadge key={lid} name={label.name} colorHex={label.color_hex} /> : null;
            })}
          </div>
        </div>
      </button>

      {/* Context menu */}
      <div className="absolute right-2 top-2 z-10 opacity-50 group-hover:opacity-100 transition-opacity">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" className="h-6 w-6">
              <MoreVertical className="w-3.5 h-3.5" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-48">
            <DropdownMenuItem onClick={onPin}>
              <Pin className="w-4 h-4 mr-2" />{chat.is_pinned ? 'Desafixar' : 'Fixar no topo'}
            </DropdownMenuItem>
            <DropdownMenuItem onClick={onStar}>
              <Star className="w-4 h-4 mr-2" />{chat.is_starred ? 'Remover favorito' : 'Favoritar'}
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => onArchive(!chat.is_archived)}>
              <Archive className="w-4 h-4 mr-2" />{chat.is_archived ? 'Desarquivar' : 'Arquivar'}
            </DropdownMenuItem>
            <DropdownMenuItem onClick={onMarkUnread}>
              <MessageSquare className="w-4 h-4 mr-2" />Marcar como não lida
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => { setEditing(true); setEditName(chat.name); }}>
              <Pencil className="w-4 h-4 mr-2" />Editar nome
            </DropdownMenuItem>

            {kanbanColumns.length > 0 && (
              <DropdownMenuSub>
                <DropdownMenuSubTrigger><Columns3 className="w-4 h-4 mr-2" /> Kanban</DropdownMenuSubTrigger>
                <DropdownMenuSubContent>
                  {kanbanColumns.map(col => (
                    <DropdownMenuItem key={col.id} onClick={() => onAddToKanban(col.id)}>
                      <span className="w-2.5 h-2.5 rounded-full mr-2 shrink-0" style={{ backgroundColor: col.color_hex || '#6b7280' }} />
                      {col.name}
                    </DropdownMenuItem>
                  ))}
                  {chat.custom_status && (
                    <>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem onClick={onRemoveFromKanban} className="text-destructive focus:text-destructive">
                        <Trash2 className="w-4 h-4 mr-2" />Remover do Kanban
                      </DropdownMenuItem>
                    </>
                  )}
                </DropdownMenuSubContent>
              </DropdownMenuSub>
            )}

            <DropdownMenuSeparator />
            <DropdownMenuSub>
              <DropdownMenuSubTrigger><BellOff className="w-4 h-4 mr-2" /> Silenciar</DropdownMenuSubTrigger>
              <DropdownMenuSubContent>
                <DropdownMenuItem onClick={() => onMute(8)}>8 horas</DropdownMenuItem>
                <DropdownMenuItem onClick={() => onMute(168)}>1 semana</DropdownMenuItem>
                <DropdownMenuItem onClick={() => onMute(-1)}>Sempre</DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={() => onMute(0)}>Desmutar</DropdownMenuItem>
              </DropdownMenuSubContent>
            </DropdownMenuSub>
            <DropdownMenuItem onClick={() => onBlock(!chat.is_blocked)}>
              <Ban className="w-4 h-4 mr-2" />{chat.is_blocked ? 'Desbloquear contato' : 'Bloquear contato'}
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            {labels.length > 0 && labels.map(label => {
              const hasLabel = chat.label_ids?.includes(label.label_id);
              return (
                <DropdownMenuItem key={label.label_id} onClick={() => onToggleLabel(label.label_id)}>
                  <LabelBadge name={label.name} colorHex={label.color_hex} className="mr-2" />
                  {hasLabel ? `✓ ${label.name}` : label.name}
                </DropdownMenuItem>
              );
            })}
            <DropdownMenuItem onClick={onManageLabels}>
              <Tag className="w-4 h-4 mr-2" /> Gerenciar Etiquetas
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem className="text-destructive focus:text-destructive" onClick={onDelete}>
              <Trash2 className="w-4 h-4 mr-2" /> Excluir conversa
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {/* Inline rename */}
      {editing && (
        <div className="absolute inset-0 bg-background/95 flex items-center gap-2 px-3 z-10">
          <Input
            value={editName}
            onChange={(e) => setEditName(e.target.value)}
            className="h-8 text-sm flex-1"
            autoFocus
            onKeyDown={(e) => {
              if (e.key === 'Enter') { onRename(editName); setEditing(false); }
              if (e.key === 'Escape') setEditing(false);
            }}
          />
          <Button size="sm" className="h-8" onClick={() => { onRename(editName); setEditing(false); }}>Salvar</Button>
          <Button size="sm" variant="ghost" className="h-8" onClick={() => setEditing(false)}>✕</Button>
        </div>
      )}
    </div>
  );
}
