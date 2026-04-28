import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Loader2, Copy, Check } from 'lucide-react';
import { toast } from 'sonner';

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** 'simulation' | 'webhook' | 'operation' */
  kind: 'simulation' | 'webhook' | 'operation';
  /** id da linha (PK) */
  rowId: string;
  title?: string;
}

/**
 * Carrega o JSON cru sob demanda (lazy) — não pesa na timeline.
 */
export default function V8RawJsonSheet({ open, onOpenChange, kind, rowId, title }: Props) {
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState<any>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!open) return;
    let alive = true;
    (async () => {
      setLoading(true);
      try {
        let res: any = null;
        if (kind === 'simulation') {
          const { data: r } = await supabase
            .from('v8_simulations')
            .select('raw_response, error_message, status, simulate_status')
            .eq('id', rowId)
            .maybeSingle();
          res = r;
        } else if (kind === 'webhook') {
          const { data: r } = await supabase
            .from('v8_webhook_logs')
            .select('payload, headers, status, event_type, process_error')
            .eq('id', rowId)
            .maybeSingle();
          res = r;
        } else {
          const { data: r } = await supabase
            .from('v8_operations_local')
            .select('raw_payload, status, operation_id, consult_id')
            .eq('id', rowId)
            .maybeSingle();
          res = r;
        }
        if (alive) setData(res ?? { _empty: true });
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => { alive = false; };
  }, [open, kind, rowId]);

  const json = JSON.stringify(data ?? {}, null, 2);

  function copy() {
    navigator.clipboard.writeText(json);
    setCopied(true);
    toast.success('JSON copiado');
    setTimeout(() => setCopied(false), 1500);
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full sm:max-w-2xl overflow-y-auto">
        <SheetHeader>
          <SheetTitle>JSON cru — {title || kind}</SheetTitle>
          <SheetDescription>
            Conteúdo bruto registrado para diagnóstico. Útil para suporte cruzar com a V8.
          </SheetDescription>
        </SheetHeader>
        <div className="mt-4 flex justify-end">
          <Button variant="outline" size="sm" onClick={copy} disabled={loading || !data}>
            {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
            <span className="ml-2">{copied ? 'Copiado' : 'Copiar JSON'}</span>
          </Button>
        </div>
        <div className="mt-3">
          {loading ? (
            <div className="py-12 flex justify-center">
              <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
            </div>
          ) : (
            <pre className="text-xs bg-muted/40 border rounded-lg p-3 overflow-x-auto whitespace-pre-wrap break-all max-h-[70vh]">
              {json}
            </pre>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}
