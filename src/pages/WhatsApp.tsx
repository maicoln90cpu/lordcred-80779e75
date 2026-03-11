import { useState, useCallback, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Settings, LogOut, Sun, Moon, Star, RefreshCw, Loader2 } from 'lucide-react';
import UserProfileMenu from '@/components/whatsapp/UserProfileMenu';
import WhatsAppProfileDialog from '@/components/whatsapp/WhatsAppProfileDialog';
import logoExtended from '@/assets/logo-new.png';
import { useTheme } from 'next-themes';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import ChipSelector from '@/components/whatsapp/ChipSelector';
import ChatSidebar from '@/components/whatsapp/ChatSidebar';
import ChatWindow from '@/components/whatsapp/ChatWindow';
import FavoritesPanel from '@/components/whatsapp/FavoritesPanel';
import ChipConnectDialog from '@/components/whatsapp/ChipConnectDialog';
import { supabase } from '@/integrations/supabase/client';

export interface ChatContact {
  id: string;
  remoteJid: string;
  alternateJid?: string;
  name: string;
  phone: string;
  lastMessage: string;
  lastMessageAt: string | null;
  unreadCount: number;
  isGroup: boolean;
  isPinned?: boolean;
  profilePicUrl?: string;
}

export default function WhatsApp() {
  const [selectedChipId, setSelectedChipId] = useState<string | null>(null);
  const [selectedChipStatus, setSelectedChipStatus] = useState<string>('disconnected');
  const [selectedChipInstanceName, setSelectedChipInstanceName] = useState<string | null>(null);
  const [selectedChat, setSelectedChat] = useState<ChatContact | null>(null);
  const [favoritesOpen, setFavoritesOpen] = useState(false);
  const [unreadCounts, setUnreadCounts] = useState<Record<string, number>>({});
  const [whatsappProfileOpen, setWhatsappProfileOpen] = useState(false);
  const [reconnectDialogOpen, setReconnectDialogOpen] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [refreshTrigger, setRefreshTrigger] = useState(0);
  const { user, isSeller, signOut } = useAuth();
  const navigate = useNavigate();
  const { theme, setTheme } = useTheme();
  const { toast } = useToast();

  const handleSignOut = async () => {
    await signOut();
    navigate('/login');
  };


  const [syncProgress, setSyncProgress] = useState<string>('');

  const runStagedSync = useCallback(async (chipId: string) => {
    setIsSyncing(true);
    setSyncProgress('Iniciando...');
    let cursor = 0;
    let totalSynced = 0;
    let totalChats = 0;
    try {
      while (true) {
        const { data, error } = await supabase.functions.invoke('sync-history', {
          body: { chipId, cursor },
        });
        if (error) { console.error('sync error:', error); break; }
        totalChats = data?.total || data?.chats || 0;
        totalSynced += data?.synced || 0;
        const processed = data?.processed || 0;
        setSyncProgress(`${processed}/${totalChats} chats`);
        if (!data?.hasMore) break;
        cursor = data.nextCursor || 0;
        await new Promise(r => setTimeout(r, 1000)); // delay between batches
      }
    } catch (err) {
      console.error('Staged sync error:', err);
    }
    setIsSyncing(false);
    setSyncProgress('');
    setRefreshTrigger(prev => prev + 1); // Force re-fetch após sync
    return { totalChats, totalSynced };
  }, []);

  const handleSelectChip = useCallback(async (id: string) => {
    setSelectedChipId(id);
    setSelectedChat(null);
    
    if (id) {
      const { data: chip } = await supabase
        .from('chips')
        .select('status, instance_name')
        .eq('id', id)
        .single();
      setSelectedChipStatus(chip?.status || 'disconnected');
      setSelectedChipInstanceName(chip?.instance_name || null);

      // Auto-sync disabled — use manual "Sincronizar mensagens" button
      // runStagedSync(id);
    } else {
      setSelectedChipStatus('disconnected');
      setSelectedChipInstanceName(null);
    }
  }, [runStagedSync]);

  const handleSelectChat = useCallback((chat: ChatContact) => {
    setSelectedChat(chat);
    // Optimistic: clear unread for the selected chip immediately
    if (selectedChipId && chat.unreadCount > 0) {
      setUnreadCounts(prev => {
        const current = prev[selectedChipId] || 0;
        return { ...prev, [selectedChipId]: Math.max(0, current - chat.unreadCount) };
      });
    }
  }, [selectedChipId]);

  const handleUnreadUpdate = useCallback((chipId: string, totalUnread: number) => {
    setUnreadCounts(prev => ({ ...prev, [chipId]: totalUnread }));
  }, []);

  const handleReconnectFromChat = useCallback(() => {
    if (selectedChipInstanceName) {
      setReconnectDialogOpen(true);
    }
  }, [selectedChipInstanceName]);

  const handleRefreshAllChips = useCallback(async () => {
    if (!user || isRefreshing) return;
    setIsRefreshing(true);
    try {
      const { data: chips } = await supabase
        .from('chips')
        .select('id, instance_name, instance_token, status')
        .eq('user_id', user.id);
      if (!chips || chips.length === 0) {
        toast({ title: 'Nenhum chip encontrado' });
        setIsRefreshing(false);
        return;
      }

      const { data: { session } } = await supabase.auth.getSession();
      if (!session) { setIsRefreshing(false); return; }

      let connected = 0, offline = 0;
      for (const chip of chips) {
        try {
          const res = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/uazapi-api`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${session.access_token}`,
            },
            body: JSON.stringify({ action: 'check-status', instanceName: chip.instance_name, instanceToken: chip.instance_token }),
          });
          const data = await res.json();
          const newStatus = data.state === 'connected' ? 'connected' : 'disconnected';
          if (newStatus !== chip.status) {
            await supabase.from('chips').update({ status: newStatus }).eq('id', chip.id);
          }
          if (newStatus === 'connected') connected++; else offline++;
        } catch {
          offline++;
        }
      }

      // Update selected chip status
      if (selectedChipId) {
        const updated = chips.find(c => c.id === selectedChipId);
        if (updated) {
          const res2 = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/uazapi-api`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${session.access_token}`,
            },
            body: JSON.stringify({ action: 'check-status', instanceName: updated.instance_name, instanceToken: updated.instance_token }),
          });
          const d2 = await res2.json();
          setSelectedChipStatus(d2.state === 'connected' ? 'connected' : 'disconnected');
        }
      }

      setRefreshTrigger(prev => prev + 1);
      toast({ title: `${chips.length} chips verificados`, description: `${connected} conectado(s), ${offline} offline` });
    } catch (err: any) {
      toast({ title: 'Erro ao atualizar', description: err.message, variant: 'destructive' });
    } finally {
      setIsRefreshing(false);
    }
  }, [user, isRefreshing, selectedChipId, toast]);

  const handleSyncHistory = useCallback(async (chipId: string) => {
    const { totalChats, totalSynced } = await runStagedSync(chipId);
    if (totalSynced > 0) {
      toast({ title: `${totalChats} conversas, ${totalSynced} mensagens sincronizadas` });
    } else {
      toast({ title: `${totalChats} conversas verificadas`, description: 'Nenhuma mensagem nova encontrada' });
    }
  }, [toast, runStagedSync]);

  const toggleTheme = () => setTheme(theme === 'dark' ? 'light' : 'dark');

  const handleStartNewChat = useCallback(async (phone: string) => {
    if (!selectedChipId || !phone) return;
    const digits = phone.replace(/\D/g, '');
    if (digits.length < 10) return;
    let normalized = digits;
    if (normalized.length === 10 || normalized.length === 11) {
      normalized = '55' + normalized;
    }
    const jid = `${normalized}@s.whatsapp.net`;
    try {
      const { data, error } = await supabase
        .from('conversations')
        .upsert(
          { chip_id: selectedChipId, remote_jid: jid, contact_phone: normalized },
          { onConflict: 'chip_id,remote_jid' }
        )
        .select()
        .single();
      if (error) throw error;
      const newChat: ChatContact = {
        id: data.id,
        remoteJid: data.remote_jid,
        name: data.contact_name || data.wa_name || digits,
        phone: digits,
        lastMessage: data.last_message_text || '',
        lastMessageAt: data.last_message_at,
        unreadCount: data.unread_count || 0,
        isGroup: false,
      };
      setSelectedChat(newChat);
      toast({ title: 'Conversa iniciada' });
    } catch (err: any) {
      toast({ title: 'Erro ao criar conversa', description: err.message, variant: 'destructive' });
    }
  }, [selectedChipId, toast]);

  return (
    <div className="h-screen flex flex-col bg-background">
      <header className="flex items-center justify-between px-4 py-2 border-b border-border/50 bg-card">
        <div className="flex items-center gap-3">
          <img src={logoExtended} alt="Cred" className="h-20 object-contain" />
          <ChipSelector selectedChipId={selectedChipId} onSelectChip={handleSelectChip} unreadCounts={unreadCounts} onOpenSettings={(chipId) => { setSelectedChipId(chipId); setWhatsappProfileOpen(true); }} onSyncHistory={handleSyncHistory} refreshTrigger={refreshTrigger} />
        </div>
        <div className="flex items-center gap-2 ml-4">
          <UserProfileMenu />
          <Button variant="ghost" size="icon" onClick={handleRefreshAllChips} disabled={isRefreshing} className="text-muted-foreground hover:text-foreground" title="Atualizar status dos chips">
            {isRefreshing ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
          </Button>
          <Button variant="ghost" size="icon" onClick={() => setFavoritesOpen(true)} className="text-muted-foreground hover:text-foreground" title="Mensagens favoritadas">
            <Star className="w-4 h-4" />
          </Button>
          <Button variant="ghost" size="icon" onClick={toggleTheme} className="text-muted-foreground hover:text-foreground">
            {theme === 'dark' ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
          </Button>
          {!isSeller &&
          <Button variant="outline" size="sm" onClick={() => navigate('/dashboard')} className="text-sm">
              <Settings className="w-4 h-4 mr-1.5" />
              Menu Admin
            </Button>
          }
          <Button variant="ghost" size="icon" onClick={handleSignOut} className="text-muted-foreground hover:text-foreground">
            <LogOut className="w-4 h-4" />
          </Button>
        </div>
      </header>

      <div className="flex flex-1 min-h-0">
        <aside className="w-[420px] border-r border-border/50 bg-card/30 hidden md:flex flex-col">
          <ChatSidebar
            selectedChatId={selectedChat?.remoteJid || null}
            onSelectChat={handleSelectChat}
            chipId={selectedChipId}
            onUnreadUpdate={handleUnreadUpdate}
            isSyncing={isSyncing}
            syncProgress={syncProgress}
            refreshKey={refreshTrigger}
          />
        </aside>

        <main className="flex-1 flex flex-col min-w-0">
          <ChatWindow
            chat={selectedChat}
            chipId={selectedChipId}
            chipStatus={selectedChipStatus}
            onReconnect={handleReconnectFromChat}
            onStartNewChat={handleStartNewChat}
          />
        </main>
      </div>

      <FavoritesPanel
        open={favoritesOpen}
        onClose={() => setFavoritesOpen(false)}
        chipId={selectedChipId}
        onOpenChat={(chat) => { setSelectedChat(chat); setFavoritesOpen(false); }}
      />

      <WhatsAppProfileDialog
        open={whatsappProfileOpen}
        onOpenChange={setWhatsappProfileOpen}
        chipId={selectedChipId}
      />

      {/* Reconnect dialog triggered from ChatWindow */}
      <ChipConnectDialog
        open={reconnectDialogOpen}
        onOpenChange={setReconnectDialogOpen}
        onChipConnected={() => {
          // Refresh chip status
          if (selectedChipId) handleSelectChip(selectedChipId);
        }}
        reconnectInstanceName={selectedChipInstanceName}
      />
    </div>);
}
