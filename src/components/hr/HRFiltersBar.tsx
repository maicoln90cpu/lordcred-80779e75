import { useState } from 'react';
import { Filter, X, ChevronDown } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Badge } from '@/components/ui/badge';

export type AttendanceFilter = 'all' | 'yes' | 'no' | 'none';
export type ResultFilter = 'all' | 'approved' | 'rejected' | 'doubt' | 'pending' | 'none';

export interface HRFilters {
  ageMin: number | null;
  ageMax: number | null;
  ageUnknown: boolean;       // true = inclui "sem idade" mesmo fora do range
  e1Attendance: AttendanceFilter;
  e1Result: ResultFilter;
  e2Attendance: AttendanceFilter;
  e2Result: ResultFilter;
}

export const DEFAULT_FILTERS: HRFilters = {
  ageMin: null,
  ageMax: null,
  ageUnknown: true,
  e1Attendance: 'all',
  e1Result: 'all',
  e2Attendance: 'all',
  e2Result: 'all',
};

const ATTENDANCE_OPTS: { value: AttendanceFilter; label: string }[] = [
  { value: 'all', label: 'Todos' },
  { value: 'yes', label: 'Compareceu' },
  { value: 'no', label: 'Não compareceu' },
  { value: 'none', label: 'Sem entrevista' },
];

const RESULT_OPTS: { value: ResultFilter; label: string }[] = [
  { value: 'all', label: 'Todos' },
  { value: 'approved', label: 'Aprovado' },
  { value: 'rejected', label: 'Reprovado' },
  { value: 'doubt', label: 'Dúvida' },
  { value: 'pending', label: 'Pendente (sem resultado)' },
  { value: 'none', label: 'Sem entrevista' },
];

interface Props {
  value: HRFilters;
  onChange: (next: HRFilters) => void;
}

function countActive(f: HRFilters): number {
  let n = 0;
  if (f.ageMin !== null || f.ageMax !== null) n++;
  if (!f.ageUnknown) n++;
  if (f.e1Attendance !== 'all') n++;
  if (f.e1Result !== 'all') n++;
  if (f.e2Attendance !== 'all') n++;
  if (f.e2Result !== 'all') n++;
  return n;
}

export function HRFiltersBar({ value, onChange }: Props) {
  const [open, setOpen] = useState(false);
  const active = countActive(value);

  const update = <K extends keyof HRFilters>(key: K, v: HRFilters[K]) => {
    onChange({ ...value, [key]: v });
  };

  const reset = () => onChange(DEFAULT_FILTERS);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="outline" size="sm" className="gap-1.5 h-9">
          <Filter className="w-4 h-4" />
          Filtros
          {active > 0 && (
            <Badge variant="secondary" className="ml-1 h-5 px-1.5 text-[10px]">
              {active}
            </Badge>
          )}
          <ChevronDown className="w-3.5 h-3.5 opacity-60" />
        </Button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-[420px] p-4 space-y-4">
        <div className="flex items-center justify-between">
          <h4 className="text-sm font-semibold">Filtros avançados</h4>
          {active > 0 && (
            <Button variant="ghost" size="sm" onClick={reset} className="h-7 text-xs gap-1">
              <X className="w-3 h-3" /> Limpar
            </Button>
          )}
        </div>

        {/* Idade */}
        <div className="space-y-1.5">
          <Label className="text-xs">Idade</Label>
          <div className="flex items-center gap-2">
            <Input
              type="number"
              min={16}
              max={99}
              placeholder="Min"
              value={value.ageMin ?? ''}
              onChange={e => update('ageMin', e.target.value ? parseInt(e.target.value, 10) : null)}
              className="h-8 text-sm"
            />
            <span className="text-xs text-muted-foreground">até</span>
            <Input
              type="number"
              min={16}
              max={99}
              placeholder="Max"
              value={value.ageMax ?? ''}
              onChange={e => update('ageMax', e.target.value ? parseInt(e.target.value, 10) : null)}
              className="h-8 text-sm"
            />
          </div>
          <label className="flex items-center gap-2 pt-1 cursor-pointer">
            <input
              type="checkbox"
              checked={value.ageUnknown}
              onChange={e => update('ageUnknown', e.target.checked)}
              className="rounded border-border accent-primary"
            />
            <span className="text-xs text-muted-foreground">Incluir candidatos sem idade cadastrada</span>
          </label>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <Label className="text-xs">E1 — Compareceu?</Label>
            <Select value={value.e1Attendance} onValueChange={(v) => update('e1Attendance', v as AttendanceFilter)}>
              <SelectTrigger className="h-8 text-sm"><SelectValue /></SelectTrigger>
              <SelectContent>
                {ATTENDANCE_OPTS.map(o => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">E1 — Resultado</Label>
            <Select value={value.e1Result} onValueChange={(v) => update('e1Result', v as ResultFilter)}>
              <SelectTrigger className="h-8 text-sm"><SelectValue /></SelectTrigger>
              <SelectContent>
                {RESULT_OPTS.map(o => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">E2 — Compareceu?</Label>
            <Select value={value.e2Attendance} onValueChange={(v) => update('e2Attendance', v as AttendanceFilter)}>
              <SelectTrigger className="h-8 text-sm"><SelectValue /></SelectTrigger>
              <SelectContent>
                {ATTENDANCE_OPTS.map(o => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">E2 — Resultado</Label>
            <Select value={value.e2Result} onValueChange={(v) => update('e2Result', v as ResultFilter)}>
              <SelectTrigger className="h-8 text-sm"><SelectValue /></SelectTrigger>
              <SelectContent>
                {RESULT_OPTS.map(o => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
        </div>

        <p className="text-[10px] text-muted-foreground pt-1 border-t">
          Filtros se combinam (E lógico). Use "Limpar" para resetar tudo.
        </p>
      </PopoverContent>
    </Popover>
  );
}
