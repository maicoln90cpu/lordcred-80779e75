import { useEffect, useState, useRef, useMemo } from 'react';
import { Plus, Pencil, Trash2, Loader2, FileText, Search, Copy, Upload, X, Image, Mic, User } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { Checkbox } from '@/components/ui/checkbox';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { supabase } from '@/integrations/supabase/client';
import DashboardLayout from '@/components/layout/DashboardLayout';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/contexts/AuthContext';

interface Template {
  id: string;
  category: string;
  title: string;
  content: string;
  is_active: boolean;
  sort_order: number;
  created_at: string;
  created_by: string;
  media_url?: string | null;
  media_type?: string | null;
  media_filename?: string | null;
  visible_to?: string | null;
  visible_to_list?: string[] | null;
  trigger_word?: string | null;
}

const CATEGORIES = [
  { value: 'saudacao', label: 'Saudação', color: 'bg-green-500/20 text-green-400' },
  { value: 'vendas', label: 'Vendas', color: 'bg-blue-500/20 text-blue-400' },
  { value: 'suporte', label: 'Suporte', color: 'bg-purple-500/20 text-purple-400' },
  { value: 'cobranca', label: 'Cobrança', color: 'bg-orange-500/20 text-orange-400' },
  { value: 'followup', label: 'Follow-up', color: 'bg-yellow-500/20 text-yellow-400' },
  { value: 'encerramento', label: 'Encerramento', color: 'bg-red-500/20 text-red-400' },
  { value: 'geral', label: 'Geral', color: 'bg-muted text-muted-foreground' },
];

interface SellerProfile {
  user_id: string;
  email: string;
  name: string | null;
}

export default function Templates() {
  const { toast } = useToast();
  const { user, isSeller, isAdmin, isMaster, userRole } = useAuth();
  const [templates, setTemplates] = useState<Template[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<Template | null>(null);
  const [editTemplate, setEditTemplate] = useState<Template | null>(null);
  const [saving, setSaving] = useState(false);
  const [search, setSearch] = useState('');
  const [filterCategory, setFilterCategory] = useState('all');
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [mediaFile, setMediaFile] = useState<{ file: File; preview?: string; type: string } | null>(null);
  const [existingMediaUrl, setExistingMediaUrl] = useState<string | null>(null);
  const [existingMediaType, setExistingMediaType] = useState<string | null>(null);
  const [visibleToList, setVisibleToList] = useState<string[]>([]);
  const [sellerProfiles, setSellerProfiles] = useState<SellerProfile[]>([]);
  const [triggerWord, setTriggerWord] = useState('');

  // Form fields
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [category, setCategory] = useState('geral');

  // Refetch when userRole resolves (fixes admin seeing seller-filtered results on reload)
  const roleResolved = useRef(false);
  useEffect(() => {
    if (roleResolved.current) {
      fetchTemplates();
    }
    roleResolved.current = true;
  }, [userRole]);

  useEffect(() => { fetchTemplates(); }, []);

  const canSetVisibility = isAdmin || userRole === 'support';
  useEffect(() => {
    if (!canSetVisibility) return;
    (async () => {
      const { data } = await supabase.rpc('get_all_chat_profiles' as any);
      if (data) {
        let profiles = data as unknown as SellerProfile[];
        // Hide master users from non-master roles using SECURITY DEFINER function
        if (!isMaster) {
          const { data: masterIdsArr } = await supabase.rpc('get_master_user_ids' as any);
          const masterIds = new Set<string>((masterIdsArr as string[]) || []);
          profiles = profiles.filter(p => !masterIds.has(p.user_id));
        }
        setSellerProfiles(profiles);
      }
    })();
  }, [canSetVisibility, isMaster]);

  const fetchTemplates = async () => {
    const query = supabase
      .from('message_templates')
      .select('*')
      .order('category')
      .order('sort_order');
    const { data, error } = await query;
    if (!error && user) {
      let filtered = (data as any[] || []).map(d => ({ ...d } as Template));
      if (isSeller) {
        // Fetch non-seller IDs (admin/support/master) to determine which templates are "global"
        const { data: nonSellerIds } = await supabase.rpc('get_non_seller_user_ids' as any);
        const nonSellerSet = new Set<string>((nonSellerIds as string[]) || []);
        filtered = filtered.filter(t => {
          // Always see own templates
          if (t.created_by === user.id) return true;
          // Templates created by admin/support/master are "global" — check visibility
          if (nonSellerSet.has(t.created_by)) {
            // If visible_to_list set, must include this user
            if (t.visible_to_list && t.visible_to_list.length > 0) return t.visible_to_list.includes(user.id);
            // If visible_to set (legacy), must match
            if (t.visible_to) return t.visible_to === user.id;
            // No restrictions = visible to all
            return true;
          }
          // Templates from other sellers = NOT visible
          return false;
        });
      }
      setTemplates(filtered);
    } else {
      setTemplates((data as Template[]) || []);
    }
    setIsLoading(false);
  };

  const openNew = () => {
    setEditTemplate(null);
    setTitle('');
    setContent('');
    setCategory('geral');
    setMediaFile(null);
    setExistingMediaUrl(null);
    setExistingMediaType(null);
    setVisibleToList([]);
    setTriggerWord('');
    setDialogOpen(true);
  };

  const openEdit = (t: Template) => {
    setEditTemplate(t);
    setTitle(t.title);
    setContent(t.content);
    setCategory(t.category);
    setMediaFile(null);
    setExistingMediaUrl(t.media_url || null);
    setExistingMediaType(t.media_type || null);
    const list = t.visible_to_list && t.visible_to_list.length > 0
      ? t.visible_to_list
      : t.visible_to ? [t.visible_to] : [];
    setVisibleToList(list);
    setTriggerWord(t.trigger_word || '');
    setDialogOpen(true);
  };

  const handleSave = async () => {
    if (!title.trim() || !content.trim()) return;
    setSaving(true);
    try {
      let uploadedMediaUrl: string | null = existingMediaUrl;
      let uploadedMediaType: string | null = existingMediaType;
      let uploadedMediaFilename: string | null = editTemplate?.media_filename || null;

      if (mediaFile) {
        const ext = mediaFile.file.name.split('.').pop() || 'bin';
        const path = `${crypto.randomUUID()}.${ext}`;
        const { error: uploadErr } = await supabase.storage
          .from('template-media')
          .upload(path, mediaFile.file);
        if (uploadErr) throw uploadErr;
        const { data: urlData } = supabase.storage
          .from('template-media')
          .getPublicUrl(path);
        uploadedMediaUrl = urlData.publicUrl;
        uploadedMediaType = mediaFile.type;
        uploadedMediaFilename = mediaFile.file.name;
      }

      // Sellers: force private
      const finalVisibleToList = isSeller ? [user!.id] : visibleToList;
      const finalVisibleTo = isSeller ? user!.id : (finalVisibleToList.length === 1 ? finalVisibleToList[0] : null);

      const payload: any = {
        title: title.trim(),
        content: content.trim(),
        category,
        media_url: uploadedMediaUrl,
        media_type: uploadedMediaType,
        media_filename: uploadedMediaFilename,
        visible_to: finalVisibleTo,
        visible_to_list: finalVisibleToList,
        trigger_word: triggerWord.trim() || null,
      };

      if (editTemplate) {
        payload.updated_at = new Date().toISOString();
        const { error } = await supabase
          .from('message_templates')
          .update(payload)
          .eq('id', editTemplate.id);
        if (error) throw error;
        toast({ title: 'Template atualizado' });
      } else {
        payload.created_by = user!.id;
        const { error } = await supabase
          .from('message_templates')
          .insert(payload);
        if (error) throw error;
        toast({ title: 'Template criado' });
      }
      setDialogOpen(false);
      setMediaFile(null);
      // Invalidate shortcut cache so ChatInput picks up trigger_word changes
      window.dispatchEvent(new CustomEvent('shortcut-cache-invalidate', { detail: 'all' }));
      fetchTemplates();
    } catch (err: any) {
      toast({ title: 'Erro', description: err.message, variant: 'destructive' });
    }
    setSaving(false);
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    const { error } = await supabase.from('message_templates').delete().eq('id', deleteTarget.id);
    if (!error) {
      toast({ title: 'Template excluído' });
      setTemplates(prev => prev.filter(t => t.id !== deleteTarget.id));
      window.dispatchEvent(new CustomEvent('shortcut-cache-invalidate', { detail: 'all' }));
    }
    setDeleteTarget(null);
  };

  const handleToggleActive = async (t: Template) => {
    await supabase.from('message_templates').update({ is_active: !t.is_active }).eq('id', t.id);
    fetchTemplates();
  };

  const handleCopy = (text: string) => {
    navigator.clipboard.writeText(text);
    toast({ title: 'Copiado!' });
  };

  const getCategoryStyle = (cat: string) => CATEGORIES.find(c => c.value === cat) || CATEGORIES[CATEGORIES.length - 1];

  const filtered = templates.filter(t => {
    if (filterCategory !== 'all' && t.category !== filterCategory) return false;
    if (search && !t.title.toLowerCase().includes(search.toLowerCase()) && !t.content.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });

  // Group by user for admin view
  const profileMap = useMemo(() => {
    const m: Record<string, SellerProfile> = {};
    sellerProfiles.forEach(p => { m[p.user_id] = p; });
    return m;
  }, [sellerProfiles]);

  const groupedByUser = useMemo(() => {
    if (isSeller) return null; // Sellers see flat view
    const map = new Map<string, Template[]>();
    filtered.forEach(t => {
      const key = t.created_by;
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(t);
    });
    return Array.from(map.entries()).map(([userId, items]) => ({
      userId,
      name: profileMap[userId]?.name || profileMap[userId]?.email || userId,
      email: profileMap[userId]?.email || '',
      items,
    })).sort((a, b) => b.items.length - a.items.length);
  }, [filtered, profileMap, isSeller]);

  // For seller: group into "Meus templates" vs "Templates da administração"
  const [nonSellerIds, setNonSellerIds] = useState<Set<string>>(new Set());
  useEffect(() => {
    if (!isSeller) return;
    (async () => {
      const { data } = await supabase.rpc('get_non_seller_user_ids' as any);
      setNonSellerIds(new Set<string>((data as string[]) || []));
    })();
  }, [isSeller]);

  const sellerGrouped = useMemo(() => {
    if (!isSeller) return null;
    const mine = filtered.filter(t => t.created_by === user?.id);
    const admin = filtered.filter(t => t.created_by !== user?.id && nonSellerIds.has(t.created_by));
    return { mine, admin };
  }, [filtered, isSeller, user, nonSellerIds]);

  const renderTemplateCard = (t: Template) => {
    const catStyle = getCategoryStyle(t.category);
    const visibleUsers = t.visible_to_list && t.visible_to_list.length > 0
      ? t.visible_to_list
      : t.visible_to ? [t.visible_to] : [];

    return (
      <div key={t.id} className={`p-3 rounded-lg border transition-colors ${t.is_active ? 'border-border/50 bg-card/50 hover:bg-secondary/30' : 'border-border/30 bg-muted/20 opacity-60'}`}>
        <div className="flex items-start justify-between gap-2 mb-1.5">
          <div className="flex items-center gap-1.5 min-w-0">
            <Badge variant="secondary" className={`text-[10px] px-1.5 py-0 shrink-0 ${catStyle.color}`}>
              {catStyle.label}
            </Badge>
            <h3 className="font-medium text-sm truncate">{t.title}</h3>
            {t.trigger_word && (
              <Badge variant="outline" className="text-[10px] px-1 py-0 shrink-0 border-primary/40 text-primary">
                ⚡ {t.trigger_word}
              </Badge>
            )}
            {t.media_type === 'image' && <Image className="w-3.5 h-3.5 text-muted-foreground shrink-0" />}
            {(t.media_type === 'audio' || t.media_type === 'ptt') && <Mic className="w-3.5 h-3.5 text-muted-foreground shrink-0" />}
          </div>
          <div className="flex items-center gap-0.5 shrink-0">
            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => handleCopy(t.content)} title="Copiar">
              <Copy className="w-3.5 h-3.5" />
            </Button>
            {(!isSeller || t.created_by === user?.id) && (
              <>
                <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => openEdit(t)}>
                  <Pencil className="w-3.5 h-3.5" />
                </Button>
                <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => setDeleteTarget(t)}>
                  <Trash2 className="w-3.5 h-3.5" />
                </Button>
              </>
            )}
          </div>
        </div>
        {t.media_url && t.media_type === 'image' && (
          <img src={t.media_url} alt="" className="w-full h-20 object-cover rounded mb-1.5" />
        )}
        <p className="text-xs text-muted-foreground whitespace-pre-wrap line-clamp-3">{t.content}</p>
        <div className="flex items-center justify-between mt-2 flex-wrap gap-1">
          <Button variant="ghost" size="sm" className="h-5 text-[10px] px-2" onClick={() => handleToggleActive(t)}>
            {t.is_active ? 'Ativo' : 'Inativo'}
          </Button>
          {visibleUsers.length > 0 && (
            <div className="flex gap-1 flex-wrap">
              {visibleUsers.slice(0, 2).map(uid => (
                <Badge key={uid} variant="outline" className="text-[10px] h-5">
                  {profileMap[uid]?.name || profileMap[uid]?.email?.split('@')[0] || 'Usuário'}
                </Badge>
              ))}
              {visibleUsers.length > 2 && (
                <Badge variant="outline" className="text-[10px] h-5">+{visibleUsers.length - 2}</Badge>
              )}
            </div>
          )}
        </div>
      </div>
    );
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold">{isSeller ? 'Meus Templates' : 'Templates de Mensagem'}</h1>
            <p className="text-muted-foreground">{isSeller ? 'Crie e gerencie seus templates pessoais' : 'Templates organizados por usuário'}</p>
          </div>
          <Button onClick={openNew}>
            <Plus className="w-4 h-4 mr-2" />
            Novo Template
          </Button>
        </div>

        <div className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input placeholder="Buscar templates..." value={search} onChange={e => setSearch(e.target.value)} className="pl-9" />
          </div>
          <Select value={filterCategory} onValueChange={setFilterCategory}>
            <SelectTrigger className="w-[180px]">
              <SelectValue placeholder="Categoria" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todas</SelectItem>
              {CATEGORIES.map(c => <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>

        {isLoading ? (
          <div className="flex justify-center py-12"><Loader2 className="w-8 h-8 animate-spin text-muted-foreground" /></div>
        ) : filtered.length === 0 ? (
          <Card><CardContent className="py-12 text-center text-muted-foreground">Nenhum template encontrado</CardContent></Card>
        ) : isSeller && sellerGrouped ? (
          <div className="space-y-6">
            {sellerGrouped.mine.length > 0 && (
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="flex items-center gap-2 text-lg">
                    <User className="w-5 h-5 text-primary" />
                    Meus Templates
                    <Badge variant="secondary" className="ml-1">{sellerGrouped.mine.length}</Badge>
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                    {sellerGrouped.mine.map(renderTemplateCard)}
                  </div>
                </CardContent>
              </Card>
            )}
            {sellerGrouped.admin.length > 0 && (
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="flex items-center gap-2 text-lg">
                    <FileText className="w-5 h-5 text-muted-foreground" />
                    Templates da Administração
                    <Badge variant="secondary" className="ml-1">{sellerGrouped.admin.length}</Badge>
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                    {sellerGrouped.admin.map(renderTemplateCard)}
                  </div>
                </CardContent>
              </Card>
            )}
            {sellerGrouped.mine.length === 0 && sellerGrouped.admin.length === 0 && (
              <Card><CardContent className="py-12 text-center text-muted-foreground">Nenhum template encontrado</CardContent></Card>
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
                    <Badge variant="secondary" className="shrink-0">{items.length} template(s)</Badge>
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                    {items.map(renderTemplateCard)}
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
            <DialogTitle>{editTemplate ? 'Editar Template' : 'Novo Template'}</DialogTitle>
            <DialogDescription>Crie templates reutilizáveis para agilizar o atendimento</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label>Título</Label>
              <Input value={title} onChange={e => setTitle(e.target.value)} placeholder="Ex: Boas-vindas inicial" />
            </div>
            <div className="space-y-2">
              <Label>Categoria</Label>
              <Select value={category} onValueChange={setCategory}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {CATEGORIES.map(c => <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Conteúdo</Label>
              <Textarea value={content} onChange={e => setContent(e.target.value)} placeholder="Texto do template..." rows={6} />
              <p className="text-xs text-muted-foreground">Use {'{nome}'}, {'{telefone}'} como variáveis</p>
            </div>
            <div className="space-y-2">
              <Label>Palavra-gatilho (opcional)</Label>
              <Input
                value={triggerWord}
                onChange={e => setTriggerWord(e.target.value)}
                placeholder="Ex: /ola, #vendas..."
              />
              <p className="text-xs text-muted-foreground">Ao digitar esta palavra no chat, o template será sugerido automaticamente (como atalho)</p>
            </div>
            <div className="space-y-2">
              <Label>Mídia (opcional)</Label>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*,audio/*,.ogg,audio/ogg"
                className="hidden"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (!f) return;
                  const type = f.type.startsWith('image') ? 'image' : 'audio';
                  const preview = type === 'image' ? URL.createObjectURL(f) : undefined;
                  setMediaFile({ file: f, preview, type });
                  setExistingMediaUrl(null);
                  setExistingMediaType(null);
                }}
              />
              {(mediaFile || existingMediaUrl) ? (
                <div className="flex items-center gap-3 p-2 rounded-lg bg-secondary/50 min-w-0">
                  {mediaFile?.preview ? (
                    <img src={mediaFile.preview} alt="" className="w-14 h-14 rounded object-cover" />
                  ) : existingMediaType === 'image' && existingMediaUrl ? (
                    <img src={existingMediaUrl} alt="" className="w-14 h-14 rounded object-cover" />
                  ) : (
                    <div className="w-10 h-10 rounded bg-muted flex items-center justify-center">
                      <Mic className="w-4 h-4 text-muted-foreground" />
                    </div>
                  )}
                  <span className="text-sm flex-1 min-w-0 truncate">{mediaFile?.file.name || editTemplate?.media_filename || 'Mídia'}</span>
                  <Button variant="ghost" size="icon" className="shrink-0 h-7 w-7" onClick={() => { setMediaFile(null); setExistingMediaUrl(null); setExistingMediaType(null); }}>
                    <X className="w-3.5 h-3.5" />
                  </Button>
                </div>
              ) : (
                <Button variant="outline" size="sm" onClick={() => fileInputRef.current?.click()} type="button">
                  <Upload className="w-4 h-4 mr-2" />
                  Anexar imagem ou áudio
                </Button>
              )}
            </div>
            {canSetVisibility && (
              <div className="space-y-2">
                <Label>Visível para</Label>
                <p className="text-xs text-muted-foreground mb-1">Selecione os usuários que podem ver este template. Deixe vazio para todos.</p>
                <ScrollArea className="h-40 border rounded-md p-2">
                  {sellerProfiles.filter(s => s.user_id !== user?.id).map(s => (
                    <label key={s.user_id} className="flex items-center gap-2 py-1.5 px-1 hover:bg-accent/50 rounded cursor-pointer">
                      <Checkbox
                        checked={visibleToList.includes(s.user_id)}
                        onCheckedChange={(checked) => {
                          setVisibleToList(prev =>
                            checked ? [...prev, s.user_id] : prev.filter(id => id !== s.user_id)
                          );
                        }}
                      />
                      <span className="text-sm">{s.name || s.email}</span>
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
            <Button onClick={handleSave} disabled={saving || !title.trim() || !content.trim()}>
              {saving && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              {editTemplate ? 'Salvar' : 'Criar'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete confirmation */}
      <AlertDialog open={!!deleteTarget} onOpenChange={open => !open && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir template</AlertDialogTitle>
            <AlertDialogDescription>Tem certeza que deseja excluir "{deleteTarget?.title}"?</AlertDialogDescription>
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
