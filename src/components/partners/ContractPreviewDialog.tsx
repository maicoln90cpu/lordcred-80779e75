import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Download, Send, Loader2 } from 'lucide-react';

interface ContractPreviewDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  contractText: string;
  onConfirmSend: () => void;
  isSending: boolean;
}

export function ContractPreviewDialog({ open, onOpenChange, contractText, onConfirmSend, isSending }: ContractPreviewDialogProps) {
  const handleDownload = () => {
    const blob = new Blob([contractText], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'contrato_previa.txt';
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[80vh]">
        <DialogHeader>
          <DialogTitle>Prévia do Contrato</DialogTitle>
        </DialogHeader>
        <ScrollArea className="h-[50vh] rounded-md border p-4">
          <pre className="whitespace-pre-wrap text-sm font-mono text-foreground leading-relaxed">
            {contractText}
          </pre>
        </ScrollArea>
        <DialogFooter className="flex flex-col sm:flex-row gap-2">
          <Button variant="outline" onClick={handleDownload}>
            <Download className="w-4 h-4 mr-2" /> Baixar Prévia
          </Button>
          <Button onClick={onConfirmSend} disabled={isSending}>
            {isSending ? (
              <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Enviando...</>
            ) : (
              <><Send className="w-4 h-4 mr-2" /> Confirmar e Enviar para Assinatura</>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
