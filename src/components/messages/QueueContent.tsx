import { useEffect, useState, useCallback } from 'react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { 
  Clock, 
  Send, 
  Pause, 
  AlertCircle, 
  ListOrdered 
} from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';

interface QueueItem {
  id: string;
  chip_id: string;
  recipient_phone: string;
  message_content: string;
  scheduled_at: string;
  status: string;
  priority: number;
  attempts: number;
  max_attempts: number;
  error_message: string | null;
  created_at: string;
  chips?: {
    slot_number: number;
    phone_number: string | null;
  } | null;
}

export default function QueueContent() {
  const { user } = useAuth();
  const [queueItems, setQueueItems] = useState<QueueItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [chips, setChips] = useState<{ id: string; slot_number: number }[]>([]);

  useEffect(() => {
    if (!user) return;
    supabase
      .from('chips')
      .select('id, slot_number')
      .eq('user_id', user.id)
      .order('slot_number')
      .then(({ data }) => setChips(data || []));
  }, [user]);

  const fetchQueue = useCallback(async () => {
    if (!user || chips.length === 0) return;
    setIsLoading(true);
    try {
      const chipIds = chips.map(c => c.id);
      const { data, error } = await supabase
        .from('message_queue')
        .select(`*, chips (slot_number, phone_number)`)
        .in('chip_id', chipIds)
        .in('status', ['pending', 'processing'])
        .order('scheduled_at', { ascending: true })
        .limit(50);
      if (error) throw error;
      setQueueItems((data || []) as QueueItem[]);
    } catch (error) {
      console.error('Error fetching queue:', error);
    } finally {
      setIsLoading(false);
    }
  }, [user, chips]);

  useEffect(() => { fetchQueue(); }, [fetchQueue]);

  // Realtime
  useEffect(() => {
    if (chips.length === 0) return;
    const channel = supabase
      .channel('queue-changes-tab')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'message_queue' }, () => fetchQueue())
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [chips, fetchQueue]);

  const cancelQueueItem = async (id: string) => {
    try {
      await supabase.from('message_queue').update({ status: 'cancelled' }).eq('id', id);
      fetchQueue();
    } catch (error) {
      console.error('Error cancelling queue item:', error);
    }
  };

  const getQueueStatusBadge = (status: string) => {
    switch (status) {
      case 'pending':
        return <Badge variant="secondary" className="text-xs"><Clock className="w-3 h-3 mr-1" />Aguardando</Badge>;
      case 'processing':
        return <Badge variant="default" className="text-xs"><Send className="w-3 h-3 mr-1" />Enviando</Badge>;
      case 'failed':
        return <Badge variant="destructive" className="text-xs"><AlertCircle className="w-3 h-3 mr-1" />Falhou</Badge>;
      default:
        return <Badge variant="outline" className="text-xs">{status}</Badge>;
    }
  };

  return (
    <Card className="border-border/50">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <ListOrdered className="w-5 h-5 text-primary" />
          Fila de Mensagens
        </CardTitle>
        <CardDescription>Próximas mensagens agendadas para envio</CardDescription>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="text-center py-8 text-muted-foreground">Carregando...</div>
        ) : queueItems.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            <ListOrdered className="w-12 h-12 mx-auto mb-3 opacity-50" />
            <p>Nenhuma mensagem na fila</p>
            <p className="text-xs mt-1">As mensagens serão adicionadas automaticamente pelo sistema de aquecimento</p>
          </div>
        ) : (
          <div className="space-y-3">
            {queueItems.map((item, index) => (
              <div key={item.id} className="flex items-start gap-4 p-4 rounded-lg bg-secondary/30 border border-border/50">
                <div className="w-8 h-8 rounded-lg bg-muted flex items-center justify-center shrink-0 text-sm font-medium">
                  {index + 1}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1 flex-wrap">
                    <Badge variant="outline" className="text-xs">Slot {item.chips?.slot_number}</Badge>
                    {getQueueStatusBadge(item.status)}
                    <span className="text-xs text-muted-foreground">
                      Agendada: {format(new Date(item.scheduled_at), "dd/MM HH:mm", { locale: ptBR })}
                    </span>
                  </div>
                  <p className="text-sm mb-2 line-clamp-2">{item.message_content}</p>
                  <div className="flex items-center justify-between text-xs text-muted-foreground">
                    <span>Para: {item.recipient_phone}</span>
                    <span>Tentativas: {item.attempts}/{item.max_attempts}</span>
                  </div>
                  {item.error_message && (
                    <p className="text-xs text-destructive mt-1">Erro: {item.error_message}</p>
                  )}
                </div>
                {item.status === 'pending' && (
                  <Button variant="ghost" size="sm" className="shrink-0 text-muted-foreground hover:text-destructive" onClick={() => cancelQueueItem(item.id)}>
                    <Pause className="w-4 h-4" />
                  </Button>
                )}
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
