import { useMemo } from 'react';
import { format, parseISO, isBefore, addDays, startOfDay, isSameDay } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Card } from '@/components/ui/card';
import HRCalendarEventCard from './HRCalendarEventCard';
import type { HRCalendarEvent } from '@/hooks/useHRCalendarEvents';

interface Props {
  events: HRCalendarEvent[];
  loading: boolean;
  candidateNameById: Map<string, string>;
  onEdit: (ev: HRCalendarEvent) => void;
  onDelete: (id: string) => void;
}

/**
 * Onda 3 (item 2): View Agenda — próximos 30 dias agrupados por dia,
 * com cabeçalho colado no topo (sticky) por seção.
 */
export default function HRCalendarAgendaView({
  events, loading, candidateNameById, onEdit, onDelete,
}: Props) {
  const groups = useMemo(() => {
    const today = startOfDay(new Date());
    const horizon = addDays(today, 30);
    const upcoming = events
      .filter((e) => {
        const d = parseISO(e.starts_at);
        return !isBefore(d, today) && isBefore(d, horizon);
      })
      .sort((a, b) => a.starts_at.localeCompare(b.starts_at));

    const map = new Map<string, HRCalendarEvent[]>();
    upcoming.forEach((ev) => {
      const key = format(parseISO(ev.starts_at), 'yyyy-MM-dd');
      const list = map.get(key) ?? [];
      list.push(ev);
      map.set(key, list);
    });
    return Array.from(map.entries()); // [ ['2026-04-30', [...]], ... ]
  }, [events]);

  if (loading) {
    return <Card className="p-8 text-center text-sm text-muted-foreground">Carregando...</Card>;
  }
  if (groups.length === 0) {
    return (
      <Card className="p-8 text-center text-sm text-muted-foreground">
        Nenhum evento nos próximos 30 dias.
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      {groups.map(([dayKey, items]) => {
        const dayDate = parseISO(`${dayKey}T00:00:00`);
        const isToday = isSameDay(dayDate, new Date());
        return (
          <div key={dayKey} className="space-y-2">
            <div className="sticky top-0 z-10 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/70 py-1.5 border-b border-border/40">
              <h3 className="text-sm font-semibold flex items-center gap-2">
                <span className={isToday ? 'text-primary' : ''}>
                  {format(dayDate, "EEEE, d 'de' MMMM", { locale: ptBR })}
                </span>
                {isToday && (
                  <span className="text-[10px] uppercase tracking-wide px-1.5 py-0.5 rounded bg-primary text-primary-foreground">
                    Hoje
                  </span>
                )}
                <span className="text-xs text-muted-foreground font-normal">
                  · {items.length} evento{items.length === 1 ? '' : 's'}
                </span>
              </h3>
            </div>
            {items.map((ev) => (
              <HRCalendarEventCard
                key={ev.id}
                event={ev}
                candidateName={ev.candidate_id ? candidateNameById.get(ev.candidate_id) : null}
                onEdit={onEdit}
                onDelete={onDelete}
              />
            ))}
          </div>
        );
      })}
    </div>
  );
}
