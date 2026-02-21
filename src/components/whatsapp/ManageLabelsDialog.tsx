import { useState, useEffect } from 'react';
import { Plus, Pencil, Trash2, Loader2, Tag } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import LabelBadge from './LabelBadge';

interface LabelItem {
  label_id: string;
  name: string;
  color_hex: string | null;
}

interface ManageLabelsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  chipId: string | null;
  chipStatus?: string;
  onLabelsUpdated?: () => void;
}

const PRESET_COLORS = [
  '#61bd4f', '#f2d600', '#ff9f1a', '#eb5a46',
  '#c377e0', '#0079bf', '#00c2e0', '#51e898',
  '#ff78cb', '#344563',
];

export default function ManageLabelsDialog({ open, onOpenChange, chipId, chipStatus, onLabelsUpdated }: ManageLabelsDialogProps) {
  const { toast } = useToast();
  const [labels, setLabels] = useState<LabelItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [newName, setNewName] = useState('');
  const [newColor, setNewColor] = useState(PRESET_COLORS[0]);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState('');
  const [editColor, setEditColor] = useState('');

  useEffect(() => {
    if (!open || !chipId) return;
    setLoading(true);
    (supabase
      .from('labels' as any)
      .select('label_id, name, color_hex')
      .eq('chip_id', chipId) as any)
      .then(({ data }: any) => {
        if (data) setLabels(data);
      })
      .finally(() => setLoading(false));
  }, [open, chipId]);

  const isOffline = chipStatus && chipStatus !== 'connected';

  const handleCreate = async () => {
    if (!chipId || !newName.trim()) return;
    if (isOffline) {
      toast({ title: 'Chip desconectado', description: 'Conecte o WhatsApp para gerenciar etiquetas', variant: 'destructive' });
      return;
    }
    setSaving(true);
    try {
      const res = await supabase.functions.invoke('uazapi-api', {
        body: { action: 'edit-label', chipId, labelName: newName.trim(), labelColor: newColor },
      });
      if (res.data?.success) {
        toast({ title: 'Etiqueta criada' });
        setNewName('');
        await supabase.functions.invoke('uazapi-api', {
          body: { action: 'fetch-labels', chipId },
        });
        const { data: fresh } = await supabase
          .from('labels' as any)
          .select('label_id, name, color_hex')
          .eq('chip_id', chipId) as any;
        if (fresh) setLabels(fresh);
        onLabelsUpdated?.();
      } else {
        toast({ title: 'Erro ao criar etiqueta', description: res.data?.error || 'Verifique se o chip está conectado', variant: 'destructive' });
      }
    } catch {
      toast({ title: 'Erro ao criar etiqueta', description: 'Verifique se o chip está conectado', variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  const handleEdit = async (labelId: string) => {
    if (!chipId || !editName.trim()) return;
    setSaving(true);
    try {
      const res = await supabase.functions.invoke('uazapi-api', {
        body: { action: 'edit-label', chipId, labelId, labelName: editName.trim(), labelColor: editColor },
      });
      if (res.data?.success) {
        toast({ title: 'Etiqueta atualizada' });
        setEditingId(null);
        await supabase.functions.invoke('uazapi-api', {
          body: { action: 'fetch-labels', chipId },
        });
        const { data: fresh } = await supabase
          .from('labels' as any)
          .select('label_id, name, color_hex')
          .eq('chip_id', chipId) as any;
        if (fresh) setLabels(fresh);
        onLabelsUpdated?.();
      } else {
        toast({ title: 'Erro ao atualizar', variant: 'destructive' });
      }
    } catch {
      toast({ title: 'Erro ao atualizar', variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (labelId: string) => {
    if (!chipId) return;
    setSaving(true);
    try {
      const res = await supabase.functions.invoke('uazapi-api', {
        body: { action: 'edit-label', chipId, labelId, deleteLbl: true },
      });
      if (res.data?.success) {
        setLabels(prev => prev.filter(l => l.label_id !== labelId));
        await (supabase as any).from('labels' as any).delete().eq('chip_id', chipId).eq('label_id', labelId);
        toast({ title: 'Etiqueta excluída' });
        onLabelsUpdated?.();
      } else {
        toast({ title: 'Erro ao excluir', variant: 'destructive' });
      }
    } catch {
      toast({ title: 'Erro ao excluir', variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  const startEdit = (label: LabelItem) => {
    setEditingId(label.label_id);
    setEditName(label.name);
    setEditColor(label.color_hex || PRESET_COLORS[0]);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Tag className="w-4 h-4" /> Gerenciar Etiquetas
          </DialogTitle>
          <DialogDescription>Crie, edite ou exclua etiquetas do WhatsApp</DialogDescription>
        </DialogHeader>

        {/* Create new */}
        <div className="space-y-2 border rounded-lg p-3">
          <Label className="text-xs text-muted-foreground">Nova etiqueta</Label>
          <div className="flex gap-2">
            <Input
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              placeholder="Nome da etiqueta"
              className="h-8 text-sm"
              onKeyDown={(e) => e.key === 'Enter' && handleCreate()}
            />
            <Button size="sm" onClick={handleCreate} disabled={saving || !newName.trim()} className="h-8">
              {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Plus className="w-3.5 h-3.5" />}
            </Button>
          </div>
          <div className="flex gap-1.5 flex-wrap">
            {PRESET_COLORS.map(c => (
              <button
                key={c}
                onClick={() => setNewColor(c)}
                className="w-5 h-5 rounded-full border-2 transition-transform"
                style={{
                  backgroundColor: c,
                  borderColor: newColor === c ? 'hsl(var(--foreground))' : 'transparent',
                  transform: newColor === c ? 'scale(1.2)' : 'scale(1)',
                }}
              />
            ))}
          </div>
        </div>

        {/* List */}
        {loading ? (
          <div className="flex justify-center py-6">
            <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
          </div>
        ) : labels.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-4">Nenhuma etiqueta encontrada</p>
        ) : (
          <div className="space-y-1.5">
            {labels.map(label => (
              <div key={label.label_id} className="flex items-center gap-2 p-2 rounded-md hover:bg-secondary/50 group">
                {editingId === label.label_id ? (
                  <>
                    <Input
                      value={editName}
                      onChange={(e) => setEditName(e.target.value)}
                      className="h-7 text-sm flex-1"
                      onKeyDown={(e) => e.key === 'Enter' && handleEdit(label.label_id)}
                    />
                    <div className="flex gap-1">
                      {PRESET_COLORS.slice(0, 5).map(c => (
                        <button
                          key={c}
                          onClick={() => setEditColor(c)}
                          className="w-4 h-4 rounded-full border"
                          style={{
                            backgroundColor: c,
                            borderColor: editColor === c ? 'hsl(var(--foreground))' : 'transparent',
                          }}
                        />
                      ))}
                    </div>
                    <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={() => handleEdit(label.label_id)} disabled={saving}>
                      Salvar
                    </Button>
                    <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={() => setEditingId(null)}>
                      ✕
                    </Button>
                  </>
                ) : (
                  <>
                    <LabelBadge name={label.name} colorHex={label.color_hex} />
                    <span className="text-sm flex-1">{label.name}</span>
                    <Button
                      size="icon"
                      variant="ghost"
                      className="h-6 w-6 opacity-0 group-hover:opacity-100"
                      onClick={() => startEdit(label)}
                    >
                      <Pencil className="w-3 h-3" />
                    </Button>
                    <Button
                      size="icon"
                      variant="ghost"
                      className="h-6 w-6 opacity-0 group-hover:opacity-100 text-destructive hover:text-destructive"
                      onClick={() => handleDelete(label.label_id)}
                      disabled={saving}
                    >
                      <Trash2 className="w-3 h-3" />
                    </Button>
                  </>
                )}
              </div>
            ))}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
