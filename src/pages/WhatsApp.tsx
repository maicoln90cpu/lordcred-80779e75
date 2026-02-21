import { useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Settings, LogOut, Sun, Moon, Star, Smartphone } from 'lucide-react';
import UserProfileMenu from '@/components/whatsapp/UserProfileMenu';
import WhatsAppProfileDialog from '@/components/whatsapp/WhatsAppProfileDialog';
import logoExtended from '@/assets/logo-new.png';
import { useTheme } from 'next-themes';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import ChipSelector from '@/components/whatsapp/ChipSelector';
import ChatSidebar from '@/components/whatsapp/ChatSidebar';
import ChatWindow from '@/components/whatsapp/ChatWindow';
import FavoritesPanel from '@/components/whatsapp/FavoritesPanel';
import { supabase } from '@/integrations/supabase/client';

export interface ChatContact {
  id: string;
  remoteJid: string;
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
  const [selectedChat, setSelectedChat] = useState<ChatContact | null>(null);
  const [favoritesOpen, setFavoritesOpen] = useState(false);
  const [unreadCounts, setUnreadCounts] = useState<Record<string, number>>({});
  const [whatsappProfileOpen, setWhatsappProfileOpen] = useState(false);
  const { isSeller, signOut } = useAuth();
  const navigate = useNavigate();
  const { theme, setTheme } = useTheme();

  const handleSignOut = async () => {
    await signOut();
    navigate('/login');
  };

  const handleSelectChip = useCallback((id: string) => {
    setSelectedChipId(id);
    setSelectedChat(null);
    // Trigger background sync for this chip
    if (id) {
      supabase.functions.invoke('sync-history', {
        body: { chipId: id },
      }).catch(() => {});
    }
  }, []);

  const handleSelectChat = useCallback((chat: ChatContact) => {
    setSelectedChat(chat);
    // Optimistically clear unread in sidebar state
    if (chat.unreadCount > 0 && selectedChipId) {
      setUnreadCounts(prev => ({
        ...prev,
        [selectedChipId]: Math.max(0, (prev[selectedChipId] || 0) - chat.unreadCount),
      }));
    }
  }, [selectedChipId]);

  const handleUnreadUpdate = useCallback((chipId: string, totalUnread: number) => {
    setUnreadCounts(prev => ({ ...prev, [chipId]: totalUnread }));
  }, []);

  const toggleTheme = () => setTheme(theme === 'dark' ? 'light' : 'dark');

  return (
    <div className="h-screen flex flex-col bg-background">
      <header className="flex items-center justify-between px-4 py-2 border-b border-border/50 bg-card">
        <div className="flex items-center gap-3">
          <img src={logoExtended} alt="Cred" className="h-20 object-contain" />
          <ChipSelector selectedChipId={selectedChipId} onSelectChip={handleSelectChip} unreadCounts={unreadCounts} />
        </div>
        <div className="flex items-center gap-2 ml-4">
          <UserProfileMenu />
          {selectedChipId && (
            <Button variant="ghost" size="icon" onClick={() => setWhatsappProfileOpen(true)} className="text-muted-foreground hover:text-foreground" title="Configurações do WhatsApp">
              <Smartphone className="w-4 h-4" />
            </Button>
          )}
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
        <aside className="w-96 border-r border-border/50 bg-card/30 hidden md:flex flex-col">
          <ChatSidebar
            selectedChatId={selectedChat?.remoteJid || null}
            onSelectChat={handleSelectChat}
            chipId={selectedChipId}
            onUnreadUpdate={handleUnreadUpdate}
          />
        </aside>

        <main className="flex-1 flex flex-col min-w-0">
          <ChatWindow
            chat={selectedChat}
            chipId={selectedChipId} />
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
    </div>);
}
