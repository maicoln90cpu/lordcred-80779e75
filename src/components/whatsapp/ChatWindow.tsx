import { useState, useEffect, useRef, useCallback } from 'react';
import { MessageSquare, Loader2, Search, X, WifiOff, RefreshCw, StickyNote, Zap } from 'lucide-react';
import ChatInput from './ChatInput';
import MessageBubble from './MessageBubble';
import ForwardDialog from './ForwardDialog';
import { type MessageData } from './MessageContextMenu';
import { supabase } from '@/integrations/supabase/client';
import { getCachedMessages, setCachedMessages, addMessageToCache } from '@/hooks/useMessageCache';
import { cn } from '@/lib/utils';
import { useToast } from '@/hooks/use-toast';
import { Input } from '@/components/ui/input';
import ConversationNotes from './ConversationNotes';
import QuickRepliesManager from './QuickRepliesManager';
import { Button } from '@/components/ui/button';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
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
  status?: string;
}

interface ChatWindowProps {
  chat: ChatContact | null;
  chipId: string | null;
  chipStatus?: string;
  onReconnect?: () => void;
  onStartNewChat?: (phone: string) => void;
}

const QUICK_EMOJIS = ['👍', '❤️', '😂', '😮', '😢', '🙏'];

export default function ChatWindow({ chat, chipId, chipStatus, onReconnect, onStartNewChat }: ChatWindowProps) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [sending, setSending] = useState(false);
  const [replyTo, setReplyTo] = useState<MessageData | null>(null);
  const [forwardMsg, setForwardMsg] = useState<MessageData | null>(null);
  const [reactMsg, setReactMsg] = useState<MessageData | null>(null);
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [notesOpen, setNotesOpen] = useState(false);
  const [quickRepliesOpen, setQuickRepliesOpen] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const [chipDisconnected, setChipDisconnected] = useState(false);
  const [failedMessage, setFailedMessage] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const activeChipRef = useRef(chipId);
  const activeChatRef = useRef(chat?.remoteJid);
  const { toast } = useToast();

  // Keep refs in sync
  useEffect(() => { activeChipRef.current = chipId; }, [chipId]);
  useEffect(() => { activeChatRef.current = chat?.remoteJid; }, [chat?.remoteJid]);

  // Reset disconnect state when chip changes
  useEffect(() => {
    setChipDisconnected(false);
    setFailedMessage(null);
  }, [chipId]);

  const mapDbRow = useCallback((r: any): ChatMessage => ({
    id: r.id,
    text: typeof r.message_content === 'string' ? r.message_content : '',
    fromMe: r.direction === 'outgoing',
    timestamp: r.created_at,
    senderName: r.sender_name || '',
    messageType: r.media_type || 'text',
    mediaType: r.media_type || undefined,
    hasMedia: !!(r.media_type && r.media_type !== 'text' && r.media_type !== 'chat' && r.media_type !== 'url'),
    messageId: r.message_id || undefined,
    status: r.status || 'sent',
  }), []);

  const fetchMessages = useCallback(async (pageNum = 1, append = false) => {
    if (!chipId || !chat) return;
    const requestChipId = chipId;
    const requestChatJid = chat.remoteJid;
    const PAGE_SIZE = 50;

    if (pageNum === 1 && !append) {
      const cached = getCachedMessages<ChatMessage>(chipId, chat.remoteJid);
      if (cached && cached.length > 0) setMessages(cached);
      setLoading(!cached || cached.length === 0);
    } else {
      setLoadingMore(true);
    }

    try {
      // Database-first: query Supabase directly
      const from = (pageNum - 1) * PAGE_SIZE;
      const to = from + PAGE_SIZE - 1;

      // Build list of JIDs to search (dual query for @lid chats)
      const jidsToSearch = [requestChatJid];
      if (requestChatJid.includes('@lid') && chat.phone) {
        const cleanPhone = chat.phone.replace(/\D/g, '');
        if (cleanPhone.length >= 10) {
          jidsToSearch.push(`${cleanPhone}@s.whatsapp.net`);
        }
      }
      if (chat.alternateJid && !jidsToSearch.includes(chat.alternateJid)) {
        jidsToSearch.push(chat.alternateJid);
      }

      const { data: dbMessages, error } = await supabase
        .from('message_history')
        .select('*')
        .eq('chip_id', requestChipId)
        .in('remote_jid', jidsToSearch)
        .order('created_at', { ascending: false })
        .range(from, to);

      // Stale request guard
      if (activeChipRef.current !== requestChipId || activeChatRef.current !== requestChatJid) return;

      if (error) {
        console.error('Error fetching messages from DB:', error);
        return;
      }

      const mapped = (dbMessages || []).map(mapDbRow).reverse(); // reverse to ascending order

      if (mapped.length < PAGE_SIZE) setHasMore(false);

      if (pageNum === 1 && !append) {
        setMessages(mapped);
        setCachedMessages(requestChipId, requestChatJid, mapped);
      } else if (append && mapped.length > 0) {
        setMessages(prev => {
          const existingIds = new Set(prev.map(m => m.id));
          const newOlder = mapped.filter(m => !existingIds.has(m.id));
          return [...newOlder, ...prev];
        });
      }
    } catch (error) {
      console.error('Error fetching messages:', error);
    } finally {
      if (activeChipRef.current === requestChipId && activeChatRef.current === requestChatJid) {
        setLoading(false);
        setLoadingMore(false);
      }
    }
  }, [chipId, chat?.remoteJid, mapDbRow]);

  useEffect(() => {
    if (chat) {
      setReplyTo(null);
      setCurrentPage(1);
      setHasMore(true);
      fetchMessages();
    } else {
      setMessages([]);
    }
  }, [fetchMessages, chat?.remoteJid]);

  // Mark as read when opening chat - via UazAPI (edge function updates DB after success)
  const markReadTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const markRead = useCallback((cId: string, cJid: string) => {
    if (markReadTimer.current) clearTimeout(markReadTimer.current);
    markReadTimer.current = setTimeout(() => {
      supabase.functions.invoke('uazapi-api', {
        body: { action: 'mark-read', chipId: cId, chatId: cJid },
      }).catch(() => {});
    }, 500);
  }, []);

  useEffect(() => {
    if (!chipId || !chat) return;
    markRead(chipId, chat.remoteJid);
  }, [chipId, chat?.remoteJid, markRead]);

  // Realtime: listen for new messages and status updates
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
          if (!record) return;
          // Match both primary and alternate JIDs
          const matchJids = [chat.remoteJid];
          if (chat.alternateJid) matchJids.push(chat.alternateJid);
          if (chat.remoteJid.includes('@lid') && chat.phone) {
            const pJid = `${chat.phone.replace(/\D/g, '')}@s.whatsapp.net`;
            if (!matchJids.includes(pJid)) matchJids.push(pJid);
          }
          if (!matchJids.includes(record.remote_jid)) return;

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
            hasMedia: !!(record.media_type && record.media_type !== 'text' && record.media_type !== 'chat' && record.media_type !== 'url'),
            messageId: record.message_id || undefined,
            status: record.status || 'sent',
          };

          // Auto mark-read incoming messages while chat is open
          if (!newMsg.fromMe && chipId) {
            markRead(chipId, chat.remoteJid);
          }

          setMessages(prev => {
            if (newMsg.fromMe) {
              const withoutTemp = prev.filter(m => !m.id.startsWith('temp-') || (new Date(newMsg.timestamp).getTime() - new Date(m.timestamp).getTime()) > 10000);
              if (withoutTemp.some(m => m.id === newMsg.id)) return withoutTemp;
              return [...withoutTemp, newMsg];
            }
            if (prev.some(m => m.id === newMsg.id)) return prev;
            return [...prev, newMsg];
          });

          addMessageToCache(chipId, chat.remoteJid, newMsg);
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'message_history',
          filter: `chip_id=eq.${chipId}`,
        },
        (payload) => {
          const record = payload.new as any;
          if (!record) return;
          const matchJids2 = [chat.remoteJid];
          if (chat.alternateJid) matchJids2.push(chat.alternateJid);
          if (chat.remoteJid.includes('@lid') && chat.phone) {
            const pJid2 = `${chat.phone.replace(/\D/g, '')}@s.whatsapp.net`;
            if (!matchJids2.includes(pJid2)) matchJids2.push(pJid2);
          }
          if (!matchJids2.includes(record.remote_jid)) return;
          // Handle deleted messages from webhook
          if (record.status === 'deleted') {
            setMessages(prev => prev.filter(m => m.id !== record.id && m.messageId !== record.message_id));
            return;
          }
          // Update status and text of existing message (handles edits + status ticks)
          setMessages(prev => prev.map(m =>
            (m.id === record.id || (m.messageId && m.messageId === record.message_id))
              ? { ...m, status: record.status || m.status, text: record.message_content || m.text }
              : m
          ));
        }
      )
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [chipId, chat?.remoteJid]);

  // Auto-scroll to bottom on new messages
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  // Infinite scroll: load older messages
  const handleScroll = useCallback(() => {
    if (!scrollRef.current || loadingMore || !hasMore) return;
    if (scrollRef.current.scrollTop < 100) {
      const nextPage = currentPage + 1;
      setCurrentPage(nextPage);
      const prevHeight = scrollRef.current.scrollHeight;
      fetchMessages(nextPage, true).then(() => {
        // Maintain scroll position after prepending
        if (scrollRef.current) {
          scrollRef.current.scrollTop = scrollRef.current.scrollHeight - prevHeight;
        }
      });
    }
  }, [loadingMore, hasMore, currentPage, fetchMessages]);

  const checkChipConnected = useCallback(async (): Promise<boolean> => {
    if (!chipId) return false;
    const { data } = await supabase
      .from('chips')
      .select('status')
      .eq('id', chipId)
      .maybeSingle();
    return data?.status === 'connected';
  }, [chipId]);

  const handleSend = useCallback(async (text: string) => {
    if (!chipId || !chat || !text.trim()) return;

    // Check chip connection before sending
    const connected = await checkChipConnected();
    if (!connected) {
      setChipDisconnected(true);
      setFailedMessage(text);
      return;
    }

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
        const errMsg = response.data?.error || '';
        if (errMsg.toLowerCase().includes('not on whatsapp')) {
          toast({ title: 'Número inválido', description: 'Este número não está registrado no WhatsApp', variant: 'destructive' });
        } else if (errMsg.toLowerCase().includes('disconnected') || errMsg.toLowerCase().includes('not connected')) {
          setChipDisconnected(true);
          setFailedMessage(text);
        } else if (errMsg) {
          toast({ title: 'Erro ao enviar', description: errMsg, variant: 'destructive' });
        }
      }
    } catch (error) {
      console.error('Error sending message:', error);
      setChipDisconnected(true);
      setFailedMessage(text);
    } finally {
      // Always remove temp message — realtime will add the real one from DB
      setMessages(prev => prev.filter(m => m.id !== tempMsg.id));
      setSending(false);
    }
  }, [chipId, chat, checkChipConnected]);

  const handleSendMedia = useCallback(async (mediaBase64: string, mediaType: string, caption: string, fileName?: string) => {
    if (!chipId || !chat) return;
    // Non-blocking: do NOT set setSending(true) — user can continue chatting

    const tempMsg: ChatMessage = {
      id: `temp-media-${Date.now()}`,
      text: caption || `📎 Enviando ${mediaType}...`,
      fromMe: true,
      timestamp: new Date().toISOString(),
      senderName: '',
      messageType: mediaType,
    };
    setMessages(prev => [...prev, tempMsg]);

    // Fire and forget — runs in background
    (async () => {
      try {
        const response = await supabase.functions.invoke('uazapi-api', {
          body: {
            action: 'send-media', chipId, chatId: chat.remoteJid,
            mediaBase64, mediaType, mediaCaption: caption || undefined, mediaFileName: fileName || undefined,
          },
        });

        if (!response.data?.success) {
          setMessages(prev => prev.filter(m => m.id !== tempMsg.id));
          toast({ title: 'Erro ao enviar mídia', variant: 'destructive' });
        }
      } catch (error) {
        console.error('Error sending media:', error);
        setMessages(prev => prev.filter(m => m.id !== tempMsg.id));
        toast({ title: 'Erro ao enviar mídia', variant: 'destructive' });
      } finally {
        // Remove temp — realtime will add the real one
        setMessages(prev => prev.filter(m => m.id !== tempMsg.id));
      }
    })();
  }, [chipId, chat, toast]);

  // === CONTEXT MENU HANDLERS ===

  const handleReply = useCallback((msg: MessageData) => setReplyTo(msg), []);
  const handleReact = useCallback((msg: MessageData) => setReactMsg(msg), []);
  const handleForward = useCallback((msg: MessageData) => setForwardMsg(msg), []);


  const handleReactEmoji = useCallback(async (emoji: string) => {
    if (!reactMsg || !chipId || !chat) return;
    try {
      await supabase.functions.invoke('uazapi-api', {
        body: { action: 'react-message', chipId, chatId: chat.remoteJid, messageId: reactMsg.messageId, emoji },
      });
      toast({ title: 'Reação enviada', description: emoji });
    } catch {
      toast({ title: 'Erro', description: 'Não foi possível reagir.', variant: 'destructive' });
    }
    setReactMsg(null);
  }, [reactMsg, chipId, chat, toast]);

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

  const handlePin = useCallback(async (msg: MessageData) => {
    if (!chipId || !chat) return;
    try {
      // Get current pin state
      const { data: conv } = await supabase
        .from('conversations')
        .select('is_pinned')
        .eq('chip_id', chipId)
        .eq('remote_jid', chat.remoteJid)
        .maybeSingle();
      const newVal = !(conv?.is_pinned);
      await supabase
        .from('conversations')
        .update({ is_pinned: newVal } as any)
        .eq('chip_id', chipId)
        .eq('remote_jid', chat.remoteJid);
      toast({ title: newVal ? '📌 Conversa fixada' : 'Conversa desafixada' });
    } catch {
      toast({ title: 'Erro ao fixar conversa', variant: 'destructive' });
    }
  }, [chipId, chat, toast]);

  const handleFavorite = useCallback(async (msg: MessageData) => {
    if (!chipId || !chat) return;
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      // Check if already favorited
      const { data: existing } = await supabase
        .from('message_favorites')
        .select('id')
        .eq('user_id', user.id)
        .eq('message_id', msg.messageId || msg.id)
        .maybeSingle();

      if (existing) {
        await supabase.from('message_favorites').delete().eq('id', existing.id);
        toast({ title: 'Removido dos favoritos' });
      } else {
        await supabase.from('message_favorites').insert({
          user_id: user.id,
          chip_id: chipId,
          message_id: msg.messageId || msg.id,
          remote_jid: chat.remoteJid,
          message_text: msg.text || '',
        });
        toast({ title: '⭐ Mensagem favoritada' });
      }
    } catch {
      toast({ title: 'Erro', description: 'Não foi possível favoritar.', variant: 'destructive' });
    }
  }, [chipId, chat, toast]);


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

  const filteredMessages = searchQuery
    ? messages.filter(m => m.text.toLowerCase().includes(searchQuery.toLowerCase()))
    : messages;

  return (
    <div className="flex h-full">
    <div className="flex flex-col flex-1 min-w-0">
      {/* Chat header - premium */}
      <div className="flex items-center gap-3 px-4 py-3 border-b border-border/30 bg-gradient-to-r from-card/80 to-card/60 backdrop-blur-sm shadow-sm">
        <div className="relative">
          {chat.profilePicUrl ? (
            <img src={chat.profilePicUrl} alt="" className="w-10 h-10 rounded-full object-cover ring-2 ring-primary/20" onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; (e.target as HTMLImageElement).nextElementSibling?.classList.remove('hidden'); }} />
          ) : null}
          <div className={cn("w-10 h-10 rounded-full bg-gradient-to-br from-primary/30 to-primary/10 flex items-center justify-center ring-2 ring-primary/20", chat.profilePicUrl && "hidden")}>
            <span className="text-sm font-semibold text-primary">
              {chat.name.charAt(0).toUpperCase()}
            </span>
          </div>
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold tracking-tight">{chat.name}</p>
          <p className="text-xs text-muted-foreground/70">{chat.phone}</p>
        </div>
        <div className="flex items-center gap-0.5">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setQuickRepliesOpen(true)}
            className="text-muted-foreground hover:text-primary hover:bg-primary/10 transition-colors"
            title="Respostas rápidas"
          >
            <Zap className="w-4 h-4" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setNotesOpen(!notesOpen)}
            className={cn("text-muted-foreground hover:text-primary hover:bg-primary/10 transition-colors", notesOpen && "text-primary bg-primary/10")}
            title="Notas internas"
          >
            <StickyNote className="w-4 h-4" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            onClick={() => { setSearchOpen(!searchOpen); setSearchQuery(''); setTimeout(() => searchInputRef.current?.focus(), 100); }}
            className="text-muted-foreground hover:text-primary hover:bg-primary/10 transition-colors"
          >
            <Search className="w-4 h-4" />
          </Button>
        </div>
      </div>

      {/* Search bar */}
      {searchOpen && (
        <div className="flex items-center gap-2 px-4 py-2 border-b border-border/50 bg-card/30">
          <Search className="w-4 h-4 text-muted-foreground shrink-0" />
          <Input
            ref={searchInputRef}
            placeholder="Buscar nas mensagens..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="h-8 text-sm bg-transparent border-0 focus-visible:ring-0"
          />
          {searchQuery && (
            <span className="text-xs text-muted-foreground shrink-0">
              {filteredMessages.length} resultado{filteredMessages.length !== 1 ? 's' : ''}
            </span>
          )}
          <Button variant="ghost" size="icon" className="h-7 w-7 shrink-0" onClick={() => { setSearchOpen(false); setSearchQuery(''); }}>
            <X className="w-3.5 h-3.5" />
          </Button>
        </div>
      )}

      {/* Messages area */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto p-4" onScroll={handleScroll}>
        {loadingMore && (
          <div className="flex justify-center py-2">
            <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
          </div>
        )}
        {loading ? (
          <div className="flex items-center justify-center h-full">
            <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
          </div>
        ) : filteredMessages.length === 0 ? (
          <div className="flex items-center justify-center h-full text-sm text-muted-foreground">
            {searchQuery ? 'Nenhuma mensagem encontrada' : 'Nenhuma mensagem ainda'}
          </div>
        ) : (
          <div className="space-y-2 max-w-3xl mx-auto">
            {filteredMessages.map((msg) => (
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
                status={msg.status}
                onReply={handleReply}
                onReact={handleReact}
                onForward={handleForward}
                onDownload={handleDownload}
                onPin={handlePin}
                onFavorite={handleFavorite}
                onStartChat={onStartNewChat}
              />
            ))}
          </div>
        )}
      </div>

      {/* Disconnected chip banner */}
      {chipDisconnected && (
        <div className="flex items-center justify-center gap-3 px-4 py-3 bg-destructive/10 border-t border-destructive/20">
          <WifiOff className="w-5 h-5 text-destructive shrink-0" />
          <span className="text-sm text-destructive font-medium">Este chip está desconectado</span>
          <Button
            size="sm"
            variant="outline"
            className="h-7 text-xs border-destructive/30 text-destructive hover:bg-destructive/10"
            onClick={async () => {
              if (!chipId) return;
              try {
                await supabase.functions.invoke('uazapi-api', {
                  body: { action: 'connect-instance', chipId },
                });
                toast({ title: 'Reconectando...', description: 'Aguarde alguns segundos.' });
                setChipDisconnected(false);
                // Retry sending the failed message after a short delay
                if (failedMessage) {
                  const msg = failedMessage;
                  setFailedMessage(null);
                  setTimeout(() => handleSend(msg), 3000);
                }
              } catch {
                toast({ title: 'Erro ao reconectar', variant: 'destructive' });
              }
            }}
          >
            <RefreshCw className="w-3 h-3 mr-1" />
            Reconectar
          </Button>
          <Button
            size="sm"
            variant="ghost"
            className="h-7 text-xs text-muted-foreground"
            onClick={() => { setChipDisconnected(false); setFailedMessage(null); }}
          >
            Cancelar
          </Button>
        </div>
      )}

      {/* Input area - disabled when chip is offline */}
      {chipStatus && chipStatus !== 'connected' ? (
        <div className="flex items-center justify-center gap-3 px-4 py-3 bg-muted/50 border-t border-border/50">
          <WifiOff className="w-4 h-4 text-muted-foreground shrink-0" />
          <span className="text-sm text-muted-foreground">Reconecte para atualizar conversas e enviar mensagens</span>
          {onReconnect && (
            <Button size="sm" variant="outline" className="h-7 text-xs" onClick={onReconnect}>
              <RefreshCw className="w-3 h-3 mr-1" />
              Reconectar
            </Button>
          )}
        </div>
      ) : (
        <ChatInput
          onSend={handleSend}
          onSendMedia={handleSendMedia}
          disabled={sending}
          replyTo={replyTo}
          onCancelReply={() => setReplyTo(null)}
          chipId={chipId}
        />
      )}

      <QuickRepliesManager
        open={quickRepliesOpen}
        onOpenChange={setQuickRepliesOpen}
        chipId={chipId}
      />

      <ForwardDialog
        open={!!forwardMsg}
        onClose={() => setForwardMsg(null)}
        message={forwardMsg}
        chipId={chipId}
      />

      {/* Reaction picker overlay */}
      <Dialog open={!!reactMsg} onOpenChange={(open) => !open && setReactMsg(null)}>
        <DialogContent className="sm:max-w-xs">
          <DialogHeader>
            <DialogTitle>Reagir à mensagem</DialogTitle>
          </DialogHeader>
          <div className="flex justify-center gap-2 py-4">
            {QUICK_EMOJIS.map((emoji) => (
              <button
                key={emoji}
                onClick={() => handleReactEmoji(emoji)}
                className="text-2xl hover:scale-125 transition-transform p-2 rounded-lg hover:bg-muted"
              >
                {emoji}
              </button>
            ))}
          </div>
        </DialogContent>
      </Dialog>

    </div>
    {/* Notes panel */}
    {chipId && chat && (
      <ConversationNotes
        chipId={chipId}
        remoteJid={chat.remoteJid}
        open={notesOpen}
        onClose={() => setNotesOpen(false)}
      />
    )}
    </div>
  );
}
