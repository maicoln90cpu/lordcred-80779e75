import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Loader2, KeyRound } from 'lucide-react';
import { toast } from 'sonner';

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  operationId: string;
  /** CPF do tomador (sem máscara) — usado para pré-preencher quando tipo = cpf */
  borrowerCpf?: string | null;
  onResolved?: () => void;
}

type PixType = 'cpf' | 'email' | 'phone';

export default function ResolvePixPendencyDialog({
  open, onOpenChange, operationId, borrowerCpf, onResolved,
}: Props) {
  const [pixType, setPixType] = useState<PixType>('cpf');
  const [pixKey, setPixKey] = useState<string>(borrowerCpf?.replace(/\D/g, '') ?? '');
  const [busy, setBusy] = useState(false);

  function handleTypeChange(next: PixType) {
    setPixType(next);
    if (next === 'cpf') {
      setPixKey(borrowerCpf?.replace(/\D/g, '') ?? '');
    } else {
      setPixKey('');
    }
  }

  function validate(): string | null {
    const v = pixKey.trim();
    if (!v) return 'Informe a chave PIX';
    if (pixType === 'cpf' && v.replace(/\D/g, '').length !== 11) {
      return 'CPF deve ter 11 dígitos';
    }
    if (pixType === 'email' && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v)) {
      return 'E-mail inválido';
    }
    if (pixType === 'phone') {
      const d = v.replace(/\D/g, '');
      if (d.length < 12 || d.length > 13) {
        return 'Telefone com +55 DDD número (ex.: +5511999998888)';
      }
    }
    return null;
  }

  async function submit() {
    const err = validate();
    if (err) { toast.error(err); return; }
    setBusy(true);
    try {
      const { data, error } = await supabase.functions.invoke('v8-clt-api', {
        body: {
          action: 'resolve_pix_pendency',
          operationId,
          pixKey: pixKey.trim(),
          pixKeyType: pixType,
        },
      });
      if (error) throw error;
      if (!data?.success) {
        throw new Error(data?.error || data?.title || 'Falha ao reapresentar PIX na V8');
      }
      toast.success('PIX reapresentado na V8 — aguarde reprocessamento');
      onResolved?.();
      onOpenChange(false);
    } catch (e: any) {
      toast.error(`Falhou: ${e?.message ?? e}`);
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={(v) => !busy && onOpenChange(v)}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <KeyRound className="w-4 h-4" />
            Resolver pendência de PIX
          </DialogTitle>
          <DialogDescription>
            Reapresenta a chave PIX da operação <span className="font-mono">{operationId.slice(0, 12)}…</span> na V8.
            A conta da chave deve ser do titular do contrato.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-2">
            <Label>Tipo de chave PIX</Label>
            <RadioGroup
              value={pixType}
              onValueChange={(v) => handleTypeChange(v as PixType)}
              className="grid grid-cols-3 gap-2"
            >
              <Label
                htmlFor="pix-cpf"
                className="flex items-center gap-2 border rounded-md p-2 cursor-pointer hover:bg-accent"
              >
                <RadioGroupItem value="cpf" id="pix-cpf" />
                <span>CPF</span>
              </Label>
              <Label
                htmlFor="pix-email"
                className="flex items-center gap-2 border rounded-md p-2 cursor-pointer hover:bg-accent"
              >
                <RadioGroupItem value="email" id="pix-email" />
                <span>E-mail</span>
              </Label>
              <Label
                htmlFor="pix-phone"
                className="flex items-center gap-2 border rounded-md p-2 cursor-pointer hover:bg-accent"
              >
                <RadioGroupItem value="phone" id="pix-phone" />
                <span>Telefone</span>
              </Label>
            </RadioGroup>
          </div>

          <div className="space-y-2">
            <Label htmlFor="pix-key">Chave PIX</Label>
            <Input
              id="pix-key"
              value={pixKey}
              onChange={(e) => setPixKey(e.target.value)}
              placeholder={
                pixType === 'cpf' ? '00000000000'
                : pixType === 'email' ? 'titular@exemplo.com'
                : '+5511999998888'
              }
              autoComplete="off"
              inputMode={pixType === 'email' ? 'email' : pixType === 'phone' ? 'tel' : 'numeric'}
              disabled={busy}
            />
            {pixType === 'cpf' && borrowerCpf && (
              <p className="text-xs text-muted-foreground">
                Pré-preenchido com o CPF do tomador.
              </p>
            )}
            {pixType === 'phone' && (
              <p className="text-xs text-muted-foreground">
                Inclua código do país (+55) e DDD.
              </p>
            )}
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={busy}>
            Cancelar
          </Button>
          <Button onClick={submit} disabled={busy}>
            {busy ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <KeyRound className="w-4 h-4 mr-2" />}
            Reapresentar PIX
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
