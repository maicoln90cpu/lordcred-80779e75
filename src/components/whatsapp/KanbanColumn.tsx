import { memo, DragEvent, useState } from 'react';
import { ScrollArea } from '@/components/ui/scroll-area';
import KanbanCard from './KanbanCard';
import type { KanbanCard as KanbanCardType, KanbanColumn as KanbanColumnType } from '@/hooks/useKanban';

interface Props {
  column: KanbanColumnType;
  cards: KanbanCardType[];
  labels: { label_id: string; name: string; color_hex: string | null }[];
  onDrop: (cardId: string, columnId: string) => void;
  onCardClick: (card: KanbanCardType) => void;
}

export default memo(function KanbanColumn({ column, cards, labels, onDrop, onCardClick }: Props) {
  const [dragOver, setDragOver] = useState(false);

  const handleDragOver = (e: DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    setDragOver(true);
  };

  const handleDragLeave = () => setDragOver(false);

  const handleDrop = (e: DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const cardId = e.dataTransfer.getData('text/plain');
    if (cardId) onDrop(cardId, column.id);
  };

  return (
    <div
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      className={`flex flex-col w-[300px] min-w-[300px] rounded-xl bg-muted/40 border transition-colors ${dragOver ? 'border-primary/50 bg-primary/5' : 'border-border/40'}`}
    >
      <div className="flex items-center gap-2 px-3 py-2.5 border-b border-border/40">
        <div className="w-3 h-3 rounded-full shrink-0" style={{ backgroundColor: column.color_hex || '#6b7280' }} />
        <h3 className="text-sm font-semibold text-foreground truncate">{column.name}</h3>
        <span className="ml-auto text-xs text-muted-foreground bg-muted px-1.5 py-0.5 rounded-full">{cards.length}</span>
      </div>
      <ScrollArea className="flex-1 p-2">
        <div className="space-y-2">
          {cards.map(card => (
            <KanbanCard key={card.id} card={card} labels={labels} onClick={onCardClick} />
          ))}
          {cards.length === 0 && (
            <p className="text-xs text-muted-foreground text-center py-8">Nenhum contato</p>
          )}
        </div>
      </ScrollArea>
    </div>
  );
});
