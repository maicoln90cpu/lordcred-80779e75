/**
 * FindBestProposalButton — botão "🔍 Encontrar proposta viável".
 *
 * Aparece nos cards de CPF da aba Operações quando o CPF tem `status=success`
 * (margem confirmada) mas `simulate_status=failed` (proposta não fechou).
 *
 * Fluxo:
 *  1. Lê última simulação do CPF (margem, valueMin/Max, monthMin, config).
 *  2. Lê opções de parcela aceitas pela tabela (`v8_configs_cache`).
 *  3. Calcula melhor combinação valor × prazo (`findBestProposal`).
 *  4. Dispara UMA simulação real V8 (`simulate_only_for_consult`) com a combinação.
 *  5. Toast com resultado. UI atualiza via realtime.
 *
 * Não chama V8 mais de uma vez — toda a busca é local.
 */
import { useState } from 'react';
import { Search, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { findBestProposal } from '@/lib/v8FindBestProposal';

interface Props {
  cpf: string;
  onComplete?: () => void;
}

export function FindBestProposalButton({ cpf, onComplete }: Props) {
  const [busy, setBusy] = useState(false);

  async function handleClick() {
    setBusy(true);
    const toastId = toast.loading('Calculando melhor combinação valor × prazo...');
    try {
      // 1) Última simulação SUCCESS deste CPF (mesmo se simulate falhou)
      const { data: sim, error } = await supabase
        .from('v8_simulations')
        .select('id, consult_id, config_id, margem_valor, sim_value_min, sim_value_max, sim_month_min, status')
        .eq('cpf', cpf)
        .eq('status', 'success')
        .order('updated_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (error || !sim) {
        toast.error('Nenhuma consulta com sucesso encontrada para este CPF.', { id: toastId });
        return;
      }
      if (!sim.margem_valor || Number(sim.margem_valor) <= 0) {
        toast.error('Margem disponível não detectada — não é possível calcular.', { id: toastId });
        return;
      }
      if (!sim.config_id) {
        toast.error('Tabela (config) não definida nesta simulação.', { id: toastId });
        return;
      }

      // 2) Parcelas aceitas pela tabela.
      // Fallback: se a config não está no cache local (caso comum quando o
      // cache ainda não foi sincronizado ou a tabela é antiga), usa o conjunto
      // padrão CLT V8 [6, 8, 10, 12, 18, 24, 36, 46]. A V8 valida na chamada
      // real de qualquer jeito — se algum prazo não servir, ela recusa e o
      // toast informa o motivo verdadeiro.
      const DEFAULT_CLT_INSTALLMENTS = [6, 8, 10, 12, 18, 24, 36, 46];
      const { data: cfg } = await supabase
        .from('v8_configs_cache' as any)
        .select('raw_data')
        .eq('id', sim.config_id)
        .maybeSingle();

      const rawOptions: number[] = Array.isArray((cfg as any)?.raw_data?.number_of_installments)
        ? (cfg as any).raw_data.number_of_installments
        : DEFAULT_CLT_INSTALLMENTS;
      const minMonth = Number(sim.sim_month_min ?? 0);
      const installmentOptions = rawOptions
        .filter((n) => Number.isInteger(n) && n > 0 && (minMonth ? n >= minMonth : true));

      if (installmentOptions.length === 0) {
        toast.error(
          `Nenhum prazo da tabela atende ao mínimo da V8 (${minMonth}x). Margem muito baixa.`,
          { id: toastId },
        );
        return;
      }

      // 3) Calcula melhor combinação
      const best = findBestProposal({
        marginValue: Number(sim.margem_valor),
        installmentOptions,
        valueMin: sim.sim_value_min as number | null,
        valueMax: sim.sim_value_max as number | null,
      });

      if (!best) {
        toast.error('Margem insuficiente até para o menor valor da tabela.', { id: toastId });
        return;
      }

      // 4) Dispara simulação real
      toast.loading(
        `Simulando V8: ${best.installments}x · valor ~R$ ${best.estimatedDisbursedValue.toLocaleString('pt-BR')}...`,
        { id: toastId },
      );
      const { data: result, error: invokeErr } = await supabase.functions.invoke('v8-clt-api', {
        body: {
          action: 'simulate_only_for_consult',
          params: {
            simulation_id: sim.id,
            consult_id: sim.consult_id,
            config_id: sim.config_id,
            parcelas: best.installments,
            simulation_mode: 'disbursed_amount',
            simulation_value: best.estimatedDisbursedValue,
          },
        },
      });

      // Sessão expirada → backend devolve 401 Unauthorized.
      // Detecta tanto pelo erro do invoke quanto pelo body retornado.
      const errMsg = String(invokeErr?.message || result?.error || '');
      if (errMsg.includes('401') || /unauthorized/i.test(errMsg)) {
        toast.error('Sua sessão expirou. Recarregue a página (F5) e faça login de novo.', {
          id: toastId,
          duration: 8000,
        });
        return;
      }

      if (result?.success) {
        toast.success(
          `✅ Proposta encontrada em ${best.installments}x — verifique o card.`,
          { id: toastId },
        );
        onComplete?.();
      } else {
        toast.error(
          `V8 recusou: ${result?.error || invokeErr?.message || 'erro desconhecido'}. Tente valor menor manualmente.`,
          { id: toastId, duration: 6000 },
        );
      }
    } catch (err: any) {
      toast.error(`Erro: ${err?.message || String(err)}`, { id: toastId });
    } finally {
      setBusy(false);
    }
  }

  return (
    <Button
      size="sm"
      variant="outline"
      onClick={(e) => { e.stopPropagation(); handleClick(); }}
      disabled={busy}
      className="h-7 text-xs gap-1"
    >
      {busy ? <Loader2 className="w-3 h-3 animate-spin" /> : <Search className="w-3 h-3" />}
      Encontrar proposta viável
    </Button>
  );
}
