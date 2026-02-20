import { useEffect, useState, useCallback } from 'react';
import { format, subDays, startOfDay, endOfDay } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { 
  ArrowUpRight, 
  ArrowDownLeft, 
  CheckCircle2, 
  XCircle, 
  Clock, 
  Filter, 
  CalendarIcon, 
  RefreshCw,
  ListOrdered,
  History as HistoryIcon,
  Send,
  Pause,
  AlertCircle
} from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import DashboardLayout from '@/components/layout/DashboardLayout';
import { cn } from '@/lib/utils';
import { useRealtimeMessages } from '@/hooks/useRealtimeMessages';

interface MessageHistory {
  id: string;
  chip_id: string;
  direction: string;
  message_content: string;
  recipient_phone: string | null;
  status: string;
  created_at: string;
  chips: {
    slot_number: number;
    phone_number: string | null;
  } | null;
}

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

type DateRange = {
  from: Date | undefined;
  to?: Date | undefined;
};

export default function Messages() {
  const { user, isAdmin } = useAuth();
  const [messages, setMessages] = useState<MessageHistory[]>([]);
  const [queueItems, setQueueItems] = useState<QueueItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isLoadingQueue, setIsLoadingQueue] = useState(true);
  const [selectedChip, setSelectedChip] = useState<string>('all');
  const [selectedDirection, setSelectedDirection] = useState<string>('all');
  const [selectedStatus, setSelectedStatus] = useState<string>('all');
  const [dateRange, setDateRange] = useState<DateRange>({
    from: subDays(new Date(), 7),
    to: new Date(),
  });
  const [chips, setChips] = useState<{ id: string; slot_number: number }[]>([]);
  const [activeTab, setActiveTab] = useState('history');

  // Realtime: add new messages to list
  const handleNewMessage = useCallback((newMessage: MessageHistory) => {
    setMessages((prev) => [newMessage, ...prev].slice(0, 100));
  }, []);

  const chipIds = chips.map((c) => c.id);
  useRealtimeMessages(handleNewMessage as any, chipIds);

  // Realtime for queue
  useEffect(() => {
    if (chipIds.length === 0) return;

    const channel = supabase
      .channel('queue-changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'message_queue',
        },
        () => {
          fetchQueue();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [chipIds]);

  useEffect(() => {
    fetchChips();
  }, [user]);

  useEffect(() => {
    fetchMessages();
  }, [user, selectedChip, selectedDirection, selectedStatus, dateRange]);

  useEffect(() => {
    if (activeTab === 'queue') {
      fetchQueue();
    }
  }, [activeTab, chips]);

  const fetchChips = async () => {
    if (!user) return;

    const query = supabase
      .from('chips')
      .select('id, slot_number')
      .order('slot_number');

    query.eq('user_id', user.id);

    const { data } = await query;
    setChips(data || []);
  };

  const fetchMessages = async () => {
    if (!user) return;

    setIsLoading(true);

    try {
      let query = supabase
        .from('message_history')
        .select(`
          *,
          chips!inner (
            slot_number,
            phone_number,
            user_id
          )
        `)
        .order('created_at', { ascending: false })
        .limit(100);

      // Apply date range filter
      if (dateRange.from) {
        query = query.gte('created_at', startOfDay(dateRange.from).toISOString());
      }
      if (dateRange.to) {
        query = query.lte('created_at', endOfDay(dateRange.to).toISOString());
      }

      // Apply chip filter
      if (selectedChip !== 'all') {
        query = query.eq('chip_id', selectedChip);
      }

      // Apply direction filter
      if (selectedDirection !== 'all') {
        query = query.eq('direction', selectedDirection);
      }

      // Apply status filter
      if (selectedStatus !== 'all') {
        query = query.eq('status', selectedStatus);
      }

      query = query.eq('chips.user_id', user.id);

      const { data, error } = await query;

      if (error) throw error;
      setMessages(data || []);
    } catch (error) {
      console.error('Error fetching messages:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const fetchQueue = async () => {
    if (!user || chips.length === 0) return;

    setIsLoadingQueue(true);

    try {
      const chipIds = chips.map(c => c.id);
      
      const { data, error } = await supabase
        .from('message_queue')
        .select(`
          *,
          chips (
            slot_number,
            phone_number
          )
        `)
        .in('chip_id', chipIds)
        .in('status', ['pending', 'processing'])
        .order('scheduled_at', { ascending: true })
        .limit(50);

      if (error) throw error;
      setQueueItems((data || []) as QueueItem[]);
    } catch (error) {
      console.error('Error fetching queue:', error);
    } finally {
      setIsLoadingQueue(false);
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'delivered':
      case 'sent':
        return <CheckCircle2 className="w-4 h-4 text-primary" />;
      case 'failed':
        return <XCircle className="w-4 h-4 text-destructive" />;
      default:
        return <Clock className="w-4 h-4 text-muted-foreground" />;
    }
  };

  const getStatusLabel = (status: string) => {
    switch (status) {
      case 'delivered': return 'Entregue';
      case 'sent': return 'Enviada';
      case 'failed': return 'Falhou';
      case 'pending': return 'Pendente';
      case 'processing': return 'Processando';
      case 'cancelled': return 'Cancelada';
      default: return 'Pendente';
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

  const clearFilters = () => {
    setSelectedChip('all');
    setSelectedDirection('all');
    setSelectedStatus('all');
    setDateRange({ from: subDays(new Date(), 7), to: new Date() });
  };

  const hasActiveFilters = 
    selectedChip !== 'all' || 
    selectedDirection !== 'all' || 
    selectedStatus !== 'all';

  const cancelQueueItem = async (id: string) => {
    try {
      await supabase
        .from('message_queue')
        .update({ status: 'cancelled' })
        .eq('id', id);
      fetchQueue();
    } catch (error) {
      console.error('Error cancelling queue item:', error);
    }
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold">Mensagens</h1>
            <p className="text-muted-foreground">
              Histórico e fila de mensagens
              <span className="ml-2 text-xs text-primary">(atualização em tempo real)</span>
            </p>
          </div>
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="grid w-full max-w-md grid-cols-2">
            <TabsTrigger value="history" className="flex items-center gap-2">
              <HistoryIcon className="w-4 h-4" />
              Histórico
            </TabsTrigger>
            <TabsTrigger value="queue" className="flex items-center gap-2">
              <ListOrdered className="w-4 h-4" />
              Fila
              {queueItems.length > 0 && (
                <Badge variant="secondary" className="ml-1 h-5 px-1.5 text-xs">
                  {queueItems.length}
                </Badge>
              )}
            </TabsTrigger>
          </TabsList>

          {/* History Tab */}
          <TabsContent value="history" className="space-y-4 mt-4">
            {/* Filters */}
            <Card className="border-border/50">
              <CardContent className="p-4">
                <div className="flex flex-wrap items-center gap-3">
                  <Filter className="w-4 h-4 text-muted-foreground" />
                  
                  {/* Chip filter */}
                  <Select value={selectedChip} onValueChange={setSelectedChip}>
                    <SelectTrigger className="w-[140px]">
                      <SelectValue placeholder="Chip" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Todos os chips</SelectItem>
                      {chips.map((chip) => (
                        <SelectItem key={chip.id} value={chip.id}>
                          Slot {chip.slot_number}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>

                  {/* Direction filter */}
                  <Select value={selectedDirection} onValueChange={setSelectedDirection}>
                    <SelectTrigger className="w-[130px]">
                      <SelectValue placeholder="Direção" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Todas</SelectItem>
                      <SelectItem value="outgoing">Enviadas</SelectItem>
                      <SelectItem value="incoming">Recebidas</SelectItem>
                    </SelectContent>
                  </Select>

                  {/* Status filter */}
                  <Select value={selectedStatus} onValueChange={setSelectedStatus}>
                    <SelectTrigger className="w-[130px]">
                      <SelectValue placeholder="Status" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Todos</SelectItem>
                      <SelectItem value="sent">Enviada</SelectItem>
                      <SelectItem value="delivered">Entregue</SelectItem>
                      <SelectItem value="failed">Falhou</SelectItem>
                      <SelectItem value="pending">Pendente</SelectItem>
                    </SelectContent>
                  </Select>

                  {/* Date range picker */}
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button variant="outline" className="w-[200px] justify-start text-left font-normal">
                        <CalendarIcon className="mr-2 h-4 w-4" />
                        {dateRange.from ? (
                          dateRange.to ? (
                            <>
                              {format(dateRange.from, "dd/MM", { locale: ptBR })} -{" "}
                              {format(dateRange.to, "dd/MM", { locale: ptBR })}
                            </>
                          ) : (
                            format(dateRange.from, "dd/MM/yyyy", { locale: ptBR })
                          )
                        ) : (
                          <span>Selecionar período</span>
                        )}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="start">
                      <Calendar
                        initialFocus
                        mode="range"
                        defaultMonth={dateRange.from}
                        selected={dateRange}
                        onSelect={(range) => setDateRange(range ?? { from: undefined, to: undefined })}
                        numberOfMonths={2}
                        locale={ptBR}
                      />
                    </PopoverContent>
                  </Popover>

                  {/* Clear filters */}
                  {hasActiveFilters && (
                    <Button variant="ghost" size="sm" onClick={clearFilters}>
                      <RefreshCw className="w-4 h-4 mr-1" />
                      Limpar
                    </Button>
                  )}

                  {/* Results count */}
                  <span className="ml-auto text-sm text-muted-foreground">
                    {messages.length} mensagem(ns)
                  </span>
                </div>
              </CardContent>
            </Card>

            {/* Messages list */}
            <Card className="border-border/50">
              <CardHeader>
                <CardTitle>Mensagens</CardTitle>
                <CardDescription>
                  {dateRange.from && dateRange.to 
                    ? `De ${format(dateRange.from, "dd/MM/yyyy", { locale: ptBR })} até ${format(dateRange.to, "dd/MM/yyyy", { locale: ptBR })}`
                    : 'Últimas mensagens'
                  }
                </CardDescription>
              </CardHeader>
              <CardContent>
                {isLoading ? (
                  <div className="text-center py-8 text-muted-foreground">
                    Carregando...
                  </div>
                ) : messages.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    Nenhuma mensagem encontrada
                  </div>
                ) : (
                  <div className="space-y-3">
                    {messages.map((message) => (
                      <div 
                        key={message.id}
                        className="flex items-start gap-4 p-4 rounded-lg bg-secondary/30 border border-border/50"
                      >
                        <div className={cn(
                          "w-10 h-10 rounded-lg flex items-center justify-center shrink-0",
                          message.direction === 'outgoing' ? "bg-primary/20" : "bg-blue-500/20"
                        )}>
                          {message.direction === 'outgoing' ? (
                            <ArrowUpRight className="w-5 h-5 text-primary" />
                          ) : (
                            <ArrowDownLeft className="w-5 h-5 text-blue-500" />
                          )}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1 flex-wrap">
                            <Badge variant="outline" className="text-xs">
                              Slot {message.chips?.slot_number}
                            </Badge>
                            <Badge 
                              variant={message.direction === 'outgoing' ? 'default' : 'secondary'} 
                              className="text-xs"
                            >
                              {message.direction === 'outgoing' ? 'Enviada' : 'Recebida'}
                            </Badge>
                            <span className="text-xs text-muted-foreground">
                              {format(new Date(message.created_at), "dd/MM/yyyy HH:mm", { locale: ptBR })}
                            </span>
                          </div>
                          <p className="text-sm mb-2 line-clamp-2">
                            {message.message_content}
                          </p>
                          <div className="flex items-center gap-4 text-xs text-muted-foreground">
                            <span>
                              {message.direction === 'outgoing' ? 'Para: ' : 'De: '}
                              {message.recipient_phone || 'Desconhecido'}
                            </span>
                            <div className="flex items-center gap-1">
                              {getStatusIcon(message.status)}
                              <span>{getStatusLabel(message.status)}</span>
                            </div>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Queue Tab */}
          <TabsContent value="queue" className="space-y-4 mt-4">
            <Card className="border-border/50">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <ListOrdered className="w-5 h-5 text-primary" />
                  Fila de Mensagens
                </CardTitle>
                <CardDescription>
                  Próximas mensagens agendadas para envio
                </CardDescription>
              </CardHeader>
              <CardContent>
                {isLoadingQueue ? (
                  <div className="text-center py-8 text-muted-foreground">
                    Carregando...
                  </div>
                ) : queueItems.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    <ListOrdered className="w-12 h-12 mx-auto mb-3 opacity-50" />
                    <p>Nenhuma mensagem na fila</p>
                    <p className="text-xs mt-1">As mensagens serão adicionadas automaticamente pelo sistema de aquecimento</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {queueItems.map((item, index) => (
                      <div 
                        key={item.id}
                        className="flex items-start gap-4 p-4 rounded-lg bg-secondary/30 border border-border/50"
                      >
                        <div className="w-8 h-8 rounded-lg bg-muted flex items-center justify-center shrink-0 text-sm font-medium">
                          {index + 1}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1 flex-wrap">
                            <Badge variant="outline" className="text-xs">
                              Slot {item.chips?.slot_number}
                            </Badge>
                            {getQueueStatusBadge(item.status)}
                            <span className="text-xs text-muted-foreground">
                              Agendada: {format(new Date(item.scheduled_at), "dd/MM HH:mm", { locale: ptBR })}
                            </span>
                          </div>
                          <p className="text-sm mb-2 line-clamp-2">
                            {item.message_content}
                          </p>
                          <div className="flex items-center justify-between text-xs text-muted-foreground">
                            <span>
                              Para: {item.recipient_phone}
                            </span>
                            <span>
                              Tentativas: {item.attempts}/{item.max_attempts}
                            </span>
                          </div>
                          {item.error_message && (
                            <p className="text-xs text-destructive mt-1">
                              Erro: {item.error_message}
                            </p>
                          )}
                        </div>
                        {item.status === 'pending' && (
                          <Button
                            variant="ghost"
                            size="sm"
                            className="shrink-0 text-muted-foreground hover:text-destructive"
                            onClick={() => cancelQueueItem(item.id)}
                          >
                            <Pause className="w-4 h-4" />
                          </Button>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </DashboardLayout>
  );
}
