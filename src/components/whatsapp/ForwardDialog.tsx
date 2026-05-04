import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Search, Send, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { supabase } from '@/integrations/supabase/client';
import { getCachedChats } from '@/hooks/useMessageCache';
import type { ChatContact } from '@/pages/WhatsApp';
import type { MessageData } from './MessageContextMenu';

interface ForwardDialogProps {
  open: boolean;
  onClose: () => void;
  message: MessageData | null;
  chipId: string | null;
}

export default function ForwardDialog({ open, onClose, message, chipId }: ForwardDialogProps) {
  const [search, setSearch] = useState('');
  const [contacts, setContacts] = useState<ChatContact[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [sending, setSending] = useState(false);

  useEffect(() => {
    if (!open || !chipId) return;
    const cached = getCachedChats(chipId);
    if (cached && cached.length > 0) {
      setContacts(cached);
    }
    setSelected(new Set());
    setSearch('');
  }, [open, chipId]);

  const filtered = contacts.filter(c =>
    c.name.toLowerCase().includes(search.toLowerCase()) ||
    c.phone.includes(search)
  );

  const toggleSelect = (jid: string) => {
    setSelected(prev => {
      const next = new Set(prev);
      if (next.has(jid)) next.delete(jid); else next.add(jid);
      return next;
    });
  };

  const handleForward = async () => {
    if (!message || !chipId || selected.size === 0) return;
    setSending(true);
    try {
      // Etapa 6: roteia pelo gateway unificado (UazAPI ou Meta).
      // Backend Meta espera sourceMessageId; UazAPI aceita ambos.
      const promises = Array.from(selected).map(jid =>
        supabase.functions.invoke('whatsapp-gateway', {
          body: {
            action: 'forward-message',
            chipId,
            chatId: jid,
            sourceMessageId: message.messageId,
            messageId: message.messageId, // compat UazAPI
            text: message.text,
            mediaType: message.mediaType || '',
            hasMedia: !!message.hasMedia,
          },
        })
      );
      const results = await Promise.allSettled(promises);
      const unsupported = results.find(
        (r) => r.status === 'fulfilled' && (r.value as any)?.data?.unsupported
      );
      if (unsupported) {
        const msg = (unsupported as any).value?.data?.error || 'Função indisponível na Meta';
        // toast lazy import to avoid hook in this file
        const { toast } = await import('sonner');
        toast(msg);
      }
      onClose();
    } catch (e) {
      console.error('Forward error:', e);
    } finally {
      setSending(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Encaminhar mensagem</DialogTitle>
        </DialogHeader>
        <div className="relative mb-3">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Buscar contato..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
        <ScrollArea className="h-[300px]">
          {filtered.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-4">Nenhum contato</p>
          ) : (
            <div className="space-y-1">
              {filtered.map(c => (
                <button
                  key={c.remoteJid}
                  onClick={() => toggleSelect(c.remoteJid)}
                  className={cn(
                    "w-full flex items-center gap-3 px-3 py-2 rounded-lg text-left transition-colors",
                    selected.has(c.remoteJid) ? "bg-primary/20" : "hover:bg-secondary/50"
                  )}
                >
                  <div className="w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center shrink-0">
                    <span className="text-xs font-medium text-primary">{c.name.charAt(0).toUpperCase()}</span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{c.name}</p>
                    <p className="text-xs text-muted-foreground">{c.phone}</p>
                  </div>
                  {selected.has(c.remoteJid) && (
                    <div className="w-5 h-5 rounded-full bg-primary flex items-center justify-center">
                      <span className="text-[10px] text-primary-foreground">✓</span>
                    </div>
                  )}
                </button>
              ))}
            </div>
          )}
        </ScrollArea>
        <div className="flex justify-end gap-2 pt-2">
          <Button variant="outline" size="sm" onClick={onClose}>Cancelar</Button>
          <Button size="sm" onClick={handleForward} disabled={selected.size === 0 || sending}>
            {sending ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : <Send className="w-4 h-4 mr-1" />}
            Encaminhar {selected.size > 0 && `(${selected.size})`}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}