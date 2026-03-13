import { useState, useEffect, useRef, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import DashboardLayout from '@/components/layout/DashboardLayout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Checkbox } from '@/components/ui/checkbox';
import { useToast } from '@/hooks/use-toast';
import { Plus, Send, Hash, Users, Trash2, UserPlus } from 'lucide-react';
import { cn } from '@/lib/utils';

interface Channel {
  id: string;
  name: string;
  description: string | null;
  is_group: boolean;
  created_by: string;
}

interface Message {
  id: string;
  channel_id: string;
  user_id: string;
  content: string;
  created_at: string;
  user_email?: string;
  user_name?: string;
}

interface UserProfile {
  user_id: string;
  email: string;
  name: string | null;
}

export default function InternalChat() {
  const { user, isSeller } = useAuth();
  const { toast } = useToast();
  const [channels, setChannels] = useState<Channel[]>([]);
  const [selectedChannel, setSelectedChannel] = useState<Channel | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [manageMembersOpen, setManageMembersOpen] = useState(false);
  const [channelName, setChannelName] = useState('');
  const [channelDesc, setChannelDesc] = useState('');
  const [allUsers, setAllUsers] = useState<UserProfile[]>([]);
  const [selectedUsers, setSelectedUsers] = useState<string[]>([]);
  const [channelMembers, setChannelMembers] = useState<string[]>([]);
  const [profilesMap, setProfilesMap] = useState<Record<string, UserProfile>>({});
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const isAdmin = !isSeller;

  // Load channels
  const loadChannels = useCallback(async () => {
    const { data } = await supabase
      .from('internal_channels')
      .select('*')
      .order('updated_at', { ascending: false });
    if (data) setChannels(data);
  }, []);

  // Load all users for admin
  const loadUsers = useCallback(async () => {
    const { data } = await supabase.from('profiles').select('user_id, email, name');
    if (data) {
      setAllUsers(data);
      const map: Record<string, UserProfile> = {};
      data.forEach(u => { map[u.user_id] = u; });
      setProfilesMap(map);
    }
  }, []);

  // Load messages for a channel
  const loadMessages = useCallback(async (channelId: string) => {
    const { data } = await supabase
      .from('internal_messages')
      .select('*')
      .eq('channel_id', channelId)
      .order('created_at', { ascending: true })
      .limit(200);
    if (data) {
      setMessages(data.map(m => ({
        ...m,
        user_email: profilesMap[m.user_id]?.email,
        user_name: profilesMap[m.user_id]?.name,
      })));
    }
  }, [profilesMap]);

  // Load channel members
  const loadMembers = useCallback(async (channelId: string) => {
    const { data } = await supabase
      .from('internal_channel_members')
      .select('user_id')
      .eq('channel_id', channelId);
    if (data) setChannelMembers(data.map(m => m.user_id));
  }, []);

  useEffect(() => { loadChannels(); loadUsers(); }, [loadChannels, loadUsers]);

  useEffect(() => {
    if (selectedChannel) {
      loadMessages(selectedChannel.id);
      loadMembers(selectedChannel.id);
    }
  }, [selectedChannel, loadMessages, loadMembers]);

  // Scroll to bottom on new messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Realtime subscription for messages
  useEffect(() => {
    if (!selectedChannel) return;
    const channel = supabase
      .channel(`internal-msgs-${selectedChannel.id}`)
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'internal_messages',
        filter: `channel_id=eq.${selectedChannel.id}`,
      }, (payload) => {
        const msg = payload.new as any;
        setMessages(prev => [...prev, {
          ...msg,
          user_email: profilesMap[msg.user_id]?.email,
          user_name: profilesMap[msg.user_id]?.name,
        }]);
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [selectedChannel, profilesMap]);

  const handleSendMessage = async () => {
    if (!newMessage.trim() || !selectedChannel || !user) return;
    const content = newMessage.trim();
    setNewMessage('');
    await supabase.from('internal_messages').insert({
      channel_id: selectedChannel.id,
      user_id: user.id,
      content,
    });
    // Update channel timestamp
    await supabase.from('internal_channels').update({ updated_at: new Date().toISOString() }).eq('id', selectedChannel.id);
  };

  const handleCreateChannel = async () => {
    if (!channelName.trim() || !user) return;
    const { data, error } = await supabase.from('internal_channels').insert({
      name: channelName.trim(),
      description: channelDesc.trim() || null,
      created_by: user.id,
    }).select().single();
    if (error) { toast({ title: 'Erro', description: error.message, variant: 'destructive' }); return; }
    // Add creator + selected users as members
    const memberIds = [...new Set([user.id, ...selectedUsers])];
    await supabase.from('internal_channel_members').insert(
      memberIds.map(uid => ({ channel_id: data.id, user_id: uid }))
    );
    setCreateDialogOpen(false);
    setChannelName('');
    setChannelDesc('');
    setSelectedUsers([]);
    loadChannels();
    toast({ title: 'Grupo criado com sucesso' });
  };

  const handleDeleteChannel = async (channelId: string) => {
    await supabase.from('internal_channels').delete().eq('id', channelId);
    if (selectedChannel?.id === channelId) {
      setSelectedChannel(null);
      setMessages([]);
    }
    loadChannels();
    toast({ title: 'Grupo removido' });
  };

  const handleSaveMembers = async () => {
    if (!selectedChannel) return;
    // Remove all current members, re-add selected
    await supabase.from('internal_channel_members').delete().eq('channel_id', selectedChannel.id);
    const memberIds = [...new Set([selectedChannel.created_by, ...selectedUsers])];
    await supabase.from('internal_channel_members').insert(
      memberIds.map(uid => ({ channel_id: selectedChannel.id, user_id: uid }))
    );
    setManageMembersOpen(false);
    loadMembers(selectedChannel.id);
    toast({ title: 'Membros atualizados' });
  };

  const openManageMembers = () => {
    setSelectedUsers(channelMembers);
    setManageMembersOpen(true);
  };

  const formatTime = (dateStr: string) => {
    const d = new Date(dateStr);
    return d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
  };

  const formatDate = (dateStr: string) => {
    const d = new Date(dateStr);
    return d.toLocaleDateString('pt-BR');
  };

  // Group messages by date
  const groupedMessages: { date: string; msgs: Message[] }[] = [];
  let lastDate = '';
  for (const msg of messages) {
    const date = formatDate(msg.created_at);
    if (date !== lastDate) {
      groupedMessages.push({ date, msgs: [msg] });
      lastDate = date;
    } else {
      groupedMessages[groupedMessages.length - 1].msgs.push(msg);
    }
  }

  return (
    <DashboardLayout>
      <div className="flex h-[calc(100vh-6rem)] rounded-lg border border-border overflow-hidden bg-card">
        {/* Channel list */}
        <div className="w-72 border-r border-border flex flex-col">
          <div className="p-3 border-b border-border flex items-center justify-between">
            <h2 className="font-semibold text-sm">Chat Interno</h2>
            {isAdmin && (
              <Button variant="ghost" size="icon" onClick={() => { setSelectedUsers([]); setCreateDialogOpen(true); }}>
                <Plus className="w-4 h-4" />
              </Button>
            )}
          </div>
          <ScrollArea className="flex-1">
            {channels.map(ch => (
              <div
                key={ch.id}
                className={cn(
                  "flex items-center gap-2 px-3 py-2.5 cursor-pointer hover:bg-accent/50 transition-colors border-b border-border/30",
                  selectedChannel?.id === ch.id && "bg-accent"
                )}
                onClick={() => setSelectedChannel(ch)}
              >
                <div className="w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center shrink-0">
                  {ch.is_group ? <Users className="w-4 h-4 text-primary" /> : <Hash className="w-4 h-4 text-primary" />}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{ch.name}</p>
                  {ch.description && <p className="text-xs text-muted-foreground truncate">{ch.description}</p>}
                </div>
                {isAdmin && (
                  <Button variant="ghost" size="icon" className="shrink-0 opacity-0 group-hover:opacity-100 h-6 w-6"
                    onClick={(e) => { e.stopPropagation(); handleDeleteChannel(ch.id); }}>
                    <Trash2 className="w-3 h-3" />
                  </Button>
                )}
              </div>
            ))}
            {channels.length === 0 && (
              <p className="text-center text-sm text-muted-foreground py-8">Nenhum grupo ainda</p>
            )}
          </ScrollArea>
        </div>

        {/* Messages area */}
        <div className="flex-1 flex flex-col">
          {selectedChannel ? (
            <>
              <div className="px-4 py-3 border-b border-border flex items-center justify-between">
                <div>
                  <h3 className="font-semibold text-sm">{selectedChannel.name}</h3>
                  <p className="text-xs text-muted-foreground">{channelMembers.length} membro(s)</p>
                </div>
                {isAdmin && (
                  <Button variant="outline" size="sm" onClick={openManageMembers}>
                    <UserPlus className="w-3.5 h-3.5 mr-1.5" />
                    Membros
                  </Button>
                )}
              </div>
              <ScrollArea className="flex-1 px-4 py-3">
                {groupedMessages.map(group => (
                  <div key={group.date}>
                    <div className="flex items-center gap-2 my-3">
                      <div className="flex-1 h-px bg-border" />
                      <span className="text-xs text-muted-foreground px-2">{group.date}</span>
                      <div className="flex-1 h-px bg-border" />
                    </div>
                    {group.msgs.map(msg => {
                      const isMe = msg.user_id === user?.id;
                      const senderName = msg.user_name || msg.user_email?.split('@')[0] || 'Usuário';
                      return (
                        <div key={msg.id} className={cn("flex mb-2", isMe ? "justify-end" : "justify-start")}>
                          <div className={cn(
                            "max-w-[70%] rounded-lg px-3 py-2",
                            isMe ? "bg-primary text-primary-foreground" : "bg-muted"
                          )}>
                            {!isMe && <p className="text-xs font-medium opacity-70 mb-0.5">{senderName}</p>}
                            <p className="text-sm whitespace-pre-wrap break-words">{msg.content}</p>
                            <p className={cn("text-[10px] mt-0.5", isMe ? "text-primary-foreground/60" : "text-muted-foreground")}>{formatTime(msg.created_at)}</p>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                ))}
                <div ref={messagesEndRef} />
              </ScrollArea>
              <div className="p-3 border-t border-border flex gap-2">
                <Input
                  value={newMessage}
                  onChange={e => setNewMessage(e.target.value)}
                  placeholder="Digite sua mensagem..."
                  onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSendMessage(); } }}
                  className="flex-1"
                />
                <Button onClick={handleSendMessage} disabled={!newMessage.trim()}>
                  <Send className="w-4 h-4" />
                </Button>
              </div>
            </>
          ) : (
            <div className="flex-1 flex items-center justify-center text-muted-foreground">
              <div className="text-center">
                <Users className="w-12 h-12 mx-auto mb-3 opacity-30" />
                <p className="text-sm">Selecione um grupo para conversar</p>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Create Channel Dialog */}
      <Dialog open={createDialogOpen} onOpenChange={setCreateDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Criar Grupo</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <Input placeholder="Nome do grupo" value={channelName} onChange={e => setChannelName(e.target.value)} />
            <Input placeholder="Descrição (opcional)" value={channelDesc} onChange={e => setChannelDesc(e.target.value)} />
            <div>
              <p className="text-sm font-medium mb-2">Adicionar membros:</p>
              <ScrollArea className="h-48 border rounded-md p-2">
                {allUsers.filter(u => u.user_id !== user?.id).map(u => (
                  <label key={u.user_id} className="flex items-center gap-2 py-1.5 px-1 hover:bg-accent/50 rounded cursor-pointer">
                    <Checkbox
                      checked={selectedUsers.includes(u.user_id)}
                      onCheckedChange={(checked) => {
                        setSelectedUsers(prev => checked ? [...prev, u.user_id] : prev.filter(id => id !== u.user_id));
                      }}
                    />
                    <span className="text-sm">{u.name || u.email}</span>
                  </label>
                ))}
              </ScrollArea>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateDialogOpen(false)}>Cancelar</Button>
            <Button onClick={handleCreateChannel} disabled={!channelName.trim()}>Criar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Manage Members Dialog */}
      <Dialog open={manageMembersOpen} onOpenChange={setManageMembersOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Gerenciar Membros</DialogTitle>
          </DialogHeader>
          <ScrollArea className="h-64 border rounded-md p-2">
            {allUsers.map(u => (
              <label key={u.user_id} className="flex items-center gap-2 py-1.5 px-1 hover:bg-accent/50 rounded cursor-pointer">
                <Checkbox
                  checked={selectedUsers.includes(u.user_id)}
                  onCheckedChange={(checked) => {
                    setSelectedUsers(prev => checked ? [...prev, u.user_id] : prev.filter(id => id !== u.user_id));
                  }}
                />
                <span className="text-sm">{u.name || u.email}</span>
              </label>
            ))}
          </ScrollArea>
          <DialogFooter>
            <Button variant="outline" onClick={() => setManageMembersOpen(false)}>Cancelar</Button>
            <Button onClick={handleSaveMembers}>Salvar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  );
}
