import { useState, useEffect, useCallback } from 'react';
import DashboardLayout from '@/components/layout/DashboardLayout';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { Trash2, Plus, Pencil, ExternalLink, Loader2, Check, X } from 'lucide-react';

interface UsefulLink {
  id: string;
  title: string;
  url: string;
  sort_order: number;
}

export default function LinksAdmin() {
  const [links, setLinks] = useState<UsefulLink[]>([]);
  const [loading, setLoading] = useState(true);
  const [newTitle, setNewTitle] = useState('');
  const [newUrl, setNewUrl] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editTitle, setEditTitle] = useState('');
  const [editUrl, setEditUrl] = useState('');
  const { toast } = useToast();

  const fetchLinks = useCallback(async () => {
    setLoading(true);
    const { data } = await supabase.from('useful_links').select('*').order('sort_order');
    if (data) setLinks(data as UsefulLink[]);
    setLoading(false);
  }, []);

  useEffect(() => { fetchLinks(); }, [fetchLinks]);

  const handleAdd = async () => {
    if (!newTitle.trim() || !newUrl.trim()) return;
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    let url = newUrl.trim();
    if (!url.startsWith('http')) url = 'https://' + url;
    const maxOrder = links.reduce((max, l) => Math.max(max, l.sort_order), -1);
    const { error } = await supabase.from('useful_links').insert({
      title: newTitle.trim(), url, sort_order: maxOrder + 1, created_by: user.id,
    });
    if (error) { toast({ title: 'Erro', description: error.message, variant: 'destructive' }); return; }
    setNewTitle('');
    setNewUrl('');
    fetchLinks();
    toast({ title: 'Link adicionado' });
  };

  const handleDelete = async (id: string) => {
    await supabase.from('useful_links').delete().eq('id', id);
    setLinks(prev => prev.filter(l => l.id !== id));
    toast({ title: 'Link removido' });
  };

  const handleSaveEdit = async () => {
    if (!editingId) return;
    let url = editUrl.trim();
    if (!url.startsWith('http')) url = 'https://' + url;
    await supabase.from('useful_links').update({ title: editTitle.trim(), url }).eq('id', editingId);
    setEditingId(null);
    fetchLinks();
    toast({ title: 'Link atualizado' });
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold">Links Úteis</h1>
          <p className="text-muted-foreground">Gerencie os links disponíveis para todos os vendedores no chat</p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Adicionar Link</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-2">
              <Input value={newTitle} onChange={(e) => setNewTitle(e.target.value)} placeholder="Título" className="flex-1" />
              <Input value={newUrl} onChange={(e) => setNewUrl(e.target.value)} placeholder="https://exemplo.com" className="flex-1" />
              <Button onClick={handleAdd} disabled={!newTitle.trim() || !newUrl.trim()}>
                <Plus className="w-4 h-4 mr-1" /> Adicionar
              </Button>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Links Cadastrados</CardTitle>
            <CardDescription>{links.length} link(s)</CardDescription>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="flex justify-center py-4"><Loader2 className="w-5 h-5 animate-spin" /></div>
            ) : links.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-4">Nenhum link cadastrado</p>
            ) : (
              <div className="space-y-2">
                {links.map(link => (
                  <div key={link.id} className="flex items-center gap-3 bg-muted/30 rounded-lg p-3">
                    {editingId === link.id ? (
                      <>
                        <Input value={editTitle} onChange={(e) => setEditTitle(e.target.value)} className="flex-1 h-8" />
                        <Input value={editUrl} onChange={(e) => setEditUrl(e.target.value)} className="flex-1 h-8" />
                        <Button size="icon" variant="ghost" className="h-8 w-8" onClick={handleSaveEdit}><Check className="w-4 h-4" /></Button>
                        <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => setEditingId(null)}><X className="w-4 h-4" /></Button>
                      </>
                    ) : (
                      <>
                        <ExternalLink className="w-4 h-4 text-primary shrink-0" />
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium truncate">{link.title}</p>
                          <p className="text-xs text-muted-foreground truncate">{link.url}</p>
                        </div>
                        <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => { setEditingId(link.id); setEditTitle(link.title); setEditUrl(link.url); }}>
                          <Pencil className="w-3.5 h-3.5" />
                        </Button>
                        <Button size="icon" variant="ghost" className="h-8 w-8 text-destructive" onClick={() => handleDelete(link.id)}>
                          <Trash2 className="w-3.5 h-3.5" />
                        </Button>
                      </>
                    )}
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}
