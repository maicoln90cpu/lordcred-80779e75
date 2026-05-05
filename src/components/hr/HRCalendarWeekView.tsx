import { useEffect, useMemo, useRef, useState } from 'react';
import {
  addDays, addWeeks, subWeeks, startOfWeek, format, parseISO,
  isSameDay, differenceInMinutes, startOfDay,
} from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { cn } from '@/lib/utils';
import {
  EVENT_TYPE_LABEL, EVENT_TYPE_TOKEN,
  type HRCalendarEvent,
} from '@/hooks/useHRCalendarEvents';

interface Props {
  events: HRCalendarEvent[];
  loading: boolean;
  candidateNameById: Map<string, string>;
  onEdit: (ev: HRCalendarEvent) => void;
  onCreateAt: (date: Date) => void;
}

const HOUR_PX = 48;
const HOURS = Array.from({ length: 24 }, (_, i) => i);

interface PositionedEvent {
  ev: HRCalendarEvent;
  top: number;
  height: number;
  lane: number;
  lanes: number;
  startMin: number;
  endMin: number;
}

/**
 * Algoritmo simples de lanes para overlap (estilo Google Calendar).
 * Eventos sobrepostos compartilham largura igual.
 */
function layoutDay(events: HRCalendarEvent[], day: Date): PositionedEvent[] {
  const dayStart = startOfDay(day);
  const DAY_END_MIN = 24 * 60;
  const items = events
    .map((ev) => {
      const s = parseISO(ev.starts_at);
      // default 60 min se não houver ends_at (padrão Google)
      const e = ev.ends_at ? parseISO(ev.ends_at) : new Date(s.getTime() + 60 * 60 * 1000);
      const rawStart = differenceInMinutes(s, dayStart);
      const rawEnd = differenceInMinutes(e, dayStart);
      // clamp ao dia visível — eventos multi-dia mostram só a fatia daquele dia
      const startMin = Math.max(0, Math.min(DAY_END_MIN - 15, rawStart));
      const endMin = Math.max(startMin + 15, Math.min(DAY_END_MIN, rawEnd));
      return { ev, startMin, endMin, rawStart, rawEnd };
    })
    // mantém apenas itens que intersectam o dia
    .filter((it) => it.rawEnd > 0 && it.rawStart < DAY_END_MIN)
    .sort((a, b) => a.startMin - b.startMin);

  const lanesEnd: number[] = [];
  const assigned: { lane: number; startMin: number; endMin: number; ev: HRCalendarEvent }[] = [];
  for (const it of items) {
    let lane = lanesEnd.findIndex((end) => end <= it.startMin);
    if (lane === -1) {
      lane = lanesEnd.length;
      lanesEnd.push(it.endMin);
    } else {
      lanesEnd[lane] = it.endMin;
    }
    assigned.push({ lane, startMin: it.startMin, endMin: it.endMin, ev: it.ev });
  }

  const result: PositionedEvent[] = [];
  for (const a of assigned) {
    const overlap = assigned.filter((b) => !(b.endMin <= a.startMin || b.startMin >= a.endMin));
    const lanes = Math.max(...overlap.map((o) => o.lane)) + 1;
    const top = (a.startMin / 60) * HOUR_PX;
    const maxHeight = (DAY_END_MIN / 60) * HOUR_PX - top;
    const rawHeight = ((a.endMin - a.startMin) / 60) * HOUR_PX - 2;
    result.push({
      ev: a.ev,
      top,
      height: Math.max(20, Math.min(rawHeight, maxHeight)),
      lane: a.lane,
      lanes,
      startMin: a.startMin,
      endMin: a.endMin,
    });
  }
  return result;
}

export default function HRCalendarWeekView({
  events, loading, candidateNameById, onEdit, onCreateAt,
}: Props) {
  const [weekStart, setWeekStart] = useState(() => startOfWeek(new Date(), { weekStartsOn: 0 }));
  const [now, setNow] = useState(new Date());
  const scrollRef = useRef<HTMLDivElement>(null);

  // tick para "now indicator"
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 60_000);
    return () => clearInterval(id);
  }, []);

  // scroll automático para 7h ao montar
  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = 7 * HOUR_PX;
  }, []);

  const days = useMemo(
    () => Array.from({ length: 7 }, (_, i) => addDays(weekStart, i)),
    [weekStart],
  );

  const eventsByDay = useMemo(() => {
    const map = new Map<string, PositionedEvent[]>();
    days.forEach((d) => {
      const dayKey = format(d, 'yyyy-MM-dd');
      const dayEvents = events.filter((ev) => isSameDay(parseISO(ev.starts_at), d));
      map.set(dayKey, layoutDay(dayEvents, d));
    });
    return map;
  }, [events, days]);

  const weekLabel = `${format(weekStart, "d 'de' MMM", { locale: ptBR })} – ${format(addDays(weekStart, 6), "d 'de' MMM yyyy", { locale: ptBR })}`;

  const handleSlotClick = (day: Date, hour: number) => {
    const d = new Date(day);
    d.setHours(hour, 0, 0, 0);
    onCreateAt(d);
  };

  if (loading) {
    return <Card className="p-8 text-center text-sm text-muted-foreground">Carregando...</Card>;
  }

  return (
    <Card className="overflow-hidden">
      {/* Toolbar */}
      <div className="flex items-center justify-between gap-3 px-3 py-2 border-b border-border/40">
        <div className="flex items-center gap-1">
          <Button size="sm" variant="outline" onClick={() => setWeekStart(startOfWeek(new Date(), { weekStartsOn: 0 }))}>
            Hoje
          </Button>
          <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => setWeekStart(subWeeks(weekStart, 1))}>
            <ChevronLeft className="w-4 h-4" />
          </Button>
          <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => setWeekStart(addWeeks(weekStart, 1))}>
            <ChevronRight className="w-4 h-4" />
          </Button>
        </div>
        <h2 className="text-sm font-semibold capitalize">{weekLabel}</h2>
        <div className="w-[120px]" />
      </div>

      {/* Header dias */}
      <div className="grid grid-cols-[60px_repeat(7,1fr)] border-b border-border/40 bg-muted/20 sticky top-0 z-20">
        <div className="text-[10px] text-muted-foreground text-center py-2">GMT-03</div>
        {days.map((d) => {
          const isToday = isSameDay(d, now);
          return (
            <div key={d.toISOString()} className="text-center py-2 border-l border-border/40">
              <div className="text-[10px] uppercase tracking-wide text-muted-foreground">
                {format(d, 'EEE', { locale: ptBR })}
              </div>
              <div className={cn(
                'mt-1 mx-auto w-8 h-8 flex items-center justify-center rounded-full text-sm font-semibold',
                isToday ? 'bg-primary text-primary-foreground' : 'text-foreground',
              )}>
                {format(d, 'd')}
              </div>
            </div>
          );
        })}
      </div>

      {/* Grid scrollável */}
      <div ref={scrollRef} className="overflow-auto" style={{ maxHeight: '70vh' }}>
        <div className="grid grid-cols-[60px_repeat(7,1fr)] relative">
          {/* Coluna horários */}
          <div className="border-r border-border/40">
            {HOURS.map((h) => (
              <div
                key={h}
                className="text-[10px] text-muted-foreground text-right pr-1.5 -translate-y-1.5"
                style={{ height: HOUR_PX }}
              >
                {h === 0 ? '' : format(new Date(2000, 0, 1, h), 'h a').toUpperCase()}
              </div>
            ))}
          </div>

          {/* Colunas dos dias */}
          {days.map((day) => {
            const dayKey = format(day, 'yyyy-MM-dd');
            const positioned = eventsByDay.get(dayKey) ?? [];
            const isToday = isSameDay(day, now);
            const nowMin = now.getHours() * 60 + now.getMinutes();
            const nowTop = (nowMin / 60) * HOUR_PX;

            return (
              <div key={dayKey} className="relative border-l border-border/40">
                {/* Slots clicáveis (1h cada) */}
                {HOURS.map((h) => (
                  <div
                    key={h}
                    className="border-b border-border/30 hover:bg-accent/30 cursor-pointer transition-colors"
                    style={{ height: HOUR_PX }}
                    onClick={() => handleSlotClick(day, h)}
                  />
                ))}

                {/* Now indicator */}
                {isToday && (
                  <div
                    className="absolute left-0 right-0 z-10 pointer-events-none"
                    style={{ top: nowTop }}
                  >
                    <div className="h-px bg-destructive relative">
                      <div className="absolute -left-1 -top-1 w-2.5 h-2.5 rounded-full bg-destructive" />
                    </div>
                  </div>
                )}

                {/* Eventos */}
                {positioned.map(({ ev, top, height, lane, lanes }) => {
                  const color = `hsl(var(${EVENT_TYPE_TOKEN[ev.event_type]}))`;
                  const widthPct = 100 / lanes;
                  const candidateName = ev.candidate_id ? candidateNameById.get(ev.candidate_id) : null;
                  return (
                    <button
                      key={ev.id}
                      type="button"
                      aria-label={`${ev.title} às ${format(parseISO(ev.starts_at), 'HH:mm')}`}
                      onClick={(e) => { e.stopPropagation(); onEdit(ev); }}
                      className="absolute rounded px-1.5 py-1 text-left text-[11px] leading-tight overflow-hidden hover:shadow-md hover:z-10 transition-all"
                      style={{
                        top,
                        height,
                        left: `calc(${lane * widthPct}% + 2px)`,
                        width: `calc(${widthPct}% - 4px)`,
                        backgroundColor: `hsl(var(${EVENT_TYPE_TOKEN[ev.event_type]}) / 0.18)`,
                        borderLeft: `3px solid ${color}`,
                        color,
                      }}
                    >
                      <div className="font-semibold truncate text-foreground">{ev.title}</div>
                      <div className="text-[10px] text-muted-foreground truncate">
                        {format(parseISO(ev.starts_at), 'HH:mm')}
                        {ev.ends_at && ` – ${format(parseISO(ev.ends_at), 'HH:mm')}`}
                      </div>
                      {height > 48 && candidateName && (
                        <div className="text-[10px] text-muted-foreground truncate">{candidateName}</div>
                      )}
                      {height > 64 && (
                        <div className="text-[10px] opacity-70 truncate">{EVENT_TYPE_LABEL[ev.event_type]}</div>
                      )}
                    </button>
                  );
                })}
              </div>
            );
          })}
        </div>
      </div>
    </Card>
  );
}
