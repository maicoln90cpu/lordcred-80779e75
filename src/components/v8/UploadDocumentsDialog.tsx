import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Loader2, Upload, FileCheck2, Trash2, RefreshCw } from 'lucide-react';
import { toast } from 'sonner';

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  operationId: string;
}

// Apenas tipos aprovados nesta etapa (ver pergunta ao usuário).
// Os IDs precisam bater 1:1 com V8_DOC_TYPES no edge function.
const DOC_TYPE_OPTIONS = [
  { id: 'identification_front', label: 'RG/CNH — Frente' },
  { id: 'identification_back', label: 'RG/CNH — Verso' },
  { id: 'address_proof', label: 'Comprovante de residência' },
  { id: 'paycheck', label: 'Holerite / contracheque' },
];

const ACCEPTED_MIME = 'image/jpeg,image/png,image/webp,application/pdf';
const MAX_BYTES = 10 * 1024 * 1024;

interface Item {
  id: string;
  file: File;
  documentType: string;
  status: 'pending' | 'uploading' | 'done' | 'error';
  errorMsg?: string;
}

function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ''));
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

export default function UploadDocumentsDialog({ open, onOpenChange, operationId }: Props) {
  const [items, setItems] = useState<Item[]>([]);
  const [busy, setBusy] = useState<'upload' | 'resubmit' | null>(null);

  function handleAddFiles(e: React.ChangeEvent<HTMLInputElement>) {
    const list = Array.from(e.target.files || []);
    const next: Item[] = [];
    for (const f of list) {
      if (f.size > MAX_BYTES) {
        toast.error(`${f.name}: maior que 10MB`);
        continue;
      }
      next.push({
        id: `${f.name}-${f.size}-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        file: f,
        documentType: '',
        status: 'pending',
      });
    }
    setItems((cur) => [...cur, ...next]);
    e.target.value = '';
  }

  function setType(id: string, type: string) {
    setItems((cur) => cur.map((it) => (it.id === id ? { ...it, documentType: type } : it)));
  }

  function removeItem(id: string) {
    setItems((cur) => cur.filter((it) => it.id !== id));
  }

  async function uploadAll() {
    const pending = items.filter((it) => it.status !== 'done');
    if (pending.length === 0) {
      toast.info('Nenhum arquivo pendente');
      return;
    }
    if (pending.some((it) => !it.documentType)) {
      toast.error('Selecione o tipo de cada documento antes de enviar');
      return;
    }

    setBusy('upload');
    let okCount = 0;
    let failCount = 0;

    for (const it of pending) {
      setItems((cur) => cur.map((x) => (x.id === it.id ? { ...x, status: 'uploading' } : x)));
      try {
        const b64 = await fileToBase64(it.file);
        const { data, error } = await supabase.functions.invoke('v8-clt-api', {
          body: {
            action: 'upload_document',
            operationId,
            fileBase64: b64,
            fileName: it.file.name,
            mimeType: it.file.type || 'application/octet-stream',
            documentType: it.documentType,
          },
        });
        if (error) throw error;
        if (!data?.success) throw new Error(data?.error || data?.title || 'Falha no upload');
        setItems((cur) => cur.map((x) => (x.id === it.id ? { ...x, status: 'done' } : x)));
        okCount++;
      } catch (e: any) {
        const msg = e?.message ?? String(e);
        setItems((cur) => cur.map((x) => (x.id === it.id ? { ...x, status: 'error', errorMsg: msg } : x)));
        failCount++;
      }
    }

    setBusy(null);
    if (failCount === 0) toast.success(`${okCount} documento(s) enviado(s)`);
    else toast.error(`${okCount} ok / ${failCount} falha(s)`);
  }

  async function resubmit() {
    if (items.some((it) => it.status !== 'done')) {
      toast.error('Conclua o upload de todos os documentos antes de reapresentar');
      return;
    }
    if (items.length === 0) {
      toast.error('Envie pelo menos 1 documento antes de reapresentar');
      return;
    }
    if (!window.confirm('Reapresentar a operação para análise da V8?')) return;

    setBusy('resubmit');
    try {
      const { data, error } = await supabase.functions.invoke('v8-clt-api', {
        body: { action: 'resubmit_documents', operationId },
      });
      if (error) throw error;
      if (!data?.success) throw new Error(data?.error || data?.title || 'Falha ao reapresentar');
      toast.success('Operação reapresentada para análise');
      onOpenChange(false);
      setItems([]);
    } catch (e: any) {
      toast.error(`Falhou: ${e?.message ?? e}`);
    } finally {
      setBusy(null);
    }
  }

  const allDone = items.length > 0 && items.every((it) => it.status === 'done');

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Resolver pendência de documentos</DialogTitle>
          <DialogDescription>
            Operação <span className="font-mono text-xs">{operationId.slice(0, 12)}…</span>.
            Envie cada documento, escolha o tipo e depois clique em <b>Reapresentar</b> para a V8 reanalisar.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div>
            <Label htmlFor="file-input" className="block mb-2">
              Adicionar arquivos (PDF, JPG, PNG, WebP — até 10 MB cada)
            </Label>
            <input
              id="file-input"
              type="file"
              multiple
              accept={ACCEPTED_MIME}
              onChange={handleAddFiles}
              disabled={!!busy}
              className="block w-full text-sm file:mr-3 file:py-2 file:px-3 file:rounded-md file:border-0 file:bg-primary file:text-primary-foreground hover:file:bg-primary/90"
            />
          </div>

          {items.length > 0 && (
            <div className="border rounded-md divide-y max-h-72 overflow-auto">
              {items.map((it) => (
                <div key={it.id} className="flex items-center gap-2 p-2">
                  <div className="flex-1 min-w-0">
                    <div className="text-sm truncate">{it.file.name}</div>
                    <div className="text-xs text-muted-foreground">
                      {(it.file.size / 1024).toFixed(0)} KB
                      {it.errorMsg && <span className="ml-2 text-destructive">— {it.errorMsg}</span>}
                    </div>
                  </div>
                  <Select
                    value={it.documentType}
                    onValueChange={(v) => setType(it.id, v)}
                    disabled={it.status === 'done' || !!busy}
                  >
                    <SelectTrigger className="w-56 h-8">
                      <SelectValue placeholder="Tipo do documento" />
                    </SelectTrigger>
                    <SelectContent>
                      {DOC_TYPE_OPTIONS.map((o) => (
                        <SelectItem key={o.id} value={o.id}>{o.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <div className="w-7 flex justify-center">
                    {it.status === 'uploading' && <Loader2 className="w-4 h-4 animate-spin" />}
                    {it.status === 'done' && <FileCheck2 className="w-4 h-4 text-green-600" />}
                  </div>
                  <Button
                    size="icon" variant="ghost" className="h-7 w-7"
                    onClick={() => removeItem(it.id)} disabled={!!busy}
                  >
                    <Trash2 className="w-3 h-3" />
                  </Button>
                </div>
              ))}
            </div>
          )}
        </div>

        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={!!busy}>
            Fechar
          </Button>
          <Button onClick={uploadAll} disabled={!!busy || items.length === 0 || allDone}>
            {busy === 'upload' ? <Loader2 className="w-3 h-3 mr-1 animate-spin" /> : <Upload className="w-3 h-3 mr-1" />}
            Enviar à V8
          </Button>
          <Button
            onClick={resubmit}
            disabled={!!busy || !allDone}
            className="bg-amber-600 hover:bg-amber-700 text-white"
          >
            {busy === 'resubmit' ? <Loader2 className="w-3 h-3 mr-1 animate-spin" /> : <RefreshCw className="w-3 h-3 mr-1" />}
            Reapresentar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
