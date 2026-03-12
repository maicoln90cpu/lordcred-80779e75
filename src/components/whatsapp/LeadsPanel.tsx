import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { Search, Loader2, MessageCircle, X, ChevronRight, Phone } from 'lucide-react';
import { ScrollArea } from '@/components/ui/scroll-area';

interface LeadsPanelProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onStartConversation?: (phone: string, name: string) => void;
}

export default function LeadsPanel({ open, onOpenChange, onStartConversation }: LeadsPanelProps) {
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedLead, setSelectedLead] = useState<any | null>(null);
  const [editStatus, setEditStatus] = useState('');
  const [editNotes, setEditNotes] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: leads = [], isLoading } = useQuery({
    queryKey: ['my-leads', filterStatus, searchTerm],
    enabled: open && !!user,
    queryFn: async () => {
      let query = supabase
        .from('client_leads' as any)
        .select('*')
        .order('created_at', { ascending: false });

      if (filterStatus !== 'all') {
        query = query.eq('status', filterStatus);
      }
      if (searchTerm) {
        query = query.or(`nome.ilike.%${searchTerm}%,telefone.ilike.%${searchTerm}%`);
      }

      const { data, error } = await query.limit(200);
      if (error) throw error;
      return data as any[];
    }
  });

  const handleSaveLead = async () => {
    if (!selectedLead) return;
    setIsSaving(true);
    try {
      const updates: any = {
        status: editStatus,
        notes: editNotes,
        updated_at: new Date().toISOString(),
      };
      if (editStatus !== selectedLead.status) {
        updates.contacted_at = new Date().toISOString();
      }

      const { error } = await supabase
        .from('client_leads' as any)
        .update(updates)
        .eq('id', selectedLead.id);

      if (error) throw error;
      toast({ title: 'Lead atualizado' });
      queryClient.invalidateQueries({ queryKey: ['my-leads'] });
      setSelectedLead(null);
    } catch (error: any) {
      toast({ title: 'Erro', description: error.message, variant: 'destructive' });
    } finally {
      setIsSaving(false);
    }
  };

  const handleContact = (lead: any) => {
    if (lead.telefone && onStartConversation) {
      let phone = lead.telefone.replace(/\D/g, '');
      if (!phone.startsWith('55') && phone.length <= 11) {
        phone = '55' + phone;
      }
      onStartConversation(phone, lead.nome);
      onOpenChange(false);
    }
  };

  const statusColors: Record<string, string> = {
    'CHAMEI': 'bg-blue-500/20 text-blue-400',
    'NÃO EXISTE': 'bg-red-500/20 text-red-400',
    'APROVADO': 'bg-green-500/20 text-green-400',
    'NÃO ATENDEU': 'bg-yellow-500/20 text-yellow-400',
    'pendente': 'bg-muted text-muted-foreground',
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[85vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Phone className="w-5 h-5" />
            Meus Leads
          </DialogTitle>
        </DialogHeader>

        <div className="flex gap-3 mb-4">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="Buscar por nome ou telefone..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-9"
            />
          </div>
          <Select value={filterStatus} onValueChange={setFilterStatus}>
            <SelectTrigger className="w-48">
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos</SelectItem>
              <SelectItem value="pendente">Pendente</SelectItem>
              <SelectItem value="CHAMEI">Chamei</SelectItem>
              <SelectItem value="NÃO ATENDEU">Não Atendeu</SelectItem>
              <SelectItem value="NÃO EXISTE">Não Existe</SelectItem>
              <SelectItem value="APROVADO">Aprovado</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {selectedLead ? (
          <div className="space-y-4 flex-1">
            <Button variant="ghost" size="sm" onClick={() => setSelectedLead(null)}>
              <ChevronRight className="w-4 h-4 mr-1 rotate-180" /> Voltar
            </Button>

            <div className="grid grid-cols-2 gap-4 text-sm">
              <div><span className="text-muted-foreground">Nome:</span> <strong>{selectedLead.nome}</strong></div>
              <div><span className="text-muted-foreground">Telefone:</span> <strong>{selectedLead.telefone}</strong></div>
              <div><span className="text-muted-foreground">CPF:</span> {selectedLead.cpf}</div>
              <div><span className="text-muted-foreground">Valor Lib.:</span> {selectedLead.valor_lib ? Number(selectedLead.valor_lib).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }) : '-'}</div>
              <div><span className="text-muted-foreground">Prazo:</span> {selectedLead.prazo || '-'} meses</div>
              <div><span className="text-muted-foreground">Parcela:</span> {selectedLead.vlr_parcela ? Number(selectedLead.vlr_parcela).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }) : '-'}</div>
              <div><span className="text-muted-foreground">Banco:</span> {selectedLead.banco_nome}</div>
              <div><span className="text-muted-foreground">Aprovado:</span> {selectedLead.aprovado || '-'}</div>
              <div><span className="text-muted-foreground">Reprovado:</span> {selectedLead.reprovado || '-'}</div>
              <div><span className="text-muted-foreground">Data Nasc.:</span> {selectedLead.data_nasc || '-'}</div>
              <div><span className="text-muted-foreground">Nome Mãe:</span> {selectedLead.nome_mae || '-'}</div>
              <div><span className="text-muted-foreground">Lote:</span> {selectedLead.batch_name || '-'}</div>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">Status</label>
              <Select value={editStatus} onValueChange={setEditStatus}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="pendente">Pendente</SelectItem>
                  <SelectItem value="CHAMEI">Chamei</SelectItem>
                  <SelectItem value="NÃO ATENDEU">Não Atendeu</SelectItem>
                  <SelectItem value="NÃO EXISTE">Não Existe</SelectItem>
                  <SelectItem value="APROVADO">Aprovado</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">Observações</label>
              <Textarea
                value={editNotes}
                onChange={(e) => setEditNotes(e.target.value)}
                placeholder="Anotações sobre este lead..."
                rows={3}
              />
            </div>

            <div className="flex gap-2">
              <Button onClick={handleSaveLead} disabled={isSaving}>
                {isSaving ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null}
                Salvar
              </Button>
              <Button variant="outline" onClick={() => handleContact(selectedLead)}>
                <MessageCircle className="w-4 h-4 mr-2" />
                Iniciar Conversa WhatsApp
              </Button>
            </div>
          </div>
        ) : (
          <ScrollArea className="flex-1">
            {isLoading ? (
              <div className="flex justify-center py-8">
                <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
              </div>
            ) : leads.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                Nenhum lead atribuído a você.
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Nome</TableHead>
                    <TableHead>Telefone</TableHead>
                    <TableHead>Valor Lib.</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="w-24">Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {leads.map((lead: any) => (
                    <TableRow key={lead.id} className="cursor-pointer" onClick={() => { setSelectedLead(lead); setEditStatus(lead.status); setEditNotes(lead.notes || ''); }}>
                      <TableCell className="font-medium">{lead.nome}</TableCell>
                      <TableCell>{lead.telefone}</TableCell>
                      <TableCell>
                        {lead.valor_lib ? Number(lead.valor_lib).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }) : '-'}
                      </TableCell>
                      <TableCell>
                        <Badge className={statusColors[lead.status] || 'bg-muted text-muted-foreground'}>
                          {lead.status}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Button variant="ghost" size="icon" onClick={(e) => { e.stopPropagation(); handleContact(lead); }} title="Iniciar conversa">
                          <MessageCircle className="w-4 h-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
            <p className="text-sm text-muted-foreground py-2 text-center">
              {leads.length} leads
            </p>
          </ScrollArea>
        )}
      </DialogContent>
    </Dialog>
  );
}
