import { useMemo, useState, useCallback } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import DashboardLayout from '@/components/layout/DashboardLayout';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Users, Clock, CheckCircle, XCircle, Loader2, Plus, Trash2, Settings2, GripVertical, Eye, EyeOff, Download, FileJson, FileSpreadsheet, Upload, UserCircle, BarChart3 } from 'lucide-react';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { useToast } from '@/hooks/use-toast';
import LeadImporter, { DEFAULT_ALIASES, type ColumnAlias } from '@/components/admin/LeadImporter';
import LeadsTable from '@/components/admin/LeadsTable';
import LeadManagement from '@/components/admin/LeadManagement';

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

const DEFAULT_STATUS_OPTIONS: StatusOption[] = [
  { value: 'pendente', label: 'Pendente', color_class: 'bg-muted text-muted-foreground hover:bg-muted/80' },
  { value: 'CHAMEI', label: 'Chamei', color_class: 'bg-blue-500/20 text-blue-400 hover:bg-blue-500/30' },
  { value: 'NÃO ATENDEU', label: 'Não Atendeu', color_class: 'bg-yellow-500/20 text-yellow-400 hover:bg-yellow-500/30' },
  { value: 'NÃO EXISTE', label: 'Não Existe', color_class: 'bg-red-500/20 text-red-400 hover:bg-red-500/30' },
  { value: 'APROVADO', label: 'Aprovado', color_class: 'bg-green-500/20 text-green-400 hover:bg-green-500/30' },
];

const DEFAULT_PROFILE_OPTIONS: ProfileOption[] = [
  { value: 'CLT', label: 'CLT', color_class: 'bg-blue-500/20 text-blue-400 hover:bg-blue-500/30' },
  { value: 'CLT Clientes', label: 'CLT Clientes', color_class: 'bg-green-500/20 text-green-400 hover:bg-green-500/30' },
  { value: 'FGTS', label: 'FGTS', color_class: 'bg-purple-500/20 text-purple-400 hover:bg-purple-500/30' },
  { value: 'FGTS Clientes', label: 'FGTS Clientes', color_class: 'bg-orange-500/20 text-orange-400 hover:bg-orange-500/30' },
];

interface ColumnConfig {
  key: string;
  label: string;
  visible: boolean;
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
  { key: 'notes', label: 'Observações', visible: true },
];

export default function Leads() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [deletingBatch, setDeletingBatch] = useState<string | null>(null);
  const [isDeletingBatch, setIsDeletingBatch] = useState(false);

  // Filters lifted from LeadsTable
  const [filterSeller, setFilterSeller] = useState('all');
  const [filterStatus, setFilterStatus] = useState('all');
  const [filterBatch, setFilterBatch] = useState('all');
  const [filterProfile, setFilterProfile] = useState('all');

  // Status editor state
  const [editingStatuses, setEditingStatuses] = useState<StatusOption[] | null>(null);
  const [isSavingStatuses, setIsSavingStatuses] = useState(false);

  // Profile editor state
  const [editingProfiles, setEditingProfiles] = useState<ProfileOption[] | null>(null);
  const [isSavingProfiles, setIsSavingProfiles] = useState(false);

  // Column config editor state
  const [editingColumns, setEditingColumns] = useState<ColumnConfig[] | null>(null);
  const [isSavingColumns, setIsSavingColumns] = useState(false);
  const [dragIdx, setDragIdx] = useState<number | null>(null);

  // Seller column config state
  const [editingSellerColumns, setEditingSellerColumns] = useState<ColumnConfig[] | null>(null);
  const [isSavingSellerColumns, setIsSavingSellerColumns] = useState(false);
  const [dragSellerIdx, setDragSellerIdx] = useState<number | null>(null);

  // Fetch status options from system_settings
  const { data: statusOptions = DEFAULT_STATUS_OPTIONS } = useQuery({
    queryKey: ['lead-status-options'],
    queryFn: async () => {
      const { data } = await supabase
        .from('system_settings')
        .select('lead_status_options')
        .maybeSingle();
      if (data?.lead_status_options && Array.isArray(data.lead_status_options)) {
        return data.lead_status_options as unknown as StatusOption[];
      }
      return DEFAULT_STATUS_OPTIONS;
    }
  });

  // Fetch profile options from system_settings
  const { data: profileOptions = DEFAULT_PROFILE_OPTIONS } = useQuery({
    queryKey: ['lead-profile-options'],
    queryFn: async () => {
      const { data } = await supabase
        .from('system_settings')
        .select('lead_profile_options')
        .maybeSingle();
      if (data?.lead_profile_options && Array.isArray(data.lead_profile_options)) {
        return data.lead_profile_options as unknown as ProfileOption[];
      }
      return DEFAULT_PROFILE_OPTIONS;
    }
  });

  // Fetch column config from system_settings, merging with ALL_COLUMNS to include new columns
  const { data: columnConfig = ALL_COLUMNS } = useQuery({
    queryKey: ['lead-table-columns'],
    queryFn: async () => {
      const { data } = await supabase
        .from('system_settings')
        .select('lead_table_columns')
        .maybeSingle();
      if (data?.lead_table_columns && Array.isArray(data.lead_table_columns)) {
        const saved = data.lead_table_columns as unknown as ColumnConfig[];
        const savedKeys = new Set(saved.map(c => c.key));
        // Add any new columns from ALL_COLUMNS that aren't in the saved config
        const newCols = ALL_COLUMNS.filter(c => !savedKeys.has(c.key));
        if (newCols.length > 0) {
          return [...saved, ...newCols];
        }
        return saved;
      }
      return ALL_COLUMNS;
    }
  });

  // Fetch seller leads column config
  const SELLER_LEADS_COLUMNS: ColumnConfig[] = [
    { key: 'nome', label: 'Nome', visible: true },
    { key: 'perfil', label: 'Perfil', visible: true },
    { key: 'telefone', label: 'Telefone', visible: true },
    { key: 'cpf', label: 'CPF', visible: true },
    { key: 'valor_lib', label: 'Valor Lib.', visible: true },
    { key: 'prazo', label: 'Prazo', visible: true },
    { key: 'vlr_parcela', label: 'Parcela', visible: true },
    { key: 'banco_nome', label: 'Banco', visible: true },
    { key: 'banco_simulado', label: 'Banco Simulado', visible: false },
    { key: 'banco_codigo', label: 'Cód. Banco', visible: false },
    { key: 'agencia', label: 'Agência', visible: false },
    { key: 'conta', label: 'Conta', visible: false },
    { key: 'aprovado', label: 'Aprovado', visible: true },
    { key: 'reprovado', label: 'Reprovado', visible: false },
    { key: 'data_nasc', label: 'Data Nasc.', visible: false },
    { key: 'nome_mae', label: 'Nome Mãe', visible: false },
    { key: 'data_ref', label: 'Data Ref.', visible: false },
    { key: 'status', label: 'Status', visible: true },
    { key: 'batch_name', label: 'Lote', visible: true },
    { key: 'notes', label: 'Observações', visible: false },
  ];

  const { data: sellerColumnConfig = SELLER_LEADS_COLUMNS } = useQuery({
    queryKey: ['seller-leads-columns'],
    queryFn: async () => {
      const { data } = await supabase
        .from('system_settings')
        .select('seller_leads_columns')
        .maybeSingle();
      if (data && (data as any).seller_leads_columns && Array.isArray((data as any).seller_leads_columns)) {
        const saved = (data as any).seller_leads_columns as ColumnConfig[];
        const savedKeys = new Set(saved.map(c => c.key));
        const newCols = SELLER_LEADS_COLUMNS.filter(c => !savedKeys.has(c.key));
        return newCols.length > 0 ? [...saved, ...newCols] : saved;
      }
      return SELLER_LEADS_COLUMNS;
    }
  });

  const { data: allLeads = [] } = useQuery({
    queryKey: ['admin-leads-metrics'],
    queryFn: async () => {
      const allData: any[] = [];
      let from = 0;
      const batchSize = 1000;
      while (true) {
        const { data, error } = await supabase.from('client_leads').select('status, batch_name, assigned_to, created_at, contacted_at, perfil').range(from, from + batchSize - 1);
        if (error) throw error;
        if (!data || data.length === 0) break;
        allData.push(...data);
        if (data.length < batchSize) break;
        from += batchSize;
      }
      return allData;
    }
  });

  const { data: sellers = [] } = useQuery({
    queryKey: ['sellers-list'],
    queryFn: async () => {
      const { data } = await supabase.from('profiles').select('user_id, name, email');
      return data || [];
    }
  });

  const getSellerName = (userId: string) => {
    const s = sellers.find((s: any) => s.user_id === userId);
    return s?.name || s?.email || 'N/A';
  };

  // Metrics react to filters
  const filteredLeadsForMetrics = useMemo(() => {
    let result = [...allLeads];
    if (filterSeller !== 'all') result = result.filter((l: any) => l.assigned_to === filterSeller);
    if (filterStatus !== 'all') result = result.filter((l: any) => l.status === filterStatus);
    if (filterBatch !== 'all') result = result.filter((l: any) => l.batch_name === filterBatch);
    if (filterProfile === '__none__') result = result.filter((l: any) => !l.perfil);
    else if (filterProfile !== 'all') result = result.filter((l: any) => l.perfil === filterProfile);
    return result;
  }, [allLeads, filterSeller, filterStatus, filterBatch, filterProfile]);

  const metrics = useMemo(() => {
    const total = filteredLeadsForMetrics.length;
    const pendentes = filteredLeadsForMetrics.filter((l: any) => l.status === 'pendente').length;
    const contatados = filteredLeadsForMetrics.filter((l: any) => l.status !== 'pendente').length;
    const aprovados = filteredLeadsForMetrics.filter((l: any) => l.status === 'APROVADO').length;
    const taxaAprovacao = total > 0 ? Math.round((aprovados / total) * 100) : 0;
    return { total, pendentes, contatados, aprovados, taxaAprovacao };
  }, [filteredLeadsForMetrics]);

  const batchHistory = useMemo(() => {
    const map = new Map<string, { batch: string; seller: string; total: number; contacted: number; created: string }>();
    allLeads.forEach((l: any) => {
      const key = l.batch_name || 'Sem lote';
      if (!map.has(key)) {
        map.set(key, { batch: key, seller: l.assigned_to, total: 0, contacted: 0, created: l.created_at });
      }
      const entry = map.get(key)!;
      entry.total++;
      if (l.status !== 'pendente') entry.contacted++;
      if (l.created_at < entry.created) entry.created = l.created_at;
    });
    return Array.from(map.values()).sort((a, b) => b.created.localeCompare(a.created));
  }, [allLeads]);


  const handleDeleteBatch = async () => {
    if (!deletingBatch) return;
    setIsDeletingBatch(true);
    try {
      // Delete in batches to handle large lotes
      let deleted = 0;
      while (true) {
        const { data, error } = await supabase.from('client_leads')
          .delete()
          .eq('batch_name', deletingBatch)
          .select('id')
          .limit(1000);
        if (error) throw error;
        if (!data || data.length === 0) break;
        deleted += data.length;
      }
      toast({ title: `Lote "${deletingBatch}" excluído`, description: `${deleted} leads removidos` });
      queryClient.invalidateQueries({ queryKey: ['admin-leads'] });
      queryClient.invalidateQueries({ queryKey: ['admin-leads-metrics'] });
      setDeletingBatch(null);
    } catch (e: any) {
      toast({ title: 'Erro ao excluir lote', description: e.message, variant: 'destructive' });
    } finally {
      setIsDeletingBatch(false);
    }
  };

  const handleFiltersChange = (filters: { seller: string; status: string; batch: string; profile: string }) => {
    setFilterSeller(filters.seller);
    setFilterStatus(filters.status);
    setFilterBatch(filters.batch);
    setFilterProfile(filters.profile);
  };

  // Export leads
  const [isExporting, setIsExporting] = useState(false);

  const fetchAllLeadsForExport = async () => {
    const allData: any[] = [];
    let from = 0;
    const batchSize = 1000;
    while (true) {
      const { data, error } = await supabase.from('client_leads').select('*').range(from, from + batchSize - 1);
      if (error) throw error;
      if (!data || data.length === 0) break;
      allData.push(...data);
      if (data.length < batchSize) break;
      from += batchSize;
    }
    return allData;
  };

  const handleExportJSON = async () => {
    setIsExporting(true);
    try {
      const data = await fetchAllLeadsForExport();
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url; a.download = `leads_backup_${new Date().toISOString().split('T')[0]}.json`; a.click();
      URL.revokeObjectURL(url);
      toast({ title: 'Exportado!', description: `${data.length} leads exportados em JSON` });
    } catch (err: any) {
      toast({ title: 'Erro', description: err.message, variant: 'destructive' });
    }
    setIsExporting(false);
  };

  const handleExportCSV = async () => {
    setIsExporting(true);
    try {
      const data = await fetchAllLeadsForExport();
      if (data.length === 0) { toast({ title: 'Nenhum lead para exportar' }); setIsExporting(false); return; }
      const headers = Object.keys(data[0]);
      const csvRows = [
        headers.join(','),
        ...data.map(row => headers.map(h => { const v = row[h]; if (v == null) return ''; return `"${String(v).replace(/"/g, '""')}"`; }).join(','))
      ];
      const blob = new Blob([csvRows.join('\n')], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url; a.download = `leads_backup_${new Date().toISOString().split('T')[0]}.csv`; a.click();
      URL.revokeObjectURL(url);
      toast({ title: 'Exportado!', description: `${data.length} leads exportados em CSV` });
    } catch (err: any) {
      toast({ title: 'Erro', description: err.message, variant: 'destructive' });
    }
    setIsExporting(false);
  };

  const handleImportJSON = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setIsExporting(true);
    try {
      const text = await file.text();
      const data = JSON.parse(text) as any[];
      if (!Array.isArray(data)) throw new Error('Formato inválido');
      const cleaned = data.map(({ id, created_at, updated_at, ...rest }) => rest);
      let inserted = 0;
      for (let i = 0; i < cleaned.length; i += 100) {
        const batch = cleaned.slice(i, i + 100);
        const { error } = await supabase.from('client_leads').insert(batch as any);
        if (error) throw error;
        inserted += batch.length;
      }
      toast({ title: 'Importado!', description: `${inserted} leads restaurados` });
      queryClient.invalidateQueries({ queryKey: ['admin-leads'] });
      queryClient.invalidateQueries({ queryKey: ['admin-leads-metrics'] });
    } catch (err: any) {
      toast({ title: 'Erro na importação', description: err.message, variant: 'destructive' });
    }
    setIsExporting(false);
    e.target.value = '';
  };

  // Status management
  const startEditingStatuses = () => setEditingStatuses([...statusOptions]);

  const addStatus = () => {
    if (!editingStatuses) return;
    setEditingStatuses([...editingStatuses, { value: '', label: '', color_class: 'bg-muted text-muted-foreground hover:bg-muted/80' }]);
  };

  const removeStatus = (idx: number) => {
    if (!editingStatuses) return;
    setEditingStatuses(editingStatuses.filter((_, i) => i !== idx));
  };

  const updateStatusField = (idx: number, field: keyof StatusOption, val: string) => {
    if (!editingStatuses) return;
    const updated = [...editingStatuses];
    updated[idx] = { ...updated[idx], [field]: val };
    if (field === 'label') {
      const prev = editingStatuses[idx];
      if (!prev.value || prev.value === prev.label.toUpperCase()) {
        updated[idx].value = val.toUpperCase();
      }
    }
    setEditingStatuses(updated);
  };

  const saveStatuses = async () => {
    if (!editingStatuses) return;
    const invalid = editingStatuses.some(s => !s.value || !s.label);
    if (invalid) {
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

  // Profile management
  const startEditingProfiles = () => setEditingProfiles([...profileOptions]);

  const addProfile = () => {
    if (!editingProfiles) return;
    setEditingProfiles([...editingProfiles, { value: '', label: '', color_class: 'bg-muted text-muted-foreground hover:bg-muted/80' }]);
  };

  const removeProfile = (idx: number) => {
    if (!editingProfiles) return;
    setEditingProfiles(editingProfiles.filter((_, i) => i !== idx));
  };

  const updateProfileField = (idx: number, field: keyof ProfileOption, val: string) => {
    if (!editingProfiles) return;
    const updated = [...editingProfiles];
    updated[idx] = { ...updated[idx], [field]: val };
    if (field === 'label') {
      const prev = editingProfiles[idx];
      if (!prev.value || prev.value === prev.label) {
        updated[idx].value = val;
      }
    }
    setEditingProfiles(updated);
  };

  const saveProfiles = async () => {
    if (!editingProfiles) return;
    const invalid = editingProfiles.some(p => !p.value || !p.label);
    if (invalid) {
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

  // Column config functions
  const startEditingColumns = () => setEditingColumns([...columnConfig]);

  const toggleColumnVisibility = (idx: number) => {
    if (!editingColumns) return;
    const updated = [...editingColumns];
    updated[idx] = { ...updated[idx], visible: !updated[idx].visible };
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
    setIsSavingColumns(true);
    try {
      const { error } = await supabase
        .from('system_settings')
        .update({ lead_table_columns: editingColumns as any, updated_at: new Date().toISOString() } as any)
        .neq('id', '00000000-0000-0000-0000-000000000000');
      if (error) throw error;
      toast({ title: 'Colunas atualizadas com sucesso' });
      queryClient.invalidateQueries({ queryKey: ['lead-table-columns'] });
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

  // Seller column config functions
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

  // Color hex presets for lead status/profiles
  const COLOR_HEX_PRESETS = [
    '#6b7280', '#3b82f6', '#eab308', '#ef4444', '#10b981',
    '#8b5cf6', '#ec4899', '#f97316', '#06b6d4', '#14b8a6',
  ];

  // Convert hex to a storable format that works with inline styles
  const hexToColorClass = (hex: string) => {
    return `hex:${hex}`;
  };

  // Extract hex from color_class — supports both "hex:#abc123" and legacy "bg-[#abc123]/20 text-[#abc123]"
  const extractHex = (colorClass: string): string | null => {
    if (colorClass.startsWith('hex:')) return colorClass.slice(4);
    const match = colorClass.match(/#[0-9a-fA-F]{6}/);
    return match ? match[0] : null;
  };

  // Render a badge with proper color — uses inline styles for hex colors, CSS classes for Tailwind presets
  const renderColorBadge = (label: string, colorClass: string) => {
    const hex = extractHex(colorClass);
    if (hex) {
      return (
        <Badge
          variant="secondary"
          style={{ backgroundColor: hex + '33', color: hex, borderColor: hex + '44' }}
        >
          {label}
        </Badge>
      );
    }
    // Fallback: use Tailwind class (for default presets that are known safe static classes)
    return <Badge className={colorClass}>{label}</Badge>;
  };

  return (
    <DashboardLayout>
      <div className="space-y-6 min-w-0">
        <div>
          <h1 className="text-3xl font-bold">Gestão de Leads</h1>
          <p className="text-muted-foreground">Importe planilhas e atribua leads aos vendedores</p>
        </div>

        {/* Metrics */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Card>
            <CardContent className="pt-4 pb-3">
              <div className="flex items-center gap-2 text-muted-foreground text-sm"><Users className="w-4 h-4" /> Total</div>
              <p className="text-2xl font-bold mt-1">{metrics.total}</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4 pb-3">
              <div className="flex items-center gap-2 text-muted-foreground text-sm"><Clock className="w-4 h-4" /> Pendentes</div>
              <p className="text-2xl font-bold mt-1">{metrics.pendentes}</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4 pb-3">
              <div className="flex items-center gap-2 text-muted-foreground text-sm"><CheckCircle className="w-4 h-4" /> Contatados</div>
              <p className="text-2xl font-bold mt-1">{metrics.contatados}</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4 pb-3">
              <div className="flex items-center gap-2 text-muted-foreground text-sm"><XCircle className="w-4 h-4" /> Aprovados</div>
              <p className="text-2xl font-bold mt-1">{metrics.aprovados} <span className="text-sm text-muted-foreground font-normal">({metrics.taxaAprovacao}%)</span></p>
            </CardContent>
          </Card>
        </div>

        <Tabs defaultValue="leads" className="space-y-4 min-w-0">
          <TabsList className="flex-wrap">
            <TabsTrigger value="leads">Leads</TabsTrigger>
            <TabsTrigger value="management" className="flex items-center gap-1">
              <BarChart3 className="w-3.5 h-3.5" /> Gerenciamento
            </TabsTrigger>
            <TabsTrigger value="import">Importar Planilha</TabsTrigger>
            <TabsTrigger value="export">Backup / Exportar</TabsTrigger>
            <TabsTrigger value="batches">Histórico de Lotes</TabsTrigger>
            <TabsTrigger value="status-config" className="flex items-center gap-1">
              <Settings2 className="w-3.5 h-3.5" /> Configurações da Planilha
            </TabsTrigger>
          </TabsList>

          <TabsContent value="leads" className="min-w-0">
            <LeadsTable
              filterSeller={filterSeller}
              filterStatus={filterStatus}
              filterBatch={filterBatch}
              filterProfile={filterProfile}
              onFiltersChange={handleFiltersChange}
              statusOptions={statusOptions}
              columnConfig={columnConfig}
              profileOptions={profileOptions}
            />
          </TabsContent>

          <TabsContent value="management">
            <LeadManagement statusOptions={statusOptions} profileOptions={profileOptions} />
          </TabsContent>

          <TabsContent value="import">
            <LeadImporter />
          </TabsContent>

          <TabsContent value="export">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2"><Download className="w-5 h-5" />Backup e Exportação de Leads</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid gap-3 sm:grid-cols-3">
                  <Button onClick={handleExportCSV} disabled={isExporting} variant="outline" className="h-20 flex-col gap-2">
                    <FileSpreadsheet className="w-6 h-6" />
                    <span>Exportar CSV</span>
                  </Button>
                  <Button onClick={handleExportJSON} disabled={isExporting} variant="outline" className="h-20 flex-col gap-2">
                    <FileJson className="w-6 h-6" />
                    <span>Exportar JSON</span>
                  </Button>
                  <label className="cursor-pointer">
                    <input type="file" accept=".json" onChange={handleImportJSON} className="hidden" />
                    <div className="h-20 flex flex-col items-center justify-center gap-2 rounded-md border border-dashed border-border hover:bg-secondary/30 transition-colors">
                      <Upload className="w-6 h-6" />
                      <span className="text-sm">Restaurar JSON</span>
                    </div>
                  </label>
                </div>
                <p className="text-xs text-muted-foreground">O backup JSON pode ser restaurado posteriormente. O CSV é compatível com planilhas.</p>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="batches">
            <Card>
              <CardHeader>
                <CardTitle>Histórico de Importações</CardTitle>
              </CardHeader>
              <CardContent>
                {batchHistory.length === 0 ? (
                  <p className="text-muted-foreground text-center py-4">Nenhum lote importado.</p>
                ) : (
                  <div className="border rounded-lg overflow-auto">
                    <Table>
                      <TableHeader>
                         <TableRow>
                          <TableHead>Lote</TableHead>
                          <TableHead>Vendedor</TableHead>
                          <TableHead>Qtd Leads</TableHead>
                          <TableHead>% Contatados</TableHead>
                          <TableHead>Data</TableHead>
                          <TableHead>Ações</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {batchHistory.map((b) => {
                          const pct = b.total > 0 ? Math.round((b.contacted / b.total) * 100) : 0;
                          return (
                            <TableRow key={b.batch}>
                              <TableCell className="font-medium">{b.batch}</TableCell>
                              <TableCell>{getSellerName(b.seller)}</TableCell>
                              <TableCell>{b.total}</TableCell>
                              <TableCell>
                                <div className="flex items-center gap-2">
                                  <Progress value={pct} className="h-2 w-20" />
                                  <span className="text-xs text-muted-foreground">{pct}%</span>
                                </div>
                              </TableCell>
                              <TableCell className="text-sm text-muted-foreground">
                                {new Date(b.created).toLocaleDateString('pt-BR')}
                              </TableCell>
                              <TableCell>
                                <Button size="sm" variant="ghost" className="text-destructive hover:text-destructive" onClick={() => setDeletingBatch(b.batch)}>
                                  <Trash2 className="w-4 h-4" />
                                </Button>
                              </TableCell>
                            </TableRow>
                          );
                        })}
                      </TableBody>
                    </Table>
                  </div>
                )}
              </CardContent>
            </Card>

            <AlertDialog open={!!deletingBatch} onOpenChange={(open) => !open && setDeletingBatch(null)}>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Excluir lote "{deletingBatch}"?</AlertDialogTitle>
                  <AlertDialogDescription>
                    Todos os leads deste lote serão permanentemente excluídos. Esta ação não pode ser desfeita.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel disabled={isDeletingBatch}>Cancelar</AlertDialogCancel>
                  <AlertDialogAction onClick={handleDeleteBatch} disabled={isDeletingBatch} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
                    {isDeletingBatch ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Trash2 className="w-4 h-4 mr-2" />}
                    Excluir
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </TabsContent>

          <TabsContent value="status-config" className="space-y-4">
            {/* Status management card */}
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle className="flex items-center gap-2">
                    <Settings2 className="w-5 h-5" />
                    Gerenciar Status dos Leads
                  </CardTitle>
                  {!editingStatuses ? (
                    <Button onClick={startEditingStatuses}>Editar Status</Button>
                  ) : (
                    <div className="flex gap-2">
                      <Button variant="ghost" onClick={() => setEditingStatuses(null)}>Cancelar</Button>
                      <Button onClick={saveStatuses} disabled={isSavingStatuses}>
                        {isSavingStatuses && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                        Salvar
                      </Button>
                    </div>
                  )}
                </div>
              </CardHeader>
              <CardContent>
                {!editingStatuses ? (
                  <div className="space-y-3">
                    <p className="text-sm text-muted-foreground">Status configurados atualmente:</p>
                    <div className="flex flex-wrap gap-2">
                      {statusOptions.map(s => (
                        <span key={s.value}>{renderColorBadge(s.label, s.color_class)}</span>
                      ))}
                    </div>
                  </div>
                ) : (
                  <div className="space-y-4">
                    <p className="text-sm text-muted-foreground">Edite os nomes e cores dos status. Estas alterações serão refletidas em todo o sistema.</p>
                    {editingStatuses.map((status, idx) => (
                      <div key={idx} className="flex items-center gap-3 p-3 border rounded-lg">
                        <div className="flex-1 grid grid-cols-3 gap-3">
                          <div>
                            <label className="text-xs text-muted-foreground mb-1 block">Valor (interno)</label>
                            <Input
                              value={status.value}
                              onChange={(e) => updateStatusField(idx, 'value', e.target.value)}
                              placeholder="Ex: APROVADO"
                              className="h-8 text-sm"
                            />
                          </div>
                          <div>
                            <label className="text-xs text-muted-foreground mb-1 block">Label (exibição)</label>
                            <Input
                              value={status.label}
                              onChange={(e) => updateStatusField(idx, 'label', e.target.value)}
                              placeholder="Ex: Aprovado"
                              className="h-8 text-sm"
                            />
                          </div>
                          <div>
                            <label className="text-xs text-muted-foreground mb-1 block">Cor</label>
                            <div className="flex items-center gap-2 mt-1">
                              <input
                                type="color"
                                value={status.color_class.match(/#[0-9a-fA-F]{6}/)?.[0] || '#6b7280'}
                                onChange={(e) => updateStatusField(idx, 'color_class', hexToColorClass(e.target.value))}
                                className="w-8 h-8 rounded cursor-pointer border-0 p-0 shrink-0"
                              />
                              <div className="flex flex-wrap gap-1">
                                {COLOR_HEX_PRESETS.map(hex => (
                                  <button
                                    key={hex}
                                    type="button"
                                    onClick={() => updateStatusField(idx, 'color_class', hexToColorClass(hex))}
                                    className="w-5 h-5 rounded-full border-2 transition-all shrink-0"
                                    style={{
                                      backgroundColor: hex,
                                      borderColor: status.color_class.includes(hex) ? 'hsl(var(--foreground))' : 'transparent',
                                    }}
                                  />
                                ))}
                              </div>
                            </div>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          {renderColorBadge(status.label || '...', status.color_class)}
                          <Button variant="ghost" size="icon" onClick={() => removeStatus(idx)} className="text-destructive hover:text-destructive h-8 w-8">
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </div>
                      </div>
                    ))}
                    <Button variant="outline" onClick={addStatus} className="w-full">
                      <Plus className="w-4 h-4 mr-2" /> Adicionar Status
                    </Button>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Profile management card */}
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle className="flex items-center gap-2">
                    <UserCircle className="w-5 h-5" />
                    Gerenciar Perfis dos Leads
                  </CardTitle>
                  {!editingProfiles ? (
                    <Button onClick={startEditingProfiles}>Editar Perfis</Button>
                  ) : (
                    <div className="flex gap-2">
                      <Button variant="ghost" onClick={() => setEditingProfiles(null)}>Cancelar</Button>
                      <Button onClick={saveProfiles} disabled={isSavingProfiles}>
                        {isSavingProfiles && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                        Salvar
                      </Button>
                    </div>
                  )}
                </div>
              </CardHeader>
              <CardContent>
                {!editingProfiles ? (
                  <div className="space-y-3">
                    <p className="text-sm text-muted-foreground">Perfis configurados atualmente:</p>
                    <div className="flex flex-wrap gap-2">
                      {profileOptions.map(p => (
                        <span key={p.value}>{renderColorBadge(p.label, p.color_class)}</span>
                      ))}
                    </div>
                  </div>
                ) : (
                  <div className="space-y-4">
                    <p className="text-sm text-muted-foreground">Edite os nomes e cores dos perfis. O perfil é atribuído durante a importação e pode ser alterado em massa.</p>
                    {editingProfiles.map((profile, idx) => (
                      <div key={idx} className="flex items-center gap-3 p-3 border rounded-lg">
                        <div className="flex-1 grid grid-cols-3 gap-3">
                          <div>
                            <label className="text-xs text-muted-foreground mb-1 block">Valor (interno)</label>
                            <Input
                              value={profile.value}
                              onChange={(e) => updateProfileField(idx, 'value', e.target.value)}
                              placeholder="Ex: CLT"
                              className="h-8 text-sm"
                            />
                          </div>
                          <div>
                            <label className="text-xs text-muted-foreground mb-1 block">Label (exibição)</label>
                            <Input
                              value={profile.label}
                              onChange={(e) => updateProfileField(idx, 'label', e.target.value)}
                              placeholder="Ex: CLT"
                              className="h-8 text-sm"
                            />
                          </div>
                          <div>
                            <label className="text-xs text-muted-foreground mb-1 block">Cor</label>
                            <div className="flex items-center gap-2 mt-1">
                              <input
                                type="color"
                                value={profile.color_class.match(/#[0-9a-fA-F]{6}/)?.[0] || '#6b7280'}
                                onChange={(e) => updateProfileField(idx, 'color_class', hexToColorClass(e.target.value))}
                                className="w-8 h-8 rounded cursor-pointer border-0 p-0 shrink-0"
                              />
                              <div className="flex flex-wrap gap-1">
                                {COLOR_HEX_PRESETS.map(hex => (
                                  <button
                                    key={hex}
                                    type="button"
                                    onClick={() => updateProfileField(idx, 'color_class', hexToColorClass(hex))}
                                    className="w-5 h-5 rounded-full border-2 transition-all shrink-0"
                                    style={{
                                      backgroundColor: hex,
                                      borderColor: profile.color_class.includes(hex) ? 'hsl(var(--foreground))' : 'transparent',
                                    }}
                                  />
                                ))}
                              </div>
                            </div>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          {renderColorBadge(profile.label || '...', profile.color_class)}
                          <Button variant="ghost" size="icon" onClick={() => removeProfile(idx)} className="text-destructive hover:text-destructive h-8 w-8">
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </div>
                      </div>
                    ))}
                    <Button variant="outline" onClick={addProfile} className="w-full">
                      <Plus className="w-4 h-4 mr-2" /> Adicionar Perfil
                    </Button>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Column Configuration */}
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle className="flex items-center gap-2">
                    <GripVertical className="w-5 h-5" />
                    Ordem e Visibilidade das Colunas
                  </CardTitle>
                  {!editingColumns ? (
                    <Button onClick={startEditingColumns}>Editar Colunas</Button>
                  ) : (
                    <div className="flex gap-2">
                      <Button variant="ghost" onClick={() => setEditingColumns(null)}>Cancelar</Button>
                      <Button onClick={saveColumns} disabled={isSavingColumns}>
                        {isSavingColumns && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                        Salvar
                      </Button>
                    </div>
                  )}
                </div>
              </CardHeader>
              <CardContent>
                {!editingColumns ? (
                  <div className="space-y-3">
                    <p className="text-sm text-muted-foreground">Colunas ativas na tabela de leads:</p>
                    <div className="flex flex-wrap gap-2">
                      {columnConfig.filter(c => c.visible).map(c => (
                        <Badge key={c.key} variant="outline" className="flex items-center gap-1">
                          <Eye className="w-3 h-3" /> {c.label}
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
                    <p className="text-sm text-muted-foreground">Arraste para reordenar e alterne a visibilidade. A ordem aqui será refletida na tabela de leads.</p>
                    {editingColumns.map((col, idx) => (
                      <div
                        key={col.key}
                        draggable
                        onDragStart={() => handleColumnDragStart(idx)}
                        onDragOver={(e) => handleColumnDragOver(e, idx)}
                        onDragEnd={handleColumnDragEnd}
                        className={`flex items-center gap-3 p-3 border rounded-lg cursor-grab active:cursor-grabbing transition-colors ${dragIdx === idx ? 'bg-primary/10 border-primary/30' : 'hover:bg-muted/50'}`}
                      >
                        <GripVertical className="w-4 h-4 text-muted-foreground flex-shrink-0" />
                        <span className="flex-1 text-sm font-medium">{col.label}</span>
                        <span className="text-xs text-muted-foreground font-mono">{col.key}</span>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => toggleColumnVisibility(idx)}
                          className={col.visible ? 'text-green-500 hover:text-green-600' : 'text-muted-foreground hover:text-foreground'}
                        >
                          {col.visible ? <Eye className="w-4 h-4" /> : <EyeOff className="w-4 h-4" />}
                        </Button>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Seller Leads Column Configuration */}
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="flex items-center gap-2">
                      <Eye className="w-5 h-5" />
                      Colunas do Meus Leads (Vendedores)
                    </CardTitle>
                    <p className="text-sm text-muted-foreground mt-1">Configure quais colunas e em qual ordem aparecem no modal "Meus Leads" dos vendedores</p>
                  </div>
                  {!editingSellerColumns ? (
                    <Button onClick={startEditingSellerColumns}>Editar Colunas</Button>
                  ) : (
                    <div className="flex gap-2">
                      <Button variant="ghost" onClick={() => setEditingSellerColumns(null)}>Cancelar</Button>
                      <Button onClick={saveSellerColumns} disabled={isSavingSellerColumns}>
                        {isSavingSellerColumns && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                        Salvar
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
                        <Badge key={c.key} variant="outline" className="flex items-center gap-1">
                          <Eye className="w-3 h-3" /> {c.label}
                        </Badge>
                      ))}
                      {sellerColumnConfig.filter(c => !c.visible).map(c => (
                        <Badge key={c.key} variant="outline" className="flex items-center gap-1 opacity-40">
                          <EyeOff className="w-3 h-3" /> {c.label}
                        </Badge>
                      ))}
                    </div>
                  </div>
                ) : (
                  <div className="space-y-2">
                    <p className="text-sm text-muted-foreground">Arraste para reordenar e alterne a visibilidade. Vendedores verão apenas as colunas visíveis nesta ordem.</p>
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
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => toggleSellerColumnVisibility(idx)}
                          className={col.visible ? 'text-green-500 hover:text-green-600' : 'text-muted-foreground hover:text-foreground'}
                        >
                          {col.visible ? <Eye className="w-4 h-4" /> : <EyeOff className="w-4 h-4" />}
                        </Button>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </DashboardLayout>
  );
}
