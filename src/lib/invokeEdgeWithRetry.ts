import { supabase } from '@/integrations/supabase/client';

type InvokeOptions = {
  retries?: number;
  retryDelayMs?: number;
};

export interface InvokeResult<T> {
  data: T | null;
  error: any | null;
  isTransportError?: boolean;
}

function isRetryableError(error: unknown): boolean {
  const text = String((error as any)?.message || error || '');
  return (
    text.includes('SUPABASE_EDGE_RUNTIME_ERROR') ||
    text.includes('503') ||
    text.includes('502') ||
    text.includes('504') ||
    text.toLowerCase().includes('failed to fetch') ||
    text.toLowerCase().includes('edge function returned') ||
    text.toLowerCase().includes('network') ||
    text.toLowerCase().includes('load failed') ||
    text.toLowerCase().includes('aborted')
  );
}

export function isDisconnectError(result: InvokeResult<any>): boolean {
  if (!result.data && !result.error) return false;
  const errMsg = String(result.data?.error || result.error?.message || result.error || '').toLowerCase();
  return (
    errMsg.includes('disconnected') ||
    errMsg.includes('not connected') ||
    errMsg.includes('chip token not found') ||
    errMsg.includes('instance token not found')
  );
}

/**
 * Calls the whatsapp-gateway edge function (unified router).
 * The gateway automatically routes to UazAPI or Meta based on chip provider.
 */
export async function invokeGatewayWithRetry<T = any>(
  body: Record<string, unknown>,
  options: InvokeOptions = {}
): Promise<InvokeResult<T>> {
  const retries = options.retries ?? 2;
  const retryDelayMs = options.retryDelayMs ?? 300;

  let attempt = 0;
  let lastError: any = null;

  while (attempt <= retries) {
    try {
      const { data, error } = await supabase.functions.invoke('whatsapp-gateway', { body });

      if (!error) {
        return { data: data as T, error: null, isTransportError: false };
      }

      lastError = error;
      if (attempt === retries || !isRetryableError(error)) {
        return { data: null, error: lastError, isTransportError: isRetryableError(error) };
      }
    } catch (thrown: any) {
      lastError = thrown;
      if (attempt === retries || !isRetryableError(thrown)) {
        return { data: null, error: lastError, isTransportError: true };
      }
    }

    const waitMs = retryDelayMs * Math.pow(2, attempt);
    await new Promise((resolve) => setTimeout(resolve, waitMs));
    attempt += 1;
  }

  return { data: null, error: lastError, isTransportError: true };
}

/**
 * @deprecated Use invokeGatewayWithRetry instead. This is kept for backward compatibility
 * and now internally calls the whatsapp-gateway.
 */
export const invokeUazapiWithRetry = invokeGatewayWithRetry;
