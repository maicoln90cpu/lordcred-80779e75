import { useState } from 'react';
import { Globe, Key, Wifi, WifiOff, Loader2, Copy, Check, Webhook, ExternalLink } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';

interface MetaSettings {
  meta_app_id: string;
  meta_access_token: string;
  meta_verify_token: string;
}

interface MetaConfigCardProps {
  settings: MetaSettings;
  onChange: (field: keyof MetaSettings, value: string) => void;
  webhookUrl: string;
}

export default function MetaConfigCard({ settings, onChange, webhookUrl }: MetaConfigCardProps) {
  const { toast } = useToast();
  const [copied, setCopied] = useState(false);
  const [isTesting, setIsTesting] = useState(false);
  const [connectionStatus, setConnectionStatus] = useState<'idle' | 'success' | 'error'>('idle');

  const handleCopyWebhook = () => {
    navigator.clipboard.writeText(webhookUrl);
    setCopied(true);
    toast({ title: 'URL copiada!' });
    setTimeout(() => setCopied(false), 2000);
  };

  const handleTestConnection = async () => {
    if (!settings.meta_access_token || !settings.meta_app_id) {
      toast({ title: 'Preencha App ID e Access Token primeiro', variant: 'destructive' });
      return;
    }
    setIsTesting(true);
    setConnectionStatus('idle');
    try {
      // Test by calling the Meta Graph API debug_token endpoint
      const response = await fetch(
        `https://graph.facebook.com/v21.0/debug_token?input_token=${settings.meta_access_token}&access_token=${settings.meta_access_token}`
      );
      const data = await response.json();
      if (data?.data?.is_valid || response.ok) {
        setConnectionStatus('success');
        toast({ title: 'Conexão OK', description: 'Meta Cloud API respondeu com sucesso' });
      } else {
        throw new Error(data?.error?.message || 'Token inválido');
      }
    } catch (error: any) {
      setConnectionStatus('error');
      toast({
        title: 'Falha na conexão',
        description: error.message || 'Verifique as credenciais',
        variant: 'destructive',
      });
    } finally {
      setIsTesting(false);
    }
  };

  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Globe className="w-5 h-5" />
            Meta WhatsApp Cloud API
          </CardTitle>
          <CardDescription>
            API oficial do WhatsApp via Meta Business Platform
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <Badge variant="outline" className="text-blue-500 border-blue-500">
            Meta Cloud API
          </Badge>
          <p className="text-xs text-muted-foreground">
            Conexão oficial, sem risco de ban. Requer conta no{' '}
            <a
              href="https://business.facebook.com"
              target="_blank"
              rel="noopener noreferrer"
              className="text-primary underline inline-flex items-center gap-1"
            >
              Meta Business Manager <ExternalLink className="w-3 h-3" />
            </a>
          </p>
          <div className="bg-muted/50 rounded-lg p-3 text-xs space-y-1">
            <p className="font-medium">Como configurar:</p>
            <ol className="list-decimal list-inside space-y-1 text-muted-foreground">
              <li>Acesse developers.facebook.com</li>
              <li>Crie um App com produto WhatsApp</li>
              <li>Registre e verifique um número</li>
              <li>Copie o App ID e Access Token</li>
              <li>Cole nos campos ao lado</li>
            </ol>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Key className="w-5 h-5" />
            Credenciais Meta
          </CardTitle>
          <CardDescription>App ID e Access Token do Meta for Developers</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label>App ID</Label>
            <Input
              placeholder="123456789012345"
              value={settings.meta_app_id}
              onChange={(e) => onChange('meta_app_id', e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label>Access Token (permanente)</Label>
            <Input
              type="password"
              placeholder="EAAxxxxxxx..."
              value={settings.meta_access_token}
              onChange={(e) => onChange('meta_access_token', e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label>Verify Token (webhook)</Label>
            <Input
              placeholder="Token de verificação do webhook"
              value={settings.meta_verify_token}
              onChange={(e) => onChange('meta_verify_token', e.target.value)}
            />
            <p className="text-xs text-muted-foreground">
              Usado para validar o webhook do Meta. Pode ser qualquer texto.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" onClick={handleTestConnection} disabled={isTesting}>
              {isTesting ? (
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              ) : connectionStatus === 'success' ? (
                <Wifi className="w-4 h-4 mr-2 text-green-500" />
              ) : connectionStatus === 'error' ? (
                <WifiOff className="w-4 h-4 mr-2 text-red-500" />
              ) : (
                <Wifi className="w-4 h-4 mr-2" />
              )}
              Testar Conexão
            </Button>
            {connectionStatus === 'success' && (
              <Badge variant="outline" className="text-green-500 border-green-500">Conectado</Badge>
            )}
            {connectionStatus === 'error' && (
              <Badge variant="outline" className="text-red-500 border-red-500">Falha</Badge>
            )}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Webhook className="w-5 h-5" />
            Webhook Meta
          </CardTitle>
          <CardDescription>
            URL para receber eventos do Meta (configure no Meta Business Manager → Webhook)
          </CardDescription>
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
            <p className="text-xs text-muted-foreground">
              Cole esta URL no Meta Business Manager → App → WhatsApp → Configuration → Webhook URL
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
