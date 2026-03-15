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
  Send,
  Pause,
  AlertCircle,
  ListOrdered
} from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
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

type DateRange = {
  from: Date | undefined;
  to?: Date | undefined;
};

export default function MessagesContent() {
  const { user } = useAuth();
  const [messages, setMessages] = useState<MessageHistory[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedChip, setSelectedChip] = useState<string>('all');
  const [selectedDirection, setSelectedDirection] = useState<string>('all');
  const [selectedStatus, setSelectedStatus] = useState<string>('all');
  const [dateRange, setDateRange] = useState<DateRange>({
    from: subDays(new Date(), 7),
    to: new Date(),
  });
  const [chips, setChips] = useState<{ id: string; slot_number: number }[]>([]);

  const handleNewMessage = useCallback((newMessage: MessageHistory) => {
    setMessages((prev) => [newMessage, ...prev].slice(0, 100));
  }, []);

  const chipIds = chips.map((c) => c.id);
  useRealtimeMessages(handleNewMessage as any, chipIds);

  useEffect(() => { fetchChips(); }, [user]);
  useEffect(() => { fetchMessages(); }, [user, selectedChip, selectedDirection, selectedStatus, dateRange]);

  const fetchChips = async () => {
    if (!user) return;
    const { data } = await supabase
      .from('chips')
      .select('id, slot_number')
      .eq('user_id', user.id)
      .order('slot_number');
    setChips(data || []);
  };

  const fetchMessages = async () => {
    if (!user) return;
    setIsLoading(true);
    try {
      let query = supabase
        .from('message_history')
        .select(`*, chips!inner (slot_number, phone_number, user_id)`)
        .order('created_at', { ascending: false })
        .limit(100);

      if (dateRange.from) query = query.gte('created_at', startOfDay(dateRange.from).toISOString());
      if (dateRange.to) query = query.lte('created_at', endOfDay(dateRange.to).toISOString());
      if (selectedChip !== 'all') query = query.eq('chip_id', selectedChip);
      if (selectedDirection !== 'all') query = query.eq('direction', selectedDirection);
      if (selectedStatus !== 'all') query = query.eq('status', selectedStatus);
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

  const clearFilters = () => {
    setSelectedChip('all');
    setSelectedDirection('all');
    setSelectedStatus('all');
    setDateRange({ from: subDays(new Date(), 7), to: new Date() });
  };

  const hasActiveFilters = selectedChip !== 'all' || selectedDirection !== 'all' || selectedStatus !== 'all';

  return (
    <div className="space-y-4">
      {/* Filters */}
      <Card className="border-border/50">
        <CardContent className="p-4">
          <div className="flex flex-wrap items-center gap-3">
            <Filter className="w-4 h-4 text-muted-foreground" />
            <Select value={selectedChip} onValueChange={setSelectedChip}>
              <SelectTrigger className="w-[140px]">
                <SelectValue placeholder="Chip" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos os chips</SelectItem>
                {chips.map((chip) => (
                  <SelectItem key={chip.id} value={chip.id}>Slot {chip.slot_number}</SelectItem>
                ))}
              </SelectContent>
            </Select>
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
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline" className="w-[200px] justify-start text-left font-normal">
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  {dateRange.from ? (
                    dateRange.to ? (
                      <>{format(dateRange.from, "dd/MM", { locale: ptBR })} - {format(dateRange.to, "dd/MM", { locale: ptBR })}</>
                    ) : format(dateRange.from, "dd/MM/yyyy", { locale: ptBR })
                  ) : <span>Selecionar período</span>}
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
            {hasActiveFilters && (
              <Button variant="ghost" size="sm" onClick={clearFilters}>
                <RefreshCw className="w-4 h-4 mr-1" />
                Limpar
              </Button>
            )}
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
              : 'Últimas mensagens'}
            <span className="ml-2 text-xs text-primary">(tempo real)</span>
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="text-center py-8 text-muted-foreground">Carregando...</div>
          ) : messages.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">Nenhuma mensagem encontrada</div>
          ) : (
            <div className="space-y-3">
              {messages.map((message) => (
                <div key={message.id} className="flex items-start gap-4 p-4 rounded-lg bg-secondary/30 border border-border/50">
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
                      <Badge variant="outline" className="text-xs">Slot {message.chips?.slot_number}</Badge>
                      <Badge variant={message.direction === 'outgoing' ? 'default' : 'secondary'} className="text-xs">
                        {message.direction === 'outgoing' ? 'Enviada' : 'Recebida'}
                      </Badge>
                      <span className="text-xs text-muted-foreground">
                        {format(new Date(message.created_at), "dd/MM/yyyy HH:mm", { locale: ptBR })}
                      </span>
                    </div>
                    <p className="text-sm mb-2 line-clamp-2">{message.message_content}</p>
                    <div className="flex items-center gap-4 text-xs text-muted-foreground">
                      <span>{message.direction === 'outgoing' ? 'Para: ' : 'De: '}{message.recipient_phone || 'Desconhecido'}</span>
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
    </div>
  );
}
