import { useEffect, useMemo, useRef, useState, useCallback } from 'react';
import {
  addDays, addWeeks, subWeeks, startOfWeek, format, parseISO,
  isSameDay, differenceInMinutes, startOfDay, addMinutes,
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
import HRCalendarAllDayBand from './HRCalendarAllDayBand';

interface Props {
  events: HRCalendarEvent[];
  loading: boolean;
  candidateNameById: Map<string, string>;
  onEdit: (ev: HRCalendarEvent) => void;
  onCreateAt: (date: Date) => void;
  /** Atualiza horário/dia ao soltar drag/resize. */
  onUpdateEvent: (id: string, patch: Partial<HRCalendarEvent>) => Promise<void>;
}

const HOUR_PX = 48;
const SNAP_MIN = 15;
const SNAP_PX = (SNAP_MIN / 60) * HOUR_PX; // 12px
const HOURS = Array.from({ length: 24 }, (_, i) => i);
const DAY_END_MIN = 24 * 60;

interface PositionedEvent {
  ev: HRCalendarEvent;
  top: number;
  height: number;
  lane: number;
  lanes: number;
  startMin: number;
  endMin: number;
}

// AllDayBand foi extraído para HRCalendarAllDayBand.tsx (faixa Dia inteiro
// com agrupamento "+N mais", edição rápida via popover e drag/resize horizontal).

/** Converte ISO em -03:00 (regra do projeto). */
function toIsoSP(d: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}:00-03:00`;
}

function snapMinutes(mins: number): number {
  return Math.round(mins / SNAP_MIN) * SNAP_MIN;
}

function isMultiDay(ev: HRCalendarEvent): boolean {
  if (!ev.ends_at) return false;
  const s = parseISO(ev.starts_at);
  const e = parseISO(ev.ends_at);
  return !isSameDay(s, e);
}

function layoutDay(events: HRCalendarEvent[], day: Date): PositionedEvent[] {
  const dayStart = startOfDay(day);
  const items = events
    .map((ev) => {
      const s = parseISO(ev.starts_at);
      const e = ev.ends_at ? parseISO(ev.ends_at) : new Date(s.getTime() + 60 * 60 * 1000);
      const rawStart = differenceInMinutes(s, dayStart);
      const rawEnd = differenceInMinutes(e, dayStart);
      const startMin = Math.max(0, Math.min(DAY_END_MIN - 15, rawStart));
      const endMin = Math.max(startMin + 15, Math.min(DAY_END_MIN, rawEnd));
      return { ev, startMin, endMin, rawStart, rawEnd };
    })
    .filter((it) => it.rawEnd > 0 && it.rawStart < DAY_END_MIN)
    .sort((a, b) => a.startMin - b.startMin);

  const lanesEnd: number[] = [];
  const assigned: { lane: number; startMin: number; endMin: number; ev: HRCalendarEvent }[] = [];
  for (const it of items) {
    let lane = lanesEnd.findIndex((end) => end <= it.startMin);
    if (lane === -1) { lane = lanesEnd.length; lanesEnd.push(it.endMin); }
    else { lanesEnd[lane] = it.endMin; }
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
      ev: a.ev, top,
      height: Math.max(20, Math.min(rawHeight, maxHeight)),
      lane: a.lane, lanes, startMin: a.startMin, endMin: a.endMin,
    });
  }
  return result;
}

interface DragState {
  id: string;
  mode: 'move' | 'resize';
  startY: number;
  startX: number;
  origStart: Date;
  origEnd: Date;
  deltaMin: number;
  deltaDays: number;
  newDuration: number;
}

export default function HRCalendarWeekView({
  events: serverEvents, loading, candidateNameById, onEdit, onCreateAt, onUpdateEvent,
}: Props) {
  const [weekStart, setWeekStart] = useState(() => startOfWeek(new Date(), { weekStartsOn: 0 }));
  const [now, setNow] = useState(new Date());
  const [optimistic, setOptimistic] = useState<Map<string, HRCalendarEvent>>(new Map());
  const [drag, setDrag] = useState<DragState | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const gridRef = useRef<HTMLDivElement>(null);
  const colWidthRef = useRef<number>(0);

  // merge server + optimistic
  const events = useMemo(() => {
    if (optimistic.size === 0) return serverEvents;
    return serverEvents.map((e) => optimistic.get(e.id) ?? e);
  }, [serverEvents, optimistic]);

  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 60_000);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = 7 * HOUR_PX;
  }, []);

  const days = useMemo(
    () => Array.from({ length: 7 }, (_, i) => addDays(weekStart, i)),
    [weekStart],
  );

  // Separa all-day/multi-dia (faixa) dos eventos intra-dia (grade).
  const { allDayEvents, byDay } = useMemo(() => {
    const allDayEvents: HRCalendarEvent[] = [];
    const intraDay: HRCalendarEvent[] = [];
    for (const ev of events) {
      if (ev.all_day || isMultiDay(ev)) allDayEvents.push(ev);
      else intraDay.push(ev);
    }
    const map = new Map<string, PositionedEvent[]>();
    days.forEach((d) => {
      const key = format(d, 'yyyy-MM-dd');
      const dayEvents = intraDay.filter((ev) => isSameDay(parseISO(ev.starts_at), d));
      map.set(key, layoutDay(dayEvents, d));
    });
    return { allDayEvents, byDay: map };
  }, [events, days]);

  const weekLabel = `${format(weekStart, "d 'de' MMM", { locale: ptBR })} – ${format(addDays(weekStart, 6), "d 'de' MMM yyyy", { locale: ptBR })}`;

  const handleSlotClick = (day: Date, hour: number) => {
    if (drag) return;
    const d = new Date(day);
    d.setHours(hour, 0, 0, 0);
    onCreateAt(d);
  };

  // === Drag handlers ===
  const beginDrag = useCallback((ev: HRCalendarEvent, mode: 'move' | 'resize', e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();
    if (ev.all_day || isMultiDay(ev)) return; // não suporta drag em faixa por enquanto
    const cols = gridRef.current?.querySelectorAll('[data-day-col]');
    if (cols && cols.length > 0) {
      colWidthRef.current = (cols[0] as HTMLElement).getBoundingClientRect().width;
    }
    const origStart = parseISO(ev.starts_at);
    const origEnd = ev.ends_at ? parseISO(ev.ends_at) : addMinutes(origStart, 60);
    setDrag({
      id: ev.id, mode,
      startY: e.clientY, startX: e.clientX,
      origStart, origEnd,
      deltaMin: 0, deltaDays: 0,
      newDuration: differenceInMinutes(origEnd, origStart),
    });
  }, []);

  useEffect(() => {
    if (!drag) return;
    const onMove = (e: MouseEvent) => {
      const dy = e.clientY - drag.startY;
      const dx = e.clientX - drag.startX;
      const deltaMin = snapMinutes((dy / HOUR_PX) * 60);
      const colW = colWidthRef.current || 1;
      const deltaDays = drag.mode === 'move' ? Math.round(dx / colW) : 0;
      const dur = drag.mode === 'resize'
        ? Math.max(SNAP_MIN, snapMinutes(differenceInMinutes(drag.origEnd, drag.origStart) + (dy / HOUR_PX) * 60))
        : differenceInMinutes(drag.origEnd, drag.origStart);
      setDrag((d) => d ? { ...d, deltaMin, deltaDays, newDuration: dur } : null);
    };
    const onUp = async () => {
      const d = drag;
      setDrag(null);
      if (!d) return;
      const ev = events.find((x) => x.id === d.id);
      if (!ev) return;
      let newStart: Date;
      let newEnd: Date;
      if (d.mode === 'move') {
        newStart = addMinutes(addDays(d.origStart, d.deltaDays), d.deltaMin);
        newEnd = addMinutes(newStart, differenceInMinutes(d.origEnd, d.origStart));
      } else {
        newStart = d.origStart;
        newEnd = addMinutes(d.origStart, d.newDuration);
      }
      // sem mudança? aborta
      if (newStart.getTime() === d.origStart.getTime() && newEnd.getTime() === d.origEnd.getTime()) return;

      const patch = { starts_at: toIsoSP(newStart), ends_at: toIsoSP(newEnd) };
      // optimistic
      setOptimistic((prev) => {
        const next = new Map(prev);
        next.set(ev.id, { ...ev, ...patch });
        return next;
      });
      try {
        await onUpdateEvent(ev.id, patch);
      } catch {
        // rollback
        setOptimistic((prev) => {
          const next = new Map(prev);
          next.delete(ev.id);
          return next;
        });
      } finally {
        // limpa optimistic após o servidor confirmar (próximo refetch substitui)
        setTimeout(() => {
          setOptimistic((prev) => {
            const next = new Map(prev);
            next.delete(ev.id);
            return next;
          });
        }, 1500);
      }
    };
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
    return () => {
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
    };
  }, [drag, events, onUpdateEvent]);

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

      {/* Faixa Dia inteiro / multi-dia (componente isolado) */}
      <HRCalendarAllDayBand
        days={days}
        events={allDayEvents}
        onEdit={onEdit}
        onUpdateEvent={onUpdateEvent}
      />

      {/* Grid scrollável */}
      <div ref={scrollRef} className="overflow-auto" style={{ maxHeight: '70vh' }}>
        <div ref={gridRef} className="grid grid-cols-[60px_repeat(7,1fr)] relative">
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
          {days.map((day, dayIdx) => {
            const dayKey = format(day, 'yyyy-MM-dd');
            const positioned = byDay.get(dayKey) ?? [];
            const isToday = isSameDay(day, now);
            const nowMin = now.getHours() * 60 + now.getMinutes();
            const nowTop = (nowMin / 60) * HOUR_PX;

            return (
              <div key={dayKey} data-day-col className="relative border-l border-border/40 overflow-hidden">
                {HOURS.map((h) => (
                  <div
                    key={h}
                    className="border-b border-border/30 hover:bg-accent/30 cursor-pointer transition-colors"
                    style={{ height: HOUR_PX }}
                    onClick={() => handleSlotClick(day, h)}
                  />
                ))}

                {isToday && (
                  <div className="absolute left-0 right-0 z-10 pointer-events-none" style={{ top: nowTop }}>
                    <div className="h-px bg-destructive relative">
                      <div className="absolute -left-1 -top-1 w-2.5 h-2.5 rounded-full bg-destructive" />
                    </div>
                  </div>
                )}

                {positioned.map(({ ev, top, height, lane, lanes }) => {
                  const color = `hsl(var(${EVENT_TYPE_TOKEN[ev.event_type]}))`;
                  const widthPct = 100 / lanes;
                  const candidateName = ev.candidate_id ? candidateNameById.get(ev.candidate_id) : null;
                  const isDragging = drag?.id === ev.id;
                  const dragOffsetY = isDragging && drag.mode === 'move' ? (drag.deltaMin / 60) * HOUR_PX : 0;
                  const dragOffsetX = isDragging && drag.mode === 'move' && drag.deltaDays !== 0
                    ? drag.deltaDays * (colWidthRef.current || 0)
                    : 0;
                  const dragHeight = isDragging && drag.mode === 'resize'
                    ? Math.max(20, (drag.newDuration / 60) * HOUR_PX - 2)
                    : height;
                  return (
                    <div
                      key={ev.id}
                      className={cn(
                        'absolute rounded text-left text-[11px] leading-tight overflow-hidden transition-shadow group',
                        isDragging ? 'opacity-70 shadow-lg z-30' : 'hover:shadow-md hover:z-10',
                      )}
                      style={{
                        top: top + dragOffsetY,
                        height: dragHeight,
                        left: `calc(${lane * widthPct}% + 2px + ${dragOffsetX}px)`,
                        width: `calc(${widthPct}% - 4px)`,
                        backgroundColor: `hsl(var(${EVENT_TYPE_TOKEN[ev.event_type]}) / 0.18)`,
                        borderLeft: `3px solid ${color}`,
                        color,
                        cursor: drag?.mode === 'move' ? 'grabbing' : 'grab',
                        userSelect: 'none',
                      }}
                      onMouseDown={(e) => beginDrag(ev, 'move', e)}
                      onClick={(e) => {
                        e.stopPropagation();
                        if (!drag) onEdit(ev);
                      }}
                    >
                      <div className="px-1.5 py-1">
                        <div className="font-semibold truncate text-foreground">{ev.title}</div>
                        <div className="text-[10px] text-muted-foreground truncate">
                          {format(parseISO(ev.starts_at), 'HH:mm')}
                          {ev.ends_at && ` – ${format(parseISO(ev.ends_at), 'HH:mm')}`}
                        </div>
                        {dragHeight > 48 && candidateName && (
                          <div className="text-[10px] text-muted-foreground truncate">{candidateName}</div>
                        )}
                        {dragHeight > 64 && (
                          <div className="text-[10px] opacity-70 truncate">{EVENT_TYPE_LABEL[ev.event_type]}</div>
                        )}
                      </div>
                      {/* Resize handle */}
                      <div
                        className="absolute bottom-0 left-0 right-0 h-1.5 cursor-ns-resize opacity-0 group-hover:opacity-100 bg-foreground/30"
                        onMouseDown={(e) => beginDrag(ev, 'resize', e)}
                        title="Arraste para redimensionar"
                      />
                    </div>
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
