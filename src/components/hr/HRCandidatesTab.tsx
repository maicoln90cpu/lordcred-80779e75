import { useState, useMemo, DragEvent } from 'react';
import { ScrollArea, ScrollBar } from '@/components/ui/scroll-area';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Search, Plus } from 'lucide-react';
import { useHRCandidates, type HRCandidate, type HRKanbanStatus } from '@/hooks/useHRCandidates';
import { useHRInterviewsMap } from '@/hooks/useHRInterviewsMap';
import CandidateCard from './CandidateCard';
import { HRFiltersBar, DEFAULT_FILTERS, type HRFilters } from './HRFiltersBar';
import { filterCandidates } from '@/lib/hrFilters';
import { HR_COLUMNS, hrColor } from './hrColumns';

const COLUMNS = HR_COLUMNS;

interface Props {
  onCandidateClick?: (candidate: HRCandidate) => void;
  onCreateClick?: () => void;
}

export function HRCandidatesTab({ onCandidateClick, onCreateClick }: Props) {
  const { candidates, loading, moveCandidate } = useHRCandidates();
  const { map: interviewsMap } = useHRInterviewsMap();
  const [search, setSearch] = useState('');
  const [filters, setFilters] = useState<HRFilters>(DEFAULT_FILTERS);
  const [dragOverColumn, setDragOverColumn] = useState<HRKanbanStatus | null>(null);

  const filtered = useMemo(
    () => filterCandidates(candidates, filters, interviewsMap, search),
    [candidates, filters, interviewsMap, search],
  );

  const byColumn = useMemo(() => {
    const map = new Map<HRKanbanStatus, HRCandidate[]>();
    COLUMNS.forEach(col => map.set(col.id, []));
    filtered.forEach(c => {
      const list = map.get(c.kanban_status) ?? [];
      list.push(c);
      map.set(c.kanban_status, list);
    });
    return map;
  }, [filtered]);

  const handleDrop = async (e: DragEvent, status: HRKanbanStatus) => {
    e.preventDefault();
    setDragOverColumn(null);
    const id = e.dataTransfer.getData('text/plain');
    if (!id) return;
    const candidate = candidates.find(c => c.id === id);
    if (!candidate || candidate.kanban_status === status) return;
    await moveCandidate(id, status);
  };

  const handleDragOver = (e: DragEvent, status: HRKanbanStatus) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    if (dragOverColumn !== status) setDragOverColumn(status);
  };

  const handleClick = (c: HRCandidate) => {
    onCandidateClick?.(c);
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2 flex-wrap">
        <div className="relative flex-1 max-w-sm min-w-[220px]">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Buscar por nome, telefone ou CPF..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="pl-8 h-9"
          />
        </div>
        <HRFiltersBar value={filters} onChange={setFilters} />
        <div className="ml-auto text-xs text-muted-foreground">
          {filtered.length} candidato{filtered.length === 1 ? '' : 's'}
          {filtered.length !== candidates.length && (
            <span className="text-muted-foreground/60"> de {candidates.length}</span>
          )}
        </div>
        <Button size="sm" onClick={() => onCreateClick?.()} className="gap-1.5">
          <Plus className="w-4 h-4" /> Novo candidato
        </Button>
      </div>

      <ScrollArea className="w-full">
        <div className="flex gap-3 pb-3">
          {COLUMNS.map(col => {
            const items = byColumn.get(col.id) ?? [];
            const isOver = dragOverColumn === col.id;
            const colorSolid = hrColor(col.token);
            const colorTint = hrColor(col.token, 0.06);
            const colorChip = hrColor(col.token, 0.12);
            const colorGlow = hrColor(col.token, 0.4);
            return (
              <div
                key={col.id}
                onDragOver={e => handleDragOver(e, col.id)}
                onDragLeave={() => setDragOverColumn(prev => (prev === col.id ? null : prev))}
                onDrop={e => handleDrop(e, col.id)}
                className={`flex flex-col w-[280px] min-w-[280px] rounded-xl border transition-all ${
                  isOver ? 'border-primary/60 shadow-lg shadow-primary/10' : 'border-border/30 shadow-sm'
                }`}
                style={{ background: `linear-gradient(180deg, ${colorTint} 0%, hsl(var(--card)) 18%)` }}
              >
                <div className="relative px-3 py-2.5 border-b border-border/30">
                  <div
                    className="absolute top-0 left-3 right-3 h-[3px] rounded-b-full"
                    style={{ backgroundColor: colorSolid }}
                  />
                  <div className="flex items-center gap-2 mt-0.5">
                    <div
                      className="w-2.5 h-2.5 rounded-full shrink-0"
                      style={{ backgroundColor: colorSolid, boxShadow: `0 0 8px ${colorGlow}` }}
                    />
                    <h3 className="text-sm font-bold text-foreground tracking-tight truncate">
                      {col.name}
                    </h3>
                    <span
                      className="ml-auto text-[11px] font-semibold px-2 py-0.5 rounded-full"
                      style={{ backgroundColor: colorChip, color: colorSolid }}
                    >
                      {items.length}
                    </span>
                  </div>
                </div>

                <div className="flex-1 p-2 space-y-2 min-h-[200px] max-h-[calc(100vh-380px)] overflow-y-auto">
                  {loading && items.length === 0 ? (
                    <div className="flex items-center justify-center py-10 text-xs text-muted-foreground">
                      Carregando...
                    </div>
                  ) : items.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-10 text-muted-foreground/60">
                      <div className="w-10 h-10 rounded-full border-2 border-dashed border-muted-foreground/20 flex items-center justify-center mb-2">
                        <span className="text-lg">+</span>
                      </div>
                      <p className="text-xs">Arraste um candidato aqui</p>
                    </div>
                  ) : (
                    items.map(c => (
                      <CandidateCard
                        key={c.id}
                        candidate={c}
                        columnColor={colorSolid}
                        onClick={handleClick}
                      />
                    ))
                  )}
                </div>
              </div>
            );
          })}
        </div>
        <ScrollBar orientation="horizontal" />
      </ScrollArea>
    </div>
  );
}
