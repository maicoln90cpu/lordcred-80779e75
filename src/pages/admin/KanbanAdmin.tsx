import { useState } from 'react';
import DashboardLayout from '@/components/layout/DashboardLayout';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import KanbanSettingsDialog from '@/components/whatsapp/KanbanSettingsDialog';
import { useKanban } from '@/hooks/useKanban';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Trash2, Plus, GripVertical } from 'lucide-react';

export default function KanbanAdmin() {
  const { columns, createColumn, updateColumn, deleteColumn, reorderColumns } = useKanban();
  const [newName, setNewName] = useState('');
  const [newColor, setNewColor] = useState('#6b7280');
  const [newArchiveDays, setNewArchiveDays] = useState('');

  const handleCreate = async () => {
    if (!newName.trim()) return;
    await createColumn(newName.trim(), newColor, newArchiveDays ? parseInt(newArchiveDays) : null);
    setNewName('');
    setNewColor('#6b7280');
    setNewArchiveDays('');
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold">Gerenciar Kanban</h1>
          <p className="text-muted-foreground">Editar nomes, cores e ordem das colunas do Kanban</p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Colunas do Kanban</CardTitle>
            <CardDescription>Arraste para reordenar, edite nome e cor de cada coluna</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {columns.map((col) => (
              <div key={col.id} className="flex items-center gap-2 bg-muted/30 rounded-lg p-3">
                <GripVertical className="w-4 h-4 text-muted-foreground shrink-0" />
                <input
                  type="color"
                  value={col.color_hex || '#6b7280'}
                  onChange={(e) => updateColumn(col.id, { color_hex: e.target.value })}
                  className="w-8 h-8 rounded cursor-pointer border-0 p-0 shrink-0"
                />
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
                <Button variant="ghost" size="icon" className="text-destructive" onClick={() => deleteColumn(col.id)}>
                  <Trash2 className="w-4 h-4" />
                </Button>
              </div>
            ))}

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
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}
