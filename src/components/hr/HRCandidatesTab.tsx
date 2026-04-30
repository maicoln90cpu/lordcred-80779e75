import { useState, useMemo, DragEvent } from 'react';
import { ScrollArea, ScrollBar } from '@/components/ui/scroll-area';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Search, Plus } from 'lucide-react';
import { useHRCandidates, type HRCandidate, type HRKanbanStatus } from '@/hooks/useHRCandidates';
import { useHRInterviewsMap } from '@/hooks/useHRInterviewsMap';
import { useHRKanbanColumns } from '@/hooks/useHRKanbanColumns';
import CandidateCard from './CandidateCard';
import { HRFiltersBar, DEFAULT_FILTERS, type HRFilters } from './HRFiltersBar';
import { filterCandidates } from '@/lib/hrFilters';

interface Props {
  onCandidateClick?: (candidate: HRCandidate) => void;
  onCreateClick?: () => void;
}

export function HRCandidatesTab({ onCandidateClick, onCreateClick }: Props) {
  const { candidates, loading, moveCandidate } = useHRCandidates();
  const { map: interviewsMap } = useHRInterviewsMap();
  const { columns } = useHRKanbanColumns('candidates');
  const [search, setSearch] = useState('');
  const [filters, setFilters] = useState<HRFilters>(DEFAULT_FILTERS);
  const [dragOverColumn, setDragOverColumn] = useState<string | null>(null);

  const filtered = useMemo(
    () => filterCandidates(candidates, filters, interviewsMap, search),
    [candidates, filters, interviewsMap, search],
  );

  const byColumn = useMemo(() => {
    const map = new Map<string, HRCandidate[]>();
    columns.forEach(col => map.set(col.slug, []));
    filtered.forEach(c => {
      const list = map.get(c.kanban_status) ?? [];
      list.push(c);
      map.set(c.kanban_status, list);
    });
    return map;
  }, [filtered, columns]);

  const handleDrop = async (e: DragEvent, slug: string) => {
    e.preventDefault();
    setDragOverColumn(null);
    const id = e.dataTransfer.getData('text/plain');
    if (!id) return;
    const candidate = candidates.find(c => c.id === id);
    if (!candidate || candidate.kanban_status === slug) return;
    await moveCandidate(id, slug as HRKanbanStatus);
  };

  const handleDragOver = (e: DragEvent, slug: string) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    if (dragOverColumn !== slug) setDragOverColumn(slug);
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
          {columns.map(col => {
            const items = byColumn.get(col.slug) ?? [];
            const isOver = dragOverColumn === col.slug;
            return (
              <div
                key={col.id}
                onDragOver={e => handleDragOver(e, col.slug)}
                onDragLeave={() => setDragOverColumn(prev => (prev === col.slug ? null : prev))}
                onDrop={e => handleDrop(e, col.slug)}
                className={`flex flex-col w-[280px] min-w-[280px] rounded-xl border transition-all ${
                  isOver ? 'border-primary/60 shadow-lg shadow-primary/10' : 'border-border/30 shadow-sm'
                }`}
                style={{ background: `linear-gradient(180deg, ${col.color_hex}10 0%, hsl(var(--card)) 18%)` }}
              >
                <div className="relative px-3 py-2.5 border-b border-border/30">
                  <div
                    className="absolute top-0 left-3 right-3 h-[3px] rounded-b-full"
                    style={{ backgroundColor: col.color_hex }}
                  />
                  <div className="flex items-center gap-2 mt-0.5">
                    <div
                      className="w-2.5 h-2.5 rounded-full shrink-0"
                      style={{ backgroundColor: col.color_hex, boxShadow: `0 0 8px ${col.color_hex}66` }}
                    />
                    <h3 className="text-sm font-bold text-foreground tracking-tight truncate">
                      {col.name}
                    </h3>
                    <span
                      className="ml-auto text-[11px] font-semibold px-2 py-0.5 rounded-full"
                      style={{ backgroundColor: `${col.color_hex}1F`, color: col.color_hex }}
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
                        columnColor={col.color_hex}
                        onClick={onCandidateClick ?? (() => {})}
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
