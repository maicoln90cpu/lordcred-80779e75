import { useState } from 'react';
import { Globe, Key, Wifi, WifiOff, Loader2, Copy, Check, Webhook, ExternalLink, AlertTriangle } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { useToast } from '@/hooks/use-toast';

export interface MetaSettings {
  meta_app_id: string;
  meta_access_token: string;
  meta_verify_token: string;
  meta_app_secret: string;
  meta_webhook_secret: string;
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
  const [diagnostic, setDiagnostic] = useState<{
    tokenValid: boolean;
    appId?: string;
    expiresAt?: string;
    scopes?: string[];
    wabaId?: string;
    phoneNumbers?: Array<{ id: string; display_phone_number: string; verified_name: string }>;
    chipsRegistered?: Array<{ id: string; nickname: string | null; meta_phone_number_id: string | null }>;
  } | null>(null);
  const [wabaInput, setWabaInput] = useState('');

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
    setDiagnostic(null);
    try {
      // 1) Valida o token
      const debugRes = await fetch(
        `https://graph.facebook.com/v21.0/debug_token?input_token=${encodeURIComponent(settings.meta_access_token)}&access_token=${encodeURIComponent(settings.meta_access_token)}`
      );
      const debugData = await debugRes.json();
      const tokenInfo = debugData?.data;
      if (!tokenInfo?.is_valid) {
        throw new Error(debugData?.error?.message || tokenInfo?.error?.message || 'Token inválido ou expirado');
      }

      const appIdMatch = tokenInfo.app_id && tokenInfo.app_id !== settings.meta_app_id;
      const expiresAt = tokenInfo.expires_at ? new Date(tokenInfo.expires_at * 1000).toLocaleString('pt-BR') : 'Nunca expira';

      // 2) Lista phone_number_ids do WABA (se informado)
      let phoneNumbers: any[] = [];
      const wabaToCheck = wabaInput.trim();
      if (wabaToCheck) {
        const phRes = await fetch(
          `https://graph.facebook.com/v21.0/${wabaToCheck}/phone_numbers?access_token=${encodeURIComponent(settings.meta_access_token)}`
        );
        const phData = await phRes.json();
        if (phData?.error) {
          throw new Error(`WABA ${wabaToCheck}: ${phData.error.message}`);
        }
        phoneNumbers = phData?.data || [];
      }

      // 3) Lista chips Meta cadastrados no LordCred para comparar
      const { data: chipsData } = await import('@/integrations/supabase/client').then(({ supabase }) =>
        supabase.from('chips').select('id, nickname, meta_phone_number_id').eq('provider', 'meta')
      );

      setDiagnostic({
        tokenValid: true,
        appId: tokenInfo.app_id,
        expiresAt,
        scopes: tokenInfo.scopes || [],
        wabaId: wabaToCheck || undefined,
        phoneNumbers,
        chipsRegistered: chipsData || [],
      });

      setConnectionStatus('success');
      toast({
        title: 'Conexão OK',
        description: appIdMatch
          ? `Token válido, mas pertence ao App ${tokenInfo.app_id} (não ${settings.meta_app_id})`
          : `Token válido${wabaToCheck ? ` · ${phoneNumbers.length} número(s) no WABA` : ''}`,
      });
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

  const filledCount = [
    settings.meta_app_id,
    settings.meta_access_token,
    settings.meta_verify_token,
    settings.meta_app_secret,
    settings.meta_webhook_secret,
  ].filter(Boolean).length;

  return (
    <div className="space-y-6">
      <Alert className="border-warning/40 bg-warning/5">
        <AlertTriangle className="h-4 w-4 text-warning" />
        <AlertDescription className="text-sm">
          <strong>Modo Configuração:</strong> credenciais salvas aqui têm prioridade sobre os secrets de produção.
          Limpe os campos para voltar a usar os secrets do servidor. Preenchido: <strong>{filledCount}/5</strong> campos.
        </AlertDescription>
      </Alert>

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
                <li>Cole nos campos ao lado (use o guia abaixo)</li>
              </ol>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Key className="w-5 h-5" />
              Credenciais Meta (5 campos)
            </CardTitle>
            <CardDescription>Todas editáveis. Veja o "Manual Passo a Passo" abaixo.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label>App ID</Label>
                {settings.meta_app_id && (
                  <Button variant="ghost" size="sm" className="h-6 text-xs" onClick={() => onChange('meta_app_id', '')}>
                    Limpar
                  </Button>
                )}
              </div>
              <Input
                placeholder="123456789012345"
                value={settings.meta_app_id}
                onChange={(e) => onChange('meta_app_id', e.target.value)}
              />
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label>Access Token (permanente)</Label>
                {settings.meta_access_token && (
                  <Button variant="ghost" size="sm" className="h-6 text-xs" onClick={() => onChange('meta_access_token', '')}>
                    Limpar
                  </Button>
                )}
              </div>
              <Input
                type="password"
                placeholder="EAAxxxxxxx..."
                value={settings.meta_access_token}
                onChange={(e) => onChange('meta_access_token', e.target.value)}
              />
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label>Verify Token (webhook)</Label>
                {settings.meta_verify_token && (
                  <Button variant="ghost" size="sm" className="h-6 text-xs" onClick={() => onChange('meta_verify_token', '')}>
                    Limpar
                  </Button>
                )}
              </div>
              <Input
                placeholder="Ex: lordcred2026 (você inventa)"
                value={settings.meta_verify_token}
                onChange={(e) => onChange('meta_verify_token', e.target.value)}
              />
              <p className="text-xs text-muted-foreground">
                Texto livre que você cola IGUAL no Meta Webhook.
              </p>
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label>App Secret</Label>
                {settings.meta_app_secret && (
                  <Button variant="ghost" size="sm" className="h-6 text-xs" onClick={() => onChange('meta_app_secret', '')}>
                    Limpar
                  </Button>
                )}
              </div>
              <Input
                type="password"
                placeholder="Chave secreta do App (32 caracteres)"
                value={settings.meta_app_secret}
                onChange={(e) => onChange('meta_app_secret', e.target.value)}
              />
              <p className="text-xs text-muted-foreground">
                Encontrado em Configurações → Básico no painel do App.
              </p>
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label>Webhook Secret (opcional)</Label>
                {settings.meta_webhook_secret && (
                  <Button variant="ghost" size="sm" className="h-6 text-xs" onClick={() => onChange('meta_webhook_secret', '')}>
                    Limpar
                  </Button>
                )}
              </div>
              <Input
                type="password"
                placeholder="Segredo de assinatura HMAC (opcional)"
                value={settings.meta_webhook_secret}
                onChange={(e) => onChange('meta_webhook_secret', e.target.value)}
              />
              <p className="text-xs text-muted-foreground">
                Se vazio, o sistema aceita webhooks sem validação de assinatura.
              </p>
            </div>

            <div className="space-y-3 pt-2 border-t">
              <div className="space-y-2">
                <Label className="text-xs">WABA ID (para listar números — opcional)</Label>
                <Input
                  placeholder="Ex: 987654321098765"
                  value={wabaInput}
                  onChange={(e) => setWabaInput(e.target.value)}
                  className="font-mono text-xs"
                />
                <p className="text-xs text-muted-foreground">
                  Se preencher, o teste lista todos os <code>phone_number_id</code> do WABA e compara com os chips Meta cadastrados aqui.
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

              {diagnostic && (
                <div className="rounded-lg border bg-muted/30 p-3 space-y-2 text-xs">
                  <div className="flex flex-wrap gap-x-4 gap-y-1">
                    <span><strong>Token App ID:</strong> <code>{diagnostic.appId}</code></span>
                    <span><strong>Expira:</strong> {diagnostic.expiresAt}</span>
                  </div>
                  {diagnostic.appId && diagnostic.appId !== settings.meta_app_id && (
                    <Alert className="border-warning/40 bg-warning/5 py-2">
                      <AlertTriangle className="h-3 w-3 text-warning" />
                      <AlertDescription className="text-xs">
                        ⚠️ O token pertence ao App <code>{diagnostic.appId}</code>, mas o App ID salvo é <code>{settings.meta_app_id}</code>. Eles precisam ser do mesmo App.
                      </AlertDescription>
                    </Alert>
                  )}
                  {diagnostic.scopes && diagnostic.scopes.length > 0 && (
                    <div>
                      <strong>Permissões:</strong>{' '}
                      {diagnostic.scopes.map((s) => (
                        <Badge key={s} variant="outline" className="text-[10px] mr-1">{s}</Badge>
                      ))}
                    </div>
                  )}
                  {diagnostic.wabaId && (
                    <div className="space-y-2 pt-2 border-t">
                      <p className="font-medium">Números no WABA <code>{diagnostic.wabaId}</code> ({diagnostic.phoneNumbers?.length || 0}):</p>
                      {(diagnostic.phoneNumbers || []).map((p) => {
                        const isRegistered = (diagnostic.chipsRegistered || []).some(
                          (c) => c.meta_phone_number_id === p.id
                        );
                        return (
                          <div key={p.id} className="flex items-center justify-between gap-2 rounded bg-background/60 px-2 py-1">
                            <div>
                              <code className="text-[11px]">{p.id}</code> — {p.display_phone_number} ({p.verified_name})
                            </div>
                            <Badge variant={isRegistered ? 'default' : 'outline'} className="text-[10px]">
                              {isRegistered ? '✓ Em uso' : 'Disponível'}
                            </Badge>
                          </div>
                        );
                      })}

                      {/* Detecta chips com phone_number_id ÓRFÃO (não pertence ao WABA) */}
                      {(() => {
                        const validIds = new Set((diagnostic.phoneNumbers || []).map((p) => p.id));
                        const orphans = (diagnostic.chipsRegistered || []).filter(
                          (c) => c.meta_phone_number_id && !validIds.has(c.meta_phone_number_id)
                        );
                        if (orphans.length === 0) return null;
                        return (
                          <Alert variant="destructive" className="py-2">
                            <AlertTriangle className="h-3 w-3" />
                            <AlertDescription className="text-xs">
                              <strong>{orphans.length} chip(s) com Phone Number ID inválido para este token:</strong>
                              <ul className="mt-1 space-y-0.5">
                                {orphans.map((c) => (
                                  <li key={c.id}>
                                    • <code>{c.meta_phone_number_id}</code> — {c.nickname || '(sem apelido)'}
                                  </li>
                                ))}
                              </ul>
                              Estes chips vão dar o erro <em>"Object with ID does not exist"</em> ao tentar enviar. Solução: trocar o token, ou apagar/recriar o chip com um ID válido acima.
                            </AlertDescription>
                          </Alert>
                        );
                      })()}
                    </div>
                  )}
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        <Card className="lg:col-span-2">
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
    </div>
  );
}
