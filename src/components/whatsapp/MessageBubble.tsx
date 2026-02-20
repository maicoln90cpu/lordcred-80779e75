import React, { forwardRef, useMemo } from 'react';
import { cn } from '@/lib/utils';
import MediaRenderer from './MediaRenderer';

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
}

// Generate a consistent color from a string
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

  // Split by URL first, then format inline styles
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

    // Apply WhatsApp formatting using regex replacements
    // Process: *bold*, _italic_, ~strikethrough~, `code`
    const formatted = part
      .split(/(\*[^*]+\*|_[^_]+_|~[^~]+~|`[^`]+`)/)
      .map((segment, j) => {
        if (segment.startsWith('*') && segment.endsWith('*') && segment.length > 2) {
          return <strong key={`${i}-${j}`}>{segment.slice(1, -1)}</strong>;
        }
        if (segment.startsWith('_') && segment.endsWith('_') && segment.length > 2) {
          return <em key={`${i}-${j}`}>{segment.slice(1, -1)}</em>;
        }
        if (segment.startsWith('~') && segment.endsWith('~') && segment.length > 2) {
          return <del key={`${i}-${j}`}>{segment.slice(1, -1)}</del>;
        }
        if (segment.startsWith('`') && segment.endsWith('`') && segment.length > 2) {
          return (
            <code key={`${i}-${j}`} className="bg-black/20 dark:bg-white/10 rounded px-1 py-0.5 text-xs font-mono">
              {segment.slice(1, -1)}
            </code>
          );
        }
        return segment;
      });

    return <React.Fragment key={i}>{formatted}</React.Fragment>;
  });
}

const MEDIA_KEYWORDS = ['ptt', 'audio', 'image', 'video', 'sticker', 'document', 'ptv', 'myaudio'];

const MessageBubble = forwardRef<HTMLDivElement, MessageBubbleProps>(function MessageBubble(
  { text, time, fromMe, messageType, mediaType, hasMedia, messageId, chipId, senderName, isGroup }, ref
) {
  // Detect media even if hasMedia is false but text is a known media keyword
  const fallbackMediaType = (!hasMedia && text && MEDIA_KEYWORDS.includes(text.toLowerCase().trim())) ? text.toLowerCase().trim() : null;
  const effectiveMediaType = mediaType || fallbackMediaType;
  const isMedia = !!(effectiveMediaType && effectiveMediaType !== 'text' && effectiveMediaType !== 'chat' && messageId && chipId);
  const displayText = fallbackMediaType ? '' : text; // clear raw keyword
  const formattedText = useMemo(() => formatWhatsAppText(displayText), [displayText]);
  const senderColor = useMemo(() => senderName ? nameToColor(senderName) : '', [senderName]);

  return (
    <div ref={ref} className={cn("flex", fromMe ? "justify-end" : "justify-start")}>
      <div
        className={cn(
          "max-w-[75%] rounded-lg px-3 py-2 text-sm",
          fromMe
            ? "bg-primary/20 text-foreground rounded-br-none"
            : "bg-secondary text-foreground rounded-bl-none"
        )}
      >
        {isGroup && !fromMe && senderName && (
          <p className={cn("text-xs font-semibold mb-0.5", senderColor)}>
            {senderName}
          </p>
        )}
        {isMedia && messageId && chipId && (
          <div className="mb-1">
            <MediaRenderer
              messageId={messageId}
              mediaType={effectiveMediaType!}
              chipId={chipId}
              caption={displayText || undefined}
            />
          </div>
        )}
        {!isMedia && displayText && <p className="break-words whitespace-pre-wrap">{formattedText}</p>}
        <p className={cn(
          "text-[10px] mt-1 text-right",
          "text-muted-foreground"
        )}>
          {time}
        </p>
      </div>
    </div>
  );
});

export default MessageBubble;
