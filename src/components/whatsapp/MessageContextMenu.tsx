import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuTrigger,
} from '@/components/ui/context-menu';
import { Reply, SmilePlus, Forward, Download, Pin, Star, Trash2, Pencil } from 'lucide-react';

export interface MessageData {
  id: string;
  text: string;
  fromMe: boolean;
  messageId?: string;
  mediaType?: string;
  hasMedia?: boolean;
  chipId?: string;
}

interface MessageContextMenuProps {
  children: React.ReactNode;
  message: MessageData;
  onReply?: (message: MessageData) => void;
  onReact?: (message: MessageData) => void;
  onForward?: (message: MessageData) => void;
  onDownload?: (message: MessageData) => void;
  onPin?: (message: MessageData) => void;
  onFavorite?: (message: MessageData) => void;
  onDelete?: (message: MessageData) => void;
  onEdit?: (message: MessageData) => void;
}

export default function MessageContextMenu({
  children,
  message,
  onReply,
  onReact,
  onForward,
  onDownload,
  onPin,
  onFavorite,
  onDelete,
  onEdit,
}: MessageContextMenuProps) {
  const isMedia = message.hasMedia && message.mediaType && message.mediaType !== 'text' && message.mediaType !== 'chat';

  return (
    <ContextMenu>
      <ContextMenuTrigger asChild>{children}</ContextMenuTrigger>
      <ContextMenuContent className="w-48">
        <ContextMenuItem onClick={() => onReply?.(message)}>
          <Reply className="w-4 h-4 mr-2" />
          Responder
        </ContextMenuItem>
        <ContextMenuItem onClick={() => onReact?.(message)}>
          <SmilePlus className="w-4 h-4 mr-2" />
          Reagir
        </ContextMenuItem>
        <ContextMenuSeparator />
        <ContextMenuItem onClick={() => onForward?.(message)}>
          <Forward className="w-4 h-4 mr-2" />
          Encaminhar
        </ContextMenuItem>
        {isMedia && (
          <ContextMenuItem onClick={() => onDownload?.(message)}>
            <Download className="w-4 h-4 mr-2" />
            Baixar
          </ContextMenuItem>
        )}
        <ContextMenuSeparator />
        <ContextMenuItem onClick={() => onPin?.(message)}>
          <Pin className="w-4 h-4 mr-2" />
          Fixar conversa
        </ContextMenuItem>
        <ContextMenuItem onClick={() => onFavorite?.(message)}>
          <Star className="w-4 h-4 mr-2" />
          Favoritar
        </ContextMenuItem>
        <ContextMenuSeparator />
        {message.fromMe && (
          <ContextMenuItem onClick={() => onEdit?.(message)}>
            <Pencil className="w-4 h-4 mr-2" />
            Editar
          </ContextMenuItem>
        )}
        <ContextMenuItem onClick={() => onDelete?.(message)} className="text-destructive focus:text-destructive">
          <Trash2 className="w-4 h-4 mr-2" />
          Apagar para todos
        </ContextMenuItem>
      </ContextMenuContent>
    </ContextMenu>
  );
}
