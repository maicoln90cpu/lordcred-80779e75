import { useState, useEffect, useRef, useCallback } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { MessageSquare, Loader2, Search, X, WifiOff, RefreshCw, StickyNote, Zap, ClipboardList, UserCheck } from 'lucide-react';
import ChatInput from './ChatInput';
import MessageBubble from './MessageBubble';
import ForwardDialog from './ForwardDialog';
import AssignConversationBanner from './AssignConversationBanner';
import ConversationAuditPanel from './ConversationAuditPanel';
import { type MessageData } from './MessageContextMenu';
import { supabase } from '@/integrations/supabase/client';
import { invokeUazapiWithRetry } from '@/lib/invokeEdgeWithRetry';
import { cn } from '@/lib/utils';
import { useToast } from '@/hooks/use-toast';
import { Input } from '@/components/ui/input';
import ConversationNotes from './ConversationNotes';
import QuickRepliesManager from './QuickRepliesManager';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import type { ChatContact } from '@/pages/WhatsApp';
import { useChatMessages } from '@/hooks/useChatMessages';

interface ChatWindowProps {
  chat: ChatContact | null;
  chipId: string | null;
  chipStatus?: string;
  onReconnect?: () => void;
  onStartNewChat?: (phone: string) => void;
  readOnly?: boolean;
}

const QUICK_EMOJIS = ['👍', '❤️', '😂', '😮', '😢', '🙏'];

export default function ChatWindow({ chat, chipId, chipStatus, onReconnect, onStartNewChat, readOnly = false }: ChatWindowProps) {
  const { user } = useAuth();
  const { toast } = useToast();
  const scrollRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);

  const [replyTo, setReplyTo] = useState<MessageData | null>(null);
  const [forwardMsg, setForwardMsg] = useState<MessageData | null>(null);
  const [reactMsg, setReactMsg] = useState<MessageData | null>(null);
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [notesOpen, setNotesOpen] = useState(false);
  const [auditOpen, setAuditOpen] = useState(false);
  const [quickRepliesOpen, setQuickRepliesOpen] = useState(false);
  const [sharedBlockInfo, setSharedBlockInfo] = useState<{ isShared: boolean; blockSend: boolean; assignedUserId: string | null; assignedName: string | null }>({ isShared: false, blockSend: false, assignedUserId: null, assignedName: null });

  const {
    messages, loading, loadingMore, sending,
    chipDisconnected, setChipDisconnected, failedMessage, setFailedMessage,
    handleSend, handleSendMedia, loadOlderMessages,
  } = useChatMessages({ chipId, chat });

  // Reset replyTo on chat change
  useEffect(() => { setReplyTo(null); }, [chat?.remoteJid]);

  // Shared chip block-send check
  useEffect(() => {
    if (!chipId || !chat) { setSharedBlockInfo({ isShared: false, blockSend: false, assignedUserId: null, assignedName: null }); return; }
    const check = async () => {
      const [chipRes, convRes] = await Promise.all([
        supabase.from('chips').select('is_shared, shared_block_send').eq('id', chipId).single(),
        supabase.from('conversations').select('assigned_user_id').eq('id', chat.id).single(),
      ]);
      const isShared = chipRes.data?.is_shared || false;
      const blockSend = (chipRes.data as any)?.shared_block_send || false;
      const assignedUid = convRes.data?.assigned_user_id || null;
      let assignedName: string | null = null;
      if (assignedUid && assignedUid !== user?.id) {
        const { data: prof } = await supabase.from('profiles').select('name').eq('user_id', assignedUid).single();
        assignedName = prof?.name || 'Outro operador';
      }
      setSharedBlockInfo({ isShared, blockSend, assignedUserId: assignedUid, assignedName });
    };
    check();

    const ch = supabase.channel(`block-check-${chat.id}`)
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'conversations', filter: `id=eq.${chat.id}` }, (payload) => {
        const newUid = (payload.new as any)?.assigned_user_id || null;
        setSharedBlockInfo(prev => ({ ...prev, assignedUserId: newUid }));
        if (newUid && newUid !== user?.id) {
          supabase.from('profiles').select('name').eq('user_id', newUid).single().then(({ data }) => {
            setSharedBlockInfo(prev => ({ ...prev, assignedName: data?.name || 'Outro operador' }));
          });
        } else {
          setSharedBlockInfo(prev => ({ ...prev, assignedName: null }));
        }
      }).subscribe();

    return () => { supabase.removeChannel(ch); };
  }, [chipId, chat?.id, user?.id]);

  // Auto-scroll
  useEffect(() => { if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight; }, [messages]);

  const handleScroll = useCallback(() => { loadOlderMessages(scrollRef); }, [loadOlderMessages]);

  // Context menu handlers
  const handleReply = useCallback((msg: MessageData) => setReplyTo(msg), []);
  const handleReact = useCallback((msg: MessageData) => setReactMsg(msg), []);
  const handleForward = useCallback((msg: MessageData) => setForwardMsg(msg), []);

  const handleReactEmoji = useCallback(async (emoji: string) => {
    if (!reactMsg || !chipId || !chat) return;
    try {
      await invokeUazapiWithRetry({ action: 'react-message', chipId, chatId: chat.remoteJid, messageId: reactMsg.messageId, emoji }, { retries: 1, retryDelayMs: 300 });
      toast({ title: 'Reação enviada', description: emoji });
    } catch { toast({ title: 'Erro', variant: 'destructive' }); }
    setReactMsg(null);
  }, [reactMsg, chipId, chat, toast]);

  const handleDownload = useCallback(async (msg: MessageData) => {
    if (!(msg.messageId && msg.chipId)) return;
    const res = await invokeUazapiWithRetry<{ fileURL?: string }>({ action: 'download-media', chipId: msg.chipId, messageId: msg.messageId }, { retries: 2, retryDelayMs: 400 });
    if (res.data?.fileURL) { window.open(res.data.fileURL, '_blank'); return; }
    toast({ title: 'Erro', description: 'Não foi possível baixar a mídia.', variant: 'destructive' });
  }, [toast]);

  const handlePin = useCallback(async () => {
    if (!chipId || !chat) return;
    try {
      const { data: conv } = await supabase.from('conversations').select('is_pinned').eq('chip_id', chipId).eq('remote_jid', chat.remoteJid).maybeSingle();
      const newVal = !(conv?.is_pinned);
      await supabase.from('conversations').update({ is_pinned: newVal } as any).eq('chip_id', chipId).eq('remote_jid', chat.remoteJid);
      toast({ title: newVal ? '📌 Conversa fixada' : 'Conversa desafixada' });
    } catch { toast({ title: 'Erro ao fixar conversa', variant: 'destructive' }); }
  }, [chipId, chat, toast]);

  const handleFavorite = useCallback(async (msg: MessageData) => {
    if (!chipId || !chat) return;
    try {
      const { data: { user: u } } = await supabase.auth.getUser();
      if (!u) return;
      const { data: existing } = await supabase.from('message_favorites').select('id').eq('user_id', u.id).eq('message_id', msg.messageId || msg.id).maybeSingle();
      if (existing) { await supabase.from('message_favorites').delete().eq('id', existing.id); toast({ title: 'Removido dos favoritos' }); }
      else { await supabase.from('message_favorites').insert({ user_id: u.id, chip_id: chipId, message_id: msg.messageId || msg.id, remote_jid: chat.remoteJid, message_text: msg.text || '' }); toast({ title: '⭐ Mensagem favoritada' }); }
    } catch { toast({ title: 'Erro', variant: 'destructive' }); }
  }, [chipId, chat, toast]);

  const formatTime = (dateStr: string) => {
    try { return new Date(dateStr).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }); }
    catch { return ''; }
  };

  if (!chat) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-muted-foreground bg-gradient-to-br from-background to-muted/20">
        <div className="w-24 h-24 rounded-2xl bg-gradient-to-br from-primary/20 to-primary/5 flex items-center justify-center mb-5 shadow-lg shadow-primary/5">
          <MessageSquare className="w-12 h-12 opacity-40" />
        </div>
        <h3 className="text-lg font-semibold mb-1.5 tracking-tight">LordCred</h3>
        <p className="text-sm text-muted-foreground/70">Selecione uma conversa para começar</p>
      </div>
    );
  }

  const filteredMessages = searchQuery ? messages.filter(m => m.text.toLowerCase().includes(searchQuery.toLowerCase())) : messages;

  return (
    <div className="flex h-full">
    <div className="flex flex-col flex-1 min-w-0">
      {/* Header */}
      <div className="flex items-center gap-3 px-4 py-3 border-b border-border/30 bg-gradient-to-r from-card/80 to-card/60 backdrop-blur-sm shadow-sm">
        <div className="relative">
          {chat.profilePicUrl ? (
            <img src={chat.profilePicUrl} alt="" className="w-10 h-10 rounded-full object-cover ring-2 ring-primary/20" onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; (e.target as HTMLImageElement).nextElementSibling?.classList.remove('hidden'); }} />
          ) : null}
          <div className={cn("w-10 h-10 rounded-full bg-gradient-to-br from-primary/30 to-primary/10 flex items-center justify-center ring-2 ring-primary/20", chat.profilePicUrl && "hidden")}>
            <span className="text-sm font-semibold text-primary">{chat.name.charAt(0).toUpperCase()}</span>
          </div>
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-base font-bold tracking-tight">{chat.name}</p>
          <p className="text-sm text-muted-foreground/70">{chat.phone}</p>
        </div>
        <div className="flex items-center gap-0.5">
          <Button variant="ghost" size="icon" onClick={() => setQuickRepliesOpen(true)} className="text-muted-foreground hover:text-primary hover:bg-primary/10" title="Respostas rápidas"><Zap className="w-4 h-4" /></Button>
          <Button variant="ghost" size="icon" onClick={() => setNotesOpen(!notesOpen)} className={cn("text-muted-foreground hover:text-primary hover:bg-primary/10", notesOpen && "text-primary bg-primary/10")} title="Notas internas"><StickyNote className="w-4 h-4" /></Button>
          <Button variant="ghost" size="icon" onClick={() => setAuditOpen(!auditOpen)} className={cn("text-muted-foreground hover:text-primary hover:bg-primary/10", auditOpen && "text-primary bg-primary/10")} title="Auditoria"><ClipboardList className="w-4 h-4" /></Button>
          <Button variant="ghost" size="icon" onClick={() => { setSearchOpen(!searchOpen); setSearchQuery(''); setTimeout(() => searchInputRef.current?.focus(), 100); }} className="text-muted-foreground hover:text-primary hover:bg-primary/10"><Search className="w-4 h-4" /></Button>
        </div>
      </div>

      {chipId && chat && <AssignConversationBanner chipId={chipId} conversationId={chat.id} remoteJid={chat.remoteJid} />}

      {searchOpen && (
        <div className="flex items-center gap-2 px-4 py-2 border-b border-border/50 bg-card/30">
          <Search className="w-4 h-4 text-muted-foreground shrink-0" />
          <Input ref={searchInputRef} placeholder="Buscar nas mensagens..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} className="h-8 text-sm bg-transparent border-0 focus-visible:ring-0" />
          {searchQuery && <span className="text-xs text-muted-foreground shrink-0">{filteredMessages.length} resultado{filteredMessages.length !== 1 ? 's' : ''}</span>}
          <Button variant="ghost" size="icon" className="h-7 w-7 shrink-0" onClick={() => { setSearchOpen(false); setSearchQuery(''); }}><X className="w-3.5 h-3.5" /></Button>
        </div>
      )}

      {/* Messages */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 bg-gradient-to-b from-muted/40 via-background to-muted/20 dark:from-[hsl(222,47%,9%)] dark:via-[hsl(222,47%,11%)] dark:to-[hsl(222,47%,13%)]" onScroll={handleScroll}>
        {loadingMore && <div className="flex justify-center py-2"><Loader2 className="w-5 h-5 animate-spin text-muted-foreground" /></div>}
        {loading ? (
          <div className="flex items-center justify-center h-full"><Loader2 className="w-6 h-6 animate-spin text-muted-foreground" /></div>
        ) : filteredMessages.length === 0 ? (
          <div className="flex items-center justify-center h-full text-sm text-muted-foreground">{searchQuery ? 'Nenhuma mensagem encontrada' : 'Nenhuma mensagem ainda'}</div>
        ) : (
          <div className="space-y-2 max-w-5xl mx-auto">
            {filteredMessages.map((msg) => {
              let quotedText: string | undefined, quotedSender: string | undefined, quotedFromMe: boolean | undefined;
              if (msg.quotedMessageId) {
                const quoted = messages.find(m => m.messageId === msg.quotedMessageId);
                if (quoted) { quotedText = quoted.text || (quoted.mediaType ? `📎 ${quoted.mediaType}` : undefined); quotedSender = quoted.fromMe ? 'Você' : (quoted.senderName || chat?.name || ''); quotedFromMe = quoted.fromMe; }
                else { quotedText = 'Mensagem citada'; quotedSender = ''; }
              }
              return (
                <MessageBubble key={msg.id} text={msg.text} time={formatTime(msg.timestamp)} fromMe={msg.fromMe}
                  messageType={msg.messageType} mediaType={msg.mediaType} hasMedia={msg.hasMedia}
                  messageId={msg.messageId} chipId={chipId || undefined} senderName={msg.senderName}
                  isGroup={chat?.isGroup} status={msg.status} onReply={handleReply} onReact={handleReact}
                  onForward={handleForward} onDownload={handleDownload} onPin={handlePin} onFavorite={handleFavorite}
                  onStartChat={onStartNewChat} quotedText={quotedText} quotedSender={quotedSender}
                  quotedFromMe={quotedFromMe} sentByUserName={msg.sentByUserName}
                  onQuotedClick={msg.quotedMessageId ? () => {
                    const el = scrollRef.current?.querySelector(`[data-message-id="${msg.quotedMessageId}"]`);
                    if (el) { el.scrollIntoView({ behavior: 'smooth', block: 'center' }); el.classList.add('ring-2', 'ring-primary/50'); setTimeout(() => el.classList.remove('ring-2', 'ring-primary/50'), 2000); }
                  } : undefined}
                />
              );
            })}
          </div>
        )}
      </div>

      {/* Disconnected banner */}
      {chipDisconnected && (
        <div className="flex items-center justify-center gap-3 px-4 py-3 bg-destructive/10 border-t border-destructive/20">
          <WifiOff className="w-5 h-5 text-destructive shrink-0" />
          <span className="text-sm text-destructive font-medium">Este chip está desconectado</span>
          <Button size="sm" variant="outline" className="h-7 text-xs border-destructive/30 text-destructive hover:bg-destructive/10"
            onClick={async () => {
              if (!chipId) return;
              try {
                await invokeUazapiWithRetry({ action: 'connect-instance', chipId }, { retries: 1, retryDelayMs: 500 });
                toast({ title: 'Reconectando...', description: 'Aguarde alguns segundos.' });
                setChipDisconnected(false);
                if (failedMessage) { const msg = failedMessage; setFailedMessage(null); setTimeout(() => handleSend(msg), 3000); }
              } catch { toast({ title: 'Erro ao reconectar', variant: 'destructive' }); }
            }}>
            <RefreshCw className="w-3 h-3 mr-1" />Reconectar
          </Button>
          <Button size="sm" variant="ghost" className="h-7 text-xs text-muted-foreground" onClick={() => { setChipDisconnected(false); setFailedMessage(null); }}>Cancelar</Button>
        </div>
      )}

      {/* Input */}
      {readOnly ? (
        <div className="flex items-center justify-center gap-2 px-4 py-3 bg-muted/50 border-t border-border/50">
          <span className="text-sm text-muted-foreground">Modo somente leitura — não é possível enviar mensagens</span>
        </div>
      ) : sharedBlockInfo.isShared && sharedBlockInfo.blockSend && sharedBlockInfo.assignedUserId && sharedBlockInfo.assignedUserId !== user?.id ? (
        <div className="flex items-center justify-center gap-2 px-4 py-3 bg-destructive/5 border-t border-destructive/20">
          <UserCheck className="w-4 h-4 text-destructive/70 shrink-0" />
          <span className="text-sm text-destructive/80">Esta conversa está sendo atendida por <strong>{sharedBlockInfo.assignedName}</strong></span>
        </div>
      ) : chipStatus && chipStatus !== 'connected' ? (
        <div className="flex items-center justify-center gap-3 px-4 py-3 bg-muted/50 border-t border-border/50">
          <WifiOff className="w-4 h-4 text-muted-foreground shrink-0" />
          <span className="text-sm text-muted-foreground">Reconecte para atualizar conversas e enviar mensagens</span>
          {onReconnect && <Button size="sm" variant="outline" className="h-7 text-xs" onClick={onReconnect}><RefreshCw className="w-3 h-3 mr-1" />Reconectar</Button>}
        </div>
      ) : (
        <ChatInput onSend={handleSend} onSendMedia={handleSendMedia} disabled={sending} replyTo={replyTo} onCancelReply={() => setReplyTo(null)} chipId={chipId} />
      )}

      <QuickRepliesManager open={quickRepliesOpen} onOpenChange={setQuickRepliesOpen} chipId={chipId} />
      <ForwardDialog open={!!forwardMsg} onClose={() => setForwardMsg(null)} message={forwardMsg} chipId={chipId} />

      <Dialog open={!!reactMsg} onOpenChange={(open) => !open && setReactMsg(null)}>
        <DialogContent className="sm:max-w-xs">
          <DialogHeader><DialogTitle>Reagir à mensagem</DialogTitle></DialogHeader>
          <div className="flex justify-center gap-2 py-4">
            {QUICK_EMOJIS.map(emoji => (
              <button key={emoji} onClick={() => handleReactEmoji(emoji)} className="text-2xl hover:scale-125 transition-transform p-2 rounded-lg hover:bg-muted">{emoji}</button>
            ))}
          </div>
        </DialogContent>
      </Dialog>
    </div>

    {chipId && chat && <ConversationNotes chipId={chipId} remoteJid={chat.remoteJid} open={notesOpen} onClose={() => setNotesOpen(false)} />}
    {chat && <ConversationAuditPanel conversationId={chat.id} open={auditOpen} onClose={() => setAuditOpen(false)} />}
    </div>
  );
}
