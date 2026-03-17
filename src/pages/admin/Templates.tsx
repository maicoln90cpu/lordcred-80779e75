import { useEffect, useState, useRef } from 'react';
import { Plus, Pencil, Trash2, Loader2, FileText, Search, Copy, Upload, X, Image, Mic } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
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

export default function Templates() {
  const { toast } = useToast();
  const { user } = useAuth();
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

  // Form fields
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [category, setCategory] = useState('geral');

  useEffect(() => { fetchTemplates(); }, []);

  const fetchTemplates = async () => {
    const { data, error } = await supabase
      .from('message_templates')
      .select('*')
      .order('category')
      .order('sort_order');
    if (!error) setTemplates(data || []);
    setIsLoading(false);
  };

  const openNew = () => {
    setEditTemplate(null);
    setTitle('');
    setContent('');
    setCategory('geral');
    setDialogOpen(true);
  };

  const openEdit = (t: Template) => {
    setEditTemplate(t);
    setTitle(t.title);
    setContent(t.content);
    setCategory(t.category);
    setDialogOpen(true);
  };

  const handleSave = async () => {
    if (!title.trim() || !content.trim()) return;
    setSaving(true);
    try {
      if (editTemplate) {
        const { error } = await supabase
          .from('message_templates')
          .update({ title: title.trim(), content: content.trim(), category, updated_at: new Date().toISOString() })
          .eq('id', editTemplate.id);
        if (error) throw error;
        toast({ title: 'Template atualizado' });
      } else {
        const { error } = await supabase
          .from('message_templates')
          .insert({ title: title.trim(), content: content.trim(), category, created_by: user!.id });
        if (error) throw error;
        toast({ title: 'Template criado' });
      }
      setDialogOpen(false);
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

  const grouped = CATEGORIES.reduce((acc, cat) => {
    const items = filtered.filter(t => t.category === cat.value);
    if (items.length > 0) acc.push({ ...cat, items });
    return acc;
  }, [] as (typeof CATEGORIES[0] & { items: Template[] })[]);

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold">Templates de Mensagem</h1>
            <p className="text-muted-foreground">Gerencie templates globais por categoria</p>
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
        ) : grouped.length === 0 ? (
          <Card><CardContent className="py-12 text-center text-muted-foreground">Nenhum template encontrado</CardContent></Card>
        ) : (
          <div className="space-y-6">
            {grouped.map(group => (
              <Card key={group.value}>
                <CardHeader className="pb-3">
                  <CardTitle className="flex items-center gap-2 text-lg">
                    <Badge className={group.color}>{group.label}</Badge>
                    <span className="text-sm text-muted-foreground font-normal">{group.items.length} template(s)</span>
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                    {group.items.map(t => (
                      <div key={t.id} className={`p-4 rounded-lg border transition-colors ${t.is_active ? 'border-border/50 bg-card/50 hover:bg-secondary/30' : 'border-border/30 bg-muted/20 opacity-60'}`}>
                        <div className="flex items-start justify-between gap-2 mb-2">
                          <h3 className="font-medium text-sm">{t.title}</h3>
                          <div className="flex items-center gap-1 shrink-0">
                            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => handleCopy(t.content)} title="Copiar">
                              <Copy className="w-3.5 h-3.5" />
                            </Button>
                            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => openEdit(t)}>
                              <Pencil className="w-3.5 h-3.5" />
                            </Button>
                            <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => setDeleteTarget(t)}>
                              <Trash2 className="w-3.5 h-3.5" />
                            </Button>
                          </div>
                        </div>
                        <p className="text-xs text-muted-foreground whitespace-pre-wrap line-clamp-4">{t.content}</p>
                        <div className="flex items-center justify-between mt-3">
                          <Button variant="ghost" size="sm" className="h-6 text-[10px] px-2" onClick={() => handleToggleActive(t)}>
                            {t.is_active ? 'Ativo' : 'Inativo'}
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>

      {/* Create/Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-lg">
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
