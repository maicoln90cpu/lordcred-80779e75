import { useState, useEffect } from 'react';
import { User, Camera, Loader2, Shield, Building2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Separator } from '@/components/ui/separator';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

interface WhatsAppProfileDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  chipId: string | null;
}

interface PrivacySettings {
  profile_picture?: string;
  last_seen?: string;
  online?: string;
  read_receipts?: string;
  groups?: string;
  calls?: string;
  status?: string;
}

interface BusinessProfile {
  description?: string;
  address?: string;
  email?: string;
  category?: string;
  website?: string[];
}

export default function WhatsAppProfileDialog({ open, onOpenChange, chipId }: WhatsAppProfileDialogProps) {
  const { toast } = useToast();
  const [profileName, setProfileName] = useState('');
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [imageBase64, setImageBase64] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [isLoadingPrivacy, setIsLoadingPrivacy] = useState(false);
  const [privacy, setPrivacy] = useState<PrivacySettings>({});
  const [businessProfile, setBusinessProfile] = useState<BusinessProfile>({});
  const [isLoadingBusiness, setIsLoadingBusiness] = useState(false);

  // Load profile name, privacy and business when dialog opens
  useEffect(() => {
    if (!open || !chipId) return;

    // Load profile name and profile picture
    supabase.functions.invoke('uazapi-api', {
      body: { action: 'get-profile-name', chipId },
    }).then(({ data }) => {
      if (data?.profileName) {
        setProfileName(data.profileName);
      }
      // Try to get profile pic from instance status data
      const picUrl = data?.profilePicUrl || data?.instance?.profilePicUrl || data?.chipData?.profile_pic_url;
      if (picUrl) {
        setImagePreview(picUrl);
      }
    }).catch(() => {});

    // Also try to get profile pic from conversations table (own number)
    (async () => {
      try {
        const { data: chipData } = await (supabase as any).from('chips').select('phone_number').eq('id', chipId).maybeSingle();
        if (chipData?.phone_number) {
          const { data: convo } = await (supabase as any).from('conversations')
            .select('profile_pic_url')
            .eq('chip_id', chipId)
            .eq('remote_jid', `${chipData.phone_number}@s.whatsapp.net`)
            .maybeSingle();
          if (convo?.profile_pic_url) {
            setImagePreview(convo.profile_pic_url);
          }
        }
      } catch {}
    })();

    // Load privacy settings
    setIsLoadingPrivacy(true);
    supabase.functions.invoke('uazapi-api', {
      body: { action: 'get-privacy', chipId },
    }).then(({ data }) => {
      if (data?.data) {
        const p = data.data.privacy || data.data;
        setPrivacy({
          profile_picture: p.profile_picture || p.profilePicture || 'all',
          last_seen: p.last_seen || p.lastSeen || 'all',
          online: p.online || 'all',
          read_receipts: p.read_receipts || p.readReceipts || 'all',
          groups: p.groups || 'all',
          calls: p.calls || 'all',
          status: p.status || 'all',
        });
      }
    }).catch(() => {}).finally(() => setIsLoadingPrivacy(false));

    // Load business profile
    setIsLoadingBusiness(true);
    supabase.functions.invoke('uazapi-api', {
      body: { action: 'get-business-profile', chipId },
    }).then(({ data }) => {
      if (data?.data) {
        const b = data.data;
        setBusinessProfile({
          description: b.description || '',
          address: b.address || '',
          email: b.email || '',
          category: b.category || '',
          website: b.website || [],
        });
      }
    }).catch(() => {}).finally(() => setIsLoadingBusiness(false));
  }, [open, chipId]);

  const handleImageSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      setImageBase64(result);
      setImagePreview(result);
    };
    reader.readAsDataURL(file);
  };

  const handleSaveName = async () => {
    if (!chipId || !profileName.trim()) return;
    setIsSaving(true);
    try {
      const res = await supabase.functions.invoke('uazapi-api', {
        body: { action: 'update-profile-name', chipId, profileName: profileName.trim() },
      });
      if (res.data?.success) {
        toast({ title: 'Nome do perfil atualizado' });
        setProfileName('');
      } else {
        toast({ title: 'Erro', description: 'Não foi possível atualizar o nome.', variant: 'destructive' });
      }
    } catch {
      toast({ title: 'Erro', description: 'Falha ao atualizar nome.', variant: 'destructive' });
    } finally {
      setIsSaving(false);
    }
  };

  const handleSaveImage = async () => {
    if (!chipId || !imageBase64) return;
    setIsSaving(true);
    try {
      const res = await supabase.functions.invoke('uazapi-api', {
        body: { action: 'update-profile-image', chipId, profileImage: imageBase64 },
      });
      if (res.data?.success) {
        toast({ title: 'Foto do perfil atualizada' });
        setImagePreview(null);
        setImageBase64(null);
      } else {
        toast({ title: 'Erro', description: 'Não foi possível atualizar a foto.', variant: 'destructive' });
      }
    } catch {
      toast({ title: 'Erro', description: 'Falha ao atualizar foto.', variant: 'destructive' });
    } finally {
      setIsSaving(false);
    }
  };

  const handleSavePrivacy = async (key: string, value: string) => {
    if (!chipId) return;
    const updated = { ...privacy, [key]: value };
    setPrivacy(updated);
    try {
      await supabase.functions.invoke('uazapi-api', {
        body: { action: 'set-privacy', chipId, privacy: { [key]: value } },
      });
      toast({ title: 'Privacidade atualizada' });
    } catch {
      toast({ title: 'Erro ao atualizar privacidade', variant: 'destructive' });
    }
  };

  const handleSaveBusiness = async () => {
    if (!chipId) return;
    setIsSaving(true);
    try {
      await supabase.functions.invoke('uazapi-api', {
        body: { action: 'update-business-profile', chipId, businessProfile },
      });
      toast({ title: 'Perfil Business atualizado' });
    } catch {
      toast({ title: 'Erro ao atualizar perfil business', variant: 'destructive' });
    } finally {
      setIsSaving(false);
    }
  };

  const privacyOptions = [
    { value: 'all', label: 'Todos' },
    { value: 'contacts', label: 'Contatos' },
    { value: 'none', label: 'Ninguém' },
  ];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Configurações do WhatsApp</DialogTitle>
          <DialogDescription>Gerencie perfil, privacidade e configurações business</DialogDescription>
        </DialogHeader>

        <Tabs defaultValue="profile" className="w-full">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="profile" className="text-xs"><User className="w-3.5 h-3.5 mr-1" />Perfil</TabsTrigger>
            <TabsTrigger value="privacy" className="text-xs"><Shield className="w-3.5 h-3.5 mr-1" />Privacidade</TabsTrigger>
            <TabsTrigger value="business" className="text-xs"><Building2 className="w-3.5 h-3.5 mr-1" />Business</TabsTrigger>
          </TabsList>

          {/* Profile Tab */}
          <TabsContent value="profile" className="space-y-4 mt-4">
            <div className="space-y-2">
              <Label>Nome do Perfil</Label>
              <div className="flex gap-2">
                <Input
                  value={profileName}
                  onChange={(e) => setProfileName(e.target.value)}
                  placeholder="Novo nome do perfil"
                />
                <Button onClick={handleSaveName} disabled={isSaving || !profileName.trim()} size="sm">
                  {isSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <User className="w-4 h-4" />}
                </Button>
              </div>
            </div>

            <Separator />

            <div className="space-y-2">
              <Label>Foto do Perfil</Label>
              <div className="flex items-center gap-4">
                {imagePreview ? (
                  <img src={imagePreview} alt="Preview" className="w-16 h-16 rounded-full object-cover border-2 border-border" />
                ) : (
                  <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center border-2 border-border">
                    <Camera className="w-6 h-6 text-muted-foreground" />
                  </div>
                )}
                <div className="flex-1 space-y-2">
                  <Input
                    type="file"
                    accept="image/jpeg,image/png"
                    onChange={handleImageSelect}
                    className="text-sm"
                  />
                  <p className="text-xs text-muted-foreground">JPEG recomendado, 640x640px</p>
                </div>
              </div>
              {imageBase64 && (
                <Button onClick={handleSaveImage} disabled={isSaving} className="w-full" size="sm">
                  {isSaving ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Camera className="w-4 h-4 mr-2" />}
                  Atualizar Foto
                </Button>
              )}
            </div>
          </TabsContent>

          {/* Privacy Tab */}
          <TabsContent value="privacy" className="space-y-4 mt-4">
            {isLoadingPrivacy ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
              </div>
            ) : (
              <>
                <PrivacySelect
                  label="Foto do Perfil"
                  description="Quem pode ver sua foto"
                  value={privacy.profile_picture || 'all'}
                  options={privacyOptions}
                  onChange={(v) => handleSavePrivacy('profile_picture', v)}
                />
                <PrivacySelect
                  label="Visto por Último"
                  description="Quem pode ver quando esteve online"
                  value={privacy.last_seen || 'all'}
                  options={privacyOptions}
                  onChange={(v) => handleSavePrivacy('last_seen', v)}
                />
                <PrivacySelect
                  label="Status Online"
                  description="Quem pode ver quando está online"
                  value={privacy.online || 'all'}
                  options={[
                    { value: 'all', label: 'Todos' },
                    { value: 'match_last_seen', label: 'Mesmo que visto por último' },
                  ]}
                  onChange={(v) => handleSavePrivacy('online', v)}
                />
                <PrivacySelect
                  label="Confirmação de Leitura"
                  description="Enviar confirmação de leitura (✓✓ azul)"
                  value={privacy.read_receipts || 'all'}
                  options={[
                    { value: 'all', label: 'Ativado' },
                    { value: 'none', label: 'Desativado' },
                  ]}
                  onChange={(v) => handleSavePrivacy('read_receipts', v)}
                />
                <PrivacySelect
                  label="Grupos"
                  description="Quem pode adicionar a grupos"
                  value={privacy.groups || 'all'}
                  options={[
                    { value: 'all', label: 'Todos' },
                    { value: 'contacts', label: 'Meus contatos' },
                    { value: 'contact_blacklist', label: 'Exceto bloqueados' },
                  ]}
                  onChange={(v) => handleSavePrivacy('groups', v)}
                />
                <PrivacySelect
                  label="Chamadas"
                  description="Quem pode fazer chamadas"
                  value={privacy.calls || 'all'}
                  options={[
                    { value: 'all', label: 'Todos' },
                    { value: 'known', label: 'Conhecidos' },
                  ]}
                  onChange={(v) => handleSavePrivacy('calls', v)}
                />
              </>
            )}
          </TabsContent>

          {/* Business Tab */}
          <TabsContent value="business" className="space-y-4 mt-4">
            {isLoadingBusiness ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
              </div>
            ) : (
              <>
                <p className="text-xs text-muted-foreground">
                  Disponível apenas para números WhatsApp Business. Campos experimentais.
                </p>
                <div className="space-y-2">
                  <Label>Descrição</Label>
                  <Textarea
                    value={businessProfile.description || ''}
                    onChange={(e) => setBusinessProfile(p => ({ ...p, description: e.target.value }))}
                    placeholder="Descrição da empresa"
                    rows={3}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Endereço</Label>
                  <Input
                    value={businessProfile.address || ''}
                    onChange={(e) => setBusinessProfile(p => ({ ...p, address: e.target.value }))}
                    placeholder="Endereço da empresa"
                  />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-2">
                    <Label>E-mail</Label>
                    <Input
                      value={businessProfile.email || ''}
                      onChange={(e) => setBusinessProfile(p => ({ ...p, email: e.target.value }))}
                      placeholder="email@empresa.com"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Categoria</Label>
                    <Input
                      value={businessProfile.category || ''}
                      onChange={(e) => setBusinessProfile(p => ({ ...p, category: e.target.value }))}
                      placeholder="Ex: Loja"
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label>Website</Label>
                  <Input
                    value={(businessProfile.website || [])[0] || ''}
                    onChange={(e) => setBusinessProfile(p => ({ ...p, website: [e.target.value] }))}
                    placeholder="https://..."
                  />
                </div>
                <Button onClick={handleSaveBusiness} disabled={isSaving} className="w-full" size="sm">
                  {isSaving ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Building2 className="w-4 h-4 mr-2" />}
                  Salvar Perfil Business
                </Button>
              </>
            )}
          </TabsContent>
        </Tabs>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Fechar</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function PrivacySelect({ label, description, value, options, onChange }: {
  label: string;
  description: string;
  value: string;
  options: { value: string; label: string }[];
  onChange: (v: string) => void;
}) {
  return (
    <div className="flex items-center justify-between gap-4">
      <div className="min-w-0">
        <p className="text-sm font-medium">{label}</p>
        <p className="text-xs text-muted-foreground">{description}</p>
      </div>
      <Select value={value} onValueChange={onChange}>
        <SelectTrigger className="w-[140px] h-8 text-xs">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {options.map(opt => (
            <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}
