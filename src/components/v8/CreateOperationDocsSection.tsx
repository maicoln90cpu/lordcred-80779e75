import { useCallback, useState, useEffect } from "react";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Trash2, UploadCloud, FileCheck2, Loader2, Check, X as XIcon, Clock, FileText } from "lucide-react";
import { toast } from "@/hooks/use-toast";

/**
 * Etapa 4 — Anexos antes/depois de criar a proposta.
 * Drag-and-drop, preview de imagens (thumb 48px) e checklist por arquivo
 * (⏳ pendente, 🔄 enviando, ✅ ok, ❌ erro). PDFs mostram ícone genérico.
 */

export const DOC_TYPE_OPTIONS = [
  { id: "identification_front", label: "RG/CNH — Frente" },
  { id: "identification_back", label: "RG/CNH — Verso" },
  { id: "address_proof", label: "Comprovante de residência" },
  { id: "paycheck", label: "Holerite / contracheque" },
];

const ACCEPTED_MIME = "image/jpeg,image/png,image/webp,application/pdf";
const MAX_BYTES = 10 * 1024 * 1024;

export type DocStatus = 'pending' | 'uploading' | 'ok' | 'error';

export interface PendingDoc {
  id: string;
  file: File;
  documentType: string;
  status?: DocStatus;
  errorMessage?: string;
}

export function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ""));
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

interface Props {
  items: PendingDoc[];
  onChange: (next: PendingDoc[]) => void;
  disabled?: boolean;
}

/** Cria um objectURL de preview e libera quando o item some. */
function useObjectUrl(file: File | null) {
  const [url, setUrl] = useState<string | null>(null);
  useEffect(() => {
    if (!file || !file.type.startsWith('image/')) { setUrl(null); return; }
    const u = URL.createObjectURL(file);
    setUrl(u);
    return () => URL.revokeObjectURL(u);
  }, [file]);
  return url;
}

function StatusPill({ status }: { status?: DocStatus }) {
  const s = status ?? 'pending';
  if (s === 'uploading') {
    return <span className="inline-flex items-center gap-1 text-[10px] text-amber-600"><Loader2 className="w-3 h-3 animate-spin" /> enviando</span>;
  }
  if (s === 'ok') {
    return <span className="inline-flex items-center gap-1 text-[10px] text-emerald-600"><Check className="w-3 h-3" /> enviado</span>;
  }
  if (s === 'error') {
    return <span className="inline-flex items-center gap-1 text-[10px] text-destructive"><XIcon className="w-3 h-3" /> falhou</span>;
  }
  return <span className="inline-flex items-center gap-1 text-[10px] text-muted-foreground"><Clock className="w-3 h-3" /> pendente</span>;
}

function DocRow({ it, onChange, items, disabled }: { it: PendingDoc; onChange: Props['onChange']; items: PendingDoc[]; disabled?: boolean }) {
  const previewUrl = useObjectUrl(it.file);
  const isImage = it.file.type.startsWith('image/');
  const isPdf = it.file.type === 'application/pdf';
  return (
    <div className="flex items-center gap-2 p-2">
      {/* Thumbnail / ícone — evita anexar foto trocada (ex: RG-frente no slot RG-verso) */}
      <div className="w-12 h-12 rounded border bg-muted/40 flex items-center justify-center shrink-0 overflow-hidden">
        {isImage && previewUrl ? (
          <img src={previewUrl} alt={it.file.name} className="w-full h-full object-cover" />
        ) : isPdf ? (
          <FileText className="w-5 h-5 text-rose-500" />
        ) : (
          <FileCheck2 className="w-5 h-5 text-muted-foreground" />
        )}
      </div>

      <div className="flex-1 min-w-0">
        <div className="text-sm truncate">{it.file.name}</div>
        <div className="text-[11px] text-muted-foreground flex items-center gap-2">
          <span>{(it.file.size / 1024).toFixed(0)} KB</span>
          <StatusPill status={it.status} />
          {it.errorMessage && <span className="text-destructive truncate">— {it.errorMessage}</span>}
        </div>
      </div>

      <Select
        value={it.documentType}
        onValueChange={(v) => onChange(items.map((x) => (x.id === it.id ? { ...x, documentType: v } : x)))}
        disabled={disabled || it.status === 'uploading' || it.status === 'ok'}
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
      <Button
        size="icon" variant="ghost" className="h-7 w-7"
        onClick={() => onChange(items.filter((x) => x.id !== it.id))}
        disabled={disabled || it.status === 'uploading'}
      >
        <Trash2 className="w-3 h-3" />
      </Button>
    </div>
  );
}

export default function CreateOperationDocsSection({ items, onChange, disabled }: Props) {
  const [dragOver, setDragOver] = useState(false);

  const addFiles = useCallback((files: File[]) => {
    const next: PendingDoc[] = [];
    for (const f of files) {
      if (f.size > MAX_BYTES) {
        toast({ title: `${f.name}`, description: "Arquivo maior que 10 MB", variant: "destructive" });
        continue;
      }
      next.push({
        id: `${f.name}-${f.size}-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        file: f,
        documentType: "",
        status: 'pending',
      });
    }
    if (next.length) onChange([...items, ...next]);
  }, [items, onChange]);

  // Resumo do checklist no header (X de N enviados)
  const okCount = items.filter((i) => i.status === 'ok').length;
  const failCount = items.filter((i) => i.status === 'error').length;

  return (
    <section className="space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
          Documentos (opcional)
        </h3>
        {items.length > 0 && (
          <div className="text-[11px] text-muted-foreground">
            {okCount}/{items.length} enviado(s){failCount > 0 ? ` · ${failCount} falha(s)` : ''}
          </div>
        )}
      </div>

      <div
        onDragOver={(e) => { e.preventDefault(); if (!disabled) setDragOver(true); }}
        onDragLeave={() => setDragOver(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragOver(false);
          if (disabled) return;
          const dropped = Array.from(e.dataTransfer.files || []);
          if (dropped.length) addFiles(dropped);
        }}
        className={`rounded-md border-2 border-dashed p-4 text-center text-sm transition-colors ${
          dragOver ? "border-primary bg-primary/5" : "border-muted-foreground/30"
        }`}
      >
        <UploadCloud className="w-6 h-6 mx-auto mb-1 text-muted-foreground" />
        <div className="text-muted-foreground">
          Arraste arquivos aqui ou{" "}
          <label className="text-primary underline cursor-pointer">
            selecione
            <input
              type="file"
              multiple
              accept={ACCEPTED_MIME}
              disabled={disabled}
              className="hidden"
              onChange={(e) => {
                const list = Array.from(e.target.files || []);
                addFiles(list);
                e.target.value = "";
              }}
            />
          </label>
        </div>
        <div className="text-[11px] text-muted-foreground mt-1">
          PDF, JPG, PNG, WebP — até 10 MB cada. Imagens mostram pré-visualização para conferir antes de enviar.
        </div>
      </div>

      {items.length > 0 && (
        <div className="border rounded divide-y max-h-72 overflow-auto">
          {items.map((it) => (
            <DocRow key={it.id} it={it} items={items} onChange={onChange} disabled={disabled} />
          ))}
        </div>
      )}
    </section>
  );
}

/**
 * Faz upload de cada documento sequencialmente, atualizando o status individual
 * via callback `onItemUpdate` para a UI mostrar checklist (✅/⏳/❌) em tempo real.
 */
export async function uploadPendingDocs(
  operationId: string,
  items: PendingDoc[],
  invoke: typeof import("@/integrations/supabase/client").supabase.functions.invoke,
  onItemUpdate?: (id: string, patch: Partial<PendingDoc>) => void,
) {
  let ok = 0, fail = 0;
  for (const it of items) {
    if (!it.documentType) { fail++; continue; }
    onItemUpdate?.(it.id, { status: 'uploading', errorMessage: undefined });
    try {
      const b64 = await fileToBase64(it.file);
      const { data, error } = await invoke("v8-clt-api", {
        body: {
          action: "upload_document",
          operationId,
          fileBase64: b64,
          fileName: it.file.name,
          mimeType: it.file.type || "application/octet-stream",
          documentType: it.documentType,
        },
      });
      if (error || !(data as any)?.success) {
        const msg = (data as any)?.error || (error as any)?.message || "upload falhou";
        throw new Error(msg);
      }
      ok++;
      onItemUpdate?.(it.id, { status: 'ok' });
    } catch (e: any) {
      fail++;
      onItemUpdate?.(it.id, { status: 'error', errorMessage: e?.message || String(e) });
    }
  }
  return { ok, fail };
}

export function UploadProgress({ busy }: { busy: boolean }) {
  if (!busy) return null;
  return (
    <div className="text-xs text-muted-foreground flex items-center gap-1">
      <Loader2 className="w-3 h-3 animate-spin" /> Enviando documentos…
    </div>
  );
}
