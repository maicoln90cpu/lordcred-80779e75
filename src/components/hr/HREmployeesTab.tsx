import { useState, useMemo, DragEvent } from 'react';
import { ScrollArea, ScrollBar } from '@/components/ui/scroll-area';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Search, Plus } from 'lucide-react';
import { useHREmployees, type HREmployee } from '@/hooks/useHREmployees';
import { useHRKanbanColumns } from '@/hooks/useHRKanbanColumns';
import CandidateCard from './CandidateCard';

interface Props {
  onEmployeeClick?: (employee: HREmployee) => void;
}

export function HREmployeesTab({ onEmployeeClick }: Props) {
  const { employees, loading, moveEmployee } = useHREmployees();
  const { columns } = useHRKanbanColumns('employees');
  const [search, setSearch] = useState('');
  const [dragOverColumn, setDragOverColumn] = useState<string | null>(null);

  const filtered = useMemo(() => {
    if (!search.trim()) return employees;
    const q = search.toLowerCase();
    return employees.filter(e =>
      e.full_name.toLowerCase().includes(q) ||
      e.phone.includes(q) ||
      (e.cpf && e.cpf.includes(q))
    );
  }, [employees, search]);

  const byColumn = useMemo(() => {
    const map = new Map<string, HREmployee[]>();
    columns.forEach(col => map.set(col.slug, []));
    filtered.forEach(e => {
      const list = map.get(e.kanban_status) ?? [];
      list.push(e);
      map.set(e.kanban_status, list);
    });
    return map;
  }, [filtered, columns]);

  const handleDrop = async (e: DragEvent, slug: string) => {
    e.preventDefault();
    setDragOverColumn(null);
    const id = e.dataTransfer.getData('text/plain');
    if (!id) return;
    const emp = employees.find(x => x.id === id);
    if (!emp || emp.kanban_status === slug) return;
    await moveEmployee(id, slug);
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
        <div className="ml-auto text-xs text-muted-foreground">
          {filtered.length} colaborador{filtered.length === 1 ? '' : 'es'}
          {filtered.length !== employees.length && (
            <span className="text-muted-foreground/60"> de {employees.length}</span>
          )}
        </div>
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
                onDragLeave={() => setDragOverColumn(prev => prev === col.slug ? null : prev)}
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
                      <p className="text-xs">Arraste um colaborador aqui</p>
                    </div>
                  ) : (
                    items.map(emp => (
                      <CandidateCard
                        key={emp.id}
                        candidate={emp as any}
                        columnColor={col.color_hex}
                        onClick={() => onEmployeeClick?.(emp)}
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
