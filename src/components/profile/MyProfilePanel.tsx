import { useState, useRef, useEffect } from 'react';
import { Camera, KeyRound, Loader2, User, Mail, Shield, Calendar, Phone } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { validateBrazilianPhone } from '@/lib/phoneUtils';

interface MyProfilePanelProps {
  className?: string;
}

export default function MyProfilePanel({ className }: MyProfilePanelProps) {
  const { user, userRole } = useAuth();
  const { toast } = useToast();
  const [profile, setProfile] = useState<{ name: string | null; avatar_url: string | null; email: string; created_at: string; phone: string | null } | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [editName, setEditName] = useState('');
  const [isEditingName, setIsEditingName] = useState(false);
  const [editPhone, setEditPhone] = useState('');
  const [isEditingPhone, setIsEditingPhone] = useState(false);
  const [isSavingPhone, setIsSavingPhone] = useState(false);
  const [passwordDialogOpen, setPasswordDialogOpen] = useState(false);
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const avatarInputRef = useRef<HTMLInputElement>(null);

  const getRoleLabel = () => {
    switch (userRole) {
      case 'master': return 'Master';
      case 'admin': return 'Administrador';
      case 'support': return 'Suporte';
      case 'seller': return 'Vendedor';
      default: return userRole;
    }
  };

  useEffect(() => {
    if (!user) return;
    (async () => {
      const { data } = await (supabase as any)
        .from('profiles')
        .select('name, avatar_url, email, created_at, phone')
        .eq('user_id', user.id)
        .single();
      if (data) setProfile(data);
      setIsLoading(false);
    })();
  }, [user]);

  const handleSaveName = async () => {
    if (!editName.trim()) {
      toast({ title: 'Digite um nome', variant: 'destructive' });
      return;
    }
    setIsSaving(true);
    try {
      const { error } = await supabase.rpc('update_own_profile', { _name: editName.trim() });
      if (error) throw error;
      setProfile(prev => prev ? { ...prev, name: editName.trim() } : prev);
      setIsEditingName(false);
      toast({ title: 'Nome atualizado com sucesso' });
    } catch (error: any) {
      toast({ title: 'Erro', description: error.message, variant: 'destructive' });
    } finally {
      setIsSaving(false);
    }
  };

  const handleSavePhone = async () => {
    if (!user) return;
    // Aceita vazio (limpa) ou normaliza via validateBrazilianPhone (aceita com/sem 55).
    let phoneToSave = '';
    if (editPhone.trim()) {
      const check = validateBrazilianPhone(editPhone);
      if (!check.valid) {
        toast({
          title: 'Telefone inválido',
          description: check.reason || 'Use o formato (11) 99999-9999.',
          variant: 'destructive',
        });
        return;
      }
      // Salvamos no formato E.164 (com 55) — compatível com sistema legado de envios.
      phoneToSave = check.e164;
    }
    setIsSavingPhone(true);
    try {
      const { error } = await (supabase as any)
        .from('profiles')
        .update({ phone: phoneToSave || null })
        .eq('user_id', user.id);
      if (error) throw error;
      setProfile(prev => prev ? { ...prev, phone: phoneToSave || null } : prev);
      setIsEditingPhone(false);
      toast({ title: 'Telefone atualizado' });
    } catch (error: any) {
      toast({ title: 'Erro', description: error.message, variant: 'destructive' });
    } finally {
      setIsSavingPhone(false);
    }
  };

  const handleAvatarUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !user) return;
    setIsSaving(true);
    try {
      const ext = (file.name.split('.').pop() || 'jpg').toLowerCase();
      const path = `avatars/${user.id}/${Date.now()}.${ext}`;
      const { error: uploadError } = await supabase.storage
        .from('internal-chat-media')
        .upload(path, file);
      if (uploadError) throw uploadError;
      const { data: urlData } = supabase.storage.from('internal-chat-media').getPublicUrl(path);
      const avatarUrl = urlData.publicUrl;
      const { error: updateError } = await supabase.rpc('update_own_profile', { _avatar_url: avatarUrl });
      if (updateError) throw updateError;
      setProfile(prev => prev ? { ...prev, avatar_url: avatarUrl } : prev);
      toast({ title: 'Avatar atualizado com sucesso' });
    } catch (error: any) {
      toast({ title: 'Erro ao atualizar avatar', description: error.message, variant: 'destructive' });
    } finally {
      setIsSaving(false);
      if (avatarInputRef.current) avatarInputRef.current.value = '';
    }
  };

  const handleChangePassword = async () => {
    if (newPassword.length < 6) {
      toast({ title: 'Senha deve ter pelo menos 6 caracteres', variant: 'destructive' });
      return;
    }
    if (newPassword !== confirmPassword) {
      toast({ title: 'As senhas não coincidem', variant: 'destructive' });
      return;
    }
    setIsSaving(true);
    try {
      const { error } = await supabase.auth.updateUser({ password: newPassword });
      if (error) throw error;
      toast({ title: 'Senha alterada com sucesso' });
      setPasswordDialogOpen(false);
      setNewPassword('');
      setConfirmPassword('');
    } catch (error: any) {
      toast({ title: 'Erro', description: error.message, variant: 'destructive' });
    } finally {
      setIsSaving(false);
    }
  };

  if (isLoading) {
    return (
      <div className={`flex items-center justify-center py-12 ${className || ''}`}>
        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className={`max-w-md mx-auto space-y-6 ${className || ''}`}>
      <input ref={avatarInputRef} type="file" accept="image/*" className="hidden" onChange={handleAvatarUpload} />

      {/* Avatar */}
      <div className="flex flex-col items-center gap-3">
        <div className="relative group">
          <Avatar className="w-24 h-24">
            {profile?.avatar_url ? (
              <AvatarImage src={profile.avatar_url} alt="Avatar" />
            ) : null}
            <AvatarFallback className="text-2xl bg-primary/20 text-primary">
              {(profile?.name || profile?.email || '?').charAt(0).toUpperCase()}
            </AvatarFallback>
          </Avatar>
          <button
            onClick={() => avatarInputRef.current?.click()}
            disabled={isSaving}
            className="absolute inset-0 flex items-center justify-center bg-black/50 rounded-full opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer"
          >
            {isSaving ? <Loader2 className="w-5 h-5 animate-spin text-white" /> : <Camera className="w-5 h-5 text-white" />}
          </button>
        </div>
        <p className="text-xs text-muted-foreground">Clique para alterar a foto</p>
      </div>

      {/* Info fields */}
      <div className="space-y-4">
        {/* Nome */}
        <div className="flex items-start gap-3 p-3 rounded-lg bg-accent/30">
          <User className="w-4 h-4 mt-1 text-muted-foreground shrink-0" />
          <div className="flex-1 min-w-0">
            <p className="text-xs text-muted-foreground">Nome</p>
            {isEditingName ? (
              <div className="flex items-center gap-2 mt-1">
                <Input
                  value={editName}
                  onChange={e => setEditName(e.target.value)}
                  className="h-8 text-sm"
                  placeholder="Seu nome"
                  autoFocus
                  onKeyDown={e => e.key === 'Enter' && handleSaveName()}
                />
                <Button size="sm" onClick={handleSaveName} disabled={isSaving} className="h-8 text-xs">
                  {isSaving ? <Loader2 className="w-3 h-3 animate-spin" /> : 'Salvar'}
                </Button>
                <Button size="sm" variant="ghost" onClick={() => setIsEditingName(false)} className="h-8 text-xs">
                  Cancelar
                </Button>
              </div>
            ) : (
              <div className="flex items-center gap-2">
                <p className="text-sm font-medium">{profile?.name || 'Sem nome'}</p>
                <Button size="sm" variant="ghost" className="h-6 text-xs text-primary" onClick={() => { setEditName(profile?.name || ''); setIsEditingName(true); }}>
                  Editar
                </Button>
              </div>
            )}
          </div>
        </div>

        {/* Email */}
        <div className="flex items-start gap-3 p-3 rounded-lg bg-accent/30">
          <Mail className="w-4 h-4 mt-1 text-muted-foreground shrink-0" />
          <div className="flex-1 min-w-0">
            <p className="text-xs text-muted-foreground">Email</p>
            <p className="text-sm font-medium truncate">{profile?.email}</p>
          </div>
        </div>

        {/* Telefone WhatsApp */}
        <div className="flex items-start gap-3 p-3 rounded-lg bg-accent/30">
          <Phone className="w-4 h-4 mt-1 text-muted-foreground shrink-0" />
          <div className="flex-1 min-w-0">
            <p className="text-xs text-muted-foreground">Telefone WhatsApp</p>
            {isEditingPhone ? (
              <div className="flex items-center gap-2 mt-1">
                <Input
                  value={editPhone}
                  onChange={e => setEditPhone(e.target.value)}
                  className="h-8 text-sm"
                  placeholder="(11) 99999-9999"
                  autoFocus
                  onKeyDown={e => e.key === 'Enter' && handleSavePhone()}
                />
                <Button size="sm" onClick={handleSavePhone} disabled={isSavingPhone} className="h-8 text-xs">
                  {isSavingPhone ? <Loader2 className="w-3 h-3 animate-spin" /> : 'Salvar'}
                </Button>
                <Button size="sm" variant="ghost" onClick={() => setIsEditingPhone(false)} className="h-8 text-xs">
                  Cancelar
                </Button>
              </div>
            ) : (
              <div className="flex items-center gap-2">
                <p className="text-sm font-medium">{profile?.phone || 'Não cadastrado'}</p>
                <Button
                  size="sm"
                  variant="ghost"
                  className="h-6 text-xs text-primary"
                  onClick={() => { setEditPhone(profile?.phone || ''); setIsEditingPhone(true); }}
                >
                  Editar
                </Button>
              </div>
            )}
            <p className="text-[10px] text-muted-foreground mt-1">
              Digite com DDD (ex: (11) 99999-9999). O código do país (55) é adicionado automaticamente. Usado para lembretes de entrevistas de RH.
            </p>
          </div>
        </div>

        {/* Role */}
        <div className="flex items-start gap-3 p-3 rounded-lg bg-accent/30">
          <Shield className="w-4 h-4 mt-1 text-muted-foreground shrink-0" />
          <div className="flex-1 min-w-0">
            <p className="text-xs text-muted-foreground">Cargo</p>
            <p className="text-sm font-medium">{getRoleLabel()}</p>
          </div>
        </div>

        {/* Member since */}
        <div className="flex items-start gap-3 p-3 rounded-lg bg-accent/30">
          <Calendar className="w-4 h-4 mt-1 text-muted-foreground shrink-0" />
          <div className="flex-1 min-w-0">
            <p className="text-xs text-muted-foreground">Membro desde</p>
            <p className="text-sm font-medium">
              {profile?.created_at
                ? format(new Date(profile.created_at), "dd 'de' MMMM 'de' yyyy", { locale: ptBR })
                : '—'}
            </p>
          </div>
        </div>

        {/* Password */}
        <Button variant="outline" className="w-full justify-start gap-2" onClick={() => setPasswordDialogOpen(true)}>
          <KeyRound className="w-4 h-4" />
          Alterar Senha
        </Button>
      </div>

      {/* Password Dialog */}
      <Dialog open={passwordDialogOpen} onOpenChange={setPasswordDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Alterar Senha</DialogTitle>
            <DialogDescription>Digite sua nova senha</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="new-password">Nova Senha</Label>
              <Input id="new-password" type="password" value={newPassword} onChange={e => setNewPassword(e.target.value)} placeholder="Mínimo 6 caracteres" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="confirm-password">Confirmar Senha</Label>
              <Input id="confirm-password" type="password" value={confirmPassword} onChange={e => setConfirmPassword(e.target.value)} placeholder="Repita a senha" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setPasswordDialogOpen(false)}>Cancelar</Button>
            <Button onClick={handleChangePassword} disabled={isSaving}>
              {isSaving && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              Alterar Senha
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
