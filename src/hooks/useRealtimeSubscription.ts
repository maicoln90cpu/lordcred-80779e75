import { useEffect, useRef, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { RealtimePostgresChangesPayload } from '@supabase/supabase-js';

type EventType = 'INSERT' | 'UPDATE' | 'DELETE' | '*';

interface UseRealtimeOptions {
  /** Table to subscribe to */
  table: string;
  /** Schema (default: 'public') */
  schema?: string;
  /** Event type filter (default: '*') */
  event?: EventType;
  /** PostgREST filter string, e.g. "user_id=eq.abc123" */
  filter?: string;
  /** Debounce interval in ms (default: 0 = no debounce) */
  debounceMs?: number;
  /** Unique channel name suffix (auto-generated if omitted) */
  channelSuffix?: string;
  /** Whether the subscription is active (default: true) */
  enabled?: boolean;
}

/**
 * Generic hook for Supabase Realtime postgres_changes subscriptions.
 * Handles channel lifecycle, optional debouncing, and cleanup.
 *
 * Usage:
 * ```ts
 * useRealtimeSubscription(
 *   (payload) => { console.log(payload.new); },
 *   { table: 'conversations', event: 'UPDATE', filter: `chip_id=eq.${chipId}`, debounceMs: 500 }
 * );
 * ```
 */
export function useRealtimeSubscription<T extends Record<string, any> = any>(
  onEvent: (payload: RealtimePostgresChangesPayload<T>) => void,
  options: UseRealtimeOptions
) {
  const {
    table,
    schema = 'public',
    event = '*',
    filter,
    debounceMs = 0,
    channelSuffix,
    enabled = true,
  } = options;

  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const stableCallback = useCallback(
    (payload: RealtimePostgresChangesPayload<T>) => {
      if (debounceMs > 0) {
        if (debounceRef.current) clearTimeout(debounceRef.current);
        debounceRef.current = setTimeout(() => onEvent(payload), debounceMs);
      } else {
        onEvent(payload);
      }
    },
    [onEvent, debounceMs]
  );

  useEffect(() => {
    if (!enabled) return;

    const channelName = `rt-${table}-${channelSuffix || event}-${filter || 'all'}-${Date.now()}`;
    
    const channelConfig: any = {
      event,
      schema,
      table,
    };
    if (filter) channelConfig.filter = filter;

    const channel = supabase
      .channel(channelName)
      .on('postgres_changes', channelConfig, stableCallback)
      .subscribe();

    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
      supabase.removeChannel(channel);
    };
  }, [table, schema, event, filter, channelSuffix, enabled, stableCallback]);
}
