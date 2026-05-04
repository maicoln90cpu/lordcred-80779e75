import { useState, useEffect, useRef, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { invokeUazapiWithRetry, isDisconnectError } from '@/lib/invokeEdgeWithRetry';
import { getCachedMessages, setCachedMessages, addMessageToCache } from '@/hooks/useMessageCache';
import { useToast } from '@/hooks/use-toast';
import type { ChatContact } from '@/pages/WhatsApp';

export interface ChatMessage {
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
  quotedMessageId?: string;
  sentByUserName?: string;
}

interface UseChatMessagesOptions {
  chipId: string | null;
  chat: ChatContact | null;
}

export function useChatMessages({ chipId, chat }: UseChatMessagesOptions) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [sending, setSending] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const [chipDisconnected, setChipDisconnected] = useState(false);
  const [failedMessage, setFailedMessage] = useState<string | null>(null);
  const [senderNames, setSenderNames] = useState<Record<string, string>>({});

  const activeChipRef = useRef(chipId);
  const activeChatRef = useRef(chat?.remoteJid);
  const lastMarkReadAtRef = useRef<Record<string, number>>({});
  const { toast } = useToast();

  useEffect(() => { activeChipRef.current = chipId; }, [chipId]);
  useEffect(() => { activeChatRef.current = chat?.remoteJid; }, [chat?.remoteJid]);
  useEffect(() => { setChipDisconnected(false); setFailedMessage(null); }, [chipId]);

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
    quotedMessageId: r.quoted_message_id || undefined,
    sentByUserName: r.sent_by_user_id ? (senderNames[r.sent_by_user_id] || undefined) : undefined,
  }), [senderNames]);

  const resolveSenderNames = useCallback(async (rows: any[]) => {
    const userIds = [...new Set(rows.filter(r => r.sent_by_user_id).map(r => r.sent_by_user_id))];
    const missing = userIds.filter(id => !senderNames[id]);
    if (missing.length === 0) return;
    const { data: profiles } = await supabase.from('profiles').select('user_id, name').in('user_id', missing);
    if (profiles) {
      setSenderNames(prev => {
        const next = { ...prev };
        profiles.forEach(p => { next[p.user_id] = p.name || 'Usuário'; });
        return next;
      });
    }
  }, [senderNames]);

  const getJidsToSearch = useCallback(() => {
    if (!chat) return [];
    const jids = [chat.remoteJid];
    if (chat.remoteJid.includes('@lid') && chat.phone) {
      const cleanPhone = chat.phone.replace(/\D/g, '');
      if (cleanPhone.length >= 10) jids.push(`${cleanPhone}@s.whatsapp.net`);
    }
    if (chat.alternateJid && !jids.includes(chat.alternateJid)) jids.push(chat.alternateJid);
    return jids;
  }, [chat?.remoteJid, chat?.alternateJid, chat?.phone]);

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
      const from = (pageNum - 1) * PAGE_SIZE;
      const to = from + PAGE_SIZE - 1;
      const jidsToSearch = getJidsToSearch();

      const { data: dbMessages, error } = await supabase
        .from('message_history').select('*')
        .eq('chip_id', requestChipId).in('remote_jid', jidsToSearch)
        .order('created_at', { ascending: false }).range(from, to);

      if (activeChipRef.current !== requestChipId || activeChatRef.current !== requestChatJid) return;
      if (error) { console.error('Error fetching messages:', error); return; }

      if (dbMessages) resolveSenderNames(dbMessages);
      const mapped = (dbMessages || []).map(mapDbRow).reverse();
      if (mapped.length < PAGE_SIZE) setHasMore(false);

      if (pageNum === 1 && !append) {
        setMessages(mapped);
        setCachedMessages(requestChipId, requestChatJid, mapped);
      } else if (append && mapped.length > 0) {
        setMessages(prev => {
          const existingIds = new Set(prev.map(m => m.id));
          return [...mapped.filter(m => !existingIds.has(m.id)), ...prev];
        });
      }
    } catch (error) {
      console.error('Error fetching messages:', error);
    } finally {
      if (activeChipRef.current === chipId && activeChatRef.current === chat?.remoteJid) {
        setLoading(false);
        setLoadingMore(false);
      }
    }
  }, [chipId, chat?.remoteJid, mapDbRow, getJidsToSearch, resolveSenderNames]);

  // Reset on chat change
  useEffect(() => {
    if (chat) { setCurrentPage(1); setHasMore(true); fetchMessages(); }
    else setMessages([]);
  }, [fetchMessages, chat?.remoteJid]);

  // Mark as read
  const markReadTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const markRead = useCallback((cId: string, cJid: string) => {
    if (markReadTimer.current) clearTimeout(markReadTimer.current);
    markReadTimer.current = setTimeout(async () => {
      const key = `${cId}:${cJid}`;
      const now = Date.now();
      if (now - (lastMarkReadAtRef.current[key] || 0) < 4000) return;
      lastMarkReadAtRef.current[key] = now;
      await invokeUazapiWithRetry({ action: 'mark-read', chipId: cId, chatId: cJid }, { retries: 1, retryDelayMs: 300 });
    }, 500);
  }, []);

  useEffect(() => {
    if (chipId && chat) markRead(chipId, chat.remoteJid);
  }, [chipId, chat?.remoteJid, markRead]);

  // Realtime
  useEffect(() => {
    if (!chipId || !chat) return;
    const matchJids = getJidsToSearch();

    const channel = supabase
      .channel(`messages-${chat.remoteJid}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'message_history', filter: `chip_id=eq.${chipId}` }, (payload) => {
        const record = payload.new as any;
        if (!record || !matchJids.includes(record.remote_jid)) return;
        const newMsg: ChatMessage = {
          id: record.id, text: typeof record.message_content === 'string' ? record.message_content : '',
          fromMe: record.direction === 'outgoing', timestamp: record.created_at,
          senderName: record.sender_name || '', messageType: record.media_type || 'text',
          mediaType: record.media_type || undefined,
          hasMedia: !!(record.media_type && record.media_type !== 'text' && record.media_type !== 'chat' && record.media_type !== 'url'),
          messageId: record.message_id || undefined, status: record.status || 'sent',
          quotedMessageId: record.quoted_message_id || undefined,
        };
        if (!newMsg.fromMe && chipId) markRead(chipId, chat.remoteJid);
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
      })
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'message_history', filter: `chip_id=eq.${chipId}` }, (payload) => {
        const record = payload.new as any;
        if (!record || !matchJids.includes(record.remote_jid)) return;
        if (record.status === 'deleted') {
          setMessages(prev => prev.filter(m => m.id !== record.id && m.messageId !== record.message_id));
          return;
        }
        setMessages(prev => prev.map(m =>
          (m.id === record.id || (m.messageId && m.messageId === record.message_id))
            ? { ...m, status: record.status || m.status, text: record.message_content || m.text } : m
        ));
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [chipId, chat?.remoteJid, getJidsToSearch, markRead]);

  // Send helpers
  const checkChipConnected = useCallback(async (): Promise<boolean> => {
    if (!chipId) return false;
    const { data } = await supabase.from('chips').select('status').eq('id', chipId).maybeSingle();
    return data?.status === 'connected';
  }, [chipId]);

  const reconcileMessage = useCallback(async (cId: string, remoteJid: string, sentAfter: string): Promise<boolean> => {
    await new Promise(r => setTimeout(r, 3000));
    const { data } = await supabase.from('message_history').select('id')
      .eq('chip_id', cId).eq('remote_jid', remoteJid).eq('direction', 'outgoing')
      .gte('created_at', sentAfter).limit(1);
    return !!(data && data.length > 0);
  }, []);

  const handleSend = useCallback(async (text: string) => {
    if (!chipId || !chat || !text.trim()) return;
    const connected = await checkChipConnected();
    if (!connected) { setChipDisconnected(true); setFailedMessage(text); return; }

    setSending(true);
    const sentAt = new Date().toISOString();
    const tempMsg: ChatMessage = { id: `temp-${Date.now()}`, text, fromMe: true, timestamp: sentAt, senderName: '', messageType: 'text', status: 'pending' };
    setMessages(prev => [...prev, tempMsg]);

    let shouldRemoveTemp = false;
    try {
      void invokeUazapiWithRetry({ action: 'send-presence', chipId, chatId: chat.remoteJid, presence: 'composing' }, { retries: 0, retryDelayMs: 0 });
      const response = await invokeUazapiWithRetry<{ success?: boolean; error?: string; windowClosed?: boolean }>(
        { action: 'send-chat-message', chipId, chatId: chat.remoteJid, message: text }, { retries: 2, retryDelayMs: 400 }
      );
      if (isDisconnectError(response)) { setChipDisconnected(true); setFailedMessage(text); shouldRemoveTemp = true; return; }
      if (response.isTransportError) {
        const delivered = await reconcileMessage(chipId, chat.remoteJid, sentAt);
        if (!delivered) { toast({ title: 'Instabilidade temporária', description: 'A mensagem pode não ter sido enviada.', variant: 'destructive' }); shouldRemoveTemp = true; }
        return;
      }
      if (response.error) { toast({ title: 'Erro ao enviar', description: String(response.error?.message || response.error), variant: 'destructive' }); shouldRemoveTemp = true; return; }
      if (!response.data?.success) {
        const errMsg = response.data?.error || '';
        if (errMsg.toLowerCase().includes('not on whatsapp')) { toast({ title: 'Número inválido', description: 'Este número não está registrado no WhatsApp', variant: 'destructive' }); shouldRemoveTemp = true; }
        else if ((response.data as any)?.windowClosed) { toast({ title: 'Janela expirada', description: errMsg, variant: 'destructive' }); shouldRemoveTemp = true; }
        else if (errMsg) { toast({ title: 'Erro ao enviar', description: errMsg, variant: 'destructive' }); shouldRemoveTemp = true; }
        else { shouldRemoveTemp = true; }
        return;
      }
      // Success — keep temp msg visible until realtime replaces it
      // Fallback: remove after 10s if realtime never arrives
      setTimeout(() => {
        setMessages(prev => prev.filter(m => m.id !== tempMsg.id));
      }, 10000);
    } catch { toast({ title: 'Erro ao enviar mensagem', variant: 'destructive' }); shouldRemoveTemp = true; }
    finally {
      if (shouldRemoveTemp) {
        setMessages(prev => prev.filter(m => m.id !== tempMsg.id));
      }
      setSending(false);
    }
  }, [chipId, chat, checkChipConnected, toast, reconcileMessage]);

  const handleSendMedia = useCallback(async (mediaBase64: string, mediaType: string, caption: string, fileName?: string, mimeType?: string) => {
    if (!chipId || !chat) return;
    const sentAt = new Date().toISOString();
    const tempMsg: ChatMessage = { id: `temp-media-${Date.now()}`, text: caption || `📎 Enviando ${mediaType}...`, fromMe: true, timestamp: sentAt, senderName: '', messageType: mediaType };
    setMessages(prev => [...prev, tempMsg]);

    (async () => {
      try {
        const response = await invokeUazapiWithRetry<{ success?: boolean; error?: string }>(
          { action: 'send-media', chipId, chatId: chat.remoteJid, mediaBase64, mediaType, mediaCaption: caption || undefined, mediaFileName: fileName || undefined, mimeType },
          { retries: 2, retryDelayMs: 500 }
        );
        if (response.isTransportError) {
          const delivered = await reconcileMessage(chipId, chat.remoteJid, sentAt);
          if (!delivered) toast({ title: 'Instabilidade ao enviar mídia', variant: 'destructive' });
          setMessages(prev => prev.filter(m => m.id !== tempMsg.id)); return;
        }
        if (isDisconnectError(response)) {
          setMessages(prev => prev.filter(m => m.id !== tempMsg.id));
          toast({ title: 'Chip desconectado', variant: 'destructive' }); return;
        }
        if (!response.data?.success) {
          setMessages(prev => prev.filter(m => m.id !== tempMsg.id));
          toast({ title: 'Erro ao enviar mídia', description: response.data?.error || '', variant: 'destructive' }); return;
        }
        setMessages(prev => prev.filter(m => m.id !== tempMsg.id));
      } catch {
        setMessages(prev => prev.filter(m => m.id !== tempMsg.id));
        toast({ title: 'Erro ao enviar mídia', variant: 'destructive' });
      }
    })();
  }, [chipId, chat, toast, reconcileMessage]);

  const loadOlderMessages = useCallback((scrollRef: React.RefObject<HTMLDivElement>) => {
    if (loadingMore || !hasMore || !scrollRef.current) return;
    if (scrollRef.current.scrollTop < 100) {
      const nextPage = currentPage + 1;
      setCurrentPage(nextPage);
      const prevHeight = scrollRef.current.scrollHeight;
      fetchMessages(nextPage, true).then(() => {
        if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight - prevHeight;
      });
    }
  }, [loadingMore, hasMore, currentPage, fetchMessages]);

  return {
    messages, setMessages, loading, loadingMore, sending, hasMore,
    chipDisconnected, setChipDisconnected, failedMessage, setFailedMessage,
    senderNames, handleSend, handleSendMedia, loadOlderMessages,
    checkChipConnected, reconcileMessage,
  };
}
