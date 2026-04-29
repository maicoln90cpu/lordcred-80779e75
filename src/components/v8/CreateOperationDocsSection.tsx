import { useCallback, useState } from "react";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Trash2, UploadCloud, FileCheck2, Loader2 } from "lucide-react";
import { toast } from "@/hooks/use-toast";

/**
 * Etapa 5.1 — Anexos opcionais antes/depois de criar a proposta.
 * Drag-and-drop puro (sem dependências) reaproveitando os mesmos tipos
 * de documento aceitos pelo UploadDocumentsDialog (Etapa 6).
 */

export const DOC_TYPE_OPTIONS = [
  { id: "identification_front", label: "RG/CNH — Frente" },
  { id: "identification_back", label: "RG/CNH — Verso" },
  { id: "address_proof", label: "Comprovante de residência" },
  { id: "paycheck", label: "Holerite / contracheque" },
];

const ACCEPTED_MIME = "image/jpeg,image/png,image/webp,application/pdf";
const MAX_BYTES = 10 * 1024 * 1024;

export interface PendingDoc {
  id: string;
  file: File;
  documentType: string;
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
      });
    }
    if (next.length) onChange([...items, ...next]);
  }, [items, onChange]);

  return (
    <section className="space-y-3">
      <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
        Documentos (opcional)
      </h3>

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
          PDF, JPG, PNG, WebP — até 10 MB cada. Os documentos são enviados após a criação da proposta.
        </div>
      </div>

      {items.length > 0 && (
        <div className="border rounded divide-y max-h-48 overflow-auto">
          {items.map((it) => (
            <div key={it.id} className="flex items-center gap-2 p-2">
              <FileCheck2 className="w-4 h-4 text-muted-foreground shrink-0" />
              <div className="flex-1 min-w-0">
                <div className="text-sm truncate">{it.file.name}</div>
                <div className="text-[11px] text-muted-foreground">{(it.file.size / 1024).toFixed(0)} KB</div>
              </div>
              <Select
                value={it.documentType}
                onValueChange={(v) => onChange(items.map((x) => (x.id === it.id ? { ...x, documentType: v } : x)))}
                disabled={disabled}
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
                disabled={disabled}
              >
                <Trash2 className="w-3 h-3" />
              </Button>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}

export async function uploadPendingDocs(operationId: string, items: PendingDoc[], invoke: typeof import("@/integrations/supabase/client").supabase.functions.invoke) {
  let ok = 0, fail = 0;
  for (const it of items) {
    if (!it.documentType) { fail++; continue; }
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
      if (error || !(data as any)?.success) throw new Error((data as any)?.error || (error as any)?.message || "upload falhou");
      ok++;
    } catch {
      fail++;
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
