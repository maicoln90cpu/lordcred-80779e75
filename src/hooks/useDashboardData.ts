import { useState, useCallback, useMemo } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';

interface Chip {
  id: string;
  slot_number: number;
  instance_name: string;
  phone_number: string | null;
  status: string;
  activated_at: string | null;
  messages_sent_today?: number;
  user_id?: string;
  warming_phase?: string;
}

interface Message {
  id: string;
  created_at: string;
  direction: string;
}

interface SystemSettings {
  id: string;
  is_warming_active: boolean;
  messages_day_novo: number;
  messages_day_1_3: number;
  messages_day_4_7: number;
  messages_day_aquecido: number;
  messages_day_8_plus: number;
}

interface ChipStats {
  total: number;
  connected: number;
  disconnected: number;
}

interface MessageStats {
  today: number;
  week: number;
  month: number;
}

export function useDashboardData() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [chipStats, setChipStats] = useState<ChipStats>({ total: 0, connected: 0, disconnected: 0 });
  const [messageStats, setMessageStats] = useState<MessageStats>({ today: 0, week: 0, month: 0 });
  const [chips, setChips] = useState<Chip[]>([]);
  const [recentMessages, setRecentMessages] = useState<Message[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [settings, setSettings] = useState<SystemSettings | null>(null);
  const [isTogglingWarming, setIsTogglingWarming] = useState(false);
  const [isRunningManual, setIsRunningManual] = useState(false);
  const [queueCount, setQueueCount] = useState(0);

  const updateChipsFromRealtime = useCallback((updatedChips: Chip[]) => {
    const filteredChips = updatedChips.filter(c => c.user_id === user?.id);
    setChips(filteredChips);
    setChipStats({
      total: filteredChips.length,
      connected: filteredChips.filter(c => c.status === 'connected').length,
      disconnected: filteredChips.filter(c => c.status !== 'connected').length,
    });
  }, [user?.id]);

  // Sparkline agora vem direto da RPC (7 dias agregados no Postgres),
  // não precisamos mais carregar mensagens individuais.
  const [sparklineFromRpc, setSparklineFromRpc] = useState<{ date: string; count: number }[]>([]);

  const fetchData = useCallback(async () => {
    if (!user) return;
    try {
      // 3 chamadas em paralelo: chip summary (RPC), message stats (RPC) e settings.
      const [chipSummaryRes, msgStatsRes, settingsRes] = await Promise.all([
        supabase.rpc('dashboard_chip_summary', { p_user_id: user.id }),
        supabase.rpc('dashboard_message_stats', { p_user_id: user.id }),
        supabase.from('system_settings').select('id, is_warming_active, messages_day_novo, messages_day_1_3, messages_day_4_7, messages_day_aquecido, messages_day_8_plus').maybeSingle(),
      ]);

      // Chip summary
      if (chipSummaryRes.data && !chipSummaryRes.error) {
        const summary = chipSummaryRes.data as any;
        const chipsData = (summary.chips || []) as Chip[];
        setChips(chipsData);
        setChipStats({
          total: summary.stats?.total || 0,
          connected: summary.stats?.connected || 0,
          disconnected: summary.stats?.disconnected || 0,
        });
        setQueueCount(summary.queue_pending || 0);
      } else if (chipSummaryRes.error) {
        console.error('dashboard_chip_summary error:', chipSummaryRes.error);
      }

      // Message stats + sparkline
      if (msgStatsRes.data && !msgStatsRes.error) {
        const stats = msgStatsRes.data as any;
        setMessageStats({
          today: stats.today || 0,
          week: stats.week || 0,
          month: stats.month || 0,
        });
        setSparklineFromRpc(stats.sparkline || []);
        // recentMessages mantido vazio — a RPC já entrega o sparkline pronto
        setRecentMessages([]);
      } else if (msgStatsRes.error) {
        console.error('dashboard_message_stats error:', msgStatsRes.error);
      }

      // Settings
      if (settingsRes.data) setSettings(settingsRes.data);
    } catch (error) {
      console.error('Error fetching dashboard data:', error);
    } finally {
      setIsLoading(false);
    }
  }, [user]);

  const toggleWarming = async () => {
    if (!settings?.id) {
      toast({ title: 'Configurações não encontradas', description: 'Aguarde um momento e tente novamente.', variant: 'destructive' });
      return;
    }
    if (chipStats.connected === 0) {
      toast({ title: 'Nenhum chip conectado', description: 'Conecte pelo menos um chip antes de iniciar o aquecimento.', variant: 'destructive' });
      return;
    }
    setIsTogglingWarming(true);
    try {
      const newState = !settings.is_warming_active;
      const { error, data } = await supabase.from('system_settings').update({ is_warming_active: newState } as any).eq('id', settings.id).select('id, is_warming_active').maybeSingle();
      if (error) {
        if (error.code === '42501' || error.message?.includes('permission')) throw new Error('Sem permissão para alterar esta configuração.');
        throw error;
      }
      if (!data) throw new Error('Não foi possível atualizar.');
      setSettings({ ...settings, is_warming_active: newState });
      toast({ title: newState ? '✅ Aquecimento ativado' : '⏸️ Aquecimento pausado' });
    } catch (error: any) {
      toast({ title: 'Não foi possível alterar o aquecimento', description: error?.message, variant: 'destructive' });
    } finally {
      setIsTogglingWarming(false);
    }
  };

  const runManualWarming = async () => {
    if (chipStats.connected === 0) { toast({ title: 'Nenhum chip conectado', variant: 'destructive' }); return; }
    setIsRunningManual(true);
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData?.session?.access_token;
      if (!token) { toast({ title: 'Sessão expirada', variant: 'destructive' }); return; }
      const response = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/warming-engine`, { method: 'POST', headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` } });
      if (!response.ok) throw new Error(`Erro do servidor (${response.status})`);
      const result = await response.json();
      if (result.messagesSent > 0) { toast({ title: '✅ Aquecimento executado', description: `${result.messagesSent} mensagem(ns) enviada(s)` }); fetchData(); }
      else { toast({ title: 'Nenhuma mensagem enviada', description: result.message || 'Chips atingiram limite ou fora do horário.' }); }
    } catch (error: any) {
      toast({ title: 'Erro ao executar aquecimento', description: error?.message, variant: 'destructive' });
    } finally {
      setIsRunningManual(false);
    }
  };

  const sparklineData = useMemo(() => {
    if (recentMessages.length === 0) return [];
    const days: Record<string, number> = {};
    const now = new Date();
    for (let i = 6; i >= 0; i--) { const d = new Date(now); d.setDate(d.getDate() - i); days[d.toISOString().slice(0, 10)] = 0; }
    recentMessages.forEach(m => { const key = m.created_at.slice(0, 10); if (days[key] !== undefined) days[key]++; });
    return Object.entries(days).map(([date, count]) => ({ date, count }));
  }, [recentMessages]);

  const getMessageLimit = (phase: string) => {
    if (!settings) return 50;
    switch (phase) {
      case 'novo': return settings.messages_day_novo;
      case 'iniciante': return settings.messages_day_1_3;
      case 'crescimento': return settings.messages_day_4_7;
      case 'aquecido': return settings.messages_day_aquecido;
      case 'maduro': return settings.messages_day_8_plus;
      default: return settings.messages_day_novo;
    }
  };

  return {
    chipStats, messageStats, chips, recentMessages, isLoading, settings,
    isTogglingWarming, isRunningManual, queueCount, sparklineData,
    updateChipsFromRealtime, fetchData, toggleWarming, runManualWarming,
    getMessageLimit, setChips, setChipStats,
  };
}
