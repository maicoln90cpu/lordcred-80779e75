import { useState, useRef, useEffect } from 'react';
import { Loader2, QrCode, RefreshCw, Smartphone } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

interface ChipConnectDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onChipConnected: () => void;
  chipType?: 'warming' | 'whatsapp';
  reconnectInstanceName?: string | null;
}

export default function ChipConnectDialog({ open, onOpenChange, onChipConnected, chipType = 'whatsapp', reconnectInstanceName }: ChipConnectDialogProps) {
  const { user } = useAuth();
  const { toast } = useToast();
  const [step, setStep] = useState<'form' | 'qr'>('form');
  const [instanceName, setInstanceName] = useState('');
  const [isCreating, setIsCreating] = useState(false);
  const [qrCode, setQrCode] = useState<string | null>(null);
  const [chipId, setChipId] = useState<string | null>(null);
  const [qrAttempts, setQrAttempts] = useState(0);
  const pollRef = useRef<number | null>(null);

  useEffect(() => {
    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, []);

  useEffect(() => {
    if (!open) {
      setStep('form');
      setQrCode(null);
      setChipId(null);
      setInstanceName('');
      setQrAttempts(0);
      if (pollRef.current) { clearInterval(pollRef.current); pollRef.current = null; }
    } else if (reconnectInstanceName) {
      // Reconnect mode: skip form, go directly to QR
      handleReconnect(reconnectInstanceName);
    }
  }, [open]);

  const getAuthToken = async () => {
    const { data } = await supabase.auth.getSession();
    return data?.session?.access_token;
  };

  const callApi = async (action: string, data: Record<string, unknown> = {}) => {
    const token = await getAuthToken();
    if (!token) throw new Error('Sessão expirada');

    const res = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/uazapi-api`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
      body: JSON.stringify({ action, ...data }),
    });
    const result = await res.json();
    if (!res.ok) throw new Error(result.error || 'Erro na API');
    return result;
  };

  const handleReconnect = async (instName: string) => {
    if (!user) return;
    setIsCreating(true);
    setStep('qr');

    try {
      // Find existing chip for this instance
      const { data: existingChip } = await supabase
        .from('chips')
        .select('id, instance_name')
        .eq('user_id', user.id)
        .eq('instance_name', instName)
        .single();

      if (existingChip) {
        setChipId(existingChip.id);
        await supabase.from('chips').update({ 
          status: 'connecting',
          last_connection_attempt: new Date().toISOString(),
        }).eq('id', existingChip.id);
      }

      // Get QR code for existing instance
      let gotQr = false;
      for (let i = 0; i < 5; i++) {
        if (i > 0) await new Promise(r => setTimeout(r, 2000));
        try {
          const result = await callApi('get-qrcode', { instanceName: instName });
          if (result.qrcode && result.qrcode.length > 10) {
            const qrImg = result.qrcode.startsWith('data:') ? result.qrcode : `data:image/png;base64,${result.qrcode}`;
            setQrCode(qrImg);
            gotQr = true;
            break;
          }
        } catch { /* retry */ }
      }

      setQrAttempts(0);
      if (existingChip) {
        startPolling(instName, existingChip.id);
      }
    } catch (error: any) {
      toast({ title: 'Erro ao reconectar', description: error.message, variant: 'destructive' });
    } finally {
      setIsCreating(false);
    }
  };

  const handleCreate = async () => {
    if (!user) return;
    setIsCreating(true);

    // Rate limiting
    const { data: recentChips } = await supabase
      .from('chips')
      .select('last_connection_attempt')
      .eq('user_id', user.id)
      .not('last_connection_attempt', 'is', null)
      .order('last_connection_attempt', { ascending: false })
      .limit(1);

    if (recentChips && recentChips.length > 0) {
      const lastAttempt = new Date((recentChips[0] as any).last_connection_attempt).getTime();
      if (Date.now() - lastAttempt < 60000) {
        toast({ title: 'Aguarde', description: 'Espere pelo menos 60 segundos entre tentativas de conexão', variant: 'destructive' });
        setIsCreating(false);
        return;
      }
    }

    const slotStart = chipType === 'whatsapp' ? 101 : 1;
    const slotEnd = chipType === 'whatsapp' ? 105 : 15;
    const maxChips = chipType === 'whatsapp' ? 5 : 15;
    const typeLabel = chipType === 'whatsapp' ? 'WhatsApp Web' : 'aquecimento';

    const existingQuery = supabase
      .from('chips')
      .select('slot_number')
      .eq('user_id', user.id)
      .order('slot_number');
    
    const { data: existing } = await (existingQuery as any).eq('chip_type', chipType);

    const usedSlots = new Set((existing || []).map((c: any) => c.slot_number));
    let slot = slotStart;
    while (usedSlots.has(slot) && slot <= slotEnd) slot++;
    if (slot > slotEnd) {
      toast({ title: 'Limite atingido', description: `Máximo de ${maxChips} chips de ${typeLabel}`, variant: 'destructive' });
      setIsCreating(false);
      return;
    }

    const name = instanceName.trim() || `chip_${user.id.slice(0, 8)}_slot${slot}`;

    try {
      let instanceExists = false;
      try {
        const statusResult = await callApi('check-status', { instanceName: name });
        if (statusResult.state === 'connected') {
          toast({ title: 'Instância já conectada', description: 'Vinculando ao seu chip...' });
          const { data: newChip, error } = await supabase
            .from('chips')
            .insert({
              user_id: user.id, slot_number: slot, instance_name: name, status: 'connected',
              activated_at: new Date().toISOString(),
              last_connection_attempt: new Date().toISOString(),
              chip_type: chipType,
            } as any)
            .select()
            .single();
          if (error) throw error;
          onOpenChange(false);
          onChipConnected();
          setIsCreating(false);
          return;
        }
        instanceExists = statusResult.state !== 'unknown';
      } catch {
        // Instance doesn't exist
      }

      const { data: newChip, error } = await supabase
        .from('chips')
        .insert({
          user_id: user.id, slot_number: slot, instance_name: name, status: 'connecting',
          last_connection_attempt: new Date().toISOString(),
          chip_type: chipType,
        } as any)
        .select()
        .single();
      if (error) throw error;

      setChipId(newChip.id);

      if (!instanceExists) {
        await callApi('create-instance', { instanceName: name });
        await new Promise(r => setTimeout(r, 3000));
      }

      let gotQr = false;
      for (let i = 0; i < 5; i++) {
        if (i > 0) await new Promise(r => setTimeout(r, 2000));
        try {
          const result = await callApi('get-qrcode', { instanceName: name });
          if (result.qrcode && result.qrcode.length > 10) {
            const qrImg = result.qrcode.startsWith('data:') ? result.qrcode : `data:image/png;base64,${result.qrcode}`;
            setQrCode(qrImg);
            gotQr = true;
            break;
          }
        } catch { /* retry */ }
      }

      setStep('qr');
      setQrAttempts(0);
      startPolling(name, newChip.id);
    } catch (error: any) {
      toast({ title: 'Erro', description: error.message, variant: 'destructive' });
      await supabase.from('chips').delete().eq('user_id', user.id).eq('slot_number', slot).eq('status', 'connecting');
    } finally {
      setIsCreating(false);
    }
  };

  const startPolling = (instName: string, cId: string) => {
    if (pollRef.current) clearInterval(pollRef.current);
    pollRef.current = setInterval(async () => {
      try {
        const status = await callApi('check-status', { instanceName: instName });
        if (status.state === 'open' || status.state === 'connected') {
          clearInterval(pollRef.current!);
          pollRef.current = null;

          let phone: string | null = null;
          if (status.jid) phone = status.jid.split('@')[0].split(':')[0].replace(/\D/g, '');

          await supabase.from('chips').update({
            status: 'connected',
            activated_at: new Date().toISOString(),
            phone_number: phone,
          }).eq('id', cId);

          toast({ title: 'WhatsApp conectado!', description: phone ? `Número ${phone} vinculado` : 'Conectado com sucesso' });
          onOpenChange(false);
          onChipConnected();
        }
      } catch { /* keep polling */ }
    }, 3000) as unknown as number;
  };

  const handleRefreshQr = async () => {
    const activeChipId = chipId;
    const instName = reconnectInstanceName;
    
    if (!activeChipId && !instName) return;

    const newAttempts = qrAttempts + 1;
    setQrAttempts(newAttempts);

    // Determine instance name
    let targetInstance = instName;
    if (!targetInstance && activeChipId) {
      const { data: chip } = await supabase.from('chips').select('instance_name').eq('id', activeChipId).single();
      targetInstance = chip?.instance_name;
    }
    if (!targetInstance) return;

    if (newAttempts >= 3) {
      toast({ title: 'QR Code expirado', description: 'Recriando instância...' });
      try {
        try { await callApi('delete-instance', { instanceName: targetInstance }); } catch { /* ok */ }
        await callApi('create-instance', { instanceName: targetInstance });
        await new Promise(r => setTimeout(r, 3000));
        const result = await callApi('get-qrcode', { instanceName: targetInstance });
        if (result.qrcode && result.qrcode.length > 10) {
          const qrImg = result.qrcode.startsWith('data:') ? result.qrcode : `data:image/png;base64,${result.qrcode}`;
          setQrCode(qrImg);
        }
        setQrAttempts(0);
        if (activeChipId) startPolling(targetInstance, activeChipId);
      } catch (e) {
        toast({ title: 'Erro ao recriar instância', variant: 'destructive' });
      }
      return;
    }

    try {
      const result = await callApi('get-qrcode', { instanceName: targetInstance });
      if (result.qrcode && result.qrcode.length > 10) {
        const qrImg = result.qrcode.startsWith('data:') ? result.qrcode : `data:image/png;base64,${result.qrcode}`;
        setQrCode(qrImg);
      }
    } catch {
      toast({ title: 'Erro ao atualizar QR', variant: 'destructive' });
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Smartphone className="w-5 h-5" />
            {reconnectInstanceName ? 'Reconectar Chip' : 'Conectar Chip'}
          </DialogTitle>
          <DialogDescription>
            {reconnectInstanceName ? 'Escaneie o QR Code para reconectar' : 'Conecte seu WhatsApp escaneando o QR Code'}
          </DialogDescription>
        </DialogHeader>

        {step === 'form' && !reconnectInstanceName && (
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label>Nome da instância (opcional)</Label>
              <Input
                placeholder="Ex: meu-whatsapp"
                value={instanceName}
                onChange={(e) => setInstanceName(e.target.value)}
              />
            </div>
            <Button onClick={handleCreate} disabled={isCreating} className="w-full">
              {isCreating ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Criando...</> : 'Criar e Conectar'}
            </Button>
          </div>
        )}

        {(step === 'qr' || reconnectInstanceName) && (
          <div className="flex flex-col items-center gap-4 py-4">
            {qrCode ? (
              <img src={qrCode} alt="QR Code" className="w-64 h-64 rounded-lg border" />
            ) : (
              <div className="w-64 h-64 flex items-center justify-center border rounded-lg">
                <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
              </div>
            )}
            <p className="text-sm text-muted-foreground text-center">
              Abra o WhatsApp no celular e escaneie o QR Code
            </p>
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" onClick={handleRefreshQr}>
                <RefreshCw className="w-4 h-4 mr-2" />Atualizar QR Code
              </Button>
              {qrAttempts > 0 && (
                <span className="text-xs text-muted-foreground">{qrAttempts}/3 tentativas</span>
              )}
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
