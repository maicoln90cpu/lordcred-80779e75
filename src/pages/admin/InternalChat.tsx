import { useState, useRef } from 'react';
import MyProfilePanel from '@/components/profile/MyProfilePanel';
import { supabase } from '@/integrations/supabase/client';
import DashboardLayout from '@/components/layout/DashboardLayout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { Checkbox } from '@/components/ui/checkbox';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';
import { Plus, Send, Users, Trash2, MessageSquare, User, Paperclip, Image, FileText, Film, Mic, X, Download, Settings, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useInternalChat } from '@/hooks/useInternalChat';

export default function InternalChat() {
  const ic = useInternalChat();
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [directDialogOpen, setDirectDialogOpen] = useState(false);
  const [sellerEmailSearch, setSellerEmailSearch] = useState('');
  const [sellerEmailError, setSellerEmailError] = useState('');
  const [manageMembersOpen, setManageMembersOpen] = useState(false);
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [channelToDelete, setChannelToDelete] = useState<string | null>(null);
  const [channelName, setChannelName] = useState('');
  const [channelDesc, setChannelDesc] = useState('');
  const [configGroupName, setConfigGroupName] = useState('');
  const [configGroupDesc, setConfigGroupDesc] = useState('');
  const [configAdminOnly, setConfigAdminOnly] = useState(false);
  const [configAllowedUsers, setConfigAllowedUsers] = useState<string[]>([]);
  const [savingConfig, setSavingConfig] = useState(false);
  const [profilePanelOpen, setProfilePanelOpen] = useState(false);
  const [supportConfigOpen, setSupportConfigOpen] = useState(false);
  const [supportConfigUserId, setSupportConfigUserId] = useState('');
  const [supportConfigProfiles, setSupportConfigProfiles] = useState<{ user_id: string; name: string | null; email: string }[]>([]);
  const [savingSupport, setSavingSupport] = useState(false);

  const openSupportConfig = async () => {
    const { data: profiles } = await supabase.rpc('get_visible_profiles');
    setSupportConfigProfiles((profiles as any[] || []));
    setSupportConfigUserId(ic.supportUserId || '');
    setSupportConfigOpen(true);
  };

  const openGroupConfig = () => {
    if (!ic.selectedChannel) return;
    ic.setSelectedUsers(ic.channelMembers);
    setConfigGroupName(ic.selectedChannel.name);
    setConfigGroupDesc(ic.selectedChannel.description || '');
    setConfigAdminOnly((ic.selectedChannel as any).admin_only_messages || false);
    setConfigAllowedUsers((ic.selectedChannel as any).config_allowed_users || []);
    setManageMembersOpen(true);
  };

  const confirmDeleteChannel = (channelId: string) => { setChannelToDelete(channelId); setDeleteConfirmOpen(true); };

  const doDeleteChannel = async () => {
    if (!channelToDelete) return;
    await ic.handleDeleteChannel(channelToDelete);
    setDeleteConfirmOpen(false);
    setChannelToDelete(null);
  };

  const doSaveGroupConfig = async () => {
    setSavingConfig(true);
    const ok = await ic.handleSaveGroupConfig(configGroupName, configGroupDesc, configAdminOnly, configAllowedUsers);
    setSavingConfig(false);
    if (ok) setManageMembersOpen(false);
  };

  const doSaveSupportConfig = async () => {
    if (!supportConfigUserId) return;
    setSavingSupport(true);
    await ic.saveSupportConfig(supportConfigUserId);
    setSavingSupport(false);
    setSupportConfigOpen(false);
  };

  const renderContentWithLinks = (content: string) => {
    const urlRegex = /(https?:\/\/[^\s<>"']+)/g;
    const parts = content.split(urlRegex);
    if (parts.length === 1) return content;
    return parts.map((part, i) => {
      if (/(https?:\/\/[^\s<>"']+)/.test(part)) return <a key={i} href={part} target="_blank" rel="noopener noreferrer" className="underline break-all hover:opacity-80">{part}</a>;
      return part;
    });
  };

  const renderMedia = (msg: any) => {
    if (!msg.media_url || !msg.media_type) return null;
    const isMe = msg.user_id === ic.user?.id;
    switch (msg.media_type) {
      case 'image': return <img src={msg.media_url} alt={msg.media_name || 'Imagem'} className="max-w-full rounded-md mb-1 cursor-pointer max-h-64 object-contain" onClick={() => window.open(msg.media_url!, '_blank')} />;
      case 'video': return <video controls className="max-w-full rounded-md mb-1 max-h-64"><source src={msg.media_url} /></video>;
      case 'audio': return <audio controls className="w-full mb-1 max-w-[250px]"><source src={msg.media_url} /></audio>;
      case 'document': return <a href={msg.media_url} target="_blank" rel="noopener noreferrer" className={cn("flex items-center gap-2 rounded-md p-2 mb-1 text-sm", isMe ? "bg-primary-foreground/10" : "bg-accent/50")}><FileText className="w-4 h-4 shrink-0" /><span className="truncate">{msg.media_name || 'Documento'}</span><Download className="w-3 h-3 shrink-0 ml-auto" /></a>;
      default: return null;
    }
  };

  return (
    <DashboardLayout>
      <div className="flex h-[calc(100vh-6rem)] rounded-lg border border-border overflow-hidden bg-card">
        {/* Channel list */}
        <div className="w-72 border-r border-border flex flex-col">
          <div className="p-3 border-b border-border flex items-center justify-between">
            <h2 className="font-semibold text-sm">Chat Interno</h2>
            <div className="flex gap-1">
              <Button variant="ghost" size="icon" className="h-8 w-8" title="Meu Perfil" onClick={() => setProfilePanelOpen(true)}><User className="w-4 h-4" /></Button>
              <Button variant="ghost" size="icon" className="h-8 w-8" title="Nova conversa direta" onClick={() => setDirectDialogOpen(true)}><MessageSquare className="w-4 h-4" /></Button>
              {ic.isAdmin && <Button variant="ghost" size="icon" className="h-8 w-8" title="Config. Suporte" onClick={openSupportConfig}><Settings className="w-4 h-4" /></Button>}
              {ic.isAdmin && <Button variant="ghost" size="icon" className="h-8 w-8" title="Criar grupo" onClick={() => { ic.setSelectedUsers([]); setCreateDialogOpen(true); }}><Plus className="w-4 h-4" /></Button>}
            </div>
          </div>
          <ScrollArea className="flex-1">
            {ic.channels.map(ch => {
              const unread = ic.unreadByChannel[ch.id] || 0;
              const otherUserId = ic.getDirectChatUserId(ch);
              const isOnline = otherUserId ? ic.onlineUsers.has(otherUserId) : false;
              return (
                <div key={ch.id} className={cn("group flex items-center gap-2 px-3 py-2.5 cursor-pointer hover:bg-accent/50 transition-colors border-b border-border/30", ic.selectedChannel?.id === ch.id && "bg-accent")} onClick={() => { ic.setSelectedChannel(ch); ic.markAsRead(ch.id); }}>
                  <div className="relative w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center shrink-0 overflow-hidden">
                    {(ch as any).avatar_url ? <img src={(ch as any).avatar_url} alt="" className="w-full h-full object-cover" /> : !ch.is_group && otherUserId && ic.profilesMap[otherUserId]?.avatar_url ? <img src={ic.profilesMap[otherUserId].avatar_url!} alt="" className="w-full h-full object-cover" /> : ch.is_group ? <Users className="w-4 h-4 text-primary" /> : <User className="w-4 h-4 text-primary" />}
                    {!ch.is_group && isOnline && <span className="absolute -bottom-0.5 -right-0.5 w-3 h-3 bg-green-500 rounded-full border-2 border-card" />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1">
                      <p className="text-sm font-medium truncate flex-1">{ic.getChannelDisplayName(ch)}</p>
                      {unread > 0 && <Badge className="h-5 min-w-5 flex items-center justify-center p-0 text-[10px] bg-destructive text-destructive-foreground border-0 shrink-0">{unread > 99 ? '99+' : unread}</Badge>}
                    </div>
                    {ic.lastMessages[ch.id] ? <p className={cn("text-xs truncate", unread > 0 ? "text-foreground font-medium" : "text-muted-foreground")}>{ic.lastMessages[ch.id]}</p> : ch.description ? <p className="text-xs text-muted-foreground truncate">{ch.description}</p> : null}
                  </div>
                  {ic.isAdmin && <Button variant="ghost" size="icon" className="shrink-0 opacity-0 group-hover:opacity-100 h-6 w-6" onClick={(e) => { e.stopPropagation(); confirmDeleteChannel(ch.id); }}><Trash2 className="w-3 h-3" /></Button>}
                </div>
              );
            })}
            {ic.channels.length === 0 && <p className="text-center text-sm text-muted-foreground py-8">Nenhum grupo ainda</p>}
          </ScrollArea>
        </div>

        {/* Messages area */}
        <div className="flex-1 flex flex-col">
          {ic.selectedChannel ? (
            <>
              <div className="px-4 py-3 border-b border-border flex items-center justify-between">
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="font-semibold text-sm">{ic.getChannelDisplayName(ic.selectedChannel)}</h3>
                    {!ic.selectedChannel.is_group && (() => {
                      const uid = ic.getDirectChatUserId(ic.selectedChannel);
                      const online = uid ? ic.onlineUsers.has(uid) : false;
                      return <span className={cn("text-xs", online ? "text-green-500" : "text-muted-foreground")}>{online ? '● Online' : '○ Offline'}</span>;
                    })()}
                  </div>
                  <p className="text-xs text-muted-foreground">{ic.selectedChannel.is_group ? `${ic.channelMembers.length} membro(s) · ${ic.channelMembers.filter(m => ic.onlineUsers.has(m)).length} online` : 'Conversa direta'}</p>
                </div>
                {ic.selectedChannel.is_group && ic.canAccessGroupConfig(ic.selectedChannel) && <Button variant="outline" size="sm" onClick={openGroupConfig}><Settings className="w-3.5 h-3.5 mr-1.5" />Configurações</Button>}
              </div>
              <ScrollArea className="flex-1 px-4 py-3">
                {ic.groupedMessages.map(group => (
                  <div key={group.date}>
                    <div className="flex items-center gap-2 my-3"><div className="flex-1 h-px bg-border" /><span className="text-xs text-muted-foreground px-2">{group.date}</span><div className="flex-1 h-px bg-border" /></div>
                    {group.msgs.map(msg => {
                      const isMe = msg.user_id === ic.user?.id;
                      const senderName = msg.user_name || msg.user_email?.split('@')[0] || 'Usuário';
                      return (
                        <div key={msg.id} className={cn("flex mb-2 items-end gap-1.5", isMe ? "justify-end" : "justify-start")}>
                          {!isMe && <Avatar className="w-6 h-6 shrink-0 mb-1">{ic.profilesMap[msg.user_id]?.avatar_url ? <AvatarImage src={ic.profilesMap[msg.user_id].avatar_url!} /> : null}<AvatarFallback className="text-[10px] bg-muted">{(senderName[0] || 'U').toUpperCase()}</AvatarFallback></Avatar>}
                          <div className={cn("max-w-[70%] rounded-lg px-3 py-2", isMe ? "bg-primary text-primary-foreground" : "bg-muted", msg.is_optimistic && "opacity-70")}>
                            {!isMe && <p className="text-xs font-medium opacity-70 mb-0.5">{senderName}</p>}
                            {renderMedia(msg)}
                            {msg.content && <p className="text-sm whitespace-pre-wrap break-words">{renderContentWithLinks(msg.content)}</p>}
                            <p className={cn("text-[10px] mt-0.5", isMe ? "text-primary-foreground/60" : "text-muted-foreground")}>{ic.formatTime(msg.created_at)}</p>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                ))}
                <div ref={ic.messagesEndRef} />
              </ScrollArea>

              {ic.typingText && <div className="px-4 pb-1"><p className="text-xs text-muted-foreground italic flex items-center gap-1">{ic.typingText}<span className="inline-flex gap-0.5"><span className="w-1 h-1 bg-muted-foreground rounded-full animate-bounce" style={{ animationDelay: '0ms' }} /><span className="w-1 h-1 bg-muted-foreground rounded-full animate-bounce" style={{ animationDelay: '150ms' }} /><span className="w-1 h-1 bg-muted-foreground rounded-full animate-bounce" style={{ animationDelay: '300ms' }} /></span></p></div>}

              {ic.mediaPreview && (
                <div className="px-3 py-2 border-t border-border bg-muted/50 flex items-center gap-3">
                  {ic.mediaPreview.type === 'image' && <img src={ic.mediaPreview.url} alt="Preview" className="h-16 w-16 object-cover rounded-md" />}
                  {ic.mediaPreview.type === 'video' && <div className="h-16 w-16 rounded-md bg-accent flex items-center justify-center"><Film className="w-6 h-6 text-muted-foreground" /></div>}
                  {ic.mediaPreview.type === 'audio' && <div className="h-16 w-16 rounded-md bg-accent flex items-center justify-center"><Mic className="w-6 h-6 text-muted-foreground" /></div>}
                  {ic.mediaPreview.type === 'document' && <div className="h-16 w-16 rounded-md bg-accent flex items-center justify-center"><FileText className="w-6 h-6 text-muted-foreground" /></div>}
                  <div className="flex-1 min-w-0"><p className="text-sm truncate">{ic.mediaPreview.file.name}</p><p className="text-xs text-muted-foreground">{(ic.mediaPreview.file.size / 1024).toFixed(0)} KB</p></div>
                  <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => { URL.revokeObjectURL(ic.mediaPreview!.url); ic.setMediaPreview(null); }}><X className="w-4 h-4" /></Button>
                </div>
              )}

              {ic.selectedChannel?.admin_only_messages && ic.isSeller ? (
                <div className="p-4 border-t border-border text-center text-sm text-muted-foreground">Somente administradores podem enviar mensagens neste grupo.</div>
              ) : (
                <div className="p-3 border-t border-border flex gap-2 items-center">
                  <input ref={ic.fileInputRef} type="file" accept="image/*,video/*,audio/*,.pdf,.doc,.docx,.xls,.xlsx,.txt" className="hidden" onChange={ic.handleFileSelect} />
                  {ic.isRecording ? (
                    <div className="flex-1 flex items-center gap-3">
                      <Button variant="ghost" size="icon" className="h-9 w-9 text-destructive" onClick={ic.cancelRecording}><Trash2 className="w-4 h-4" /></Button>
                      <div className="flex items-center gap-2 flex-1"><span className="w-2 h-2 rounded-full bg-destructive animate-pulse" /><span className="text-sm text-destructive font-mono">{ic.formatRecordingTime(ic.recordingTime)}</span></div>
                      <Button size="icon" className="h-9 w-9 rounded-full" onClick={ic.stopRecording}><Send className="w-4 h-4" /></Button>
                    </div>
                  ) : (
                    <>
                      <Button variant="ghost" size="icon" className="h-9 w-9 shrink-0" onClick={() => ic.fileInputRef.current?.click()}><Paperclip className="w-4 h-4" /></Button>
                      <Input value={ic.newMessage} onChange={e => { ic.setNewMessage(e.target.value); ic.broadcastTyping(); }} placeholder="Digite sua mensagem..." onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); ic.handleSendMessage(); } }} onPaste={e => { const items = e.clipboardData?.items; if (!items) return; for (let i = 0; i < items.length; i++) { if (items[i].type.startsWith('image/')) { e.preventDefault(); const file = items[i].getAsFile(); if (file) { const url = URL.createObjectURL(file); ic.setMediaPreview({ file, type: 'image', url }); } return; } } }} className="flex-1" />
                      {ic.newMessage.trim() || ic.mediaPreview ? <Button onClick={() => ic.handleSendMessage()} className="h-9 w-9 shrink-0" size="icon"><Send className="w-4 h-4" /></Button> : <Button variant="ghost" size="icon" className="h-9 w-9 shrink-0" onClick={ic.startRecording}><Mic className="w-4 h-4" /></Button>}
                    </>
                  )}
                </div>
              )}
            </>
          ) : (
            <div className="flex-1 flex items-center justify-center text-muted-foreground"><div className="text-center"><Users className="w-12 h-12 mx-auto mb-3 opacity-30" /><p className="text-sm">Selecione uma conversa</p></div></div>
          )}
        </div>
      </div>

      {/* Create Group Dialog */}
      <Dialog open={createDialogOpen} onOpenChange={setCreateDialogOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Criar Grupo</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <Input placeholder="Nome do grupo" value={channelName} onChange={e => setChannelName(e.target.value)} />
            <Input placeholder="Descrição (opcional)" value={channelDesc} onChange={e => setChannelDesc(e.target.value)} />
            <div>
              <p className="text-sm font-medium mb-2">Adicionar membros:</p>
              <ScrollArea className="h-48 border rounded-md p-2">
                {ic.allUsers.filter(u => u.user_id !== ic.user?.id).map(u => (
                  <label key={u.user_id} className="flex items-center gap-2 py-1.5 px-1 hover:bg-accent/50 rounded cursor-pointer">
                    <Checkbox checked={ic.selectedUsers.includes(u.user_id)} onCheckedChange={(checked) => { ic.setSelectedUsers(prev => checked ? [...prev, u.user_id] : prev.filter(id => id !== u.user_id)); }} />
                    <span className="text-sm">{u.name || u.email}</span>
                  </label>
                ))}
              </ScrollArea>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateDialogOpen(false)}>Cancelar</Button>
            <Button onClick={() => { ic.handleCreateChannel(channelName, channelDesc); setCreateDialogOpen(false); setChannelName(''); setChannelDesc(''); }} disabled={!channelName.trim()}>Criar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Direct Chat Dialog */}
      <Dialog open={directDialogOpen} onOpenChange={(open) => { setDirectDialogOpen(open); if (!open) { setSellerEmailSearch(''); setSellerEmailError(''); } }}>
        <DialogContent>
          <DialogHeader><DialogTitle>Nova Conversa Direta</DialogTitle></DialogHeader>
          {ic.isSeller ? (
            <>
              <p className="text-sm text-muted-foreground">Digite o email completo do usuário para iniciar uma conversa:</p>
              <div className="space-y-3">
                <Input placeholder="Digite o email completo do usuário..." value={sellerEmailSearch} onChange={(e) => { setSellerEmailSearch(e.target.value); setSellerEmailError(''); }} />
                {sellerEmailError && <p className="text-xs text-destructive">{sellerEmailError}</p>}
                {sellerEmailSearch.trim().length >= 3 && (() => {
                  const query = sellerEmailSearch.trim().toLowerCase();
                  const matches = ic.allUsers.filter(u => u.user_id !== ic.user?.id && u.email.toLowerCase() === query);
                  return matches.length > 0 ? (
                    <ScrollArea className="h-40 border rounded-md p-2">
                      {matches.map(u => {
                        const isOnline = ic.onlineUsers.has(u.user_id);
                        return (
                          <div key={u.user_id} className="flex items-center gap-3 py-2 px-2 hover:bg-accent/50 rounded cursor-pointer transition-colors" onClick={() => { ic.handleStartDirectChat(u.user_id); setDirectDialogOpen(false); setSellerEmailSearch(''); }}>
                            <Avatar className="w-7 h-7">{ic.profilesMap[u.user_id]?.avatar_url ? <AvatarImage src={ic.profilesMap[u.user_id].avatar_url!} /> : null}<AvatarFallback className="text-[10px] bg-primary/20 text-primary">{(u.name?.[0] || u.email[0] || 'U').toUpperCase()}</AvatarFallback></Avatar>
                            <div className="flex-1 min-w-0"><p className="text-sm font-medium truncate">{u.name || u.email}</p>{u.name && <p className="text-xs text-muted-foreground truncate">{u.email}</p>}</div>
                            <span className={cn("text-xs shrink-0", isOnline ? "text-green-500" : "text-muted-foreground")}>{isOnline ? '●' : '○'}</span>
                          </div>
                        );
                      })}
                    </ScrollArea>
                  ) : null;
                })()}
                {ic.supportUserId && ic.supportUserId !== ic.user?.id ? (
                  <Button variant="outline" className="w-full" onClick={() => { ic.handleStartDirectChat(ic.supportUserId!); setDirectDialogOpen(false); setSellerEmailSearch(''); }}><MessageSquare className="w-4 h-4 mr-2" />Suporte</Button>
                ) : (
                  <p className="text-xs text-muted-foreground text-center">Suporte não configurado. Peça ao admin para configurar em Configurações.</p>
                )}
              </div>
            </>
          ) : (
            <>
              <p className="text-sm text-muted-foreground">Selecione um usuário para iniciar uma conversa:</p>
              <ScrollArea className="h-64 border rounded-md p-2">
                {ic.allUsers.filter(u => u.user_id !== ic.user?.id).map(u => {
                  const isOnline = ic.onlineUsers.has(u.user_id);
                  return (
                    <div key={u.user_id} className="flex items-center gap-3 py-2 px-2 hover:bg-accent/50 rounded cursor-pointer transition-colors" onClick={() => { ic.handleStartDirectChat(u.user_id); setDirectDialogOpen(false); }}>
                      <div className="relative">
                        <Avatar className="w-8 h-8">{ic.profilesMap[u.user_id]?.avatar_url ? <AvatarImage src={ic.profilesMap[u.user_id].avatar_url!} /> : null}<AvatarFallback className="text-xs bg-primary/20 text-primary">{(u.name?.[0] || u.email[0] || 'U').toUpperCase()}</AvatarFallback></Avatar>
                        {isOnline && <span className="absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 bg-green-500 rounded-full border-2 border-card" />}
                      </div>
                      <div className="flex-1"><p className="text-sm font-medium">{u.name || u.email}</p>{u.name && <p className="text-xs text-muted-foreground">{u.email}</p>}</div>
                      <span className={cn("text-xs", isOnline ? "text-green-500" : "text-muted-foreground")}>{isOnline ? 'Online' : 'Offline'}</span>
                    </div>
                  );
                })}
              </ScrollArea>
            </>
          )}
        </DialogContent>
      </Dialog>

      {/* Group Config Dialog */}
      <Dialog open={manageMembersOpen} onOpenChange={setManageMembersOpen}>
        <DialogContent className="sm:max-w-lg max-h-[85vh] overflow-y-auto">
          <DialogHeader><DialogTitle className="flex items-center gap-2"><Settings className="w-5 h-5 text-primary" />Configurações do Grupo</DialogTitle></DialogHeader>
          <input ref={ic.groupAvatarInputRef} type="file" accept="image/*" className="hidden" onChange={ic.handleGroupAvatarUpload} />
          <Tabs defaultValue="info" className="w-full">
            <TabsList className="grid w-full grid-cols-3">
              <TabsTrigger value="info">Info</TabsTrigger>
              <TabsTrigger value="members">Membros</TabsTrigger>
              <TabsTrigger value="permissions">Permissões</TabsTrigger>
            </TabsList>
            <TabsContent value="info" className="space-y-4 mt-3">
              <div className="flex items-center gap-4">
                <div className="relative cursor-pointer" onClick={() => ic.groupAvatarInputRef.current?.click()}>
                  <Avatar className="w-16 h-16">{(ic.selectedChannel as any)?.avatar_url && <AvatarImage src={(ic.selectedChannel as any).avatar_url} />}<AvatarFallback className="bg-primary/20 text-primary text-lg">{ic.selectedChannel?.name?.charAt(0)?.toUpperCase()}</AvatarFallback></Avatar>
                  <div className="absolute inset-0 rounded-full bg-black/40 flex items-center justify-center opacity-0 hover:opacity-100 transition-opacity"><Image className="w-5 h-5 text-white" /></div>
                </div>
                <div className="flex-1 space-y-2"><Label>Nome do grupo</Label><Input value={configGroupName} onChange={e => setConfigGroupName(e.target.value)} /></div>
              </div>
              <div className="space-y-2"><Label>Descrição</Label><Textarea value={configGroupDesc} onChange={e => setConfigGroupDesc(e.target.value)} placeholder="Descrição do grupo (opcional)" rows={3} /></div>
            </TabsContent>
            <TabsContent value="members" className="mt-3">
              <ScrollArea className="h-64 border rounded-md p-2">
                {ic.allUsers.map(u => (
                  <label key={u.user_id} className="flex items-center gap-2 py-1.5 px-1 hover:bg-accent/50 rounded cursor-pointer">
                    <Checkbox checked={ic.selectedUsers.includes(u.user_id)} onCheckedChange={(checked) => { ic.setSelectedUsers(prev => checked ? [...prev, u.user_id] : prev.filter(id => id !== u.user_id)); }} />
                    <span className="text-sm">{u.name || u.email}</span>
                  </label>
                ))}
              </ScrollArea>
            </TabsContent>
            <TabsContent value="permissions" className="mt-3 space-y-4">
              <div className="flex items-center justify-between p-3 rounded-lg border border-border/50">
                <div><p className="text-sm font-medium">Somente admins podem enviar</p><p className="text-xs text-muted-foreground">Apenas administradores poderão enviar mensagens neste grupo</p></div>
                <Switch checked={configAdminOnly} onCheckedChange={setConfigAdminOnly} disabled={!ic.isAdmin} />
              </div>
              {ic.isAdmin && (
                <div className="space-y-2">
                  <Label className="text-sm font-medium">Usuários com acesso às configurações</Label>
                  <p className="text-xs text-muted-foreground">Selecione membros que podem editar nome, descrição, avatar e membros deste grupo.</p>
                  <ScrollArea className="h-40 border rounded-md p-2">
                    {ic.selectedUsers.filter(uid => uid !== ic.user?.id).map(uid => {
                      const profile = ic.profilesMap[uid];
                      return (
                        <label key={uid} className="flex items-center gap-2 py-1.5 px-1 hover:bg-accent/50 rounded cursor-pointer">
                          <Checkbox checked={configAllowedUsers.includes(uid)} onCheckedChange={(checked) => { setConfigAllowedUsers(prev => checked ? [...prev, uid] : prev.filter(id => id !== uid)); }} />
                          <span className="text-sm">{profile?.name || profile?.email || uid}</span>
                        </label>
                      );
                    })}
                  </ScrollArea>
                </div>
              )}
            </TabsContent>
          </Tabs>
          <DialogFooter>
            <Button variant="outline" onClick={() => setManageMembersOpen(false)}>Cancelar</Button>
            <Button onClick={doSaveGroupConfig} disabled={savingConfig}>{savingConfig && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}Salvar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={deleteConfirmOpen} onOpenChange={setDeleteConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader><AlertDialogTitle>Confirmar exclusão</AlertDialogTitle><AlertDialogDescription>Tem certeza que deseja excluir este canal? Todas as mensagens serão perdidas. Esta ação não pode ser desfeita.</AlertDialogDescription></AlertDialogHeader>
          <AlertDialogFooter><AlertDialogCancel>Cancelar</AlertDialogCancel><AlertDialogAction onClick={doDeleteChannel} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">Excluir</AlertDialogAction></AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Support Config Dialog */}
      <Dialog open={supportConfigOpen} onOpenChange={setSupportConfigOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle className="flex items-center gap-2"><Users className="w-5 h-5 text-primary" />Suporte do Chat Interno</DialogTitle></DialogHeader>
          <p className="text-sm text-muted-foreground">Defina o responsável pelo suporte que aparecerá como botão para vendedores</p>
          <div className="space-y-3">
            <Label>Responsável pelo Suporte</Label>
            <select value={supportConfigUserId} onChange={e => setSupportConfigUserId(e.target.value)} className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm">
              <option value="">Selecione um usuário</option>
              {supportConfigProfiles.map(p => <option key={p.user_id} value={p.user_id}>{p.name || p.email}</option>)}
            </select>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setSupportConfigOpen(false)}>Cancelar</Button>
            <Button onClick={doSaveSupportConfig} disabled={savingSupport || !supportConfigUserId}>{savingSupport && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}Salvar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Profile Panel Dialog */}
      <Dialog open={profilePanelOpen} onOpenChange={setProfilePanelOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>Meu Perfil</DialogTitle></DialogHeader>
          <MyProfilePanel />
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  );
}
