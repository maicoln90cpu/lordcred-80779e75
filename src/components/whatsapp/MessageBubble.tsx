import React, { forwardRef, useMemo, useState } from 'react';
import { cn } from '@/lib/utils';
import { ChevronDown } from 'lucide-react';
import MediaRenderer from './MediaRenderer';
import MessageContextMenu, { type MessageData } from './MessageContextMenu';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Reply, SmilePlus, Forward, Download, Pin, Star, Trash2 } from 'lucide-react';

interface MessageBubbleProps {
  text: string;
  time: string;
  fromMe: boolean;
  messageType?: string;
  mediaType?: string;
  hasMedia?: boolean;
  messageId?: string;
  chipId?: string;
  senderName?: string;
  isGroup?: boolean;
  onReply?: (msg: MessageData) => void;
  onReact?: (msg: MessageData) => void;
  onForward?: (msg: MessageData) => void;
  onDownload?: (msg: MessageData) => void;
  onPin?: (msg: MessageData) => void;
  onFavorite?: (msg: MessageData) => void;
  onDelete?: (msg: MessageData) => void;
}

function nameToColor(name: string): string {
  const colors = [
    'text-emerald-400', 'text-sky-400', 'text-violet-400', 'text-rose-400',
    'text-amber-400', 'text-teal-400', 'text-pink-400', 'text-indigo-400',
  ];
  let hash = 0;
  for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash);
  return colors[Math.abs(hash) % colors.length];
}

function formatWhatsAppText(text: string): React.ReactNode[] {
  if (!text) return [];
  const urlRegex = /(https?:\/\/[^\s]+)/g;
  const parts = text.split(urlRegex);
  return parts.map((part, i) => {
    if (urlRegex.test(part)) {
      return (
        <a key={i} href={part} target="_blank" rel="noopener noreferrer"
          className="text-blue-400 underline break-all hover:text-blue-300">
          {part}
        </a>
      );
    }
    const formatted = part
      .split(/(\*[^*]+\*|_[^_]+_|~[^~]+~|`[^`]+`)/)
      .map((segment, j) => {
        if (segment.startsWith('*') && segment.endsWith('*') && segment.length > 2)
          return <strong key={`${i}-${j}`}>{segment.slice(1, -1)}</strong>;
        if (segment.startsWith('_') && segment.endsWith('_') && segment.length > 2)
          return <em key={`${i}-${j}`}>{segment.slice(1, -1)}</em>;
        if (segment.startsWith('~') && segment.endsWith('~') && segment.length > 2)
          return <del key={`${i}-${j}`}>{segment.slice(1, -1)}</del>;
        if (segment.startsWith('`') && segment.endsWith('`') && segment.length > 2)
          return <code key={`${i}-${j}`} className="bg-black/20 dark:bg-white/10 rounded px-1 py-0.5 text-xs font-mono">{segment.slice(1, -1)}</code>;
        return segment;
      });
    return <React.Fragment key={i}>{formatted}</React.Fragment>;
  });
}

const MEDIA_KEYWORDS = ['ptt', 'audio', 'image', 'video', 'sticker', 'document', 'ptv', 'myaudio',
  'audiomessage', 'pttmessage', 'imagemessage', 'videomessage', 'documentmessage', 'stickermessage'];

const MessageBubble = forwardRef<HTMLDivElement, MessageBubbleProps>(function MessageBubble(
  { text, time, fromMe, messageType, mediaType, hasMedia, messageId, chipId, senderName, isGroup,
    onReply, onReact, onForward, onDownload, onPin, onFavorite, onDelete }, ref
) {
  const [hovered, setHovered] = useState(false);

  const fallbackMediaType = (!hasMedia && text && MEDIA_KEYWORDS.includes(text.toLowerCase().trim())) ? text.toLowerCase().trim() : null;
  const effectiveMediaType = mediaType || fallbackMediaType;
  const isMedia = !!(effectiveMediaType && effectiveMediaType !== 'text' && effectiveMediaType !== 'chat' && messageId && chipId);
  const isTempMedia = !!(effectiveMediaType && effectiveMediaType !== 'text' && effectiveMediaType !== 'chat' && (!messageId || !chipId));
  const displayText = fallbackMediaType ? '' : text;
  const formattedText = useMemo(() => formatWhatsAppText(displayText), [displayText]);
  const senderColor = useMemo(() => senderName ? nameToColor(senderName) : '', [senderName]);

  const msgData: MessageData = {
    id: messageId || '',
    text: text,
    fromMe,
    messageId,
    mediaType: effectiveMediaType || undefined,
    hasMedia: hasMedia || isMedia,
    chipId,
  };

  const isMediaMsg = isMedia || (hasMedia && effectiveMediaType && effectiveMediaType !== 'text' && effectiveMediaType !== 'chat');

  const menuContent = (
    <>
      <DropdownMenuItem onClick={() => onReply?.(msgData)}>
        <Reply className="w-4 h-4 mr-2" />Responder
      </DropdownMenuItem>
      <DropdownMenuItem onClick={() => onReact?.(msgData)}>
        <SmilePlus className="w-4 h-4 mr-2" />Reagir
      </DropdownMenuItem>
      <DropdownMenuSeparator />
      <DropdownMenuItem onClick={() => onForward?.(msgData)}>
        <Forward className="w-4 h-4 mr-2" />Encaminhar
      </DropdownMenuItem>
      {isMediaMsg && (
        <DropdownMenuItem onClick={() => onDownload?.(msgData)}>
          <Download className="w-4 h-4 mr-2" />Baixar
        </DropdownMenuItem>
      )}
      <DropdownMenuSeparator />
      <DropdownMenuItem onClick={() => onPin?.(msgData)}>
        <Pin className="w-4 h-4 mr-2" />Fixar
      </DropdownMenuItem>
      <DropdownMenuItem onClick={() => onFavorite?.(msgData)}>
        <Star className="w-4 h-4 mr-2" />Favoritar
      </DropdownMenuItem>
      <DropdownMenuSeparator />
      <DropdownMenuItem onClick={() => onDelete?.(msgData)} className="text-destructive focus:text-destructive">
        <Trash2 className="w-4 h-4 mr-2" />Apagar
      </DropdownMenuItem>
    </>
  );

  return (
    <div ref={ref} className={cn("flex", fromMe ? "justify-end" : "justify-start")}>
      <div
        className={cn("flex items-start gap-1 max-w-[75%]", fromMe && "flex-row-reverse")}
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
      >
        <div
          className={cn(
            "rounded-lg px-3 py-2 text-sm",
            fromMe
              ? "bg-primary/20 text-foreground rounded-br-none"
              : "bg-secondary text-foreground rounded-bl-none"
          )}
        >
          {isGroup && !fromMe && senderName && (
            <p className={cn("text-xs font-semibold mb-0.5", senderColor)}>{senderName}</p>
          )}
          {isMedia && messageId && chipId && (
            <div className="mb-1">
              <MediaRenderer messageId={messageId} mediaType={effectiveMediaType!} chipId={chipId} caption={displayText || undefined} />
            </div>
          )}
          {isTempMedia && (
            <p className="text-xs text-muted-foreground italic">Enviando mídia...</p>
          )}
          {!isMedia && !isTempMedia && displayText && <p className="break-words whitespace-pre-wrap">{formattedText}</p>}
          <p className="text-[10px] mt-1 text-right text-muted-foreground">{time}</p>
        </div>


      {/* Hover chevron for dropdown menu - posicionado ao lado da bolha */}
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button
            className={cn(
              "self-start mt-1 flex items-center justify-center w-6 h-6 rounded-full bg-background/80 shadow-sm transition-opacity shrink-0",
              hovered ? "opacity-100" : "opacity-0"
            )}
          >
            <ChevronDown className="w-3.5 h-3.5 text-muted-foreground" />
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align={fromMe ? "end" : "start"} className="w-48">
          {menuContent}
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  </div>
  );
});

export default MessageBubble;