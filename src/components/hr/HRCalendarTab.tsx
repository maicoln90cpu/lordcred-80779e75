import { useMemo, useState } from 'react';
import { format, parseISO, startOfDay, endOfDay } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Calendar } from '@/components/ui/calendar';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { CalendarDays, Plus, List, LayoutGrid, CalendarClock, Filter } from 'lucide-react';
import {
  useHRCalendarEvents, EVENT_TYPE_LABEL,
  type HRCalendarEvent, type HRCalendarEventType,
} from '@/hooks/useHRCalendarEvents';
import { useHRCandidates } from '@/hooks/useHRCandidates';
import { useHREmployees } from '@/hooks/useHREmployees';
import HRCalendarEventCard from './HRCalendarEventCard';
import HRCalendarListView from './HRCalendarListView';
import HRCalendarAgendaView from './HRCalendarAgendaView';

function toLocalInput(iso: string | null) {
  if (!iso) return '';
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function fromLocalInput(value: string): string {
  // Trata como horário de São Paulo (-03:00) — regra de timezone do projeto.
  if (!value) return '';
  return new Date(`${value}:00-03:00`).toISOString();
}

interface EventFormState {
  id?: string;
  title: string;
  description: string;
  event_type: HRCalendarEventType;
  candidate_id: string | null;
  starts_at: string;
  ends_at: string;
  location: string;
}

const EMPTY_FORM: EventFormState = {
  title: '', description: '', event_type: 'meeting', candidate_id: null,
  starts_at: '', ends_at: '', location: '',
};

type CalendarView = 'month' | 'list' | 'agenda';
type EntityFilter = 'all' | 'candidate' | 'employee';

export function HRCalendarTab() {
  const { events: allEvents, loading, createEvent, updateEvent, deleteEvent } = useHRCalendarEvents();
  const { candidates } = useHRCandidates();
  const { employees } = useHREmployees();
  const [view, setView] = useState<CalendarView>('month');
  const [entityFilter, setEntityFilter] = useState<EntityFilter>('all');
  const [selectedDay, setSelectedDay] = useState<Date>(new Date());
  const [dialogOpen, setDialogOpen] = useState(false);
  const [form, setForm] = useState<EventFormState>(EMPTY_FORM);
  const [saving, setSaving] = useState(false);

  const events = useMemo(() => {
    if (entityFilter === 'all') return allEvents;
    return allEvents.filter(ev => (ev as any).entity_type === entityFilter);
  }, [allEvents, entityFilter]);

  // Mapa para destacar dias com evento no mês.
  const eventsByDay = useMemo(() => {
    const map = new Map<string, HRCalendarEvent[]>();
    events.forEach((ev) => {
      const key = format(parseISO(ev.starts_at), 'yyyy-MM-dd');
      const list = map.get(key) ?? [];
      list.push(ev);
      map.set(key, list);
    });
    return map;
  }, [events]);

  // Mapa candidato/colaborador → nome (evita find() em loop nas views).
  const candidateNameById = useMemo(() => {
    const m = new Map<string, string>();
    candidates.forEach((c) => m.set(c.id, c.full_name));
    employees.forEach((e) => m.set(e.id, e.full_name));
    return m;
  }, [candidates, employees]);

  const dayEvents = useMemo(() => {
    return events
      .filter((ev) => {
        const d = parseISO(ev.starts_at);
        return d >= startOfDay(selectedDay) && d <= endOfDay(selectedDay);
      })
      .sort((a, b) => a.starts_at.localeCompare(b.starts_at));
  }, [events, selectedDay]);

  const openCreate = () => {
    const base = new Date(selectedDay);
    base.setHours(9, 0, 0, 0);
    setForm({ ...EMPTY_FORM, starts_at: toLocalInput(base.toISOString()) });
    setDialogOpen(true);
  };

  const openEdit = (ev: HRCalendarEvent) => {
    setForm({
      id: ev.id, title: ev.title, description: ev.description ?? '',
      event_type: ev.event_type, candidate_id: ev.candidate_id,
      starts_at: toLocalInput(ev.starts_at), ends_at: toLocalInput(ev.ends_at),
      location: ev.location ?? '',
    });
    setDialogOpen(true);
  };

  const handleSave = async () => {
    if (!form.title.trim() || !form.starts_at) return;
    setSaving(true);
    try {
      const payload = {
        title: form.title.trim(),
        description: form.description.trim() || null,
        event_type: form.event_type,
        candidate_id: form.candidate_id || null,
        starts_at: fromLocalInput(form.starts_at),
        ends_at: form.ends_at ? fromLocalInput(form.ends_at) : null,
        location: form.location.trim() || null,
      };
      if (form.id) await updateEvent(form.id, payload);
      else await createEvent(payload);
      setDialogOpen(false);
    } finally { setSaving(false); }
  };

  return (
    <div className="space-y-4">
      {/* Toolbar: toggle de view + botão Novo evento */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <Tabs value={view} onValueChange={(v) => setView(v as CalendarView)}>
          <TabsList>
            <TabsTrigger value="month" className="gap-1.5">
              <LayoutGrid className="w-4 h-4" /> Mês
            </TabsTrigger>
            <TabsTrigger value="list" className="gap-1.5">
              <List className="w-4 h-4" /> Lista
            </TabsTrigger>
            <TabsTrigger value="agenda" className="gap-1.5">
              <CalendarClock className="w-4 h-4" /> Agenda (30 dias)
            </TabsTrigger>
          </TabsList>
        </Tabs>
        <div className="flex items-center gap-2">
          <Select value={entityFilter} onValueChange={v => setEntityFilter(v as EntityFilter)}>
            <SelectTrigger className="w-[160px] h-8 text-xs">
              <Filter className="w-3 h-3 mr-1" /><SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos</SelectItem>
              <SelectItem value="candidate">Candidatos</SelectItem>
              <SelectItem value="employee">Colaboradores</SelectItem>
            </SelectContent>
          </Select>
          <Badge variant="secondary">{events.length} eventos no total</Badge>
          <Button size="sm" onClick={openCreate} className="gap-1.5">
            <Plus className="w-4 h-4" /> Novo evento
          </Button>
        </div>
      </div>

      {/* === View Mês: layout original (calendário + lista do dia) === */}
      {view === 'month' && (
        <div className="grid grid-cols-1 lg:grid-cols-[auto_1fr] gap-6">
          <Card className="p-4 w-fit h-fit">
            <Calendar
              mode="single"
              locale={ptBR}
              selected={selectedDay}
              onSelect={(d) => d && setSelectedDay(d)}
              modifiers={{
                hasEvent: (date) => eventsByDay.has(format(date, 'yyyy-MM-dd')),
              }}
              modifiersClassNames={{
                hasEvent: 'relative font-bold text-primary after:content-[""] after:absolute after:bottom-1 after:left-1/2 after:-translate-x-1/2 after:w-1 after:h-1 after:rounded-full after:bg-primary',
              }}
              className="p-3 pointer-events-auto"
            />
            <div className="mt-3 pt-3 border-t border-border/40 text-xs text-muted-foreground">
              <p className="text-[11px] text-muted-foreground/70">
                Integração com Google Calendar será adicionada futuramente.
              </p>
            </div>
          </Card>

          <div className="space-y-3 min-w-0">
            <div>
              <h2 className="text-lg font-semibold flex items-center gap-2">
                <CalendarDays className="w-5 h-5" />
                {format(selectedDay, "EEEE, d 'de' MMMM 'de' yyyy", { locale: ptBR })}
              </h2>
              <p className="text-xs text-muted-foreground">
                {dayEvents.length} evento{dayEvents.length === 1 ? '' : 's'} neste dia
              </p>
            </div>

            {loading ? (
              <Card className="p-8 text-center text-sm text-muted-foreground">Carregando...</Card>
            ) : dayEvents.length === 0 ? (
              <Card className="p-8 text-center text-sm text-muted-foreground">
                Nenhum evento neste dia. Clique em <b>Novo evento</b> para adicionar.
              </Card>
            ) : (
              dayEvents.map((ev) => (
                <HRCalendarEventCard
                  key={ev.id}
                  event={ev}
                  candidateName={ev.candidate_id ? candidateNameById.get(ev.candidate_id) : null}
                  onEdit={openEdit}
                  onDelete={deleteEvent}
                />
              ))
            )}
          </div>
        </div>
      )}

      {/* === View Lista: todos os eventos cronológicos com paginação === */}
      {view === 'list' && (
        <HRCalendarListView
          events={events}
          loading={loading}
          candidateNameById={candidateNameById}
          onEdit={openEdit}
          onDelete={deleteEvent}
        />
      )}

      {/* === View Agenda: próximos 30 dias agrupados por dia === */}
      {view === 'agenda' && (
        <HRCalendarAgendaView
          events={events}
          loading={loading}
          candidateNameById={candidateNameById}
          onEdit={openEdit}
          onDelete={deleteEvent}
        />
      )}

      {/* Dialog criar/editar (compartilhado entre as 3 views) */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{form.id ? 'Editar evento' : 'Novo evento'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label>Título *</Label>
              <Input
                value={form.title}
                onChange={(e) => setForm({ ...form, title: e.target.value })}
                placeholder="Ex.: Entrevista com João"
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Tipo</Label>
                <Select
                  value={form.event_type}
                  onValueChange={(v) => setForm({ ...form, event_type: v as HRCalendarEventType })}
                >
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {Object.entries(EVENT_TYPE_LABEL).map(([k, v]) => (
                      <SelectItem key={k} value={k}>{v}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Candidato (opcional)</Label>
                <Select
                  value={form.candidate_id ?? '__none__'}
                  onValueChange={(v) => setForm({ ...form, candidate_id: v === '__none__' ? null : v })}
                >
                  <SelectTrigger><SelectValue placeholder="—" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__none__">— sem candidato —</SelectItem>
                    {candidates.slice(0, 200).map((c) => (
                      <SelectItem key={c.id} value={c.id}>{c.full_name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Início *</Label>
                <Input
                  type="datetime-local"
                  value={form.starts_at}
                  onChange={(e) => setForm({ ...form, starts_at: e.target.value })}
                />
              </div>
              <div>
                <Label>Fim</Label>
                <Input
                  type="datetime-local"
                  value={form.ends_at}
                  onChange={(e) => setForm({ ...form, ends_at: e.target.value })}
                />
              </div>
            </div>
            <div>
              <Label>Local</Label>
              <Input
                value={form.location}
                onChange={(e) => setForm({ ...form, location: e.target.value })}
                placeholder="Ex.: Google Meet, escritório, etc."
              />
            </div>
            <div>
              <Label>Descrição</Label>
              <Textarea
                value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
                rows={3}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancelar</Button>
            <Button onClick={handleSave} disabled={saving || !form.title.trim() || !form.starts_at}>
              {saving ? 'Salvando...' : 'Salvar'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
