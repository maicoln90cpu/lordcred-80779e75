import { useEffect, useState } from 'react';
import { Save, Loader2, Wifi, WifiOff, Copy, Check, Globe, Key, Webhook } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import DashboardLayout from '@/components/layout/DashboardLayout';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import MetaConfigCard from '@/components/admin/MetaConfigCard';
import MetaCredentialsGuide from '@/components/admin/MetaCredentialsGuide';
import MetaUserAccessCard from '@/components/admin/MetaUserAccessCard';
import MetaChipsManager from '@/components/settings/MetaChipsManager';
import MetaSetupGuide from '@/components/admin/MetaSetupGuide';
import SupportChatSettings from '@/components/settings/SupportChatSettings';

interface ProviderSettings {
  id: string;
  uazapi_api_url: string | null;
  uazapi_api_key: string | null;
  meta_app_id: string | null;
  meta_access_token: string | null;
  meta_verify_token: string | null;
  meta_app_secret: string | null;
  meta_webhook_secret: string | null;
}

export default function Integrations() {
  const { toast } = useToast();
  const [providerSettings, setProviderSettings] = useState<ProviderSettings | null>(null);
  const [isSavingProvider, setIsSavingProvider] = useState(false);
  const [isTesting, setIsTesting] = useState(false);
  const [connectionStatus, setConnectionStatus] = useState<'idle' | 'success' | 'error'>('idle');
  const [copied, setCopied] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const webhookUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/evolution-webhook`;
  const metaWebhookUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/meta-webhook`;

  useEffect(() => {
    fetchProviderSettings();
  }, []);

  const fetchProviderSettings = async () => {
    try {
      const { data } = await supabase
        .from('system_settings')
        .select('id, uazapi_api_url, uazapi_api_key, meta_app_id, meta_access_token, meta_verify_token, meta_app_secret, meta_webhook_secret')
        .limit(1)
        .maybeSingle();
      if (data) {
        setProviderSettings({
          ...data,
          meta_app_secret: (data as any).meta_app_secret ?? null,
          meta_webhook_secret: (data as any).meta_webhook_secret ?? null,
        } as unknown as ProviderSettings);
      }
    } catch (err) {
      console.error('Error fetching provider settings:', err);
    }
    setLoading(false);
  };

  const handleSaveProvider = async () => {
    if (!providerSettings) return;
    setIsSavingProvider(true);
    try {
      const updateData: Record<string, any> = {
        whatsapp_provider: 'uazapi',
        provider_api_url: providerSettings.uazapi_api_url || null,
        provider_api_key: providerSettings.uazapi_api_key || null,
        uazapi_api_url: providerSettings.uazapi_api_url || null,
        uazapi_api_key: providerSettings.uazapi_api_key || null,
        meta_app_id: providerSettings.meta_app_id || null,
        meta_access_token: providerSettings.meta_access_token || null,
        meta_verify_token: providerSettings.meta_verify_token || null,
        meta_app_secret: providerSettings.meta_app_secret || null,
        meta_webhook_secret: providerSettings.meta_webhook_secret || null,
      };
      const { error } = await supabase
        .from('system_settings')
        .update(updateData)
        .eq('id', providerSettings.id);
      if (error) throw error;
      toast({ title: 'Configurações salvas com sucesso' });
    } catch (error) {
      toast({ title: 'Erro ao salvar', description: (error as any)?.message, variant: 'destructive' });
    } finally {
      setIsSavingProvider(false);
    }
  };

  const handleTestConnection = async () => {
    const url = providerSettings?.uazapi_api_url;
    const key = providerSettings?.uazapi_api_key;
    if (!url || !key) {
      toast({ title: 'Preencha URL e Admin Token primeiro', variant: 'destructive' });
      return;
    }
    setIsTesting(true);
    setConnectionStatus('idle');
    try {
      const response = await supabase.functions.invoke('uazapi-api', {
        body: { action: 'test-connection', apiUrl: url, apiKey: key },
      });
      if (response.error) throw new Error(response.error.message);
      if (response.data?.success) {
        setConnectionStatus('success');
        toast({ title: 'Conexão OK', description: 'UazAPI respondeu com sucesso' });
      } else {
        throw new Error(response.data?.error || 'Falha');
      }
    } catch (error: any) {
      setConnectionStatus('error');
      toast({ title: 'Falha na conexão', description: error.message, variant: 'destructive' });
    } finally {
      setIsTesting(false);
    }
  };

  const handleCopy = (url: string, label: string) => {
    navigator.clipboard.writeText(url);
    setCopied(label);
    toast({ title: 'URL copiada!' });
    setTimeout(() => setCopied(null), 2000);
  };

  if (loading) {
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
          <h1 className="text-2xl font-bold">Integrações</h1>
          <p className="text-muted-foreground">Configuração dos provedores WhatsApp e integrações externas</p>
        </div>

        <Tabs defaultValue="uazapi" className="space-y-6">
          <TabsList>
            <TabsTrigger value="uazapi">UazAPI</TabsTrigger>
            <TabsTrigger value="meta">Meta WhatsApp</TabsTrigger>
            <TabsTrigger value="support">Support Chat</TabsTrigger>
          </TabsList>

          {/* UazAPI Tab */}
          <TabsContent value="uazapi">
            <div className="space-y-6">
              <div className="grid gap-6 lg:grid-cols-2">
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Globe className="w-5 h-5" />
                      Provedor WhatsApp — UazAPI
                    </CardTitle>
                    <CardDescription>Conexão via QR Code (WhatsApp Web)</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <Badge variant="secondary">UazAPI ativo</Badge>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Key className="w-5 h-5" />
                      Credenciais UazAPI
                    </CardTitle>
                    <CardDescription>URL e Admin Token da UazAPI</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="space-y-2">
                      <Label>URL da API</Label>
                      <Input placeholder="https://sua-uazapi.exemplo.com" value={providerSettings?.uazapi_api_url || ''} onChange={(e) => setProviderSettings(s => s ? { ...s, uazapi_api_url: e.target.value } : s)} />
                    </div>
                    <div className="space-y-2">
                      <Label>Admin Token</Label>
                      <Input type="password" placeholder="Seu admin token" value={providerSettings?.uazapi_api_key || ''} onChange={(e) => setProviderSettings(s => s ? { ...s, uazapi_api_key: e.target.value } : s)} />
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
                      Webhook UazAPI
                    </CardTitle>
                    <CardDescription>URL para receber eventos da UazAPI</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="space-y-2">
                      <Label>URL do Webhook</Label>
                      <div className="flex gap-2">
                        <Input value={webhookUrl} readOnly className="font-mono text-xs" />
                        <Button variant="outline" size="icon" onClick={() => handleCopy(webhookUrl, 'uazapi')}>
                          {copied === 'uazapi' ? <Check className="w-4 h-4 text-green-500" /> : <Copy className="w-4 h-4" />}
                        </Button>
                      </div>
                      <p className="text-xs text-muted-foreground">Cole esta URL no painel da UazAPI para receber eventos automaticamente</p>
                    </div>
                  </CardContent>
                </Card>
              </div>

              <div className="flex justify-end">
                <Button onClick={handleSaveProvider} disabled={isSavingProvider}>
                  {isSavingProvider && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                  <Save className="w-4 h-4 mr-2" /> Salvar Configurações
                </Button>
              </div>
            </div>
          </TabsContent>

          {/* Meta WhatsApp Tab — Sub-tabs */}
          <TabsContent value="meta">
            {providerSettings ? (
              <Tabs defaultValue="meta-config" className="space-y-6">
                <TabsList>
                  <TabsTrigger value="meta-config">⚙️ Configuração</TabsTrigger>
                  <TabsTrigger value="meta-chips">📱 Chips</TabsTrigger>
                  <TabsTrigger value="meta-access">👥 Acesso</TabsTrigger>
                </TabsList>

                {/* Sub-tab: Configuração */}
                <TabsContent value="meta-config">
                  <div className="space-y-6">
                    <MetaSetupGuide
                      hasAppId={!!providerSettings.meta_app_id}
                      hasToken={!!providerSettings.meta_access_token}
                      hasVerifyToken={!!providerSettings.meta_verify_token}
                      webhookUrl={metaWebhookUrl}
                    />

                    <MetaConfigCard
                      settings={{
                        meta_app_id: providerSettings.meta_app_id || '',
                        meta_access_token: providerSettings.meta_access_token || '',
                        meta_verify_token: providerSettings.meta_verify_token || '',
                        meta_app_secret: providerSettings.meta_app_secret || '',
                        meta_webhook_secret: providerSettings.meta_webhook_secret || '',
                      }}
                      onChange={(field, value) =>
                        setProviderSettings(s => s ? { ...s, [field]: value } : s)
                      }
                      webhookUrl={metaWebhookUrl}
                    />

                    <MetaCredentialsGuide />

                    <div className="flex justify-end">
                      <Button onClick={handleSaveProvider} disabled={isSavingProvider}>
                        {isSavingProvider && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                        <Save className="w-4 h-4 mr-2" /> Salvar Configurações
                      </Button>
                    </div>
                  </div>
                </TabsContent>

                {/* Sub-tab: Chips */}
                <TabsContent value="meta-chips">
                  <MetaChipsManager />
                </TabsContent>

                {/* Sub-tab: Acesso */}
                <TabsContent value="meta-access">
                  <MetaUserAccessCard />
                </TabsContent>
              </Tabs>
            ) : (
              <Card>
                <CardContent className="py-8 text-center text-muted-foreground">
                  Configurações não carregadas
                </CardContent>
              </Card>
            )}
          </TabsContent>

          {/* Support Chat Tab */}
          <TabsContent value="support">
            <SupportChatSettings />
          </TabsContent>
        </Tabs>
      </div>
    </DashboardLayout>
  );
}
