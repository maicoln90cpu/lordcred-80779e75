import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Trash2, Plus, GripVertical } from 'lucide-react';
import type { KanbanColumn } from '@/hooks/useKanban';

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  columns: KanbanColumn[];
  onCreateColumn: (name: string, color: string, archiveDays: number | null) => Promise<void>;
  onUpdateColumn: (id: string, updates: Partial<KanbanColumn>) => Promise<void>;
  onDeleteColumn: (id: string) => Promise<void>;
  onReorderColumns: (ids: string[]) => Promise<void>;
}

export default function KanbanSettingsDialog({ open, onOpenChange, columns, onCreateColumn, onUpdateColumn, onDeleteColumn, onReorderColumns }: Props) {
  const [newName, setNewName] = useState('');
  const [newColor, setNewColor] = useState('#6b7280');
  const [newArchiveDays, setNewArchiveDays] = useState('');

  const handleCreate = async () => {
    if (!newName.trim()) return;
    await onCreateColumn(newName.trim(), newColor, newArchiveDays ? parseInt(newArchiveDays) : null);
    setNewName('');
    setNewColor('#6b7280');
    setNewArchiveDays('');
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Gerenciar colunas do Kanban</DialogTitle>
        </DialogHeader>

        <div className="space-y-3 max-h-[400px] overflow-y-auto">
          {columns.map((col) => (
            <div key={col.id} className="flex items-center gap-2 bg-muted/30 rounded-lg p-2">
              <GripVertical className="w-4 h-4 text-muted-foreground shrink-0" />
              <input
                type="color"
                value={col.color_hex || '#6b7280'}
                onChange={(e) => onUpdateColumn(col.id, { color_hex: e.target.value })}
                className="w-8 h-8 rounded cursor-pointer border-0 p-0 shrink-0"
              />
              <Input
                value={col.name}
                onChange={(e) => onUpdateColumn(col.id, { name: e.target.value })}
                className="flex-1 h-8 text-sm"
              />
              <div className="flex items-center gap-1 shrink-0">
                <Input
                  type="number"
                  min="0"
                  placeholder="Dias"
                  value={col.auto_archive_days ?? ''}
                  onChange={(e) => onUpdateColumn(col.id, { auto_archive_days: e.target.value ? parseInt(e.target.value) : null })}
                  className="w-16 h-8 text-xs"
                  title="Dias para auto-arquivar (vazio = nunca)"
                />
                <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={() => onDeleteColumn(col.id)}>
                  <Trash2 className="w-3.5 h-3.5" />
                </Button>
              </div>
            </div>
          ))}
        </div>

        <div className="border-t pt-3 space-y-2">
          <Label className="text-xs text-muted-foreground">Nova coluna</Label>
          <div className="flex items-center gap-2">
            <input type="color" value={newColor} onChange={(e) => setNewColor(e.target.value)} className="w-8 h-8 rounded cursor-pointer border-0 p-0 shrink-0" />
            <Input value={newName} onChange={(e) => setNewName(e.target.value)} placeholder="Nome da coluna" className="flex-1 h-8 text-sm" />
            <Input type="number" min="0" value={newArchiveDays} onChange={(e) => setNewArchiveDays(e.target.value)} placeholder="Dias" className="w-16 h-8 text-xs" title="Auto-arquivar após X dias" />
            <Button size="sm" onClick={handleCreate} disabled={!newName.trim()} className="h-8">
              <Plus className="w-3.5 h-3.5 mr-1" />Criar
            </Button>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Fechar</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
