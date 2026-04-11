import { useState, useEffect } from 'react';
import { Bell, Check, CheckCheck } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { ScrollArea } from '@/components/ui/scroll-area';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { cn } from '@/lib/utils';

interface Notification {
  id: string;
  proposta_id: string | null;
  tipo: string;
  mensagem: string;
  lida: boolean;
  created_at: string;
}

export function CorbanNotificationBell() {
  const { user } = useAuth();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [open, setOpen] = useState(false);

  const unreadCount = notifications.filter(n => !n.lida).length;

  useEffect(() => {
    if (!user) return;
    loadNotifications();

    // Subscribe to realtime inserts
    const channel = supabase
      .channel('corban-notif-' + user.id)
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'corban_notifications',
        filter: `user_id=eq.${user.id}`,
      }, (payload) => {
        setNotifications(prev => [payload.new as Notification, ...prev]);
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [user]);

  const loadNotifications = async () => {
    const { data } = await supabase
      .from('corban_notifications')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(50);
    if (data) setNotifications(data as Notification[]);
  };

  const markAsRead = async (id: string) => {
    await supabase
      .from('corban_notifications')
      .update({ lida: true })
      .eq('id', id);
    setNotifications(prev => prev.map(n => n.id === id ? { ...n, lida: true } : n));
  };

  const markAllAsRead = async () => {
    const unreadIds = notifications.filter(n => !n.lida).map(n => n.id);
    if (unreadIds.length === 0) return;
    await supabase
      .from('corban_notifications')
      .update({ lida: true })
      .in('id', unreadIds);
    setNotifications(prev => prev.map(n => ({ ...n, lida: true })));
  };

  const formatTime = (d: string) => {
    const date = new Date(d);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMin = Math.floor(diffMs / 60000);
    if (diffMin < 1) return 'agora';
    if (diffMin < 60) return `${diffMin}min`;
    const diffH = Math.floor(diffMin / 60);
    if (diffH < 24) return `${diffH}h`;
    const diffD = Math.floor(diffH / 24);
    return `${diffD}d`;
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="icon" className="relative h-8 w-8 hover:bg-sidebar-accent">
          <Bell className="w-4 h-4" />
          {unreadCount > 0 && (
            <Badge className="absolute -top-1 -right-1 h-4 min-w-4 flex items-center justify-center p-0 text-[9px] bg-destructive text-destructive-foreground border-0">
              {unreadCount > 99 ? '99+' : unreadCount}
            </Badge>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-80 p-0" align="end" side="right">
        <div className="flex items-center justify-between p-3 border-b">
          <p className="text-sm font-semibold">Notificações</p>
          {unreadCount > 0 && (
            <Button variant="ghost" size="sm" className="text-xs h-6 gap-1" onClick={markAllAsRead}>
              <CheckCheck className="w-3 h-3" /> Marcar todas
            </Button>
          )}
        </div>
        <ScrollArea className="max-h-[320px]">
          {notifications.length === 0 ? (
            <div className="p-6 text-center text-muted-foreground text-sm">
              <Bell className="w-6 h-6 mx-auto mb-2 opacity-40" />
              Nenhuma notificação
            </div>
          ) : (
            <div className="divide-y">
              {notifications.map(n => (
                <div
                  key={n.id}
                  className={cn(
                    "flex items-start gap-2 p-3 text-xs cursor-pointer hover:bg-muted/50 transition-colors",
                    !n.lida && "bg-primary/5"
                  )}
                  onClick={() => !n.lida && markAsRead(n.id)}
                >
                  <div className={cn("w-2 h-2 rounded-full mt-1 shrink-0", n.lida ? "bg-transparent" : "bg-primary")} />
                  <div className="flex-1 min-w-0">
                    <p className="text-foreground leading-tight">{n.mensagem}</p>
                    <p className="text-muted-foreground mt-0.5">{formatTime(n.created_at)}</p>
                  </div>
                  {!n.lida && (
                    <Check className="w-3.5 h-3.5 text-muted-foreground shrink-0 mt-0.5" />
                  )}
                </div>
              ))}
            </div>
          )}
        </ScrollArea>
      </PopoverContent>
    </Popover>
  );
}