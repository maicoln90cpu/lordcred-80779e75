import React, { forwardRef, useMemo, useState } from 'react';
import { Check, CheckCheck } from 'lucide-react';
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
import { Reply, SmilePlus, Forward, Download, Pin, Star } from 'lucide-react';

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
  onStartChat?: (phone: string) => void;
  status?: string;
  quotedText?: string;
  quotedSender?: string;
  quotedFromMe?: boolean;
  onQuotedClick?: () => void;
  sentByUserName?: string;
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

const WHATSAPP_LINK_REGEX = /https?:\/\/(?:wa\.me\/|api\.whatsapp\.com\/send\?phone=)(\d+)/i;
const PHONE_REGEX = /\b(\+?\d{10,15})\b|\b(\+?\d{2,3}[\s.-]?\(?\d{2}\)?[\s.-]?\d{4,5}[\s.-]?\d{4})\b/g;

function extractPhoneDigits(raw: string): string {
  return raw.replace(/\D/g, '');
}

function formatWhatsAppText(text: string, onStartChat?: (phone: string) => void): React.ReactNode[] {
  if (!text) return [];
  const urlRegex = /(https?:\/\/[^\s]+)/g;
  const parts = text.split(urlRegex);
  return parts.map((part, i) => {
    if (urlRegex.test(part)) {
      // Check if it's a WhatsApp link
      const waMatch = part.match(WHATSAPP_LINK_REGEX);
      if (waMatch && onStartChat) {
        const phone = waMatch[1];
        return (
          <button key={i} onClick={() => onStartChat(phone)}
            className="text-blue-400 underline break-all hover:text-blue-300 cursor-pointer">
            {part}
          </button>
        );
      }
      return (
        <a key={i} href={part} target="_blank" rel="noopener noreferrer"
          className="text-blue-400 underline break-all hover:text-blue-300">
          {part}
        </a>
      );
    }
    // Detect phone numbers in non-URL text
    const phoneRegex = /\b(\+?\d{10,15})\b|\b(\+?\d{2,3}[\s.-]?\(?\d{2}\)?[\s.-]?\d{4,5}[\s.-]?\d{4})\b/g;
    const segments: (string | React.ReactNode)[] = [];
    let lastIndex = 0;
    let match: RegExpExecArray | null;
    while ((match = phoneRegex.exec(part)) !== null) {
      if (match.index > lastIndex) {
        segments.push({ type: 'text', value: part.slice(lastIndex, match.index) } as any);
      }
      const matched = match[0];
      let digits = extractPhoneDigits(matched);
      if (digits.length === 10 || digits.length === 11) {
        digits = '55' + digits;
      }
      if (onStartChat) {
        segments.push(
          <button key={`${i}-phone-${lastIndex}`} onClick={() => onStartChat(digits)}
            className="text-blue-400 underline hover:text-blue-300 cursor-pointer">
            {matched}
          </button>
        );
      } else {
        segments.push({ type: 'text', value: matched } as any);
      }
      lastIndex = match.index + matched.length;
    }
    if (lastIndex < part.length) {
      segments.push({ type: 'text', value: part.slice(lastIndex) } as any);
    }
    const formatted = segments.map((segment, j) => {
      if (React.isValidElement(segment)) return segment;
      const text = typeof segment === 'string' ? segment : (segment as any).value || '';
      if (!text) return null;
      // Apply WhatsApp formatting (bold, italic, etc.)
      const styledParts = text
        .split(/(\*[^*]+\*|_[^_]+_|~[^~]+~|`[^`]+`)/)
        .map((seg: string, k: number) => {
          if (seg.startsWith('*') && seg.endsWith('*') && seg.length > 2)
            return <strong key={`${i}-${j}-${k}`}>{seg.slice(1, -1)}</strong>;
          if (seg.startsWith('_') && seg.endsWith('_') && seg.length > 2)
            return <em key={`${i}-${j}-${k}`}>{seg.slice(1, -1)}</em>;
          if (seg.startsWith('~') && seg.endsWith('~') && seg.length > 2)
            return <del key={`${i}-${j}-${k}`}>{seg.slice(1, -1)}</del>;
          if (seg.startsWith('`') && seg.endsWith('`') && seg.length > 2)
            return <code key={`${i}-${j}-${k}`} className="bg-black/20 dark:bg-white/10 rounded px-1 py-0.5 text-xs font-mono">{seg.slice(1, -1)}</code>;
          return seg;
        });
      return <React.Fragment key={`${i}-${j}`}>{styledParts}</React.Fragment>;
    });
    return <React.Fragment key={i}>{formatted}</React.Fragment>;
  });
}

const MEDIA_KEYWORDS = ['ptt', 'audio', 'image', 'video', 'sticker', 'document', 'ptv', 'myaudio',
  'audiomessage', 'pttmessage', 'imagemessage', 'videomessage', 'documentmessage', 'stickermessage'];

const MessageBubble = forwardRef<HTMLDivElement, MessageBubbleProps>(function MessageBubble(
  { text, time, fromMe, messageType, mediaType, hasMedia, messageId, chipId, senderName, isGroup,
    onReply, onReact, onForward, onDownload, onPin, onFavorite, onStartChat, status,
    quotedText, quotedSender, quotedFromMe, onQuotedClick, sentByUserName }, ref
) {
  const [hovered, setHovered] = useState(false);

  const fallbackMediaType = (!hasMedia && text && MEDIA_KEYWORDS.includes(text.toLowerCase().trim())) ? text.toLowerCase().trim() : null;
  const effectiveMediaType = mediaType || fallbackMediaType;
  const isMedia = !!(effectiveMediaType && effectiveMediaType !== 'text' && effectiveMediaType !== 'chat' && messageId && chipId);
  const isTempMedia = !!(effectiveMediaType && effectiveMediaType !== 'text' && effectiveMediaType !== 'chat' && (!messageId || !chipId));
  const displayText = fallbackMediaType ? '' : text;
  const formattedText = useMemo(() => formatWhatsAppText(displayText, onStartChat), [displayText, onStartChat]);
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
        <Pin className="w-4 h-4 mr-2" />Fixar conversa
      </DropdownMenuItem>
      <DropdownMenuItem onClick={() => onFavorite?.(msgData)}>
        <Star className="w-4 h-4 mr-2" />Favoritar
      </DropdownMenuItem>
    </>
  );

  return (
    <div ref={ref} className={cn("flex", fromMe ? "justify-end" : "justify-start")} data-message-id={messageId}>
      <div
        className={cn("flex items-start gap-1 max-w-[75%]", fromMe && "flex-row-reverse")}
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
      >
        <div
          className={cn(
            "rounded-2xl px-3.5 py-2 text-sm shadow-sm transition-shadow",
            fromMe
              ? "bg-primary/15 text-foreground rounded-br-sm shadow-primary/5"
              : "bg-secondary/80 text-foreground rounded-bl-sm shadow-secondary/10"
          )}
        >
          {/* Quoted message preview */}
          {quotedText && (
            <button
              onClick={onQuotedClick}
              className={cn(
                "w-full text-left mb-1.5 rounded-lg px-2.5 py-1.5 border-l-[3px] text-xs cursor-pointer hover:opacity-80 transition-opacity",
                quotedFromMe
                  ? "border-primary/60 bg-primary/10"
                  : "border-accent/60 bg-accent/10"
              )}
            >
              {quotedSender && (
                <p className="font-semibold text-primary truncate">{quotedSender}</p>
              )}
              <p className="text-muted-foreground truncate">{quotedText}</p>
            </button>
          )}
          {isGroup && !fromMe && senderName && (
            <p className={cn("text-xs font-semibold mb-0.5", senderColor)}>{senderName}</p>
          )}
          {fromMe && sentByUserName && (
            <p className="text-[10px] font-medium text-primary/70 mb-0.5">📤 {sentByUserName}</p>
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
          <div className="flex items-center justify-end gap-1 mt-1">
            <span className="text-[10px] text-muted-foreground">{time}</span>
            {fromMe && (
              status === 'read' ? (
                <CheckCheck className="w-3.5 h-3.5 text-blue-500" />
              ) : status === 'delivered' ? (
                <CheckCheck className="w-3.5 h-3.5 text-muted-foreground" />
              ) : (
                <Check className="w-3.5 h-3.5 text-muted-foreground" />
              )
            )}
          </div>
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