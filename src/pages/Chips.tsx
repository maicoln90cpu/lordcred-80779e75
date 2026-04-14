import { useEffect, useCallback } from 'react';
import { 
  Plus, Smartphone, Wifi, WifiOff, QrCode, Trash2, RefreshCw, Loader2,
  RotateCcw, Timer, Pencil, Check, X, MessageSquare, ListOrdered
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
import DashboardLayout from '@/components/layout/DashboardLayout';
import MessagesContent from '@/components/messages/MessagesContent';
import QueueContent from '@/components/messages/QueueContent';
import { cn } from '@/lib/utils';
import { useRealtimeChips } from '@/hooks/useRealtimeChips';
import { useAuth } from '@/contexts/AuthContext';
import { useChipsManager, WARMING_PHASES, PHASE_COLORS, getEstimatedInterval, type Chip } from '@/hooks/useChipsManager';

const availableSlots = Array.from({ length: 15 }, (_, i) => i + 1);

export default function Chips() {
  const { user } = useAuth();
  const mgr = useChipsManager();

  const handleRealtimeUpdate = useCallback((updatedChips: Chip[]) => {
    const userChips = updatedChips.filter(c => (c as any).user_id === user?.id);
    mgr.setChips(userChips);
  }, [user?.id]);

  useRealtimeChips(handleRealtimeUpdate, user?.id);

  useEffect(() => { mgr.fetchChips(); mgr.fetchSettings(); }, [mgr.fetchChips, mgr.fetchSettings]);
  useEffect(() => { return () => mgr.cleanupPolling(); }, []);

  const usedSlots = mgr.chips.map(c => c.slot_number);
  const emptySlots = availableSlots.filter(s => !usedSlots.includes(s));

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold">Meus Chips</h1>
            <p className="text-muted-foreground">Gerencie seus números WhatsApp para aquecimento</p>
          </div>
        </div>

        <Tabs defaultValue="chips" className="w-full">
          <TabsList className="grid w-full max-w-lg grid-cols-3">
            <TabsTrigger value="chips" className="flex items-center gap-2"><Smartphone className="w-4 h-4" />Chips</TabsTrigger>
            <TabsTrigger value="messages" className="flex items-center gap-2"><MessageSquare className="w-4 h-4" />Mensagens</TabsTrigger>
            <TabsTrigger value="queue" className="flex items-center gap-2"><ListOrdered className="w-4 h-4" />Fila</TabsTrigger>
          </TabsList>

          <TabsContent value="chips" className="mt-4">
            <div className="space-y-4">
              {mgr.chips.length > 0 && (
                <div className="flex justify-end">
                  <Button variant="outline" onClick={() => mgr.handleSyncAllChips(mgr.chips)} disabled={mgr.isSyncingAll}>
                    {mgr.isSyncingAll ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <RefreshCw className="w-4 h-4 mr-2" />}
                    Sincronizar Todos
                  </Button>
                </div>
              )}

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {mgr.chips.map((chip) => {
                  const isConnected = chip.status === 'connected';
                  const currentPhase = chip.warming_phase || 'novo';
                  const phaseColors = PHASE_COLORS[currentPhase] || PHASE_COLORS.novo;
                  const messagesSent = chip.messages_sent_today || 0;

                  return (
                    <Card key={chip.id} className={cn("border-border/50 transition-colors", isConnected && "border-primary/30")}>
                      <CardContent className="p-6">
                        <div className="flex items-center justify-between mb-3">
                          <div className="flex items-center gap-3">
                            <div className={cn("w-12 h-12 rounded-xl flex items-center justify-center", isConnected ? "bg-primary/20" : "bg-muted")}>
                              <Smartphone className={cn("w-6 h-6", isConnected ? "text-primary" : "text-muted-foreground")} />
                            </div>
                            <div>
                              <div className="flex items-center gap-1.5">
                                {mgr.editingNickname === chip.id ? (
                                  <div className="flex items-center gap-1">
                                    <Input value={mgr.nicknameValue} onChange={(e) => mgr.setNicknameValue(e.target.value)} className="h-6 text-sm w-28 px-1" placeholder={`Slot ${chip.slot_number}`} autoFocus onKeyDown={(e) => { if (e.key === 'Enter') mgr.handleNicknameSave(chip.id); if (e.key === 'Escape') mgr.setEditingNickname(null); }} />
                                    <button onClick={() => mgr.handleNicknameSave(chip.id)} className="text-primary hover:text-primary/80"><Check className="w-3.5 h-3.5" /></button>
                                    <button onClick={() => mgr.setEditingNickname(null)} className="text-muted-foreground hover:text-foreground"><X className="w-3.5 h-3.5" /></button>
                                  </div>
                                ) : (
                                  <>
                                    <h3 className="font-semibold">{chip.nickname || `Slot ${chip.slot_number}`}</h3>
                                    <button onClick={() => { mgr.setEditingNickname(chip.id); mgr.setNicknameValue(chip.nickname || ''); }} className="text-muted-foreground hover:text-foreground"><Pencil className="w-3 h-3" /></button>
                                  </>
                                )}
                              </div>
                              {chip.nickname && <span className="text-xs text-muted-foreground">Slot {chip.slot_number}</span>}
                              <div className="flex items-center gap-1.5">
                                {isConnected ? <Wifi className="w-3 h-3 text-primary" /> : <WifiOff className="w-3 h-3 text-muted-foreground" />}
                                <span className={cn("text-xs", isConnected ? "text-primary" : "text-muted-foreground")}>
                                  {chip.status === 'connected' ? 'Conectado' : chip.status === 'connecting' ? 'Conectando...' : 'Desconectado'}
                                </span>
                              </div>
                            </div>
                          </div>
                          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => mgr.handleSyncStatus(chip)} title="Sincronizar status"><RotateCcw className="w-4 h-4" /></Button>
                        </div>

                        <div className={cn("px-2 py-1.5 rounded-md mb-3", phaseColors.bg)}>
                          <Select value={currentPhase} onValueChange={(v) => mgr.handlePhaseChange(chip.id, v)}>
                            <SelectTrigger className="h-7 text-xs border-0 bg-transparent p-0 shadow-none focus:ring-0"><SelectValue /></SelectTrigger>
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

                        {mgr.settings && (
                          <div className="flex items-center gap-1.5 mb-2 text-xs text-muted-foreground">
                            <Timer className="w-3 h-3" />
                            <span>Intervalo estimado: {getEstimatedInterval(currentPhase, mgr.settings)} entre msgs</span>
                          </div>
                        )}

                        <p className="text-sm text-muted-foreground mb-2 truncate">{chip.phone_number || 'Número não conectado'}</p>

                        {isConnected && (
                          <div className="mb-4 space-y-1">
                            <div className="flex justify-between text-xs"><span className="text-muted-foreground">Msgs hoje</span><span className="font-medium">{messagesSent}</span></div>
                            <Progress value={Math.min(messagesSent, 100)} className="h-1.5" />
                          </div>
                        )}

                        <div className="flex gap-2">
                          {!isConnected && (
                            <Button variant="outline" size="sm" className="flex-1" onClick={() => mgr.handleReconnect(chip)}><QrCode className="w-4 h-4 mr-2" />Reconectar</Button>
                          )}
                          <Button variant="ghost" size="sm" className="text-destructive hover:text-destructive hover:bg-destructive/10" onClick={() => mgr.confirmRemoveChip(chip)}><Trash2 className="w-4 h-4" /></Button>
                        </div>
                      </CardContent>
                    </Card>
                  );
                })}

                {emptySlots.map((slot) => (
                  <Card key={slot} className="border-dashed border-border/50 bg-transparent hover:bg-secondary/20 transition-colors cursor-pointer" onClick={() => mgr.handleAddChip(slot)}>
                    <CardContent className="p-6 flex flex-col items-center justify-center min-h-[180px]">
                      <div className="w-12 h-12 rounded-xl bg-muted flex items-center justify-center mb-3"><Plus className="w-6 h-6 text-muted-foreground" /></div>
                      <p className="font-medium">Slot {slot}</p>
                      <p className="text-sm text-muted-foreground">Adicionar chip</p>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </div>
          </TabsContent>

          <TabsContent value="messages" className="mt-4"><MessagesContent /></TabsContent>
          <TabsContent value="queue" className="mt-4"><QueueContent /></TabsContent>
        </Tabs>

        <Dialog open={mgr.qrDialogOpen} onOpenChange={mgr.handleDialogClose}>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>Conectar WhatsApp - Slot {mgr.selectedSlot}</DialogTitle>
              <DialogDescription>Escaneie o QR Code abaixo com seu WhatsApp</DialogDescription>
            </DialogHeader>
            <div className="flex flex-col items-center py-6">
              {mgr.isConnecting ? (
                <div className="w-64 h-64 bg-muted rounded-xl flex items-center justify-center"><Loader2 className="w-8 h-8 animate-spin text-muted-foreground" /></div>
              ) : mgr.qrCode ? (
                <div className="w-64 h-64 bg-white rounded-xl flex items-center justify-center p-2">
                  <img src={mgr.qrCode.startsWith('data:') ? mgr.qrCode : `data:image/png;base64,${mgr.qrCode}`} alt="QR Code" className="w-full h-full object-contain" />
                </div>
              ) : (
                <div className="w-64 h-64 bg-muted rounded-xl flex items-center justify-center"><p className="text-muted-foreground text-center px-4">Clique em atualizar para gerar o QR Code</p></div>
              )}
              <p className="text-xs text-muted-foreground mt-2 text-center">Aguardando conexão...</p>
              <Button variant="outline" className="mt-4" onClick={mgr.handleRefreshQr} disabled={mgr.isConnecting}>
                <RefreshCw className={cn("w-4 h-4 mr-2", mgr.isConnecting && "animate-spin")} />Atualizar QR Code
              </Button>
            </div>
          </DialogContent>
        </Dialog>

        <AlertDialog open={mgr.deleteDialogOpen} onOpenChange={(open) => { if (!open) { mgr.handleDialogClose(false); } }}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Remover Chip</AlertDialogTitle>
              <AlertDialogDescription>Tem certeza que deseja remover o Slot {mgr.chipToDelete?.slot_number}? Esta ação não pode ser desfeita.</AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancelar</AlertDialogCancel>
              <AlertDialogAction onClick={mgr.handleRemoveChip} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">Remover</AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </DashboardLayout>
  );
}
