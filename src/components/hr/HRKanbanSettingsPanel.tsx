import { useState } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Loader2, Plus, Trash2, GripVertical, ArrowUp, ArrowDown } from 'lucide-react';
import { useHRKanbanColumns, type HRKanbanColumn } from '@/hooks/useHRKanbanColumns';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

export function HRKanbanSettingsPanel() {
  return (
    <Card className="p-6 space-y-4">
      <div>
        <h3 className="text-lg font-semibold">Colunas do Kanban</h3>
        <p className="text-sm text-muted-foreground">
          Personalize nome, cor e ordem das colunas do Kanban de candidatos e colaboradores.
        </p>
      </div>
      <Tabs defaultValue="candidates">
        <TabsList>
          <TabsTrigger value="candidates">Candidatos</TabsTrigger>
          <TabsTrigger value="employees">Colaboradores</TabsTrigger>
        </TabsList>
        <TabsContent value="candidates">
          <BoardColumns board="candidates" />
        </TabsContent>
        <TabsContent value="employees">
          <BoardColumns board="employees" />
        </TabsContent>
      </Tabs>
    </Card>
  );
}

function BoardColumns({ board }: { board: 'candidates' | 'employees' }) {
  const { columns, loading, createColumn, updateColumn, deleteColumn, reorderColumns } = useHRKanbanColumns(board);
  const [newName, setNewName] = useState('');
  const [newColor, setNewColor] = useState('#6b7280');

  const handleCreate = async () => {
    if (!newName.trim()) return;
    await createColumn(newName.trim(), newColor);
    setNewName('');
    setNewColor('#6b7280');
  };

  const handleMove = async (idx: number, dir: 'up' | 'down') => {
    const ids = columns.map(c => c.id);
    const swapIdx = dir === 'up' ? idx - 1 : idx + 1;
    if (swapIdx < 0 || swapIdx >= ids.length) return;
    [ids[idx], ids[swapIdx]] = [ids[swapIdx], ids[idx]];
    await reorderColumns(ids);
  };

  if (loading) {
    return <div className="flex justify-center py-8"><Loader2 className="w-5 h-5 animate-spin text-muted-foreground" /></div>;
  }

  return (
    <div className="space-y-3 mt-3">
      <div className="space-y-2 max-h-[400px] overflow-y-auto pr-1">
        {columns.map((col, idx) => (
          <div key={col.id} className="flex items-center gap-2 bg-muted/30 rounded-lg p-2">
            <div className="flex flex-col gap-0.5 shrink-0">
              <Button size="icon" variant="ghost" className="h-5 w-5" disabled={idx === 0} onClick={() => handleMove(idx, 'up')}>
                <ArrowUp className="w-3 h-3" />
              </Button>
              <Button size="icon" variant="ghost" className="h-5 w-5" disabled={idx === columns.length - 1} onClick={() => handleMove(idx, 'down')}>
                <ArrowDown className="w-3 h-3" />
              </Button>
            </div>
            <input
              type="color"
              value={col.color_hex || '#6b7280'}
              onChange={e => updateColumn(col.id, { color_hex: e.target.value })}
              className="w-8 h-8 rounded cursor-pointer border-0 p-0 shrink-0"
            />
            <Input
              value={col.name}
              onChange={e => updateColumn(col.id, { name: e.target.value })}
              className="flex-1 h-8 text-sm"
            />
            <span className="text-[10px] text-muted-foreground font-mono shrink-0">{col.slug}</span>
            <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive shrink-0"
              onClick={() => { if (confirm(`Remover coluna "${col.name}"? Cards nessa coluna ficarão sem coluna visível.`)) deleteColumn(col.id); }}>
              <Trash2 className="w-3.5 h-3.5" />
            </Button>
          </div>
        ))}
      </div>

      <div className="border-t pt-3 space-y-2">
        <Label className="text-xs text-muted-foreground">Nova coluna</Label>
        <div className="flex items-center gap-2">
          <input type="color" value={newColor} onChange={e => setNewColor(e.target.value)} className="w-8 h-8 rounded cursor-pointer border-0 p-0 shrink-0" />
          <Input value={newName} onChange={e => setNewName(e.target.value)} placeholder="Nome da coluna" className="flex-1 h-8 text-sm" maxLength={100} />
          <Button size="sm" onClick={handleCreate} disabled={!newName.trim()} className="h-8 gap-1">
            <Plus className="w-3.5 h-3.5" /> Criar
          </Button>
        </div>
      </div>
    </div>
  );
}
