import { useState } from 'react';
import { Plus, Loader2, Eye, EyeOff } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from '@/components/ui/dialog';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

interface UserCreateDialogProps {
  canChooseRole: boolean;
  isMaster: boolean;
  isRegularAdmin: boolean;
  onUserCreated: () => void;
}

export function UserCreateDialog({ canChooseRole, isMaster, isRegularAdmin, onUserCreated }: UserCreateDialogProps) {
  const { toast } = useToast();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [newUserEmail, setNewUserEmail] = useState('');
  const [newUserPassword, setNewUserPassword] = useState('');
  const [newUserName, setNewUserName] = useState('');
  const [newUserRole, setNewUserRole] = useState<'admin' | 'manager' | 'seller' | 'support'>('seller');
  const [showPassword, setShowPassword] = useState(false);

  const handleCreateUser = async () => {
    if (!newUserEmail || !newUserPassword) {
      toast({ title: 'Erro', description: 'Preencha email e senha', variant: 'destructive' });
      return;
    }
    if (newUserPassword.length < 6) {
      toast({ title: 'Erro', description: 'Senha deve ter pelo menos 6 caracteres', variant: 'destructive' });
      return;
    }

    setIsCreating(true);
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData?.session?.access_token;
      if (!token) throw new Error('Sessão expirada');

      const roleToCreate = canChooseRole ? newUserRole : 'seller';

      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/create-user`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
          body: JSON.stringify({ email: newUserEmail, password: newUserPassword, name: newUserName || null, role: roleToCreate }),
        }
      );

      const result = await response.json();
      if (!response.ok) throw new Error(result.error || 'Erro ao criar usuário');

      toast({ title: 'Usuário criado', description: 'O usuário foi criado com sucesso' });
      setDialogOpen(false);
      setNewUserEmail('');
      setNewUserPassword('');
      setNewUserName('');
      setNewUserRole('seller');
      onUserCreated();
    } catch (error: any) {
      console.error('Error creating user:', error);
      toast({ title: 'Erro ao criar usuário', description: error.message || 'Tente novamente', variant: 'destructive' });
    } finally {
      setIsCreating(false);
    }
  };

  return (
    <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
      <DialogTrigger asChild>
        <Button>
          <Plus className="w-4 h-4 mr-2" />
          {canChooseRole ? 'Novo Usuário' : 'Novo Vendedor'}
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{canChooseRole ? 'Criar Novo Usuário' : 'Criar Novo Vendedor'}</DialogTitle>
          <DialogDescription>Preencha os dados para criar uma nova conta</DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="name">Nome (opcional)</Label>
            <Input id="name" placeholder="Nome do usuário" value={newUserName} onChange={(e) => setNewUserName(e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="email">Email</Label>
            <Input id="email" type="email" placeholder="email@exemplo.com" value={newUserEmail} onChange={(e) => setNewUserEmail(e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="password">Senha</Label>
            <div className="relative">
              <Input id="password" type={showPassword ? 'text' : 'password'} placeholder="Mínimo 6 caracteres" value={newUserPassword} onChange={(e) => setNewUserPassword(e.target.value)} className="pr-10" />
              <Button type="button" variant="ghost" size="sm" className="absolute right-0 top-0 h-full px-3 hover:bg-transparent" onClick={() => setShowPassword(!showPassword)}>
                {showPassword ? <EyeOff className="w-4 h-4 text-muted-foreground" /> : <Eye className="w-4 h-4 text-muted-foreground" />}
              </Button>
            </div>
          </div>
          {canChooseRole && (
            <div className="space-y-3">
              <Label>Tipo de Usuário</Label>
              <RadioGroup value={newUserRole} onValueChange={(value) => setNewUserRole(value as any)} className="flex flex-wrap gap-4">
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="seller" id="role-seller" />
                  <Label htmlFor="role-seller" className="cursor-pointer">Vendedor</Label>
                </div>
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="support" id="role-support" />
                  <Label htmlFor="role-support" className="cursor-pointer">Suporte</Label>
                </div>
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="manager" id="role-manager" />
                  <Label htmlFor="role-manager" className="cursor-pointer">Gerente</Label>
                </div>
                {isMaster && (
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="admin" id="role-admin" />
                    <Label htmlFor="role-admin" className="cursor-pointer">Administrador</Label>
                  </div>
                )}
              </RadioGroup>
            </div>
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancelar</Button>
          <Button onClick={handleCreateUser} disabled={isCreating}>
            {isCreating ? (
              <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Criando...</>
            ) : (
              isMaster || isRegularAdmin ? 'Criar Usuário' : 'Criar Vendedor'
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
