import { useState, useEffect } from 'react';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Button } from '@/components/ui/button';
import { Star, Trash2, MessageSquare } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import type { ChatContact } from '@/pages/WhatsApp';

interface FavoriteItem {
  id: string;
  chip_id: string;
  message_id: string;
  remote_jid: string;
  message_text: string | null;
  created_at: string;
}

interface FavoritesPanelProps {
  open: boolean;
  onClose: () => void;
  chipId: string | null;
  onOpenChat?: (chat: ChatContact) => void;
}

export default function FavoritesPanel({ open, onClose, chipId, onOpenChat }: FavoritesPanelProps) {
  const [favorites, setFavorites] = useState<FavoriteItem[]>([]);
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    if (!open) return;
    setLoading(true);
    const fetchFavorites = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const query = supabase
        .from('message_favorites')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });
      if (chipId) query.eq('chip_id', chipId);
      const { data } = await query;
      setFavorites(data || []);
      setLoading(false);
    };
    fetchFavorites();
  }, [open, chipId]);

  const handleRemove = async (id: string) => {
    await supabase.from('message_favorites').delete().eq('id', id);
    setFavorites(prev => prev.filter(f => f.id !== id));
    toast({ title: 'Favorito removido' });
  };

  const handleOpenChat = (fav: FavoriteItem) => {
    if (!onOpenChat) return;
    const phone = fav.remote_jid.split('@')[0];
    onOpenChat({
      id: fav.remote_jid,
      remoteJid: fav.remote_jid,
      name: phone,
      phone,
      lastMessage: '',
      lastMessageAt: null,
      unreadCount: 0,
      isGroup: fav.remote_jid.includes('@g.us'),
    });
  };

  const grouped = favorites.reduce<Record<string, FavoriteItem[]>>((acc, fav) => {
    const key = fav.remote_jid;
    if (!acc[key]) acc[key] = [];
    acc[key].push(fav);
    return acc;
  }, {});

  return (
    <Sheet open={open} onOpenChange={(o) => !o && onClose()}>
      <SheetContent className="w-[400px] sm:w-[450px]">
        <SheetHeader>
          <SheetTitle className="flex items-center gap-2">
            <Star className="w-5 h-5 text-yellow-500" />
            Mensagens Favoritadas
          </SheetTitle>
        </SheetHeader>
        <ScrollArea className="h-[calc(100vh-100px)] mt-4">
          {loading ? (
            <p className="text-sm text-muted-foreground text-center py-8">Carregando...</p>
          ) : favorites.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-8">Nenhuma mensagem favoritada</p>
          ) : (
            <div className="space-y-4">
              {Object.entries(grouped).map(([jid, items]) => (
                <div key={jid} className="space-y-2">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-medium text-muted-foreground truncate">{jid.split('@')[0]}</span>
                    <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => handleOpenChat(items[0])}>
                      <MessageSquare className="w-3 h-3" />
                    </Button>
                  </div>
                  {items.map(fav => (
                    <div key={fav.id} className="flex items-start gap-2 p-2 rounded-md bg-secondary/50">
                      <p className="flex-1 text-sm break-words">{fav.message_text || '(mídia)'}</p>
                      <div className="flex flex-col items-end gap-1 shrink-0">
                        <span className="text-[10px] text-muted-foreground">
                          {new Date(fav.created_at).toLocaleDateString('pt-BR')}
                        </span>
                        <Button variant="ghost" size="icon" className="h-6 w-6 text-destructive" onClick={() => handleRemove(fav.id)}>
                          <Trash2 className="w-3 h-3" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              ))}
            </div>
          )}
        </ScrollArea>
      </SheetContent>
    </Sheet>
  );
}
