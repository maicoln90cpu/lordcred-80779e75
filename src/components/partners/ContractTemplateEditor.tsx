import { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Save, Loader2, RotateCcw, Info, Plus, Trash2, Star, Pencil, Copy, Check } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

const PLACEHOLDERS = [
  { key: '{{RAZAO_SOCIAL}}', desc: 'Razão social ou nome do parceiro' },
  { key: '{{CNPJ}}', desc: 'CNPJ da empresa parceira' },
  { key: '{{CNPJ_CURTO}}', desc: 'CNPJ abreviado (sem filial)' },
  { key: '{{ENDERECO_PJ}}', desc: 'Endereço PJ completo' },
  { key: '{{REPRESENTANTE_NOME}}', desc: 'Nome do representante legal' },
  { key: '{{REPRESENTANTE_NACIONALIDADE}}', desc: 'Nacionalidade' },
  { key: '{{REPRESENTANTE_ESTADO_CIVIL}}', desc: 'Estado civil' },
  { key: '{{REPRESENTANTE_CPF}}', desc: 'CPF formatado' },
  { key: '{{REPRESENTANTE_ENDERECO}}', desc: 'Endereço pessoal' },
  { key: '{{DIA_PAGAMENTO}}', desc: 'Dia do pagamento (default 7)' },
  { key: '{{VIGENCIA_MESES}}', desc: 'Vigência em meses (default 12)' },
  { key: '{{AVISO_PREVIO_DIAS}}', desc: 'Aviso prévio em dias (default 7)' },
  { key: '{{DIA}}', desc: 'Dia atual' },
  { key: '{{MES}}', desc: 'Mês atual por extenso' },
  { key: '{{ANO}}', desc: 'Ano atual' },
];

const DEFAULT_TEMPLATE = `CONTRATO DE PARCERIA COMERCIAL AUTÔNOMA

Pelo presente instrumento particular, de um lado:

LORD CRED, pessoa jurídica de direito privado, inscrita no CNPJ nº 42.824.770/0001-07, com sede na Rua José Maria da Luz, n. 2900, Loja 01, Centro, Palhoça/SC, CEP 88.131-000, neste ato representada por Silas Carlos Dias, brasileiro, solteiro, CPF n. 112.937.439-41, residente e domiciliado na Rua Humberto Anibal Climaco, n. 266, E. 507, Forquilhinhas São José/SC doravante denominada CONTRATANTE;

E, de outro lado:

{{RAZAO_SOCIAL}}, pessoa jurídica de direito privado, inscrita no CNPJ nº {{CNPJ}}, com sede na {{ENDERECO_PJ}}, neste ato representada por {{REPRESENTANTE_NOME}}, nacionalidade {{REPRESENTANTE_NACIONALIDADE}}, estado civil {{REPRESENTANTE_ESTADO_CIVIL}}, residente e domiciliado na {{REPRESENTANTE_ENDERECO}}, doravante denominada EMPRESA PARCEIRA;

Resolvem firmar o presente CONTRATO DE PARCERIA COMERCIAL AUTÔNOMA, mediante as cláusulas e condições seguintes:

CLÁUSULA 1 – DO OBJETO
O presente contrato tem por objeto comercialização, pela EMPRESA PARCEIRA, dos produtos e/ou serviços oferecidos pela CONTRATANTE, mediante as condições estabelecidas neste instrumento.

CLÁUSULA 2 – DA NATUREZA JURÍDICA DA RELAÇÃO
O presente contrato possui natureza estritamente civil e comercial, não gerando qualquer vínculo empregatício, societário, associativo ou de representação comercial exclusiva entre as partes.

CLÁUSULA 3 – DA REMUNERAÇÃO
O PARCEIRO fará jus à comissão de no mínimo 0,50% sobre o valor dos produtos e/ou serviços que forem vendidos por sua intermediação.
§1º O pagamento será realizado até o dia {{DIA_PAGAMENTO}} do mês subsequente ao recebimento dos valores pela CONTRATANTE.

CLÁUSULA 9 – DA VIGÊNCIA E RESCISÃO
O presente contrato vigorará por prazo determinado de {{VIGENCIA_MESES}} meses.
§1º Este contrato poderá ser rescindido por qualquer das partes mediante aviso prévio por escrito com antecedência mínima de {{AVISO_PREVIO_DIAS}} dias.

CLÁUSULA 10 – DO FORO
Fica eleito o foro da Comarca de Palhoça/SC para dirimir eventuais controvérsias.

Palhoça/SC, {{DIA}} de {{MES}} de {{ANO}}.

___________________________________
LORD CRED (CONTRATANTE)

___________________________________
{{CNPJ_CURTO}} {{REPRESENTANTE_NOME}} (EMPRESA PARCEIRA)`;

interface TemplateRow {
  id: string;
  name: string;
  content: string;
  is_default: boolean;
  is_active: boolean;
  created_at: string;
}

export function ContractTemplateEditor() {
  const [templates, setTemplates] = useState<TemplateRow[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [editContent, setEditContent] = useState('');
  const [editName, setEditName] = useState('');
  const [originalContent, setOriginalContent] = useState('');
  const [originalName, setOriginalName] = useState('');
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);
  const [showNewDialog, setShowNewDialog] = useState(false);
  const [newName, setNewName] = useState('');
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [showRenameDialog, setShowRenameDialog] = useState(false);
  const [renameName, setRenameName] = useState('');

  const loadTemplates = useCallback(async () => {
    const { data } = await supabase
      .from('contract_templates')
      .select('*')
      .eq('is_active', true)
      .order('is_default', { ascending: false })
      .order('created_at');
    
    let list = (data || []) as TemplateRow[];

    // If no templates exist, seed with the legacy one from system_settings or the default
    if (list.length === 0) {
      const { data: settings } = await supabase
        .from('system_settings')
        .select('contract_template')
        .limit(1)
        .single();
      
      const content = (settings?.contract_template && (settings.contract_template as string).length > 500)
        ? settings.contract_template as string
        : DEFAULT_TEMPLATE;

      const { data: user } = await supabase.auth.getUser();
      const { data: inserted } = await supabase
        .from('contract_templates')
        .insert({ name: 'Parceria Padrão', content, is_default: true, created_by: user.user?.id })
        .select()
        .single();
      
      if (inserted) list = [inserted as TemplateRow];
    }

    setTemplates(list);
    return list;
  }, []);

  useEffect(() => {
    (async () => {
      const list = await loadTemplates();
      if (list.length > 0) {
        selectTemplate(list[0]);
      }
      setLoading(false);
    })();
  }, []);

  const selectTemplate = (t: TemplateRow) => {
    setSelectedId(t.id);
    setEditContent(t.content);
    setEditName(t.name);
    setOriginalContent(t.content);
    setOriginalName(t.name);
  };

  const isDirty = editContent !== originalContent || editName !== originalName;

  const handleSave = async () => {
    if (!selectedId) return;
    setSaving(true);

    const { error } = await supabase
      .from('contract_templates')
      .update({ content: editContent, name: editName })
      .eq('id', selectedId);

    if (error) {
      toast.error('Erro ao salvar', { description: error.message });
    } else {
      setOriginalContent(editContent);
      setOriginalName(editName);
      toast.success('Template salvo com sucesso!');

      // Sync default template to system_settings for backward compatibility
      const selected = templates.find(t => t.id === selectedId);
      if (selected?.is_default) {
        await supabase
          .from('system_settings')
          .update({ contract_template: editContent })
          .not('id', 'is', null);
      }
      await loadTemplates();
    }
    setSaving(false);
  };

  const handleCreate = async () => {
    if (!newName.trim()) return;
    setSaving(true);
    const { data: user } = await supabase.auth.getUser();
    const { data: inserted, error } = await supabase
      .from('contract_templates')
      .insert({ name: newName.trim(), content: DEFAULT_TEMPLATE, is_default: false, created_by: user.user?.id })
      .select()
      .single();

    if (error) {
      toast.error('Erro ao criar template', { description: error.message });
    } else if (inserted) {
      const list = await loadTemplates();
      selectTemplate(inserted as TemplateRow);
      toast.success(`Template "${newName.trim()}" criado!`);
    }
    setShowNewDialog(false);
    setNewName('');
    setSaving(false);
  };

  const handleDuplicate = async () => {
    if (!selectedId) return;
    setSaving(true);
    const { data: user } = await supabase.auth.getUser();
    const { data: dup, error } = await supabase
      .from('contract_templates')
      .insert({ name: `${editName} (cópia)`, content: editContent, is_default: false, created_by: user.user?.id })
      .select()
      .single();

    if (error) {
      toast.error('Erro ao duplicar', { description: error.message });
    } else if (dup) {
      const list = await loadTemplates();
      selectTemplate(dup as TemplateRow);
      toast.success('Template duplicado!');
    }
    setSaving(false);
  };

  const handleDelete = async () => {
    if (!selectedId) return;
    const selected = templates.find(t => t.id === selectedId);
    if (selected?.is_default) {
      toast.error('Não é possível excluir o template padrão');
      setShowDeleteDialog(false);
      return;
    }
    setSaving(true);
    await supabase.from('contract_templates').update({ is_active: false }).eq('id', selectedId);
    const list = await loadTemplates();
    if (list.length > 0) selectTemplate(list[0]);
    else { setSelectedId(null); setEditContent(''); setEditName(''); }
    toast.success('Template excluído!');
    setShowDeleteDialog(false);
    setSaving(false);
  };

  const handleSetDefault = async () => {
    if (!selectedId) return;
    setSaving(true);
    // Remove default from all
    await supabase.from('contract_templates').update({ is_default: false }).eq('is_default', true);
    // Set this as default
    await supabase.from('contract_templates').update({ is_default: true }).eq('id', selectedId);
    // Sync to system_settings
    await supabase.from('system_settings').update({ contract_template: editContent }).not('id', 'is', null);
    
    const list = await loadTemplates();
    toast.success('Template definido como padrão!');
    setSaving(false);
  };

  const handleRename = async () => {
    if (!renameName.trim() || !selectedId) return;
    setSaving(true);
    const { error } = await supabase
      .from('contract_templates')
      .update({ name: renameName.trim() })
      .eq('id', selectedId);
    if (error) {
      toast.error('Erro ao renomear', { description: error.message });
    } else {
      setEditName(renameName.trim());
      setOriginalName(renameName.trim());
      await loadTemplates();
      toast.success('Template renomeado!');
    }
    setShowRenameDialog(false);
    setSaving(false);
  };

  const handleResetContent = () => {
    setEditContent(DEFAULT_TEMPLATE);
  };

  const selected = templates.find(t => t.id === selectedId);

  if (loading) return <div className="flex items-center justify-center py-12"><Loader2 className="w-6 h-6 animate-spin text-muted-foreground" /></div>;

  return (
    <div className="space-y-4">
      {/* Template selector bar */}
      <Card>
        <CardContent className="p-4">
          <div className="flex items-center gap-3 flex-wrap">
            <span className="text-sm font-medium text-muted-foreground shrink-0">Templates:</span>
            <div className="flex gap-2 flex-wrap flex-1">
              {templates.map(t => (
                <button
                  key={t.id}
                  onClick={() => {
                    if (isDirty) {
                      if (!confirm('Você tem alterações não salvas. Deseja trocar de template mesmo assim?')) return;
                    }
                    selectTemplate(t);
                  }}
                  className={cn(
                    'inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm transition-colors border',
                    t.id === selectedId
                      ? 'bg-primary text-primary-foreground border-primary'
                      : 'bg-secondary/50 text-foreground border-border hover:bg-secondary'
                  )}
                >
                  {t.is_default && <Star className="w-3 h-3 fill-current" />}
                  {t.name}
                </button>
              ))}
            </div>
            <Button size="sm" variant="outline" onClick={() => setShowNewDialog(true)}>
              <Plus className="w-3.5 h-3.5 mr-1" /> Novo
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Placeholders */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Info className="w-4 h-4 text-primary" />
            Placeholders Disponíveis
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-2">
            {PLACEHOLDERS.map(p => (
              <button
                key={p.key}
                onClick={() => { navigator.clipboard.writeText(p.key); toast.success(`"${p.key}" copiado!`); }}
                className="inline-flex items-center gap-1.5 group"
                title={`${p.desc} — clique para copiar`}
              >
                <Badge variant="secondary" className="font-mono text-xs cursor-pointer group-hover:bg-primary/20 transition-colors">
                  {p.key}
                </Badge>
                <span className="text-xs text-muted-foreground hidden sm:inline">{p.desc}</span>
              </button>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Editor */}
      {selected && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center justify-between flex-wrap gap-2">
              <div className="flex items-center gap-2">
                <span>{editName}</span>
                {selected.is_default && <Badge variant="default" className="text-xs">Padrão</Badge>}
                {isDirty && <Badge variant="outline" className="text-xs text-destructive border-destructive/50">Não salvo</Badge>}
              </div>
              <div className="flex gap-2 flex-wrap">
                <Button variant="ghost" size="sm" onClick={() => { setRenameName(editName); setShowRenameDialog(true); }}>
                  <Pencil className="w-3.5 h-3.5 mr-1" /> Renomear
                </Button>
                <Button variant="ghost" size="sm" onClick={handleDuplicate}>
                  <Copy className="w-3.5 h-3.5 mr-1" /> Duplicar
                </Button>
                {!selected.is_default && (
                  <>
                    <Button variant="ghost" size="sm" onClick={handleSetDefault}>
                      <Star className="w-3.5 h-3.5 mr-1" /> Definir Padrão
                    </Button>
                    <Button variant="ghost" size="sm" className="text-destructive hover:text-destructive" onClick={() => setShowDeleteDialog(true)}>
                      <Trash2 className="w-3.5 h-3.5 mr-1" /> Excluir
                    </Button>
                  </>
                )}
                <Button variant="ghost" size="sm" onClick={handleResetContent}>
                  <RotateCcw className="w-3.5 h-3.5 mr-1" /> Restaurar Padrão
                </Button>
                <Button size="sm" onClick={handleSave} disabled={!isDirty || saving}>
                  {saving ? <Loader2 className="w-3.5 h-3.5 mr-1 animate-spin" /> : <Save className="w-3.5 h-3.5 mr-1" />}
                  {saving ? 'Salvando...' : 'Salvar'}
                </Button>
              </div>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ScrollArea className="h-[55vh]">
              <Textarea
                value={editContent}
                onChange={e => setEditContent(e.target.value)}
                className="min-h-[50vh] font-mono text-xs resize-none leading-relaxed"
                spellCheck={false}
              />
            </ScrollArea>
          </CardContent>
        </Card>
      )}

      {/* New template dialog */}
      <Dialog open={showNewDialog} onOpenChange={setShowNewDialog}>
        <DialogContent>
          <DialogHeader><DialogTitle>Novo Template</DialogTitle></DialogHeader>
          <Input placeholder="Nome do template" value={newName} onChange={e => setNewName(e.target.value)} />
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowNewDialog(false)}>Cancelar</Button>
            <Button onClick={handleCreate} disabled={!newName.trim() || saving}>
              {saving ? <Loader2 className="w-3.5 h-3.5 mr-1 animate-spin" /> : <Plus className="w-3.5 h-3.5 mr-1" />}
              Criar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Rename dialog */}
      <Dialog open={showRenameDialog} onOpenChange={setShowRenameDialog}>
        <DialogContent>
          <DialogHeader><DialogTitle>Renomear Template</DialogTitle></DialogHeader>
          <Input value={renameName} onChange={e => setRenameName(e.target.value)} />
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowRenameDialog(false)}>Cancelar</Button>
            <Button onClick={handleRename} disabled={!renameName.trim() || saving}>
              <Check className="w-3.5 h-3.5 mr-1" /> Renomear
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete confirmation */}
      <Dialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <DialogContent>
          <DialogHeader><DialogTitle>Excluir Template</DialogTitle></DialogHeader>
          <p className="text-sm text-muted-foreground">
            Tem certeza que deseja excluir o template "{selected?.name}"? Esta ação não pode ser desfeita.
          </p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowDeleteDialog(false)}>Cancelar</Button>
            <Button variant="destructive" onClick={handleDelete} disabled={saving}>
              <Trash2 className="w-3.5 h-3.5 mr-1" /> Excluir
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

export { DEFAULT_TEMPLATE };
