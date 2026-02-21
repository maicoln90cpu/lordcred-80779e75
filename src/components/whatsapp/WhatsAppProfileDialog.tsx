import { useState } from 'react';
import { User, Camera, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

interface WhatsAppProfileDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  chipId: string | null;
}

export default function WhatsAppProfileDialog({ open, onOpenChange, chipId }: WhatsAppProfileDialogProps) {
  const { toast } = useToast();
  const [profileName, setProfileName] = useState('');
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [imageBase64, setImageBase64] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

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

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Configurações do WhatsApp</DialogTitle>
          <DialogDescription>Altere o nome e foto de perfil do número conectado</DialogDescription>
        </DialogHeader>
        <div className="space-y-6 py-4">
          {/* Profile Name */}
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

          {/* Profile Image */}
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
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Fechar</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
