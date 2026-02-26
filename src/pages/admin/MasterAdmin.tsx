import { useEffect, useState } from 'react';
import { Crown, Wifi, WifiOff, Copy, Check, Loader2, Globe, Key, Webhook } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { supabase } from '@/integrations/supabase/client';
import DashboardLayout from '@/components/layout/DashboardLayout';
import { useToast } from '@/hooks/use-toast';
import ExportDataTab from '@/components/admin/ExportDataTab';
import MigrationSQLTab from '@/components/admin/MigrationSQLTab';

interface ProviderSettings {
  id: string;
  uazapi_api_url: string | null;
  uazapi_api_key: string | null;
  provider_api_url: string | null;
  provider_api_key: string | null;
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
        .select('id, provider_api_url, provider_api_key, uazapi_api_url, uazapi_api_key')
        .limit(1)
        .maybeSingle();
      if (error) throw error;
      if (!data) throw new Error('No settings found');
      setSettings(data as unknown as ProviderSettings);
    } catch (error) {
      console.error('Error fetching settings:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSave = async () => {
    if (!settings) return;
    setIsSaving(true);
    try {
      const updateData = {
        whatsapp_provider: 'uazapi',
        provider_api_url: settings.uazapi_api_url || null,
        provider_api_key: settings.uazapi_api_key || null,
        uazapi_api_url: settings.uazapi_api_url || null,
        uazapi_api_key: settings.uazapi_api_key || null,
      };
      const { error } = await supabase
        .from('system_settings')
        .update(updateData)
        .eq('id', settings.id);
      if (error) throw error;
      toast({ title: 'Configurações salvas', description: 'UazAPI configurada com sucesso' });
    } catch (error) {
      console.error('Error saving:', error);
      toast({ title: 'Erro ao salvar', description: (error as any)?.message || String(error), variant: 'destructive' });
    } finally {
      setIsSaving(false);
    }
  };

  const handleTestConnection = async () => {
    const url = settings?.uazapi_api_url;
    const key = settings?.uazapi_api_key;
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
      const result = response.data;
      if (result?.success) {
        setConnectionStatus('success');
        toast({ title: 'Conexão OK', description: 'UazAPI respondeu com sucesso' });
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

          <TabsContent value="provider">
            <div className="space-y-6">
              <div className="grid gap-6 lg:grid-cols-2">
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Globe className="w-5 h-5" />
                      Provedor WhatsApp
                    </CardTitle>
                    <CardDescription>UazAPI — provedor exclusivo de comunicação WhatsApp</CardDescription>
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
                      <Input placeholder="https://sua-uazapi.exemplo.com" value={settings?.uazapi_api_url || ''} onChange={(e) => setSettings(s => s ? { ...s, uazapi_api_url: e.target.value } : s)} />
                    </div>
                    <div className="space-y-2">
                      <Label>Admin Token</Label>
                      <Input type="password" placeholder="Seu admin token" value={settings?.uazapi_api_key || ''} onChange={(e) => setSettings(s => s ? { ...s, uazapi_api_key: e.target.value } : s)} />
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
                    <CardDescription>URL para receber eventos da UazAPI (configure no painel da UazAPI)</CardDescription>
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
                      <p className="text-xs text-muted-foreground">Cole esta URL no painel da UazAPI para receber eventos automaticamente</p>
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

          <TabsContent value="export">
            <ExportDataTab />
          </TabsContent>

          <TabsContent value="migration">
            <MigrationSQLTab />
          </TabsContent>
        </Tabs>
      </div>
    </DashboardLayout>
  );
}
