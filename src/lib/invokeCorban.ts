import { supabase } from '@/integrations/supabase/client';

export interface CorbanResult<T = any> {
  data: T | null;
  error: string | null;
}

export async function invokeCorban<T = any>(
  action: string,
  params?: Record<string, unknown>
): Promise<CorbanResult<T>> {
  try {
    const { data, error } = await supabase.functions.invoke('corban-api', {
      body: { action, params },
    });

    if (error) {
      return { data: null, error: error.message || 'Erro ao chamar API Corban' };
    }

    if (data?.error) {
      return { data: null, error: data.error };
    }

    return { data: data?.data as T, error: null };
  } catch (err: any) {
    return { data: null, error: err.message || 'Erro inesperado' };
  }
}
