import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { CalendarRange } from 'lucide-react';

export interface MonthOption {
  value: string; // YYYY-MM
  label: string; // ex: "Maio/2026"
}

interface MonthMultiSelectProps {
  months: MonthOption[];
  selected: string[];
  onChange: (v: string[]) => void;
  className?: string;
}

const MONTH_NAMES = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'];

export function buildMonthOptions(dates: (string | null | undefined)[]): MonthOption[] {
  const set = new Set<string>();
  dates.forEach(d => {
    if (!d) return;
    const ym = String(d).slice(0, 7); // YYYY-MM (assume ISO/date)
    if (/^\d{4}-\d{2}$/.test(ym)) set.add(ym);
  });
  return [...set].sort().reverse().map(ym => {
    const [y, m] = ym.split('-');
    return { value: ym, label: `${MONTH_NAMES[parseInt(m, 10) - 1]}/${y}` };
  });
}

export default function MonthMultiSelect({ months, selected, onChange, className }: MonthMultiSelectProps) {
  const label = selected.length === 0
    ? 'Todos os meses'
    : selected.length === 1
      ? months.find(m => m.value === selected[0])?.label || selected[0]
      : `${selected.length} meses`;
  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="outline" className={`justify-start font-normal ${className || 'w-full sm:w-52'}`}>
          <CalendarRange className="w-4 h-4 mr-2 text-muted-foreground" />
          <span className="truncate">{label}</span>
          {selected.length > 0 && (
            <Badge variant="secondary" className="ml-auto text-xs">{selected.length}</Badge>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-56 max-h-72 overflow-y-auto p-2" align="start">
        <div className="flex items-center justify-between mb-2 px-1">
          <span className="text-xs font-medium text-muted-foreground">Meses</span>
          {selected.length > 0 && (
            <Button variant="ghost" size="sm" className="h-6 text-xs" onClick={() => onChange([])}>Limpar</Button>
          )}
        </div>
        {months.map(m => (
          <label key={m.value} className="flex items-center gap-2 px-1 py-1.5 hover:bg-accent rounded cursor-pointer text-sm">
            <Checkbox
              checked={selected.includes(m.value)}
              onCheckedChange={(checked) => {
                if (checked) onChange([...selected, m.value]);
                else onChange(selected.filter(s => s !== m.value));
              }}
            />
            <span className="truncate">{m.label}</span>
          </label>
        ))}
        {months.length === 0 && <p className="text-xs text-muted-foreground text-center py-2">Nenhum mês</p>}
      </PopoverContent>
    </Popover>
  );
}
