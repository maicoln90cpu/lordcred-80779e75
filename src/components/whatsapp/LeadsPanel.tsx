import { useState, useMemo } from 'react';
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
import { Progress } from '@/components/ui/progress';
import { Search, Loader2, MessageCircle, ChevronRight, Phone, ChevronLeft, ArrowUpDown } from 'lucide-react';
import { ScrollArea } from '@/components/ui/scroll-area';

interface LeadsPanelProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onStartConversation?: (phone: string, name: string) => void;
}

interface StatusOption {
  value: string;
  label: string;
  color_class: string;
}

interface ProfileOption {
  value: string;
  label: string;
  color_class: string;
}

const DEFAULT_STATUS_OPTIONS: StatusOption[] = [
  { value: 'pendente', label: 'Pendente', color_class: 'bg-muted text-muted-foreground hover:bg-muted/80' },
  { value: 'CHAMEI', label: 'Chamei', color_class: 'bg-blue-500/20 text-blue-400 hover:bg-blue-500/30' },
  { value: 'NÃO ATENDEU', label: 'Não Atendeu', color_class: 'bg-yellow-500/20 text-yellow-400 hover:bg-yellow-500/30' },
  { value: 'NÃO EXISTE', label: 'Não Existe', color_class: 'bg-red-500/20 text-red-400 hover:bg-red-500/30' },
  { value: 'APROVADO', label: 'Aprovado', color_class: 'bg-green-500/20 text-green-400 hover:bg-green-500/30' },
];

const PAGE_SIZE = 50;

type SortField = 'nome' | 'valor_lib' | 'status' | 'created_at';
type SortDir = 'asc' | 'desc';

// Fetch all rows without the 1000 limit
async function fetchAllLeads() {
  const allData: any[] = [];
  let from = 0;
  const batchSize = 1000;
  while (true) {
    const { data, error } = await supabase
      .from('client_leads' as any)
      .select('*')
      .order('created_at', { ascending: false })
      .range(from, from + batchSize - 1);
    if (error) throw error;
    if (!data || data.length === 0) break;
    allData.push(...data);
    if (data.length < batchSize) break;
    from += batchSize;
  }
  return allData;
}

export default function LeadsPanel({ open, onOpenChange, onStartConversation }: LeadsPanelProps) {
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [filterPerfil, setFilterPerfil] = useState<string>('all');
  const [filterBatch, setFilterBatch] = useState<string>('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedLead, setSelectedLead] = useState<any | null>(null);
  const [editStatus, setEditStatus] = useState('');
  const [editNotes, setEditNotes] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [page, setPage] = useState(0);
  const [sortField, setSortField] = useState<SortField>('created_at');
  const [sortDir, setSortDir] = useState<SortDir>('desc');
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Fetch dynamic status options
  const { data: statusOptions = DEFAULT_STATUS_OPTIONS } = useQuery({
    queryKey: ['lead-status-options'],
    queryFn: async () => {
      const { data } = await supabase
        .from('system_settings')
        .select('lead_status_options')
        .maybeSingle();
      if (data?.lead_status_options && Array.isArray(data.lead_status_options)) {
        return data.lead_status_options as unknown as StatusOption[];
      }
      return DEFAULT_STATUS_OPTIONS;
    }
  });

  // Fetch dynamic profile options
  const { data: profileOptions = [] } = useQuery({
    queryKey: ['lead-profile-options'],
    queryFn: async () => {
      const { data } = await supabase
        .from('system_settings')
        .select('lead_profile_options')
        .maybeSingle();
      if (data?.lead_profile_options && Array.isArray(data.lead_profile_options)) {
        return data.lead_profile_options as unknown as ProfileOption[];
      }
      return [];
    }
  });

  const statusColorMap = useMemo(() => {
    const map: Record<string, string> = {};
    statusOptions.forEach(s => { map[s.value] = s.color_class; });
    return map;
  }, [statusOptions]);

  const profileColorMap = useMemo(() => {
    const map: Record<string, string> = {};
    profileOptions.forEach(p => { map[p.value] = p.color_class; });
    return map;
  }, [profileOptions]);

  const { data: allLeads = [], isLoading } = useQuery({
    queryKey: ['my-leads-all'],
    enabled: open && !!user,
    queryFn: fetchAllLeads,
  });

  const batchNames = useMemo(() => {
    const names = new Set<string>();
    allLeads.forEach((l: any) => l.batch_name && names.add(l.batch_name));
    return Array.from(names).sort();
  }, [allLeads]);

  const statusCounts = useMemo(() => {
    const counts: Record<string, number> = { total: allLeads.length };
    statusOptions.forEach(s => { counts[s.value] = 0; });
    allLeads.forEach((l: any) => { counts[l.status] = (counts[l.status] || 0) + 1; });
    return counts;
  }, [allLeads, statusOptions]);

  const perfilCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    profileOptions.forEach(p => { counts[p.value] = 0; });
    allLeads.forEach((l: any) => {
      if (l.perfil) counts[l.perfil] = (counts[l.perfil] || 0) + 1;
    });
    return counts;
  }, [allLeads, profileOptions]);

  const contactedPercent = useMemo(() => {
    if (allLeads.length === 0) return 0;
    const contacted = allLeads.filter((l: any) => l.status !== 'pendente').length;
    return Math.round((contacted / allLeads.length) * 100);
  }, [allLeads]);

  const filteredLeads = useMemo(() => {
    let result = [...allLeads];
    if (filterStatus !== 'all') result = result.filter((l: any) => l.status === filterStatus);
    if (filterPerfil !== 'all') result = result.filter((l: any) => l.perfil === filterPerfil);
    if (filterBatch !== 'all') result = result.filter((l: any) => l.batch_name === filterBatch);
    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      result = result.filter((l: any) =>
        (l.nome && l.nome.toLowerCase().includes(term)) ||
        (l.telefone && l.telefone.includes(term)) ||
        (l.cpf && l.cpf.includes(term))
      );
    }
    result.sort((a: any, b: any) => {
      const av = a[sortField] ?? '';
      const bv = b[sortField] ?? '';
      const cmp = typeof av === 'number' ? av - bv : String(av).localeCompare(String(bv));
      return sortDir === 'asc' ? cmp : -cmp;
    });
    return result;
  }, [allLeads, filterStatus, filterPerfil, filterBatch, searchTerm, sortField, sortDir]);

  const totalPages = Math.max(1, Math.ceil(filteredLeads.length / PAGE_SIZE));
  const pagedLeads = filteredLeads.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);

  const handleFilterStatus = (v: string) => { setFilterStatus(v); setPage(0); };
  const handleFilterPerfil = (v: string) => { setFilterPerfil(v); setPage(0); };
  const handleFilterBatch = (v: string) => { setFilterBatch(v); setPage(0); };
  const handleSearch = (v: string) => { setSearchTerm(v); setPage(0); };

  const toggleSort = (field: SortField) => {
    if (sortField === field) setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    else { setSortField(field); setSortDir('asc'); }
  };

  const handleSaveLead = async () => {
    if (!selectedLead) return;
    setIsSaving(true);
    try {
      const updates: any = { status: editStatus, notes: editNotes, updated_at: new Date().toISOString() };
      if (editStatus !== selectedLead.status) updates.contacted_at = new Date().toISOString();
      const { error } = await supabase.from('client_leads' as any).update(updates).eq('id', selectedLead.id);
      if (error) throw error;
      toast({ title: 'Lead atualizado' });
      queryClient.invalidateQueries({ queryKey: ['my-leads-all'] });
      setSelectedLead(null);
    } catch (error: any) {
      toast({ title: 'Erro', description: error.message, variant: 'destructive' });
    } finally {
      setIsSaving(false);
    }
  };

  const handleQuickStatus = async (lead: any, newStatus: string) => {
    const { error } = await supabase.from('client_leads' as any).update({
      status: newStatus,
      updated_at: new Date().toISOString(),
      ...(newStatus !== lead.status ? { contacted_at: new Date().toISOString() } : {}),
    }).eq('id', lead.id);
    if (error) {
      toast({ title: 'Erro', description: error.message, variant: 'destructive' });
    } else {
      queryClient.invalidateQueries({ queryKey: ['my-leads-all'] });
    }
  };

  const handleContact = (lead: any) => {
    if (lead.telefone && onStartConversation) {
      let phone = lead.telefone.replace(/\D/g, '');
      if (!phone.startsWith('55') && phone.length <= 11) phone = '55' + phone;
      onStartConversation(phone, lead.nome);
      onOpenChange(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-5xl max-h-[85vh] flex flex-col overflow-hidden">
        <DialogHeader className="flex-shrink-0">
          <DialogTitle className="flex items-center gap-2">
            <Phone className="w-5 h-5" />
            Meus Leads
          </DialogTitle>
        </DialogHeader>

        {/* Progress bar */}
        <div className="flex-shrink-0 space-y-1">
          <div className="flex justify-between text-xs text-muted-foreground">
            <span>{contactedPercent}% contatados</span>
            <span>{allLeads.filter((l: any) => l.status !== 'pendente').length}/{allLeads.length}</span>
          </div>
          <Progress value={contactedPercent} className="h-2" />
        </div>

        {/* Status filter badges */}
        <div className="flex-shrink-0 flex flex-wrap gap-2">
          <Badge
            variant={filterStatus === 'all' ? 'default' : 'outline'}
            className="cursor-pointer"
            onClick={() => handleFilterStatus('all')}
          >
            Todos: {statusCounts.total}
          </Badge>
          {statusOptions.map(s => (
            <Badge
              key={s.value}
              className={`cursor-pointer ${filterStatus === s.value ? s.color_class : 'bg-muted/50 text-muted-foreground hover:bg-muted'}`}
              onClick={() => handleFilterStatus(filterStatus === s.value ? 'all' : s.value)}
            >
              {s.label}: {statusCounts[s.value] || 0}
            </Badge>
          ))}
        </div>

        {/* Profile filter badges */}
        {profileOptions.length > 0 && (
          <div className="flex-shrink-0 flex flex-wrap gap-2">
            <span className="text-xs text-muted-foreground self-center mr-1">Perfil:</span>
            <Badge
              variant={filterPerfil === 'all' ? 'default' : 'outline'}
              className="cursor-pointer"
              onClick={() => handleFilterPerfil('all')}
            >
              Todos
            </Badge>
            {profileOptions.map(p => (
              <Badge
                key={p.value}
                className={`cursor-pointer ${filterPerfil === p.value ? p.color_class : 'bg-muted/50 text-muted-foreground hover:bg-muted'}`}
                onClick={() => handleFilterPerfil(filterPerfil === p.value ? 'all' : p.value)}
              >
                {p.label}: {perfilCounts[p.value] || 0}
              </Badge>
            ))}
          </div>
        )}

        {/* Filters */}
        <div className="flex-shrink-0 flex gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input placeholder="Buscar por nome, telefone ou CPF..." value={searchTerm} onChange={(e) => handleSearch(e.target.value)} className="pl-9" />
          </div>
          {batchNames.length > 0 && (
            <Select value={filterBatch} onValueChange={handleFilterBatch}>
              <SelectTrigger className="w-44">
                <SelectValue placeholder="Lote" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos os lotes</SelectItem>
                {batchNames.map(b => <SelectItem key={b} value={b}>{b}</SelectItem>)}
              </SelectContent>
            </Select>
          )}
        </div>

        {selectedLead ? (
          <ScrollArea className="flex-1 min-h-0">
            <div className="space-y-4 pr-4">
              <Button variant="ghost" size="sm" onClick={() => setSelectedLead(null)}>
                <ChevronRight className="w-4 h-4 mr-1 rotate-180" /> Voltar
              </Button>
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div><span className="text-muted-foreground">Nome:</span> <strong>{selectedLead.nome}</strong></div>
                <div><span className="text-muted-foreground">Telefone:</span> <strong>{selectedLead.telefone}</strong></div>
                <div><span className="text-muted-foreground">CPF:</span> {selectedLead.cpf || '-'}</div>
                <div><span className="text-muted-foreground">Perfil:</span> {selectedLead.perfil || '-'}</div>
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
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {statusOptions.map(s => <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">Observações</label>
                <Textarea value={editNotes} onChange={(e) => setEditNotes(e.target.value)} placeholder="Anotações sobre este lead..." rows={3} />
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
          </ScrollArea>
        ) : (
          <div className="flex-1 min-h-0 flex flex-col">
            <ScrollArea className="flex-1 min-h-0">
              {isLoading ? (
                <div className="flex justify-center py-8">
                  <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
                </div>
              ) : filteredLeads.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  Nenhum lead encontrado.
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="cursor-pointer" onClick={() => toggleSort('nome')}>
                        Nome <ArrowUpDown className="inline w-3 h-3 ml-1" />
                      </TableHead>
                      <TableHead>CPF</TableHead>
                      <TableHead>Telefone</TableHead>
                      <TableHead className="cursor-pointer" onClick={() => toggleSort('valor_lib')}>
                        Valor Lib. <ArrowUpDown className="inline w-3 h-3 ml-1" />
                      </TableHead>
                      <TableHead>Perfil</TableHead>
                      <TableHead className="cursor-pointer" onClick={() => toggleSort('status')}>
                        Status <ArrowUpDown className="inline w-3 h-3 ml-1" />
                      </TableHead>
                      <TableHead className="w-24">Ações</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {pagedLeads.map((lead: any) => (
                      <TableRow key={lead.id} className="cursor-pointer" onClick={() => { setSelectedLead(lead); setEditStatus(lead.status); setEditNotes(lead.notes || ''); }}>
                        <TableCell className="font-medium">{lead.nome}</TableCell>
                        <TableCell className="text-xs text-muted-foreground">{lead.cpf || '-'}</TableCell>
                        <TableCell>{lead.telefone}</TableCell>
                        <TableCell>
                          {lead.valor_lib ? Number(lead.valor_lib).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }) : '-'}
                        </TableCell>
                        <TableCell>
                          {lead.perfil ? (
                            <Badge className={profileColorMap[lead.perfil] || 'bg-muted text-muted-foreground'}>
                              {lead.perfil}
                            </Badge>
                          ) : '-'}
                        </TableCell>
                        <TableCell onClick={(e) => e.stopPropagation()}>
                          <Select value={lead.status} onValueChange={(v) => handleQuickStatus(lead, v)}>
                            <SelectTrigger className="h-7 w-32 text-xs border-0 p-1">
                              <Badge className={statusColorMap[lead.status] || 'bg-muted text-muted-foreground'}>
                                {lead.status}
                              </Badge>
                            </SelectTrigger>
                            <SelectContent>
                              {statusOptions.map(s => <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>)}
                            </SelectContent>
                          </Select>
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
            </ScrollArea>

            {/* Pagination */}
            <div className="flex-shrink-0 flex items-center justify-between pt-2 border-t">
              <p className="text-sm text-muted-foreground">
                {filteredLeads.length} leads · Página {page + 1}/{totalPages}
              </p>
              <div className="flex gap-1">
                <Button variant="outline" size="sm" disabled={page === 0} onClick={() => setPage(p => p - 1)}>
                  <ChevronLeft className="w-4 h-4" />
                </Button>
                <Button variant="outline" size="sm" disabled={page >= totalPages - 1} onClick={() => setPage(p => p + 1)}>
                  <ChevronRight className="w-4 h-4" />
                </Button>
              </div>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
