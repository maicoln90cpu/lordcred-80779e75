import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Download, FileText, AlertTriangle } from 'lucide-react';
import { useMemo, useEffect, useState } from 'react';

interface ContractViewerDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  pdfBase64: string;
  partnerName?: string;
  filename?: string;
}

export function ContractViewerDialog({ open, onOpenChange, pdfBase64, partnerName, filename }: ContractViewerDialogProps) {
  const [error, setError] = useState<string | null>(null);

  const blobUrl = useMemo(() => {
    if (!pdfBase64) return '';
    setError(null);
    try {
      const binaryStr = atob(pdfBase64);
      const bytes = new Uint8Array(binaryStr.length);
      for (let i = 0; i < binaryStr.length; i++) {
        bytes[i] = binaryStr.charCodeAt(i);
      }

      // Validate PDF magic bytes
      const header = String.fromCharCode(...bytes.slice(0, 5));
      if (!header.startsWith('%PDF')) {
        // Could be HTML redirect page
        const text = new TextDecoder().decode(bytes.slice(0, 500));
        console.error('ContractViewer: received non-PDF content:', text.substring(0, 200));
        setError('O arquivo recebido não é um PDF válido. Possível redirecionamento da ClickSign.');
        return '';
      }

      return URL.createObjectURL(new Blob([bytes], { type: 'application/pdf' }));
    } catch (e) {
      console.error('ContractViewer: error creating blob:', e);
      setError('Erro ao processar o PDF. Tente novamente.');
      return '';
    }
  }, [pdfBase64]);

  useEffect(() => {
    return () => {
      if (blobUrl) URL.revokeObjectURL(blobUrl);
    };
  }, [blobUrl]);

  const handleDownload = () => {
    if (!blobUrl) return;
    const a = document.createElement('a');
    a.href = blobUrl;
    a.download = filename || `contrato_${(partnerName || 'parceiro').replace(/\s+/g, '_')}.pdf`;
    a.click();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileText className="w-5 h-5 text-primary" />
            Contrato {partnerName ? `— ${partnerName}` : ''}
          </DialogTitle>
        </DialogHeader>
        {error ? (
          <div className="flex flex-col items-center justify-center min-h-[65vh] text-muted-foreground gap-3">
            <AlertTriangle className="w-10 h-10 text-destructive" />
            <p className="text-sm text-center max-w-md">{error}</p>
          </div>
        ) : blobUrl ? (
          <iframe
            src={blobUrl}
            className="flex-1 w-full min-h-[65vh] rounded-md border"
            title="Contrato PDF"
          />
        ) : (
          <div className="flex items-center justify-center min-h-[65vh] text-muted-foreground">
            Nenhum PDF disponível.
          </div>
        )}
        <div className="flex justify-end gap-2 pt-2">
          <Button variant="outline" onClick={handleDownload} disabled={!blobUrl}>
            <Download className="w-4 h-4 mr-2" /> Baixar PDF
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
