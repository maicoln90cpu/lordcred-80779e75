import { useEffect, useState, useRef } from 'react';
import { 
  Save, 
  Plus,
  Trash2, 
  MessageSquare, 
  Clock, 
  Zap, 
  Loader2,
  Shield,
  Users,
  Timer,
  Shuffle,
  Moon,
  Calendar,
  AlertTriangle,
  Activity,
  Phone,
  Upload,
  FileText,
  ChevronDown,
  ChevronUp,
  TrendingUp,
} from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';

import { Separator } from '@/components/ui/separator';
import { Slider } from '@/components/ui/slider';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { supabase } from '@/integrations/supabase/client';
import DashboardLayout from '@/components/layout/DashboardLayout';
import { useToast } from '@/hooks/use-toast';
import MessageSimulator from '@/components/admin/MessageSimulator';

interface SystemSettings {
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
  // Anti-blocking settings
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
  // Auto phase progression
  auto_phase_progression: boolean;
  days_phase_novo: number;
  days_phase_iniciante: number;
  days_phase_crescimento: number;
  days_phase_aquecido: number;
}

const BRAZIL_TIMEZONES = [
  { value: 'America/Sao_Paulo', label: 'São Paulo (BRT)' },
  { value: 'America/Fortaleza', label: 'Fortaleza (BRT)' },
  { value: 'America/Recife', label: 'Recife (BRT)' },
  { value: 'America/Bahia', label: 'Bahia (BRT)' },
  { value: 'America/Manaus', label: 'Manaus (AMT)' },
  { value: 'America/Cuiaba', label: 'Cuiabá (AMT)' },
  { value: 'America/Porto_Velho', label: 'Porto Velho (AMT)' },
  { value: 'America/Rio_Branco', label: 'Rio Branco (ACT)' },
];

interface WarmingMessage {
  id: string;
  content: string;
  is_active: boolean;
  message_order: number;
}

interface ExternalNumber {
  id: string;
  phone_number: string;
  name: string | null;
  is_active: boolean;
  created_at: string;
}

interface ConnectedChip {
  id: string;
  activated_at: string | null;
  status: string;
  warming_phase?: string;
}

export default function Settings() {
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [settings, setSettings] = useState<SystemSettings | null>(null);
  const [messages, setMessages] = useState<WarmingMessage[]>([]);
  
  const [externalNumbers, setExternalNumbers] = useState<ExternalNumber[]>([]);
  const [newExternalPhone, setNewExternalPhone] = useState('');
  const [newExternalName, setNewExternalName] = useState('');
  const csvInputRef = useRef<HTMLInputElement>(null);

  const [connectedChips, setConnectedChips] = useState<ConnectedChip[]>([]);
  const [showAllMessages, setShowAllMessages] = useState(false);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
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
  };

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
          // Anti-blocking settings
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
          // Auto phase progression
          auto_phase_progression: settings.auto_phase_progression,
          days_phase_novo: settings.days_phase_novo,
          days_phase_iniciante: settings.days_phase_iniciante,
          days_phase_crescimento: settings.days_phase_crescimento,
          days_phase_aquecido: settings.days_phase_aquecido,
        } as any)
        .eq('id', settings.id);



      if (error) throw error;

      toast({
        title: 'Configurações salvas',
        description: 'As alterações foram aplicadas com sucesso',
      });
    } catch (error) {
      console.error('Error saving settings:', error);
      toast({
        title: 'Erro ao salvar',
        description: 'Tente novamente',
        variant: 'destructive',
      });
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

      // If there are existing messages, replace them
      if (messages.length > 0) {
        const { error: deleteError } = await supabase.from('warming_messages').delete().neq('id', '00000000-0000-0000-0000-000000000000');
        if (deleteError) throw deleteError;
        
        // Reset cursor
        if (settings) {
          await supabase.from('system_settings').update({ global_message_cursor: 0 } as any).eq('id', settings.id);
        }
      }

      const rows = lines.map((content, i) => ({
        content,
        is_active: true,
        message_order: i,
        source_file: file.name,
      }));

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
      
      // Reset cursor
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

  // External Numbers handlers
  const handleAddExternalNumber = async () => {
    if (!newExternalPhone.trim()) return;

    try {
      const { error } = await supabase
        .from('external_numbers')
        .insert({ 
          phone_number: newExternalPhone.trim().replace(/\D/g, ''),
          name: newExternalName.trim() || null
        });

      if (error) throw error;

      setNewExternalPhone('');
      setNewExternalName('');
      fetchData();

      toast({
        title: 'Número adicionado',
        description: 'O número externo foi cadastrado com sucesso',
      });
    } catch (error) {
      console.error('Error adding external number:', error);
      toast({
        title: 'Erro',
        description: 'Não foi possível adicionar o número',
        variant: 'destructive',
      });
    }
  };

  const handleDeleteExternalNumber = async (id: string) => {
    try {
      const { error } = await supabase
        .from('external_numbers')
        .delete()
        .eq('id', id);

      if (error) throw error;

      setExternalNumbers(externalNumbers.filter(n => n.id !== id));

      toast({
        title: 'Número removido',
      });
    } catch (error) {
      console.error('Error deleting external number:', error);
    }
  };

  const handleToggleExternalNumber = async (id: string, isActive: boolean) => {
    try {
      const { error } = await supabase
        .from('external_numbers')
        .update({ is_active: !isActive })
        .eq('id', id);

      if (error) throw error;

      setExternalNumbers(externalNumbers.map(n => 
        n.id === id ? { ...n, is_active: !isActive } : n
      ));
    } catch (error) {
      console.error('Error toggling external number:', error);
    }
  };

  if (isLoading) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center h-64">
          <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold">Configurações do Sistema</h1>
          <p className="text-muted-foreground">
            Gerencie as regras de aquecimento, proteção anti-bloqueio e mensagens
          </p>
        </div>

        <Tabs defaultValue="config" className="space-y-6">
          <TabsList>
            <TabsTrigger value="config">Configurações</TabsTrigger>
            <TabsTrigger value="mensagens">Mensagens</TabsTrigger>
            <TabsTrigger value="chat">Chat Interno</TabsTrigger>
          </TabsList>

          {/* Tab: Configurações */}
          <TabsContent value="config" className="space-y-6">
            <div className="grid gap-6 lg:grid-cols-2">
              {/* Warming Settings */}
              <Card className="border-border/50">
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <div>
                      <CardTitle className="flex items-center gap-2">
                        <Zap className="w-5 h-5 text-primary" />
                        Aquecimento
                      </CardTitle>
                      <CardDescription>
                        Configure o modo e regras de aquecimento
                      </CardDescription>
                    </div>
                    {settings && (
                      <div className="flex items-center gap-2">
                        <Label htmlFor="warming-active" className="text-sm">
                          {settings.is_warming_active ? 'Ativo' : 'Pausado'}
                        </Label>
                        <Switch
                          id="warming-active"
                          checked={settings.is_warming_active}
                          onCheckedChange={(checked) => 
                            setSettings({ ...settings, is_warming_active: checked })
                          }
                        />
                      </div>
                    )}
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-2">
                    <Label>Modo de Aquecimento</Label>
                    <Select
                      value={settings?.warming_mode}
                      onValueChange={(value) => 
                        settings && setSettings({ ...settings, warming_mode: value })
                      }
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="same_user">Entre chips do mesmo usuário</SelectItem>
                        <SelectItem value="between_users">Entre chips de usuários diferentes</SelectItem>
                        <SelectItem value="external">Para números externos</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label className="flex items-center gap-2">
                      <Clock className="w-4 h-4" />
                      Fuso Horário
                    </Label>
                    <Select
                      value={settings?.timezone || 'America/Sao_Paulo'}
                      onValueChange={(value) => 
                        settings && setSettings({ ...settings, timezone: value })
                      }
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {BRAZIL_TIMEZONES.map((tz) => (
                          <SelectItem key={tz.value} value={tz.value}>
                            {tz.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <p className="text-xs text-muted-foreground">
                      Todas as operações de horário usarão este fuso
                    </p>
                  </div>

                  <Separator />

                  <div className="space-y-2">
                    <Label className="flex items-center gap-2">
                      <Clock className="w-4 h-4" />
                      Horário de Funcionamento
                    </Label>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-1">
                        <Label className="text-xs text-muted-foreground">Início</Label>
                        <Select
                          value={settings?.start_hour.toString()}
                          onValueChange={(value) => 
                            settings && setSettings({ ...settings, start_hour: parseInt(value) })
                          }
                        >
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {Array.from({ length: 24 }, (_, i) => (
                              <SelectItem key={i} value={i.toString()}>
                                {i.toString().padStart(2, '0')}:00
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-1">
                        <Label className="text-xs text-muted-foreground">Fim</Label>
                        <Select
                          value={settings?.end_hour.toString()}
                          onValueChange={(value) => 
                            settings && setSettings({ ...settings, end_hour: parseInt(value) })
                          }
                        >
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {Array.from({ length: 24 }, (_, i) => (
                              <SelectItem key={i} value={i.toString()}>
                                {i.toString().padStart(2, '0')}:00
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                  </div>

                  <Separator />

                  <div className="space-y-3">
                    <Label>Limites de Mensagens por Dia (por fase)</Label>
                    <p className="text-xs text-muted-foreground">
                      Defina a fase de cada chip em "Meus Chips". O sistema distribui as mensagens ao longo do dia automaticamente.
                    </p>
                    <div className="grid gap-3">
                      <div className="flex items-center justify-between">
                        <span className="text-sm text-muted-foreground">🔵 Novo:</span>
                        <Input
                          type="number"
                          className="w-20"
                          value={(settings as any)?.messages_day_novo}
                          onChange={(e) => 
                            settings && setSettings({ ...settings, messages_day_novo: parseInt(e.target.value) || 0 })
                          }
                        />
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-sm text-muted-foreground">🟡 Iniciante:</span>
                        <Input
                          type="number"
                          className="w-20"
                          value={settings?.messages_day_1_3}
                          onChange={(e) => 
                            settings && setSettings({ ...settings, messages_day_1_3: parseInt(e.target.value) || 0 })
                          }
                        />
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-sm text-muted-foreground">🟠 Crescimento:</span>
                        <Input
                          type="number"
                          className="w-20"
                          value={settings?.messages_day_4_7}
                          onChange={(e) => 
                            settings && setSettings({ ...settings, messages_day_4_7: parseInt(e.target.value) || 0 })
                          }
                        />
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-sm text-muted-foreground">🔴 Aquecido:</span>
                        <Input
                          type="number"
                          className="w-20"
                          value={(settings as any)?.messages_day_aquecido}
                          onChange={(e) => 
                            settings && setSettings({ ...settings, messages_day_aquecido: parseInt(e.target.value) || 0 })
                          }
                        />
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-sm text-muted-foreground">🟢 Maduro:</span>
                        <Input
                          type="number"
                          className="w-20"
                          value={settings?.messages_day_8_plus}
                          onChange={(e) => 
                            settings && setSettings({ ...settings, messages_day_8_plus: parseInt(e.target.value) || 0 })
                          }
                        />
                      </div>
                    </div>
                  </div>

                  <div className="p-3 rounded-lg bg-primary/5 border border-primary/20">
                    <p className="text-xs text-muted-foreground">
                      💡 O sistema calcula automaticamente os intervalos entre mensagens para distribuir o volume ao longo do dia, com variação aleatória para parecer natural.
                    </p>
                  </div>
                </CardContent>
              </Card>

              {/* Anti-Blocking Protection */}
              <Card className="border-border/50">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Shield className="w-5 h-5 text-primary" />
                    Proteção Anti-Bloqueio
                  </CardTitle>
                  <CardDescription>
                    12 configurações para evitar detecção e bloqueio
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  {/* Human Pattern Mode */}
                  <div className="flex items-center justify-between p-3 rounded-lg bg-primary/5 border border-primary/20">
                    <div className="flex items-center gap-2">
                      <Activity className="w-4 h-4 text-primary" />
                      <div>
                        <Label className="text-sm font-medium">Modo Comportamento Humano</Label>
                        <p className="text-xs text-muted-foreground">Ativa todas as simulações</p>
                      </div>
                    </div>
                    <Switch
                      checked={settings?.human_pattern_mode}
                      onCheckedChange={(checked) => 
                        settings && setSettings({ ...settings, human_pattern_mode: checked })
                      }
                    />
                  </div>

                  <Separator />

                  {/* Batch Settings */}
                  <div className="space-y-3">
                    <Label className="flex items-center gap-2">
                      <Users className="w-4 h-4" />
                      Controle de Lotes
                    </Label>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-1">
                        <Label className="text-xs text-muted-foreground">Tamanho do lote</Label>
                        <Input
                          type="number"
                          value={settings?.batch_size}
                          onChange={(e) => 
                            settings && setSettings({ ...settings, batch_size: parseInt(e.target.value) || 0 })
                          }
                        />
                      </div>
                      <div className="space-y-1">
                        <Label className="text-xs text-muted-foreground">Pausa entre lotes (seg)</Label>
                        <Input
                          type="number"
                          value={settings?.batch_pause_seconds}
                          onChange={(e) => 
                            settings && setSettings({ ...settings, batch_pause_seconds: parseInt(e.target.value) || 0 })
                          }
                        />
                      </div>
                    </div>
                  </div>

                  {/* Consecutive Limit */}
                  <div className="space-y-3">
                    <Label className="flex items-center gap-2">
                      <Timer className="w-4 h-4" />
                      Controle de Mensagens
                    </Label>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-1">
                        <Label className="text-xs text-muted-foreground">Msgs consecutivas</Label>
                        <Input
                          type="number"
                          value={settings?.consecutive_message_limit}
                          onChange={(e) => 
                            settings && setSettings({ ...settings, consecutive_message_limit: parseInt(e.target.value) || 0 })
                          }
                        />
                      </div>
                    </div>
                  </div>

                  {/* Timing Simulation */}
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <Label className="flex items-center gap-2">
                        <Shuffle className="w-4 h-4" />
                        Simulação de Digitação
                      </Label>
                      <Switch
                        checked={settings?.typing_simulation}
                        onCheckedChange={(checked) => 
                          settings && setSettings({ ...settings, typing_simulation: checked })
                        }
                      />
                    </div>
                    {settings?.typing_simulation && (
                      <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-1">
                          <Label className="text-xs text-muted-foreground">Velocidade (chars/seg)</Label>
                          <Input
                            type="number"
                            value={settings?.typing_speed_chars_sec}
                            onChange={(e) => 
                              settings && setSettings({ ...settings, typing_speed_chars_sec: parseInt(e.target.value) || 0 })
                            }
                          />
                        </div>
                        <div className="space-y-1">
                          <Label className="text-xs text-muted-foreground">Delay leitura (seg)</Label>
                          <Input
                            type="number"
                            value={settings?.read_delay_seconds}
                            onChange={(e) => 
                              settings && setSettings({ ...settings, read_delay_seconds: parseInt(e.target.value) || 0 })
                            }
                          />
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Online/Offline Simulation */}
                  <div className="flex items-center justify-between">
                    <Label className="text-sm">Simular Online/Offline</Label>
                    <Switch
                      checked={settings?.online_offline_simulation}
                      onCheckedChange={(checked) => 
                        settings && setSettings({ ...settings, online_offline_simulation: checked })
                      }
                    />
                  </div>

                  {/* Random Delay Variation */}
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <Label className="text-sm">Variação aleatória (%)</Label>
                      <span className="text-sm font-medium">{settings?.random_delay_variation}%</span>
                    </div>
                    <Slider
                      value={[settings?.random_delay_variation || 0]}
                      onValueChange={([value]) => 
                        settings && setSettings({ ...settings, random_delay_variation: value })
                      }
                      max={50}
                      step={5}
                    />
                  </div>

                  {/* Weekend & Night Reduction */}
                  <div className="space-y-3">
                    <Label className="flex items-center gap-2">
                      <Calendar className="w-4 h-4" />
                      Reduções de Volume
                    </Label>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-1">
                        <Label className="text-xs text-muted-foreground">Fim de semana (%)</Label>
                        <Input
                          type="number"
                          value={settings?.weekend_reduction_percent}
                          onChange={(e) => 
                            settings && setSettings({ ...settings, weekend_reduction_percent: parseInt(e.target.value) || 0 })
                          }
                        />
                      </div>
                      <div className="space-y-1">
                        <Label className="text-xs text-muted-foreground flex items-center gap-1">
                          <Moon className="w-3 h-3" /> Noturno (%)
                        </Label>
                        <Input
                          type="number"
                          value={settings?.night_mode_reduction}
                          onChange={(e) => 
                            settings && setSettings({ ...settings, night_mode_reduction: parseInt(e.target.value) || 0 })
                          }
                        />
                      </div>
                    </div>
                  </div>

                  {/* Error Cooldown */}
                  <div className="space-y-1">
                    <Label className="flex items-center gap-2 text-sm">
                      <AlertTriangle className="w-4 h-4" />
                      Cooldown após erro (segundos)
                    </Label>
                    <Input
                      type="number"
                      value={settings?.cooldown_after_error}
                      onChange={(e) => 
                        settings && setSettings({ ...settings, cooldown_after_error: parseInt(e.target.value) || 0 })
                      }
                    />
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Auto Phase Progression */}
            <Card className="border-border/50 lg:col-span-2">
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="flex items-center gap-2">
                      <TrendingUp className="w-5 h-5 text-primary" />
                      Progressão Automática de Fases
                    </CardTitle>
                    <CardDescription>
                      Promove os chips automaticamente de fase com base nos dias desde a ativação
                    </CardDescription>
                  </div>
                  {settings && (
                    <div className="flex items-center gap-2">
                      <Label htmlFor="auto-progression" className="text-sm">
                        {(settings as any).auto_phase_progression ? 'Ativo' : 'Desativado'}
                      </Label>
                      <Switch
                        id="auto-progression"
                        checked={(settings as any).auto_phase_progression}
                        onCheckedChange={(checked) =>
                          settings && setSettings({ ...settings, auto_phase_progression: checked })
                        }
                      />
                    </div>
                  )}
                </div>
              </CardHeader>
              {(settings as any)?.auto_phase_progression && (
                <CardContent className="space-y-4">
                  <p className="text-xs text-muted-foreground">
                    Defina quantos dias o chip deve permanecer em cada fase antes de ser promovido automaticamente. Os dias são cumulativos a partir da data de ativação.
                  </p>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <div className="space-y-1">
                      <Label className="text-xs text-muted-foreground">🔵 Novo (dias)</Label>
                      <Input
                        type="number"
                        value={(settings as any)?.days_phase_novo}
                        onChange={(e) =>
                          settings && setSettings({ ...settings, days_phase_novo: parseInt(e.target.value) || 0 })
                        }
                      />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs text-muted-foreground">🟡 Iniciante (dias)</Label>
                      <Input
                        type="number"
                        value={(settings as any)?.days_phase_iniciante}
                        onChange={(e) =>
                          settings && setSettings({ ...settings, days_phase_iniciante: parseInt(e.target.value) || 0 })
                        }
                      />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs text-muted-foreground">🟠 Crescimento (dias)</Label>
                      <Input
                        type="number"
                        value={(settings as any)?.days_phase_crescimento}
                        onChange={(e) =>
                          settings && setSettings({ ...settings, days_phase_crescimento: parseInt(e.target.value) || 0 })
                        }
                      />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs text-muted-foreground">🔴 Aquecido (dias)</Label>
                      <Input
                        type="number"
                        value={(settings as any)?.days_phase_aquecido}
                        onChange={(e) =>
                          settings && setSettings({ ...settings, days_phase_aquecido: parseInt(e.target.value) || 0 })
                        }
                      />
                    </div>
                  </div>
                  <div className="p-3 rounded-lg bg-primary/5 border border-primary/20">
                    <p className="text-xs text-muted-foreground">
                      💡 Fluxo: Novo ({(settings as any)?.days_phase_novo}d) → Iniciante ({(settings as any)?.days_phase_iniciante}d) → Crescimento ({(settings as any)?.days_phase_crescimento}d) → Aquecido ({(settings as any)?.days_phase_aquecido}d) → Maduro
                    </p>
                  </div>
                </CardContent>
              )}
            </Card>

            {/* Simulator - Full Width */}
            {settings && (
              <MessageSimulator settings={settings} chips={connectedChips} />
            )}

            {/* External Numbers - shown when mode is external */}
            {settings?.warming_mode === 'external' && (
              <Card className="border-border/50">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Phone className="w-5 h-5 text-primary" />
                    Números Externos
                  </CardTitle>
                  <CardDescription>
                    Números de terceiros que receberão mensagens de aquecimento ({externalNumbers.filter(n => n.is_active).length} ativos)
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex gap-2">
                    <Input
                      placeholder="Número (ex: 5511999999999)"
                      value={newExternalPhone}
                      onChange={(e) => setNewExternalPhone(e.target.value)}
                      className="flex-1"
                    />
                    <Input
                      placeholder="Nome/Descrição (opcional)"
                      value={newExternalName}
                      onChange={(e) => setNewExternalName(e.target.value)}
                      className="flex-1"
                    />
                    <Button onClick={handleAddExternalNumber} className="shrink-0">
                      <Plus className="w-4 h-4 mr-2" />
                      Adicionar
                    </Button>
                  </div>

                  <Separator />

                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 max-h-[300px] overflow-y-auto">
                    {externalNumbers.length === 0 ? (
                      <p className="text-center text-muted-foreground py-4 col-span-full">
                        Nenhum número externo cadastrado
                      </p>
                    ) : (
                      externalNumbers.map((num) => (
                        <div
                          key={num.id}
                          className="flex items-center gap-3 p-3 rounded-lg bg-secondary/30 border border-border/50"
                        >
                          <Switch
                            checked={num.is_active}
                            onCheckedChange={() => handleToggleExternalNumber(num.id, num.is_active)}
                          />
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium truncate">{num.phone_number}</p>
                            {num.name && (
                              <p className="text-xs text-muted-foreground truncate">{num.name}</p>
                            )}
                          </div>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="shrink-0 text-destructive hover:text-destructive hover:bg-destructive/10"
                            onClick={() => handleDeleteExternalNumber(num.id)}
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </div>
                      ))
                    )}
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Save Button */}
            <div className="flex justify-end">
              <Button onClick={handleSaveSettings} size="lg" disabled={isSaving}>
                {isSaving ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Salvando...
                  </>
                ) : (
                  <>
                    <Save className="w-4 h-4 mr-2" />
                    Salvar Configurações
                  </>
                )}
              </Button>
            </div>
          </TabsContent>

          {/* Tab: Chat Interno */}
          <TabsContent value="chat" className="space-y-6">
            <SupportChatSettings />
          </TabsContent>

          {/* Tab: Mensagens */}
          <TabsContent value="mensagens" className="space-y-6">
            <Card className="border-border/50">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <MessageSquare className="w-5 h-5 text-primary" />
                  Arquivo de Mensagens
                </CardTitle>
                <CardDescription>
                  Faça upload de um arquivo CSV com as mensagens de aquecimento. O bot seguirá a ordem exata do arquivo.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <input
                  type="file"
                  accept=".csv"
                  ref={csvInputRef}
                  onChange={handleCsvUpload}
                  className="hidden"
                />

                {messages.length === 0 ? (
                  /* Empty state - Upload area */
                  <div
                    className="border-2 border-dashed border-border/50 rounded-lg p-12 text-center cursor-pointer hover:border-primary/50 hover:bg-primary/5 transition-colors"
                    onClick={() => csvInputRef.current?.click()}
                  >
                    <Upload className="w-12 h-12 mx-auto mb-4 text-muted-foreground opacity-50" />
                    <p className="text-lg font-medium">Importe um arquivo CSV</p>
                    <p className="text-sm text-muted-foreground mt-1">
                      Uma mensagem por linha. O bot seguirá a ordem sequencial do arquivo.
                    </p>
                    <Button variant="outline" className="mt-4">
                      <Upload className="w-4 h-4 mr-2" />
                      Selecionar arquivo
                    </Button>
                  </div>
                ) : (
                  /* File card - shows imported CSV info */
                  <div className="rounded-lg border border-border/50 bg-secondary/20 p-4 space-y-4">
                    <div className="flex items-start justify-between">
                      <div className="flex items-center gap-3">
                        <div className="p-2 rounded-lg bg-primary/10">
                          <FileText className="w-6 h-6 text-primary" />
                        </div>
                        <div>
                          <p className="font-medium text-sm">
                            {(messages[0] as any)?.source_file || 'mensagens.csv'}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {messages.length} mensagens • {messages.filter(m => m.is_active).length} ativas
                          </p>
                        </div>
                      </div>
                      <div className="flex gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => csvInputRef.current?.click()}
                        >
                          <Upload className="w-4 h-4 mr-2" />
                          Substituir
                        </Button>
                        <Button
                          variant="destructive"
                          size="sm"
                          onClick={handleRemoveAllMessages}
                        >
                          <Trash2 className="w-4 h-4 mr-2" />
                          Remover
                        </Button>
                      </div>
                    </div>

                    {/* Preview */}
                    <div className="space-y-1">
                      <p className="text-xs text-muted-foreground font-medium">Preview das mensagens (ordem de envio):</p>
                      <div className="space-y-1 max-h-[300px] overflow-y-auto">
                        {(showAllMessages ? [...messages].sort((a, b) => (a.message_order || 0) - (b.message_order || 0)) : [...messages].sort((a, b) => (a.message_order || 0) - (b.message_order || 0)).slice(0, 5)).map((msg, i) => (
                          <div key={msg.id} className="flex items-center gap-2 text-sm p-2 rounded bg-background/50">
                            <span className="text-xs text-muted-foreground font-mono w-8 shrink-0">#{(msg.message_order || i) + 1}</span>
                            <p className="flex-1 truncate">{msg.content}</p>
                          </div>
                        ))}
                      </div>
                      {messages.length > 5 && (
                        <Button
                          variant="ghost"
                          size="sm"
                          className="w-full text-xs"
                          onClick={() => setShowAllMessages(!showAllMessages)}
                        >
                          {showAllMessages ? (
                            <>
                              <ChevronUp className="w-4 h-4 mr-1" />
                              Mostrar menos
                            </>
                          ) : (
                            <>
                              <ChevronDown className="w-4 h-4 mr-1" />
                              Ver todas ({messages.length} mensagens)
                            </>
                          )}
                        </Button>
                      )}
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Save Button */}
            <div className="flex justify-end">
              <Button onClick={handleSaveSettings} size="lg" disabled={isSaving}>
                {isSaving ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Salvando...
                  </>
                ) : (
                  <>
                    <Save className="w-4 h-4 mr-2" />
                    Salvar Alterações
                  </>
                )}
              </Button>
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </DashboardLayout>
  );
}
