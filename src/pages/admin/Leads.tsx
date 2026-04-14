import { useMemo, useState, useCallback } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import DashboardLayout from '@/components/layout/DashboardLayout';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent } from '@/components/ui/card';
import { Users, Clock, CheckCircle, XCircle, Settings2, BarChart3 } from 'lucide-react';
import LeadImporter, { DEFAULT_ALIASES, type ColumnAlias } from '@/components/admin/LeadImporter';
import LeadsTable from '@/components/admin/LeadsTable';
import LeadManagement from '@/components/admin/LeadManagement';
import BatchHistoryTab from '@/components/admin/BatchHistoryTab';
import LeadExportTab from '@/components/admin/LeadExportTab';
import LeadConfigTab from '@/components/admin/LeadConfigTab';

interface StatusOption { value: string; label: string; color_class: string; }
interface ProfileOption { value: string; label: string; color_class: string; }
interface ColumnConfig { key: string; label: string; visible: boolean; aliases?: string[]; isCustom?: boolean; }

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
  { key: 'assigned_at', label: 'Data Alteração', visible: false },
  { key: 'notes', label: 'Observações', visible: false },
];

export default function Leads() {
  // Filters lifted from LeadsTable for metrics
  const [filterSeller, setFilterSeller] = useState('all');
  const [filterStatus, setFilterStatus] = useState('all');
  const [filterBatch, setFilterBatch] = useState('all');
  const [filterProfile, setFilterProfile] = useState('all');
  const [filterBancoSimulado, setFilterBancoSimulado] = useState('all');

  const handleFiltersChange = useCallback((filters: { seller: string; status: string; batch: string; profile: string; bancoSimulado: string }) => {
    setFilterSeller(filters.seller);
    setFilterStatus(filters.status);
    setFilterBatch(filters.batch);
    setFilterProfile(filters.profile);
    setFilterBancoSimulado(filters.bancoSimulado);
  }, []);

  // ── Data queries ──
  const { data: statusOptions = DEFAULT_STATUS_OPTIONS } = useQuery({
    queryKey: ['lead-status-options'],
    queryFn: async () => {
      const { data } = await supabase.from('system_settings').select('lead_status_options').maybeSingle();
      return (data?.lead_status_options && Array.isArray(data.lead_status_options))
        ? data.lead_status_options as unknown as StatusOption[]
        : DEFAULT_STATUS_OPTIONS;
    }
  });

  const { data: profileOptions = DEFAULT_PROFILE_OPTIONS } = useQuery({
    queryKey: ['lead-profile-options'],
    queryFn: async () => {
      const { data } = await supabase.from('system_settings').select('lead_profile_options').maybeSingle();
      return (data?.lead_profile_options && Array.isArray(data.lead_profile_options))
        ? data.lead_profile_options as unknown as ProfileOption[]
        : DEFAULT_PROFILE_OPTIONS;
    }
  });

  const { data: columnConfig = ALL_COLUMNS } = useQuery({
    queryKey: ['lead-table-columns', 'lead-column-aliases'],
    queryFn: async () => {
      const { data } = await supabase.from('system_settings').select('lead_table_columns, lead_column_aliases').maybeSingle();
      let saved: ColumnConfig[] = (data?.lead_table_columns && Array.isArray(data.lead_table_columns))
        ? data.lead_table_columns as unknown as ColumnConfig[]
        : [...ALL_COLUMNS];
      const aliases = (data as any)?.lead_column_aliases as ColumnAlias[] | undefined;
      if (aliases && Array.isArray(aliases)) {
        const nativeKeys = new Set(ALL_COLUMNS.map(c => c.key));
        const savedKeys = new Set(saved.map(c => c.key));
        aliases.forEach(a => {
          if (!nativeKeys.has(a.key) && !savedKeys.has(a.key)) {
            saved.push({ key: a.key, label: a.system_label, visible: true, isCustom: true, aliases: a.aliases });
          }
        });
      }
      const savedKeys = new Set(saved.map(c => c.key));
      const newCols = ALL_COLUMNS.filter(c => !savedKeys.has(c.key));
      return newCols.length > 0 ? [...saved, ...newCols] : saved;
    }
  });

  const { data: sellerColumnConfig = SELLER_LEADS_COLUMNS } = useQuery({
    queryKey: ['seller-leads-columns'],
    queryFn: async () => {
      const { data } = await supabase.from('system_settings').select('seller_leads_columns, lead_column_aliases').maybeSingle();
      let saved: ColumnConfig[] = (data && (data as any).seller_leads_columns && Array.isArray((data as any).seller_leads_columns))
        ? (data as any).seller_leads_columns as ColumnConfig[]
        : [...SELLER_LEADS_COLUMNS];
      const aliases = (data as any)?.lead_column_aliases as ColumnAlias[] | undefined;
      if (aliases && Array.isArray(aliases)) {
        const nativeKeys = new Set(SELLER_LEADS_COLUMNS.map(c => c.key));
        const savedKeys = new Set(saved.map(c => c.key));
        aliases.forEach(a => {
          if (!nativeKeys.has(a.key) && !savedKeys.has(a.key)) {
            saved.push({ key: a.key, label: a.system_label, visible: false, isCustom: true });
          }
        });
      }
      const savedKeys = new Set(saved.map(c => c.key));
      const newCols = SELLER_LEADS_COLUMNS.filter(c => !savedKeys.has(c.key));
      return newCols.length > 0 ? [...saved, ...newCols] : saved;
    }
  });

  const { data: columnAliases = DEFAULT_ALIASES } = useQuery({
    queryKey: ['lead-column-aliases'],
    queryFn: async () => {
      const { data } = await supabase.from('system_settings').select('lead_column_aliases').maybeSingle();
      if (data && (data as any).lead_column_aliases && Array.isArray((data as any).lead_column_aliases)) {
        const saved = (data as any).lead_column_aliases as ColumnAlias[];
        const savedKeys = new Set(saved.map(a => a.key));
        const newAliases = DEFAULT_ALIASES.filter(a => !savedKeys.has(a.key));
        return newAliases.length > 0 ? [...saved, ...newAliases] : saved;
      }
      return DEFAULT_ALIASES;
    }
  });

  const { data: allLeads = [] } = useQuery({
    queryKey: ['admin-leads-metrics'],
    queryFn: async () => {
      const allData: any[] = [];
      let from = 0;
      const batchSize = 1000;
      while (true) {
        const { data, error } = await supabase.from('client_leads').select('status, batch_name, assigned_to, created_at, contacted_at, perfil, banco_simulado').range(from, from + batchSize - 1);
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

  const getSellerName = useCallback((userId: string) => {
    const s = sellers.find((s: any) => s.user_id === userId);
    return s?.name || s?.email || 'N/A';
  }, [sellers]);

  // ── Filtered metrics ──
  const filteredLeadsForMetrics = useMemo(() => {
    let result = [...allLeads];
    if (filterSeller !== 'all') result = result.filter((l: any) => l.assigned_to === filterSeller);
    if (filterStatus !== 'all') result = result.filter((l: any) => l.status === filterStatus);
    if (filterBatch !== 'all') result = result.filter((l: any) => l.batch_name === filterBatch);
    if (filterProfile === '__none__') result = result.filter((l: any) => !l.perfil);
    else if (filterProfile !== 'all') result = result.filter((l: any) => l.perfil === filterProfile);
    if (filterBancoSimulado !== 'all') result = result.filter((l: any) => l.banco_simulado === filterBancoSimulado);
    return result;
  }, [allLeads, filterSeller, filterStatus, filterBatch, filterProfile, filterBancoSimulado]);

  const metrics = useMemo(() => {
    const total = filteredLeadsForMetrics.length;
    const pendentes = filteredLeadsForMetrics.filter((l: any) => l.status === 'pendente').length;
    const contatados = filteredLeadsForMetrics.filter((l: any) => l.status !== 'pendente').length;
    const aprovados = filteredLeadsForMetrics.filter((l: any) => l.status === 'APROVADO').length;
    const taxaAprovacao = total > 0 ? Math.round((aprovados / total) * 100) : 0;
    return { total, pendentes, contatados, aprovados, taxaAprovacao };
  }, [filteredLeadsForMetrics]);

  return (
    <DashboardLayout>
      <div className="space-y-6 min-w-0">
        <div>
          <h1 className="text-3xl font-bold">Gestão de Leads</h1>
          <p className="text-muted-foreground">Importe planilhas e atribua leads aos vendedores</p>
        </div>

        {/* Metrics */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Card><CardContent className="pt-4 pb-3">
            <div className="flex items-center gap-2 text-muted-foreground text-sm"><Users className="w-4 h-4" /> Total</div>
            <p className="text-2xl font-bold mt-1">{metrics.total}</p>
          </CardContent></Card>
          <Card><CardContent className="pt-4 pb-3">
            <div className="flex items-center gap-2 text-muted-foreground text-sm"><Clock className="w-4 h-4" /> Pendentes</div>
            <p className="text-2xl font-bold mt-1">{metrics.pendentes}</p>
          </CardContent></Card>
          <Card><CardContent className="pt-4 pb-3">
            <div className="flex items-center gap-2 text-muted-foreground text-sm"><CheckCircle className="w-4 h-4" /> Contatados</div>
            <p className="text-2xl font-bold mt-1">{metrics.contatados}</p>
          </CardContent></Card>
          <Card><CardContent className="pt-4 pb-3">
            <div className="flex items-center gap-2 text-muted-foreground text-sm"><XCircle className="w-4 h-4" /> Aprovados</div>
            <p className="text-2xl font-bold mt-1">{metrics.aprovados} <span className="text-sm text-muted-foreground font-normal">({metrics.taxaAprovacao}%)</span></p>
          </CardContent></Card>
        </div>

        <Tabs defaultValue="leads" className="space-y-4 min-w-0">
          <TabsList className="flex-wrap">
            <TabsTrigger value="leads">Leads</TabsTrigger>
            <TabsTrigger value="management" className="flex items-center gap-1"><BarChart3 className="w-3.5 h-3.5" /> Gerenciamento</TabsTrigger>
            <TabsTrigger value="import">Importar Planilha</TabsTrigger>
            <TabsTrigger value="export">Backup / Exportar</TabsTrigger>
            <TabsTrigger value="batches">Histórico de Lotes</TabsTrigger>
            <TabsTrigger value="status-config" className="flex items-center gap-1"><Settings2 className="w-3.5 h-3.5" /> Configurações da Planilha</TabsTrigger>
          </TabsList>

          <TabsContent value="leads" className="min-w-0">
            <LeadsTable
              filterSeller={filterSeller} filterStatus={filterStatus} filterBatch={filterBatch}
              filterProfile={filterProfile} filterBancoSimulado={filterBancoSimulado}
              onFiltersChange={handleFiltersChange}
              statusOptions={statusOptions} columnConfig={columnConfig}
              profileOptions={profileOptions} columnAliases={columnAliases}
            />
          </TabsContent>

          <TabsContent value="management">
            <LeadManagement statusOptions={statusOptions} profileOptions={profileOptions} />
          </TabsContent>

          <TabsContent value="import">
            <LeadImporter />
          </TabsContent>

          <TabsContent value="export">
            <LeadExportTab />
          </TabsContent>

          <TabsContent value="batches">
            <BatchHistoryTab allLeads={allLeads} getSellerName={getSellerName} />
          </TabsContent>

          <TabsContent value="status-config">
            <LeadConfigTab
              statusOptions={statusOptions} profileOptions={profileOptions}
              columnConfig={columnConfig} sellerColumnConfig={sellerColumnConfig}
              columnAliases={columnAliases}
            />
          </TabsContent>
        </Tabs>
      </div>
    </DashboardLayout>
  );
}
