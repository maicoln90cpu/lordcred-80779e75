import { format, parseISO } from 'date-fns';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { Clock, MapPin, Trash2, User } from 'lucide-react';
import {
  EVENT_TYPE_LABEL, EVENT_TYPE_TOKEN,
  type HRCalendarEvent,
} from '@/hooks/useHRCalendarEvents';

interface Props {
  event: HRCalendarEvent;
  candidateName?: string | null;
  /** Quando true, mostra a data antes do horário (usado em Lista/Agenda). */
  showDate?: boolean;
  onEdit: (ev: HRCalendarEvent) => void;
  onDelete: (id: string) => void;
}

/**
 * Card de um evento — extraído para reuso entre as views Mês, Lista e Agenda.
 * Mantém o estilo da borda colorida por tipo + ações (editar / remover).
 */
export default function HRCalendarEventCard({ event, candidateName, showDate, onEdit, onDelete }: Props) {
  const color = `hsl(var(${EVENT_TYPE_TOKEN[event.event_type]}))`;
  return (
    <Card
      className="p-4 cursor-pointer hover:shadow-md transition-all"
      style={{ borderLeft: `4px solid ${color}` }}
      onClick={() => onEdit(event)}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <h3 className="font-semibold text-sm">{event.title}</h3>
            <Badge
              variant="outline"
              className="text-[10px]"
              style={{ borderColor: color, color }}
            >
              {EVENT_TYPE_LABEL[event.event_type]}
            </Badge>
          </div>
          <div className="flex items-center gap-3 mt-1.5 text-xs text-muted-foreground flex-wrap">
            <span className="flex items-center gap-1">
              <Clock className="w-3 h-3" />
              {showDate && `${format(parseISO(event.starts_at), 'dd/MM/yyyy')} · `}
              {format(parseISO(event.starts_at), 'HH:mm')}
              {event.ends_at && ` – ${format(parseISO(event.ends_at), 'HH:mm')}`}
            </span>
            {event.location && (
              <span className="flex items-center gap-1">
                <MapPin className="w-3 h-3" /> {event.location}
              </span>
            )}
            {candidateName && (
              <span className="flex items-center gap-1">
                <User className="w-3 h-3" /> {candidateName}
              </span>
            )}
          </div>
          {event.description && (
            <p className="text-xs text-muted-foreground mt-2 line-clamp-2">
              {event.description}
            </p>
          )}
        </div>
        <AlertDialog>
          <AlertDialogTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7 text-destructive shrink-0"
              onClick={(e) => e.stopPropagation()}
            >
              <Trash2 className="w-3.5 h-3.5" />
            </Button>
          </AlertDialogTrigger>
          <AlertDialogContent onClick={(e) => e.stopPropagation()}>
            <AlertDialogHeader>
              <AlertDialogTitle>Remover evento?</AlertDialogTitle>
              <AlertDialogDescription>
                <b>{event.title}</b> será removido da agenda.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancelar</AlertDialogCancel>
              <AlertDialogAction onClick={() => onDelete(event.id)}>
                Remover
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </Card>
  );
}
