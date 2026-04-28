import { useState, useCallback, forwardRef } from 'react';
import { Loader2, Search } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { supabase } from '@/integrations/supabase/client';

/**
 * Dialog reutilizável "Ver status na V8".
 * Antes vivia embutido em V8NovaSimulacaoTab; agora é compartilhado com V8HistoricoTab
 * para garantir paridade de UX entre as duas telas.
 */
export function useV8StatusOnV8() {
  const [open, setOpen] = useState(false);
  const [data, setData] = useState<{
    cpf: string;
    loading: boolean;
    result: any | null;
    error: string | null;
  }>({ cpf: '', loading: false, result: null, error: null });

  const check = useCallback(async (cpf: string) => {
    setOpen(true);
    setData({ cpf, loading: true, result: null, error: null });
    try {
      const { data: resp, error } = await supabase.functions.invoke('v8-clt-api', {
        body: { action: 'check_consult_status', params: { cpf } },
      });
      if (error) throw error;
      if (!resp?.success) {
        setData({ cpf, loading: false, result: null, error: resp?.user_message || resp?.error || 'Falha ao consultar' });
        return;
      }
      setData({ cpf, loading: false, result: resp.data, error: null });
    } catch (err: any) {
      setData({ cpf, loading: false, result: null, error: err?.message || String(err) });
    }
  }, []);

  return { open, setOpen, data, check };
}

export function V8StatusOnV8Dialog({
  open,
  onOpenChange,
  data,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  data: { cpf: string; loading: boolean; result: any | null; error: string | null };
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Status da consulta na V8</DialogTitle>
          <DialogDescription>
            CPF: <span className="font-mono">{data.cpf}</span>
          </DialogDescription>
        </DialogHeader>
        {data.loading ? (
          <div className="flex items-center gap-2 text-sm text-muted-foreground py-4">
            <Loader2 className="w-4 h-4 animate-spin" /> Buscando na V8...
          </div>
        ) : data.error ? (
          <div className="text-sm text-destructive whitespace-pre-line">{data.error}</div>
        ) : data.result?.found === false ? (
          <div className="text-sm text-muted-foreground">{data.result.message}</div>
        ) : data.result?.latest ? (
          <div className="space-y-2 text-sm">
            <div><strong>Status:</strong> {data.result.latest.status ?? '—'}</div>
            <div><strong>Nome:</strong> {data.result.latest.name ?? '—'}</div>
            <div>
              <strong>Criada em:</strong>{' '}
              {data.result.latest.createdAt
                ? new Date(data.result.latest.createdAt).toLocaleString('pt-BR')
                : '—'}
            </div>
            {data.result.latest.detail && (
              <div className="text-muted-foreground">{data.result.latest.detail}</div>
            )}
          </div>
        ) : (
          <div className="text-sm text-muted-foreground">Sem dados.</div>
        )}
      </DialogContent>
    </Dialog>
  );
}

/**
 * Botão padrão "Ver status na V8" — reutilizado nas tabelas de Nova Simulação e Histórico.
 */
export function ViewV8StatusButton({ onClick }: { onClick: () => void }) {
  return (
    <Button size="sm" variant="outline" onClick={onClick}>
      <Search className="w-3 h-3 mr-1" /> Ver status na V8
    </Button>
  );
}
