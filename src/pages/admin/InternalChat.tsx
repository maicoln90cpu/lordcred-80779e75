import { useState, useEffect, useRef, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
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
import { useToast } from '@/hooks/use-toast';
import { useInternalChatUnread } from '@/hooks/useInternalChatUnread';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';
import { Plus, Send, Users, Trash2, UserPlus, MessageSquare, User, Paperclip, Image, FileText, Film, Mic, MicOff, X, Download, Play, Pause, Settings, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';

interface Channel {
  id: string;
  name: string;
  description: string | null;
  is_group: boolean;
  created_by: string;
  avatar_url?: string | null;
  admin_only_messages?: boolean;
  config_allowed_users?: string[];
}

interface Message {
  id: string;
  channel_id: string;
  user_id: string;
  content: string;
  created_at: string;
  user_email?: string;
  user_name?: string;
  is_optimistic?: boolean;
  media_url?: string | null;
  media_type?: string | null;
  media_name?: string | null;
}

interface UserProfile {
  user_id: string;
  email: string;
  name: string | null;
  avatar_url?: string | null;
}

export default function InternalChat() {
  const { user, isSeller, isMaster, isAdmin: isRealAdmin } = useAuth();
  const { toast } = useToast();
  const { unreadByChannel, onlineUsers, markAsRead, setActiveChannel } = useInternalChatUnread();
  const [channels, setChannels] = useState<Channel[]>([]);
  const [selectedChannel, setSelectedChannel] = useState<Channel | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [directDialogOpen, setDirectDialogOpen] = useState(false);
  const [sellerEmailSearch, setSellerEmailSearch] = useState('');
  const [sellerEmailError, setSellerEmailError] = useState('');
  const [supportAdminUsers, setSupportAdminUsers] = useState<UserProfile[]>([]);
  const [manageMembersOpen, setManageMembersOpen] = useState(false);
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [channelToDelete, setChannelToDelete] = useState<string | null>(null);
  const [channelName, setChannelName] = useState('');
  const [channelDesc, setChannelDesc] = useState('');
  const [allUsers, setAllUsers] = useState<UserProfile[]>([]);
  const [selectedUsers, setSelectedUsers] = useState<string[]>([]);
  const [channelMembers, setChannelMembers] = useState<string[]>([]);
  const [allChannelMembers, setAllChannelMembers] = useState<Record<string, string[]>>({});
  const [profilesMap, setProfilesMap] = useState<Record<string, UserProfile>>({});
  const [lastMessages, setLastMessages] = useState<Record<string, string>>({});
  const [typingUsers, setTypingUsers] = useState<Record<string, string>>({});
  const [isRecording, setIsRecording] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);
  const [mediaPreview, setMediaPreview] = useState<{ file: File; type: string; url: string } | null>(null);
  // Group config state
  const [configGroupName, setConfigGroupName] = useState('');
  const [configGroupDesc, setConfigGroupDesc] = useState('');
  const [configAdminOnly, setConfigAdminOnly] = useState(false);
  const [configAllowedUsers, setConfigAllowedUsers] = useState<string[]>([]);
  const [savingConfig, setSavingConfig] = useState(false);
  const [supportUserId, setSupportUserId] = useState<string | null>(null);
  const [supportConfigOpen, setSupportConfigOpen] = useState(false);
  const [supportConfigUserId, setSupportConfigUserId] = useState<string>('');
  const [supportConfigProfiles, setSupportConfigProfiles] = useState<{ user_id: string; name: string | null; email: string }[]>([]);
  const [savingSupport, setSavingSupport] = useState(false);
  const [settingsId, setSettingsId] = useState<string | null>(null);
  const groupAvatarInputRef = useRef<HTMLInputElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const profilesMapRef = useRef<Record<string, UserProfile>>({});
  const selectedChannelRef = useRef<Channel | null>(null);
  const typingTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const typingChannelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const recordingIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const isAdmin = !isSeller;

  // Keep ref in sync
  useEffect(() => {
    selectedChannelRef.current = selectedChannel;
  }, [selectedChannel]);

  // Set active channel for notification suppression — only markAsRead on EXPLICIT click
  useEffect(() => {
    if (selectedChannel) {
      setActiveChannel(selectedChannel.id);
    }
    return () => setActiveChannel(null);
  }, [selectedChannel, setActiveChannel]);

  // Load channels and all their members
  const loadChannels = useCallback(async () => {
    const { data } = await supabase
      .from('internal_channels')
      .select('*')
      .order('updated_at', { ascending: false });
    if (data) {
      setChannels(data);
      // Load all members for all channels to resolve direct chat names
      const channelIds = data.map(c => c.id);
      if (channelIds.length > 0) {
        const { data: members } = await supabase
          .from('internal_channel_members')
          .select('channel_id, user_id')
          .in('channel_id', channelIds);
        if (members) {
          const map: Record<string, string[]> = {};
          members.forEach(m => {
            if (!map[m.channel_id]) map[m.channel_id] = [];
            map[m.channel_id].push(m.user_id);
          });
          setAllChannelMembers(map);
        }
      }
    }
  }, []);

  // Load all users (use get_all_chat_profiles for starting new chats)
  const loadUsers = useCallback(async () => {
    const { data: allData } = await supabase.rpc('get_all_chat_profiles' as any);
    // Use v2 for avatar_url support
    const { data: chatData } = await supabase.rpc('get_internal_chat_profiles_v2' as any);
    // Fallback to original if v2 doesn't exist
    const chatProfiles = chatData || (await supabase.rpc('get_internal_chat_profiles')).data;
    
    let users = (allData || chatProfiles || []) as unknown as UserProfile[];

    // Hide master users from non-master roles using SECURITY DEFINER function
    let masterIds = new Set<string>();
    if (!isMaster) {
      const { data: masterIdsArr } = await supabase.rpc('get_master_user_ids' as any);
      masterIds = new Set<string>((masterIdsArr as string[]) || []);
      users = users.filter(u => !masterIds.has(u.user_id));
    }

    setAllUsers(users);
    const map: Record<string, UserProfile> = {};
    users.forEach(u => { map[u.user_id] = u; });
    
    // Also merge chat profiles to ensure we have all senders with avatar_url
    if (chatProfiles && allData) {
      (chatProfiles as unknown as UserProfile[]).forEach(u => {
        if (masterIds.has(u.user_id)) return; // skip masters for non-master
        if (!map[u.user_id]) map[u.user_id] = u;
        else if (u.avatar_url && !map[u.user_id].avatar_url) {
          map[u.user_id].avatar_url = u.avatar_url;
        }
      });
    }
    
    setProfilesMap(map);
    profilesMapRef.current = map;

    // Load support/admin/master users for seller direct chat list
    const { data: rolesData } = await supabase
      .from('user_roles')
      .select('user_id, role')
      .in('role', ['support', 'admin', 'master']);
    if (rolesData) {
      const filteredRoles = isMaster ? rolesData : rolesData.filter((r: any) => r.role !== 'master');
      const saUsers = users.filter(u => filteredRoles.some((r: any) => r.user_id === u.user_id));
      setSupportAdminUsers(saUsers);
    }
  }, [isMaster]);

  // Load last message preview for each channel
  const loadLastMessages = useCallback(async (channelIds: string[]) => {
    if (channelIds.length === 0) return;
    const pMap = profilesMapRef.current;
    const previews: Record<string, string> = {};
    for (const cid of channelIds) {
      const { data } = await supabase
        .from('internal_messages')
        .select('content, user_id, media_type')
        .eq('channel_id', cid)
        .order('created_at', { ascending: false })
        .limit(1);
      if (data && data[0]) {
        const sender = pMap[data[0].user_id];
        const name = sender?.name || sender?.email?.split('@')[0] || '';
        const content = data[0].media_type ? `📎 ${data[0].media_type === 'image' ? 'Imagem' : data[0].media_type === 'audio' ? 'Áudio' : data[0].media_type === 'video' ? 'Vídeo' : 'Arquivo'}` : data[0].content;
        previews[cid] = `${name}: ${content}`.slice(0, 60);
      }
    }
    setLastMessages(previews);
  }, []);

  // Load messages for a channel
  const loadMessages = useCallback(async (channelId: string) => {
    const pMap = profilesMapRef.current;
    const { data } = await supabase
      .from('internal_messages')
      .select('*')
      .eq('channel_id', channelId)
      .order('created_at', { ascending: true })
      .limit(200);
    if (data) {
      setMessages(data.map(m => ({
        ...m,
        user_email: pMap[m.user_id]?.email,
        user_name: pMap[m.user_id]?.name,
      })));
    }
  }, []);

  // Load channel members
  const loadMembers = useCallback(async (channelId: string) => {
    const { data } = await supabase
      .from('internal_channel_members')
      .select('user_id')
      .eq('channel_id', channelId);
    if (data) setChannelMembers(data.map(m => m.user_id));
  }, []);

  useEffect(() => { loadChannels(); loadUsers(); loadSupportUser(); }, [loadChannels, loadUsers]);

  // Load support user from system_settings
  const loadSupportUser = useCallback(async () => {
    const { data } = await supabase.from('system_settings').select('id,support_chat_user_id').single();
    if (data) {
      setSettingsId(data.id);
      if ((data as any).support_chat_user_id) {
        setSupportUserId((data as any).support_chat_user_id);
      }
    }
  }, []);

  // Open support config dialog (admin only)
  const openSupportConfig = async () => {
    const [{ data: profiles }, { data: masterIds }] = await Promise.all([
      supabase.rpc('get_all_chat_profiles' as any),
      supabase.rpc('get_master_user_ids'),
    ]);
    const masterSet = new Set((masterIds as string[]) || []);
    setSupportConfigProfiles((profiles as any[] || []).filter((p: any) => !masterSet.has(p.user_id)));
    setSupportConfigUserId(supportUserId || '');
    setSupportConfigOpen(true);
  };

  const saveSupportConfig = async () => {
    if (!supportConfigUserId || !settingsId) return;
    setSavingSupport(true);
    const { error } = await supabase.from('system_settings').update({ support_chat_user_id: supportConfigUserId } as any).eq('id', settingsId);
    if (error) toast({ title: 'Erro', description: error.message, variant: 'destructive' });
    else {
      setSupportUserId(supportConfigUserId);
      toast({ title: 'Responsável pelo suporte atualizado' });
    }
    setSavingSupport(false);
    setSupportConfigOpen(false);
  };

  useEffect(() => {
    if (channels.length > 0 && Object.keys(profilesMap).length > 0) {
      loadLastMessages(channels.map(c => c.id));
    }
  }, [channels, profilesMap, loadLastMessages]);

  useEffect(() => {
    if (selectedChannel && Object.keys(profilesMapRef.current).length > 0) {
      loadMessages(selectedChannel.id);
      loadMembers(selectedChannel.id);
    }
  }, [selectedChannel, loadMessages, loadMembers]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Realtime subscription for current channel messages
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
        const pMap = profilesMapRef.current;
        setMessages(prev => {
          const filtered = prev.filter(m => {
            if (m.id === msg.id) return false;
            if (m.is_optimistic && m.user_id === msg.user_id && m.content === msg.content) return false;
            return true;
          });
          return [...filtered, {
            ...msg,
            user_email: pMap[msg.user_id]?.email,
            user_name: pMap[msg.user_id]?.name,
          }];
        });
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [selectedChannel]);

  // Global realtime for last message preview updates
  useEffect(() => {
    if (!user) return;
    const notifChannel = supabase
      .channel('internal-msgs-previews')
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'internal_messages',
      }, (payload) => {
        const msg = payload.new as any;
        if (msg.user_id === user.id) return;
        if (selectedChannelRef.current?.id === msg.channel_id) return;

        const pMap = profilesMapRef.current;
        const senderName = pMap[msg.user_id]?.name || pMap[msg.user_id]?.email?.split('@')[0] || 'Alguém';
        const content = msg.media_type ? '📎 Mídia' : msg.content;
        setLastMessages(prev => ({
          ...prev,
          [msg.channel_id]: `${senderName}: ${content}`.slice(0, 60),
        }));
      })
      .subscribe();
    return () => { supabase.removeChannel(notifChannel); };
  }, [user]);

  // Typing indicator via broadcast
  useEffect(() => {
    if (!selectedChannel || !user) return;

    const typChannel = supabase.channel(`typing-${selectedChannel.id}`);
    typingChannelRef.current = typChannel;

    typChannel
      .on('broadcast', { event: 'typing' }, ({ payload }) => {
        if (payload.user_id === user.id) return;
        const pMap = profilesMapRef.current;
        const name = pMap[payload.user_id]?.name || pMap[payload.user_id]?.email?.split('@')[0] || 'Alguém';
        setTypingUsers(prev => ({ ...prev, [payload.user_id]: name }));
        // Auto-clear after 3s
        setTimeout(() => {
          setTypingUsers(prev => {
            const copy = { ...prev };
            delete copy[payload.user_id];
            return copy;
          });
        }, 3000);
      })
      .subscribe();

    return () => {
      supabase.removeChannel(typChannel);
      typingChannelRef.current = null;
    };
  }, [selectedChannel, user]);

  const broadcastTyping = useCallback(() => {
    if (!typingChannelRef.current || !user) return;
    if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
    typingChannelRef.current.send({
      type: 'broadcast',
      event: 'typing',
      payload: { user_id: user.id },
    });
    typingTimeoutRef.current = setTimeout(() => {
      typingTimeoutRef.current = null;
    }, 2000);
  }, [user]);

  // File upload helper
  const uploadMedia = async (file: File): Promise<{ url: string; type: string; name: string } | null> => {
    const ext = file.name.split('.').pop() || 'bin';
    const path = `${user!.id}/${Date.now()}.${ext}`;
    const { error } = await supabase.storage.from('internal-chat-media').upload(path, file);
    if (error) {
      toast({ title: 'Erro ao enviar mídia', description: error.message, variant: 'destructive' });
      return null;
    }
    const { data: urlData } = supabase.storage.from('internal-chat-media').getPublicUrl(path);
    let mediaType = 'document';
    if (file.type.startsWith('image/')) mediaType = 'image';
    else if (file.type.startsWith('video/')) mediaType = 'video';
    else if (file.type.startsWith('audio/')) mediaType = 'audio';
    return { url: urlData.publicUrl, type: mediaType, name: file.name };
  };

  const handleSendMessage = async (overrideMedia?: { url: string; type: string; name: string }) => {
    if (!selectedChannel || !user) return;
    const content = newMessage.trim();
    const media = overrideMedia || null;
    if (!content && !media && !mediaPreview) return;

    let finalMedia = media;
    if (!finalMedia && mediaPreview) {
      const uploaded = await uploadMedia(mediaPreview.file);
      if (!uploaded) return;
      finalMedia = uploaded;
      URL.revokeObjectURL(mediaPreview.url);
      setMediaPreview(null);
    }

    setNewMessage('');

    const pMap = profilesMapRef.current;
    const optimisticId = crypto.randomUUID();

    setMessages(prev => [...prev, {
      id: optimisticId,
      channel_id: selectedChannel.id,
      user_id: user.id,
      content: content || (finalMedia ? '' : ''),
      created_at: new Date().toISOString(),
      user_email: pMap[user.id]?.email,
      user_name: pMap[user.id]?.name,
      is_optimistic: true,
      media_url: finalMedia?.url || null,
      media_type: finalMedia?.type || null,
      media_name: finalMedia?.name || null,
    }]);

    const senderName = pMap[user.id]?.name || pMap[user.id]?.email?.split('@')[0] || '';
    const previewText = finalMedia ? `📎 ${finalMedia.type === 'image' ? 'Imagem' : finalMedia.type === 'audio' ? 'Áudio' : finalMedia.type === 'video' ? 'Vídeo' : 'Arquivo'}` : content;
    setLastMessages(prev => ({ ...prev, [selectedChannel.id]: `${senderName}: ${previewText}`.slice(0, 60) }));

    const insertData: any = {
      channel_id: selectedChannel.id,
      user_id: user.id,
      content: content || '',
    };
    if (finalMedia) {
      insertData.media_url = finalMedia.url;
      insertData.media_type = finalMedia.type;
      insertData.media_name = finalMedia.name;
    }

    await supabase.from('internal_messages').insert(insertData);
    await supabase.from('internal_channels').update({ updated_at: new Date().toISOString() }).eq('id', selectedChannel.id);
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const url = URL.createObjectURL(file);
    let type = 'document';
    if (file.type.startsWith('image/')) type = 'image';
    else if (file.type.startsWith('video/')) type = 'video';
    else if (file.type.startsWith('audio/')) type = 'audio';
    setMediaPreview({ file, type, url });
    e.target.value = '';
  };

  // Audio recording
  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const recorder = new MediaRecorder(stream);
      audioChunksRef.current = [];
      recorder.ondataavailable = (e) => { if (e.data.size > 0) audioChunksRef.current.push(e.data); };
      recorder.onstop = async () => {
        stream.getTracks().forEach(t => t.stop());
        const blob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
        const file = new File([blob], `audio-${Date.now()}.webm`, { type: 'audio/webm' });
        const uploaded = await uploadMedia(file);
        if (uploaded) {
          await handleSendMessage(uploaded);
        }
      };
      recorder.start();
      mediaRecorderRef.current = recorder;
      setIsRecording(true);
      setRecordingTime(0);
      recordingIntervalRef.current = setInterval(() => setRecordingTime(t => t + 1), 1000);
    } catch {
      toast({ title: 'Erro', description: 'Não foi possível acessar o microfone', variant: 'destructive' });
    }
  };

  const stopRecording = () => {
    mediaRecorderRef.current?.stop();
    setIsRecording(false);
    if (recordingIntervalRef.current) clearInterval(recordingIntervalRef.current);
  };

  const cancelRecording = () => {
    if (mediaRecorderRef.current) {
      mediaRecorderRef.current.ondataavailable = null;
      mediaRecorderRef.current.onstop = null;
      mediaRecorderRef.current.stop();
      mediaRecorderRef.current.stream.getTracks().forEach(t => t.stop());
    }
    setIsRecording(false);
    setRecordingTime(0);
    if (recordingIntervalRef.current) clearInterval(recordingIntervalRef.current);
  };

  const handleCreateChannel = async () => {
    if (!channelName.trim() || !user) return;
    const { data, error } = await supabase.from('internal_channels').insert({
      name: channelName.trim(),
      description: channelDesc.trim() || null,
      is_group: true,
      created_by: user.id,
    }).select().single();
    if (error) { toast({ title: 'Erro', description: error.message, variant: 'destructive' }); return; }
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

  const handleStartDirectChat = async (targetUserId: string) => {
    if (!user) return;
    const targetProfile = profilesMap[targetUserId];
    const channelDisplayName = targetProfile?.name || targetProfile?.email?.split('@')[0] || 'Chat Direto';
    
    // Use SECURITY DEFINER function to bypass RLS for sellers
    const { data: channelId, error } = await supabase.rpc('create_direct_channel' as any, {
      _target_user_id: targetUserId,
      _channel_name: channelDisplayName,
    });
    
    if (error) { toast({ title: 'Erro', description: error.message, variant: 'destructive' }); return; }
    
    setDirectDialogOpen(false);
    await loadChannels();
    
    // Select the newly created/found channel
    const { data: ch } = await supabase
      .from('internal_channels')
      .select('*')
      .eq('id', channelId)
      .single();
    if (ch) setSelectedChannel(ch);
    toast({ title: 'Conversa direta iniciada' });
  };

  const confirmDeleteChannel = (channelId: string) => {
    setChannelToDelete(channelId);
    setDeleteConfirmOpen(true);
  };

  const handleDeleteChannel = async () => {
    if (!channelToDelete) return;
    await supabase.from('internal_channels').delete().eq('id', channelToDelete);
    if (selectedChannel?.id === channelToDelete) {
      setSelectedChannel(null);
      setMessages([]);
    }
    setDeleteConfirmOpen(false);
    setChannelToDelete(null);
    loadChannels();
    toast({ title: 'Grupo removido' });
  };

  const handleSaveMembers = async () => {
    if (!selectedChannel) return;
    await supabase.from('internal_channel_members').delete().eq('channel_id', selectedChannel.id);
    const memberIds = [...new Set([selectedChannel.created_by, ...selectedUsers])];
    await supabase.from('internal_channel_members').insert(
      memberIds.map(uid => ({ channel_id: selectedChannel.id, user_id: uid }))
    );
    setManageMembersOpen(false);
    loadMembers(selectedChannel.id);
    toast({ title: 'Membros atualizados' });
  };

  const openGroupConfig = () => {
    if (!selectedChannel) return;
    setSelectedUsers(channelMembers);
    setConfigGroupName(selectedChannel.name);
    setConfigGroupDesc(selectedChannel.description || '');
    setConfigAdminOnly((selectedChannel as any).admin_only_messages || false);
    setConfigAllowedUsers((selectedChannel as any).config_allowed_users || []);
    setManageMembersOpen(true);
  };

  const canAccessGroupConfig = (ch: Channel) => {
    if (isAdmin) return true;
    if (ch.config_allowed_users && user && ch.config_allowed_users.includes(user.id)) return true;
    return false;
  };

  const handleSaveGroupConfig = async () => {
    if (!selectedChannel) return;
    setSavingConfig(true);
    try {
      const { error } = await supabase.rpc('update_channel_info', {
        _channel_id: selectedChannel.id,
        _name: configGroupName.trim() || selectedChannel.name,
        _description: configGroupDesc.trim() || null,
        _admin_only: configAdminOnly,
        _config_allowed: configAllowedUsers,
      } as any);
      if (error) throw error;
      // Also save members
      await supabase.from('internal_channel_members').delete().eq('channel_id', selectedChannel.id);
      const memberIds = [...new Set([selectedChannel.created_by, ...selectedUsers])];
      await supabase.from('internal_channel_members').insert(
        memberIds.map(uid => ({ channel_id: selectedChannel.id, user_id: uid }))
      );
      setSelectedChannel({ ...selectedChannel, name: configGroupName.trim() || selectedChannel.name, description: configGroupDesc.trim() || null, admin_only_messages: configAdminOnly } as any);
      loadChannels();
      loadMembers(selectedChannel.id);
      toast({ title: 'Configurações do grupo salvas' });
      setManageMembersOpen(false);
    } catch (err: any) {
      toast({ title: 'Erro', description: err.message, variant: 'destructive' });
    }
    setSavingConfig(false);
  };

  const handleGroupAvatarUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !selectedChannel) return;
    try {
      const ext = file.name.split('.').pop() || 'jpg';
      const path = `group-avatars/${selectedChannel.id}.${ext}`;
      const { error: uploadError } = await supabase.storage
        .from('internal-chat-media')
        .upload(path, file, { upsert: true });
      if (uploadError) throw uploadError;
      const { data: urlData } = supabase.storage.from('internal-chat-media').getPublicUrl(path);
      const avatarUrl = `${urlData.publicUrl}?t=${Date.now()}`;
      await supabase.rpc('update_channel_info', { _channel_id: selectedChannel.id, _avatar_url: avatarUrl } as any);
      setSelectedChannel({ ...selectedChannel, avatar_url: avatarUrl } as any);
      loadChannels();
      toast({ title: 'Avatar do grupo atualizado' });
    } catch (err: any) {
      toast({ title: 'Erro', description: err.message, variant: 'destructive' });
    }
    if (groupAvatarInputRef.current) groupAvatarInputRef.current.value = '';
  };

  const formatTime = (dateStr: string) => {
    const d = new Date(dateStr);
    return d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
  };

  const formatDate = (dateStr: string) => {
    const d = new Date(dateStr);
    return d.toLocaleDateString('pt-BR');
  };

  const formatRecordingTime = (seconds: number) => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m}:${s.toString().padStart(2, '0')}`;
  };

  // Get the other user in a direct channel using allChannelMembers
  const getDirectChatUserId = (ch: Channel): string | null => {
    if (ch.is_group) return null;
    const members = allChannelMembers[ch.id];
    if (members) {
      const other = members.find(uid => uid !== user?.id);
      if (other) return other;
    }
    // Fallback heuristic
    for (const [uid, profile] of Object.entries(profilesMap)) {
      if (uid !== user?.id && (profile.name === ch.name || profile.email?.split('@')[0] === ch.name)) {
        return uid;
      }
    }
    return null;
  };

  const getChannelDisplayName = (ch: Channel) => {
    if (!ch.is_group) {
      const otherUserId = getDirectChatUserId(ch);
      if (otherUserId && profilesMap[otherUserId]) {
        return profilesMap[otherUserId].name || profilesMap[otherUserId].email?.split('@')[0] || ch.name;
      }
    }
    return ch.name;
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

  // Typing indicator text
  const typingText = Object.values(typingUsers).length > 0
    ? `${Object.values(typingUsers).join(', ')} está digitando...`
    : null;

  // Render media in message bubble
  const renderMedia = (msg: Message) => {
    if (!msg.media_url || !msg.media_type) return null;
    const isMe = msg.user_id === user?.id;
    
    switch (msg.media_type) {
      case 'image':
        return (
          <img
            src={msg.media_url}
            alt={msg.media_name || 'Imagem'}
            className="max-w-full rounded-md mb-1 cursor-pointer max-h-64 object-contain"
            onClick={() => window.open(msg.media_url!, '_blank')}
          />
        );
      case 'video':
        return (
          <video controls className="max-w-full rounded-md mb-1 max-h-64">
            <source src={msg.media_url} />
          </video>
        );
      case 'audio':
        return (
          <audio controls className="w-full mb-1 max-w-[250px]">
            <source src={msg.media_url} />
          </audio>
        );
      case 'document':
        return (
          <a
            href={msg.media_url}
            target="_blank"
            rel="noopener noreferrer"
            className={cn(
              "flex items-center gap-2 rounded-md p-2 mb-1 text-sm",
              isMe ? "bg-primary-foreground/10" : "bg-accent/50"
            )}
          >
            <FileText className="w-4 h-4 shrink-0" />
            <span className="truncate">{msg.media_name || 'Documento'}</span>
            <Download className="w-3 h-3 shrink-0 ml-auto" />
          </a>
        );
      default:
        return null;
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
              {/* All users can start direct chats */}
              <Button variant="ghost" size="icon" className="h-8 w-8" title="Nova conversa direta" onClick={() => setDirectDialogOpen(true)}>
                <MessageSquare className="w-4 h-4" />
              </Button>
              {/* Admin: config support user */}
              {isAdmin && (
                <Button variant="ghost" size="icon" className="h-8 w-8" title="Config. Suporte" onClick={openSupportConfig}>
                  <Settings className="w-4 h-4" />
                </Button>
              )}
              {/* Only admin can create groups */}
              {isAdmin && (
                <Button variant="ghost" size="icon" className="h-8 w-8" title="Criar grupo" onClick={() => { setSelectedUsers([]); setCreateDialogOpen(true); }}>
                  <Plus className="w-4 h-4" />
                </Button>
              )}
            </div>
          </div>
          <ScrollArea className="flex-1">
            {channels.map(ch => {
              const unread = unreadByChannel[ch.id] || 0;
              const otherUserId = getDirectChatUserId(ch);
              const isOnline = otherUserId ? onlineUsers.has(otherUserId) : false;
              return (
                <div
                  key={ch.id}
                  className={cn(
                    "group flex items-center gap-2 px-3 py-2.5 cursor-pointer hover:bg-accent/50 transition-colors border-b border-border/30",
                    selectedChannel?.id === ch.id && "bg-accent"
                  )}
                  onClick={() => { setSelectedChannel(ch); markAsRead(ch.id); }}
                >
                  <div className="relative w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center shrink-0 overflow-hidden">
                    {(ch as any).avatar_url ? (
                      <img src={(ch as any).avatar_url} alt="" className="w-full h-full object-cover" />
                    ) : ch.is_group ? <Users className="w-4 h-4 text-primary" /> : <User className="w-4 h-4 text-primary" />}
                    {/* Online indicator for direct chats */}
                    {!ch.is_group && isOnline && (
                      <span className="absolute -bottom-0.5 -right-0.5 w-3 h-3 bg-green-500 rounded-full border-2 border-card" />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1">
                      <p className="text-sm font-medium truncate flex-1">{getChannelDisplayName(ch)}</p>
                      {/* Per-channel unread badge */}
                      {unread > 0 && (
                        <Badge className="h-5 min-w-5 flex items-center justify-center p-0 text-[10px] bg-destructive text-destructive-foreground border-0 shrink-0">
                          {unread > 99 ? '99+' : unread}
                        </Badge>
                      )}
                    </div>
                    {lastMessages[ch.id] ? (
                      <p className={cn("text-xs truncate", unread > 0 ? "text-foreground font-medium" : "text-muted-foreground")}>{lastMessages[ch.id]}</p>
                    ) : ch.description ? (
                      <p className="text-xs text-muted-foreground truncate">{ch.description}</p>
                    ) : null}
                  </div>
                  {isAdmin && (
                    <Button variant="ghost" size="icon" className="shrink-0 opacity-0 group-hover:opacity-100 h-6 w-6"
                      onClick={(e) => { e.stopPropagation(); confirmDeleteChannel(ch.id); }}>
                      <Trash2 className="w-3 h-3" />
                    </Button>
                  )}
                </div>
              );
            })}
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
                  <div className="flex items-center gap-2">
                    <h3 className="font-semibold text-sm">{getChannelDisplayName(selectedChannel)}</h3>
                    {/* Online status in header for direct chats */}
                    {!selectedChannel.is_group && (() => {
                      const uid = getDirectChatUserId(selectedChannel);
                      const online = uid ? onlineUsers.has(uid) : false;
                      return (
                        <span className={cn("text-xs", online ? "text-green-500" : "text-muted-foreground")}>
                          {online ? '● Online' : '○ Offline'}
                        </span>
                      );
                    })()}
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {selectedChannel.is_group
                      ? `${channelMembers.length} membro(s) · ${channelMembers.filter(m => onlineUsers.has(m)).length} online`
                      : 'Conversa direta'}
                  </p>
                </div>
                {selectedChannel.is_group && canAccessGroupConfig(selectedChannel) && (
                  <Button variant="outline" size="sm" onClick={openGroupConfig}>
                    <Settings className="w-3.5 h-3.5 mr-1.5" />
                    Configurações
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
                        <div key={msg.id} className={cn("flex mb-2 items-end gap-1.5", isMe ? "justify-end" : "justify-start")}>
                          {!isMe && (
                            <Avatar className="w-6 h-6 shrink-0 mb-1">
                              {profilesMap[msg.user_id]?.avatar_url ? (
                                <AvatarImage src={profilesMap[msg.user_id].avatar_url!} />
                              ) : null}
                              <AvatarFallback className="text-[10px] bg-muted">
                                {(senderName[0] || 'U').toUpperCase()}
                              </AvatarFallback>
                            </Avatar>
                          )}
                          <div className={cn(
                            "max-w-[70%] rounded-lg px-3 py-2",
                            isMe ? "bg-primary text-primary-foreground" : "bg-muted",
                            msg.is_optimistic && "opacity-70"
                          )}>
                            {!isMe && <p className="text-xs font-medium opacity-70 mb-0.5">{senderName}</p>}
                            {renderMedia(msg)}
                            {msg.content && <p className="text-sm whitespace-pre-wrap break-words">{msg.content}</p>}
                            <p className={cn("text-[10px] mt-0.5", isMe ? "text-primary-foreground/60" : "text-muted-foreground")}>{formatTime(msg.created_at)}</p>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                ))}
                <div ref={messagesEndRef} />
              </ScrollArea>

              {/* Typing indicator */}
              {typingText && (
                <div className="px-4 pb-1">
                  <p className="text-xs text-muted-foreground italic flex items-center gap-1">
                    {typingText}
                    <span className="inline-flex gap-0.5">
                      <span className="w-1 h-1 bg-muted-foreground rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                      <span className="w-1 h-1 bg-muted-foreground rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                      <span className="w-1 h-1 bg-muted-foreground rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                    </span>
                  </p>
                </div>
              )}

              {/* Media preview */}
              {mediaPreview && (
                <div className="px-3 py-2 border-t border-border bg-muted/50 flex items-center gap-3">
                  {mediaPreview.type === 'image' && (
                    <img src={mediaPreview.url} alt="Preview" className="h-16 w-16 object-cover rounded-md" />
                  )}
                  {mediaPreview.type === 'video' && (
                    <div className="h-16 w-16 rounded-md bg-accent flex items-center justify-center">
                      <Film className="w-6 h-6 text-muted-foreground" />
                    </div>
                  )}
                  {mediaPreview.type === 'audio' && (
                    <div className="h-16 w-16 rounded-md bg-accent flex items-center justify-center">
                      <Mic className="w-6 h-6 text-muted-foreground" />
                    </div>
                  )}
                  {mediaPreview.type === 'document' && (
                    <div className="h-16 w-16 rounded-md bg-accent flex items-center justify-center">
                      <FileText className="w-6 h-6 text-muted-foreground" />
                    </div>
                  )}
                  <div className="flex-1 min-w-0">
                    <p className="text-sm truncate">{mediaPreview.file.name}</p>
                    <p className="text-xs text-muted-foreground">{(mediaPreview.file.size / 1024).toFixed(0)} KB</p>
                  </div>
                  <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => { URL.revokeObjectURL(mediaPreview.url); setMediaPreview(null); }}>
                    <X className="w-4 h-4" />
                  </Button>
                </div>
              )}

              {/* Input area */}
              <div className="p-3 border-t border-border flex gap-2 items-center">
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*,video/*,audio/*,.pdf,.doc,.docx,.xls,.xlsx,.txt"
                  className="hidden"
                  onChange={handleFileSelect}
                />
                {isRecording ? (
                  <div className="flex-1 flex items-center gap-3">
                    <Button variant="ghost" size="icon" className="h-9 w-9 text-destructive" onClick={cancelRecording}>
                      <Trash2 className="w-4 h-4" />
                    </Button>
                    <div className="flex items-center gap-2 flex-1">
                      <span className="w-2 h-2 rounded-full bg-destructive animate-pulse" />
                      <span className="text-sm text-destructive font-mono">{formatRecordingTime(recordingTime)}</span>
                    </div>
                    <Button size="icon" className="h-9 w-9 rounded-full" onClick={stopRecording}>
                      <Send className="w-4 h-4" />
                    </Button>
                  </div>
                ) : (
                  <>
                    <Button variant="ghost" size="icon" className="h-9 w-9 shrink-0" onClick={() => fileInputRef.current?.click()}>
                      <Paperclip className="w-4 h-4" />
                    </Button>
                    <Input
                      value={newMessage}
                      onChange={e => { setNewMessage(e.target.value); broadcastTyping(); }}
                      placeholder="Digite sua mensagem..."
                      onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSendMessage(); } }}
                      className="flex-1"
                    />
                    {newMessage.trim() || mediaPreview ? (
                      <Button onClick={() => handleSendMessage()} className="h-9 w-9 shrink-0" size="icon">
                        <Send className="w-4 h-4" />
                      </Button>
                    ) : (
                      <Button variant="ghost" size="icon" className="h-9 w-9 shrink-0" onClick={startRecording}>
                        <Mic className="w-4 h-4" />
                      </Button>
                    )}
                  </>
                )}
              </div>
            </>
          ) : (
            <div className="flex-1 flex items-center justify-center text-muted-foreground">
              <div className="text-center">
                <Users className="w-12 h-12 mx-auto mb-3 opacity-30" />
                <p className="text-sm">Selecione uma conversa</p>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Create Group Dialog */}
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

      {/* Direct Chat Dialog */}
      <Dialog open={directDialogOpen} onOpenChange={(open) => { setDirectDialogOpen(open); if (!open) { setSellerEmailSearch(''); setSellerEmailError(''); } }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Nova Conversa Direta</DialogTitle>
          </DialogHeader>
          {isSeller ? (
            <>
              <p className="text-sm text-muted-foreground">Digite o email completo do usuário para iniciar uma conversa:</p>
              <div className="space-y-3">
                <Input
                  placeholder="Digite o email completo do usuário..."
                  value={sellerEmailSearch}
                  onChange={(e) => { setSellerEmailSearch(e.target.value); setSellerEmailError(''); }}
                />
                {sellerEmailError && <p className="text-xs text-destructive">{sellerEmailError}</p>}

                {/* Only show results on exact email match for sellers */}
                {sellerEmailSearch.trim().length >= 3 && (() => {
                  const query = sellerEmailSearch.trim().toLowerCase();
                  const matches = allUsers.filter(u =>
                    u.user_id !== user?.id &&
                    u.email.toLowerCase() === query
                  );
                  return matches.length > 0 ? (
                    <ScrollArea className="h-40 border rounded-md p-2">
                      {matches.map(u => {
                        const isOnline = onlineUsers.has(u.user_id);
                        return (
                          <div
                            key={u.user_id}
                            className="flex items-center gap-3 py-2 px-2 hover:bg-accent/50 rounded cursor-pointer transition-colors"
                            onClick={() => { handleStartDirectChat(u.user_id); setSellerEmailSearch(''); }}
                          >
                            <Avatar className="w-7 h-7">
                              {profilesMap[u.user_id]?.avatar_url ? (
                                <AvatarImage src={profilesMap[u.user_id].avatar_url!} />
                              ) : null}
                              <AvatarFallback className="text-[10px] bg-primary/20 text-primary">
                                {(u.name?.[0] || u.email[0] || 'U').toUpperCase()}
                              </AvatarFallback>
                            </Avatar>
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-medium truncate">{u.name || u.email}</p>
                              {u.name && <p className="text-xs text-muted-foreground truncate">{u.email}</p>}
                            </div>
                            <span className={cn("text-xs shrink-0", isOnline ? "text-green-500" : "text-muted-foreground")}>
                              {isOnline ? '●' : '○'}
                            </span>
                          </div>
                        );
                      })}
                    </ScrollArea>
                  ) : null;
                })()}

                {/* Support button - always visible */}
                {supportUserId && supportUserId !== user?.id ? (
                  <Button
                    variant="outline"
                    className="w-full"
                    onClick={() => {
                      handleStartDirectChat(supportUserId);
                      setSellerEmailSearch('');
                    }}
                  >
                    <MessageSquare className="w-4 h-4 mr-2" />
                    Suporte
                  </Button>
                ) : (
                  <p className="text-xs text-muted-foreground text-center">Suporte não configurado. Peça ao admin para configurar em Configurações.</p>
                )}
              </div>
            </>
          ) : (
            <>
              <p className="text-sm text-muted-foreground">Selecione um usuário para iniciar uma conversa:</p>
              <ScrollArea className="h-64 border rounded-md p-2">
                {allUsers.filter(u => u.user_id !== user?.id).map(u => {
                  const isOnline = onlineUsers.has(u.user_id);
                  return (
                    <div
                      key={u.user_id}
                      className="flex items-center gap-3 py-2 px-2 hover:bg-accent/50 rounded cursor-pointer transition-colors"
                      onClick={() => handleStartDirectChat(u.user_id)}
                    >
                      <div className="relative">
                        <Avatar className="w-8 h-8">
                          {profilesMap[u.user_id]?.avatar_url ? (
                            <AvatarImage src={profilesMap[u.user_id].avatar_url!} />
                          ) : null}
                          <AvatarFallback className="text-xs bg-primary/20 text-primary">
                            {(u.name?.[0] || u.email[0] || 'U').toUpperCase()}
                          </AvatarFallback>
                        </Avatar>
                        {isOnline && (
                          <span className="absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 bg-green-500 rounded-full border-2 border-card" />
                        )}
                      </div>
                      <div className="flex-1">
                        <p className="text-sm font-medium">{u.name || u.email}</p>
                        {u.name && <p className="text-xs text-muted-foreground">{u.email}</p>}
                      </div>
                      <span className={cn("text-xs", isOnline ? "text-green-500" : "text-muted-foreground")}>
                        {isOnline ? 'Online' : 'Offline'}
                      </span>
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
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Settings className="w-5 h-5 text-primary" />
              Configurações do Grupo
            </DialogTitle>
          </DialogHeader>
          <input ref={groupAvatarInputRef} type="file" accept="image/*" className="hidden" onChange={handleGroupAvatarUpload} />
          <Tabs defaultValue="info" className="w-full">
            <TabsList className="grid w-full grid-cols-3">
              <TabsTrigger value="info">Info</TabsTrigger>
              <TabsTrigger value="members">Membros</TabsTrigger>
              <TabsTrigger value="permissions">Permissões</TabsTrigger>
            </TabsList>
            <TabsContent value="info" className="space-y-4 mt-3">
              <div className="flex items-center gap-4">
                <div className="relative cursor-pointer" onClick={() => groupAvatarInputRef.current?.click()}>
                  <Avatar className="w-16 h-16">
                    {(selectedChannel as any)?.avatar_url && <AvatarImage src={(selectedChannel as any).avatar_url} />}
                    <AvatarFallback className="bg-primary/20 text-primary text-lg">{selectedChannel?.name?.charAt(0)?.toUpperCase()}</AvatarFallback>
                  </Avatar>
                  <div className="absolute inset-0 rounded-full bg-black/40 flex items-center justify-center opacity-0 hover:opacity-100 transition-opacity">
                    <Image className="w-5 h-5 text-white" />
                  </div>
                </div>
                <div className="flex-1 space-y-2">
                  <Label>Nome do grupo</Label>
                  <Input value={configGroupName} onChange={e => setConfigGroupName(e.target.value)} />
                </div>
              </div>
              <div className="space-y-2">
                <Label>Descrição</Label>
                <Textarea value={configGroupDesc} onChange={e => setConfigGroupDesc(e.target.value)} placeholder="Descrição do grupo (opcional)" rows={3} />
              </div>
            </TabsContent>
            <TabsContent value="members" className="mt-3">
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
            </TabsContent>
            <TabsContent value="permissions" className="mt-3 space-y-4">
              <div className="flex items-center justify-between p-3 rounded-lg border border-border/50">
                <div>
                  <p className="text-sm font-medium">Somente admins podem enviar</p>
                  <p className="text-xs text-muted-foreground">Apenas administradores poderão enviar mensagens neste grupo</p>
                </div>
                <Switch checked={configAdminOnly} onCheckedChange={setConfigAdminOnly} disabled={!isAdmin} />
              </div>
              {isAdmin && (
                <div className="space-y-2">
                  <Label className="text-sm font-medium">Usuários com acesso às configurações</Label>
                  <p className="text-xs text-muted-foreground">Selecione membros que podem editar nome, descrição, avatar e membros deste grupo.</p>
                  <ScrollArea className="h-40 border rounded-md p-2">
                    {selectedUsers.filter(uid => uid !== user?.id).map(uid => {
                      const profile = profilesMap[uid];
                      return (
                        <label key={uid} className="flex items-center gap-2 py-1.5 px-1 hover:bg-accent/50 rounded cursor-pointer">
                          <Checkbox
                            checked={configAllowedUsers.includes(uid)}
                            onCheckedChange={(checked) => {
                              setConfigAllowedUsers(prev =>
                                checked ? [...prev, uid] : prev.filter(id => id !== uid)
                              );
                            }}
                          />
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
            <Button onClick={handleSaveGroupConfig} disabled={savingConfig}>
              {savingConfig && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              Salvar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={deleteConfirmOpen} onOpenChange={setDeleteConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirmar exclusão</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja excluir este canal? Todas as mensagens serão perdidas. Esta ação não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteChannel} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Support Config Dialog */}
      <Dialog open={supportConfigOpen} onOpenChange={setSupportConfigOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Users className="w-5 h-5 text-primary" />
              Suporte do Chat Interno
            </DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">Defina o responsável pelo suporte que aparecerá como botão para vendedores</p>
          <div className="space-y-3">
            <Label>Responsável pelo Suporte</Label>
            <select
              value={supportConfigUserId}
              onChange={e => setSupportConfigUserId(e.target.value)}
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
            >
              <option value="">Selecione um usuário</option>
              {supportConfigProfiles.map(p => (
                <option key={p.user_id} value={p.user_id}>{p.name || p.email}</option>
              ))}
            </select>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setSupportConfigOpen(false)}>Cancelar</Button>
            <Button onClick={saveSupportConfig} disabled={savingSupport || !supportConfigUserId}>
              {savingSupport && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              Salvar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  );
}
