import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { CalendarIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Card, CardContent } from '@/components/ui/card';
import { cn } from '@/lib/utils';

interface CRDateFilterProps {
  dataInicio: Date | undefined;
  dataFim: Date | undefined;
  setDataInicio: (d: Date | undefined) => void;
  setDataFim: (d: Date | undefined) => void;
}

export default function CRDateFilter({ dataInicio, dataFim, setDataInicio, setDataFim }: CRDateFilterProps) {
  return (
    <Card>
      <CardContent className="py-3">
        <div className="flex items-center gap-4 flex-wrap">
          <span className="text-sm font-medium text-muted-foreground">Filtro de Período:</span>
          <Popover>
            <PopoverTrigger asChild>
              <Button variant="outline" className={cn("w-[180px] justify-start text-left font-normal h-9", !dataInicio && "text-muted-foreground")}>
                <CalendarIcon className="mr-2 h-4 w-4" />
                {dataInicio ? format(dataInicio, "dd/MM/yyyy") : "Data Início"}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="start">
              <Calendar mode="single" selected={dataInicio} onSelect={setDataInicio} locale={ptBR} initialFocus className="p-3 pointer-events-auto" />
            </PopoverContent>
          </Popover>
          <Popover>
            <PopoverTrigger asChild>
              <Button variant="outline" className={cn("w-[180px] justify-start text-left font-normal h-9", !dataFim && "text-muted-foreground")}>
                <CalendarIcon className="mr-2 h-4 w-4" />
                {dataFim ? format(dataFim, "dd/MM/yyyy") : "Data Fim"}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="start">
              <Calendar mode="single" selected={dataFim} onSelect={setDataFim} locale={ptBR} initialFocus className="p-3 pointer-events-auto" />
            </PopoverContent>
          </Popover>
          {(dataInicio || dataFim) && (
            <Button variant="ghost" size="sm" onClick={() => { setDataInicio(undefined); setDataFim(undefined); }}>Limpar</Button>
          )}
          {(dataInicio || dataFim) && (
            <Badge variant="secondary" className="text-xs">
              {dataInicio ? format(dataInicio, "dd/MM/yyyy") : '...'} — {dataFim ? format(dataFim, "dd/MM/yyyy") : '...'}
            </Badge>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
