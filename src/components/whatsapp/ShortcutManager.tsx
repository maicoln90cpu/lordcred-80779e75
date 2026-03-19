import { useState, useEffect, useCallback, useRef } from 'react';
import { Plus, Pencil, Trash2, Loader2, Wand2, Image, Mic, FileText, X, Upload } from 'lucide-react';
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
  media_url: string | null;
  media_type: string | null;
  media_filename: string | null;
}

interface ShortcutManagerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  chipId: string | null;
}

// Invalidate cache when shortcuts change
export function invalidateShortcutCache(chipId: string) {
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('shortcut-cache-invalidate', { detail: chipId }));
  }
}

export default function ShortcutManager({ open, onOpenChange, chipId }: ShortcutManagerProps) {
  const [shortcuts, setShortcuts] = useState<Shortcut[]>([]);
  const [loading, setLoading] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [editItem, setEditItem] = useState<Shortcut | null>(null);
  const [triggerWord, setTriggerWord] = useState('');
  const [responseText, setResponseText] = useState('');
  const [mediaFile, setMediaFile] = useState<File | null>(null);
  const [mediaPreviewUrl, setMediaPreviewUrl] = useState<string | null>(null);
  const [existingMediaUrl, setExistingMediaUrl] = useState<string | null>(null);
  const [existingMediaType, setExistingMediaType] = useState<string | null>(null);
  const [existingMediaFilename, setExistingMediaFilename] = useState<string | null>(null);
  const [removeMedia, setRemoveMedia] = useState(false);
  const [saving, setSaving] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<Shortcut | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();

  const fetchShortcuts = useCallback(async () => {
    setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      let query = supabase
        .from('message_shortcuts' as any)
        .select('*')
        .eq('user_id', user.id)
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
    setMediaFile(null);
    setMediaPreviewUrl(null);
    setExistingMediaUrl(null);
    setExistingMediaType(null);
    setExistingMediaFilename(null);
    setRemoveMedia(false);
    setEditOpen(true);
  };

  const openEdit = (s: Shortcut) => {
    setEditItem(s);
    setTriggerWord(s.trigger_word);
    setResponseText(s.response_text);
    setMediaFile(null);
    setMediaPreviewUrl(null);
    setExistingMediaUrl(s.media_url);
    setExistingMediaType(s.media_type);
    setExistingMediaFilename(s.media_filename);
    setRemoveMedia(false);
    setEditOpen(true);
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setMediaFile(file);
    setRemoveMedia(false);
    if (file.type.startsWith('image/')) {
      setMediaPreviewUrl(URL.createObjectURL(file));
    } else {
      setMediaPreviewUrl(null);
    }
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const clearMedia = () => {
    setMediaFile(null);
    if (mediaPreviewUrl) URL.revokeObjectURL(mediaPreviewUrl);
    setMediaPreviewUrl(null);
    setRemoveMedia(true);
    setExistingMediaUrl(null);
    setExistingMediaType(null);
    setExistingMediaFilename(null);
  };

  const getMediaTypeLabel = (type: string | null) => {
    if (!type) return 'mídia';
    if (type.startsWith('image')) return 'imagem';
    if (type.startsWith('audio') || type === 'ptt') return 'áudio';
    if (type.startsWith('video')) return 'vídeo';
    return 'documento';
  };

  const handleSave = async () => {
    if (!triggerWord.trim() || (!responseText.trim() && !mediaFile && !existingMediaUrl)) return;
    setSaving(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      let mediaUrl = existingMediaUrl;
      let mediaType = existingMediaType;
      let mediaFilename = existingMediaFilename;

      // Upload new media
      if (mediaFile) {
        const ext = mediaFile.name.split('.').pop();
        const path = `shortcuts/${user.id}/${Date.now()}.${ext}`;
        const { error: uploadError } = await supabase.storage
          .from('template-media')
          .upload(path, mediaFile);
        if (uploadError) throw uploadError;
        const { data: urlData } = supabase.storage.from('template-media').getPublicUrl(path);
        mediaUrl = urlData.publicUrl;
        mediaType = mediaFile.type;
        mediaFilename = mediaFile.name;
      }

      if (removeMedia) {
        mediaUrl = null;
        mediaType = null;
        mediaFilename = null;
      }

      const payload: any = {
        trigger_word: triggerWord.trim().toLowerCase(),
        response_text: responseText.trim(),
        chip_id: chipId,
        user_id: user.id,
        media_url: mediaUrl,
        media_type: mediaType,
        media_filename: mediaFilename,
      };

      if (editItem) {
        const { error } = await supabase
          .from('message_shortcuts' as any)
          .update({
            trigger_word: payload.trigger_word,
            response_text: payload.response_text,
            media_url: payload.media_url,
            media_type: payload.media_type,
            media_filename: payload.media_filename,
          } as any)
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
      if (chipId) invalidateShortcutCache(chipId);
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
      if (chipId) invalidateShortcutCache(chipId);
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
      if (chipId) invalidateShortcutCache(chipId);
    } catch {
      toast({ title: 'Erro ao atualizar', variant: 'destructive' });
    }
  };

  const MediaIcon = ({ type }: { type: string | null }) => {
    if (!type) return <FileText className="w-3.5 h-3.5" />;
    if (type.startsWith('image')) return <Image className="w-3.5 h-3.5" />;
    if (type.startsWith('audio') || type === 'ptt') return <Mic className="w-3.5 h-3.5" />;
    return <FileText className="w-3.5 h-3.5" />;
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
            Configure palavras-gatilho que, ao serem digitadas, sugerem respostas automáticas (texto ou mídia).
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
                      <div className="flex items-center gap-2 mb-0.5 flex-wrap">
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
                        {s.media_url && (
                          <Badge variant="outline" className="text-xs gap-1">
                            <MediaIcon type={s.media_type} />
                            {getMediaTypeLabel(s.media_type)}
                          </Badge>
                        )}
                      </div>
                      {s.response_text && (
                        <p className="text-sm text-foreground mt-1 whitespace-pre-wrap break-words line-clamp-2">{s.response_text}</p>
                      )}
                      {s.media_url && s.media_type?.startsWith('image') && (
                        <img src={s.media_url} alt="" className="mt-1 h-12 w-12 rounded object-cover" />
                      )}
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
              <p className="text-xs text-muted-foreground mt-1">Quando digitar esta palavra, a resposta será sugerida acima do input.</p>
            </div>
            <div>
              <label className="text-sm font-medium text-foreground">Texto da resposta</label>
              <Textarea
                value={responseText}
                onChange={(e) => setResponseText(e.target.value)}
                placeholder="Obrigado pelo contato! Como posso ajudar?"
                rows={3}
                className="mt-1"
              />
            </div>

            {/* Media upload */}
            <div>
              <label className="text-sm font-medium text-foreground">Mídia (opcional)</label>
              <input
                ref={fileInputRef}
                type="file"
                className="hidden"
                accept="image/*,audio/*,.ogg,audio/ogg,video/*,.pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx"
                onChange={handleFileSelect}
              />
              {!mediaFile && !existingMediaUrl ? (
                <Button variant="outline" size="sm" className="mt-1 w-full" onClick={() => fileInputRef.current?.click()}>
                  <Upload className="w-4 h-4 mr-2" /> Anexar mídia
                </Button>
              ) : (
                <div className="mt-1 flex items-center gap-2 p-2 rounded-lg bg-secondary/50">
                  {mediaPreviewUrl ? (
                    <img src={mediaPreviewUrl} alt="Preview" className="w-12 h-12 rounded object-cover" />
                  ) : existingMediaUrl && existingMediaType?.startsWith('image') ? (
                    <img src={existingMediaUrl} alt="Preview" className="w-12 h-12 rounded object-cover" />
                  ) : (
                    <div className="w-10 h-10 rounded bg-muted flex items-center justify-center">
                      <MediaIcon type={mediaFile?.type || existingMediaType || null} />
                    </div>
                  )}
                  <div className="flex-1 min-w-0">
                    <p className="text-sm truncate max-w-[200px]">{mediaFile?.name || existingMediaFilename || 'Mídia'}</p>
                    <p className="text-xs text-muted-foreground">{getMediaTypeLabel(mediaFile?.type || existingMediaType || null)}</p>
                  </div>
                  <Button variant="ghost" size="icon" className="h-7 w-7" onClick={clearMedia}>
                    <X className="w-3.5 h-3.5" />
                  </Button>
                </div>
              )}
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditOpen(false)}>Cancelar</Button>
            <Button onClick={handleSave} disabled={saving || !triggerWord.trim() || (!responseText.trim() && !mediaFile && !existingMediaUrl)}>
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
