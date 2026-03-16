import { supabase } from '@/integrations/supabase/client';

type InvokeOptions = {
  retries?: number;
  retryDelayMs?: number;
};

function isRetryableEdgeError(error: unknown): boolean {
  const text = String((error as any)?.message || error || '');
  return (
    text.includes('SUPABASE_EDGE_RUNTIME_ERROR') ||
    text.includes('503') ||
    text.toLowerCase().includes('failed to fetch') ||
    text.toLowerCase().includes('edge function returned')
  );
}

export async function invokeUazapiWithRetry<T = any>(
  body: Record<string, unknown>,
  options: InvokeOptions = {}
): Promise<{ data: T | null; error: any | null }> {
  const retries = options.retries ?? 2;
  const retryDelayMs = options.retryDelayMs ?? 300;

  let attempt = 0;
  let lastError: any = null;

  while (attempt <= retries) {
    const { data, error } = await supabase.functions.invoke('uazapi-api', { body });

    if (!error) {
      return { data: data as T, error: null };
    }

    lastError = error;
    if (attempt === retries || !isRetryableEdgeError(error)) {
      break;
    }

    const waitMs = retryDelayMs * Math.pow(2, attempt);
    await new Promise((resolve) => setTimeout(resolve, waitMs));
    attempt += 1;
  }

  return { data: null, error: lastError };
}
