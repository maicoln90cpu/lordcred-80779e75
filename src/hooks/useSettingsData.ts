import { useEffect, useState, useRef, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

export interface SystemSettings {
  id: string;
  warming_mode: string;
  start_hour: number;
  end_hour: number;
  messages_day_novo: number;
  messages_day_1_3: number;
  messages_day_4_7: number;
  messages_day_aquecido: number;
  messages_day_8_plus: number;
  is_warming_active: boolean;
  timezone: string;
  batch_size: number;
  batch_pause_seconds: number;
  random_delay_variation: number;
  typing_simulation: boolean;
  typing_speed_chars_sec: number;
  read_delay_seconds: number;
  online_offline_simulation: boolean;
  weekend_reduction_percent: number;
  night_mode_reduction: number;
  consecutive_message_limit: number;
  cooldown_after_error: number;
  human_pattern_mode: boolean;
  auto_phase_progression: boolean;
  days_phase_novo: number;
  days_phase_iniciante: number;
  days_phase_crescimento: number;
  days_phase_aquecido: number;
}

export interface WarmingMessage {
  id: string;
  content: string;
  is_active: boolean;
  message_order: number;
}

export interface ExternalNumber {
  id: string;
  phone_number: string;
  name: string | null;
  is_active: boolean;
  created_at: string;
}

export interface ConnectedChip {
  id: string;
  activated_at: string | null;
  status: string;
  warming_phase?: string;
}

export const BRAZIL_TIMEZONES = [
  { value: 'America/Sao_Paulo', label: 'São Paulo (BRT)' },
  { value: 'America/Fortaleza', label: 'Fortaleza (BRT)' },
  { value: 'America/Recife', label: 'Recife (BRT)' },
  { value: 'America/Bahia', label: 'Bahia (BRT)' },
  { value: 'America/Manaus', label: 'Manaus (AMT)' },
  { value: 'America/Cuiaba', label: 'Cuiabá (AMT)' },
  { value: 'America/Porto_Velho', label: 'Porto Velho (AMT)' },
  { value: 'America/Rio_Branco', label: 'Rio Branco (ACT)' },
];

export function useSettingsData() {
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [settings, setSettings] = useState<SystemSettings | null>(null);
  const [messages, setMessages] = useState<WarmingMessage[]>([]);
  const [externalNumbers, setExternalNumbers] = useState<ExternalNumber[]>([]);
  const [connectedChips, setConnectedChips] = useState<ConnectedChip[]>([]);
  const [showAllMessages, setShowAllMessages] = useState(false);
  const [newExternalPhone, setNewExternalPhone] = useState('');
  const [newExternalName, setNewExternalName] = useState('');
  const csvInputRef = useRef<HTMLInputElement>(null);

  const fetchData = useCallback(async () => {
    try {
      const [settingsRes, messagesRes, externalRes, chipsRes] = await Promise.all([
        supabase.from('system_settings').select('*').single(),
        supabase.from('warming_messages').select('*').order('message_order', { ascending: true }),
        supabase.from('external_numbers').select('*').order('created_at', { ascending: false }),
        supabase.from('chips').select('id, activated_at, status, warming_phase'),
      ]);
      if (settingsRes.data) setSettings(settingsRes.data as SystemSettings);
      if (messagesRes.data) setMessages(messagesRes.data);
      if (externalRes.data) setExternalNumbers(externalRes.data as ExternalNumber[]);
      if (chipsRes.data) setConnectedChips(chipsRes.data as ConnectedChip[]);
    } catch (error) {
      console.error('Error fetching settings:', error);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  const handleSaveSettings = async () => {
    if (!settings) return;
    setIsSaving(true);
    try {
      const { error } = await supabase
        .from('system_settings')
        .update({
          warming_mode: settings.warming_mode,
          start_hour: settings.start_hour,
          end_hour: settings.end_hour,
          messages_day_novo: settings.messages_day_novo,
          messages_day_1_3: settings.messages_day_1_3,
          messages_day_4_7: settings.messages_day_4_7,
          messages_day_aquecido: settings.messages_day_aquecido,
          messages_day_8_plus: settings.messages_day_8_plus,
          is_warming_active: settings.is_warming_active,
          timezone: settings.timezone,
          batch_size: settings.batch_size,
          batch_pause_seconds: settings.batch_pause_seconds,
          random_delay_variation: settings.random_delay_variation,
          typing_simulation: settings.typing_simulation,
          typing_speed_chars_sec: settings.typing_speed_chars_sec,
          read_delay_seconds: settings.read_delay_seconds,
          online_offline_simulation: settings.online_offline_simulation,
          weekend_reduction_percent: settings.weekend_reduction_percent,
          night_mode_reduction: settings.night_mode_reduction,
          consecutive_message_limit: settings.consecutive_message_limit,
          cooldown_after_error: settings.cooldown_after_error,
          human_pattern_mode: settings.human_pattern_mode,
          auto_phase_progression: settings.auto_phase_progression,
          days_phase_novo: settings.days_phase_novo,
          days_phase_iniciante: settings.days_phase_iniciante,
          days_phase_crescimento: settings.days_phase_crescimento,
          days_phase_aquecido: settings.days_phase_aquecido,
        } as any)
        .eq('id', settings.id);
      if (error) throw error;
      toast({ title: 'Configurações salvas', description: 'As alterações foram aplicadas com sucesso' });
    } catch (error) {
      console.error('Error saving settings:', error);
      toast({ title: 'Erro ao salvar', description: 'Tente novamente', variant: 'destructive' });
    } finally {
      setIsSaving(false);
    }
  };

  const handleCsvUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const text = await file.text();
      const lines = text.split('\n')
        .map(l => l.trim().replace(/^"|"$/g, ''))
        .filter(l => l && l.toLowerCase() !== 'mensagem' && l !== '\ufeffmensagem');
      if (lines.length === 0) {
        toast({ title: 'Arquivo vazio', description: 'Nenhuma mensagem encontrada no CSV', variant: 'destructive' });
        return;
      }
      if (messages.length > 0) {
        const { error: deleteError } = await supabase.from('warming_messages').delete().neq('id', '00000000-0000-0000-0000-000000000000');
        if (deleteError) throw deleteError;
        if (settings) {
          await supabase.from('system_settings').update({ global_message_cursor: 0 } as any).eq('id', settings.id);
        }
      }
      const rows = lines.map((content, i) => ({ content, is_active: true, message_order: i, source_file: file.name }));
      const { error } = await supabase.from('warming_messages').insert(rows as any);
      if (error) throw error;
      fetchData();
      toast({ title: `${lines.length} mensagens importadas`, description: `Arquivo: ${file.name}` });
    } catch (error) {
      console.error('Error importing CSV:', error);
      toast({ title: 'Erro na importação', description: 'Não foi possível importar o CSV', variant: 'destructive' });
    } finally {
      if (csvInputRef.current) csvInputRef.current.value = '';
    }
  };

  const handleRemoveAllMessages = async () => {
    try {
      const { error } = await supabase.from('warming_messages').delete().neq('id', '00000000-0000-0000-0000-000000000000');
      if (error) throw error;
      if (settings) {
        await supabase.from('system_settings').update({ global_message_cursor: 0 } as any).eq('id', settings.id);
      }
      setMessages([]);
      toast({ title: 'Mensagens removidas', description: 'Todas as mensagens foram apagadas e o cursor foi resetado' });
    } catch (error) {
      console.error('Error removing messages:', error);
      toast({ title: 'Erro', description: 'Não foi possível remover as mensagens', variant: 'destructive' });
    }
  };

  const handleAddExternalNumber = async () => {
    if (!newExternalPhone.trim()) return;
    try {
      const { error } = await supabase.from('external_numbers').insert({
        phone_number: newExternalPhone.trim().replace(/\D/g, ''),
        name: newExternalName.trim() || null,
      });
      if (error) throw error;
      setNewExternalPhone('');
      setNewExternalName('');
      fetchData();
      toast({ title: 'Número adicionado', description: 'O número externo foi cadastrado com sucesso' });
    } catch (error) {
      console.error('Error adding external number:', error);
      toast({ title: 'Erro', description: 'Não foi possível adicionar o número', variant: 'destructive' });
    }
  };

  const handleDeleteExternalNumber = async (id: string) => {
    try {
      const { error } = await supabase.from('external_numbers').delete().eq('id', id);
      if (error) throw error;
      setExternalNumbers(prev => prev.filter(n => n.id !== id));
      toast({ title: 'Número removido' });
    } catch (error) {
      console.error('Error deleting external number:', error);
    }
  };

  const handleToggleExternalNumber = async (id: string, isActive: boolean) => {
    try {
      const { error } = await supabase.from('external_numbers').update({ is_active: !isActive }).eq('id', id);
      if (error) throw error;
      setExternalNumbers(prev => prev.map(n => n.id === id ? { ...n, is_active: !isActive } : n));
    } catch (error) {
      console.error('Error toggling external number:', error);
    }
  };

  return {
    isLoading, isSaving, settings, setSettings,
    messages, externalNumbers, connectedChips,
    showAllMessages, setShowAllMessages,
    newExternalPhone, setNewExternalPhone,
    newExternalName, setNewExternalName,
    csvInputRef,
    handleSaveSettings, handleCsvUpload, handleRemoveAllMessages,
    handleAddExternalNumber, handleDeleteExternalNumber, handleToggleExternalNumber,
  };
}
