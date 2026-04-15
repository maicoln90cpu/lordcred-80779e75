import { useEffect, useState, useMemo } from 'react';
import { Plus, Pencil, Trash2, Loader2, Search, Zap, User } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { Checkbox } from '@/components/ui/checkbox';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { supabase } from '@/integrations/supabase/client';
import DashboardLayout from '@/components/layout/DashboardLayout';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/contexts/AuthContext';

interface Shortcut {
  id: string;
  trigger_word: string;
  response_text: string;
  is_active: boolean;
  user_id: string;
  created_at: string;
  visible_to_list?: string[] | null;
}

interface UserProfile {
  user_id: string;
  email: string;
  name: string | null;
}

export default function QuickReplies() {
  const { toast } = useToast();
  const { user, isSeller, isAdmin, isMaster, userRole } = useAuth();
  const [shortcuts, setShortcuts] = useState<Shortcut[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<Shortcut | null>(null);
  const [editItem, setEditItem] = useState<Shortcut | null>(null);
  const [saving, setSaving] = useState(false);
  const [search, setSearch] = useState('');

  // Form fields
  const [triggerWord, setTriggerWord] = useState('');
  const [responseText, setResponseText] = useState('');
  const [visibleToList, setVisibleToList] = useState<string[]>([]);
  const [allProfiles, setAllProfiles] = useState<UserProfile[]>([]);

  const canSetVisibility = isAdmin || userRole === 'support';

  useEffect(() => {
    fetchShortcuts();
  }, []);

  useEffect(() => {
    if (!canSetVisibility) return;
    (async () => {
      const { data } = await supabase.rpc('get_visible_profiles');
      if (data) {
        setAllProfiles(data as unknown as UserProfile[]);
      }
    })();
  }, [canSetVisibility, isMaster]);

  const fetchShortcuts = async () => {
    const { data, error } = await supabase
      .from('message_shortcuts')
      .select('*')
      .eq('is_active', true)
      .order('created_at', { ascending: false });

    if (!error && user) {
      let items = (data as Shortcut[]) || [];
      if (isSeller) {
        // Sellers see their own + admin-created visible to them
        const { data: nonSellerIds } = await supabase.rpc('get_non_seller_user_ids' as any);
        const nonSellerSet = new Set<string>((nonSellerIds as string[]) || []);
        items = items.filter(s => {
          if (s.user_id === user.id) return true;
          if (nonSellerSet.has(s.user_id)) {
            const list = s.visible_to_list;
            if (list && list.length > 0) return list.includes(user.id);
            return true; // no restriction = visible to all
          }
          return false;
        });
      }
      setShortcuts(items);
    }
    setIsLoading(false);
  };

  const openNew = () => {
    setEditItem(null);
    setTriggerWord('');
    setResponseText('');
    setVisibleToList([]);
    setDialogOpen(true);
  };

  const openEdit = (s: Shortcut) => {
    setEditItem(s);
    setTriggerWord(s.trigger_word);
    setResponseText(s.response_text);
    setVisibleToList(s.visible_to_list || []);
    setDialogOpen(true);
  };

  const handleSave = async () => {
    if (!triggerWord.trim() || !responseText.trim() || !user) return;
    setSaving(true);
    try {
      const finalVisibleToList = isSeller ? [] : visibleToList;

      if (editItem) {
        const { error } = await supabase
          .from('message_shortcuts')
          .update({
            trigger_word: triggerWord.trim(),
            response_text: responseText.trim(),
            visible_to_list: finalVisibleToList,
            updated_at: new Date().toISOString(),
          })
          .eq('id', editItem.id);
        if (error) throw error;
        toast({ title: 'Nota rápida atualizada' });
      } else {
        const { error } = await supabase
          .from('message_shortcuts')
          .insert({
            user_id: user.id,
            trigger_word: triggerWord.trim(),
            response_text: responseText.trim(),
            visible_to_list: finalVisibleToList,
          });
        if (error) throw error;
        toast({ title: 'Nota rápida criada' });
      }
      setDialogOpen(false);
      window.dispatchEvent(new CustomEvent('quick-replies-updated'));
      fetchShortcuts();
    } catch (err: any) {
      toast({ title: 'Erro', description: err.message, variant: 'destructive' });
    }
    setSaving(false);
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    const { error } = await supabase.from('message_shortcuts').delete().eq('id', deleteTarget.id);
    if (!error) {
      toast({ title: 'Nota rápida excluída' });
      setShortcuts(prev => prev.filter(s => s.id !== deleteTarget.id));
      window.dispatchEvent(new CustomEvent('quick-replies-updated'));
    }
    setDeleteTarget(null);
  };

  const filtered = shortcuts.filter(s => {
    if (!search) return true;
    const q = search.toLowerCase();
    return s.trigger_word.toLowerCase().includes(q) || s.response_text.toLowerCase().includes(q);
  });

  const profileMap = useMemo(() => {
    const m: Record<string, UserProfile> = {};
    allProfiles.forEach(p => { m[p.user_id] = p; });
    return m;
  }, [allProfiles]);

  // For seller: split into mine vs admin
  const { data: nonSellerIds } = useMemo(() => {
    // We'll compute this from shortcuts data
    return { data: new Set<string>() };
  }, []);

  const [nonSellerIdSet, setNonSellerIdSet] = useState<Set<string>>(new Set());
  useEffect(() => {
    if (!isSeller) return;
    (async () => {
      const { data } = await supabase.rpc('get_non_seller_user_ids' as any);
      setNonSellerIdSet(new Set<string>((data as string[]) || []));
    })();
  }, [isSeller]);

  const sellerGrouped = useMemo(() => {
    if (!isSeller || !user) return null;
    const mine = filtered.filter(s => s.user_id === user.id);
    const admin = filtered.filter(s => s.user_id !== user.id && nonSellerIdSet.has(s.user_id));
    return { mine, admin };
  }, [filtered, isSeller, user, nonSellerIdSet]);

  // Admin grouped by user
  const groupedByUser = useMemo(() => {
    if (isSeller) return null;
    const map = new Map<string, Shortcut[]>();
    filtered.forEach(s => {
      if (!map.has(s.user_id)) map.set(s.user_id, []);
      map.get(s.user_id)!.push(s);
    });
    return Array.from(map.entries()).map(([userId, items]) => ({
      userId,
      name: profileMap[userId]?.name || profileMap[userId]?.email || userId,
      email: profileMap[userId]?.email || '',
      items,
    })).sort((a, b) => b.items.length - a.items.length);
  }, [filtered, profileMap, isSeller]);

  const renderCard = (s: Shortcut) => (
    <div key={s.id} className="p-3 rounded-lg border border-border/50 bg-card/50 hover:bg-secondary/30 transition-colors">
      <div className="flex items-start justify-between gap-2 mb-1">
        <span className="text-xs font-mono text-primary font-semibold">/{s.trigger_word}</span>
        <div className="flex items-center gap-0.5 shrink-0">
          {(!isSeller || s.user_id === user?.id) && (
            <>
              <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => openEdit(s)}>
                <Pencil className="w-3.5 h-3.5" />
              </Button>
              <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => setDeleteTarget(s)}>
                <Trash2 className="w-3.5 h-3.5" />
              </Button>
            </>
          )}
        </div>
      </div>
      <p className="text-sm text-foreground whitespace-pre-wrap break-words">{s.response_text}</p>
      {s.visible_to_list && s.visible_to_list.length > 0 && (
        <div className="flex gap-1 flex-wrap mt-2">
          {s.visible_to_list.slice(0, 2).map(uid => (
            <Badge key={uid} variant="outline" className="text-[10px] h-5">
              {profileMap[uid]?.name || profileMap[uid]?.email?.split('@')[0] || 'Usuário'}
            </Badge>
          ))}
          {s.visible_to_list.length > 2 && (
            <Badge variant="outline" className="text-[10px] h-5">+{s.visible_to_list.length - 2}</Badge>
          )}
        </div>
      )}
    </div>
  );

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2">
              <Zap className="w-6 h-6 text-primary" />
              {isSeller ? 'Minhas Notas Rápidas' : 'Notas Rápidas'}
            </h1>
            <p className="text-muted-foreground">
              {isSeller ? 'Crie atalhos para agilizar suas respostas no chat' : 'Gerencie notas rápidas de todos os usuários'}
            </p>
          </div>
          <Button onClick={openNew}>
            <Plus className="w-4 h-4 mr-2" />
            Nova Nota Rápida
          </Button>
        </div>

        <div className="relative max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input placeholder="Buscar notas rápidas..." value={search} onChange={e => setSearch(e.target.value)} className="pl-9" />
        </div>

        {isLoading ? (
          <div className="flex justify-center py-12"><Loader2 className="w-8 h-8 animate-spin text-muted-foreground" /></div>
        ) : filtered.length === 0 ? (
          <Card><CardContent className="py-12 text-center text-muted-foreground">Nenhuma nota rápida encontrada</CardContent></Card>
        ) : isSeller && sellerGrouped ? (
          <div className="space-y-6">
            {sellerGrouped.mine.length > 0 && (
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="flex items-center gap-2 text-lg">
                    <User className="w-5 h-5 text-primary" />
                    Minhas Notas
                    <Badge variant="secondary" className="ml-1">{sellerGrouped.mine.length}</Badge>
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                    {sellerGrouped.mine.map(renderCard)}
                  </div>
                </CardContent>
              </Card>
            )}
            {sellerGrouped.admin.length > 0 && (
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="flex items-center gap-2 text-lg">
                    <Zap className="w-5 h-5 text-muted-foreground" />
                    Notas da Administração
                    <Badge variant="secondary" className="ml-1">{sellerGrouped.admin.length}</Badge>
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                    {sellerGrouped.admin.map(renderCard)}
                  </div>
                </CardContent>
              </Card>
            )}
          </div>
        ) : groupedByUser ? (
          <div className="space-y-4">
            {groupedByUser.map(({ userId, name, email, items }) => (
              <Card key={userId}>
                <CardHeader className="pb-3">
                  <CardTitle className="flex items-center gap-3 text-base">
                    <Avatar className="w-8 h-8">
                      <AvatarFallback className="bg-primary/20 text-primary text-xs">
                        {(name?.[0] || 'U').toUpperCase()}
                      </AvatarFallback>
                    </Avatar>
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold truncate">{name}</p>
                      {email && name !== email && <p className="text-xs text-muted-foreground truncate">{email}</p>}
                    </div>
                    <Badge variant="secondary" className="shrink-0">{items.length} nota(s)</Badge>
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                    {items.map(renderCard)}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        ) : null}
      </div>

      {/* Create/Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editItem ? 'Editar Nota Rápida' : 'Nova Nota Rápida'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label>Atalho</Label>
              <div className="flex items-center gap-1">
                <span className="text-muted-foreground">/</span>
                <Input
                  value={triggerWord}
                  onChange={e => setTriggerWord(e.target.value.replace(/\s/g, ''))}
                  placeholder="saudacao"
                  className="flex-1"
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Texto da resposta</Label>
              <Textarea
                value={responseText}
                onChange={e => setResponseText(e.target.value)}
                placeholder="Olá! Como posso ajudar?"
                rows={4}
              />
            </div>
            {canSetVisibility && (
              <div className="space-y-2">
                <Label>Visível para</Label>
                <p className="text-xs text-muted-foreground mb-1">Selecione os usuários que podem ver esta nota. Deixe vazio para todos.</p>
                <ScrollArea className="h-40 border rounded-md p-2">
                  {allProfiles.filter(p => p.user_id !== user?.id).map(p => (
                    <label key={p.user_id} className="flex items-center gap-2 py-1.5 px-1 hover:bg-accent/50 rounded cursor-pointer">
                      <Checkbox
                        checked={visibleToList.includes(p.user_id)}
                        onCheckedChange={(checked) => {
                          setVisibleToList(prev =>
                            checked ? [...prev, p.user_id] : prev.filter(id => id !== p.user_id)
                          );
                        }}
                      />
                      <span className="text-sm">{p.name || p.email}</span>
                    </label>
                  ))}
                </ScrollArea>
                {visibleToList.length > 0 && (
                  <div className="flex items-center gap-2">
                    <Badge variant="secondary" className="text-xs">{visibleToList.length} selecionado(s)</Badge>
                    <Button variant="ghost" size="sm" className="h-6 text-xs" onClick={() => setVisibleToList([])}>Limpar</Button>
                  </div>
                )}
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancelar</Button>
            <Button onClick={handleSave} disabled={saving || !triggerWord.trim() || !responseText.trim()}>
              {saving && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              {editItem ? 'Salvar' : 'Criar'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete confirmation */}
      <AlertDialog open={!!deleteTarget} onOpenChange={open => !open && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir nota rápida</AlertDialogTitle>
            <AlertDialogDescription>Tem certeza que deseja excluir "/{deleteTarget?.trigger_word}"?</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">Excluir</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </DashboardLayout>
  );
}
