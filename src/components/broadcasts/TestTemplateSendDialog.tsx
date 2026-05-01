/**
 * Test-send dialog: send a single template to one phone number for QA.
 * Does NOT create a broadcast_campaign — just calls whatsapp-gateway directly.
 */
import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Loader2, Send, FlaskConical, CheckCircle2, XCircle } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import type { VarBinding } from './MetaTemplateVarBinding';

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  chipId: string;
  templateName: string;
  templateLanguage: string;
  headerVars: Record<string, VarBinding>;
  bodyVars: Record<string, VarBinding>;
}

/** Resolve a binding to a literal text for the test send (lead_field becomes a placeholder). */
function bindingToLiteral(b: VarBinding): string {
  if (b.kind === 'text') return b.value || '—';
  return `[${b.field.toUpperCase()}_TESTE]`;
}

function buildComponents(headerVars: Record<string, VarBinding>, bodyVars: Record<string, VarBinding>): any[] {
  const out: any[] = [];
  const hKeys = Object.keys(headerVars).sort();
  if (hKeys.length > 0) {
    out.push({ type: 'header', parameters: hKeys.map(k => ({ type: 'text', text: bindingToLiteral(headerVars[k]) })) });
  }
  const bKeys = Object.keys(bodyVars).sort();
  if (bKeys.length > 0) {
    out.push({ type: 'body', parameters: bKeys.map(k => ({ type: 'text', text: bindingToLiteral(bodyVars[k]) })) });
  }
  return out;
}

export default function TestTemplateSendDialog({
  open, onOpenChange, chipId, templateName, templateLanguage, headerVars, bodyVars,
}: Props) {
  const { toast } = useToast();
  const [phone, setPhone] = useState('');
  const [sending, setSending] = useState(false);
  const [result, setResult] = useState<{ ok: boolean; message: string } | null>(null);

  const handleSend = async () => {
    const cleaned = phone.replace(/\D/g, '');
    if (cleaned.length < 10) {
      toast({ title: 'Informe um número válido (DDD + número)', variant: 'destructive' });
      return;
    }
    setSending(true);
    setResult(null);
    try {
      const components = buildComponents(headerVars, bodyVars);
      const { data, error } = await supabase.functions.invoke('whatsapp-gateway', {
        body: {
          action: 'send-template',
          chipId,
          phoneNumber: cleaned,
          templateName,
          templateLanguage: templateLanguage || 'pt_BR',
          templateComponents: components.length > 0 ? components : undefined,
          filledTemplateText: `[TESTE] Template ${templateName}`,
        },
      });
      if (error) {
        setResult({ ok: false, message: error.message || 'Erro de rede' });
      } else if (data?.success) {
        setResult({ ok: true, message: `Enviado com sucesso. ID: ${data?.data?.messageId || '—'}` });
      } else {
        setResult({ ok: false, message: data?.error || 'Falha desconhecida' });
      }
    } catch (err: any) {
      setResult({ ok: false, message: err.message || 'Erro inesperado' });
    } finally {
      setSending(false);
    }
  };

  const close = () => { setPhone(''); setResult(null); onOpenChange(false); };

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) close(); else onOpenChange(true); }}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FlaskConical className="w-5 h-5 text-amber-500" />
            Testar template antes do disparo
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div className="bg-muted/30 rounded-md p-3 text-xs space-y-1">
            <div><span className="text-muted-foreground">Template:</span> <span className="font-medium">{templateName}</span> <Badge variant="outline" className="text-[10px] ml-1">{templateLanguage}</Badge></div>
            <div className="text-muted-foreground">Envia 1 mensagem real para o número abaixo. Não cria campanha nem aparece em relatórios.</div>
            <div className="text-amber-600 dark:text-amber-400">⚠️ Variáveis "Campo do lead" usam um valor de placeholder no teste (ex: [NOME_TESTE]).</div>
          </div>

          <div className="space-y-2">
            <Label className="text-xs">Número WhatsApp (apenas dígitos, com DDD)</Label>
            <Input
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="11999998888"
              disabled={sending}
            />
          </div>

          {result && (
            <div className={`rounded-md p-3 text-sm flex items-start gap-2 ${result.ok ? 'bg-green-500/10 text-green-700 dark:text-green-400' : 'bg-red-500/10 text-red-700 dark:text-red-400'}`}>
              {result.ok ? <CheckCircle2 className="w-4 h-4 mt-0.5 shrink-0" /> : <XCircle className="w-4 h-4 mt-0.5 shrink-0" />}
              <span>{result.message}</span>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={close} disabled={sending}>Fechar</Button>
          <Button onClick={handleSend} disabled={sending || !phone}>
            {sending ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Send className="w-4 h-4 mr-2" />}
            Enviar teste
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
