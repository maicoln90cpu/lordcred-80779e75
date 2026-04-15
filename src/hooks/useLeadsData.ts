import { useMemo, useState, useCallback } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

export interface StatusOption {
  value: string;
  label: string;
  color_class: string;
}

export interface ProfileOption {
  value: string;
  label: string;
  color_class: string;
}

export interface ColumnConfig {
  key: string;
  label: string;
  visible: boolean;
  aliases?: string[];
  isCustom?: boolean;
}

export const DEFAULT_STATUS_OPTIONS: StatusOption[] = [
  { value: 'pendente', label: 'Pendente', color_class: 'bg-muted text-muted-foreground hover:bg-muted/80' },
  { value: 'CHAMEI', label: 'Chamei', color_class: 'bg-blue-500/20 text-blue-400 hover:bg-blue-500/30' },
  { value: 'NÃO ATENDEU', label: 'Não Atendeu', color_class: 'bg-yellow-500/20 text-yellow-400 hover:bg-yellow-500/30' },
  { value: 'NÃO EXISTE', label: 'Não Existe', color_class: 'bg-red-500/20 text-red-400 hover:bg-red-500/30' },
  { value: 'APROVADO', label: 'Aprovado', color_class: 'bg-green-500/20 text-green-400 hover:bg-green-500/30' },
];

export const DEFAULT_PROFILE_OPTIONS: ProfileOption[] = [
  { value: 'CLT', label: 'CLT', color_class: 'bg-blue-500/20 text-blue-400 hover:bg-blue-500/30' },
  { value: 'CLT Clientes', label: 'CLT Clientes', color_class: 'bg-green-500/20 text-green-400 hover:bg-green-500/30' },
  { value: 'FGTS', label: 'FGTS', color_class: 'bg-purple-500/20 text-purple-400 hover:bg-purple-500/30' },
  { value: 'FGTS Clientes', label: 'FGTS Clientes', color_class: 'bg-orange-500/20 text-orange-400 hover:bg-orange-500/30' },
];

export const ALL_COLUMNS: ColumnConfig[] = [
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

export const SELLER_LEADS_COLUMNS: ColumnConfig[] = [
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

export const COLOR_HEX_PRESETS = [
  '#6b7280', '#3b82f6', '#eab308', '#ef4444', '#10b981',
  '#8b5cf6', '#ec4899', '#f97316', '#06b6d4', '#14b8a6',
];

export const hexToColorClass = (hex: string) => `hex:${hex}`;

export const extractHex = (colorClass: string): string | null => {
  if (colorClass.startsWith('hex:')) return colorClass.slice(4);
  const match = colorClass.match(/#[0-9a-fA-F]{6}/);
  return match ? match[0] : null;
};

export function useLeadsData() {
  const { data: allLeads = [] } = useQuery({
    queryKey: ['admin-leads-metrics'],
    queryFn: async () => {
      const allData: any[] = [];
      let from = 0;
      const batchSize = 1000;
      while (true) {
        const { data, error } = await supabase.from('client_leads')
          .select('status, batch_name, assigned_to, created_at, contacted_at, perfil, banco_simulado')
          .range(from, from + batchSize - 1);
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
      const { data } = await supabase.rpc('get_visible_profiles');
      return (data || []) as unknown as { user_id: string; name: string; email: string }[];
    }
  });

  const getSellerName = useCallback((userId: string) => {
    const s = sellers.find((s: any) => s.user_id === userId);
    return s?.name || s?.email || 'N/A';
  }, [sellers]);

  const { data: statusOptions = DEFAULT_STATUS_OPTIONS } = useQuery({
    queryKey: ['lead-status-options'],
    queryFn: async () => {
      const { data } = await supabase.from('system_settings').select('lead_status_options').maybeSingle();
      if (data?.lead_status_options && Array.isArray(data.lead_status_options)) return data.lead_status_options as unknown as StatusOption[];
      return DEFAULT_STATUS_OPTIONS;
    }
  });

  const { data: profileOptions = DEFAULT_PROFILE_OPTIONS } = useQuery({
    queryKey: ['lead-profile-options'],
    queryFn: async () => {
      const { data } = await supabase.from('system_settings').select('lead_profile_options').maybeSingle();
      if (data?.lead_profile_options && Array.isArray(data.lead_profile_options)) return data.lead_profile_options as unknown as ProfileOption[];
      return DEFAULT_PROFILE_OPTIONS;
    }
  });

  return { allLeads, sellers, getSellerName, statusOptions, profileOptions };
}
