import { useState, useRef } from 'react';
import DashboardLayout from '@/components/layout/DashboardLayout';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { useKanban } from '@/hooks/useKanban';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { Trash2, Plus, GripVertical } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useAuth } from '@/contexts/AuthContext';

export default function KanbanAdmin() {
  const { columns, createColumn, updateColumn, deleteColumn, reorderColumns } = useKanban();
  const { isSupport } = useAuth();
  const [newName, setNewName] = useState('');
  const [newColor, setNewColor] = useState('#6b7280');
  const [newArchiveDays, setNewArchiveDays] = useState('');
  const [dragIdx, setDragIdx] = useState<number | null>(null);
  const [overIdx, setOverIdx] = useState<number | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const dragRef = useRef<number | null>(null);

  const readOnly = isSupport;

  const handleCreate = async () => {
    if (!newName.trim() || readOnly) return;
    await createColumn(newName.trim(), newColor, newArchiveDays ? parseInt(newArchiveDays) : null);
    setNewName('');
    setNewColor('#6b7280');
    setNewArchiveDays('');
  };

  const handleDragStart = (idx: number) => {
    if (readOnly) return;
    setDragIdx(idx);
    dragRef.current = idx;
  };

  const handleDragOver = (e: React.DragEvent, idx: number) => {
    if (readOnly) return;
    e.preventDefault();
    setOverIdx(idx);
  };

  const handleDrop = async (e: React.DragEvent, dropIdx: number) => {
    if (readOnly) return;
    e.preventDefault();
    const fromIdx = dragRef.current;
    if (fromIdx === null || fromIdx === dropIdx) { setDragIdx(null); setOverIdx(null); return; }
    const reordered = [...columns];
    const [moved] = reordered.splice(fromIdx, 1);
    reordered.splice(dropIdx, 0, moved);
    setDragIdx(null);
    setOverIdx(null);
    await reorderColumns(reordered.map(c => c.id));
  };

  const handleDragEnd = () => { setDragIdx(null); setOverIdx(null); };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold">{readOnly ? 'Visualizar Kanban' : 'Gerenciar Kanban'}</h1>
          <p className="text-muted-foreground">
            {readOnly ? 'Visualização das colunas do Kanban (somente leitura)' : 'Arraste para reordenar, edite nome e cor de cada coluna'}
          </p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Colunas do Kanban</CardTitle>
            <CardDescription>{columns.length} coluna(s)</CardDescription>
          </CardHeader>
          <CardContent className="space-y-1">
            {columns.map((col, idx) => (
              <div
                key={col.id}
                draggable={!readOnly}
                onDragStart={() => handleDragStart(idx)}
                onDragOver={(e) => handleDragOver(e, idx)}
                onDrop={(e) => handleDrop(e, idx)}
                onDragEnd={handleDragEnd}
                className={cn(
                  "flex items-center gap-2 rounded-lg p-3 transition-all",
                  dragIdx === idx ? "opacity-40 bg-muted/50" : "bg-muted/30",
                  overIdx === idx && dragIdx !== idx && "border-t-2 border-primary"
                )}
              >
                {!readOnly && <GripVertical className="w-4 h-4 text-muted-foreground shrink-0 cursor-grab active:cursor-grabbing" />}
                <div className="w-6 h-6 rounded shrink-0 border border-border" style={{ backgroundColor: col.color_hex || '#6b7280' }} />
                {!readOnly ? (
                  <>
                    <input
                      type="color"
                      value={col.color_hex || '#6b7280'}
                      onChange={(e) => updateColumn(col.id, { color_hex: e.target.value })}
                      className="w-0 h-0 opacity-0 absolute"
                      id={`color-${col.id}`}
                    />
                    <label htmlFor={`color-${col.id}`} className="cursor-pointer text-xs text-muted-foreground hover:text-foreground">🎨</label>
                    <Input
                      value={col.name}
                      onChange={(e) => updateColumn(col.id, { name: e.target.value })}
                      className="flex-1 h-9"
                    />
                    <Input
                      type="number"
                      min="0"
                      placeholder="Auto-arquivar (dias)"
                      value={col.auto_archive_days ?? ''}
                      onChange={(e) => updateColumn(col.id, { auto_archive_days: e.target.value ? parseInt(e.target.value) : null })}
                      className="w-32 h-9 text-sm"
                      title="Dias para auto-arquivar (vazio = nunca)"
                    />
                    <Button variant="ghost" size="icon" className="text-destructive" onClick={() => setDeleteId(col.id)}>
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </>
                ) : (
                  <>
                    <span className="flex-1 text-sm font-medium">{col.name}</span>
                    {col.auto_archive_days && (
                      <span className="text-xs text-muted-foreground">Auto-arquivar: {col.auto_archive_days}d</span>
                    )}
                  </>
                )}
              </div>
            ))}

            {!readOnly && (
              <div className="border-t pt-4 mt-4">
                <p className="text-sm font-medium mb-2 text-muted-foreground">Nova coluna</p>
                <div className="flex items-center gap-2">
                  <input type="color" value={newColor} onChange={(e) => setNewColor(e.target.value)} className="w-8 h-8 rounded cursor-pointer border-0 p-0 shrink-0" />
                  <Input value={newName} onChange={(e) => setNewName(e.target.value)} placeholder="Nome da coluna" className="flex-1 h-9" />
                  <Input type="number" min="0" value={newArchiveDays} onChange={(e) => setNewArchiveDays(e.target.value)} placeholder="Dias" className="w-24 h-9 text-sm" />
                  <Button onClick={handleCreate} disabled={!newName.trim()}>
                    <Plus className="w-4 h-4 mr-1" /> Criar
                  </Button>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {!readOnly && (
        <AlertDialog open={!!deleteId} onOpenChange={() => setDeleteId(null)}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Excluir coluna</AlertDialogTitle>
              <AlertDialogDescription>Tem certeza? Cards nesta coluna serão perdidos. Esta ação não pode ser desfeita.</AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancelar</AlertDialogCancel>
              <AlertDialogAction className="bg-destructive text-destructive-foreground hover:bg-destructive/90" onClick={() => { if (deleteId) { deleteColumn(deleteId); setDeleteId(null); } }}>Excluir</AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      )}
    </DashboardLayout>
  );
}
