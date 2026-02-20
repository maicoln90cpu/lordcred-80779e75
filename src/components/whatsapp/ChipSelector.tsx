import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus, Smartphone, WifiOff, Loader2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { useToast } from '@/hooks/use-toast';
import ChipConnectDialog from './ChipConnectDialog';

interface Chip {
  id: string;
  phone_number: string | null;
  instance_name: string;
  status: string;
  slot_number: number;
}

interface ChipSelectorProps {
  selectedChipId: string | null;
  onSelectChip: (chipId: string) => void;
}

export default function ChipSelector({ selectedChipId, onSelectChip }: ChipSelectorProps) {
  const [chips, setChips] = useState<Chip[]>([]);
  const [connectDialogOpen, setConnectDialogOpen] = useState(false);
  const [disconnectDialogOpen, setDisconnectDialogOpen] = useState(false);
  const [chipToDisconnect, setChipToDisconnect] = useState<Chip | null>(null);
  const [isDisconnecting, setIsDisconnecting] = useState(false);
  const { user, isSeller } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();

  const fetchChips = async () => {
    if (!user) return;
    const query = supabase
      .from('chips')
      .select('id, phone_number, instance_name, status, slot_number')
      .eq('user_id', user.id)
      .eq('status', 'connected')
      .order('slot_number')
      .limit(5);
    
    const { data } = await (query as any).eq('chip_type', 'whatsapp');

    if (data && data.length > 0) {
      setChips(data);
      if (!selectedChipId) {
        onSelectChip(data[0].id);
      }
    } else {
      setChips([]);
    }
  };

  useEffect(() => {
    fetchChips();
  }, [user]);

  const handleAddChip = () => {
    if (isSeller) {
      setConnectDialogOpen(true);
    } else {
      navigate('/chips');
    }
  };

  const handleDisconnectClick = (chip: Chip) => {
    setChipToDisconnect(chip);
    setDisconnectDialogOpen(true);
  };

  const handleDisconnect = async () => {
    if (!chipToDisconnect) return;
    setIsDisconnecting(true);

    try {
      // Get provider settings
      const { data: settings } = await supabase
        .from('system_settings')
        .select('whatsapp_provider')
        .limit(1)
        .single();

      const provider = settings?.whatsapp_provider || 'evolution';
      const fn = provider === 'uazapi' ? 'uazapi-api' : 'evolution-api';

      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error('Sessão expirada');

      // Call logout-instance (graceful disconnect)
      await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/${fn}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({ action: 'logout-instance', instanceName: chipToDisconnect.instance_name }),
      });

      // Update status in database
      await supabase
        .from('chips')
        .update({ status: 'disconnected' })
        .eq('id', chipToDisconnect.id);

      toast({ title: 'Chip desconectado', description: `${chipToDisconnect.phone_number || chipToDisconnect.instance_name} foi desconectado` });

      // If this was the selected chip, clear selection
      if (selectedChipId === chipToDisconnect.id) {
        onSelectChip('');
      }

      fetchChips();
    } catch (error: any) {
      console.error('Error disconnecting:', error);
      toast({ title: 'Erro ao desconectar', description: error.message, variant: 'destructive' });
    } finally {
      setIsDisconnecting(false);
      setDisconnectDialogOpen(false);
      setChipToDisconnect(null);
    }
  };

  return (
    <>
      <div className="flex items-center gap-1 overflow-x-auto">
        {chips.map((chip) => (
          <DropdownMenu key={chip.id}>
            <DropdownMenuTrigger asChild>
              <button
                onClick={() => onSelectChip(chip.id)}
                className={cn(
                  "flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm whitespace-nowrap transition-colors",
                  selectedChipId === chip.id
                    ? "bg-primary text-primary-foreground"
                    : "bg-secondary/50 text-muted-foreground hover:bg-secondary"
                )}
              >
                <Smartphone className="w-3.5 h-3.5" />
                <span>{(chip as any).nickname || chip.phone_number || chip.instance_name}</span>
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start">
              <DropdownMenuLabel className="text-xs font-normal text-muted-foreground">
                {chip.phone_number || 'Sem número'}
              </DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                className="text-destructive focus:text-destructive cursor-pointer"
                onClick={() => handleDisconnectClick(chip)}
              >
                <WifiOff className="w-4 h-4 mr-2" />
                Desconectar
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        ))}
        {chips.length === 0 && (
          <span className="text-sm text-muted-foreground">Nenhum chip conectado</span>
        )}
        <Button variant="ghost" size="sm" className="text-muted-foreground hover:text-foreground ml-1" onClick={handleAddChip}>
          <Plus className="w-4 h-4" />
        </Button>
      </div>

      <ChipConnectDialog
        open={connectDialogOpen}
        onOpenChange={setConnectDialogOpen}
        onChipConnected={fetchChips}
      />

      {/* Disconnect Confirmation */}
      <AlertDialog open={disconnectDialogOpen} onOpenChange={setDisconnectDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Desconectar Chip</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja desconectar o chip {chipToDisconnect?.phone_number || chipToDisconnect?.instance_name}?
              A sessão do WhatsApp será encerrada, mas a instância será mantida para reconexão futura.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDisconnecting}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDisconnect}
              disabled={isDisconnecting}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {isDisconnecting ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <WifiOff className="w-4 h-4 mr-2" />}
              Desconectar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
