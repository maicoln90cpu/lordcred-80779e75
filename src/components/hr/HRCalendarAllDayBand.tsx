import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { addDays, format, isSameDay, parseISO, startOfDay, differenceInCalendarDays } from 'date-fns';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { EVENT_TYPE_TOKEN, type HRCalendarEvent } from '@/hooks/useHRCalendarEvents';

interface Props {
  days: Date[];
  events: HRCalendarEvent[];
  onEdit: (ev: HRCalendarEvent) => void;
  onUpdateEvent: (id: string, patch: Partial<HRCalendarEvent>) => Promise<void>;
}

interface Band {
  ev: HRCalendarEvent;
  startCol: number; // 0..6
  endCol: number;   // 0..6 inclusive
  startISO: string; // original ISO
  endISO: string | null;
}

interface DragInfo {
  id: string;
  mode: 'move' | 'resize-l' | 'resize-r';
  startX: number;
  origStartCol: number;
  origEndCol: number;
  deltaCols: number;
}

const ROW_PX = 22;
const MAX_VISIBLE_ROWS = 2;

function toAllDayIsoSP(d: Date, kind: 'start' | 'end'): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  const t = kind === 'start' ? '00:00:00' : '23:59:00';
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${t}-03:00`;
}

export default function HRCalendarAllDayBand({ days, events, onEdit, onUpdateEvent }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const colWidthRef = useRef(0);
  const [drag, setDrag] = useState<DragInfo | null>(null);
  const [openPopoverId, setOpenPopoverId] = useState<string | null>(null);
  const [moreOpenDay, setMoreOpenDay] = useState<string | null>(null);

  // Calcula bands intersectando a semana visível.
  const bands: Band[] = useMemo(() => {
    const weekStart = startOfDay(days[0]);
    const weekEnd = startOfDay(days[6]);
    const result: Band[] = [];
    for (const ev of events) {
      const isAllDay = ev.all_day || (ev.ends_at && !isSameDay(parseISO(ev.starts_at), parseISO(ev.ends_at)));
      if (!isAllDay) continue;
      const s = startOfDay(parseISO(ev.starts_at));
      const e = ev.ends_at ? startOfDay(parseISO(ev.ends_at)) : s;
      if (e < weekStart || s > weekEnd) continue;
      const startCol = Math.max(0, differenceInCalendarDays(s, weekStart));
      const endCol = Math.min(6, differenceInCalendarDays(e, weekStart));
      result.push({ ev, startCol, endCol, startISO: ev.starts_at, endISO: ev.ends_at });
    }
    // ordena por início e duração
    result.sort((a, b) => a.startCol - b.startCol || (b.endCol - b.startCol) - (a.endCol - a.startCol));
    return result;
  }, [events, days]);

  // Atribui linhas (lanes) para evitar overlap visual
  const placed = useMemo(() => {
    const rows: number[][] = []; // row -> array de endCol já ocupados
    return bands.map((b) => {
      let row = 0;
      while (true) {
        rows[row] = rows[row] || [];
        const conflict = rows[row].some((endCol, idx) => {
          // marcamos como pares startCol-endCol
          return false;
        });
        // refaz: armazenar pares
        if (!(rows[row] as any).pairs) (rows[row] as any).pairs = [] as Array<[number, number]>;
        const pairs = (rows[row] as any).pairs as Array<[number, number]>;
        const overlaps = pairs.some(([s, e]) => !(b.endCol < s || b.startCol > e));
        if (!overlaps) {
          pairs.push([b.startCol, b.endCol]);
          break;
        }
        row++;
      }
      return { ...b, row };
    });
  }, [bands]);

  // Agrupa overflow por dia
  const { visible, hiddenByDay } = useMemo(() => {
    const visible: typeof placed = [];
    const hiddenByDay = new Map<string, HRCalendarEvent[]>();
    for (const b of placed) {
      if (b.row < MAX_VISIBLE_ROWS) {
        visible.push(b);
      } else {
        for (let c = b.startCol; c <= b.endCol; c++) {
          const key = format(days[c], 'yyyy-MM-dd');
          const list = hiddenByDay.get(key) ?? [];
          if (!list.some((e) => e.id === b.ev.id)) list.push(b.ev);
          hiddenByDay.set(key, list);
        }
      }
    }
    return { visible, hiddenByDay };
  }, [placed, days]);

  // === Drag handlers ===
  const beginDrag = useCallback((b: Band, mode: DragInfo['mode'], e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();
    if (containerRef.current) {
      colWidthRef.current = containerRef.current.getBoundingClientRect().width / 7;
    }
    setDrag({
      id: b.ev.id, mode,
      startX: e.clientX,
      origStartCol: b.startCol,
      origEndCol: b.endCol,
      deltaCols: 0,
    });
  }, []);

  useEffect(() => {
    if (!drag) return;
    const onMove = (e: MouseEvent) => {
      const cw = colWidthRef.current || 1;
      const deltaCols = Math.round((e.clientX - drag.startX) / cw);
      setDrag((d) => (d ? { ...d, deltaCols } : null));
    };
    const onUp = async () => {
      const d = drag;
      setDrag(null);
      if (!d || d.deltaCols === 0) return;
      const b = bands.find((x) => x.ev.id === d.id);
      if (!b) return;
      const weekStart = startOfDay(days[0]);

      let newStartCol = d.origStartCol;
      let newEndCol = d.origEndCol;
      if (d.mode === 'move') {
        newStartCol += d.deltaCols;
        newEndCol += d.deltaCols;
      } else if (d.mode === 'resize-l') {
        newStartCol = Math.min(d.origEndCol, d.origStartCol + d.deltaCols);
      } else if (d.mode === 'resize-r') {
        newEndCol = Math.max(d.origStartCol, d.origEndCol + d.deltaCols);
      }
      // converte cols (em relação à semana) para datas absolutas
      // calcula novo deslocamento mantendo eventos que começam fora da semana
      const origStart = startOfDay(parseISO(b.startISO));
      const origEnd = b.endISO ? startOfDay(parseISO(b.endISO)) : origStart;
      const startShift = newStartCol - d.origStartCol;
      const endShift = newEndCol - d.origEndCol;
      const newStart = addDays(origStart, startShift);
      const newEnd = addDays(origEnd, endShift);
      try {
        await onUpdateEvent(b.ev.id, {
          starts_at: toAllDayIsoSP(newStart, 'start'),
          ends_at: toAllDayIsoSP(newEnd, 'end'),
          all_day: true,
        });
      } catch {/* hook já mostra toast */}
    };
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
    return () => {
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
    };
  }, [drag, bands, days, onUpdateEvent]);

  if (bands.length === 0) return null;

  const totalRows = Math.min(MAX_VISIBLE_ROWS + (hiddenByDay.size > 0 ? 1 : 0), Math.max(MAX_VISIBLE_ROWS, ...placed.map((p) => p.row + 1), 1));
  const bandHeight = totalRows * ROW_PX + 6;

  return (
    <div className="grid grid-cols-[60px_repeat(7,1fr)] border-b border-border/40 bg-muted/10">
      <div className="text-[9px] text-muted-foreground text-right pr-1.5 py-1.5 self-center">Dia inteiro</div>
      <div ref={containerRef} className="col-span-7 relative" style={{ minHeight: bandHeight }}>
        {/* Bands visíveis */}
        {visible.map((b) => {
          const color = `hsl(var(${EVENT_TYPE_TOKEN[b.ev.event_type]}))`;
          const drawStart = drag?.id === b.ev.id
            ? (drag.mode === 'resize-r' ? b.startCol : b.startCol + drag.deltaCols)
            : b.startCol;
          const drawEnd = drag?.id === b.ev.id
            ? (drag.mode === 'resize-l' ? b.endCol : b.endCol + drag.deltaCols)
            : b.endCol;
          const sCol = Math.max(0, Math.min(6, drawStart));
          const eCol = Math.max(0, Math.min(6, drawEnd));
          const widthPct = ((eCol - sCol + 1) / 7) * 100;
          const leftPct = (sCol / 7) * 100;
          return (
            <Popover
              key={b.ev.id}
              open={openPopoverId === b.ev.id}
              onOpenChange={(o) => setOpenPopoverId(o ? b.ev.id : null)}
            >
              <PopoverTrigger asChild>
                <div
                  className="absolute h-5 rounded text-[10px] font-medium truncate select-none"
                  style={{
                    top: b.row * ROW_PX + 4,
                    left: `calc(${leftPct}% + 2px)`,
                    width: `calc(${widthPct}% - 4px)`,
                    backgroundColor: `hsl(var(${EVENT_TYPE_TOKEN[b.ev.event_type]}) / 0.25)`,
                    borderLeft: `3px solid ${color}`,
                    color,
                    cursor: drag?.id === b.ev.id ? 'grabbing' : 'grab',
                    opacity: drag?.id === b.ev.id ? 0.7 : 1,
                  }}
                  onMouseDown={(e) => beginDrag(b, 'move', e)}
                  onClick={(e) => {
                    if (drag) e.preventDefault();
                  }}
                >
                  {/* handle esquerdo */}
                  <div
                    className="absolute left-0 top-0 bottom-0 w-1.5 cursor-ew-resize"
                    onMouseDown={(e) => beginDrag(b, 'resize-l', e)}
                  />
                  <span className="px-2 leading-5 block truncate pointer-events-none">{b.ev.title}</span>
                  {/* handle direito */}
                  <div
                    className="absolute right-0 top-0 bottom-0 w-1.5 cursor-ew-resize"
                    onMouseDown={(e) => beginDrag(b, 'resize-r', e)}
                  />
                </div>
              </PopoverTrigger>
              <PopoverContent align="start" className="w-72 p-3 space-y-2">
                <QuickAllDayEditor ev={b.ev} onSave={async (patch) => {
                  await onUpdateEvent(b.ev.id, patch);
                  setOpenPopoverId(null);
                }} onOpenFull={() => { setOpenPopoverId(null); onEdit(b.ev); }} />
              </PopoverContent>
            </Popover>
          );
        })}

        {/* +N mais por dia */}
        {Array.from(hiddenByDay.entries()).map(([dayKey, list]) => {
          const colIdx = days.findIndex((d) => format(d, 'yyyy-MM-dd') === dayKey);
          if (colIdx === -1) return null;
          const leftPct = (colIdx / 7) * 100;
          const widthPct = (1 / 7) * 100;
          return (
            <Popover
              key={`more-${dayKey}`}
              open={moreOpenDay === dayKey}
              onOpenChange={(o) => setMoreOpenDay(o ? dayKey : null)}
            >
              <PopoverTrigger asChild>
                <button
                  type="button"
                  className="absolute h-5 rounded text-[10px] font-medium text-muted-foreground hover:bg-accent border border-border/40 truncate"
                  style={{
                    top: MAX_VISIBLE_ROWS * ROW_PX + 4,
                    left: `calc(${leftPct}% + 2px)`,
                    width: `calc(${widthPct}% - 4px)`,
                  }}
                >
                  +{list.length} mais
                </button>
              </PopoverTrigger>
              <PopoverContent align="start" className="w-64 p-2 space-y-1">
                <div className="text-[11px] text-muted-foreground px-1 pb-1">
                  {format(days[colIdx], 'EEE, d MMM')}
                </div>
                {list.map((ev) => {
                  const color = `hsl(var(${EVENT_TYPE_TOKEN[ev.event_type]}))`;
                  return (
                    <button
                      key={ev.id}
                      type="button"
                      onClick={() => { setMoreOpenDay(null); onEdit(ev); }}
                      className="w-full text-left text-xs px-2 py-1 rounded hover:bg-accent truncate"
                      style={{ borderLeft: `3px solid ${color}` }}
                    >
                      {ev.title}
                    </button>
                  );
                })}
              </PopoverContent>
            </Popover>
          );
        })}
      </div>
    </div>
  );
}

/** Editor compacto inline (popover) — só título + intervalo de dias. */
function QuickAllDayEditor({
  ev, onSave, onOpenFull,
}: {
  ev: HRCalendarEvent;
  onSave: (patch: Partial<HRCalendarEvent>) => Promise<void>;
  onOpenFull: () => void;
}) {
  const [title, setTitle] = useState(ev.title);
  const [startDate, setStartDate] = useState(format(parseISO(ev.starts_at), 'yyyy-MM-dd'));
  const [endDate, setEndDate] = useState(
    ev.ends_at ? format(parseISO(ev.ends_at), 'yyyy-MM-dd') : format(parseISO(ev.starts_at), 'yyyy-MM-dd'),
  );
  const [saving, setSaving] = useState(false);

  const save = async () => {
    if (!title.trim() || !startDate) return;
    setSaving(true);
    try {
      await onSave({
        title: title.trim(),
        starts_at: `${startDate}T00:00:00-03:00`,
        ends_at: `${endDate || startDate}T23:59:00-03:00`,
        all_day: true,
      });
    } finally { setSaving(false); }
  };

  return (
    <>
      <div>
        <Label className="text-[11px]">Título</Label>
        <Input value={title} onChange={(e) => setTitle(e.target.value)} className="h-8 text-xs" />
      </div>
      <div className="grid grid-cols-2 gap-2">
        <div>
          <Label className="text-[11px]">Início</Label>
          <Input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} className="h-8 text-xs" />
        </div>
        <div>
          <Label className="text-[11px]">Fim</Label>
          <Input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} className="h-8 text-xs" />
        </div>
      </div>
      <div className="flex justify-between gap-2 pt-1">
        <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={onOpenFull}>
          Mais opções
        </Button>
        <Button size="sm" className="h-7 text-xs" onClick={save} disabled={saving}>
          Salvar
        </Button>
      </div>
    </>
  );
}
