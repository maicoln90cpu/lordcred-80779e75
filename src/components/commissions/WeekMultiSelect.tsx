import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { CalendarDays } from 'lucide-react';

interface WeekMultiSelectProps {
  weeks: string[];
  selected: string[];
  onChange: (v: string[]) => void;
  className?: string;
}

export default function WeekMultiSelect({ weeks, selected, onChange, className }: WeekMultiSelectProps) {
  const sorted = [...weeks].sort((a, b) => (a || '').localeCompare(b || '', 'pt-BR'));
  const label = selected.length === 0 ? 'Todas as semanas' : selected.length === 1 ? selected[0] : `${selected.length} semanas`;
  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="outline" className={`justify-start font-normal ${className || 'w-full sm:w-64'}`}>
          <CalendarDays className="w-4 h-4 mr-2 text-muted-foreground" />
          <span className="truncate">{label}</span>
          {selected.length > 0 && (
            <Badge variant="secondary" className="ml-auto text-xs">{selected.length}</Badge>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-64 max-h-72 overflow-y-auto p-2" align="start">
        <div className="flex items-center justify-between mb-2 px-1">
          <span className="text-xs font-medium text-muted-foreground">Semanas</span>
          {selected.length > 0 && (
            <Button variant="ghost" size="sm" className="h-6 text-xs" onClick={() => onChange([])}>Limpar</Button>
          )}
        </div>
        {sorted.map(w => (
          <label key={w} className="flex items-center gap-2 px-1 py-1.5 hover:bg-accent rounded cursor-pointer text-sm">
            <Checkbox
              checked={selected.includes(w)}
              onCheckedChange={(checked) => {
                if (checked) onChange([...selected, w]);
                else onChange(selected.filter(s => s !== w));
              }}
            />
            <span className="truncate">{w}</span>
          </label>
        ))}
        {sorted.length === 0 && <p className="text-xs text-muted-foreground text-center py-2">Nenhuma semana</p>}
      </PopoverContent>
    </Popover>
  );
}
