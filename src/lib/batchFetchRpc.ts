import { supabase } from '@/integrations/supabase/client';

/**
 * Batch-fetch all rows from an RPC that may return >1000 rows.
 * Uses .range() pagination to bypass PostgREST default limit.
 */
export async function batchFetchRpc<T = any>(
  rpcName: string,
  params: Record<string, any>,
  pageSize = 1000
): Promise<T[]> {
  let allResults: T[] = [];
  let from = 0;

  while (true) {
    const { data, error } = await (supabase.rpc as any)(rpcName, params)
      .range(from, from + pageSize - 1);
    if (error) throw error;
    if (!data || data.length === 0) break;
    allResults = allResults.concat(data);
    if (data.length < pageSize) break;
    from += pageSize;
  }

  return allResults;
}
