import { useState, useEffect, useCallback } from 'react';
import { StickyNote, Plus, Trash2, Loader2, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { ScrollArea } from '@/components/ui/scroll-area';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

interface Note {
  id: string;
  content: string;
  created_at: string;
}

interface ConversationNotesProps {
  chipId: string;
  remoteJid: string;
  open: boolean;
  onClose: () => void;
}

export default function ConversationNotes({ chipId, remoteJid, open, onClose }: ConversationNotesProps) {
  const [notes, setNotes] = useState<Note[]>([]);
  const [loading, setLoading] = useState(false);
  const [newNote, setNewNote] = useState('');
  const [saving, setSaving] = useState(false);
  const { toast } = useToast();

  const fetchNotes = useCallback(async () => {
    setLoading(true);
    const { data } = await supabase
      .from('conversation_notes' as any)
      .select('id, content, created_at')
      .eq('chip_id', chipId)
      .eq('remote_jid', remoteJid)
      .order('created_at', { ascending: false });
    if (data) setNotes(data as any);
    setLoading(false);
  }, [chipId, remoteJid]);

  useEffect(() => {
    if (open) fetchNotes();
  }, [open, fetchNotes]);

  const handleAdd = async () => {
    if (!newNote.trim()) return;
    setSaving(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const { data, error } = await (supabase as any)
        .from('conversation_notes')
        .insert({
          chip_id: chipId,
          remote_jid: remoteJid,
          user_id: user.id,
          content: newNote.trim(),
        })
        .select('id, content, created_at')
        .single();
      if (error) throw error;
      if (data) setNotes(prev => [data, ...prev]);
      setNewNote('');
    } catch {
      toast({ title: 'Erro ao salvar nota', variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    await (supabase as any).from('conversation_notes').delete().eq('id', id);
    setNotes(prev => prev.filter(n => n.id !== id));
  };

  if (!open) return null;

  return (
    <div className="w-72 border-l border-border/50 flex flex-col bg-card/50">
      <div className="flex items-center justify-between px-3 py-2 border-b border-border/50">
        <div className="flex items-center gap-2">
          <StickyNote className="w-4 h-4 text-muted-foreground" />
          <span className="text-sm font-medium">Notas internas</span>
        </div>
        <Button variant="ghost" size="icon" className="h-6 w-6" onClick={onClose}>
          <X className="w-3.5 h-3.5" />
        </Button>
      </div>

      <div className="p-3 border-b border-border/50">
        <Textarea
          value={newNote}
          onChange={(e) => setNewNote(e.target.value)}
          placeholder="Adicionar nota..."
          className="text-sm min-h-[60px] resize-none"
          onKeyDown={(e) => { if (e.key === 'Enter' && e.ctrlKey) handleAdd(); }}
        />
        <Button size="sm" className="mt-2 w-full h-7 text-xs" onClick={handleAdd} disabled={saving || !newNote.trim()}>
          {saving ? <Loader2 className="w-3 h-3 animate-spin mr-1" /> : <Plus className="w-3 h-3 mr-1" />}
          Adicionar nota
        </Button>
      </div>

      <ScrollArea className="flex-1">
        {loading ? (
          <div className="flex justify-center py-4">
            <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />
          </div>
        ) : notes.length === 0 ? (
          <p className="text-xs text-muted-foreground text-center py-4">Nenhuma nota</p>
        ) : (
          <div className="p-2 space-y-2">
            {notes.map(note => (
              <div key={note.id} className="group bg-secondary/50 rounded-md p-2 relative">
                <p className="text-xs whitespace-pre-wrap">{note.content}</p>
                <p className="text-[10px] text-muted-foreground mt-1">
                  {new Date(note.created_at).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}
                </p>
                <Button
                  variant="ghost"
                  size="icon"
                  className="absolute top-1 right-1 h-5 w-5 opacity-0 group-hover:opacity-100 text-destructive"
                  onClick={() => handleDelete(note.id)}
                >
                  <Trash2 className="w-3 h-3" />
                </Button>
              </div>
            ))}
          </div>
        )}
      </ScrollArea>
    </div>
  );
}
