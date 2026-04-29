/**
 * FindBestProposalButton — botão "🔍 Encontrar proposta viável".
 *
 * Aparece nos cards de CPF da aba Operações quando o CPF tem `status=success`
 * (margem confirmada) mas `simulate_status=failed` (proposta não fechou).
 *
 * Fluxo (revisado abr/2026):
 *  1. Lê última simulação do CPF (margem, limites oficiais V8, config).
 *  2. Lê opções de parcela aceitas pela tabela (`v8_configs_cache`) com
 *     fallback para o conjunto padrão CLT.
 *  3. Filtra por `sim_installments_min/max` (limites do CPF) e gera candidatos
 *     ordenados (`buildProposalCandidates`).
 *  4. Tenta cada candidato sequencialmente em `simulate_only_for_consult`
 *     usando modo `installment_face_value` (parcela segura). Para no primeiro
 *     que a V8 aceitar — máximo de 6 tentativas.
 *  5. Toast informativo a cada tentativa. Atualização do card via realtime.
 */
import { useState } from 'react';
import { Search, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { buildProposalCandidates } from '@/lib/v8FindBestProposal';

interface Props {
  cpf: string;
  onComplete?: () => void;
}

const MAX_ATTEMPTS = 6;
const DEFAULT_CLT_INSTALLMENTS = [6, 8, 10, 12, 18, 24, 36, 46];

function formatBRL(n: number) {
  return n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

export function FindBestProposalButton({ cpf, onComplete }: Props) {
  const [busy, setBusy] = useState(false);

  async function handleClick() {
    setBusy(true);
    const toastId = toast.loading('Calculando combinações viáveis...');
    try {
      // 1) Última simulação SUCCESS deste CPF
      const { data: sim, error } = await supabase
        .from('v8_simulations')
        .select(
          'id, consult_id, config_id, margem_valor, sim_value_min, sim_value_max, sim_month_min, sim_month_max, sim_installments_min, sim_installments_max, status',
        )
        .eq('cpf', cpf)
        .eq('status', 'success')
        .order('updated_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (error || !sim) {
        toast.error('Nenhuma consulta com sucesso encontrada para este CPF.', { id: toastId });
        return;
      }
      const margin = Number(sim.margem_valor);
      if (!margin || margin <= 0) {
        toast.error('Margem disponível não detectada — não é possível calcular.', { id: toastId });
        return;
      }
      if (!sim.config_id) {
        toast.error('Tabela (config) não definida nesta simulação.', { id: toastId });
        return;
      }

      // 2) Parcelas da tabela (fallback se cache vazio)
      const { data: cfg } = await supabase
        .from('v8_configs_cache' as any)
        .select('raw_data')
        .eq('id', sim.config_id)
        .maybeSingle();
      const rawOptions: number[] = Array.isArray((cfg as any)?.raw_data?.number_of_installments)
        ? (cfg as any).raw_data.number_of_installments
        : DEFAULT_CLT_INSTALLMENTS;

      // 3) Gera candidatos respeitando limites oficiais da V8 (do CPF).
      const candidates = buildProposalCandidates({
        marginValue: margin,
        installmentOptions: rawOptions,
        valueMin: sim.sim_value_min as number | null,
        valueMax: sim.sim_value_max as number | null,
        installmentsMin: (sim as any).sim_installments_min as number | null,
        installmentsMax: (sim as any).sim_installments_max as number | null,
      }).slice(0, MAX_ATTEMPTS);

      if (candidates.length === 0) {
        toast.error(
          'Nenhuma combinação cabe nos limites da V8 (parcelas/valor/margem).',
          { id: toastId },
        );
        return;
      }

      // 4) Garante sessão válida (refresh se necessário)
      const { data: sessionData } = await supabase.auth.getSession();
      let accessToken = sessionData?.session?.access_token ?? null;
      if (accessToken) {
        const { error: userErr } = await supabase.auth.getUser(accessToken);
        if (userErr) {
          const { data: refreshed, error: refreshErr } = await supabase.auth.refreshSession();
          accessToken = refreshErr ? null : refreshed?.session?.access_token ?? null;
        }
      }
      if (!accessToken) {
        toast.error('Sua sessão expirou. Faça login novamente.', {
          id: toastId,
          duration: 8000,
          action: { label: 'Recarregar', onClick: () => window.location.reload() },
        });
        return;
      }

      // 5) Tenta candidatos em sequência. Para no primeiro que a V8 aceitar.
      let lastError = '';
      for (let i = 0; i < candidates.length; i++) {
        const c = candidates[i];
        toast.loading(
          `Tentativa ${i + 1}/${candidates.length}: ${c.installments}x · parcela ${formatBRL(c.simulationValue)}`,
          { id: toastId },
        );

        const { data: result, error: invokeErr } = await supabase.functions.invoke('v8-clt-api', {
          body: {
            action: 'simulate_only_for_consult',
            params: {
              simulation_id: sim.id,
              consult_id: sim.consult_id,
              config_id: sim.config_id,
              parcelas: c.installments,
              simulation_mode: c.simulationMode,
              simulation_value: c.simulationValue,
            },
          },
        });

        const errMsg = String(invokeErr?.message || result?.error || '');
        if (errMsg.includes('401') || /unauthorized/i.test(errMsg)) {
          await supabase.auth.refreshSession();
          toast.error('Sessão renovada. Clique novamente em "Encontrar proposta viável".', {
            id: toastId,
            duration: 6000,
          });
          return;
        }

        if (result?.success) {
          toast.success(
            `✅ Proposta encontrada em ${c.installments}x — verifique o card.`,
            { id: toastId },
          );
          onComplete?.();
          return;
        }

        // Erro retornado pela V8 — guarda e tenta próximo candidato
        lastError = String(
          result?.title ||
            result?.detail ||
            result?.user_message ||
            result?.error ||
            invokeErr?.message ||
            'erro desconhecido',
        );
        // Pequena pausa entre tentativas para evitar rate limit
        await new Promise((r) => setTimeout(r, 600));
      }

      toast.error(
        `Não foi possível encontrar proposta automática. Último motivo da V8: ${lastError}. Tente manualmente com parcela menor.`,
        { id: toastId, duration: 9000 },
      );
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
