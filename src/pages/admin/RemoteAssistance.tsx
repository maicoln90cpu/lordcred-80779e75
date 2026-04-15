import { useEffect, useState, useCallback } from 'react';
import { Eye, Loader2, ArrowLeft, Users } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { supabase } from '@/integrations/supabase/client';
import DashboardLayout from '@/components/layout/DashboardLayout';
import ChatSidebar from '@/components/whatsapp/ChatSidebar';
import ChatWindow from '@/components/whatsapp/ChatWindow';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/contexts/AuthContext';
import type { ChatContact } from '@/pages/WhatsApp';

interface SellerProfile {
  user_id: string;
  email: string;
  name: string | null;
}

interface SellerChip {
  id: string;
  instance_name: string;
  phone_number: string | null;
  status: string;
  nickname: string | null;
}

export default function RemoteAssistance() {
  const { toast } = useToast();
  const { user } = useAuth();
  const [sellers, setSellers] = useState<SellerProfile[]>([]);
  const [selectedSeller, setSelectedSeller] = useState<string | null>(null);
  const [chips, setChips] = useState<SellerChip[]>([]);
  const [selectedChipId, setSelectedChipId] = useState<string | null>(null);
  const [selectedChipStatus, setSelectedChipStatus] = useState('disconnected');
  const [selectedChat, setSelectedChat] = useState<ChatContact | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [viewMode, setViewMode] = useState(false);

  useEffect(() => {
    fetchSellers();
  }, []);

  const fetchSellers = async () => {
    const [{ data: roles }, { data: profiles }] = await Promise.all([
      supabase.from('user_roles').select('user_id, role').in('role', ['seller', 'admin']),
      supabase.rpc('get_visible_profiles'),
    ]);

    if (!roles || !profiles) { setIsLoading(false); return; }

    const userIds = new Set(roles.map(r => r.user_id));
    setSellers((profiles as any[]).filter(p => userIds.has(p.user_id)));
    setIsLoading(false);
  };

  const handleSelectSeller = async (sellerId: string) => {
    setSelectedSeller(sellerId);
    setSelectedChipId(null);
    setSelectedChat(null);
    setViewMode(false);

    const { data } = await supabase
      .from('chips')
      .select('id, instance_name, phone_number, status, nickname')
      .eq('user_id', sellerId)
      .order('slot_number');

    setChips(data || []);
  };

  const handleSelectChip = useCallback((chipId: string) => {
    setSelectedChipId(chipId);
    setSelectedChat(null);
    const chip = chips.find(c => c.id === chipId);
    setSelectedChipStatus(chip?.status || 'disconnected');
    setViewMode(true);
  }, [chips]);

  const handleSelectChat = useCallback((chat: ChatContact) => {
    setSelectedChat(chat);
  }, []);

  const handleBack = () => {
    if (selectedChat) {
      setSelectedChat(null);
    } else if (selectedChipId) {
      setSelectedChipId(null);
      setViewMode(false);
    } else {
      setSelectedSeller(null);
      setChips([]);
    }
  };

  const sellerName = sellers.find(s => s.user_id === selectedSeller);

  return (
    <DashboardLayout>
      <div className="space-y-4">
        <div className="flex items-center gap-3">
          {(selectedSeller || viewMode) && (
            <Button variant="ghost" size="icon" onClick={handleBack}>
              <ArrowLeft className="w-4 h-4" />
            </Button>
          )}
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2">
              <Eye className="w-6 h-6" />
              Assistência Remota
            </h1>
            <p className="text-muted-foreground">
              {viewMode
                ? `Visualizando WhatsApp de ${sellerName?.name || sellerName?.email} (somente leitura)`
                : 'Visualize o WhatsApp de vendedores em modo somente leitura'}
            </p>
          </div>
          {viewMode && (
            <Badge variant="outline" className="ml-auto text-yellow-400 border-yellow-400/50">
              <Eye className="w-3 h-3 mr-1" /> Somente Leitura
            </Badge>
          )}
        </div>

        {!selectedSeller ? (
          // Step 1: Select seller
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2"><Users className="w-5 h-5" />Selecionar Usuário</CardTitle>
              <CardDescription>Escolha um vendedor para visualizar seu WhatsApp</CardDescription>
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <div className="flex justify-center py-8"><Loader2 className="w-6 h-6 animate-spin" /></div>
              ) : sellers.length === 0 ? (
                <p className="text-center text-muted-foreground py-8">Nenhum vendedor encontrado</p>
              ) : (
                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                  {sellers.map(seller => (
                    <button
                      key={seller.user_id}
                      onClick={() => handleSelectSeller(seller.user_id)}
                      className="p-4 rounded-lg border border-border/50 hover:bg-secondary/30 transition-colors text-left"
                    >
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-primary/20 rounded-full flex items-center justify-center">
                          <span className="text-sm font-medium text-primary">{(seller.name || seller.email).charAt(0).toUpperCase()}</span>
                        </div>
                        <div>
                          <p className="font-medium text-sm">{seller.name || seller.email}</p>
                          {seller.name && <p className="text-xs text-muted-foreground">{seller.email}</p>}
                        </div>
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        ) : !viewMode ? (
          // Step 2: Select chip
          <Card>
            <CardHeader>
              <CardTitle>Chips de {sellerName?.name || sellerName?.email}</CardTitle>
              <CardDescription>Selecione um chip para visualizar as conversas</CardDescription>
            </CardHeader>
            <CardContent>
              {chips.length === 0 ? (
                <p className="text-center text-muted-foreground py-8">Nenhum chip encontrado para este usuário</p>
              ) : (
                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                  {chips.map(chip => (
                    <button
                      key={chip.id}
                      onClick={() => handleSelectChip(chip.id)}
                      className="p-4 rounded-lg border border-border/50 hover:bg-secondary/30 transition-colors text-left"
                    >
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="font-medium text-sm">{chip.nickname || chip.instance_name}</p>
                          <p className="text-xs text-muted-foreground">{chip.phone_number || 'Sem número'}</p>
                        </div>
                        <Badge variant={chip.status === 'connected' ? 'default' : 'secondary'}>
                          {chip.status === 'connected' ? 'Online' : 'Offline'}
                        </Badge>
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        ) : (
          // Step 3: View WhatsApp read-only
          <div className="flex border border-border/50 rounded-lg overflow-hidden" style={{ height: 'calc(100vh - 220px)' }}>
            <aside className="w-[380px] border-r border-border/50 bg-card/30 flex flex-col">
              <ChatSidebar
                selectedChatId={selectedChat?.remoteJid || null}
                onSelectChat={handleSelectChat}
                chipId={selectedChipId}
                onUnreadUpdate={() => {}}
                isSyncing={false}
                syncProgress=""
                refreshKey={0}
              />
            </aside>
            <main className="flex-1 flex flex-col min-w-0">
              <ChatWindow
                chat={selectedChat}
                chipId={selectedChipId}
                chipStatus={selectedChipStatus}
                onReconnect={() => {}}
                onStartNewChat={() => {}}
                readOnly
              />
            </main>
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}
