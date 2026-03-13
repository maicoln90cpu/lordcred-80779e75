import { useState, useEffect, useCallback } from 'react';
import { Link2, Plus, Trash2, Loader2, X, GripVertical, Pencil, ExternalLink } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/contexts/AuthContext';

interface UsefulLink {
  id: string;
  title: string;
  url: string;
  sort_order: number;
}

interface Props {
  open: boolean;
  onClose: () => void;
}

export default function UsefulLinksPanel({ open, onClose }: Props) {
  const [links, setLinks] = useState<UsefulLink[]>([]);
  const [loading, setLoading] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [newUrl, setNewUrl] = useState('');
  const [saving, setSaving] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editTitle, setEditTitle] = useState('');
  const [editUrl, setEditUrl] = useState('');
  const { isSeller } = useAuth();
  const { toast } = useToast();

  const isAdmin = !isSeller;

  const fetchLinks = useCallback(async () => {
    setLoading(true);
    const { data } = await supabase
      .from('useful_links')
      .select('*')
      .order('sort_order');
    if (data) setLinks(data as UsefulLink[]);
    setLoading(false);
  }, []);

  useEffect(() => {
    if (open) fetchLinks();
  }, [open, fetchLinks]);

  const handleAdd = async () => {
    if (!newTitle.trim() || !newUrl.trim()) return;
    setSaving(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      let url = newUrl.trim();
      if (!url.startsWith('http')) url = 'https://' + url;
      const maxOrder = links.reduce((max, l) => Math.max(max, l.sort_order), -1);
      const { error } = await supabase.from('useful_links').insert({
        title: newTitle.trim(),
        url,
        sort_order: maxOrder + 1,
        created_by: user.id,
      });
      if (error) throw error;
      setNewTitle('');
      setNewUrl('');
      fetchLinks();
    } catch (e: any) {
      toast({ title: 'Erro ao salvar', description: e.message, variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    await supabase.from('useful_links').delete().eq('id', id);
    setLinks(prev => prev.filter(l => l.id !== id));
  };

  const handleStartEdit = (link: UsefulLink) => {
    setEditingId(link.id);
    setEditTitle(link.title);
    setEditUrl(link.url);
  };

  const handleSaveEdit = async () => {
    if (!editingId || !editTitle.trim() || !editUrl.trim()) return;
    let url = editUrl.trim();
    if (!url.startsWith('http')) url = 'https://' + url;
    await supabase.from('useful_links').update({ title: editTitle.trim(), url }).eq('id', editingId);
    setEditingId(null);
    fetchLinks();
  };

  if (!open) return null;

  return (
    <div className="w-80 border-l border-border/50 flex flex-col bg-card/50">
      <div className="flex items-center justify-between px-3 py-2 border-b border-border/50">
        <div className="flex items-center gap-2">
          <Link2 className="w-4 h-4 text-muted-foreground" />
          <span className="text-sm font-medium">Links Úteis</span>
        </div>
        <Button variant="ghost" size="icon" className="h-6 w-6" onClick={onClose}>
          <X className="w-3.5 h-3.5" />
        </Button>
      </div>

      {isAdmin && (
        <div className="p-3 border-b border-border/50 space-y-2">
          <Input
            value={newTitle}
            onChange={(e) => setNewTitle(e.target.value)}
            placeholder="Título do link"
            className="text-sm h-8"
          />
          <Input
            value={newUrl}
            onChange={(e) => setNewUrl(e.target.value)}
            placeholder="https://exemplo.com"
            className="text-sm h-8"
          />
          <Button size="sm" className="w-full h-7 text-xs" onClick={handleAdd} disabled={saving || !newTitle.trim() || !newUrl.trim()}>
            {saving ? <Loader2 className="w-3 h-3 animate-spin mr-1" /> : <Plus className="w-3 h-3 mr-1" />}
            Adicionar link
          </Button>
        </div>
      )}

      <ScrollArea className="flex-1">
        {loading ? (
          <div className="flex justify-center py-4">
            <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />
          </div>
        ) : links.length === 0 ? (
          <p className="text-xs text-muted-foreground text-center py-4">Nenhum link cadastrado</p>
        ) : (
          <div className="p-2 space-y-2">
            {links.map(link => (
              <div key={link.id} className="group bg-secondary/50 rounded-lg p-3 hover:bg-secondary/80 transition-colors">
                {editingId === link.id ? (
                  <div className="space-y-2">
                    <Input value={editTitle} onChange={(e) => setEditTitle(e.target.value)} className="text-sm h-7" />
                    <Input value={editUrl} onChange={(e) => setEditUrl(e.target.value)} className="text-sm h-7" />
                    <div className="flex gap-1">
                      <Button size="sm" className="h-6 text-xs flex-1" onClick={handleSaveEdit}>Salvar</Button>
                      <Button size="sm" variant="ghost" className="h-6 text-xs" onClick={() => setEditingId(null)}>Cancelar</Button>
                    </div>
                  </div>
                ) : (
                  <div
                    className="cursor-pointer"
                    onClick={() => window.open(link.url, '_blank')}
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex items-center gap-2 min-w-0 flex-1">
                        <ExternalLink className="w-3.5 h-3.5 text-primary shrink-0 mt-0.5" />
                        <div className="min-w-0">
                          <p className="text-sm font-medium truncate">{link.title}</p>
                          <p className="text-[10px] text-muted-foreground truncate">{link.url}</p>
                        </div>
                      </div>
                      {isAdmin && (
                        <div className="flex gap-0.5 opacity-0 group-hover:opacity-100 shrink-0">
                          <Button variant="ghost" size="icon" className="h-5 w-5" onClick={(e) => { e.stopPropagation(); handleStartEdit(link); }}>
                            <Pencil className="w-2.5 h-2.5" />
                          </Button>
                          <Button variant="ghost" size="icon" className="h-5 w-5 text-destructive" onClick={(e) => { e.stopPropagation(); handleDelete(link.id); }}>
                            <Trash2 className="w-2.5 h-2.5" />
                          </Button>
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </ScrollArea>
    </div>
  );
}
