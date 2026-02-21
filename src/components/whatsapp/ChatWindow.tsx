import { useState, useEffect, useRef, useCallback } from 'react';
import { MessageSquare, Loader2, Search, X } from 'lucide-react';
import ChatInput from './ChatInput';
import MessageBubble from './MessageBubble';
import ForwardDialog from './ForwardDialog';
import { type MessageData } from './MessageContextMenu';
import { supabase } from '@/integrations/supabase/client';
import { getCachedMessages, setCachedMessages, addMessageToCache } from '@/hooks/useMessageCache';
import { cn } from '@/lib/utils';
import { useToast } from '@/hooks/use-toast';
import { Input } from '@/components/ui/input';
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
}

const QUICK_EMOJIS = ['👍', '❤️', '😂', '😮', '😢', '🙏'];

export default function ChatWindow({ chat, chipId }: ChatWindowProps) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [sending, setSending] = useState(false);
  const [replyTo, setReplyTo] = useState<MessageData | null>(null);
  const [forwardMsg, setForwardMsg] = useState<MessageData | null>(null);
  const [deleteMsg, setDeleteMsg] = useState<MessageData | null>(null);
  const [reactMsg, setReactMsg] = useState<MessageData | null>(null);
  const [editMsg, setEditMsg] = useState<MessageData | null>(null);
  const [editText, setEditText] = useState('');
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const scrollRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const activeChipRef = useRef(chipId);
  const activeChatRef = useRef(chat?.remoteJid);
  const { toast } = useToast();

  // Keep refs in sync
  useEffect(() => { activeChipRef.current = chipId; }, [chipId]);
  useEffect(() => { activeChatRef.current = chat?.remoteJid; }, [chat?.remoteJid]);

  const mapDbRow = useCallback((r: any): ChatMessage => ({
    id: r.id,
    text: typeof r.message_content === 'string' ? r.message_content : '',
    fromMe: r.direction === 'outgoing',
    timestamp: r.created_at,
    senderName: r.sender_name || '',
    messageType: r.media_type || 'text',
    mediaType: r.media_type || undefined,
    hasMedia: !!(r.media_type && r.media_type !== 'text' && r.media_type !== 'chat'),
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

      const { data: dbMessages, error } = await supabase
        .from('message_history')
        .select('*')
        .eq('chip_id', requestChipId)
        .eq('remote_jid', requestChatJid)
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

  // Mark as read when opening chat - both WhatsApp and DB
  useEffect(() => {
    if (!chipId || !chat) return;
    // Mark read on WhatsApp via UazAPI
    supabase.functions.invoke('uazapi-api', {
      body: { action: 'mark-read', chipId, chatId: chat.remoteJid },
    }).catch(() => {});
    // Update DB immediately
    supabase
      .from('conversations')
      .update({ unread_count: 0 })
      .eq('chip_id', chipId)
      .eq('remote_jid', chat.remoteJid)
      .then(() => {});
  }, [chipId, chat?.remoteJid]);

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
            status: record.status || 'sent',
          };

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
          if (!record || record.remote_jid !== chat.remoteJid) return;
          // Update status of existing message
          setMessages(prev => prev.map(m =>
            (m.id === record.id || (m.messageId && m.messageId === record.message_id))
              ? { ...m, status: record.status || m.status }
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
          action: 'send-media', chipId, chatId: chat.remoteJid,
          mediaBase64, mediaType, mediaCaption: caption || undefined, mediaFileName: fileName || undefined,
        },
      });

      if (!response.data?.success) {
        setMessages(prev => prev.filter(m => m.id !== tempMsg.id));
      }
    } catch (error) {
      console.error('Error sending media:', error);
      setMessages(prev => prev.filter(m => m.id !== tempMsg.id));
    } finally {
      setSending(false);
    }
  }, [chipId, chat]);

  // === CONTEXT MENU HANDLERS ===

  const handleReply = useCallback((msg: MessageData) => setReplyTo(msg), []);
  const handleReact = useCallback((msg: MessageData) => setReactMsg(msg), []);
  const handleForward = useCallback((msg: MessageData) => setForwardMsg(msg), []);
  const handleDelete = useCallback((msg: MessageData) => setDeleteMsg(msg), []);

  const handleEdit = useCallback((msg: MessageData) => {
    setEditMsg(msg);
    setEditText(msg.text || '');
  }, []);

  const confirmEdit = useCallback(async () => {
    if (!editMsg || !chipId || !editText.trim()) return;
    try {
      const res = await supabase.functions.invoke('uazapi-api', {
        body: { action: 'edit-message', chipId, messageId: editMsg.messageId, newText: editText.trim() },
      });
      if (res.data?.success) {
        setMessages(prev => prev.map(m =>
          (m.messageId === editMsg.messageId || m.id === editMsg.id) ? { ...m, text: editText.trim() } : m
        ));
        toast({ title: 'Mensagem editada' });
      } else {
        toast({ title: 'Erro', description: 'Não foi possível editar.', variant: 'destructive' });
      }
    } catch {
      toast({ title: 'Erro', description: 'Falha ao editar mensagem.', variant: 'destructive' });
    }
    setEditMsg(null);
  }, [editMsg, chipId, editText, toast]);

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
      await supabase.functions.invoke('uazapi-api', {
        body: { action: 'pin-chat', chipId, chatId: chat.remoteJid },
      });
      toast({ title: 'Conversa fixada', description: 'A conversa foi fixada/desfixada no topo.' });
    } catch {
      toast({ title: 'Erro', description: 'Não foi possível fixar a conversa.', variant: 'destructive' });
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

  const confirmDelete = useCallback(async () => {
    if (!deleteMsg || !chipId) return;
    try {
      const res = await supabase.functions.invoke('uazapi-api', {
        body: { action: 'delete-message', chipId, messageId: deleteMsg.messageId },
      });
      if (res.data?.success) {
        setMessages(prev => prev.filter(m => m.messageId !== deleteMsg.messageId && m.id !== deleteMsg.id));
        toast({ title: 'Mensagem apagada para todos' });
      } else {
        toast({ title: 'Erro', description: 'Não foi possível apagar.', variant: 'destructive' });
      }
    } catch {
      toast({ title: 'Erro', description: 'Falha ao apagar mensagem.', variant: 'destructive' });
    }
    setDeleteMsg(null);
  }, [deleteMsg, chipId, toast]);

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
    <div className="flex flex-col h-full">
      {/* Chat header */}
      <div className="flex items-center gap-3 px-4 py-3 border-b border-border/50 bg-card/50">
        {chat.profilePicUrl ? (
          <img src={chat.profilePicUrl} alt="" className="w-9 h-9 rounded-full object-cover" onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; (e.target as HTMLImageElement).nextElementSibling?.classList.remove('hidden'); }} />
        ) : null}
        <div className={cn("w-9 h-9 rounded-full bg-primary/20 flex items-center justify-center", chat.profilePicUrl && "hidden")}>
          <span className="text-sm font-medium text-primary">
            {chat.name.charAt(0).toUpperCase()}
          </span>
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium">{chat.name}</p>
          <p className="text-xs text-muted-foreground">{chat.phone}</p>
        </div>
        <Button
          variant="ghost"
          size="icon"
          onClick={() => { setSearchOpen(!searchOpen); setSearchQuery(''); setTimeout(() => searchInputRef.current?.focus(), 100); }}
          className="text-muted-foreground hover:text-foreground"
        >
          <Search className="w-4 h-4" />
        </Button>
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
                onDelete={handleDelete}
                onEdit={handleEdit}
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

      {/* Edit message dialog */}
      <Dialog open={!!editMsg} onOpenChange={(open) => !open && setEditMsg(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Editar mensagem</DialogTitle>
          </DialogHeader>
          <Input
            value={editText}
            onChange={(e) => setEditText(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && confirmEdit()}
            className="mt-2"
          />
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditMsg(null)}>Cancelar</Button>
            <Button onClick={confirmEdit}>Salvar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete confirmation dialog */}
      <AlertDialog open={!!deleteMsg} onOpenChange={(open) => !open && setDeleteMsg(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Apagar mensagem</AlertDialogTitle>
            <AlertDialogDescription>
              Esta ação irá apagar a mensagem para todos os participantes da conversa. Não é possível desfazer.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={confirmDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Apagar para todos
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
