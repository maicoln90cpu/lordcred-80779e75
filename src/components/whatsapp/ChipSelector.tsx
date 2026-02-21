import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus, Smartphone, WifiOff, Loader2, ChevronDown, Settings, QrCode, Trash2, RefreshCw } from 'lucide-react';
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
  nickname?: string | null;
}

interface ChipSelectorProps {
  selectedChipId: string | null;
  onSelectChip: (chipId: string) => void;
  unreadCounts?: Record<string, number>;
  onOpenSettings?: (chipId: string) => void;
}

export default function ChipSelector({ selectedChipId, onSelectChip, unreadCounts = {}, onOpenSettings }: ChipSelectorProps) {
  const [chips, setChips] = useState<Chip[]>([]);
  const [connectDialogOpen, setConnectDialogOpen] = useState(false);
  const [reconnectInstanceName, setReconnectInstanceName] = useState<string | null>(null);
  const [disconnectDialogOpen, setDisconnectDialogOpen] = useState(false);
  const [reconnectDialogOpen, setReconnectDialogOpen] = useState(false);
  const [removeDialogOpen, setRemoveDialogOpen] = useState(false);
  const [chipToReconnect, setChipToReconnect] = useState<Chip | null>(null);
  const [chipToDisconnect, setChipToDisconnect] = useState<Chip | null>(null);
  const [chipToRemove, setChipToRemove] = useState<Chip | null>(null);
  const [isDisconnecting, setIsDisconnecting] = useState(false);
  const [isRemoving, setIsRemoving] = useState(false);
  const { user, isSeller } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();

  const fetchChips = async () => {
    if (!user) return;
    const { data } = await (supabase
      .from('chips')
      .select('id, phone_number, instance_name, status, slot_number, nickname')
      .eq('user_id', user.id)
      .order('slot_number')
      .limit(5) as any).eq('chip_type', 'whatsapp');

    if (data && data.length > 0) {
      setChips(data);
      if (!selectedChipId) {
        const connected = data.find((c: Chip) => c.status === 'connected');
        if (connected) onSelectChip(connected.id);
        else onSelectChip(data[0].id);
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
      setReconnectInstanceName(null);
      setConnectDialogOpen(true);
    } else {
      navigate('/chips');
    }
  };

  const handleReconnectChip = (chip: Chip) => {
    setReconnectInstanceName(chip.instance_name);
    setConnectDialogOpen(true);
  };

  const handleDisconnectClick = (chip: Chip) => {
    setChipToDisconnect(chip);
    setDisconnectDialogOpen(true);
  };

  const handleRemoveClick = (chip: Chip) => {
    setChipToRemove(chip);
    setRemoveDialogOpen(true);
  };

  const handleDisconnect = async () => {
    if (!chipToDisconnect) return;
    setIsDisconnecting(true);

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error('Sessão expirada');

      await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/uazapi-api`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({ action: 'logout-instance', instanceName: chipToDisconnect.instance_name }),
      });

      await supabase
        .from('chips')
        .update({ status: 'disconnected' })
        .eq('id', chipToDisconnect.id);

      toast({ title: 'Chip desconectado', description: `${chipToDisconnect.phone_number || chipToDisconnect.instance_name} foi desconectado` });

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

  const handleRemove = async () => {
    if (!chipToRemove) return;
    setIsRemoving(true);
    try {
      await supabase.from('chips').delete().eq('id', chipToRemove.id);
      toast({ title: 'Chip removido' });
      if (selectedChipId === chipToRemove.id) onSelectChip('');
      fetchChips();
    } catch (error: any) {
      toast({ title: 'Erro ao remover', description: error.message, variant: 'destructive' });
    } finally {
      setIsRemoving(false);
      setRemoveDialogOpen(false);
      setChipToRemove(null);
    }
  };

  return (
    <>
      <div className="flex items-center gap-1 overflow-x-auto">
        {chips.map((chip) => {
          const unread = unreadCounts[chip.id] || 0;
          const isConnected = chip.status === 'connected';
          return (
          <div key={chip.id} className="flex items-center relative">
            <button
              onClick={() => {
                if (!isConnected) {
                  setChipToReconnect(chip);
                  setReconnectDialogOpen(true);
                } else {
                  onSelectChip(chip.id);
                }
              }}
              className={cn(
                "flex items-center gap-2 px-3 py-1.5 rounded-l-lg text-sm whitespace-nowrap transition-colors",
                !isConnected
                  ? "bg-destructive/10 text-destructive border border-destructive/20"
                  : selectedChipId === chip.id
                    ? "bg-primary text-primary-foreground"
                    : "bg-secondary/50 text-muted-foreground hover:bg-secondary"
              )}
            >
              {isConnected ? (
                <Smartphone className="w-3.5 h-3.5" />
              ) : (
                <WifiOff className="w-3.5 h-3.5" />
              )}
              <span>{chip.nickname || chip.phone_number || chip.instance_name}</span>
              {!isConnected && (
                <span className="text-[10px] font-medium">(offline)</span>
              )}
              {isConnected && unread > 0 && (
                <span className="ml-1 min-w-[18px] h-[18px] rounded-full bg-destructive text-destructive-foreground text-[10px] font-bold flex items-center justify-center px-1">
                  {unread > 99 ? '99+' : unread}
                </span>
              )}
            </button>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button
                  className={cn(
                    "px-1 py-1.5 rounded-r-lg text-sm transition-colors border-l",
                    !isConnected
                      ? "bg-destructive/10 text-destructive border-destructive/20"
                      : selectedChipId === chip.id
                        ? "bg-primary/80 text-primary-foreground border-primary-foreground/20"
                        : "bg-secondary/50 text-muted-foreground hover:bg-secondary border-border/50"
                  )}
                >
                  <ChevronDown className="w-3 h-3" />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start">
                <DropdownMenuLabel className="text-xs font-normal text-muted-foreground">
                  {chip.phone_number || 'Sem número'}
                </DropdownMenuLabel>
                <DropdownMenuSeparator />
                {isConnected ? (
                  <>
                    <DropdownMenuItem onClick={() => onOpenSettings?.(chip.id)}>
                      <Settings className="w-4 h-4 mr-2" />
                      Configurações
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem
                      className="text-destructive focus:text-destructive cursor-pointer"
                      onClick={() => handleDisconnectClick(chip)}
                    >
                      <WifiOff className="w-4 h-4 mr-2" />
                      Desconectar
                    </DropdownMenuItem>
                  </>
                ) : (
                  <>
                    <DropdownMenuItem onClick={() => handleReconnectChip(chip)}>
                      <RefreshCw className="w-4 h-4 mr-2" />
                      Reconectar
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem
                      className="text-destructive focus:text-destructive cursor-pointer"
                      onClick={() => handleRemoveClick(chip)}
                    >
                      <Trash2 className="w-4 h-4 mr-2" />
                      Remover chip
                    </DropdownMenuItem>
                  </>
                )}
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
          );
        })}
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
        reconnectInstanceName={reconnectInstanceName}
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

      {/* Remove chip confirmation */}
      <AlertDialog open={removeDialogOpen} onOpenChange={setRemoveDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remover Chip</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja remover o chip {chipToRemove?.phone_number || chipToRemove?.instance_name}?
              O chip será removido do sistema e não aparecerá mais no seletor.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isRemoving}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleRemove}
              disabled={isRemoving}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {isRemoving ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Trash2 className="w-4 h-4 mr-2" />}
              Remover
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Reconnect Dialog for disconnected chips */}
      <AlertDialog open={reconnectDialogOpen} onOpenChange={setReconnectDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <WifiOff className="w-5 h-5 text-destructive" />
              Chip Desconectado
            </AlertDialogTitle>
            <AlertDialogDescription>
              O chip <strong>{chipToReconnect?.nickname || chipToReconnect?.phone_number || chipToReconnect?.instance_name}</strong> está desconectado e não pode enviar ou receber mensagens.
              Deseja reconectar ou visualizar as conversas salvas?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => {
              // Allow viewing saved conversations in read-only mode
              if (chipToReconnect) {
                onSelectChip(chipToReconnect.id);
              }
              setChipToReconnect(null);
            }}>
              Ver conversas (somente leitura)
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (chipToReconnect) {
                  handleReconnectChip(chipToReconnect);
                }
                setReconnectDialogOpen(false);
                setChipToReconnect(null);
              }}
            >
              <QrCode className="w-4 h-4 mr-2" />
              Reconectar (QR Code)
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
