import { useState, useEffect, useCallback } from 'react';
import { Plus, Pencil, Trash2, Loader2, Wand2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

interface Shortcut {
  id: string;
  trigger_word: string;
  response_text: string;
  is_active: boolean;
  chip_id: string | null;
}

interface ShortcutManagerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  chipId: string | null;
}

export default function ShortcutManager({ open, onOpenChange, chipId }: ShortcutManagerProps) {
  const [shortcuts, setShortcuts] = useState<Shortcut[]>([]);
  const [loading, setLoading] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [editItem, setEditItem] = useState<Shortcut | null>(null);
  const [triggerWord, setTriggerWord] = useState('');
  const [responseText, setResponseText] = useState('');
  const [saving, setSaving] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<Shortcut | null>(null);
  const { toast } = useToast();

  const fetchShortcuts = useCallback(async () => {
    setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      let query = supabase
        .from('message_shortcuts' as any)
        .select('*')
        .order('trigger_word');

      if (chipId) {
        query = query.or(`chip_id.eq.${chipId},chip_id.is.null`);
      }

      const { data, error } = await query;
      if (error) throw error;
      setShortcuts((data as any[]) || []);
    } catch {
      toast({ title: 'Erro ao carregar atalhos', variant: 'destructive' });
    }
    setLoading(false);
  }, [chipId, toast]);

  useEffect(() => {
    if (open) fetchShortcuts();
  }, [open, fetchShortcuts]);

  const openNew = () => {
    setEditItem(null);
    setTriggerWord('');
    setResponseText('');
    setEditOpen(true);
  };

  const openEdit = (s: Shortcut) => {
    setEditItem(s);
    setTriggerWord(s.trigger_word);
    setResponseText(s.response_text);
    setEditOpen(true);
  };

  const handleSave = async () => {
    if (!triggerWord.trim() || !responseText.trim()) return;
    setSaving(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const payload = {
        trigger_word: triggerWord.trim().toLowerCase(),
        response_text: responseText.trim(),
        chip_id: chipId,
        user_id: user.id,
      };

      if (editItem) {
        const { error } = await supabase
          .from('message_shortcuts' as any)
          .update({ trigger_word: payload.trigger_word, response_text: payload.response_text } as any)
          .eq('id', editItem.id);
        if (error) throw error;
        toast({ title: 'Atalho atualizado' });
      } else {
        const { error } = await supabase
          .from('message_shortcuts' as any)
          .insert(payload as any);
        if (error) throw error;
        toast({ title: 'Atalho criado' });
      }
      setEditOpen(false);
      fetchShortcuts();
    } catch {
      toast({ title: 'Erro ao salvar', variant: 'destructive' });
    }
    setSaving(false);
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    try {
      const { error } = await supabase
        .from('message_shortcuts' as any)
        .delete()
        .eq('id', deleteTarget.id);
      if (error) throw error;
      toast({ title: 'Atalho excluído' });
      setDeleteTarget(null);
      fetchShortcuts();
    } catch {
      toast({ title: 'Erro ao excluir', variant: 'destructive' });
    }
  };

  const toggleActive = async (s: Shortcut) => {
    try {
      await supabase
        .from('message_shortcuts' as any)
        .update({ is_active: !s.is_active } as any)
        .eq('id', s.id);
      setShortcuts(prev => prev.map(item => item.id === s.id ? { ...item, is_active: !item.is_active } : item));
    } catch {
      toast({ title: 'Erro ao atualizar', variant: 'destructive' });
    }
  };

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="sm:max-w-lg max-h-[80vh] flex flex-col">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Wand2 className="w-5 h-5 text-primary" />
              Atalhos de Mensagem
            </DialogTitle>
          </DialogHeader>

          <p className="text-xs text-muted-foreground">
            Configure palavras-gatilho que, ao serem digitadas, sugerem respostas automáticas.
          </p>

          <div className="flex justify-end">
            <Button size="sm" onClick={openNew}>
              <Plus className="w-4 h-4 mr-1" /> Novo atalho
            </Button>
          </div>

          <ScrollArea className="flex-1 min-h-0 max-h-[50vh]">
            {loading ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
              </div>
            ) : shortcuts.length === 0 ? (
              <div className="text-center py-8 text-sm text-muted-foreground">
                Nenhum atalho cadastrado.
                <br />
                <span className="text-xs">Crie gatilhos para agilizar respostas.</span>
              </div>
            ) : (
              <div className="space-y-2 pr-2">
                {shortcuts.map((s) => (
                  <div key={s.id} className="flex items-start gap-3 p-3 rounded-lg border border-border/50 bg-card/50 hover:bg-secondary/30 transition-colors">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-0.5">
                        <Badge variant="secondary" className="text-xs font-mono">
                          {s.trigger_word}
                        </Badge>
                        {!s.is_active && (
                          <Badge variant="outline" className="text-xs text-muted-foreground">
                            inativo
                          </Badge>
                        )}
                        {!s.chip_id && (
                          <Badge variant="outline" className="text-xs text-muted-foreground">
                            global
                          </Badge>
                        )}
                      </div>
                      <p className="text-sm text-foreground mt-1 whitespace-pre-wrap break-words line-clamp-2">{s.response_text}</p>
                    </div>
                    <div className="flex items-center gap-1 shrink-0">
                      <Switch checked={s.is_active} onCheckedChange={() => toggleActive(s)} className="scale-75" />
                      <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => openEdit(s)}>
                        <Pencil className="w-3.5 h-3.5" />
                      </Button>
                      <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive hover:text-destructive" onClick={() => setDeleteTarget(s)}>
                        <Trash2 className="w-3.5 h-3.5" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </ScrollArea>
        </DialogContent>
      </Dialog>

      {/* Create/Edit dialog */}
      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{editItem ? 'Editar atalho' : 'Novo atalho de mensagem'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <div>
              <label className="text-sm font-medium text-foreground">Palavra-gatilho</label>
              <Input
                value={triggerWord}
                onChange={(e) => setTriggerWord(e.target.value.replace(/\s/g, '').toLowerCase())}
                placeholder="obrigado, preco, horario..."
                className="mt-1"
              />
              <p className="text-xs text-muted-foreground mt-1">Quando esta palavra for detectada na mensagem recebida, a resposta será sugerida.</p>
            </div>
            <div>
              <label className="text-sm font-medium text-foreground">Texto da resposta</label>
              <Textarea
                value={responseText}
                onChange={(e) => setResponseText(e.target.value)}
                placeholder="Obrigado pelo contato! Como posso ajudar?"
                rows={4}
                className="mt-1"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditOpen(false)}>Cancelar</Button>
            <Button onClick={handleSave} disabled={saving || !triggerWord.trim() || !responseText.trim()}>
              {saving ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : null}
              {editItem ? 'Salvar' : 'Criar'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete confirmation */}
      <AlertDialog open={!!deleteTarget} onOpenChange={(open) => !open && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir atalho</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja excluir o gatilho <strong>{deleteTarget?.trigger_word}</strong>?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
