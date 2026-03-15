import { useState, useEffect, useRef } from 'react';
import DashboardLayout from '@/components/layout/DashboardLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { Plus, Send, MessageCircle, Clock, CheckCircle2, AlertCircle, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';

interface Ticket {
  id: string;
  created_by: string;
  assigned_to: string | null;
  title: string;
  description: string | null;
  priority: string;
  status: string;
  created_at: string;
  updated_at: string;
  creator_email?: string;
  assignee_email?: string;
}

interface TicketMessage {
  id: string;
  ticket_id: string;
  user_id: string;
  content: string;
  created_at: string;
  sender_email?: string;
}

const priorityConfig: Record<string, { label: string; className: string }> = {
  baixa: { label: 'Baixa', className: 'bg-muted text-muted-foreground' },
  media: { label: 'Média', className: 'bg-blue-500/20 text-blue-400' },
  alta: { label: 'Alta', className: 'bg-orange-500/20 text-orange-400' },
  urgente: { label: 'Urgente', className: 'bg-destructive/20 text-destructive' },
};

const statusConfig: Record<string, { label: string; icon: typeof Clock; className: string }> = {
  aberto: { label: 'Aberto', icon: AlertCircle, className: 'bg-yellow-500/20 text-yellow-400' },
  em_andamento: { label: 'Em Andamento', icon: Clock, className: 'bg-blue-500/20 text-blue-400' },
  resolvido: { label: 'Resolvido', icon: CheckCircle2, className: 'bg-green-500/20 text-green-400' },
};

export default function Tickets() {
  const { user, isSeller } = useAuth();
  const { toast } = useToast();
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [selectedTicket, setSelectedTicket] = useState<Ticket | null>(null);
  const [messages, setMessages] = useState<TicketMessage[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [newDescription, setNewDescription] = useState('');
  const [newPriority, setNewPriority] = useState('media');
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [profiles, setProfiles] = useState<Record<string, string>>({});
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    loadProfiles();
    loadTickets();

    const channel = supabase
      .channel('tickets-realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'support_tickets' }, () => loadTickets())
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'ticket_messages' }, (payload) => {
        const msg = payload.new as any;
        if (selectedTicket && msg.ticket_id === selectedTicket.id) {
          setMessages(prev => [...prev, { ...msg, sender_email: profiles[msg.user_id] || 'Usuário' }]);
        }
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, []);

  useEffect(() => {
    if (selectedTicket) loadMessages(selectedTicket.id);
  }, [selectedTicket?.id]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const loadProfiles = async () => {
    const { data } = await supabase.from('profiles').select('user_id, email, name');
    if (data) {
      const map: Record<string, string> = {};
      data.forEach(p => { map[p.user_id] = p.name || p.email; });
      setProfiles(map);
    }
  };

  const loadTickets = async () => {
    const { data, error } = await supabase
      .from('support_tickets')
      .select('*')
      .order('updated_at', { ascending: false });
    if (!error && data) {
      setTickets(data);
      if (selectedTicket) {
        const updated = data.find(t => t.id === selectedTicket.id);
        if (updated) setSelectedTicket(updated);
      }
    }
    setLoading(false);
  };

  const loadMessages = async (ticketId: string) => {
    const { data } = await supabase
      .from('ticket_messages')
      .select('*')
      .eq('ticket_id', ticketId)
      .order('created_at', { ascending: true });
    if (data) setMessages(data);
  };

  const handleCreateTicket = async () => {
    if (!newTitle.trim() || !user) return;
    const { error } = await supabase.from('support_tickets').insert({
      title: newTitle.trim(),
      description: newDescription.trim() || null,
      priority: newPriority,
      created_by: user.id,
    });
    if (error) {
      toast({ title: 'Erro ao criar ticket', description: error.message, variant: 'destructive' });
    } else {
      toast({ title: 'Ticket criado com sucesso' });
      setCreateOpen(false);
      setNewTitle('');
      setNewDescription('');
      setNewPriority('media');
      loadTickets();
    }
  };

  const handleSendMessage = async () => {
    if (!newMessage.trim() || !selectedTicket || !user) return;
    setSending(true);
    const { error } = await supabase.from('ticket_messages').insert({
      ticket_id: selectedTicket.id,
      user_id: user.id,
      content: newMessage.trim(),
    });
    if (!error) {
      setNewMessage('');
      loadMessages(selectedTicket.id);
      // Auto-update status to em_andamento if it's aberto
      if (selectedTicket.status === 'aberto' && !isSeller) {
        await supabase.from('support_tickets').update({ status: 'em_andamento' }).eq('id', selectedTicket.id);
      }
    }
    setSending(false);
  };

  const handleStatusChange = async (ticketId: string, status: string) => {
    await supabase.from('support_tickets').update({ status }).eq('id', ticketId);
    loadTickets();
  };

  const filteredTickets = tickets.filter(t => filterStatus === 'all' || t.status === filterStatus);

  const formatDate = (d: string) => {
    const date = new Date(d);
    return date.toLocaleDateString('pt-BR') + ' ' + date.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
  };

  if (loading) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center h-64">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold">Tickets de Suporte</h1>
            <p className="text-muted-foreground text-sm">
              {isSeller ? 'Abra chamados para o suporte' : 'Gerencie os chamados dos vendedores'}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Select value={filterStatus} onValueChange={setFilterStatus}>
              <SelectTrigger className="w-40">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos</SelectItem>
                <SelectItem value="aberto">Abertos</SelectItem>
                <SelectItem value="em_andamento">Em Andamento</SelectItem>
                <SelectItem value="resolvido">Resolvidos</SelectItem>
              </SelectContent>
            </Select>
            <Dialog open={createOpen} onOpenChange={setCreateOpen}>
              <DialogTrigger asChild>
                <Button><Plus className="w-4 h-4 mr-2" />Novo Ticket</Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader><DialogTitle>Novo Ticket</DialogTitle></DialogHeader>
                <div className="space-y-4">
                  <Input placeholder="Título do chamado" value={newTitle} onChange={e => setNewTitle(e.target.value)} />
                  <Textarea placeholder="Descreva o problema..." value={newDescription} onChange={e => setNewDescription(e.target.value)} rows={4} />
                  <Select value={newPriority} onValueChange={setNewPriority}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="baixa">Baixa</SelectItem>
                      <SelectItem value="media">Média</SelectItem>
                      <SelectItem value="alta">Alta</SelectItem>
                      <SelectItem value="urgente">Urgente</SelectItem>
                    </SelectContent>
                  </Select>
                  <Button onClick={handleCreateTicket} disabled={!newTitle.trim()} className="w-full">Criar Ticket</Button>
                </div>
              </DialogContent>
            </Dialog>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 h-[calc(100vh-220px)]">
          {/* Ticket list */}
          <Card className="lg:col-span-1 flex flex-col">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                {filteredTickets.length} ticket(s)
              </CardTitle>
            </CardHeader>
            <CardContent className="flex-1 overflow-hidden p-0">
              <ScrollArea className="h-full">
                <div className="space-y-1 p-4 pt-0">
                  {filteredTickets.map(ticket => {
                    const priority = priorityConfig[ticket.priority] || priorityConfig.media;
                    const status = statusConfig[ticket.status] || statusConfig.aberto;
                    const StatusIcon = status.icon;
                    return (
                      <div
                        key={ticket.id}
                        onClick={() => setSelectedTicket(ticket)}
                        className={cn(
                          'p-3 rounded-lg cursor-pointer transition-colors border',
                          selectedTicket?.id === ticket.id
                            ? 'bg-primary/10 border-primary/30'
                            : 'hover:bg-muted/50 border-transparent'
                        )}
                      >
                        <div className="flex items-start justify-between gap-2">
                          <h3 className="font-medium text-sm truncate flex-1">{ticket.title}</h3>
                          <Badge className={cn('text-[10px] shrink-0', priority.className)}>{priority.label}</Badge>
                        </div>
                        <div className="flex items-center gap-2 mt-1.5">
                          <Badge variant="outline" className={cn('text-[10px] gap-1', status.className)}>
                            <StatusIcon className="w-3 h-3" />{status.label}
                          </Badge>
                          <span className="text-[10px] text-muted-foreground">
                            {profiles[ticket.created_by] || 'Usuário'}
                          </span>
                        </div>
                        <p className="text-[10px] text-muted-foreground mt-1">{formatDate(ticket.created_at)}</p>
                      </div>
                    );
                  })}
                  {filteredTickets.length === 0 && (
                    <p className="text-sm text-muted-foreground text-center py-8">Nenhum ticket encontrado</p>
                  )}
                </div>
              </ScrollArea>
            </CardContent>
          </Card>

          {/* Ticket detail + messages */}
          <Card className="lg:col-span-2 flex flex-col">
            {selectedTicket ? (
              <>
                <CardHeader className="pb-2">
                  <div className="flex items-center justify-between">
                    <div>
                      <CardTitle className="text-lg">{selectedTicket.title}</CardTitle>
                      <p className="text-xs text-muted-foreground mt-1">
                        Aberto por {profiles[selectedTicket.created_by] || 'Usuário'} em {formatDate(selectedTicket.created_at)}
                      </p>
                    </div>
                    {!isSeller && (
                      <Select value={selectedTicket.status} onValueChange={v => handleStatusChange(selectedTicket.id, v)}>
                        <SelectTrigger className="w-40">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="aberto">Aberto</SelectItem>
                          <SelectItem value="em_andamento">Em Andamento</SelectItem>
                          <SelectItem value="resolvido">Resolvido</SelectItem>
                        </SelectContent>
                      </Select>
                    )}
                  </div>
                  {selectedTicket.description && (
                    <p className="text-sm text-muted-foreground mt-2 p-3 bg-muted/30 rounded-lg">{selectedTicket.description}</p>
                  )}
                </CardHeader>
                <Separator />
                <CardContent className="flex-1 overflow-hidden p-0 flex flex-col">
                  <ScrollArea className="flex-1 p-4">
                    <div className="space-y-3">
                      {messages.map(msg => {
                        const isOwn = msg.user_id === user?.id;
                        return (
                          <div key={msg.id} className={cn('flex', isOwn ? 'justify-end' : 'justify-start')}>
                            <div className={cn(
                              'max-w-[70%] rounded-xl px-4 py-2.5',
                              isOwn ? 'bg-primary text-primary-foreground' : 'bg-muted'
                            )}>
                              <p className="text-xs font-medium mb-0.5 opacity-70">
                                {profiles[msg.user_id] || 'Usuário'}
                              </p>
                              <p className="text-sm whitespace-pre-wrap">{msg.content}</p>
                              <p className="text-[10px] opacity-50 mt-1 text-right">
                                {new Date(msg.created_at).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                              </p>
                            </div>
                          </div>
                        );
                      })}
                      <div ref={messagesEndRef} />
                    </div>
                  </ScrollArea>
                  {selectedTicket.status !== 'resolvido' && (
                    <div className="p-4 border-t border-border flex gap-2">
                      <Input
                        placeholder="Escreva uma mensagem..."
                        value={newMessage}
                        onChange={e => setNewMessage(e.target.value)}
                        onKeyDown={e => e.key === 'Enter' && !e.shiftKey && handleSendMessage()}
                        disabled={sending}
                      />
                      <Button onClick={handleSendMessage} disabled={sending || !newMessage.trim()} size="icon">
                        {sending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                      </Button>
                    </div>
                  )}
                </CardContent>
              </>
            ) : (
              <CardContent className="flex-1 flex items-center justify-center">
                <div className="text-center text-muted-foreground">
                  <MessageCircle className="w-12 h-12 mx-auto mb-3 opacity-30" />
                  <p>Selecione um ticket para ver as mensagens</p>
                </div>
              </CardContent>
            )}
          </Card>
        </div>
      </div>
    </DashboardLayout>
  );
}
