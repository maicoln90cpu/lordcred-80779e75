import { useCallback, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';

export interface V8OperationSummary {
  operationId: string;
  issueAmount: string | null;
  disbursedIssueAmount: string | null;
  documentNumber: string | null;
  contractNumber: string | null;
  name: string | null;
  partnerId: string | null;
  partnerInternalId: string | null;
  status: string | null;
  history: Array<{
    id: string;
    action: string;
    description: string;
    reason: string;
    created_at: string;
  }>;
  createdAt: string | null;
}

export interface V8ConsultSummary {
  consultId: string;
  status: string | null;
  name: string | null;
  documentNumber: string | null;
  title: string | null;
  detail: string | null;
  createdAt: string | null;
  raw: any;
}

export interface V8OperationDetail {
  id: string;
  status: string | null;
  document_number: string | null;
  partner_id: string | null;
  partner_internal_id: string | null;
  created_at: string | null;
  updated_at: string | null;
  contract_number: string | null;
  contract_url: string | null;
  borrower?: {
    name?: string;
    email?: string;
    document_number?: string;
    birth_date?: string;
    borrower_phone?: {
      number?: string;
      area_code?: string;
      country_code?: string;
    };
  };
  operation_data?: {
    operation_amount?: string;
    disbursed_issue_amount?: string;
    issue_amount?: string;
    first_due_date?: string;
    number_of_installments?: number;
    monthly_interest_rate?: string;
    installment_face_value?: string;
  };
  operation_history?: Array<{
    id: string;
    action: string;
    description: string;
    reason: string;
    created_at: string;
  }>;
  provider?: string;
}

interface ListOperationsParams {
  startDate: string;
  endDate: string;
  limit?: number;
  page?: number;
}

export function useV8Operations() {
  const [operations, setOperations] = useState<V8OperationSummary[]>([]);
  const [consults, setConsults] = useState<V8ConsultSummary[]>([]);
  const [loading, setLoading] = useState(false);
  const [detailLoading, setDetailLoading] = useState(false);
  const [selectedOperation, setSelectedOperation] = useState<V8OperationDetail | null>(null);

  const loadOperations = useCallback(async ({ startDate, endDate, limit = 200, page = 1 }: ListOperationsParams) => {
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('v8-clt-api', {
        body: {
          action: 'list_operations',
          params: { startDate, endDate, limit, page, provider: 'QI' },
        },
      });

      if (error) throw error;
      if (!data?.success) throw new Error(data?.user_message || data?.title || data?.detail || data?.message || data?.error || 'Falha ao consultar propostas');

      setOperations(Array.isArray(data.data) ? (data.data as V8OperationSummary[]) : []);
      return { success: true, total: Array.isArray(data.data) ? data.data.length : 0 };
    } catch (err: any) {
      setOperations([]);
      return { success: false, error: err?.message || String(err) };
    } finally {
      setLoading(false);
    }
  }, []);

  const loadOperationDetail = useCallback(async (operationId: string) => {
    setDetailLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('v8-clt-api', {
        body: {
          action: 'get_operation',
          params: { operationId },
        },
      });

      if (error) throw error;
      if (!data?.success) throw new Error(data?.user_message || data?.title || data?.detail || data?.message || data?.error || 'Falha ao carregar detalhes da operação');

      setSelectedOperation((data.data ?? null) as V8OperationDetail | null);
      return { success: true };
    } catch (err: any) {
      setSelectedOperation(null);
      return { success: false, error: err?.message || String(err) };
    } finally {
      setDetailLoading(false);
    }
  }, []);

  const loadConsults = useCallback(async ({ startDate, endDate, limit = 200, page = 1, search = '' }: ListOperationsParams & { search?: string }) => {
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('v8-clt-api', {
        body: {
          action: 'list_consults',
          params: { startDate, endDate, limit, page, provider: 'QI', documentNumber: search, search },
        },
      });

      if (error) throw error;
      if (!data?.success) throw new Error(data?.user_message || data?.title || data?.detail || data?.message || data?.error || 'Falha ao consultar consultas ativas');

      setConsults(Array.isArray(data.data) ? (data.data as V8ConsultSummary[]) : []);
      return { success: true, total: Array.isArray(data.data) ? data.data.length : 0 };
    } catch (err: any) {
      setConsults([]);
      return { success: false, error: err?.message || String(err) };
    } finally {
      setLoading(false);
    }
  }, []);

  return {
    operations,
    consults,
    loading,
    detailLoading,
    selectedOperation,
    setSelectedOperation,
    loadOperations,
    loadConsults,
    loadOperationDetail,
  };
}