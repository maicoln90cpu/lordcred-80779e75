import { useState, useRef, useEffect } from 'react';
import { Loader2, QrCode, RefreshCw, Smartphone, Globe, Shield } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
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

type ProviderChoice = 'uazapi' | 'meta';

export default function ChipConnectDialog({ open, onOpenChange, onChipConnected, chipType = 'whatsapp', reconnectInstanceName }: ChipConnectDialogProps) {
  const { user } = useAuth();
  const { toast } = useToast();
  const [step, setStep] = useState<'provider' | 'form' | 'qr' | 'meta-form'>('provider');
  const [provider, setProvider] = useState<ProviderChoice>('uazapi');
  const [instanceName, setInstanceName] = useState('');
  const [isCreating, setIsCreating] = useState(false);
  const [qrCode, setQrCode] = useState<string | null>(null);
  const [chipId, setChipId] = useState<string | null>(null);
  const [qrAttempts, setQrAttempts] = useState(0);
  const [canUseMeta, setCanUseMeta] = useState(false);
  const [metaPhoneId, setMetaPhoneId] = useState('');
  const [metaWabaId, setMetaWabaId] = useState('');
  const [isValidatingMeta, setIsValidatingMeta] = useState(false);
  const pollRef = useRef<number | null>(null);

  useEffect(() => {
    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, []);

  useEffect(() => {
    if (!open) {
      setStep(reconnectInstanceName ? 'qr' : 'provider');
      setProvider('uazapi');
      setQrCode(null);
      setChipId(null);
      setInstanceName('');
      setQrAttempts(0);
      setMetaPhoneId('');
      setMetaWabaId('');
      if (pollRef.current) { clearInterval(pollRef.current); pollRef.current = null; }
    } else if (reconnectInstanceName) {
      handleReconnect(reconnectInstanceName);
    } else {
      checkMetaAccess();
    }
  }, [open]);

  const checkMetaAccess = async () => {
    if (!user) return;
    try {
      const { data: settings } = await supabase
        .from('system_settings')
        .select('meta_access_token, meta_allowed_user_ids')
        .limit(1)
        .maybeSingle();
      
      if (!settings) return;
      const s = settings as any;
      const hasToken = !!s.meta_access_token;
      const allowedIds: string[] = s.meta_allowed_user_ids || [];
      
      // Check user role
      const { data: role } = await supabase
        .from('user_roles')
        .select('role')
        .eq('user_id', user.id)
        .single();
      
      const isPrivileged = ['master', 'admin'].includes((role as any)?.role || '');
      setCanUseMeta(hasToken && (isPrivileged || allowedIds.includes(user.id)));
    } catch {
      setCanUseMeta(false);
    }
  };

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

  const handleSelectProvider = (p: ProviderChoice) => {
    setProvider(p);
    if (p === 'uazapi') {
      setStep('form');
    } else {
      setStep('meta-form');
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

    const { data: profileData } = await supabase
      .from('profiles')
      .select('max_chips')
      .eq('user_id', user.id)
      .single();
    
    const userMaxChips = (profileData as any)?.max_chips ?? 5;
    const slotStart = chipType === 'whatsapp' ? 101 : 1;
    const slotEnd = chipType === 'whatsapp' ? 100 + userMaxChips : userMaxChips;
    const maxChips = userMaxChips;
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

  const handleCreateMeta = async () => {
    if (!user || !metaPhoneId.trim()) {
      toast({ title: 'Preencha o Phone Number ID', variant: 'destructive' });
      return;
    }
    setIsValidatingMeta(true);

    try {
      // Validate with Meta API
      const { data: settings } = await supabase
        .from('system_settings')
        .select('meta_access_token')
        .limit(1)
        .maybeSingle();
      
      const metaToken = (settings as any)?.meta_access_token;
      if (!metaToken) {
        toast({ title: 'Token Meta não configurado', description: 'Configure o Access Token no Master Admin', variant: 'destructive' });
        return;
      }

      // Test the phone number ID
      const testResp = await fetch(`https://graph.facebook.com/v21.0/${metaPhoneId.trim()}`, {
        headers: { 'Authorization': `Bearer ${metaToken}` },
      });
      const testData = await testResp.json();

      if (testData.error) {
        toast({
          title: 'Phone Number ID inválido',
          description: testData.error.message || 'Verifique o ID no Meta Business Manager',
          variant: 'destructive',
        });
        return;
      }

      const displayPhone = testData.display_phone_number || metaPhoneId;
      const verifiedName = testData.verified_name || '';

      // Get slot
      const { data: profileData } = await supabase
        .from('profiles')
        .select('max_chips')
        .eq('user_id', user.id)
        .single();
      
      const userMaxChips = (profileData as any)?.max_chips ?? 5;
      const slotStart = 101;
      const slotEnd = 100 + userMaxChips;

      const { data: existing } = await (supabase
        .from('chips')
        .select('slot_number')
        .eq('user_id', user.id)
        .order('slot_number') as any).eq('chip_type', 'whatsapp');

      const usedSlots = new Set((existing || []).map((c: any) => c.slot_number));
      let slot = slotStart;
      while (usedSlots.has(slot) && slot <= slotEnd) slot++;
      if (slot > slotEnd) {
        toast({ title: 'Limite atingido', description: `Máximo de ${userMaxChips} chips`, variant: 'destructive' });
        return;
      }

      const name = verifiedName || `meta_${displayPhone.replace(/\D/g, '')}`;

      // Create chip with provider='meta'
      const { error } = await supabase
        .from('chips')
        .insert({
          user_id: user.id,
          slot_number: slot,
          instance_name: name,
          status: 'connected',
          activated_at: new Date().toISOString(),
          last_connection_attempt: new Date().toISOString(),
          chip_type: 'whatsapp',
          provider: 'meta',
          meta_phone_number_id: metaPhoneId.trim(),
          meta_waba_id: metaWabaId.trim() || null,
          phone_number: displayPhone.replace(/\D/g, ''),
        } as any)
        .select()
        .single();

      if (error) throw error;

      toast({
        title: 'Meta WhatsApp conectado!',
        description: `Número ${displayPhone} vinculado via Meta Cloud API`,
      });
      onOpenChange(false);
      onChipConnected();
    } catch (error: any) {
      toast({ title: 'Erro ao conectar Meta', description: error.message, variant: 'destructive' });
    } finally {
      setIsValidatingMeta(false);
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
    }, 5000) as unknown as number;
  };

  const handleRefreshQr = async () => {
    const activeChipId = chipId;
    const instName = reconnectInstanceName;
    
    if (!activeChipId && !instName) return;

    const newAttempts = qrAttempts + 1;
    setQrAttempts(newAttempts);

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
            {reconnectInstanceName
              ? 'Escaneie o QR Code para reconectar'
              : step === 'provider'
              ? 'Escolha o provedor de conexão WhatsApp'
              : step === 'meta-form'
              ? 'Conecte via Meta WhatsApp Cloud API (oficial)'
              : 'Conecte seu WhatsApp escaneando o QR Code'}
          </DialogDescription>
        </DialogHeader>

        {/* Step 1: Provider selection (only for new connections) */}
        {step === 'provider' && !reconnectInstanceName && (
          <div className="space-y-3 py-2">
            <button
              onClick={() => handleSelectProvider('uazapi')}
              className="w-full flex items-start gap-3 p-4 rounded-lg border hover:bg-muted/50 transition-colors text-left"
            >
              <QrCode className="w-8 h-8 text-green-500 shrink-0 mt-0.5" />
              <div>
                <p className="font-medium flex items-center gap-2">
                  UazAPI (QR Code)
                  <Badge variant="secondary" className="text-xs">Atual</Badge>
                </p>
                <p className="text-sm text-muted-foreground mt-1">
                  Conexão via WhatsApp Web. Bom para aquecimento e uso geral.
                </p>
              </div>
            </button>

            <button
              onClick={() => canUseMeta ? handleSelectProvider('meta') : undefined}
              disabled={!canUseMeta}
              className={`w-full flex items-start gap-3 p-4 rounded-lg border transition-colors text-left ${
                canUseMeta ? 'hover:bg-muted/50 cursor-pointer' : 'opacity-50 cursor-not-allowed'
              }`}
            >
              <Shield className="w-8 h-8 text-blue-500 shrink-0 mt-0.5" />
              <div>
                <p className="font-medium flex items-center gap-2">
                  Meta Cloud API (Oficial)
                  <Badge variant="outline" className="text-xs text-blue-500 border-blue-500">Oficial</Badge>
                </p>
                <p className="text-sm text-muted-foreground mt-1">
                  {canUseMeta
                    ? 'Conexão oficial do WhatsApp. Sem risco de ban, ideal para atendimento.'
                    : 'Não disponível. Solicite acesso ao administrador.'}
                </p>
              </div>
            </button>
          </div>
        )}

        {/* Step 2a: UazAPI form */}
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
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => setStep('provider')} className="shrink-0">
                Voltar
              </Button>
              <Button onClick={handleCreate} disabled={isCreating} className="flex-1">
                {isCreating ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Criando...</> : 'Criar e Conectar'}
              </Button>
            </div>
          </div>
        )}

        {/* Step 2b: Meta form */}
        {step === 'meta-form' && (
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label>Phone Number ID *</Label>
              <Input
                placeholder="Ex: 123456789012345"
                value={metaPhoneId}
                onChange={(e) => setMetaPhoneId(e.target.value)}
              />
              <p className="text-xs text-muted-foreground">
                Encontrado em Meta Business Manager → WhatsApp → API Setup
              </p>
            </div>
            <div className="space-y-2">
              <Label>WABA ID (opcional)</Label>
              <Input
                placeholder="Ex: 987654321098765"
                value={metaWabaId}
                onChange={(e) => setMetaWabaId(e.target.value)}
              />
              <p className="text-xs text-muted-foreground">
                WhatsApp Business Account ID — necessário para sincronizar templates
              </p>
            </div>
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => setStep('provider')} className="shrink-0">
                Voltar
              </Button>
              <Button onClick={handleCreateMeta} disabled={isValidatingMeta} className="flex-1">
                {isValidatingMeta ? (
                  <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Validando...</>
                ) : (
                  <>
                    <Shield className="w-4 h-4 mr-2" />
                    Conectar via Meta
                  </>
                )}
              </Button>
            </div>
          </div>
        )}

        {/* Step 3: QR Code (UazAPI only) */}
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
