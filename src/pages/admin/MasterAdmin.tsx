import { useEffect, useState } from 'react';
import { Crown, Wifi, WifiOff, Copy, Check, Loader2, Globe, Key, Webhook } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { supabase } from '@/integrations/supabase/client';
import DashboardLayout from '@/components/layout/DashboardLayout';
import { useToast } from '@/hooks/use-toast';
import ExportDataTab from '@/components/admin/ExportDataTab';
import MigrationSQLTab from '@/components/admin/MigrationSQLTab';

interface ProviderSettings {
  id: string;
  whatsapp_provider: string;
  provider_api_url: string | null;
  provider_api_key: string | null;
  evolution_api_url: string | null;
  evolution_api_key: string | null;
  uazapi_api_url: string | null;
  uazapi_api_key: string | null;
}

export default function MasterAdmin() {
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isTesting, setIsTesting] = useState(false);
  const [connectionStatus, setConnectionStatus] = useState<'idle' | 'success' | 'error'>('idle');
  const [copied, setCopied] = useState(false);
  const [settings, setSettings] = useState<ProviderSettings | null>(null);

  const webhookUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/evolution-webhook`;

  useEffect(() => {
    fetchSettings();
  }, []);

  const fetchSettings = async () => {
    try {
      const { data, error } = await supabase
        .from('system_settings')
        .select('id, whatsapp_provider, provider_api_url, provider_api_key, evolution_api_url, evolution_api_key, uazapi_api_url, uazapi_api_key')
        .single();
      if (error) throw error;
      setSettings(data as unknown as ProviderSettings);
    } catch (error) {
      console.error('Error fetching settings:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const getCurrentUrl = (): string => {
    if (!settings) return '';
    return settings.whatsapp_provider === 'uazapi' ? (settings.uazapi_api_url || '') : (settings.evolution_api_url || '');
  };

  const getCurrentKey = (): string => {
    if (!settings) return '';
    return settings.whatsapp_provider === 'uazapi' ? (settings.uazapi_api_key || '') : (settings.evolution_api_key || '');
  };

  const setCurrentUrl = (value: string) => {
    if (!settings) return;
    if (settings.whatsapp_provider === 'uazapi') {
      setSettings({ ...settings, uazapi_api_url: value, provider_api_url: value });
    } else {
      setSettings({ ...settings, evolution_api_url: value, provider_api_url: value });
    }
  };

  const setCurrentKey = (value: string) => {
    if (!settings) return;
    if (settings.whatsapp_provider === 'uazapi') {
      setSettings({ ...settings, uazapi_api_key: value, provider_api_key: value });
    } else {
      setSettings({ ...settings, evolution_api_key: value, provider_api_key: value });
    }
  };

  const handleProviderChange = (value: string) => {
    if (!settings) return;
    const newUrl = value === 'uazapi' ? (settings.uazapi_api_url || '') : (settings.evolution_api_url || '');
    const newKey = value === 'uazapi' ? (settings.uazapi_api_key || '') : (settings.evolution_api_key || '');
    setSettings({ ...settings, whatsapp_provider: value, provider_api_url: newUrl, provider_api_key: newKey });
    setConnectionStatus('idle');
  };

  const handleSave = async () => {
    if (!settings) return;
    setIsSaving(true);
    try {
      const { error } = await supabase
        .from('system_settings')
        .update({
          whatsapp_provider: settings.whatsapp_provider,
          provider_api_url: getCurrentUrl() || null,
          provider_api_key: getCurrentKey() || null,
          evolution_api_url: settings.evolution_api_url,
          evolution_api_key: settings.evolution_api_key,
          uazapi_api_url: settings.uazapi_api_url,
          uazapi_api_key: settings.uazapi_api_key,
        } as any)
        .eq('id', settings.id);
      if (error) throw error;
      toast({ title: 'Configurações salvas', description: 'As credenciais do provedor foram atualizadas' });
    } catch (error) {
      console.error('Error saving:', error);
      toast({ title: 'Erro ao salvar', variant: 'destructive' });
    } finally {
      setIsSaving(false);
    }
  };

  const handleTestConnection = async () => {
    const url = getCurrentUrl();
    const key = getCurrentKey();
    if (!url || !key) {
      toast({ title: 'Preencha URL e API Key primeiro', variant: 'destructive' });
      return;
    }
    setIsTesting(true);
    setConnectionStatus('idle');
    try {
      const provider = settings?.whatsapp_provider || 'evolution';
      const edgeFunctionName = provider === 'uazapi' ? 'uazapi-api' : 'evolution-api';
      const response = await supabase.functions.invoke(edgeFunctionName, {
        body: { action: 'test-connection', apiUrl: url, apiKey: key },
      });
      if (response.error) throw new Error(response.error.message);
      const result = response.data;
      if (result?.success) {
        setConnectionStatus('success');
        toast({ title: 'Conexão OK', description: `${provider === 'uazapi' ? 'UazAPI' : 'Evolution API'} respondeu com sucesso` });
      } else {
        throw new Error(result?.error || 'Connection test failed');
      }
    } catch (error: any) {
      setConnectionStatus('error');
      toast({ title: 'Falha na conexão', description: error.message || 'Verifique a URL e credenciais', variant: 'destructive' });
    } finally {
      setIsTesting(false);
    }
  };

  const handleCopyWebhook = () => {
    navigator.clipboard.writeText(webhookUrl);
    setCopied(true);
    toast({ title: 'URL copiada!' });
    setTimeout(() => setCopied(false), 2000);
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
        <div className="flex items-center gap-3">
          <Crown className="w-6 h-6 text-primary" />
          <div>
            <h1 className="text-2xl font-bold">Master Admin</h1>
            <p className="text-muted-foreground">
              Configurações técnicas, exportação de dados e migração
            </p>
          </div>
        </div>

        <Tabs defaultValue="provider" className="w-full">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="provider">Provedor</TabsTrigger>
            <TabsTrigger value="export">Exportar Dados</TabsTrigger>
            <TabsTrigger value="migration">SQL Migração</TabsTrigger>
          </TabsList>

          {/* Tab 1: Provider (existing content) */}
          <TabsContent value="provider">
            <div className="space-y-6">
              <div className="grid gap-6 lg:grid-cols-2">
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Globe className="w-5 h-5" />
                      Provedor WhatsApp
                    </CardTitle>
                    <CardDescription>Selecione qual API será usada para comunicação com o WhatsApp</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="space-y-2">
                      <Label>Provedor Ativo</Label>
                      <Select value={settings?.whatsapp_provider || 'evolution'} onValueChange={handleProviderChange}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="evolution">Evolution API</SelectItem>
                          <SelectItem value="uazapi">UazAPI</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <Badge variant={settings?.whatsapp_provider === 'uazapi' ? 'secondary' : 'default'}>
                      {settings?.whatsapp_provider === 'uazapi' ? 'UazAPI' : 'Evolution API'} ativo
                    </Badge>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Key className="w-5 h-5" />
                      Credenciais do Provedor
                    </CardTitle>
                    <CardDescription>URL e chave de autenticação da API selecionada</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="space-y-2">
                      <Label>URL da API</Label>
                      <Input placeholder="https://sua-api.exemplo.com" value={getCurrentUrl()} onChange={(e) => setCurrentUrl(e.target.value)} />
                    </div>
                    <div className="space-y-2">
                      <Label>{settings?.whatsapp_provider === 'uazapi' ? 'Admin Token' : 'API Key'}</Label>
                      <Input type="password" placeholder="Sua chave de API" value={getCurrentKey()} onChange={(e) => setCurrentKey(e.target.value)} />
                    </div>
                    <div className="flex items-center gap-2">
                      <Button variant="outline" onClick={handleTestConnection} disabled={isTesting}>
                        {isTesting ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : connectionStatus === 'success' ? <Wifi className="w-4 h-4 mr-2 text-green-500" /> : connectionStatus === 'error' ? <WifiOff className="w-4 h-4 mr-2 text-red-500" /> : <Wifi className="w-4 h-4 mr-2" />}
                        Testar Conexão
                      </Button>
                      {connectionStatus === 'success' && <Badge variant="outline" className="text-green-500 border-green-500">Conectado</Badge>}
                      {connectionStatus === 'error' && <Badge variant="outline" className="text-red-500 border-red-500">Falha</Badge>}
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Webhook className="w-5 h-5" />
                      Webhook
                    </CardTitle>
                    <CardDescription>URL para receber eventos do provedor (configure no painel do provedor)</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="space-y-2">
                      <Label>URL do Webhook</Label>
                      <div className="flex gap-2">
                        <Input value={webhookUrl} readOnly className="font-mono text-xs" />
                        <Button variant="outline" size="icon" onClick={handleCopyWebhook}>
                          {copied ? <Check className="w-4 h-4 text-green-500" /> : <Copy className="w-4 h-4" />}
                        </Button>
                      </div>
                      <p className="text-xs text-muted-foreground">Cole esta URL no painel do seu provedor WhatsApp para receber eventos automaticamente</p>
                    </div>
                  </CardContent>
                </Card>
              </div>

              <div className="flex justify-end">
                <Button onClick={handleSave} disabled={isSaving}>
                  {isSaving && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                  Salvar Configurações
                </Button>
              </div>
            </div>
          </TabsContent>

          {/* Tab 2: Export Data */}
          <TabsContent value="export">
            <ExportDataTab />
          </TabsContent>

          {/* Tab 3: Migration SQL */}
          <TabsContent value="migration">
            <MigrationSQLTab />
          </TabsContent>
        </Tabs>
      </div>
    </DashboardLayout>
  );
}
