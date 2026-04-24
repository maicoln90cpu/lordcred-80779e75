import { useMemo, useState } from 'react';
import { useHRPartnerLeads, type HRPartnerLead, type HRMeetingStatus, type HRAcquisitionSource } from '@/hooks/useHRPartnerLeads';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Plus, Search, Trash2, Phone, Users2 } from 'lucide-react';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { cn } from '@/lib/utils';

const MEETING_STATUS: { value: HRMeetingStatus; label: string; color: string }[] = [
  { value: 'called', label: 'Chamada feita', color: 'text-amber-600' },
  { value: 'include_next', label: 'Incluir na próxima', color: 'text-blue-600' },
  { value: 'scheduled', label: 'Agendada', color: 'text-emerald-600' },
];

const SOURCE_OPTIONS: { value: HRAcquisitionSource; label: string }[] = [
  { value: 'interview', label: 'Entrevista' },
  { value: 'referral', label: 'Indicação' },
];

function formatPhone(p: string) {
  const d = (p || '').replace(/\D/g, '');
  if (d.length === 11) return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`;
  if (d.length === 10) return `(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}`;
  return p;
}

export function HRPartnerLeadsTab() {
  const { leads, loading, createLead, updateLead, deleteLead } = useHRPartnerLeads();
  const [search, setSearch] = useState('');
  const [filterStatus, setFilterStatus] = useState<string>('__all__');
  const [filterSource, setFilterSource] = useState<string>('__all__');
  const [filterAccepted, setFilterAccepted] = useState<string>('__all__');
  const [creating, setCreating] = useState(false);
  const [newName, setNewName] = useState('');
  const [newPhone, setNewPhone] = useState('');

  const filtered = useMemo(() => {
    const q = search.toLowerCase().trim();
    return leads.filter((l) => {
      if (q) {
        const hay = `${l.full_name} ${l.phone} ${l.cpf ?? ''}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      if (filterStatus !== '__all__' && l.meeting_status !== filterStatus) return false;
      if (filterSource !== '__all__' && l.acquisition_source !== filterSource) return false;
      if (filterAccepted === 'yes' && !l.accepted) return false;
      if (filterAccepted === 'no' && l.accepted) return false;
      return true;
    });
  }, [leads, search, filterStatus, filterSource, filterAccepted]);

  const indicators = useMemo(() => ({
    total: leads.length,
    accepted: leads.filter((l) => l.accepted).length,
    scheduled: leads.filter((l) => l.meeting_status === 'scheduled').length,
    mei: leads.filter((l) => l.mei_informed).length,
  }), [leads]);

  const handleQuickCreate = async () => {
    if (!newName.trim() || !newPhone.trim()) return;
    await createLead({ full_name: newName.trim(), phone: newPhone.replace(/\D/g, '') });
    setNewName('');
    setNewPhone('');
    setCreating(false);
  };

  const handlePatch = (id: string, patch: Partial<HRPartnerLead>) => {
    updateLead(id, patch);
  };

  return (
    <div className="space-y-4">
      {/* Indicadores */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Card className="p-3">
          <div className="text-xs text-muted-foreground">Total parceiros</div>
          <div className="text-2xl font-bold">{indicators.total}</div>
        </Card>
        <Card className="p-3">
          <div className="text-xs text-muted-foreground">Aceitaram</div>
          <div className="text-2xl font-bold text-emerald-600">{indicators.accepted}</div>
        </Card>
        <Card className="p-3">
          <div className="text-xs text-muted-foreground">Reuniões agendadas</div>
          <div className="text-2xl font-bold text-blue-600">{indicators.scheduled}</div>
        </Card>
        <Card className="p-3">
          <div className="text-xs text-muted-foreground">MEI informado</div>
          <div className="text-2xl font-bold text-amber-600">{indicators.mei}</div>
        </Card>
      </div>

      {/* Filtros */}
      <Card className="p-3">
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative flex-1 min-w-[220px]">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Buscar por nome, telefone ou CPF..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9"
            />
          </div>
          <Select value={filterStatus} onValueChange={setFilterStatus}>
            <SelectTrigger className="w-[180px]"><SelectValue placeholder="Status reunião" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="__all__">Todas reuniões</SelectItem>
              {MEETING_STATUS.map((s) => <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={filterSource} onValueChange={setFilterSource}>
            <SelectTrigger className="w-[160px]"><SelectValue placeholder="Origem" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="__all__">Todas origens</SelectItem>
              {SOURCE_OPTIONS.map((s) => <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={filterAccepted} onValueChange={setFilterAccepted}>
            <SelectTrigger className="w-[140px]"><SelectValue placeholder="Aceitou?" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="__all__">Todos</SelectItem>
              <SelectItem value="yes">Aceitaram</SelectItem>
              <SelectItem value="no">Não aceitaram</SelectItem>
            </SelectContent>
          </Select>
          <Button onClick={() => setCreating((v) => !v)} className="ml-auto gap-2">
            <Plus className="w-4 h-4" /> Novo parceiro
          </Button>
        </div>

        {creating && (
          <div className="flex flex-wrap items-end gap-2 mt-3 pt-3 border-t border-border">
            <div className="flex-1 min-w-[200px]">
              <label className="text-xs text-muted-foreground">Nome completo</label>
              <Input value={newName} onChange={(e) => setNewName(e.target.value)} placeholder="João Silva" />
            </div>
            <div className="w-[180px]">
              <label className="text-xs text-muted-foreground">Telefone</label>
              <Input value={newPhone} onChange={(e) => setNewPhone(e.target.value)} placeholder="11999999999" />
            </div>
            <Button onClick={handleQuickCreate} disabled={!newName.trim() || !newPhone.trim()}>Adicionar</Button>
            <Button variant="ghost" onClick={() => setCreating(false)}>Cancelar</Button>
          </div>
        )}
      </Card>

      {/* Tabela */}
      <Card>
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="min-w-[180px]">Nome</TableHead>
                <TableHead className="min-w-[140px]">Telefone</TableHead>
                <TableHead className="w-[80px]">Idade</TableHead>
                <TableHead className="min-w-[140px]">CPF</TableHead>
                <TableHead className="min-w-[140px]">Data entrevista</TableHead>
                <TableHead className="min-w-[160px]">Status reunião</TableHead>
                <TableHead className="min-w-[140px]">Data reunião</TableHead>
                <TableHead className="w-[80px]">Link</TableHead>
                <TableHead className="w-[80px]">Aceitou</TableHead>
                <TableHead className="w-[80px]">MEI</TableHead>
                <TableHead className="min-w-[140px]">Origem</TableHead>
                <TableHead className="w-[60px]"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading && (
                <TableRow><TableCell colSpan={12} className="text-center py-8 text-muted-foreground">Carregando...</TableCell></TableRow>
              )}
              {!loading && filtered.length === 0 && (
                <TableRow>
                  <TableCell colSpan={12} className="text-center py-12 text-muted-foreground">
                    <Users2 className="w-8 h-8 mx-auto mb-2 opacity-40" />
                    <p className="text-sm">Nenhum parceiro encontrado.</p>
                  </TableCell>
                </TableRow>
              )}
              {filtered.map((lead) => (
                <PartnerRow key={lead.id} lead={lead} onPatch={handlePatch} onDelete={deleteLead} />
              ))}
            </TableBody>
          </Table>
        </div>
        <div className="px-4 py-2 text-xs text-muted-foreground border-t border-border">
          Mostrando {filtered.length} de {leads.length} parceiros
        </div>
      </Card>
    </div>
  );
}

interface RowProps {
  lead: HRPartnerLead;
  onPatch: (id: string, patch: Partial<HRPartnerLead>) => void;
  onDelete: (id: string) => Promise<void>;
}

function PartnerRow({ lead, onPatch, onDelete }: RowProps) {
  const [name, setName] = useState(lead.full_name);
  const [phone, setPhone] = useState(lead.phone);
  const [age, setAge] = useState<string>(lead.age?.toString() ?? '');
  const [cpf, setCpf] = useState(lead.cpf ?? '');

  const meetingStatus = MEETING_STATUS.find((s) => s.value === lead.meeting_status);

  return (
    <TableRow>
      <TableCell>
        <Input
          value={name}
          onChange={(e) => setName(e.target.value)}
          onBlur={() => name !== lead.full_name && onPatch(lead.id, { full_name: name })}
          className="h-8"
        />
      </TableCell>
      <TableCell>
        <div className="flex items-center gap-1">
          <Input
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            onBlur={() => phone !== lead.phone && onPatch(lead.id, { phone: phone.replace(/\D/g, '') })}
            className="h-8 font-mono text-xs"
            placeholder={formatPhone(lead.phone)}
          />
          <a href={`https://wa.me/55${lead.phone.replace(/\D/g, '')}`} target="_blank" rel="noreferrer" title="Abrir WhatsApp">
            <Phone className="w-3.5 h-3.5 text-emerald-600" />
          </a>
        </div>
      </TableCell>
      <TableCell>
        <Input
          type="number"
          value={age}
          onChange={(e) => setAge(e.target.value)}
          onBlur={() => {
            const v = age ? parseInt(age, 10) : null;
            if (v !== lead.age) onPatch(lead.id, { age: v });
          }}
          className="h-8 w-16"
        />
      </TableCell>
      <TableCell>
        <Input
          value={cpf}
          onChange={(e) => setCpf(e.target.value)}
          onBlur={() => cpf !== (lead.cpf ?? '') && onPatch(lead.id, { cpf: cpf || null })}
          className="h-8 font-mono text-xs"
          placeholder="000.000.000-00"
        />
      </TableCell>
      <TableCell>
        <DateCell
          value={lead.interview_date}
          onChange={(d) => onPatch(lead.id, { interview_date: d })}
        />
      </TableCell>
      <TableCell>
        <Select value={lead.meeting_status} onValueChange={(v) => onPatch(lead.id, { meeting_status: v as HRMeetingStatus })}>
          <SelectTrigger className={cn('h-8 text-xs', meetingStatus?.color)}><SelectValue /></SelectTrigger>
          <SelectContent>
            {MEETING_STATUS.map((s) => <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>)}
          </SelectContent>
        </Select>
      </TableCell>
      <TableCell>
        <DateCell
          value={lead.meeting_date}
          onChange={(d) => onPatch(lead.id, { meeting_date: d })}
        />
      </TableCell>
      <TableCell className="text-center">
        <Checkbox checked={lead.sent_link} onCheckedChange={(c) => onPatch(lead.id, { sent_link: !!c })} />
      </TableCell>
      <TableCell className="text-center">
        <Checkbox checked={lead.accepted} onCheckedChange={(c) => onPatch(lead.id, { accepted: !!c })} />
      </TableCell>
      <TableCell className="text-center">
        <Checkbox checked={lead.mei_informed} onCheckedChange={(c) => onPatch(lead.id, { mei_informed: !!c })} />
      </TableCell>
      <TableCell>
        <Select value={lead.acquisition_source} onValueChange={(v) => onPatch(lead.id, { acquisition_source: v as HRAcquisitionSource })}>
          <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
          <SelectContent>
            {SOURCE_OPTIONS.map((s) => <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>)}
          </SelectContent>
        </Select>
      </TableCell>
      <TableCell>
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8 text-destructive hover:text-destructive"
          onClick={() => {
            if (confirm(`Remover parceiro "${lead.full_name}"?`)) onDelete(lead.id);
          }}
        >
          <Trash2 className="w-4 h-4" />
        </Button>
      </TableCell>
    </TableRow>
  );
}

function DateCell({ value, onChange }: { value: string | null; onChange: (d: string | null) => void }) {
  const date = value ? new Date(value) : undefined;
  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="outline" size="sm" className="h-8 text-xs font-normal w-full justify-start">
          {date ? format(date, 'dd/MM/yyyy', { locale: ptBR }) : <span className="text-muted-foreground">—</span>}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-0" align="start">
        <Calendar
          mode="single"
          selected={date}
          onSelect={(d) => onChange(d ? d.toISOString() : null)}
          locale={ptBR}
        />
        {value && (
          <div className="p-2 border-t border-border">
            <Button variant="ghost" size="sm" className="w-full text-xs" onClick={() => onChange(null)}>
              Limpar data
            </Button>
          </div>
        )}
      </PopoverContent>
    </Popover>
  );
}
