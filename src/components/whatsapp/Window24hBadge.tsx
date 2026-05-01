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

  const fetchLastWindowOpener = useCallback(async () => {
    if (!chipId || !remoteJid) return;

    const phone = remoteJid.split('@')[0];

    // Window opens on: incoming message OR outgoing template (Meta rule 2024+)
    // Query both and use the most recent
    const [incomingRes, templateRes] = await Promise.all([
      supabase
        .from('message_history')
        .select('created_at')
        .eq('chip_id', chipId)
        .eq('direction', 'incoming')
        .or(`remote_jid.ilike.%${phone}%,recipient_phone.ilike.%${phone}%`)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle(),
      supabase
        .from('message_history')
        .select('created_at')
        .eq('chip_id', chipId)
        .eq('direction', 'outgoing')
        .ilike('message_content', '📋%')
        .or(`remote_jid.ilike.%${phone}%,recipient_phone.ilike.%${phone}%`)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle(),
    ]);

    const incomingDate = incomingRes.data?.created_at ? new Date(incomingRes.data.created_at) : null;
    const templateDate = templateRes.data?.created_at ? new Date(templateRes.data.created_at) : null;

    // Use the most recent between the two
    let latest: Date | null = null;
    if (incomingDate && templateDate) {
      latest = incomingDate > templateDate ? incomingDate : templateDate;
    } else {
      latest = incomingDate || templateDate;
    }

    if (latest) {
      setLastIncomingAt(latest);
    } else {
      setLastIncomingAt(null);
      setRemainingMs(0);
    }
  }, [chipId, remoteJid]);

  useEffect(() => {
    fetchLastWindowOpener();
    const channel = supabase
      .channel(`window24h-${chipId}-${remoteJid}`)
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'message_history',
        filter: `chip_id=eq.${chipId}`,
      }, (payload) => {
        const row = payload.new as any;
        // Window opens on incoming OR outgoing template
        if (row?.direction === 'incoming') {
          setLastIncomingAt(new Date(row.created_at));
        } else if (row?.direction === 'outgoing' && row?.message_content?.startsWith('📋')) {
          setLastIncomingAt(new Date(row.created_at));
        }
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [chipId, remoteJid, fetchLastWindowOpener]);

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
