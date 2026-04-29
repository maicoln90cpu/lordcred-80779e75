/**
 * V8LimitsBadge — mini-painel exibido ao lado do botão "Encontrar proposta viável".
 *
 * Mostra para o operador, antes de clicar:
 *  - Faixa de parcelas oficial da V8 para este CPF (sim_installments_min/max)
 *  - Faixa de valor liberado oficial (sim_value_min/max)
 *  - Margem disponível (margem_valor)
 *
 * Etapa 5 — usa React Query com staleTime 60s e cacheTime 5min para evitar
 * refetch redundante quando a mesma linha de CPF aparece em várias listas/abas.
 */
import { Loader2 } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';

interface Props {
  cpf: string;
}

interface Limits {
  installmentsMin: number | null;
  installmentsMax: number | null;
  valueMin: number | null;
  valueMax: number | null;
  margin: number | null;
}

function fmtBRL(n: number | null) {
  if (n == null || !Number.isFinite(n)) return '—';
  return n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

async function fetchLimits(cpf: string): Promise<Limits | null> {
  const { data } = await supabase
    .from('v8_simulations')
    .select('margem_valor, sim_value_min, sim_value_max, sim_installments_min, sim_installments_max')
    .eq('cpf', cpf)
    .eq('status', 'success')
    .order('updated_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  if (!data) return null;
  return {
    installmentsMin: (data as any).sim_installments_min ?? null,
    installmentsMax: (data as any).sim_installments_max ?? null,
    valueMin: (data as any).sim_value_min ?? null,
    valueMax: (data as any).sim_value_max ?? null,
    margin: data.margem_valor != null ? Number(data.margem_valor) : null,
  };
}

export function V8LimitsBadge({ cpf }: Props) {
  const { data: limits, isLoading } = useQuery({
    queryKey: ['v8-limits', cpf],
    queryFn: () => fetchLimits(cpf),
    enabled: !!cpf,
    staleTime: 60_000,         // 60s — evita refetch dentro do mesmo trabalho do operador
    gcTime: 5 * 60_000,        // 5min em cache antes de garbage collect
    refetchOnWindowFocus: false,
  });

  if (isLoading) {
    return (
      <span className="inline-flex items-center gap-1 text-[11px] text-muted-foreground">
        <Loader2 className="w-3 h-3 animate-spin" /> lendo limites V8…
      </span>
    );
  }
  if (!limits) return null;

  const parcelaTxt =
    limits.installmentsMin && limits.installmentsMax
      ? `${limits.installmentsMin}–${limits.installmentsMax}x`
      : limits.installmentsMax
        ? `até ${limits.installmentsMax}x`
        : '—';
  const valorTxt =
    limits.valueMin && limits.valueMax
      ? `${fmtBRL(limits.valueMin)}–${fmtBRL(limits.valueMax)}`
      : limits.valueMax
        ? `até ${fmtBRL(limits.valueMax)}`
        : '—';

  return (
    <TooltipProvider delayDuration={150}>
      <div className="flex items-center gap-1.5 flex-wrap text-[11px]">
        <Tooltip>
          <TooltipTrigger asChild>
            <span className="rounded border border-emerald-500/30 bg-emerald-500/5 px-1.5 py-0.5 cursor-help">
              <span className="text-muted-foreground mr-1">Parcelas:</span>
              <span className="font-semibold">{parcelaTxt}</span>
            </span>
          </TooltipTrigger>
          <TooltipContent className="max-w-[240px] text-xs">
            Limite oficial de parcelas que a V8 aceita para este CPF nesta tabela.
          </TooltipContent>
        </Tooltip>
        <Tooltip>
          <TooltipTrigger asChild>
            <span className="rounded border border-emerald-500/30 bg-emerald-500/5 px-1.5 py-0.5 cursor-help">
              <span className="text-muted-foreground mr-1">Valor:</span>
              <span className="font-semibold">{valorTxt}</span>
            </span>
          </TooltipTrigger>
          <TooltipContent className="max-w-[240px] text-xs">
            Faixa de valor liberado que a V8 aceita para este CPF nesta tabela.
          </TooltipContent>
        </Tooltip>
        <Tooltip>
          <TooltipTrigger asChild>
            <span className="rounded border border-emerald-500/30 bg-emerald-500/5 px-1.5 py-0.5 cursor-help">
              <span className="text-muted-foreground mr-1">Margem:</span>
              <span className="font-semibold">{fmtBRL(limits.margin)}</span>
            </span>
          </TooltipTrigger>
          <TooltipContent className="max-w-[240px] text-xs">
            Margem consignável disponível do trabalhador (availableMarginValue) — teto da parcela.
          </TooltipContent>
        </Tooltip>
      </div>
    </TooltipProvider>
  );
}
