/**
 * FindBestProposalButton — botão "🔍 Encontrar proposta viável".
 *
 * Aparece nos cards de CPF da aba Operações quando o CPF tem `status=success`
 * (margem confirmada) mas `simulate_status=failed` (proposta não fechou).
 *
 * Etapa 2 (abr/2026): Em vez de tentar automaticamente o "melhor candidato"
 * e cair sempre no maior prazo, agora abre um DropdownMenu com TODOS os
 * candidatos viáveis (24x, 36x, 46x...) e o operador escolhe. Mantém também
 * a opção "Tentar a melhor automática" como atalho.
 */
import { useEffect, useState } from 'react';
import { Search, Loader2, ChevronDown, Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
} from '@/components/ui/dropdown-menu';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { buildProposalCandidates, type ProposalCandidate } from '@/lib/v8FindBestProposal';

interface Props {
  cpf: string;
  onComplete?: () => void;
}

const MAX_AUTO_ATTEMPTS = 6;
const DEFAULT_CLT_INSTALLMENTS = [6, 8, 10, 12, 18, 24, 36, 46];

function formatBRL(n: number) {
  return n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

interface SimContext {
  sim: any;
  candidates: ProposalCandidate[];
}

export function FindBestProposalButton({ cpf, onComplete }: Props) {
  const [busy, setBusy] = useState(false);
  const [open, setOpen] = useState(false);
  const [ctx, setCtx] = useState<SimContext | null>(null);
  const [loadingCtx, setLoadingCtx] = useState(false);

  // Carrega candidatos quando o popover abre (lazy).
  useEffect(() => {
    if (!open || ctx || loadingCtx) return;
    void loadContext();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  async function loadContext(): Promise<SimContext | null> {
    setLoadingCtx(true);
    try {
      const { data: sim } = await supabase
        .from('v8_simulations')
        .select(
          'id, consult_id, config_id, margem_valor, sim_value_min, sim_value_max, sim_month_min, sim_month_max, sim_installments_min, sim_installments_max, status',
        )
        .eq('cpf', cpf)
        .eq('status', 'success')
        .order('updated_at', { ascending: false })
        .limit(1)
        .maybeSingle();
      if (!sim) {
        toast.error('Nenhuma consulta com sucesso encontrada para este CPF.');
        return null;
      }
      const margin = Number(sim.margem_valor);
      if (!margin || margin <= 0) {
        toast.error('Margem disponível não detectada.');
        return null;
      }
      const { data: cfg } = await supabase
        .from('v8_configs_cache' as any)
        .select('raw_data')
        .eq('id', sim.config_id)
        .maybeSingle();
      const rawOptions: number[] = Array.isArray((cfg as any)?.raw_data?.number_of_installments)
        ? (cfg as any).raw_data.number_of_installments
        : DEFAULT_CLT_INSTALLMENTS;
      const candidates = buildProposalCandidates({
        marginValue: margin,
        installmentOptions: rawOptions,
        valueMin: sim.sim_value_min as number | null,
        valueMax: sim.sim_value_max as number | null,
        installmentsMin: (sim as any).sim_installments_min as number | null,
        installmentsMax: (sim as any).sim_installments_max as number | null,
      });
      const next = { sim, candidates };
      setCtx(next);
      return next;
    } finally {
      setLoadingCtx(false);
    }
  }

  async function ensureSession(toastId: string | number) {
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
      return false;
    }
    return true;
  }

  async function trySingle(c: ProposalCandidate) {
    setBusy(true);
    setOpen(false);
    const toastId = toast.loading(
      `Simulando ${c.installments}x · parcela ${formatBRL(c.simulationValue)}...`,
    );
    try {
      const ok = await ensureSession(toastId);
      if (!ok) return;
      const context = ctx ?? (await loadContext());
      if (!context) {
        toast.error('Não foi possível carregar dados da simulação.', { id: toastId });
        return;
      }
      const { sim } = context;
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
        toast.success(`✅ Proposta encontrada em ${c.installments}x — verifique o card.`, { id: toastId });
        onComplete?.();
        return;
      }
      const msg = String(
        result?.title || result?.detail || result?.user_message || result?.error || invokeErr?.message || 'erro desconhecido',
      );
      toast.error(`V8 recusou: ${msg}`, { id: toastId, duration: 8000 });
    } catch (err: any) {
      toast.error(`Erro: ${err?.message || String(err)}`, { id: toastId });
    } finally {
      setBusy(false);
    }
  }

  async function tryBestAuto() {
    setBusy(true);
    setOpen(false);
    const toastId = toast.loading('Buscando melhor combinação automaticamente...');
    try {
      const ok = await ensureSession(toastId);
      if (!ok) return;
      const context = ctx ?? (await loadContext());
      if (!context) {
        toast.error('Sem dados de simulação.', { id: toastId });
        return;
      }
      const { sim, candidates } = context;
      const list = candidates.slice(0, MAX_AUTO_ATTEMPTS);
      if (list.length === 0) {
        toast.error('Nenhuma combinação cabe nos limites da V8.', { id: toastId });
        return;
      }
      let lastError = '';
      for (let i = 0; i < list.length; i++) {
        const c = list[i];
        toast.loading(
          `Tentativa ${i + 1}/${list.length}: ${c.installments}x · parcela ${formatBRL(c.simulationValue)}`,
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
        if (result?.success) {
          toast.success(`✅ Proposta encontrada em ${c.installments}x — verifique o card.`, { id: toastId });
          onComplete?.();
          return;
        }
        lastError = String(
          result?.title || result?.detail || result?.user_message || result?.error || invokeErr?.message || 'erro desconhecido',
        );
        await new Promise((r) => setTimeout(r, 600));
      }
      toast.error(`Nenhuma combinação aceita pela V8. Último motivo: ${lastError}`, {
        id: toastId,
        duration: 9000,
      });
    } catch (err: any) {
      toast.error(`Erro: ${err?.message || String(err)}`, { id: toastId });
    } finally {
      setBusy(false);
    }
  }

  // Lista única de prazos (mostra apenas o melhor candidato por nº de parcelas).
  const uniqueByInstallments: ProposalCandidate[] = (() => {
    if (!ctx?.candidates?.length) return [];
    const seen = new Set<number>();
    const out: ProposalCandidate[] = [];
    // candidatos já vêm ordenados (maior prazo + parcela mais agressiva primeiro)
    for (const c of ctx.candidates) {
      if (seen.has(c.installments)) continue;
      seen.add(c.installments);
      out.push(c);
    }
    return out.sort((a, b) => a.installments - b.installments);
  })();

  return (
    <DropdownMenu open={open} onOpenChange={setOpen}>
      <DropdownMenuTrigger asChild>
        <Button
          size="sm"
          variant="outline"
          disabled={busy}
          onClick={(e) => e.stopPropagation()}
          className="h-7 text-xs gap-1"
        >
          {busy ? <Loader2 className="w-3 h-3 animate-spin" /> : <Search className="w-3 h-3" />}
          Encontrar proposta viável
          <ChevronDown className="w-3 h-3 opacity-60" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-72" onClick={(e) => e.stopPropagation()}>
        <DropdownMenuLabel className="text-xs">
          Escolha um prazo para simular
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={tryBestAuto} className="gap-2">
          <Sparkles className="w-3 h-3 text-amber-500" />
          <span className="text-xs font-medium">Tentar a melhor automática</span>
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        {loadingCtx && (
          <div className="px-2 py-2 text-[11px] text-muted-foreground flex items-center gap-2">
            <Loader2 className="w-3 h-3 animate-spin" /> Calculando candidatos...
          </div>
        )}
        {!loadingCtx && uniqueByInstallments.length === 0 && ctx && (
          <div className="px-2 py-2 text-[11px] text-muted-foreground">
            Nenhuma combinação cabe nos limites da V8.
          </div>
        )}
        {uniqueByInstallments.map((c) => (
          <DropdownMenuItem
            key={`${c.installments}-${c.safetyFactor}`}
            onClick={() => trySingle(c)}
            className="flex flex-col items-start gap-0.5 py-1.5"
          >
            <div className="text-xs font-medium">
              {c.installments}x · parcela {formatBRL(c.simulationValue)}
            </div>
            <div className="text-[10px] text-muted-foreground">
              libera ~{formatBRL(c.estimatedDisbursedValue)} (estimativa)
            </div>
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
