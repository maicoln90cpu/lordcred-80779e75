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

  const colColor = column.color_hex || '#6b7280';

  return (
    <div
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      className={`flex flex-col w-[300px] min-w-[300px] rounded-xl border transition-all duration-200 ${
        dragOver
          ? 'border-primary/60 shadow-lg shadow-primary/10'
          : 'border-border/30 shadow-sm'
      }`}
      style={{
        background: `linear-gradient(180deg, ${colColor}08 0%, hsl(var(--card)) 15%)`,
      }}
    >
      {/* Header with colored top accent */}
      <div className="relative px-3.5 py-3 border-b border-border/30">
        <div
          className="absolute top-0 left-3 right-3 h-[3px] rounded-b-full"
          style={{ backgroundColor: colColor }}
        />
        <div className="flex items-center gap-2.5 mt-0.5">
          <div
            className="w-2.5 h-2.5 rounded-full shrink-0 ring-2 ring-offset-1 ring-offset-card"
            style={{ backgroundColor: colColor, boxShadow: `0 0 8px ${colColor}60`, ringColor: `${colColor}40` }}
          />
          <h3 className="text-sm font-bold text-foreground tracking-tight truncate">{column.name}</h3>
          <span
            className="ml-auto text-[11px] font-semibold px-2 py-0.5 rounded-full"
            style={{
              backgroundColor: `${colColor}18`,
              color: colColor,
            }}
          >
            {cards.length}
          </span>
        </div>
      </div>
      <ScrollArea className="flex-1 p-2">
        <div className="space-y-2">
          {cards.map(card => (
            <KanbanCard key={card.id} card={card} labels={labels} columnColor={colColor} onClick={onCardClick} />
          ))}
          {cards.length === 0 && (
            <div className="flex flex-col items-center justify-center py-10 text-muted-foreground/60">
              <div className="w-10 h-10 rounded-full border-2 border-dashed border-muted-foreground/20 flex items-center justify-center mb-2">
                <span className="text-lg">+</span>
              </div>
              <p className="text-xs">Arraste um contato aqui</p>
            </div>
          )}
        </div>
      </ScrollArea>
    </div>
  );
});
