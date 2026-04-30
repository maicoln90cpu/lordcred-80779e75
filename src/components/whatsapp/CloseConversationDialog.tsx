import { useState } from 'react';
import { XCircle, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

const CLOSE_REASONS = [
  { value: 'resolved', label: '✅ Atendimento concluído' },
  { value: 'no_interest', label: '🚫 Sem interesse' },
  { value: 'wrong_number', label: '📵 Número errado' },
  { value: 'spam', label: '🗑️ Spam / Irrelevante' },
  { value: 'transferred', label: '🔄 Transferido para outro setor' },
  { value: 'other', label: '📝 Outro motivo' },
];

interface CloseConversationDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  conversationId: string;
  contactName: string;
  onClosed?: () => void;
}

export default function CloseConversationDialog({ open, onOpenChange, conversationId, contactName, onClosed }: CloseConversationDialogProps) {
  const { toast } = useToast();
  const [reason, setReason] = useState('resolved');
  const [customReason, setCustomReason] = useState('');
  const [closing, setClosing] = useState(false);

  const handleClose = async () => {
    setClosing(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Não autenticado');

      const finalReason = reason === 'other' && customReason.trim()
        ? customReason.trim()
        : CLOSE_REASONS.find(r => r.value === reason)?.label || reason;

      const { error } = await supabase
        .from('conversations')
        .update({
          closed_at: new Date().toISOString(),
          closed_reason: finalReason,
          closed_by: user.id,
        } as any)
        .eq('id', conversationId);

      if (error) throw error;

      toast({ title: '✅ Conversa finalizada', description: `Motivo: ${finalReason}` });
      onOpenChange(false);
      onClosed?.();
    } catch (err: any) {
      toast({ title: 'Erro ao finalizar', description: err.message, variant: 'destructive' });
    } finally {
      setClosing(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <XCircle className="w-5 h-5 text-destructive" />
            Finalizar Conversa
          </DialogTitle>
          <DialogDescription>
            Finalizar conversa com <strong>{contactName}</strong>. Selecione o motivo:
          </DialogDescription>
        </DialogHeader>

        <RadioGroup value={reason} onValueChange={setReason} className="space-y-2">
          {CLOSE_REASONS.map(r => (
            <div key={r.value} className="flex items-center space-x-3 rounded-lg border border-border/50 p-3 hover:bg-muted/50 transition-colors">
              <RadioGroupItem value={r.value} id={`reason-${r.value}`} />
              <Label htmlFor={`reason-${r.value}`} className="cursor-pointer flex-1 text-sm">{r.label}</Label>
            </div>
          ))}
        </RadioGroup>

        {reason === 'other' && (
          <Textarea
            placeholder="Descreva o motivo..."
            value={customReason}
            onChange={e => setCustomReason(e.target.value)}
            className="mt-2"
            rows={3}
          />
        )}

        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={closing}>Cancelar</Button>
          <Button variant="destructive" onClick={handleClose} disabled={closing || (reason === 'other' && !customReason.trim())}>
            {closing && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
            Finalizar Conversa
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
