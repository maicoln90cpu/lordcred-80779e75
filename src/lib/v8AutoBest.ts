/**
 * Etapa 2 (abr/2026): Modo "Auto-melhor" em Nova Simulação.
 *
 * Para cada simulação que voltou com `status='success'` (margem confirmada)
 * mas ainda sem proposta fechada (`simulate_status='not_started'|'failed'`),
 * tenta automaticamente os melhores candidatos de proposta — do maior prazo
 * + parcela mais agressiva, descendo até achar um que a V8 aceite.
 *
 * Mesma lógica do botão 🔍 "Encontrar proposta viável" (Operações), mas
 * disparada em lote, automática.
 *
 * Roda 100% no cliente (chama `simulate_only_for_consult` da edge `v8-clt-api`
 * em loop). Não exige nenhuma mudança na edge function.
 */
import { supabase } from '@/integrations/supabase/client';
import { buildProposalCandidates, type ProposalCandidate } from '@/lib/v8FindBestProposal';

export const AUTO_BEST_MAX_ATTEMPTS = 6;
const DEFAULT_CLT_INSTALLMENTS = [6, 8, 10, 12, 18, 24, 36, 46];

export interface AutoBestSimRow {
  id: string;
  cpf: string;
  consult_id: string | null;
  config_id: string | null;
  margem_valor: number | string | null;
  sim_value_min?: number | null;
  sim_value_max?: number | null;
  sim_installments_min?: number | null;
  sim_installments_max?: number | null;
}

export interface AutoBestResult {
  cpf: string;
  status: 'success' | 'no_candidates' | 'all_rejected' | 'error';
  acceptedCandidate?: ProposalCandidate;
  attempts: number;
  lastError?: string;
}

/**
 * Carrega `number_of_installments` da tabela escolhida (cache local na função).
 * Cache simples: configsCache compartilhado entre chamadas no mesmo lote.
 */
const _configCache = new Map<string, number[]>();
async function getInstallmentOptions(configId: string): Promise<number[]> {
  if (_configCache.has(configId)) return _configCache.get(configId)!;
  const { data } = await supabase
    .from('v8_configs_cache' as any)
    .select('raw_data')
    .eq('id', configId)
    .maybeSingle();
  const raw: number[] = Array.isArray((data as any)?.raw_data?.number_of_installments)
    ? (data as any).raw_data.number_of_installments.map((n: any) => Number(n)).filter((n: number) => Number.isInteger(n) && n > 0)
    : DEFAULT_CLT_INSTALLMENTS;
  _configCache.set(configId, raw);
  return raw;
}

/**
 * Roda o "Auto-melhor" para 1 CPF.
 * Estratégia: monta candidatos com `buildProposalCandidates` (já testada em
 * produção pelo botão 🔍), tenta no máximo `AUTO_BEST_MAX_ATTEMPTS` candidatos.
 * Para no primeiro `success`. Throttle de 600ms entre tentativas (mesmo do botão).
 */
export async function runAutoBestForSim(sim: AutoBestSimRow): Promise<AutoBestResult> {
  const margin = Number(sim.margem_valor);
  if (!Number.isFinite(margin) || margin <= 0) {
    return { cpf: sim.cpf, status: 'error', attempts: 0, lastError: 'Margem inválida' };
  }
  if (!sim.consult_id || !sim.config_id) {
    return { cpf: sim.cpf, status: 'error', attempts: 0, lastError: 'Sem consult_id/config_id' };
  }

  const installmentOptions = await getInstallmentOptions(sim.config_id);
  const candidates = buildProposalCandidates({
    marginValue: margin,
    installmentOptions,
    valueMin: sim.sim_value_min ?? null,
    valueMax: sim.sim_value_max ?? null,
    installmentsMin: sim.sim_installments_min ?? null,
    installmentsMax: sim.sim_installments_max ?? null,
  });

  if (candidates.length === 0) {
    // Marca o motivo no banco para o operador entender.
    try {
      await supabase.from('v8_simulations').update({
        simulate_status: 'failed',
        simulate_error_message: 'Auto-melhor: nenhuma combinação cabe nos limites V8',
        simulate_attempted_at: new Date().toISOString(),
      }).eq('id', sim.id);
    } catch { /* ignore */ }
    return { cpf: sim.cpf, status: 'no_candidates', attempts: 0 };
  }

  const list = candidates.slice(0, AUTO_BEST_MAX_ATTEMPTS);
  let lastError = '';
  for (let i = 0; i < list.length; i++) {
    const c = list[i];
    try {
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
      if (result?.success) {
        // Defesa em profundidade: garante simulate_status='success' mesmo se a edge
        // não tiver atualizado (ex: race condition, erro silencioso no update).
        try {
          await supabase.from('v8_simulations').update({
            simulate_status: 'success',
            simulate_attempted_at: new Date().toISOString(),
            simulate_error_message: null,
          }).eq('id', sim.id);
        } catch { /* ignore */ }
        return { cpf: sim.cpf, status: 'success', acceptedCandidate: c, attempts: i + 1 };
      }
      lastError = String(
        result?.title || result?.detail || result?.user_message
        || result?.error || invokeErr?.message || 'erro desconhecido',
      );
    } catch (err: any) {
      lastError = err?.message || String(err);
    }
    // Throttle entre tentativas (não estourar a V8).
    if (i < list.length - 1) await new Promise((r) => setTimeout(r, 600));
  }

  // Esgotou — grava o último motivo no banco.
  try {
    await supabase.from('v8_simulations').update({
      simulate_status: 'failed',
      simulate_error_message: `Auto-melhor: ${list.length} tentativa(s), V8 recusou todas. Último motivo: ${lastError}`,
      simulate_attempted_at: new Date().toISOString(),
    }).eq('id', sim.id);
  } catch { /* ignore */ }

  return { cpf: sim.cpf, status: 'all_rejected', attempts: list.length, lastError };
}
