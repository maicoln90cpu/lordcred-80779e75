import { useState, useCallback, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/contexts/AuthContext';

export interface Chip {
  id: string;
  slot_number: number;
  instance_name: string;
  phone_number: string | null;
  status: string;
  activated_at: string | null;
  messages_sent_today?: number;
  warming_phase?: string;
  nickname?: string | null;
}

export interface ChipSystemSettings {
  start_hour: number;
  end_hour: number;
  messages_day_novo: number;
  messages_day_1_3: number;
  messages_day_4_7: number;
  messages_day_aquecido: number;
  messages_day_8_plus: number;
  whatsapp_provider?: string;
}

export function useChipsManager() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [chips, setChips] = useState<Chip[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [settings, setSettings] = useState<ChipSystemSettings | null>(null);
  const [qrDialogOpen, setQrDialogOpen] = useState(false);
  const [selectedSlot, setSelectedSlot] = useState<number | null>(null);
  const [selectedChip, setSelectedChip] = useState<Chip | null>(null);
  const [qrCode, setQrCode] = useState<string | null>(null);
  const [isConnecting, setIsConnecting] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [chipToDelete, setChipToDelete] = useState<Chip | null>(null);
  const [editingNickname, setEditingNickname] = useState<string | null>(null);
  const [nicknameValue, setNicknameValue] = useState('');
  const [isSyncingAll, setIsSyncingAll] = useState(false);
  const pollIntervalRef = useRef<number | null>(null);
  const lastSyncAllRef = useRef<number>(0);

  const getAuthToken = async () => {
    const { data } = await supabase.auth.getSession();
    return data?.session?.access_token;
  };

  const callProviderApi = async (action: string, data: Record<string, unknown> = {}) => {
    const token = await getAuthToken();
    if (!token) throw new Error('Sessão expirada');
    const response = await fetch(
      `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/uazapi-api`,
      { method: 'POST', headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` }, body: JSON.stringify({ action, ...data }) }
    );
    const result = await response.json();
    if (!response.ok) throw new Error(result.error || 'Erro na API do provedor');
    return result;
  };

  const fetchChips = useCallback(async () => {
    if (!user) return;
    try {
      const query = supabase.from('chips').select('*').eq('user_id', user.id).order('slot_number');
      const { data, error } = await (query as any).eq('chip_type', 'warming');
      if (error) throw error;
      setChips(data || []);
    } catch (error) {
      console.error('Error fetching chips:', error);
    } finally {
      setIsLoading(false);
    }
  }, [user]);

  const fetchSettings = useCallback(async () => {
    const { data } = await supabase.from('system_settings').select('start_hour, end_hour, messages_day_novo, messages_day_1_3, messages_day_4_7, messages_day_aquecido, messages_day_8_plus, whatsapp_provider').limit(1).single();
    if (data) setSettings(data as unknown as ChipSystemSettings);
  }, []);

  const handleNicknameSave = async (chipId: string) => {
    try {
      const { error } = await supabase.from('chips').update({ nickname: nicknameValue.trim() || null } as any).eq('id', chipId);
      if (error) throw error;
      setChips(prev => prev.map(c => c.id === chipId ? { ...c, nickname: nicknameValue.trim() || null } : c));
      toast({ title: 'Nome atualizado' });
    } catch (error) {
      toast({ title: 'Erro ao salvar nome', variant: 'destructive' });
    } finally {
      setEditingNickname(null);
    }
  };

  const handlePhaseChange = async (chipId: string, newPhase: string) => {
    try {
      const { error } = await supabase.from('chips').update({ warming_phase: newPhase } as any).eq('id', chipId);
      if (error) throw error;
      setChips(prev => prev.map(c => c.id === chipId ? { ...c, warming_phase: newPhase } : c));
      toast({ title: 'Fase atualizada' });
    } catch (error) {
      toast({ title: 'Erro ao atualizar fase', variant: 'destructive' });
    }
  };

  const extractPhoneFromStatus = (statusResult: any, fallback: string | null): string | null => {
    if (statusResult.jid) return statusResult.jid.split('@')[0].split(':')[0].replace(/\D/g, '');
    if (statusResult.wid) return statusResult.wid.split('@')[0].split(':')[0].replace(/\D/g, '');
    if (statusResult.instance?.wuid) return statusResult.instance.wuid.split('@')[0].split(':')[0].replace(/\D/g, '');
    return fallback;
  };

  const resolveStatus = (state: string) => {
    if (state === 'open' || state === 'connected') return 'connected';
    if (state === 'connecting' || state === 'qr') return 'connecting';
    return 'disconnected';
  };

  const handleSyncAllChips = useCallback(async (chipsToSync: Chip[]) => {
    const now = Date.now();
    if (now - lastSyncAllRef.current < 60000) {
      toast({ title: 'Aguarde', description: 'Espere pelo menos 60 segundos entre sincronizações', variant: 'destructive' });
      return;
    }
    lastSyncAllRef.current = now;
    const activeChips = chipsToSync.filter(c => c.instance_name);
    if (activeChips.length === 0) return;
    setIsSyncingAll(true);
    let updatedCount = 0;
    for (const chip of activeChips) {
      try {
        const statusResult = await callProviderApi('check-status', { instanceName: chip.instance_name });
        const newStatus = resolveStatus(statusResult.state);
        const phoneNumber = extractPhoneFromStatus(statusResult, chip.phone_number);
        if (newStatus !== chip.status || phoneNumber !== chip.phone_number) {
          await supabase.from('chips').update({ status: newStatus, phone_number: phoneNumber || chip.phone_number, ...(newStatus === 'connected' && !chip.activated_at ? { activated_at: new Date().toISOString() } : {}) }).eq('id', chip.id);
          updatedCount++;
        }
      } catch (e) { console.log(`Sync failed for chip ${chip.instance_name}:`, e); }
    }
    if (updatedCount > 0) fetchChips();
    setIsSyncingAll(false);
  }, [fetchChips, toast]);

  const startPollingStatus = (instanceName: string, chipId: string) => {
    if (pollIntervalRef.current) clearInterval(pollIntervalRef.current);
    pollIntervalRef.current = setInterval(async () => {
      try {
        const status = await callProviderApi('check-status', { instanceName });
        if (status.state === 'open' || status.state === 'connected') {
          clearInterval(pollIntervalRef.current!);
          pollIntervalRef.current = null;
          let phoneNumber: string | null = extractPhoneFromStatus(status, null);
          if (!phoneNumber) {
            try { const info = await callProviderApi('fetch-instance-info', { instanceName }); phoneNumber = info.phoneNumber?.replace(/\D/g, '') || null; } catch {}
          }
          await supabase.from('chips').update({ status: 'connected', activated_at: new Date().toISOString(), phone_number: phoneNumber }).eq('id', chipId);
          setQrDialogOpen(false);
          setQrCode(null);
          toast({ title: 'WhatsApp conectado!', description: phoneNumber ? `Número ${phoneNumber} vinculado` : 'Seu número foi vinculado com sucesso' });
          fetchChips();
        }
      } catch (error) { console.error('Error checking status:', error); }
    }, 5000) as unknown as number;
  };

  const fetchQrCode = async (instanceName: string, retries = 5): Promise<boolean> => {
    try {
      setIsConnecting(true);
      for (let attempt = 0; attempt < retries; attempt++) {
        if (attempt > 0) await new Promise(resolve => setTimeout(resolve, 2000));
        try {
          const result = await callProviderApi('get-qrcode', { instanceName });
          if (result.qrcode && result.qrcode.length > 10) {
            const qrImage = result.qrcode.startsWith('data:') ? result.qrcode : `data:image/png;base64,${result.qrcode}`;
            setQrCode(qrImage);
            return true;
          }
        } catch {}
      }
      throw new Error('QR Code não disponível após várias tentativas');
    } catch (error: any) {
      toast({ title: 'Erro ao obter QR Code', description: error.message || 'Tente novamente', variant: 'destructive' });
      return false;
    } finally {
      setIsConnecting(false);
    }
  };

  const handleAddChip = async (slotNumber: number) => {
    if (!user) return;
    setSelectedSlot(slotNumber);
    setQrDialogOpen(true);
    setIsConnecting(true);
    setQrCode(null);
    const instanceName = `chip_${user.id.slice(0, 8)}_slot${slotNumber}`;
    try {
      const { data: newChip, error: dbError } = await supabase.from('chips').insert({ user_id: user.id, slot_number: slotNumber, instance_name: instanceName, status: 'connecting', chip_type: 'warming' } as any).select().single();
      if (dbError) throw dbError;
      setSelectedChip(newChip);
      await callProviderApi('create-instance', { instanceName });
      await new Promise(resolve => setTimeout(resolve, 3000));
      await fetchQrCode(instanceName, 5);
      startPollingStatus(instanceName, newChip.id);
      fetchChips();
    } catch (error: any) {
      toast({ title: 'Erro ao criar chip', description: error.message, variant: 'destructive' });
      setQrDialogOpen(false);
      if (user) {
        await supabase.from('chips').delete().eq('user_id', user.id).eq('slot_number', slotNumber).eq('status', 'connecting');
        fetchChips();
      }
    } finally {
      setIsConnecting(false);
    }
  };

  const handleReconnect = async (chip: Chip) => {
    setSelectedSlot(chip.slot_number);
    setSelectedChip(chip);
    setQrDialogOpen(true);
    setQrCode(null);
    try {
      await supabase.from('chips').update({ status: 'connecting' }).eq('id', chip.id);
      await new Promise(resolve => setTimeout(resolve, 2000));
      await fetchQrCode(chip.instance_name, 5);
      startPollingStatus(chip.instance_name, chip.id);
      fetchChips();
    } catch (error: any) {
      toast({ title: 'Erro ao reconectar', description: error.message, variant: 'destructive' });
      setQrDialogOpen(false);
    }
  };

  const handleSyncStatus = async (chip: Chip) => {
    try {
      const statusResult = await callProviderApi('check-status', { instanceName: chip.instance_name });
      const newStatus = resolveStatus(statusResult.state);
      let phoneNumber = extractPhoneFromStatus(statusResult, chip.phone_number);
      if (!phoneNumber && newStatus === 'connected') {
        try { const info = await callProviderApi('fetch-instance-info', { instanceName: chip.instance_name }); if (info.phoneNumber) phoneNumber = info.phoneNumber.replace(/\D/g, ''); } catch {}
      }
      await supabase.from('chips').update({ status: newStatus, phone_number: phoneNumber || chip.phone_number, ...(newStatus === 'connected' && !chip.activated_at ? { activated_at: new Date().toISOString() } : {}) }).eq('id', chip.id);
      toast({ title: 'Status sincronizado', description: phoneNumber ? `Conectado: ${phoneNumber}` : `Chip está ${newStatus === 'connected' ? 'conectado' : 'desconectado'}` });
      fetchChips();
    } catch (error: any) {
      toast({ title: 'Erro ao sincronizar', description: error.message, variant: 'destructive' });
    }
  };

  const handleRefreshQr = async () => {
    if (!selectedChip) return;
    await fetchQrCode(selectedChip.instance_name);
  };

  const confirmRemoveChip = (chip: Chip) => {
    setChipToDelete(chip);
    setDeleteDialogOpen(true);
  };

  const handleRemoveChip = async () => {
    if (!chipToDelete) return;
    try {
      try { await callProviderApi('logout-instance', { instanceName: chipToDelete.instance_name }); } catch {}
      try { await callProviderApi('delete-instance', { instanceName: chipToDelete.instance_name }); } catch {}
      const { error } = await supabase.from('chips').delete().eq('id', chipToDelete.id);
      if (error) throw error;
      toast({ title: 'Chip removido', description: 'O chip foi removido com sucesso' });
      fetchChips();
    } catch (error) {
      toast({ title: 'Erro ao remover chip', description: 'Tente novamente mais tarde', variant: 'destructive' });
    } finally {
      setDeleteDialogOpen(false);
      setChipToDelete(null);
    }
  };

  const handleDialogClose = (open: boolean) => {
    if (!open && pollIntervalRef.current) { clearInterval(pollIntervalRef.current); pollIntervalRef.current = null; }
    setQrDialogOpen(open);
    if (!open) { setQrCode(null); setSelectedChip(null); }
  };

  const cleanupPolling = () => {
    if (pollIntervalRef.current) clearInterval(pollIntervalRef.current);
  };

  return {
    chips, setChips, isLoading, settings,
    qrDialogOpen, selectedSlot, selectedChip, qrCode, isConnecting,
    deleteDialogOpen, chipToDelete,
    editingNickname, setEditingNickname, nicknameValue, setNicknameValue,
    isSyncingAll,
    fetchChips, fetchSettings, cleanupPolling,
    handleNicknameSave, handlePhaseChange, handleSyncAllChips,
    handleAddChip, handleReconnect, handleSyncStatus, handleRefreshQr,
    confirmRemoveChip, handleRemoveChip, handleDialogClose,
  };
}

export const WARMING_PHASES = [
  { value: 'novo', label: 'Novo', description: 'Chips recém-ativados' },
  { value: 'iniciante', label: 'Iniciante', description: 'Aquecimento inicial' },
  { value: 'crescimento', label: 'Crescimento', description: 'Volume crescente' },
  { value: 'aquecido', label: 'Aquecido', description: 'Quase maduro' },
  { value: 'maduro', label: 'Maduro', description: 'Volume máximo' },
] as const;

export const PHASE_COLORS: Record<string, { text: string; bg: string }> = {
  novo: { text: 'text-blue-500', bg: 'bg-blue-500/10' },
  iniciante: { text: 'text-yellow-500', bg: 'bg-yellow-500/10' },
  crescimento: { text: 'text-orange-500', bg: 'bg-orange-500/10' },
  aquecido: { text: 'text-red-500', bg: 'bg-red-500/10' },
  maduro: { text: 'text-primary', bg: 'bg-primary/10' },
};

export const getEstimatedInterval = (phase: string, settings: ChipSystemSettings | null) => {
  if (!settings) return null;
  const limits: Record<string, number> = {
    novo: settings.messages_day_novo, iniciante: settings.messages_day_1_3, crescimento: settings.messages_day_4_7,
    aquecido: settings.messages_day_aquecido, maduro: settings.messages_day_8_plus,
  };
  const dailyLimit = limits[phase] || limits.novo;
  const hours = settings.end_hour - settings.start_hour;
  if (dailyLimit <= 0 || hours <= 0) return 'N/A';
  const intervalMinutes = (hours * 60) / dailyLimit;
  if (intervalMinutes >= 60) {
    const h = Math.floor(intervalMinutes / 60);
    const m = Math.round(intervalMinutes % 60);
    return `~${h}h${m > 0 ? m + 'min' : ''}`;
  }
  return `~${Math.round(intervalMinutes)}min`;
};
