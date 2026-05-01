import { useState, useEffect, useCallback } from 'react';
import { Clock, AlertTriangle, FileText } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { supabase } from '@/integrations/supabase/client';

interface Window24hBadgeProps {
  chipId: string;
  remoteJid: string;
  /** Provider of the chip — only renders for 'meta' */
  provider?: string;
  /** Called when window state changes */
  onWindowStateChange?: (expired: boolean) => void;
}

export default function Window24hBadge({ chipId, remoteJid, provider, onWindowStateChange }: Window24hBadgeProps) {
  const [remainingMs, setRemainingMs] = useState<number | null>(null);
  const [lastIncomingAt, setLastIncomingAt] = useState<Date | null>(null);

  const WINDOW_MS = 24 * 60 * 60 * 1000;

  const fetchLastIncoming = useCallback(async () => {
    if (!chipId || !remoteJid) return;

    // Normalize phone from remoteJid
    const phone = remoteJid.split('@')[0];

    const { data } = await supabase
      .from('message_history')
      .select('created_at')
      .eq('chip_id', chipId)
      .eq('direction', 'incoming')
      .or(`remote_jid.ilike.%${phone}%,recipient_phone.ilike.%${phone}%`)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (data?.created_at) {
      setLastIncomingAt(new Date(data.created_at));
    } else {
      setLastIncomingAt(null);
      setRemainingMs(0);
    }
  }, [chipId, remoteJid]);

  useEffect(() => {
    fetchLastIncoming();
    // Re-check when new messages arrive
    const channel = supabase
      .channel(`window24h-${chipId}-${remoteJid}`)
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'message_history',
        filter: `chip_id=eq.${chipId}`,
      }, (payload) => {
        if ((payload.new as any)?.direction === 'incoming') {
          setLastIncomingAt(new Date((payload.new as any).created_at));
        }
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [chipId, remoteJid, fetchLastIncoming]);

  // Countdown timer
  useEffect(() => {
    if (!lastIncomingAt) return;

    const update = () => {
      const elapsed = Date.now() - lastIncomingAt.getTime();
      const remaining = Math.max(0, WINDOW_MS - elapsed);
      setRemainingMs(remaining);
    };

    update();
    const interval = setInterval(update, 1000);
    return () => clearInterval(interval);
  }, [lastIncomingAt]);

  // Notify parent of state change
  useEffect(() => {
    if (remainingMs === null) return;
    onWindowStateChange?.(remainingMs <= 0);
  }, [remainingMs, onWindowStateChange]);

  // Only render for Meta chips
  if (provider !== 'meta') return null;
  if (remainingMs === null) return null;

  const expired = remainingMs <= 0;
  const hours = Math.floor(remainingMs / (1000 * 60 * 60));
  const minutes = Math.floor((remainingMs % (1000 * 60 * 60)) / (1000 * 60));
  const seconds = Math.floor((remainingMs % (1000 * 60)) / 1000);
  const urgent = !expired && remainingMs < 2 * 60 * 60 * 1000; // < 2h

  const timeStr = expired
    ? 'Expirada'
    : hours > 0
      ? `${hours}h ${minutes}m`
      : `${minutes}m ${seconds}s`;

  return (
    <Badge
      variant="outline"
      className={cn(
        'gap-1 text-[10px] font-mono transition-colors',
        expired
          ? 'border-destructive/50 bg-destructive/10 text-destructive'
          : urgent
            ? 'border-orange-400/50 bg-orange-400/10 text-orange-400 animate-pulse'
            : 'border-green-400/50 bg-green-400/10 text-green-400'
      )}
    >
      {expired ? (
        <>
          <AlertTriangle className="w-3 h-3" />
          Janela 24h expirada
        </>
      ) : (
        <>
          <Clock className="w-3 h-3" />
          {timeStr}
        </>
      )}
    </Badge>
  );
}
