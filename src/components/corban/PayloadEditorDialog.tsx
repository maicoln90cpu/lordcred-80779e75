import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Send, Loader2, Copy, RotateCcw } from 'lucide-react';
import { toast } from 'sonner';

interface PayloadEditorDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  initialPayload: Record<string, unknown>;
  onSend: (payload: Record<string, unknown>) => Promise<void>;
  title?: string;
}

export function PayloadEditorDialog({ open, onOpenChange, initialPayload, onSend, title = 'Editar Payload' }: PayloadEditorDialogProps) {
  const [text, setText] = useState('');
  const [sending, setSending] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (open) {
      setText(JSON.stringify(initialPayload, null, 2));
      setError('');
    }
  }, [open, initialPayload]);

  const handleSend = async () => {
    try {
      const parsed = JSON.parse(text);
      setError('');
      setSending(true);
      await onSend(parsed);
      setSending(false);
      onOpenChange(false);
    } catch (e: any) {
      if (e instanceof SyntaxError) {
        setError('JSON inválido: ' + e.message);
      } else {
        toast.error('Erro ao enviar', { description: e.message });
        setSending(false);
      }
    }
  };

  const handleReset = () => {
    setText(JSON.stringify(initialPayload, null, 2));
    setError('');
  };

  const handleCopy = () => {
    navigator.clipboard.writeText(text);
    toast.success('Payload copiado');
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[85vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>Edite o JSON do payload antes de enviar. Útil para ajustar dados manualmente.</DialogDescription>
        </DialogHeader>
        <ScrollArea className="flex-1 min-h-0">
          <Textarea
            value={text}
            onChange={e => { setText(e.target.value); setError(''); }}
            className="font-mono text-xs min-h-[300px] resize-none"
            spellCheck={false}
          />
        </ScrollArea>
        {error && <p className="text-xs text-destructive">{error}</p>}
        <DialogFooter className="flex flex-col sm:flex-row gap-2">
          <div className="flex gap-2">
            <Button variant="ghost" size="sm" onClick={handleCopy}><Copy className="w-3.5 h-3.5 mr-1" /> Copiar</Button>
            <Button variant="ghost" size="sm" onClick={handleReset}><RotateCcw className="w-3.5 h-3.5 mr-1" /> Resetar</Button>
          </div>
          <Button onClick={handleSend} disabled={sending}>
            {sending ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Send className="w-4 h-4 mr-2" />}
            {sending ? 'Enviando...' : 'Enviar Payload'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
