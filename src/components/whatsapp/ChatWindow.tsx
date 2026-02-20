import { useState, useEffect, useRef, useCallback } from 'react';
import { MessageSquare, Loader2 } from 'lucide-react';
import ChatInput from './ChatInput';
import MessageBubble from './MessageBubble';
import ForwardDialog from './ForwardDialog';
import { type MessageData } from './MessageContextMenu';
import { supabase } from '@/integrations/supabase/client';
import { getCachedMessages, setCachedMessages, addMessageToCache } from '@/hooks/useMessageCache';
import { useToast } from '@/hooks/use-toast';
import type { ChatContact } from '@/pages/WhatsApp';

interface ChatMessage {
  id: string;
  text: string;
  fromMe: boolean;
  timestamp: string;
  senderName: string;
  messageType: string;
  mediaType?: string;
  hasMedia?: boolean;
  messageId?: string;
}

interface ChatWindowProps {
  chat: ChatContact | null;
  chipId: string | null;
}

export default function ChatWindow({ chat, chipId }: ChatWindowProps) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [loading, setLoading] = useState(false);
  const [sending, setSending] = useState(false);
  const [replyTo, setReplyTo] = useState<MessageData | null>(null);
  const [forwardMsg, setForwardMsg] = useState<MessageData | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const { toast } = useToast();

  const fetchMessages = useCallback(async () => {
    if (!chipId || !chat) return;

    // 1. Load from cache instantly
    const cached = getCachedMessages<ChatMessage>(chipId, chat.remoteJid);
    if (cached && cached.length > 0) {
      setMessages(cached);
    }

    // 2. Fetch from API in background
    setLoading(cached ? false : true);
    try {
      const response = await supabase.functions.invoke('uazapi-api', {
        body: { action: 'fetch-messages', chipId, chatId: chat.remoteJid, limit: 50 },
      });

      if (response.data?.success && response.data.messages) {
        const apiMessages: ChatMessage[] = response.data.messages;
        // 3. Merge: API has priority, cache fills gaps
        if (cached && cached.length > 0) {
          const apiIds = new Set(apiMessages.map(m => m.id));
          const uniqueCached = cached.filter(m => !apiIds.has(m.id) && !m.id.startsWith('temp-'));
          const merged = [...uniqueCached, ...apiMessages].sort(
            (a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
          );
          setMessages(merged);
          setCachedMessages(chipId, chat.remoteJid, merged);
        } else {
          setMessages(apiMessages);
          setCachedMessages(chipId, chat.remoteJid, apiMessages);
        }
      }
    } catch (error) {
      console.error('Error fetching messages:', error);
    } finally {
      setLoading(false);
    }
  }, [chipId, chat?.remoteJid]);

  useEffect(() => {
    if (chat) {
      setReplyTo(null);
      fetchMessages();
    } else {
      setMessages([]);
    }
  }, [fetchMessages, chat?.remoteJid]);

  // Mark as read when opening chat
  useEffect(() => {
    if (!chipId || !chat || chat.unreadCount === 0) return;
    supabase.functions.invoke('uazapi-api', {
      body: { action: 'mark-read', chipId, chatId: chat.remoteJid },
    }).catch(() => {});
  }, [chipId, chat?.remoteJid]);

  // Realtime: listen for new messages
  useEffect(() => {
    if (!chipId || !chat) return;

    const channel = supabase
      .channel(`messages-${chat.remoteJid}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'message_history',
          filter: `chip_id=eq.${chipId}`,
        },
        (payload) => {
          const record = payload.new as any;
          if (!record || record.remote_jid !== chat.remoteJid) return;

          const rawContent = record.message_content;
          const safeText = typeof rawContent === 'string' ? rawContent : '';

          const newMsg: ChatMessage = {
            id: record.id,
            text: safeText,
            fromMe: record.direction === 'outgoing',
            timestamp: record.created_at,
            senderName: record.sender_name || '',
            messageType: record.media_type || 'text',
            mediaType: record.media_type || undefined,
            hasMedia: !!(record.media_type && record.media_type !== 'text' && record.media_type !== 'chat'),
            messageId: record.message_id || undefined,
          };

          setMessages(prev => {
            // Replace temp messages with real ones for outgoing
            if (newMsg.fromMe) {
              const withoutTemp = prev.filter(m => !m.id.startsWith('temp-') || (new Date(newMsg.timestamp).getTime() - new Date(m.timestamp).getTime()) > 10000);
              if (withoutTemp.some(m => m.id === newMsg.id)) return withoutTemp;
              return [...withoutTemp, newMsg];
            }
            if (prev.some(m => m.id === newMsg.id)) return prev;
            return [...prev, newMsg];
          });

          // Add to cache in realtime
          addMessageToCache(chipId, chat.remoteJid, newMsg);
        }
      )
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [chipId, chat?.remoteJid]);

  // Auto-scroll to bottom
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  const handleSend = useCallback(async (text: string) => {
    if (!chipId || !chat || !text.trim()) return;
    setSending(true);

    const tempMsg: ChatMessage = {
      id: `temp-${Date.now()}`,
      text,
      fromMe: true,
      timestamp: new Date().toISOString(),
      senderName: '',
      messageType: 'text',
    };
    setMessages(prev => [...prev, tempMsg]);
    setReplyTo(null);

    try {
      supabase.functions.invoke('uazapi-api', {
        body: { action: 'send-presence', chipId, chatId: chat.remoteJid, presence: 'composing' },
      }).catch(() => {});

      const response = await supabase.functions.invoke('uazapi-api', {
        body: { action: 'send-chat-message', chipId, chatId: chat.remoteJid, message: text },
      });

      if (!response.data?.success) {
        setMessages(prev => prev.filter(m => m.id !== tempMsg.id));
      }
    } catch (error) {
      console.error('Error sending message:', error);
      setMessages(prev => prev.filter(m => m.id !== tempMsg.id));
    } finally {
      setSending(false);
    }
  }, [chipId, chat]);

  const handleSendMedia = useCallback(async (mediaBase64: string, mediaType: string, caption: string, fileName?: string) => {
    if (!chipId || !chat) return;
    setSending(true);

    const tempMsg: ChatMessage = {
      id: `temp-media-${Date.now()}`,
      text: caption || `📎 ${mediaType}`,
      fromMe: true,
      timestamp: new Date().toISOString(),
      senderName: '',
      messageType: mediaType,
    };
    setMessages(prev => [...prev, tempMsg]);

    try {
      const response = await supabase.functions.invoke('uazapi-api', {
        body: {
          action: 'send-media',
          chipId,
          chatId: chat.remoteJid,
          mediaBase64,
          mediaType,
          mediaCaption: caption || undefined,
          mediaFileName: fileName || undefined,
        },
      });

      if (!response.data?.success) {
        console.error('Failed to send media:', response.data?.error);
        setMessages(prev => prev.filter(m => m.id !== tempMsg.id));
      }
    } catch (error) {
      console.error('Error sending media:', error);
      setMessages(prev => prev.filter(m => m.id !== tempMsg.id));
    } finally {
      setSending(false);
    }
  }, [chipId, chat]);

  // Context menu handlers
  const handleReply = useCallback((msg: MessageData) => setReplyTo(msg), []);
  const handleReact = useCallback((_msg: MessageData) => {
    toast({ title: 'Em breve', description: 'Reações estarão disponíveis em breve.' });
  }, [toast]);
  const handleForward = useCallback((msg: MessageData) => setForwardMsg(msg), []);
  const handleDownload = useCallback((msg: MessageData) => {
    if (msg.messageId && msg.chipId) {
      supabase.functions.invoke('uazapi-api', {
        body: { action: 'download-media', chipId: msg.chipId, messageId: msg.messageId },
      }).then(res => {
        if (res.data?.fileURL) window.open(res.data.fileURL, '_blank');
        else toast({ title: 'Erro', description: 'Não foi possível baixar a mídia.', variant: 'destructive' });
      });
    }
  }, [toast]);
  const handlePin = useCallback((_msg: MessageData) => {
    toast({ title: 'Em breve', description: 'Fixar mensagens estará disponível em breve.' });
  }, [toast]);
  const handleFavorite = useCallback((_msg: MessageData) => {
    toast({ title: 'Em breve', description: 'Favoritar mensagens estará disponível em breve.' });
  }, [toast]);
  const handleDelete = useCallback((_msg: MessageData) => {
    toast({ title: 'Em breve', description: 'Apagar mensagens estará disponível em breve.' });
  }, [toast]);

  const formatTime = (dateStr: string) => {
    try {
      return new Date(dateStr).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
    } catch {
      return '';
    }
  };

  if (!chat) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-muted-foreground">
        <div className="w-20 h-20 rounded-full bg-secondary/50 flex items-center justify-center mb-4">
          <MessageSquare className="w-10 h-10 opacity-50" />
        </div>
        <h3 className="text-lg font-medium mb-1">LordCred</h3>
        <p className="text-sm">Selecione uma conversa para começar</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      {/* Chat header */}
      <div className="flex items-center gap-3 px-4 py-3 border-b border-border/50 bg-card/50">
        <div className="w-9 h-9 rounded-full bg-primary/20 flex items-center justify-center">
          <span className="text-sm font-medium text-primary">
            {chat.name.charAt(0).toUpperCase()}
          </span>
        </div>
        <div>
          <p className="text-sm font-medium">{chat.name}</p>
          <p className="text-xs text-muted-foreground">{chat.phone}</p>
        </div>
      </div>

      {/* Messages area */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto p-4">
        {loading ? (
          <div className="flex items-center justify-center h-full">
            <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
          </div>
        ) : messages.length === 0 ? (
          <div className="flex items-center justify-center h-full text-sm text-muted-foreground">
            Nenhuma mensagem ainda
          </div>
        ) : (
          <div className="space-y-2 max-w-3xl mx-auto">
            {messages.map((msg) => (
              <MessageBubble
                key={msg.id}
                text={msg.text}
                time={formatTime(msg.timestamp)}
                fromMe={msg.fromMe}
                messageType={msg.messageType}
                mediaType={msg.mediaType}
                hasMedia={msg.hasMedia}
                messageId={msg.messageId}
                chipId={chipId || undefined}
                senderName={msg.senderName}
                isGroup={chat?.isGroup}
                onReply={handleReply}
                onReact={handleReact}
                onForward={handleForward}
                onDownload={handleDownload}
                onPin={handlePin}
                onFavorite={handleFavorite}
                onDelete={handleDelete}
              />
            ))}
          </div>
        )}
      </div>

      {/* Input area */}
      <ChatInput
        onSend={handleSend}
        onSendMedia={handleSendMedia}
        disabled={sending}
        replyTo={replyTo}
        onCancelReply={() => setReplyTo(null)}
      />

      <ForwardDialog
        open={!!forwardMsg}
        onClose={() => setForwardMsg(null)}
        message={forwardMsg}
        chipId={chipId}
      />
    </div>
  );
}
