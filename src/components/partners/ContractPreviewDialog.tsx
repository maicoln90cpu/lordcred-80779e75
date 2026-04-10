import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Download, Send, Loader2, FileText } from 'lucide-react';

interface ContractPreviewDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  contractText: string;
  pdfBase64?: string;
  onConfirmSend: () => void;
  isSending: boolean;
  partnerName?: string;
}

export function ContractPreviewDialog({ open, onOpenChange, contractText, pdfBase64, onConfirmSend, isSending, partnerName }: ContractPreviewDialogProps) {
  const handleDownloadTxt = () => {
    const blob = new Blob([contractText], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'contrato_previa.txt';
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleDownloadPdf = () => {
    if (!pdfBase64) return;
    const byteChars = atob(pdfBase64);
    const byteNumbers = new Array(byteChars.length);
    for (let i = 0; i < byteChars.length; i++) {
      byteNumbers[i] = byteChars.charCodeAt(i);
    }
    const byteArray = new Uint8Array(byteNumbers);
    const blob = new Blob([byteArray], { type: 'application/pdf' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    const safeName = (partnerName || 'parceiro').replace(/[^a-zA-Z0-9À-ÿ ]/g, '').trim().replace(/\s+/g, '_');
    a.download = `contrato_${safeName}.pdf`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[85vh]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileText className="w-5 h-5 text-primary" />
            Prévia do Contrato {partnerName ? `— ${partnerName}` : ''}
          </DialogTitle>
        </DialogHeader>
        <ScrollArea className="h-[55vh] rounded-md border p-4 bg-card">
          <pre className="whitespace-pre-wrap text-sm font-mono text-foreground leading-relaxed">
            {contractText}
          </pre>
        </ScrollArea>
        <DialogFooter className="flex flex-col sm:flex-row gap-2">
          <div className="flex gap-2 flex-1">
            {pdfBase64 && (
              <Button variant="outline" onClick={handleDownloadPdf}>
                <Download className="w-4 h-4 mr-2" /> Baixar PDF
              </Button>
            )}
            <Button variant="ghost" onClick={handleDownloadTxt} className="text-xs">
              <Download className="w-4 h-4 mr-2" /> Baixar TXT
            </Button>
          </div>
          <Button onClick={onConfirmSend} disabled={isSending} className="bg-green-600 hover:bg-green-700">
            {isSending ? (
              <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Enviando para assinatura...</>
            ) : (
              <><Send className="w-4 h-4 mr-2" /> Confirmar e Enviar para Assinatura</>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
