import { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Loader2, Plus, Trash2, Settings2, GripVertical, Eye, EyeOff, UserCircle } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { DEFAULT_ALIASES, type ColumnAlias } from '@/components/admin/LeadImporter';

interface StatusOption {
  value: string;
  label: string;
  color_class: string;
}

interface ProfileOption {
  value: string;
  label: string;
  color_class: string;
}

interface ColumnConfig {
  key: string;
  label: string;
  visible: boolean;
  aliases?: string[];
  isCustom?: boolean;
}

const ALL_COLUMNS: ColumnConfig[] = [
  { key: 'nome', label: 'Nome', visible: true },
  { key: 'perfil', label: 'Perfil', visible: true },
  { key: 'telefone', label: 'Telefone', visible: true },
  { key: 'cpf', label: 'CPF', visible: true },
  { key: 'valor_lib', label: 'Valor Lib.', visible: true },
  { key: 'prazo', label: 'Prazo', visible: true },
  { key: 'vlr_parcela', label: 'Parcela', visible: true },
  { key: 'banco_nome', label: 'Banco', visible: true },
  { key: 'banco_codigo', label: 'Cód. Banco', visible: true },
  { key: 'banco_simulado', label: 'Banco Simulado', visible: true },
  { key: 'agencia', label: 'Agência', visible: true },
  { key: 'conta', label: 'Conta', visible: true },
  { key: 'aprovado', label: 'Aprovado', visible: true },
  { key: 'reprovado', label: 'Reprovado', visible: true },
  { key: 'data_nasc', label: 'Data Nasc.', visible: true },
  { key: 'nome_mae', label: 'Nome Mãe', visible: true },
  { key: 'data_ref', label: 'Data Ref.', visible: true },
  { key: 'status', label: 'Status', visible: true },
  { key: 'assigned_to', label: 'Vendedor', visible: true },
  { key: 'batch_name', label: 'Lote', visible: true },
  { key: 'assigned_at', label: 'Data Alteração', visible: true },
  { key: 'notes', label: 'Observações', visible: true },
];

const COLOR_HEX_PRESETS = [
  '#6b7280', '#3b82f6', '#eab308', '#ef4444', '#10b981',
  '#8b5cf6', '#ec4899', '#f97316', '#06b6d4', '#14b8a6',
];

const hexToColorClass = (hex: string) => `hex:${hex}`;

const extractHex = (colorClass: string): string | null => {
  if (colorClass.startsWith('hex:')) return colorClass.slice(4);
  const match = colorClass.match(/#[0-9a-fA-F]{6}/);
  return match ? match[0] : null;
};

const renderColorBadge = (label: string, colorClass: string) => {
  const hex = extractHex(colorClass);
  if (hex) {
    return (
      <Badge variant="secondary" style={{ backgroundColor: hex + '33', color: hex, borderColor: hex + '44' }}>
        {label}
      </Badge>
    );
  }
  return <Badge className={colorClass}>{label}</Badge>;
};

interface LeadConfigTabProps {
  statusOptions: StatusOption[];
  profileOptions: ProfileOption[];
  columnConfig: ColumnConfig[];
  sellerColumnConfig: ColumnConfig[];
  columnAliases: ColumnAlias[];
}

export default function LeadConfigTab({
  statusOptions,
  profileOptions,
  columnConfig,
  sellerColumnConfig,
  columnAliases,
}: LeadConfigTabProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Status editor
  const [editingStatuses, setEditingStatuses] = useState<StatusOption[] | null>(null);
  const [isSavingStatuses, setIsSavingStatuses] = useState(false);

  // Profile editor
  const [editingProfiles, setEditingProfiles] = useState<ProfileOption[] | null>(null);
  const [isSavingProfiles, setIsSavingProfiles] = useState(false);

  // Column config editor
  const [editingColumns, setEditingColumns] = useState<ColumnConfig[] | null>(null);
  const [isSavingColumns, setIsSavingColumns] = useState(false);
  const [dragIdx, setDragIdx] = useState<number | null>(null);

  // Seller column config
  const [editingSellerColumns, setEditingSellerColumns] = useState<ColumnConfig[] | null>(null);
  const [isSavingSellerColumns, setIsSavingSellerColumns] = useState(false);
  const [dragSellerIdx, setDragSellerIdx] = useState<number | null>(null);

  // ── Status handlers ──
  const updateStatusField = (idx: number, field: keyof StatusOption, val: string) => {
    if (!editingStatuses) return;
    const updated = [...editingStatuses];
    updated[idx] = { ...updated[idx], [field]: val };
    if (field === 'label') {
      const prev = editingStatuses[idx];
      if (!prev.value || prev.value === prev.label.toUpperCase()) updated[idx].value = val.toUpperCase();
    }
    setEditingStatuses(updated);
  };

  const saveStatuses = async () => {
    if (!editingStatuses) return;
    if (editingStatuses.some(s => !s.value || !s.label)) {
      toast({ title: 'Erro', description: 'Todos os status devem ter valor e label preenchidos.', variant: 'destructive' });
      return;
    }
    setIsSavingStatuses(true);
    try {
      const { error } = await supabase
        .from('system_settings')
        .update({ lead_status_options: editingStatuses as any, updated_at: new Date().toISOString() } as any)
        .neq('id', '00000000-0000-0000-0000-000000000000');
      if (error) throw error;
      toast({ title: 'Status atualizados com sucesso' });
      queryClient.invalidateQueries({ queryKey: ['lead-status-options'] });
      setEditingStatuses(null);
    } catch (e: any) {
      toast({ title: 'Erro', description: e.message, variant: 'destructive' });
    } finally {
      setIsSavingStatuses(false);
    }
  };

  // ── Profile handlers ──
  const updateProfileField = (idx: number, field: keyof ProfileOption, val: string) => {
    if (!editingProfiles) return;
    const updated = [...editingProfiles];
    updated[idx] = { ...updated[idx], [field]: val };
    if (field === 'label') {
      const prev = editingProfiles[idx];
      if (!prev.value || prev.value === prev.label) updated[idx].value = val;
    }
    setEditingProfiles(updated);
  };

  const saveProfiles = async () => {
    if (!editingProfiles) return;
    if (editingProfiles.some(p => !p.value || !p.label)) {
      toast({ title: 'Erro', description: 'Todos os perfis devem ter valor e label preenchidos.', variant: 'destructive' });
      return;
    }
    setIsSavingProfiles(true);
    try {
      const { error } = await supabase
        .from('system_settings')
        .update({ lead_profile_options: editingProfiles as any, updated_at: new Date().toISOString() } as any)
        .neq('id', '00000000-0000-0000-0000-000000000000');
      if (error) throw error;
      toast({ title: 'Perfis atualizados com sucesso' });
      queryClient.invalidateQueries({ queryKey: ['lead-profile-options'] });
      setEditingProfiles(null);
    } catch (e: any) {
      toast({ title: 'Erro', description: e.message, variant: 'destructive' });
    } finally {
      setIsSavingProfiles(false);
    }
  };

  // ── Column config handlers ──
  const startEditingColumns = () => {
    const cols = [...columnConfig];
    const aliasMap = new Map(columnAliases.map(a => [a.key, a]));
    const enriched = cols.map(c => {
      const alias = aliasMap.get(c.key);
      const isNative = ALL_COLUMNS.some(ac => ac.key === c.key);
      return { ...c, aliases: alias?.aliases || [], isCustom: !isNative };
    });
    setEditingColumns(enriched);
  };

  const toggleColumnVisibility = (idx: number) => {
    if (!editingColumns) return;
    const updated = [...editingColumns];
    updated[idx] = { ...updated[idx], visible: !updated[idx].visible };
    setEditingColumns(updated);
  };

  const updateColumnField = (idx: number, field: 'label' | 'key' | 'aliases', val: string) => {
    if (!editingColumns) return;
    const updated = [...editingColumns];
    if (field === 'aliases') {
      updated[idx] = { ...updated[idx], aliases: val.split(',').map(s => s.trim().toLowerCase()).filter(Boolean) };
    } else {
      updated[idx] = { ...updated[idx], [field]: val };
    }
    setEditingColumns(updated);
  };

  const moveColumn = (from: number, to: number) => {
    if (!editingColumns || to < 0 || to >= editingColumns.length) return;
    const updated = [...editingColumns];
    const [moved] = updated.splice(from, 1);
    updated.splice(to, 0, moved);
    setEditingColumns(updated);
  };

  const saveColumns = async () => {
    if (!editingColumns) return;
    if (editingColumns.some(c => c.isCustom && (!c.key || !c.label))) {
      toast({ title: 'Erro', description: 'Colunas customizadas devem ter chave e nome preenchidos.', variant: 'destructive' });
      return;
    }
    setIsSavingColumns(true);
    try {
      const colConfig = editingColumns.map(c => ({ key: c.key, label: c.label, visible: c.visible }));
      const aliasesArray: ColumnAlias[] = editingColumns.map(c => {
        const existingAlias = columnAliases.find(a => a.key === c.key);
        return {
          key: c.key,
          system_label: c.label,
          aliases: c.aliases && c.aliases.length > 0 ? c.aliases : (existingAlias?.aliases || [c.key]),
        };
      });
      const { error } = await supabase
        .from('system_settings')
        .update({ lead_table_columns: colConfig as any, lead_column_aliases: aliasesArray as any, updated_at: new Date().toISOString() } as any)
        .neq('id', '00000000-0000-0000-0000-000000000000');
      if (error) throw error;
      toast({ title: 'Configuração de colunas salva com sucesso' });
      queryClient.invalidateQueries({ queryKey: ['lead-table-columns'] });
      queryClient.invalidateQueries({ queryKey: ['lead-column-aliases'] });
      setEditingColumns(null);
    } catch (e: any) {
      toast({ title: 'Erro', description: e.message, variant: 'destructive' });
    } finally {
      setIsSavingColumns(false);
    }
  };

  const handleColumnDragStart = (idx: number) => setDragIdx(idx);
  const handleColumnDragOver = (e: React.DragEvent, idx: number) => {
    e.preventDefault();
    if (dragIdx === null || dragIdx === idx) return;
    moveColumn(dragIdx, idx);
    setDragIdx(idx);
  };
  const handleColumnDragEnd = () => setDragIdx(null);

  // ── Seller column handlers ──
  const startEditingSellerColumns = () => setEditingSellerColumns([...sellerColumnConfig]);

  const toggleSellerColumnVisibility = (idx: number) => {
    if (!editingSellerColumns) return;
    const updated = [...editingSellerColumns];
    updated[idx] = { ...updated[idx], visible: !updated[idx].visible };
    setEditingSellerColumns(updated);
  };

  const moveSellerColumn = (from: number, to: number) => {
    if (!editingSellerColumns || to < 0 || to >= editingSellerColumns.length) return;
    const updated = [...editingSellerColumns];
    const [moved] = updated.splice(from, 1);
    updated.splice(to, 0, moved);
    setEditingSellerColumns(updated);
  };

  const saveSellerColumns = async () => {
    if (!editingSellerColumns) return;
    setIsSavingSellerColumns(true);
    try {
      const { error } = await supabase
        .from('system_settings')
        .update({ seller_leads_columns: editingSellerColumns as any, updated_at: new Date().toISOString() } as any)
        .neq('id', '00000000-0000-0000-0000-000000000000');
      if (error) throw error;
      toast({ title: 'Colunas do Meus Leads atualizadas' });
      queryClient.invalidateQueries({ queryKey: ['seller-leads-columns'] });
      setEditingSellerColumns(null);
    } catch (e: any) {
      toast({ title: 'Erro', description: e.message, variant: 'destructive' });
    } finally {
      setIsSavingSellerColumns(false);
    }
  };

  const handleSellerColumnDragStart = (idx: number) => setDragSellerIdx(idx);
  const handleSellerColumnDragOver = (e: React.DragEvent, idx: number) => {
    e.preventDefault();
    if (dragSellerIdx === null || dragSellerIdx === idx) return;
    moveSellerColumn(dragSellerIdx, idx);
    setDragSellerIdx(idx);
  };
  const handleSellerColumnDragEnd = () => setDragSellerIdx(null);

  // ── Color picker helper ──
  const renderColorEditor = (
    items: (StatusOption | ProfileOption)[],
    updateField: (idx: number, field: any, val: string) => void,
    removeItem: (idx: number) => void,
  ) => (
    items.map((item, idx) => (
      <div key={idx} className="flex items-center gap-3 p-3 border rounded-lg">
        <div className="flex-1 grid grid-cols-3 gap-3">
          <div>
            <label className="text-xs text-muted-foreground mb-1 block">Valor (interno)</label>
            <Input value={item.value} onChange={(e) => updateField(idx, 'value', e.target.value)} placeholder="Ex: APROVADO" className="h-8 text-sm" />
          </div>
          <div>
            <label className="text-xs text-muted-foreground mb-1 block">Label (exibição)</label>
            <Input value={item.label} onChange={(e) => updateField(idx, 'label', e.target.value)} placeholder="Ex: Aprovado" className="h-8 text-sm" />
          </div>
          <div>
            <label className="text-xs text-muted-foreground mb-1 block">Cor</label>
            <div className="flex items-center gap-2 mt-1">
              <input
                type="color"
                value={item.color_class.match(/#[0-9a-fA-F]{6}/)?.[0] || '#6b7280'}
                onChange={(e) => updateField(idx, 'color_class', hexToColorClass(e.target.value))}
                className="w-8 h-8 rounded cursor-pointer border-0 p-0 shrink-0"
              />
              <div className="flex flex-wrap gap-1">
                {COLOR_HEX_PRESETS.map(hex => (
                  <button
                    key={hex}
                    type="button"
                    onClick={() => updateField(idx, 'color_class', hexToColorClass(hex))}
                    className="w-5 h-5 rounded-full border-2 transition-all shrink-0"
                    style={{
                      backgroundColor: hex,
                      borderColor: item.color_class.includes(hex) ? 'hsl(var(--foreground))' : 'transparent',
                    }}
                  />
                ))}
              </div>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {renderColorBadge(item.label || '...', item.color_class)}
          <Button variant="ghost" size="icon" onClick={() => removeItem(idx)} className="text-destructive hover:text-destructive h-8 w-8">
            <Trash2 className="w-4 h-4" />
          </Button>
        </div>
      </div>
    ))
  );

  return (
    <div className="space-y-4">
      {/* Status management */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2"><Settings2 className="w-5 h-5" />Gerenciar Status dos Leads</CardTitle>
            {!editingStatuses ? (
              <Button onClick={() => setEditingStatuses([...statusOptions])}>Editar Status</Button>
            ) : (
              <div className="flex gap-2">
                <Button variant="ghost" onClick={() => setEditingStatuses(null)}>Cancelar</Button>
                <Button onClick={saveStatuses} disabled={isSavingStatuses}>
                  {isSavingStatuses && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}Salvar
                </Button>
              </div>
            )}
          </div>
        </CardHeader>
        <CardContent>
          {!editingStatuses ? (
            <div className="space-y-3">
              <p className="text-sm text-muted-foreground">Status configurados atualmente:</p>
              <div className="flex flex-wrap gap-2">{statusOptions.map(s => <span key={s.value}>{renderColorBadge(s.label, s.color_class)}</span>)}</div>
            </div>
          ) : (
            <div className="space-y-4">
              <p className="text-sm text-muted-foreground">Edite os nomes e cores dos status.</p>
              {renderColorEditor(editingStatuses, updateStatusField, (idx) => setEditingStatuses(editingStatuses.filter((_, i) => i !== idx)))}
              <Button variant="outline" onClick={() => setEditingStatuses([...editingStatuses, { value: '', label: '', color_class: 'bg-muted text-muted-foreground hover:bg-muted/80' }])} className="w-full">
                <Plus className="w-4 h-4 mr-2" /> Adicionar Status
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Profile management */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2"><UserCircle className="w-5 h-5" />Gerenciar Perfis dos Leads</CardTitle>
            {!editingProfiles ? (
              <Button onClick={() => setEditingProfiles([...profileOptions])}>Editar Perfis</Button>
            ) : (
              <div className="flex gap-2">
                <Button variant="ghost" onClick={() => setEditingProfiles(null)}>Cancelar</Button>
                <Button onClick={saveProfiles} disabled={isSavingProfiles}>
                  {isSavingProfiles && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}Salvar
                </Button>
              </div>
            )}
          </div>
        </CardHeader>
        <CardContent>
          {!editingProfiles ? (
            <div className="space-y-3">
              <p className="text-sm text-muted-foreground">Perfis configurados atualmente:</p>
              <div className="flex flex-wrap gap-2">{profileOptions.map(p => <span key={p.value}>{renderColorBadge(p.label, p.color_class)}</span>)}</div>
            </div>
          ) : (
            <div className="space-y-4">
              <p className="text-sm text-muted-foreground">Edite os nomes e cores dos perfis.</p>
              {renderColorEditor(editingProfiles, updateProfileField, (idx) => setEditingProfiles(editingProfiles.filter((_, i) => i !== idx)))}
              <Button variant="outline" onClick={() => setEditingProfiles([...editingProfiles, { value: '', label: '', color_class: 'bg-muted text-muted-foreground hover:bg-muted/80' }])} className="w-full">
                <Plus className="w-4 h-4 mr-2" /> Adicionar Perfil
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Column configuration */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2"><GripVertical className="w-5 h-5" />Configuração de Colunas</CardTitle>
              <p className="text-sm text-muted-foreground mt-1">Ordem, visibilidade, nomes e variações para importação</p>
            </div>
            {!editingColumns ? (
              <Button onClick={startEditingColumns}>Editar Colunas</Button>
            ) : (
              <div className="flex gap-2">
                <Button variant="ghost" onClick={() => setEditingColumns(null)}>Cancelar</Button>
                <Button onClick={saveColumns} disabled={isSavingColumns}>
                  {isSavingColumns && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}Salvar
                </Button>
              </div>
            )}
          </div>
        </CardHeader>
        <CardContent>
          {!editingColumns ? (
            <div className="space-y-3">
              <p className="text-sm text-muted-foreground">Colunas configuradas:</p>
              <div className="flex flex-wrap gap-2">
                {columnConfig.filter(c => c.visible).map(c => (
                  <Badge key={c.key} variant="outline" className="flex items-center gap-1">
                    <Eye className="w-3 h-3" /> {c.label}
                    {c.isCustom && <span className="text-[10px] opacity-60">(custom)</span>}
                  </Badge>
                ))}
                {columnConfig.filter(c => !c.visible).map(c => (
                  <Badge key={c.key} variant="outline" className="flex items-center gap-1 opacity-40">
                    <EyeOff className="w-3 h-3" /> {c.label}
                  </Badge>
                ))}
              </div>
            </div>
          ) : (
            <div className="space-y-2">
              <p className="text-sm text-muted-foreground">Arraste para reordenar. Colunas customizadas armazenam dados no campo "Observações".</p>
              {editingColumns.map((col, idx) => {
                const isNative = ALL_COLUMNS.some(ac => ac.key === col.key);
                return (
                  <div
                    key={`${col.key}-${idx}`}
                    draggable
                    onDragStart={() => handleColumnDragStart(idx)}
                    onDragOver={(e) => handleColumnDragOver(e, idx)}
                    onDragEnd={handleColumnDragEnd}
                    className={`flex items-start gap-3 p-3 border rounded-lg cursor-grab active:cursor-grabbing transition-colors ${dragIdx === idx ? 'bg-primary/10 border-primary/30' : 'hover:bg-muted/50'}`}
                  >
                    <GripVertical className="w-4 h-4 text-muted-foreground flex-shrink-0 mt-2" />
                    <Button variant="ghost" size="sm" onClick={() => toggleColumnVisibility(idx)}
                      className={`flex-shrink-0 mt-0.5 ${col.visible ? 'text-green-500 hover:text-green-600' : 'text-muted-foreground hover:text-foreground'}`}>
                      {col.visible ? <Eye className="w-4 h-4" /> : <EyeOff className="w-4 h-4" />}
                    </Button>
                    <div className="flex-1 grid grid-cols-1 sm:grid-cols-3 gap-2">
                      <div>
                        <label className="text-xs text-muted-foreground mb-1 block">{isNative ? 'Chave' : 'Chave interna'}</label>
                        {isNative ? (
                          <span className="font-mono text-xs text-muted-foreground">{col.key}</span>
                        ) : (
                          <Input value={col.key} onChange={(e) => updateColumnField(idx, 'key', e.target.value.toLowerCase().replace(/\s+/g, '_'))} className="h-8 text-sm font-mono" placeholder="ex: telefone2" />
                        )}
                      </div>
                      <div>
                        <label className="text-xs text-muted-foreground mb-1 block">Nome (exibição)</label>
                        <Input value={col.label} onChange={(e) => updateColumnField(idx, 'label', e.target.value)} className="h-8 text-sm" />
                      </div>
                      <div>
                        <label className="text-xs text-muted-foreground mb-1 block">Variações importação</label>
                        <Input value={(col.aliases || []).join(', ')} onChange={(e) => updateColumnField(idx, 'aliases', e.target.value)} className="h-8 text-sm" placeholder="nome, name, Nome Completo" />
                      </div>
                    </div>
                    {!isNative && (
                      <Button variant="ghost" size="icon" onClick={() => {
                        setEditingColumns(editingColumns.filter((_, i) => i !== idx));
                      }} className="text-destructive hover:text-destructive h-8 w-8 flex-shrink-0 mt-0.5">
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    )}
                  </div>
                );
              })}
              <Button variant="outline" onClick={() => setEditingColumns([...editingColumns, { key: '', label: '', visible: true, aliases: [], isCustom: true }])} className="w-full">
                <Plus className="w-4 h-4 mr-2" /> Adicionar Coluna Customizada
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Seller columns */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2"><Eye className="w-5 h-5" />Colunas do Meus Leads (Vendedores)</CardTitle>
              <p className="text-sm text-muted-foreground mt-1">Configure quais colunas aparecem no modal "Meus Leads" dos vendedores</p>
            </div>
            {!editingSellerColumns ? (
              <Button onClick={startEditingSellerColumns}>Editar Colunas</Button>
            ) : (
              <div className="flex gap-2">
                <Button variant="ghost" onClick={() => setEditingSellerColumns(null)}>Cancelar</Button>
                <Button onClick={saveSellerColumns} disabled={isSavingSellerColumns}>
                  {isSavingSellerColumns && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}Salvar
                </Button>
              </div>
            )}
          </div>
        </CardHeader>
        <CardContent>
          {!editingSellerColumns ? (
            <div className="space-y-3">
              <p className="text-sm text-muted-foreground">Colunas ativas para vendedores:</p>
              <div className="flex flex-wrap gap-2">
                {sellerColumnConfig.filter(c => c.visible).map(c => (
                  <Badge key={c.key} variant="outline" className="flex items-center gap-1"><Eye className="w-3 h-3" /> {c.label}</Badge>
                ))}
                {sellerColumnConfig.filter(c => !c.visible).map(c => (
                  <Badge key={c.key} variant="outline" className="flex items-center gap-1 opacity-40"><EyeOff className="w-3 h-3" /> {c.label}</Badge>
                ))}
              </div>
            </div>
          ) : (
            <div className="space-y-2">
              <p className="text-sm text-muted-foreground">Arraste para reordenar e alterne a visibilidade.</p>
              {editingSellerColumns.map((col, idx) => (
                <div
                  key={col.key}
                  draggable
                  onDragStart={() => handleSellerColumnDragStart(idx)}
                  onDragOver={(e) => handleSellerColumnDragOver(e, idx)}
                  onDragEnd={handleSellerColumnDragEnd}
                  className={`flex items-center gap-3 p-3 border rounded-lg cursor-grab active:cursor-grabbing transition-colors ${dragSellerIdx === idx ? 'bg-primary/10 border-primary/30' : 'hover:bg-muted/50'}`}
                >
                  <GripVertical className="w-4 h-4 text-muted-foreground flex-shrink-0" />
                  <span className="flex-1 text-sm font-medium">{col.label}</span>
                  <span className="text-xs text-muted-foreground font-mono">{col.key}</span>
                  <Button variant="ghost" size="sm" onClick={() => toggleSellerColumnVisibility(idx)}
                    className={col.visible ? 'text-green-500 hover:text-green-600' : 'text-muted-foreground hover:text-foreground'}>
                    {col.visible ? <Eye className="w-4 h-4" /> : <EyeOff className="w-4 h-4" />}
                  </Button>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
