import { useState } from 'react';
import { Loader2, Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { extractAvailableMargin, formatMarginBRL } from '@/lib/v8MarginExtractor';

interface ReuseMarginButtonProps {
  simulationId: string;
  /** raw_response da simulação atual — precisa ter v8_status_snapshot.latest válido */
  rawResponse: any;
}

/**
 * Botão "Aproveitar margem (R$ X)" — aparece em linhas com kind=active_consult
 * quando a consulta antiga retornada pela V8 está com status SUCCESS e tem
 * `availableMarginValue` extraível.
 *
 * O clique:
 *  1. Substitui `raw_response` pelo `v8_status_snapshot.latest` (consulta antiga válida);
 *  2. Preenche `margem_valor`;
 *  3. Zera `error_kind` e `error_message`;
 *  4. Marca `status='success'`;
 *  5. Registra audit_log `v8_consult_reused`.
 *
 * Sem chamada à V8 — operação 100% local. Zero rate-limit.
 */
export function ReuseMarginButton({ simulationId, rawResponse }: ReuseMarginButtonProps) {
  const [busy, setBusy] = useState(false);

  const latest = rawResponse?.v8_status_snapshot?.latest ?? null;
  const margin = latest ? extractAvailableMargin(latest) : null;

  // Não renderiza se não há margem extraível ou status diferente de SUCCESS
  if (!latest || latest.status !== 'SUCCESS' || margin == null || margin <= 0) {
    return null;
  }

  const handleClick = async () => {
    setBusy(true);
    try {
      // Mantém o v8_status_snapshot original dentro do novo raw_response para
      // rastreabilidade — mas promove o `latest` para topo, simulando uma resposta
      // de sucesso comum.
      const newRaw = {
        ...latest,
        availableMarginValue: margin,
        v8_status_snapshot_origin: rawResponse?.v8_status_snapshot ?? null,
        reused_from_active_consult: true,
        reused_at: new Date().toISOString(),
      };

      const { error: updateErr } = await supabase
        .from('v8_simulations')
        .update({
          status: 'success',
          error_kind: null,
          error_message: null,
          margem_valor: margin,
          raw_response: newRaw,
        })
        .eq('id', simulationId);

      if (updateErr) throw updateErr;

      // Audit (best-effort — não bloqueia se falhar)
      const { data: userData } = await supabase.auth.getUser();
      await supabase.from('audit_logs').insert({
        user_id: userData?.user?.id ?? null,
        user_email: userData?.user?.email ?? null,
        action: 'v8_consult_reused',
        target_table: 'v8_simulations',
        target_id: simulationId,
        details: {
          category: 'simulator',
          success: true,
          margin,
          consult_id: latest?.id ?? latest?.consult_id ?? null,
          source: 'reuse_margin_button',
        },
      });

      toast.success(`Margem aproveitada — ${formatMarginBRL(margin)} já disponível para esta simulação.`);
    } catch (err: any) {
      toast.error(`Não foi possível aproveitar a margem: ${err?.message || String(err)}`);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Button
      type="button"
      size="sm"
      variant="outline"
      className="h-6 px-2 text-[10px] border-emerald-500/40 text-emerald-700 hover:bg-emerald-500/10"
      onClick={handleClick}
      disabled={busy}
      title="Aproveita a margem da consulta antiga (sem nova chamada à V8)"
    >
      {busy ? (
        <Loader2 className="w-3 h-3 mr-1 animate-spin" />
      ) : (
        <Sparkles className="w-3 h-3 mr-1" />
      )}
      Aproveitar margem ({formatMarginBRL(margin)})
    </Button>
  );
}
