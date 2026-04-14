import { useState, useEffect, useRef, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { useInternalChatUnread } from '@/hooks/useInternalChatUnread';

export interface ICChannel {
  id: string;
  name: string;
  description: string | null;
  is_group: boolean;
  created_by: string;
  avatar_url?: string | null;
  admin_only_messages?: boolean;
  config_allowed_users?: string[];
}

export interface ICMessage {
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

export interface ICUserProfile {
  user_id: string;
  email: string;
  name: string | null;
  avatar_url?: string | null;
}

export function useInternalChat() {
  const { user, isSeller, isMaster, isAdmin: isRealAdmin } = useAuth();
  const { toast } = useToast();
  const { unreadByChannel, onlineUsers, markAsRead, setActiveChannel } = useInternalChatUnread();
  const [channels, setChannels] = useState<ICChannel[]>([]);
  const [selectedChannel, setSelectedChannel] = useState<ICChannel | null>(null);
  const [messages, setMessages] = useState<ICMessage[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [allUsers, setAllUsers] = useState<ICUserProfile[]>([]);
  const [selectedUsers, setSelectedUsers] = useState<string[]>([]);
  const [channelMembers, setChannelMembers] = useState<string[]>([]);
  const [allChannelMembers, setAllChannelMembers] = useState<Record<string, string[]>>({});
  const [profilesMap, setProfilesMap] = useState<Record<string, ICUserProfile>>({});
  const [lastMessages, setLastMessages] = useState<Record<string, string>>({});
  const [typingUsers, setTypingUsers] = useState<Record<string, string>>({});
  const [supportUserId, setSupportUserId] = useState<string | null>(null);
  const [supportAdminUsers, setSupportAdminUsers] = useState<ICUserProfile[]>([]);
  const [settingsId, setSettingsId] = useState<string | null>(null);
  const [isRecording, setIsRecording] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);
  const [mediaPreview, setMediaPreview] = useState<{ file: File; type: string; url: string } | null>(null);

  const isAdmin = !isSeller;
  const profilesMapRef = useRef<Record<string, ICUserProfile>>({});
  const selectedChannelRef = useRef<ICChannel | null>(null);
  const typingTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const typingChannelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const recordingIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const groupAvatarInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => { selectedChannelRef.current = selectedChannel; }, [selectedChannel]);

  useEffect(() => {
    if (selectedChannel) setActiveChannel(selectedChannel.id);
    return () => setActiveChannel(null);
  }, [selectedChannel, setActiveChannel]);

  const loadChannels = useCallback(async () => {
    const { data } = await supabase.from('internal_channels').select('*').order('updated_at', { ascending: false });
    if (data) {
      const channelIds = data.map(c => c.id);
      let membersMap: Record<string, string[]> = {};
      if (channelIds.length > 0) {
        const { data: members } = await supabase.from('internal_channel_members').select('channel_id, user_id').in('channel_id', channelIds);
        if (members) members.forEach(m => { if (!membersMap[m.channel_id]) membersMap[m.channel_id] = []; membersMap[m.channel_id].push(m.user_id); });
      }
      setAllChannelMembers(membersMap);
      const filtered = data.filter(ch => { if (ch.is_group) return true; const members = membersMap[ch.id]; return members && members.includes(user?.id || ''); });
      setChannels(filtered);
    }
  }, [user?.id]);

  const loadUsers = useCallback(async () => {
    const { data: allData } = await supabase.rpc('get_all_chat_profiles' as any);
    const { data: chatData } = await supabase.rpc('get_internal_chat_profiles_v2' as any);
    const chatProfiles = chatData || (await supabase.rpc('get_internal_chat_profiles')).data;
    let users = (allData || chatProfiles || []) as unknown as ICUserProfile[];
    let masterIds = new Set<string>();
    if (!isMaster) {
      const { data: masterIdsArr } = await supabase.rpc('get_master_user_ids' as any);
      masterIds = new Set<string>((masterIdsArr as string[]) || []);
      users = users.filter(u => !masterIds.has(u.user_id));
    }
    setAllUsers(users);
    const map: Record<string, ICUserProfile> = {};
    users.forEach(u => { map[u.user_id] = u; });
    if (chatProfiles && allData) {
      (chatProfiles as unknown as ICUserProfile[]).forEach(u => {
        if (masterIds.has(u.user_id)) return;
        if (!map[u.user_id]) map[u.user_id] = u;
        else if (u.avatar_url && !map[u.user_id].avatar_url) map[u.user_id].avatar_url = u.avatar_url;
      });
    }
    setProfilesMap(map);
    profilesMapRef.current = map;
    const { data: rolesData } = await supabase.from('user_roles').select('user_id, role').in('role', ['support', 'admin', 'master']);
    if (rolesData) {
      const filteredRoles = isMaster ? rolesData : rolesData.filter((r: any) => r.role !== 'master');
      setSupportAdminUsers(users.filter(u => filteredRoles.some((r: any) => r.user_id === u.user_id)));
    }
  }, [isMaster]);

  const loadSupportUser = useCallback(async () => {
    const { data } = await supabase.from('system_settings').select('id,support_chat_user_id').single();
    if (data) { setSettingsId(data.id); if ((data as any).support_chat_user_id) setSupportUserId((data as any).support_chat_user_id); }
  }, []);

  const loadLastMessages = useCallback(async (channelIds: string[]) => {
    if (channelIds.length === 0) return;
    const pMap = profilesMapRef.current;
    const previews: Record<string, string> = {};
    for (const cid of channelIds) {
      const { data } = await supabase.from('internal_messages').select('content, user_id, media_type').eq('channel_id', cid).order('created_at', { ascending: false }).limit(1);
      if (data && data[0]) {
        const sender = pMap[data[0].user_id];
        const name = sender?.name || sender?.email?.split('@')[0] || '';
        const content = data[0].media_type ? `📎 ${data[0].media_type === 'image' ? 'Imagem' : data[0].media_type === 'audio' ? 'Áudio' : data[0].media_type === 'video' ? 'Vídeo' : 'Arquivo'}` : data[0].content;
        previews[cid] = `${name}: ${content}`.slice(0, 60);
      }
    }
    setLastMessages(previews);
  }, []);

  const loadMessages = useCallback(async (channelId: string) => {
    const pMap = profilesMapRef.current;
    const { data } = await supabase.from('internal_messages').select('*').eq('channel_id', channelId).order('created_at', { ascending: true }).limit(200);
    if (data) setMessages(data.map(m => ({ ...m, user_email: pMap[m.user_id]?.email, user_name: pMap[m.user_id]?.name })));
  }, []);

  const loadMembers = useCallback(async (channelId: string) => {
    const { data } = await supabase.from('internal_channel_members').select('user_id').eq('channel_id', channelId);
    if (data) setChannelMembers(data.map(m => m.user_id));
  }, []);

  useEffect(() => { loadChannels(); loadUsers(); loadSupportUser(); }, [loadChannels, loadUsers, loadSupportUser]);

  useEffect(() => {
    if (channels.length > 0 && Object.keys(profilesMap).length > 0) loadLastMessages(channels.map(c => c.id));
  }, [channels, profilesMap, loadLastMessages]);

  useEffect(() => {
    if (selectedChannel && Object.keys(profilesMapRef.current).length > 0) { loadMessages(selectedChannel.id); loadMembers(selectedChannel.id); }
  }, [selectedChannel, loadMessages, loadMembers]);

  useEffect(() => { messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [messages]);

  // Realtime for current channel
  useEffect(() => {
    if (!selectedChannel) return;
    const channel = supabase.channel(`internal-msgs-${selectedChannel.id}`).on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'internal_messages', filter: `channel_id=eq.${selectedChannel.id}` }, (payload) => {
      const msg = payload.new as any;
      const pMap = profilesMapRef.current;
      setMessages(prev => {
        const filtered = prev.filter(m => { if (m.id === msg.id) return false; if (m.is_optimistic && m.user_id === msg.user_id && m.content === msg.content) return false; return true; });
        return [...filtered, { ...msg, user_email: pMap[msg.user_id]?.email, user_name: pMap[msg.user_id]?.name }];
      });
    }).subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [selectedChannel]);

  // Global realtime for previews
  useEffect(() => {
    if (!user) return;
    const notifChannel = supabase.channel('internal-msgs-previews').on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'internal_messages' }, (payload) => {
      const msg = payload.new as any;
      if (msg.user_id === user.id) return;
      if (selectedChannelRef.current?.id === msg.channel_id) return;
      const pMap = profilesMapRef.current;
      const senderName = pMap[msg.user_id]?.name || pMap[msg.user_id]?.email?.split('@')[0] || 'Alguém';
      const content = msg.media_type ? '📎 Mídia' : msg.content;
      setLastMessages(prev => ({ ...prev, [msg.channel_id]: `${senderName}: ${content}`.slice(0, 60) }));
      setChannels(prev => { const idx = prev.findIndex(c => c.id === msg.channel_id); if (idx <= 0) return prev; const updated = [...prev]; const [ch] = updated.splice(idx, 1); return [ch, ...updated]; });
    }).subscribe();
    return () => { supabase.removeChannel(notifChannel); };
  }, [user]);

  // Typing indicator
  useEffect(() => {
    if (!selectedChannel || !user) return;
    const typChannel = supabase.channel(`typing-${selectedChannel.id}`);
    typingChannelRef.current = typChannel;
    typChannel.on('broadcast', { event: 'typing' }, ({ payload }) => {
      if (payload.user_id === user.id) return;
      const pMap = profilesMapRef.current;
      const name = pMap[payload.user_id]?.name || pMap[payload.user_id]?.email?.split('@')[0] || 'Alguém';
      setTypingUsers(prev => ({ ...prev, [payload.user_id]: name }));
      setTimeout(() => { setTypingUsers(prev => { const copy = { ...prev }; delete copy[payload.user_id]; return copy; }); }, 3000);
    }).subscribe();
    return () => { supabase.removeChannel(typChannel); typingChannelRef.current = null; };
  }, [selectedChannel, user]);

  const broadcastTyping = useCallback(() => {
    if (!typingChannelRef.current || !user) return;
    if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
    typingChannelRef.current.send({ type: 'broadcast', event: 'typing', payload: { user_id: user.id } });
    typingTimeoutRef.current = setTimeout(() => { typingTimeoutRef.current = null; }, 2000);
  }, [user]);

  const uploadMedia = async (file: File): Promise<{ url: string; type: string; name: string } | null> => {
    const ext = file.name.split('.').pop() || 'bin';
    const path = `${user!.id}/${Date.now()}.${ext}`;
    const { error } = await supabase.storage.from('internal-chat-media').upload(path, file);
    if (error) { toast({ title: 'Erro ao enviar mídia', description: error.message, variant: 'destructive' }); return null; }
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
    setMessages(prev => [...prev, { id: optimisticId, channel_id: selectedChannel.id, user_id: user.id, content: content || '', created_at: new Date().toISOString(), user_email: pMap[user.id]?.email, user_name: pMap[user.id]?.name, is_optimistic: true, media_url: finalMedia?.url || null, media_type: finalMedia?.type || null, media_name: finalMedia?.name || null }]);
    const senderName = pMap[user.id]?.name || pMap[user.id]?.email?.split('@')[0] || '';
    const previewText = finalMedia ? `📎 ${finalMedia.type === 'image' ? 'Imagem' : finalMedia.type === 'audio' ? 'Áudio' : finalMedia.type === 'video' ? 'Vídeo' : 'Arquivo'}` : content;
    setLastMessages(prev => ({ ...prev, [selectedChannel.id]: `${senderName}: ${previewText}`.slice(0, 60) }));
    setChannels(prev => { const idx = prev.findIndex(c => c.id === selectedChannel.id); if (idx <= 0) return prev; const updated = [...prev]; const [ch] = updated.splice(idx, 1); return [ch, ...updated]; });
    const insertData: any = { channel_id: selectedChannel.id, user_id: user.id, content: content || '' };
    if (finalMedia) { insertData.media_url = finalMedia.url; insertData.media_type = finalMedia.type; insertData.media_name = finalMedia.name; }
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
        if (uploaded) await handleSendMessage(uploaded);
      };
      recorder.start();
      mediaRecorderRef.current = recorder;
      setIsRecording(true);
      setRecordingTime(0);
      recordingIntervalRef.current = setInterval(() => setRecordingTime(t => t + 1), 1000);
    } catch { toast({ title: 'Erro', description: 'Não foi possível acessar o microfone', variant: 'destructive' }); }
  };

  const stopRecording = () => { mediaRecorderRef.current?.stop(); setIsRecording(false); if (recordingIntervalRef.current) clearInterval(recordingIntervalRef.current); };

  const cancelRecording = () => {
    if (mediaRecorderRef.current) { mediaRecorderRef.current.ondataavailable = null; mediaRecorderRef.current.onstop = null; mediaRecorderRef.current.stop(); mediaRecorderRef.current.stream.getTracks().forEach(t => t.stop()); }
    setIsRecording(false);
    setRecordingTime(0);
    if (recordingIntervalRef.current) clearInterval(recordingIntervalRef.current);
  };

  const handleCreateChannel = async (channelName: string, channelDesc: string) => {
    if (!channelName.trim() || !user) return;
    const { data, error } = await supabase.from('internal_channels').insert({ name: channelName.trim(), description: channelDesc.trim() || null, is_group: true, created_by: user.id }).select().single();
    if (error) { toast({ title: 'Erro', description: error.message, variant: 'destructive' }); return; }
    const memberIds = [...new Set([user.id, ...selectedUsers])];
    await supabase.from('internal_channel_members').insert(memberIds.map(uid => ({ channel_id: data.id, user_id: uid })));
    setSelectedUsers([]);
    loadChannels();
    toast({ title: 'Grupo criado com sucesso' });
  };

  const handleStartDirectChat = async (targetUserId: string) => {
    if (!user) return;
    const targetProfile = profilesMap[targetUserId];
    const channelDisplayName = targetProfile?.name || targetProfile?.email?.split('@')[0] || 'Chat Direto';
    const { data: channelId, error } = await supabase.rpc('create_direct_channel' as any, { _target_user_id: targetUserId, _channel_name: channelDisplayName });
    if (error) { toast({ title: 'Erro', description: error.message, variant: 'destructive' }); return; }
    await loadChannels();
    const { data: ch } = await supabase.from('internal_channels').select('*').eq('id', channelId).single();
    if (ch) setSelectedChannel(ch);
    toast({ title: 'Conversa direta iniciada' });
  };

  const handleDeleteChannel = async (channelId: string) => {
    await supabase.from('internal_channels').delete().eq('id', channelId);
    if (selectedChannel?.id === channelId) { setSelectedChannel(null); setMessages([]); }
    loadChannels();
    toast({ title: 'Grupo removido' });
  };

  const handleSaveGroupConfig = async (configGroupName: string, configGroupDesc: string, configAdminOnly: boolean, configAllowedUsers: string[]) => {
    if (!selectedChannel) return;
    try {
      const { error } = await supabase.rpc('update_channel_info', { _channel_id: selectedChannel.id, _name: configGroupName.trim() || selectedChannel.name, _description: configGroupDesc.trim() || null, _admin_only: configAdminOnly, _config_allowed: configAllowedUsers } as any);
      if (error) throw error;
      await supabase.from('internal_channel_members').delete().eq('channel_id', selectedChannel.id);
      const memberIds = [...new Set([selectedChannel.created_by, ...selectedUsers])];
      await supabase.from('internal_channel_members').insert(memberIds.map(uid => ({ channel_id: selectedChannel.id, user_id: uid })));
      setSelectedChannel({ ...selectedChannel, name: configGroupName.trim() || selectedChannel.name, description: configGroupDesc.trim() || null, admin_only_messages: configAdminOnly } as any);
      loadChannels();
      loadMembers(selectedChannel.id);
      toast({ title: 'Configurações do grupo salvas' });
      return true;
    } catch (err: any) {
      toast({ title: 'Erro', description: err.message, variant: 'destructive' });
      return false;
    }
  };

  const handleGroupAvatarUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !selectedChannel) return;
    try {
      const ext = (file.name.split('.').pop() || 'jpg').toLowerCase();
      const path = `group-avatars/${selectedChannel.id}/${Date.now()}.${ext}`;
      const { error: uploadError } = await supabase.storage.from('internal-chat-media').upload(path, file);
      if (uploadError) throw uploadError;
      const { data: urlData } = supabase.storage.from('internal-chat-media').getPublicUrl(path);
      await supabase.rpc('update_channel_info', { _channel_id: selectedChannel.id, _avatar_url: urlData.publicUrl } as any);
      setSelectedChannel({ ...selectedChannel, avatar_url: urlData.publicUrl } as any);
      loadChannels();
      toast({ title: 'Avatar do grupo atualizado' });
    } catch (err: any) { toast({ title: 'Erro', description: err.message, variant: 'destructive' }); }
    if (groupAvatarInputRef.current) groupAvatarInputRef.current.value = '';
  };

  const saveSupportConfig = async (userId: string) => {
    if (!userId || !settingsId) return;
    const { error } = await supabase.from('system_settings').update({ support_chat_user_id: userId } as any).eq('id', settingsId);
    if (error) toast({ title: 'Erro', description: error.message, variant: 'destructive' });
    else { setSupportUserId(userId); toast({ title: 'Responsável pelo suporte atualizado' }); }
  };

  const getDirectChatUserId = (ch: ICChannel): string | null => {
    if (ch.is_group) return null;
    const members = allChannelMembers[ch.id];
    if (members) { const other = members.find(uid => uid !== user?.id); if (other) return other; }
    for (const [uid, profile] of Object.entries(profilesMap)) {
      if (uid !== user?.id && (profile.name === ch.name || profile.email?.split('@')[0] === ch.name)) return uid;
    }
    return null;
  };

  const getChannelDisplayName = (ch: ICChannel) => {
    if (!ch.is_group) {
      const otherUserId = getDirectChatUserId(ch);
      if (otherUserId && profilesMap[otherUserId]) return profilesMap[otherUserId].name || profilesMap[otherUserId].email?.split('@')[0] || ch.name;
    }
    return ch.name;
  };

  const canAccessGroupConfig = (ch: ICChannel) => {
    if (isAdmin) return true;
    if (ch.config_allowed_users && user && ch.config_allowed_users.includes(user.id)) return true;
    return false;
  };

  const formatTime = (dateStr: string) => new Date(dateStr).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
  const formatDate = (dateStr: string) => new Date(dateStr).toLocaleDateString('pt-BR');
  const formatRecordingTime = (seconds: number) => { const m = Math.floor(seconds / 60); const s = seconds % 60; return `${m}:${s.toString().padStart(2, '0')}`; };

  // Group messages by date
  const groupedMessages: { date: string; msgs: ICMessage[] }[] = [];
  let lastDate = '';
  for (const msg of messages) {
    const date = formatDate(msg.created_at);
    if (date !== lastDate) { groupedMessages.push({ date, msgs: [msg] }); lastDate = date; }
    else { groupedMessages[groupedMessages.length - 1].msgs.push(msg); }
  }

  const typingText = Object.values(typingUsers).length > 0 ? `${Object.values(typingUsers).join(', ')} está digitando...` : null;

  return {
    // Auth
    user, isSeller, isMaster, isAdmin,
    // State
    channels, selectedChannel, setSelectedChannel, messages, newMessage, setNewMessage,
    allUsers, selectedUsers, setSelectedUsers, channelMembers, profilesMap,
    lastMessages, typingText, groupedMessages,
    supportUserId, supportAdminUsers, settingsId,
    isRecording, recordingTime, mediaPreview, setMediaPreview,
    unreadByChannel, onlineUsers, markAsRead,
    // Refs
    fileInputRef, messagesEndRef, groupAvatarInputRef,
    // Actions
    broadcastTyping, handleSendMessage, handleFileSelect,
    startRecording, stopRecording, cancelRecording,
    handleCreateChannel, handleStartDirectChat, handleDeleteChannel,
    handleSaveGroupConfig, handleGroupAvatarUpload, saveSupportConfig,
    getDirectChatUserId, getChannelDisplayName, canAccessGroupConfig,
    formatTime, formatRecordingTime,
    loadChannels,
  };
}
