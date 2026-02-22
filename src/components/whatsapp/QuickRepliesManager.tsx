import { useState, useEffect, useCallback } from 'react';
import { Plus, Pencil, Trash2, Loader2, Zap } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { ScrollArea } from '@/components/ui/scroll-area';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

interface QuickReply {
  id?: string;
  shortCut: string;
  text: string;
}

interface QuickRepliesManagerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  chipId: string | null;
}

export default function QuickRepliesManager({ open, onOpenChange, chipId }: QuickRepliesManagerProps) {
  const [replies, setReplies] = useState<QuickReply[]>([]);
  const [loading, setLoading] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [editReply, setEditReply] = useState<QuickReply | null>(null);
  const [shortCut, setShortCut] = useState('');
  const [text, setText] = useState('');
  const [saving, setSaving] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<QuickReply | null>(null);
  const { toast } = useToast();

  const fetchReplies = useCallback(async () => {
    if (!chipId) return;
    setLoading(true);
    try {
      const res = await supabase.functions.invoke('uazapi-api', {
        body: { action: 'list-quick-replies', chipId },
      });
      setReplies(res.data?.quickReplies || []);
    } catch {
      toast({ title: 'Erro ao carregar respostas rápidas', variant: 'destructive' });
    }
    setLoading(false);
  }, [chipId, toast]);

  useEffect(() => {
    if (open && chipId) fetchReplies();
  }, [open, chipId, fetchReplies]);

  const openNew = () => {
    setEditReply(null);
    setShortCut('');
    setText('');
    setEditOpen(true);
  };

  const openEdit = (qr: QuickReply) => {
    setEditReply(qr);
    setShortCut(qr.shortCut);
    setText(qr.text);
    setEditOpen(true);
  };

  const handleSave = async () => {
    if (!chipId || !shortCut.trim() || !text.trim()) return;
    setSaving(true);
    try {
      const body: any = {
        action: 'edit-quick-reply',
        chipId,
        shortCut: shortCut.trim(),
        text: text.trim(),
      };
      if (editReply?.id) body.replyId = editReply.id;

      await supabase.functions.invoke('uazapi-api', { body });
      toast({ title: editReply ? 'Resposta atualizada' : 'Resposta criada' });
      setEditOpen(false);
      // Clear cache so ChatInput re-fetches
      delete (window as any).__quickReplyCache?.[chipId];
      fetchReplies();
    } catch {
      toast({ title: 'Erro ao salvar', variant: 'destructive' });
    }
    setSaving(false);
  };

  const handleDelete = async () => {
    if (!chipId || !deleteTarget) return;
    try {
      await supabase.functions.invoke('uazapi-api', {
        body: {
          action: 'edit-quick-reply',
          chipId,
          shortCut: deleteTarget.shortCut,
          text: deleteTarget.text,
          replyId: deleteTarget.id,
          deleteReply: true,
        },
      });
      toast({ title: 'Resposta excluída' });
      setDeleteTarget(null);
      fetchReplies();
    } catch {
      toast({ title: 'Erro ao excluir', variant: 'destructive' });
    }
  };

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="sm:max-w-lg max-h-[80vh] flex flex-col">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Zap className="w-5 h-5 text-primary" />
              Respostas Rápidas
            </DialogTitle>
          </DialogHeader>

          <div className="flex justify-end">
            <Button size="sm" onClick={openNew}>
              <Plus className="w-4 h-4 mr-1" /> Nova resposta
            </Button>
          </div>

          <ScrollArea className="flex-1 min-h-0 max-h-[50vh]">
            {loading ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
              </div>
            ) : replies.length === 0 ? (
              <div className="text-center py-8 text-sm text-muted-foreground">
                Nenhuma resposta rápida cadastrada.
                <br />
                <span className="text-xs">Crie atalhos para agilizar suas respostas.</span>
              </div>
            ) : (
              <div className="space-y-2 pr-2">
                {replies.map((qr, i) => (
                  <div key={qr.id || i} className="flex items-start gap-3 p-3 rounded-lg border border-border/50 bg-card/50 hover:bg-secondary/30 transition-colors">
                    <div className="flex-1 min-w-0">
                      <span className="text-xs font-mono text-primary font-semibold">/{qr.shortCut}</span>
                      <p className="text-sm text-foreground mt-0.5 whitespace-pre-wrap break-words">{qr.text}</p>
                    </div>
                    <div className="flex items-center gap-1 shrink-0">
                      <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => openEdit(qr)}>
                        <Pencil className="w-3.5 h-3.5" />
                      </Button>
                      <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive hover:text-destructive" onClick={() => setDeleteTarget(qr)}>
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
            <DialogTitle>{editReply ? 'Editar resposta rápida' : 'Nova resposta rápida'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <div>
              <label className="text-sm font-medium text-foreground">Atalho</label>
              <div className="flex items-center gap-1 mt-1">
                <span className="text-muted-foreground">/</span>
                <Input
                  value={shortCut}
                  onChange={(e) => setShortCut(e.target.value.replace(/\s/g, ''))}
                  placeholder="saudacao"
                  className="flex-1"
                />
              </div>
            </div>
            <div>
              <label className="text-sm font-medium text-foreground">Texto da resposta</label>
              <Textarea
                value={text}
                onChange={(e) => setText(e.target.value)}
                placeholder="Olá! Como posso ajudar?"
                rows={4}
                className="mt-1"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditOpen(false)}>Cancelar</Button>
            <Button onClick={handleSave} disabled={saving || !shortCut.trim() || !text.trim()}>
              {saving ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : null}
              {editReply ? 'Salvar' : 'Criar'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete confirmation */}
      <AlertDialog open={!!deleteTarget} onOpenChange={(open) => !open && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir resposta rápida</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja excluir o atalho <strong>/{deleteTarget?.shortCut}</strong>?
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
