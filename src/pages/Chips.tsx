import { useEffect, useState, useCallback, useRef } from 'react';
import { 
  Plus, 
  Smartphone, 
  Wifi, 
  WifiOff, 
  QrCode, 
  Trash2, 
  RefreshCw, 
  Loader2,
  RotateCcw,
  Timer,
  Pencil,
  Check,
  X,
  MessageSquare,
  ListOrdered
} from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import DashboardLayout from '@/components/layout/DashboardLayout';
import MessagesContent from '@/components/messages/MessagesContent';
import QueueContent from '@/components/messages/QueueContent';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import { useRealtimeChips } from '@/hooks/useRealtimeChips';

interface Chip {
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

interface SystemSettings {
  start_hour: number;
  end_hour: number;
  messages_day_novo: number;
  messages_day_1_3: number;
  messages_day_4_7: number;
  messages_day_aquecido: number;
  messages_day_8_plus: number;
  whatsapp_provider?: string;
}

const getEstimatedInterval = (phase: string, settings: SystemSettings | null) => {
  if (!settings) return null;
  const limits: Record<string, number> = {
    novo: settings.messages_day_novo,
    iniciante: settings.messages_day_1_3,
    crescimento: settings.messages_day_4_7,
    aquecido: settings.messages_day_aquecido,
    maduro: settings.messages_day_8_plus,
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

const WARMING_PHASES = [
  { value: 'novo', label: 'Novo', description: 'Chips recém-ativados' },
  { value: 'iniciante', label: 'Iniciante', description: 'Aquecimento inicial' },
  { value: 'crescimento', label: 'Crescimento', description: 'Volume crescente' },
  { value: 'aquecido', label: 'Aquecido', description: 'Quase maduro' },
  { value: 'maduro', label: 'Maduro', description: 'Volume máximo' },
] as const;

const PHASE_COLORS: Record<string, { text: string; bg: string }> = {
  novo: { text: 'text-blue-500', bg: 'bg-blue-500/10' },
  iniciante: { text: 'text-yellow-500', bg: 'bg-yellow-500/10' },
  crescimento: { text: 'text-orange-500', bg: 'bg-orange-500/10' },
  aquecido: { text: 'text-red-500', bg: 'bg-red-500/10' },
  maduro: { text: 'text-primary', bg: 'bg-primary/10' },
};

export default function Chips() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [chips, setChips] = useState<Chip[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [settings, setSettings] = useState<SystemSettings | null>(null);
  const [qrDialogOpen, setQrDialogOpen] = useState(false);
  const [selectedSlot, setSelectedSlot] = useState<number | null>(null);
  const [selectedChip, setSelectedChip] = useState<Chip | null>(null);
  const [qrCode, setQrCode] = useState<string | null>(null);
  const [isConnecting, setIsConnecting] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [chipToDelete, setChipToDelete] = useState<Chip | null>(null);
  const [editingNickname, setEditingNickname] = useState<string | null>(null);
  const [nicknameValue, setNicknameValue] = useState('');
  const pollIntervalRef = useRef<number | null>(null);

const availableSlots = Array.from({ length: 15 }, (_, i) => i + 1);

const handleNicknameSave = async (chipId: string) => {
  try {
    const { error } = await supabase
      .from('chips')
      .update({ nickname: nicknameValue.trim() || null } as any)
      .eq('id', chipId);
    if (error) throw error;
    setChips(prev => prev.map(c => c.id === chipId ? { ...c, nickname: nicknameValue.trim() || null } : c));
    toast({ title: 'Nome atualizado' });
  } catch (error) {
    console.error('Error updating nickname:', error);
    toast({ title: 'Erro ao salvar nome', variant: 'destructive' });
  } finally {
    setEditingNickname(null);
  }
};

const handlePhaseChange = async (chipId: string, newPhase: string) => {
  try {
    const { error } = await supabase
      .from('chips')
      .update({ warming_phase: newPhase } as any)
      .eq('id', chipId);

    if (error) throw error;

    setChips(prev => prev.map(c => c.id === chipId ? { ...c, warming_phase: newPhase } : c));
    toast({ title: 'Fase atualizada', description: `Chip alterado para ${WARMING_PHASES.find(p => p.value === newPhase)?.label}` });
  } catch (error) {
    console.error('Error updating phase:', error);
    toast({ title: 'Erro ao atualizar fase', variant: 'destructive' });
  }
};

  const fetchChips = useCallback(async () => {
    if (!user) return;

    try {
      const query = supabase
        .from('chips')
        .select('*')
        .eq('user_id', user.id)
        .order('slot_number');
      
      const { data, error } = await (query as any).eq('chip_type', 'warming');

      if (error) throw error;
      setChips(data || []);
    } catch (error) {
      console.error('Error fetching chips:', error);
    } finally {
      setIsLoading(false);
    }
  }, [user]);

  // Subscribe to realtime chip updates
  const handleRealtimeUpdate = useCallback((updatedChips: Chip[]) => {
    const userChips = updatedChips.filter(c => (c as any).user_id === user?.id);
    setChips(userChips);
  }, [user?.id]);

  useRealtimeChips(handleRealtimeUpdate, user?.id);

  const [isSyncingAll, setIsSyncingAll] = useState(false);
  const hasSyncedOnMount = useRef(false);

  const handleSyncAllChips = useCallback(async (chipsToSync: Chip[]) => {
    const activeChips = chipsToSync.filter(c => c.instance_name);
    if (activeChips.length === 0) return;

    setIsSyncingAll(true);
    let updatedCount = 0;

    for (const chip of activeChips) {
      try {
        const statusResult = await callProviderApi('check-status', { instanceName: chip.instance_name });
        
        let newStatus = 'disconnected';
        if (statusResult.state === 'open' || statusResult.state === 'connected') {
          newStatus = 'connected';
        } else if (statusResult.state === 'connecting' || statusResult.state === 'qr') {
          newStatus = 'connecting';
        }

        let phoneNumber = chip.phone_number;
        if (statusResult.jid) {
          phoneNumber = statusResult.jid.split('@')[0].split(':')[0].replace(/\D/g, '');
        } else if (statusResult.wid) {
          phoneNumber = statusResult.wid.split('@')[0].split(':')[0].replace(/\D/g, '');
        } else if (statusResult.instance?.wuid) {
          phoneNumber = statusResult.instance.wuid.split('@')[0].split(':')[0].replace(/\D/g, '');
        }

        if (newStatus !== chip.status || phoneNumber !== chip.phone_number) {
          await supabase
            .from('chips')
            .update({
              status: newStatus,
              phone_number: phoneNumber || chip.phone_number,
              ...(newStatus === 'connected' && !chip.activated_at ? { activated_at: new Date().toISOString() } : {})
            })
            .eq('id', chip.id);
          updatedCount++;
        }
      } catch (e) {
        console.log(`Sync failed for chip ${chip.instance_name}:`, e);
      }
    }

    if (updatedCount > 0) {
      fetchChips();
    }
    setIsSyncingAll(false);
  }, [settings, fetchChips]);

  useEffect(() => {
    fetchChips();
    supabase.from('system_settings').select('start_hour, end_hour, messages_day_novo, messages_day_1_3, messages_day_4_7, messages_day_aquecido, messages_day_8_plus, whatsapp_provider').limit(1).single().then(({ data }) => {
      if (data) setSettings(data as unknown as SystemSettings);
    });
  }, [fetchChips]);

  // Auto-sync all chip statuses on page mount
  useEffect(() => {
    if (!hasSyncedOnMount.current && chips.length > 0 && settings) {
      hasSyncedOnMount.current = true;
      handleSyncAllChips(chips);
    }
  }, [chips, settings, handleSyncAllChips]);

  // Cleanup polling on unmount or dialog close
  useEffect(() => {
    return () => {
      if (pollIntervalRef.current) {
        clearInterval(pollIntervalRef.current);
      }
    };
  }, []);

  const getAuthToken = async () => {
    const { data } = await supabase.auth.getSession();
    return data?.session?.access_token;
  };

  const callProviderApi = async (action: string, data: Record<string, unknown> = {}) => {
    const token = await getAuthToken();
    if (!token) throw new Error('Sessão expirada');

    // Determine which edge function to call based on provider
    const functionName = 'uazapi-api';

    const response = await fetch(
      `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/${functionName}`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({ action, ...data }),
      }
    );

    const result = await response.json();
    if (!response.ok) {
      throw new Error(result.error || 'Erro na API do provedor');
    }
    return result;
  };

  const startPollingStatus = (instanceName: string, chipId: string) => {
    if (pollIntervalRef.current) {
      clearInterval(pollIntervalRef.current);
    }

    pollIntervalRef.current = setInterval(async () => {
      try {
        const status = await callProviderApi('check-status', { instanceName });
        
        if (status.state === 'open' || status.state === 'connected') {
          // Connected successfully
          clearInterval(pollIntervalRef.current!);
          pollIntervalRef.current = null;

          // Extract phone number from jid or fetch instance info
          let phoneNumber: string | null = null;
          if (status.jid) {
            // jid format: 5511999136884:45@s.whatsapp.net — strip device ID after ':'
            phoneNumber = status.jid.split('@')[0].split(':')[0].replace(/\D/g, '');
          }
          if (!phoneNumber) {
            try {
              const info = await callProviderApi('fetch-instance-info', { instanceName });
              phoneNumber = info.phoneNumber?.replace(/\D/g, '') || null;
            } catch (e) {
              console.log('Could not fetch phone number:', e);
            }
          }

          // Update chip status in database with phone number
          await supabase
            .from('chips')
            .update({ 
              status: 'connected',
              activated_at: new Date().toISOString(),
              phone_number: phoneNumber,
            })
            .eq('id', chipId);

          setQrDialogOpen(false);
          setQrCode(null);
          
          toast({
            title: 'WhatsApp conectado!',
            description: phoneNumber ? `Número ${phoneNumber} vinculado` : 'Seu número foi vinculado com sucesso',
          });

          fetchChips();
        }
      } catch (error) {
        console.error('Error checking status:', error);
      }
    }, 3000) as unknown as number;
  };

  const fetchQrCode = async (instanceName: string, retries = 5): Promise<boolean> => {
    try {
      setIsConnecting(true);
      
      for (let attempt = 0; attempt < retries; attempt++) {
        // Aguardar antes de cada tentativa (exceto primeira)
        if (attempt > 0) {
          console.log(`Tentativa ${attempt + 1}: aguardando 2s antes de buscar QR code...`);
          await new Promise(resolve => setTimeout(resolve, 2000));
        }
        
        try {
          const result = await callProviderApi('get-qrcode', { instanceName });
          
          // Verificar se temos QR code válido (length > 10 para ignorar strings vazias)
          if (result.qrcode && result.qrcode.length > 10) {
            console.log(`QR code obtido na tentativa ${attempt + 1}`);
            // UazAPI pode retornar base64 sem prefixo data:image
            const qrImage = result.qrcode.startsWith('data:')
              ? result.qrcode
              : `data:image/png;base64,${result.qrcode}`;
            setQrCode(qrImage);
            return true;
          }
          
          console.log(`Tentativa ${attempt + 1}: QR code ainda não disponível`);
        } catch (error) {
          console.log(`Tentativa ${attempt + 1}: erro ao buscar QR code`, error);
        }
      }
      
      throw new Error('QR Code não disponível após várias tentativas');
    } catch (error: any) {
      console.error('Error fetching QR code:', error);
      toast({
        title: 'Erro ao obter QR Code',
        description: error.message || 'Tente novamente',
        variant: 'destructive',
      });
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
      // Create chip in database first
      const { data: newChip, error: dbError } = await supabase
        .from('chips')
        .insert({
          user_id: user.id,
          slot_number: slotNumber,
          instance_name: instanceName,
          status: 'connecting',
          chip_type: 'warming',
        } as any)
        .select()
        .single();

      if (dbError) throw dbError;

      setSelectedChip(newChip);

      // Create instance via provider API
      await callProviderApi('create-instance', { instanceName });
      
      // Aguardar 3 segundos para a instância inicializar na Evolution API
      console.log('Aguardando 3s para instância inicializar...');
      await new Promise(resolve => setTimeout(resolve, 3000));
      
      // Get QR code com retry automático
      const qrSuccess = await fetchQrCode(instanceName, 5);

      // Start polling for connection status (mesmo se QR falhar, pode conectar por webhook)
      startPollingStatus(instanceName, newChip.id);

      fetchChips();
    } catch (error: any) {
      console.error('Error creating chip:', error);
      toast({
        title: 'Erro ao criar chip',
        description: error.message || 'Tente novamente mais tarde',
        variant: 'destructive',
      });
      setQrDialogOpen(false);
      
      // Rollback: delete chip from database if created
      if (user) {
        await supabase
          .from('chips')
          .delete()
          .eq('user_id', user.id)
          .eq('slot_number', slotNumber)
          .eq('status', 'connecting');
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
      // Update status to connecting
      await supabase
        .from('chips')
        .update({ status: 'connecting' })
        .eq('id', chip.id);

      // Aguardar 2 segundos antes de buscar QR (instância já existe)
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      await fetchQrCode(chip.instance_name, 5);
      startPollingStatus(chip.instance_name, chip.id);
      fetchChips();
    } catch (error: any) {
      console.error('Error reconnecting:', error);
      toast({
        title: 'Erro ao reconectar',
        description: error.message || 'Tente novamente mais tarde',
        variant: 'destructive',
      });
      setQrDialogOpen(false);
    }
  };

  const handleSyncStatus = async (chip: Chip) => {
    try {
      // First, check connection status
      const statusResult = await callProviderApi('check-status', { instanceName: chip.instance_name });
      
      let newStatus = 'disconnected';
      if (statusResult.state === 'open' || statusResult.state === 'connected') {
        newStatus = 'connected';
      } else if (statusResult.state === 'connecting' || statusResult.state === 'qr') {
        newStatus = 'connecting';
      }

      // Try to get phone number from status response first
      let phoneNumber = chip.phone_number;
      if (statusResult.jid) {
        phoneNumber = statusResult.jid.split('@')[0].split(':')[0].replace(/\D/g, '');
      } else if (statusResult.wid) {
        phoneNumber = statusResult.wid.split('@')[0].split(':')[0].replace(/\D/g, '');
      } else if (statusResult.instance?.wuid) {
        phoneNumber = statusResult.instance.wuid.split('@')[0].split(':')[0].replace(/\D/g, '');
      }

      // If still no phone number and connected, fetch full instance info
      if (!phoneNumber && newStatus === 'connected') {
        try {
          const infoResult = await callProviderApi('fetch-instance-info', { instanceName: chip.instance_name });
          if (infoResult.phoneNumber) {
            phoneNumber = infoResult.phoneNumber.replace(/\D/g, '');
          }
        } catch (e) {
          console.log('Could not fetch instance info:', e);
        }
      }

      await supabase
        .from('chips')
        .update({ 
          status: newStatus,
          phone_number: phoneNumber || chip.phone_number,
          ...(newStatus === 'connected' && !chip.activated_at ? { activated_at: new Date().toISOString() } : {})
        })
        .eq('id', chip.id);

      toast({
        title: 'Status sincronizado',
        description: phoneNumber 
          ? `Conectado: ${phoneNumber}` 
          : `Chip está ${newStatus === 'connected' ? 'conectado' : 'desconectado'}`,
      });

      fetchChips();
    } catch (error: any) {
      console.error('Error syncing status:', error);
      toast({
        title: 'Erro ao sincronizar',
        description: error.message || 'Tente novamente',
        variant: 'destructive',
      });
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
      // Graceful logout first
      try {
        await callProviderApi('logout-instance', { instanceName: chipToDelete.instance_name });
      } catch (e) {
        console.log('Logout failed (may already be disconnected)');
      }

      // Then delete instance from API
      try {
        await callProviderApi('delete-instance', { instanceName: chipToDelete.instance_name });
      } catch (e) {
        console.log('Instance might not exist in API');
      }

      // Delete from database
      const { error } = await supabase
        .from('chips')
        .delete()
        .eq('id', chipToDelete.id);

      if (error) throw error;

      toast({
        title: 'Chip removido',
        description: 'O chip foi removido com sucesso',
      });

      fetchChips();
    } catch (error) {
      console.error('Error removing chip:', error);
      toast({
        title: 'Erro ao remover chip',
        description: 'Tente novamente mais tarde',
        variant: 'destructive',
      });
    } finally {
      setDeleteDialogOpen(false);
      setChipToDelete(null);
    }
  };

  const handleDialogClose = (open: boolean) => {
    if (!open && pollIntervalRef.current) {
      clearInterval(pollIntervalRef.current);
      pollIntervalRef.current = null;
    }
    setQrDialogOpen(open);
    if (!open) {
      setQrCode(null);
      setSelectedChip(null);
    }
  };

  const usedSlots = chips.map(c => c.slot_number);
  const emptySlots = availableSlots.filter(s => !usedSlots.includes(s));

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold">Meus Chips</h1>
            <p className="text-muted-foreground">
              Gerencie seus números WhatsApp para aquecimento
            </p>
          </div>
        </div>

        <Tabs defaultValue="chips" className="w-full">
          <TabsList className="grid w-full max-w-lg grid-cols-3">
            <TabsTrigger value="chips" className="flex items-center gap-2">
              <Smartphone className="w-4 h-4" />
              Chips
            </TabsTrigger>
            <TabsTrigger value="messages" className="flex items-center gap-2">
              <MessageSquare className="w-4 h-4" />
              Mensagens
            </TabsTrigger>
            <TabsTrigger value="queue" className="flex items-center gap-2">
              <ListOrdered className="w-4 h-4" />
              Fila
            </TabsTrigger>
          </TabsList>

          <TabsContent value="chips" className="mt-4">
            <div className="space-y-4">
              {chips.length > 0 && (
                <div className="flex justify-end">
                  <Button variant="outline" onClick={() => handleSyncAllChips(chips)} disabled={isSyncingAll}>
                    {isSyncingAll ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <RefreshCw className="w-4 h-4 mr-2" />}
                    Sincronizar Todos
                  </Button>
                </div>
              )}

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {/* Active Chips */}
                {chips.map((chip) => {
                  const isConnected = chip.status === 'connected';
                  const currentPhase = chip.warming_phase || 'novo';
                  const phaseColors = PHASE_COLORS[currentPhase] || PHASE_COLORS.novo;
                  const messagesSent = chip.messages_sent_today || 0;
                  
                  return (
                    <Card 
                      key={chip.id} 
                      className={cn(
                        "border-border/50 transition-colors",
                        isConnected && "border-primary/30"
                      )}
                    >
                      <CardContent className="p-6">
                        <div className="flex items-center justify-between mb-3">
                          <div className="flex items-center gap-3">
                            <div className={cn(
                              "w-12 h-12 rounded-xl flex items-center justify-center",
                              isConnected ? "bg-primary/20" : "bg-muted"
                            )}>
                              <Smartphone className={cn(
                                "w-6 h-6",
                                isConnected ? "text-primary" : "text-muted-foreground"
                              )} />
                            </div>
                            <div>
                              <div className="flex items-center gap-1.5">
                                {editingNickname === chip.id ? (
                                  <div className="flex items-center gap-1">
                                    <Input
                                      value={nicknameValue}
                                      onChange={(e) => setNicknameValue(e.target.value)}
                                      className="h-6 text-sm w-28 px-1"
                                      placeholder={`Slot ${chip.slot_number}`}
                                      autoFocus
                                      onKeyDown={(e) => {
                                        if (e.key === 'Enter') handleNicknameSave(chip.id);
                                        if (e.key === 'Escape') setEditingNickname(null);
                                      }}
                                    />
                                    <button onClick={() => handleNicknameSave(chip.id)} className="text-primary hover:text-primary/80">
                                      <Check className="w-3.5 h-3.5" />
                                    </button>
                                    <button onClick={() => setEditingNickname(null)} className="text-muted-foreground hover:text-foreground">
                                      <X className="w-3.5 h-3.5" />
                                    </button>
                                  </div>
                                ) : (
                                  <>
                                    <h3 className="font-semibold">{chip.nickname || `Slot ${chip.slot_number}`}</h3>
                                    <button
                                      onClick={() => { setEditingNickname(chip.id); setNicknameValue(chip.nickname || ''); }}
                                      className="text-muted-foreground hover:text-foreground"
                                    >
                                      <Pencil className="w-3 h-3" />
                                    </button>
                                  </>
                                )}
                              </div>
                              {chip.nickname && <span className="text-xs text-muted-foreground">Slot {chip.slot_number}</span>}
                              <div className="flex items-center gap-1.5">
                                {isConnected ? (
                                  <Wifi className="w-3 h-3 text-primary" />
                                ) : (
                                  <WifiOff className="w-3 h-3 text-muted-foreground" />
                                )}
                                <span className={cn(
                                  "text-xs",
                                  isConnected ? "text-primary" : "text-muted-foreground"
                                )}>
                                  {chip.status === 'connected' ? 'Conectado' : 
                                   chip.status === 'connecting' ? 'Conectando...' : 'Desconectado'}
                                </span>
                              </div>
                            </div>
                          </div>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8"
                            onClick={() => handleSyncStatus(chip)}
                            title="Sincronizar status"
                          >
                            <RotateCcw className="w-4 h-4" />
                          </Button>
                        </div>

                        {/* Warming Phase Selector */}
                        <div className={cn("px-2 py-1.5 rounded-md mb-3", phaseColors.bg)}>
                          <Select
                            value={currentPhase}
                            onValueChange={(value) => handlePhaseChange(chip.id, value)}
                          >
                            <SelectTrigger className="h-7 text-xs border-0 bg-transparent p-0 shadow-none focus:ring-0">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              {WARMING_PHASES.map((phase) => (
                                <SelectItem key={phase.value} value={phase.value}>
                                  <span className="font-medium">{phase.label}</span>
                                  <span className="text-muted-foreground ml-1">— {phase.description}</span>
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>

                        {/* Estimated Interval Indicator */}
                        {settings && (
                          <div className="flex items-center gap-1.5 mb-2 text-xs text-muted-foreground">
                            <Timer className="w-3 h-3" />
                            <span>Intervalo estimado: {getEstimatedInterval(currentPhase, settings)} entre msgs</span>
                          </div>
                        )}

                        <p className="text-sm text-muted-foreground mb-2 truncate">
                          {chip.phone_number || 'Número não conectado'}
                        </p>

                        {/* Messages Progress */}
                        {isConnected && (
                          <div className="mb-4 space-y-1">
                            <div className="flex justify-between text-xs">
                              <span className="text-muted-foreground">Msgs hoje</span>
                              <span className="font-medium">{messagesSent}</span>
                            </div>
                            <Progress 
                              value={Math.min(messagesSent, 100)} 
                              className="h-1.5"
                            />
                          </div>
                        )}

                        <div className="flex gap-2">
                          {!isConnected && (
                            <Button 
                              variant="outline" 
                              size="sm" 
                              className="flex-1"
                              onClick={() => handleReconnect(chip)}
                            >
                              <QrCode className="w-4 h-4 mr-2" />
                              Reconectar
                            </Button>
                          )}
                          <Button 
                            variant="ghost" 
                            size="sm"
                            className="text-destructive hover:text-destructive hover:bg-destructive/10"
                            onClick={() => confirmRemoveChip(chip)}
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </div>
                      </CardContent>
                    </Card>
                  );
                })}

                {/* Empty Slots */}
                {emptySlots.map((slot) => (
                  <Card 
                    key={slot} 
                    className="border-dashed border-border/50 bg-transparent hover:bg-secondary/20 transition-colors cursor-pointer"
                    onClick={() => handleAddChip(slot)}
                  >
                    <CardContent className="p-6 flex flex-col items-center justify-center min-h-[180px]">
                      <div className="w-12 h-12 rounded-xl bg-muted flex items-center justify-center mb-3">
                        <Plus className="w-6 h-6 text-muted-foreground" />
                      </div>
                      <p className="font-medium">Slot {slot}</p>
                      <p className="text-sm text-muted-foreground">Adicionar chip</p>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </div>
          </TabsContent>

          <TabsContent value="messages" className="mt-4">
            <MessagesContent />
          </TabsContent>

          <TabsContent value="queue" className="mt-4">
            <QueueContent />
          </TabsContent>
        </Tabs>

        {/* QR Code Dialog */}
        <Dialog open={qrDialogOpen} onOpenChange={handleDialogClose}>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>Conectar WhatsApp - Slot {selectedSlot}</DialogTitle>
              <DialogDescription>
                Escaneie o QR Code abaixo com seu WhatsApp
              </DialogDescription>
            </DialogHeader>
            <div className="flex flex-col items-center py-6">
              {isConnecting ? (
                <div className="w-64 h-64 bg-muted rounded-xl flex items-center justify-center">
                  <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
                </div>
              ) : qrCode ? (
                <div className="w-64 h-64 bg-white rounded-xl flex items-center justify-center p-2">
                  <img 
                    src={qrCode.startsWith('data:') ? qrCode : `data:image/png;base64,${qrCode}`} 
                    alt="QR Code" 
                    className="w-full h-full object-contain"
                  />
                </div>
              ) : (
                <div className="w-64 h-64 bg-muted rounded-xl flex items-center justify-center">
                  <p className="text-muted-foreground text-center px-4">
                    Clique em atualizar para gerar o QR Code
                  </p>
                </div>
              )}
              <p className="text-xs text-muted-foreground mt-2 text-center">
                Aguardando conexão...
              </p>
              <Button 
                variant="outline" 
                className="mt-4"
                onClick={handleRefreshQr}
                disabled={isConnecting}
              >
                <RefreshCw className={cn("w-4 h-4 mr-2", isConnecting && "animate-spin")} />
                Atualizar QR Code
              </Button>
            </div>
          </DialogContent>
        </Dialog>

        {/* Delete Confirmation Dialog */}
        <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Remover Chip</AlertDialogTitle>
              <AlertDialogDescription>
                Tem certeza que deseja remover o Slot {chipToDelete?.slot_number}? 
                Esta ação não pode ser desfeita.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancelar</AlertDialogCancel>
              <AlertDialogAction 
                onClick={handleRemoveChip}
                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              >
                Remover
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </DashboardLayout>
  );
}
