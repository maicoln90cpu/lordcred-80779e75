import { useState } from 'react';
import { Globe, Key, Wifi, WifiOff, Loader2, Copy, Check, Webhook, AlertTriangle } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
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

  const FieldRow = ({ label, field, type = 'text', placeholder, hint, optional }: {
    label: string; field: keyof MetaSettings; type?: string; placeholder: string; hint?: string; optional?: boolean;
  }) => (
    <div className="space-y-1">
      <div className="flex items-center justify-between">
        <Label className="text-xs">
          {label}
          {optional && <span className="text-muted-foreground ml-1">(opcional)</span>}
        </Label>
        {settings[field] && (
          <Button variant="ghost" size="sm" className="h-5 text-[10px] px-1.5" onClick={() => onChange(field, '')}>
            Limpar
          </Button>
        )}
      </div>
      <Input
        type={type}
        placeholder={placeholder}
        value={settings[field]}
        onChange={(e) => onChange(field, e.target.value)}
        className="h-9 text-sm"
      />
      {hint && <p className="text-[11px] text-muted-foreground">{hint}</p>}
    </div>
  );

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base flex items-center gap-2">
            <Key className="w-4 h-4 text-muted-foreground" />
            Credenciais Meta
          </CardTitle>
          <Badge variant={filledCount === 5 ? 'default' : 'secondary'} className="text-xs">
            {filledCount}/5 campos
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <Alert className="border-warning/40 bg-warning/5 py-2">
          <AlertTriangle className="h-3.5 w-3.5 text-warning" />
          <AlertDescription className="text-xs">
            <strong>Token Global (fallback):</strong> O Access Token aqui é usado quando o chip não tem token próprio na aba Chips.
            Hierarquia: Token do Chip → Token Global → Secret do servidor.
          </AlertDescription>
        </Alert>

        {/* Identification */}
        <div className="grid gap-4 sm:grid-cols-2">
          <FieldRow label="App ID" field="meta_app_id" placeholder="123456789012345" />
          <FieldRow label="App Secret" field="meta_app_secret" type="password" placeholder="32 caracteres" hint="Configurações → Básico no painel do App" />
        </div>

        {/* Tokens */}
        <div className="grid gap-4 sm:grid-cols-2">
          <FieldRow label="Access Token Global (fallback)" field="meta_access_token" type="password" placeholder="EAAxxxxxxx..." hint="Usado quando o chip não tem token próprio" />
          <FieldRow label="Verify Token (webhook)" field="meta_verify_token" placeholder="lordcred2026" hint="Texto que você inventa e cola IGUAL no Meta Webhook" />
        </div>

        <FieldRow label="Webhook Secret (HMAC)" field="meta_webhook_secret" type="password" placeholder="Segredo HMAC" hint="Se vazio, webhooks são aceitos sem validação de assinatura" optional />

        <div className="border-t pt-4 space-y-3">
          {/* Webhook URL */}
          <div className="space-y-1">
            <Label className="text-xs flex items-center gap-1.5">
              <Webhook className="w-3 h-3 text-muted-foreground" />
              Webhook URL
            </Label>
            <div className="flex gap-2">
              <Input value={webhookUrl} readOnly className="font-mono text-xs h-9 bg-muted/30" />
              <Button variant="outline" size="icon" className="h-9 w-9 shrink-0" onClick={handleCopyWebhook}>
                {copied ? <Check className="w-3.5 h-3.5 text-green-500" /> : <Copy className="w-3.5 h-3.5" />}
              </Button>
            </div>
            <p className="text-[11px] text-muted-foreground">Cole no Meta → App → WhatsApp → Configuration → Webhook URL</p>
          </div>

          {/* Test */}
          <div className="space-y-2">
            <Label className="text-xs">WABA ID (para listar números — opcional)</Label>
            <Input
              placeholder="Ex: 987654321098765"
              value={wabaInput}
              onChange={(e) => setWabaInput(e.target.value)}
              className="font-mono text-xs h-9"
            />
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={handleTestConnection} disabled={isTesting}>
              {isTesting ? (
                <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" />
              ) : connectionStatus === 'success' ? (
                <Wifi className="w-3.5 h-3.5 mr-1.5 text-green-500" />
              ) : connectionStatus === 'error' ? (
                <WifiOff className="w-3.5 h-3.5 mr-1.5 text-red-500" />
              ) : (
                <Wifi className="w-3.5 h-3.5 mr-1.5" />
              )}
              Testar Conexão
            </Button>
            {connectionStatus === 'success' && <Badge variant="outline" className="text-green-500 border-green-500 text-xs">Conectado</Badge>}
            {connectionStatus === 'error' && <Badge variant="outline" className="text-red-500 border-red-500 text-xs">Falha</Badge>}
          </div>

          {/* Diagnostic results */}
          {diagnostic && (
            <DiagnosticPanel diagnostic={diagnostic} settings={settings} />
          )}
        </div>
      </CardContent>
    </Card>
  );
}

function DiagnosticPanel({ diagnostic, settings }: {
  diagnostic: {
    tokenValid: boolean;
    appId?: string;
    expiresAt?: string;
    scopes?: string[];
    wabaId?: string;
    phoneNumbers?: Array<{ id: string; display_phone_number: string; verified_name: string }>;
    chipsRegistered?: Array<{ id: string; nickname: string | null; meta_phone_number_id: string | null }>;
  };
  settings: MetaSettings;
}) {
  return (
    <div className="rounded-lg border bg-muted/30 p-3 space-y-2 text-xs">
      <div className="flex flex-wrap gap-x-4 gap-y-1">
        <span><strong>Token App ID:</strong> <code>{diagnostic.appId}</code></span>
        <span><strong>Expira:</strong> {diagnostic.expiresAt}</span>
      </div>
      {diagnostic.appId && diagnostic.appId !== settings.meta_app_id && (
        <Alert className="border-warning/40 bg-warning/5 py-2">
          <AlertTriangle className="h-3 w-3 text-warning" />
          <AlertDescription className="text-xs">
            ⚠️ Token pertence ao App <code>{diagnostic.appId}</code>, mas o App ID salvo é <code>{settings.meta_app_id}</code>.
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
                  <strong>{orphans.length} chip(s) com Phone Number ID inválido:</strong>
                  <ul className="mt-1 space-y-0.5">
                    {orphans.map((c) => (
                      <li key={c.id}>• <code>{c.meta_phone_number_id}</code> — {c.nickname || '(sem apelido)'}</li>
                    ))}
                  </ul>
                </AlertDescription>
              </Alert>
            );
          })()}
        </div>
      )}
    </div>
  );
}
