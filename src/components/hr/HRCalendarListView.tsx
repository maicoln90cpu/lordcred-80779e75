import { useMemo, useState } from 'react';
import { parseISO, isBefore, isAfter } from 'date-fns';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import HRCalendarEventCard from './HRCalendarEventCard';
import type { HRCalendarEvent } from '@/hooks/useHRCalendarEvents';

interface Props {
  events: HRCalendarEvent[];
  loading: boolean;
  candidateNameById: Map<string, string>;
  onEdit: (ev: HRCalendarEvent) => void;
  onDelete: (id: string) => void;
}

const PAGE_SIZE = 30;

/**
 * Onda 3 (item 2): View Lista — todos os eventos cronologicamente,
 * com filtro futuros / passados / todos e paginação simples.
 */
export default function HRCalendarListView({
  events, loading, candidateNameById, onEdit, onDelete,
}: Props) {
  const [filter, setFilter] = useState<'upcoming' | 'past' | 'all'>('upcoming');
  const [visible, setVisible] = useState(PAGE_SIZE);

  const filtered = useMemo(() => {
    const now = new Date();
    const sorted = [...events].sort((a, b) =>
      filter === 'past'
        ? b.starts_at.localeCompare(a.starts_at) // passados: mais recente primeiro
        : a.starts_at.localeCompare(b.starts_at), // futuros/todos: cronológico
    );
    if (filter === 'upcoming') return sorted.filter((e) => !isBefore(parseISO(e.starts_at), now));
    if (filter === 'past') return sorted.filter((e) => isAfter(now, parseISO(e.starts_at)));
    return sorted;
  }, [events, filter]);

  const visibleEvents = filtered.slice(0, visible);

  return (
    <div className="space-y-3">
      <Tabs
        value={filter}
        onValueChange={(v) => { setFilter(v as typeof filter); setVisible(PAGE_SIZE); }}
      >
        <TabsList>
          <TabsTrigger value="upcoming">Futuros ({events.filter((e) => !isBefore(parseISO(e.starts_at), new Date())).length})</TabsTrigger>
          <TabsTrigger value="past">Passados</TabsTrigger>
          <TabsTrigger value="all">Todos ({events.length})</TabsTrigger>
        </TabsList>
      </Tabs>

      {loading ? (
        <Card className="p-8 text-center text-sm text-muted-foreground">Carregando...</Card>
      ) : visibleEvents.length === 0 ? (
        <Card className="p-8 text-center text-sm text-muted-foreground">
          Nenhum evento {filter === 'upcoming' ? 'futuro' : filter === 'past' ? 'passado' : ''} para exibir.
        </Card>
      ) : (
        <>
          {visibleEvents.map((ev) => (
            <HRCalendarEventCard
              key={ev.id}
              event={ev}
              candidateName={ev.candidate_id ? candidateNameById.get(ev.candidate_id) : null}
              showDate
              onEdit={onEdit}
              onDelete={onDelete}
            />
          ))}
          {visible < filtered.length && (
            <div className="flex justify-center pt-2">
              <Button variant="outline" size="sm" onClick={() => setVisible((v) => v + PAGE_SIZE)}>
                Carregar mais ({filtered.length - visible} restantes)
              </Button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
