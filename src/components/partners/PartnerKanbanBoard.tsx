import { useState, useCallback, DragEvent, memo } from 'react';
import { ScrollArea, ScrollBar } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Phone, User, GripVertical } from 'lucide-react';
import { toast } from '@/hooks/use-toast';

interface PipelineStatus {
  value: string;
  label: string;
  color: string;
}

interface Partner {
  id: string;
  nome: string;
  telefone: string | null;
  pipeline_status: string;
  captacao_tipo: string | null;
  reuniao_marcada: string | null;
  criou_mei: string | null;
  enviou_link: boolean | null;
  [key: string]: any;
}

interface Props {
  partners: Partner[];
  statuses: PipelineStatus[];
  isInactive: (p: Partner) => boolean;
  onMove: (partnerId: string, newStatus: string) => Promise<void>;
  onCardClick: (id: string) => void;
}

// ─── Kanban Column ───
const KanbanColumn = memo(function KanbanColumn({
  status,
  cards,
  isInactive,
  dragOverStatus,
  onDragOver,
  onDragLeave,
  onDrop,
  onCardClick,
}: {
  status: PipelineStatus;
  cards: Partner[];
  isInactive: (p: Partner) => boolean;
  dragOverStatus: string | null;
  onDragOver: (e: DragEvent, statusValue: string) => void;
  onDragLeave: () => void;
  onDrop: (e: DragEvent, statusValue: string) => void;
  onCardClick: (id: string) => void;
}) {
  const isDragTarget = dragOverStatus === status.value;

  return (
    <div className="w-[280px] shrink-0 flex flex-col">
      <div className={`rounded-t-lg px-3 py-2 ${status.color}`}>
        <div className="flex items-center justify-between">
          <span className="text-xs font-semibold">{status.label}</span>
          <Badge variant="secondary" className="text-[10px] h-5">{cards.length}</Badge>
        </div>
      </div>
      <div
        onDragOver={(e) => onDragOver(e, status.value)}
        onDragLeave={onDragLeave}
        onDrop={(e) => onDrop(e, status.value)}
        className={`flex-1 rounded-b-lg p-2 space-y-2 min-h-[200px] border border-t-0 transition-all duration-200 ${
          isDragTarget
            ? 'border-primary/60 bg-primary/5 shadow-inner'
            : 'border-border/50 bg-muted/30'
        }`}
      >
        {cards.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-10 text-muted-foreground/50">
            <div className="w-10 h-10 rounded-full border-2 border-dashed border-muted-foreground/20 flex items-center justify-center mb-2">
              <span className="text-lg">+</span>
            </div>
            <p className="text-xs">{isDragTarget ? 'Solte aqui' : 'Arraste um parceiro'}</p>
          </div>
        ) : cards.map(p => (
          <PartnerKanbanCard
            key={p.id}
            partner={p}
            isInactive={isInactive(p)}
            onClick={() => onCardClick(p.id)}
          />
        ))}
      </div>
    </div>
  );
});

// ─── Kanban Card ───
const PartnerKanbanCard = memo(function PartnerKanbanCard({
  partner,
  isInactive: inactive,
  onClick,
}: {
  partner: Partner;
  isInactive: boolean;
  onClick: () => void;
}) {
  const handleDragStart = (e: DragEvent) => {
    e.dataTransfer.setData('application/partner-id', partner.id);
    e.dataTransfer.effectAllowed = 'move';
    // Add ghost effect
    if (e.currentTarget instanceof HTMLElement) {
      e.currentTarget.style.opacity = '0.5';
    }
  };

  const handleDragEnd = (e: DragEvent) => {
    if (e.currentTarget instanceof HTMLElement) {
      e.currentTarget.style.opacity = '1';
    }
  };

  return (
    <Card
      draggable
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
      className="cursor-grab active:cursor-grabbing hover:border-primary/50 transition-all duration-150 hover:shadow-md"
      onClick={onClick}
    >
      <CardContent className="p-3 space-y-2">
        <div className="flex items-center gap-1.5">
          <GripVertical className="w-3.5 h-3.5 text-muted-foreground/40 shrink-0" />
          <p className="font-medium text-sm truncate flex-1">{partner.nome}</p>
          {inactive && (
            <span className="inline-flex items-center rounded-full px-1.5 py-0.5 text-[10px] font-medium bg-amber-500/20 text-amber-500 shrink-0">
              Inativo
            </span>
          )}
        </div>
        {partner.telefone && (
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <Phone className="w-3 h-3" /> {partner.telefone}
          </div>
        )}
        {partner.captacao_tipo && (
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <User className="w-3 h-3" /> {partner.captacao_tipo}
          </div>
        )}
        <div className="flex gap-1 flex-wrap">
          {partner.reuniao_marcada && <Badge variant="outline" className="text-[10px]">📅 {partner.reuniao_marcada}</Badge>}
          {partner.criou_mei === 'Sim' && <Badge variant="outline" className="text-[10px]">✅ MEI</Badge>}
          {partner.enviou_link && <Badge variant="outline" className="text-[10px]">🔗 Link</Badge>}
        </div>
      </CardContent>
    </Card>
  );
});

// ─── Main Board ───
export default function PartnerKanbanBoard({ partners, statuses, isInactive, onMove, onCardClick }: Props) {
  const [dragOverStatus, setDragOverStatus] = useState<string | null>(null);

  const handleDragOver = useCallback((e: DragEvent, statusValue: string) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    setDragOverStatus(statusValue);
  }, []);

  const handleDragLeave = useCallback(() => {
    setDragOverStatus(null);
  }, []);

  const handleDrop = useCallback(async (e: DragEvent, newStatus: string) => {
    e.preventDefault();
    setDragOverStatus(null);
    const partnerId = e.dataTransfer.getData('application/partner-id');
    if (!partnerId) return;

    const partner = partners.find(p => p.id === partnerId);
    if (!partner || partner.pipeline_status === newStatus) return;

    const oldLabel = statuses.find(s => s.value === partner.pipeline_status)?.label;
    const newLabel = statuses.find(s => s.value === newStatus)?.label;

    await onMove(partnerId, newStatus);
    toast({ title: `${partner.nome} movido`, description: `${oldLabel} → ${newLabel}` });
  }, [partners, statuses, onMove]);

  return (
    <ScrollArea className="w-full pb-4">
      <div className="flex gap-4 min-w-max">
        {statuses.map(status => {
          const cards = partners.filter(p => p.pipeline_status === status.value);
          return (
            <KanbanColumn
              key={status.value}
              status={status}
              cards={cards}
              isInactive={isInactive}
              dragOverStatus={dragOverStatus}
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
              onCardClick={onCardClick}
            />
          );
        })}
      </div>
      <ScrollBar orientation="horizontal" />
    </ScrollArea>
  );
}
