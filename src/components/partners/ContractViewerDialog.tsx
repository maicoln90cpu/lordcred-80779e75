import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Download, FileText } from 'lucide-react';

interface ContractViewerDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  pdfBase64: string;
  partnerName?: string;
  filename?: string;
}

export function ContractViewerDialog({ open, onOpenChange, pdfBase64, partnerName, filename }: ContractViewerDialogProps) {
  const blobUrl = pdfBase64 ? URL.createObjectURL(
    new Blob(
      [Uint8Array.from(atob(pdfBase64), c => c.charCodeAt(0))],
      { type: 'application/pdf' }
    )
  ) : '';

  const handleDownload = () => {
    if (!blobUrl) return;
    const a = document.createElement('a');
    a.href = blobUrl;
    a.download = filename || `contrato_${(partnerName || 'parceiro').replace(/\s+/g, '_')}.pdf`;
    a.click();
  };

  return (
    <Dialog open={open} onOpenChange={(v) => {
      if (!v && blobUrl) URL.revokeObjectURL(blobUrl);
      onOpenChange(v);
    }}>
      <DialogContent className="max-w-4xl max-h-[90vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileText className="w-5 h-5 text-primary" />
            Contrato {partnerName ? `— ${partnerName}` : ''}
          </DialogTitle>
        </DialogHeader>
        {blobUrl ? (
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
