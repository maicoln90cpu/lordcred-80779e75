// supabase/functions/v8-auto-best-worker/index.ts
// ----------------------------------------------------------
// Onda 4 (abr/2026): Worker que processa o "Auto-melhor" em background.
// Roda via pg_cron a cada 1 minuto. Mesma lógica do `src/lib/v8AutoBest.ts`,
// portada para Deno. Permite que Auto-melhor continue rodando MESMO COM ABA FECHADA.
//
// Fluxo:
//   1) Reserva até MAX_JOBS jobs com `v8_auto_best_claim_jobs` (FOR UPDATE SKIP LOCKED).
//   2) Para cada job: monta candidatos (`buildProposalCandidates`) e chama
//      `v8-clt-api/simulate_only_for_consult` no máximo MAX_ATTEMPTS vezes.
//   3) Marca job como `done` (V8 aceitou) / `failed` (esgotou) / `skipped`
//      (sem candidatos / dados inválidos) via `v8_auto_best_finish_job`.
//
// Resiliente: se uma chamada V8 falhar, o erro vai pro `last_error` e o
// próximo cron tenta de novo (até cap externo via attempts).

import "https://deno.land/std@0.224.0/dotenv/load.ts";
import { createClient } from "npm:@supabase/supabase-js@2.57.4";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const MAX_JOBS_PER_RUN = 20;
const MAX_ATTEMPTS = 6;            // Igual ao AUTO_BEST_MAX_ATTEMPTS do client.
const THROTTLE_MS = 700;            // Entre tentativas no mesmo CPF.
const DEFAULT_CLT_INSTALLMENTS = [6, 8, 10, 12, 18, 24, 36, 46];
const DEFAULT_MONTHLY_RATE = 0.0299;
const SAFETY_FACTORS = [0.95, 0.85, 0.75, 0.65];
const MIN_DISBURSED = 300;
const MIN_INSTALLMENT = 25;

interface ProposalCandidate {
  installments: number;
  simulationMode: "installment_face_value" | "disbursed_amount";
  simulationValue: number;
}

function presentValueFromInstallment(pmt: number, rate: number, n: number): number {
  if (rate <= 0) return pmt * n;
  return (pmt * (1 - Math.pow(1 + rate, -n))) / rate;
}

function buildCandidates(input: {
  marginValue: number;
  installmentOptions: number[];
  valueMin: number | null;
  valueMax: number | null;
  installmentsMin: number | null;
  installmentsMax: number | null;
}): ProposalCandidate[] {
  const margin = Number(input.marginValue);
  if (!isFinite(margin) || margin <= 0) return [];
  const min = isFinite(Number(input.installmentsMin)) ? Number(input.installmentsMin) : 1;
  const max = isFinite(Number(input.installmentsMax)) ? Number(input.installmentsMax) : Infinity;
  const allowed = (input.installmentOptions || [])
    .filter((n) => Number.isInteger(n) && n > 0 && n >= min && n <= max)
    .sort((a, b) => b - a); // maior primeiro
  if (allowed.length === 0) return [];

  const valueMin = Math.max(MIN_DISBURSED, Number(input.valueMin ?? MIN_DISBURSED));
  const valueMax = Number(input.valueMax ?? Infinity);
  const out: ProposalCandidate[] = [];

  for (const n of allowed) {
    for (const factor of SAFETY_FACTORS) {
      const pmt = Math.max(MIN_INSTALLMENT, Number((margin * factor).toFixed(2)));
      if (pmt > margin) continue;
      const pv = presentValueFromInstallment(pmt, DEFAULT_MONTHLY_RATE, n);
      const cappedPv = Math.floor(Math.min(pv, valueMax));
      if (cappedPv < valueMin) continue;
      out.push({
        installments: n,
        simulationMode: "installment_face_value",
        simulationValue: pmt,
      });
    }
  }
  return out;
}

interface Job {
  job_id: string;
  simulation_id: string;
  batch_id: string | null;
  cpf: string;
  consult_id: string;
  config_id: string;
  margem_valor: number | string;
  sim_value_min: number | null;
  sim_value_max: number | null;
  sim_installments_min: number | null;
  sim_installments_max: number | null;
  attempts: number;
}

async function getInstallmentOptions(
  supabase: ReturnType<typeof createClient>,
  configId: string,
  cache: Map<string, number[]>,
): Promise<number[]> {
  if (cache.has(configId)) return cache.get(configId)!;
  const { data } = await supabase
    .from("v8_configs_cache")
    .select("raw_data")
    .eq("id", configId)
    .maybeSingle();
  const arr: any = (data as any)?.raw_data?.number_of_installments;
  const list: number[] = Array.isArray(arr)
    ? arr.map((n: any) => Number(n)).filter((n: number) => Number.isInteger(n) && n > 0)
    : DEFAULT_CLT_INSTALLMENTS;
  cache.set(configId, list);
  return list;
}

async function processJob(
  supabase: ReturnType<typeof createClient>,
  job: Job,
  configsCache: Map<string, number[]>,
): Promise<{ status: "done" | "failed" | "skipped"; lastError?: string; summary: any }> {
  const margin = Number(job.margem_valor);
  if (!isFinite(margin) || margin <= 0) {
    return { status: "skipped", lastError: "Margem inválida", summary: { reason: "no_margin" } };
  }
  if (!job.consult_id || !job.config_id) {
    return { status: "skipped", lastError: "Sem consult_id/config_id", summary: { reason: "no_ids" } };
  }

  const installmentOptions = await getInstallmentOptions(supabase, job.config_id, configsCache);
  const candidates = buildCandidates({
    marginValue: margin,
    installmentOptions,
    valueMin: job.sim_value_min,
    valueMax: job.sim_value_max,
    installmentsMin: job.sim_installments_min,
    installmentsMax: job.sim_installments_max,
  });

  if (candidates.length === 0) {
    // Marca a simulação para o operador entender (mesma mensagem do client).
    try {
      await supabase
        .from("v8_simulations")
        .update({
          simulate_status: "failed",
          simulate_error_message: "Auto-melhor: nenhuma combinação cabe nos limites V8",
          simulate_attempted_at: new Date().toISOString(),
        })
        .eq("id", job.simulation_id);
    } catch (_) { /* ignore */ }
    return { status: "skipped", summary: { reason: "no_candidates" } };
  }

  const list = candidates.slice(0, MAX_ATTEMPTS);
  let lastError = "";
  for (let i = 0; i < list.length; i++) {
    const c = list[i];
    try {
      const { data: result, error: invokeErr } = await supabase.functions.invoke("v8-clt-api", {
        body: {
          action: "simulate_only_for_consult",
          params: {
            simulation_id: job.simulation_id,
            consult_id: job.consult_id,
            config_id: job.config_id,
            parcelas: c.installments,
            simulation_mode: c.simulationMode,
            simulation_value: c.simulationValue,
          },
        },
      });
      if ((result as any)?.success) {
        return {
          status: "done",
          summary: {
            accepted: true,
            attempts: i + 1,
            installments: c.installments,
            simulationValue: c.simulationValue,
          },
        };
      }
      lastError = String(
        (result as any)?.title
          || (result as any)?.detail
          || (result as any)?.user_message
          || (result as any)?.error
          || invokeErr?.message
          || "erro desconhecido",
      );
    } catch (err: any) {
      lastError = err?.message || String(err);
    }
    if (i < list.length - 1) await new Promise((r) => setTimeout(r, THROTTLE_MS));
  }

  // Esgotou — grava o último motivo.
  try {
    await supabase
      .from("v8_simulations")
      .update({
        simulate_status: "failed",
        simulate_error_message:
          `Auto-melhor: ${list.length} tentativa(s), V8 recusou todas. Último motivo: ${lastError}`,
        simulate_attempted_at: new Date().toISOString(),
      })
      .eq("id", job.simulation_id);
  } catch (_) { /* ignore */ }

  return {
    status: "failed",
    lastError,
    summary: { rejected: true, attempts: list.length, lastError },
  };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: CORS });

  const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
  const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

  const startedAt = Date.now();
  const workerId = `worker-${crypto.randomUUID().slice(0, 8)}`;

  try {
    // 1) Reserva jobs.
    const { data: claimed, error: claimErr } = await supabase.rpc(
      "v8_auto_best_claim_jobs",
      { _limit: MAX_JOBS_PER_RUN, _worker_id: workerId },
    );

    if (claimErr) {
      console.error("[auto-best-worker] claim error:", claimErr);
      // Resposta resiliente (regra do projeto: 200 + success:false em erro).
      return new Response(
        JSON.stringify({ success: false, fallback: true, error: claimErr.message }),
        { status: 200, headers: { ...CORS, "Content-Type": "application/json" } },
      );
    }

    const jobs = (claimed ?? []) as unknown as Job[];
    if (jobs.length === 0) {
      return new Response(
        JSON.stringify({ success: true, processed: 0, took_ms: Date.now() - startedAt }),
        { status: 200, headers: { ...CORS, "Content-Type": "application/json" } },
      );
    }

    // 2) Processa em série (V8 throttled ~1.2s; paralelizar quebraria rate limit).
    const configsCache = new Map<string, number[]>();
    let done = 0, failed = 0, skipped = 0;

    for (const job of jobs) {
      try {
        const r = await processJob(supabase, job, configsCache);
        await supabase.rpc("v8_auto_best_finish_job", {
          _job_id: job.job_id,
          _status: r.status,
          _last_error: r.lastError ?? null,
          _result_summary: r.summary,
        });
        if (r.status === "done") done++;
        else if (r.status === "failed") failed++;
        else skipped++;
      } catch (err: any) {
        console.error("[auto-best-worker] job error", job.simulation_id, err);
        try {
          await supabase.rpc("v8_auto_best_finish_job", {
            _job_id: job.job_id,
            _status: "failed",
            _last_error: err?.message || String(err),
            _result_summary: { error: true },
          });
        } catch (_) { /* ignore */ }
        failed++;
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        worker_id: workerId,
        processed: jobs.length,
        done,
        failed,
        skipped,
        took_ms: Date.now() - startedAt,
      }),
      { status: 200, headers: { ...CORS, "Content-Type": "application/json" } },
    );
  } catch (err: any) {
    console.error("[auto-best-worker] fatal:", err);
    return new Response(
      JSON.stringify({ success: false, fallback: true, error: err?.message || String(err) }),
      { status: 200, headers: { ...CORS, "Content-Type": "application/json" } },
    );
  }
});
