/**
 * v8-retry-cron — varre v8_simulations falhadas elegíveis a auto-retry
 * (kind ∈ {temporary_v8, analysis_pending}) e re-dispara via v8-clt-api.
 *
 * Configuração: lida de public.v8_settings (singleton).
 *  - background_retry_enabled: liga/desliga o cron
 *  - max_auto_retry_attempts: teto de tentativas por simulação
 *  - retry_min_backoff_seconds: tempo mínimo entre tentativas da MESMA simulação
 *  - retry_batch_size: máximo de simulações processadas por execução (controle de carga)
 *
 * Acionado por pg_cron a cada 1 min. Usa SERVICE_ROLE para invocar v8-clt-api.
 */
import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const RETRIABLE_KINDS = new Set(["temporary_v8", "analysis_pending"]);

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const startedAt = Date.now();
  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const supabase = createClient(supabaseUrl, serviceRoleKey);

  // Manual invocation: aceita { batch_id?, manual?: true, sub_pass? } no body
  // sub_pass: índice da sub-execução (0/1/2). Quando ausente e for chamada do cron
  // (sem batch_id), agendamos 2 sub-passes adicionais com setTimeout(20s/40s)
  // para ter efeito prático de "varredura a cada ~20s" sem violar o limite de 1 min do pg_cron.
  let manualBatchId: string | null = null;
  let manualMode = false;
  let subPass = 0;
  try {
    if (req.method === "POST") {
      const body = await req.json().catch(() => ({} as any));
      manualBatchId = body?.batch_id ?? null;
      manualMode = body?.manual === true || !!manualBatchId;
      subPass = Number(body?.sub_pass ?? 0);
    }
  } catch (_) { /* ignore */ }

  // Se for primeira passada do cron (não manual), agenda 2 sub-passes em background.
  // Resultado: cron de 1 min -> 3 varreduras a 0s/20s/40s.
  if (!manualMode && subPass === 0) {
    for (const delaySec of [20, 40]) {
      setTimeout(() => {
        fetch(`${supabaseUrl}/functions/v1/v8-retry-cron`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${serviceRoleKey}`,
          },
          body: JSON.stringify({ sub_pass: delaySec === 20 ? 1 : 2 }),
        }).catch((e) => console.error("[v8-retry-cron] sub_pass dispatch err", e));
      }, delaySec * 1000);
    }
  }

  try {
    // 1) Lê config
    const { data: settings } = await supabase
      .from("v8_settings")
      .select("max_auto_retry_attempts, retry_min_backoff_seconds, background_retry_enabled, retry_batch_size")
      .eq("singleton", true)
      .maybeSingle();

    if (!settings) {
      return ok({ skipped: true, reason: "no_settings" });
    }
    if (!settings.background_retry_enabled && !manualMode) {
      return ok({ skipped: true, reason: "disabled" });
    }

    const maxAttempts: number = Number(settings.max_auto_retry_attempts ?? 15);
    const minBackoffSec: number = Number(settings.retry_min_backoff_seconds ?? 10);
    const batchSize: number = Number(settings.retry_batch_size ?? 25);

    // 2) Busca candidatos retentáveis.
    // IMPORTANTE: incluímos 'pending' além de 'failed' porque o rate-limit da V8
    // pode chegar de forma assíncrona pelo webhook (HTTP 200 + REJECTED depois),
    // deixando a linha "presa" em pending. Sem isso, essas linhas nunca eram retentadas
    // e o attempt_count ficava congelado em 1.
    const cutoffIso = new Date(Date.now() - minBackoffSec * 1000).toISOString();
    let q = supabase
      .from("v8_simulations")
      .select("id, batch_id, cpf, name, birth_date, config_id, installments, attempt_count, raw_response, error_kind, last_attempt_at, created_by, created_at, status")
      .in("status", ["failed", "pending"])
      .or(`last_attempt_at.is.null,last_attempt_at.lte.${cutoffIso}`)
      .lt("attempt_count", maxAttempts)
      .order("last_attempt_at", { ascending: true, nullsFirst: true })
      .limit(batchSize);
    if (manualBatchId) q = q.eq("batch_id", manualBatchId);
    const { data: candidates, error: candErr } = await q;

    if (candErr) {
      console.error("[v8-retry-cron] select error", candErr);
      return ok({ error: candErr.message }, 200);
    }

    const eligible = (candidates ?? []).filter((s: any) => {
      const kind = s.error_kind || s.raw_response?.kind || s.raw_response?.error_kind || null;
      // Caso 1: kind retentável conhecido.
      if (kind && RETRIABLE_KINDS.has(kind)) return true;
      // Caso 2: linha "presa" — pending sem kind, com >2 min sem novidade.
      // Bug clássico: lote criado, V8 nem respondeu, attempt_count=0, kind=null.
      // Sem isso, a linha NUNCA seria retentada e ficava esperando webhook que não vem.
      if (s.status === "pending" && !kind) {
        const ageMs = s.last_attempt_at
          ? Date.now() - new Date(s.last_attempt_at).getTime()
          : Date.now() - new Date(s.created_at ?? Date.now()).getTime();
        return ageMs > 120_000;
      }
      return false;
    });

    if (eligible.length === 0) {
      return ok({ scanned: candidates?.length ?? 0, retried: 0, sub_pass: subPass, duration_ms: Date.now() - startedAt });
    }

    // 3) Para cada candidato, invoca v8-clt-api com triggered_by='cron'
    let okCount = 0;
    let failCount = 0;

    for (const sim of eligible) {
      try {
        const resp = await fetch(`${supabaseUrl}/functions/v1/v8-clt-api`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            // Service role autentica internamente; v8-clt-api faz auth.getUser(token) — isso falha
            // para service-role tokens, então usamos a anon key + impersonation via header customizado
            // OU chamamos o RPC interno. Simplificação: chamamos v8-clt-api com SERVICE_ROLE via Bearer
            // e o handler aceita o token (auth.getUser falha graciosamente — ver guard abaixo).
            "Authorization": `Bearer ${serviceRoleKey}`,
            "x-cron-trigger": "v8-retry-cron",
          },
          body: JSON.stringify({
            action: "simulate_one",
            params: {
              cpf: sim.cpf,
              nome: sim.name,
              data_nascimento: sim.birth_date,
              config_id: sim.config_id,
              parcelas: sim.installments,
              batch_id: sim.batch_id,
              simulation_id: sim.id,
              attempt_count: Number(sim.attempt_count ?? 0) + 1,
              triggered_by: "cron",
              cron_user_id: sim.created_by,
            },
          }),
        });
        if (resp.ok) okCount += 1;
        else failCount += 1;
      } catch (err) {
        console.error("[v8-retry-cron] invoke err", sim.id, err);
        failCount += 1;
      }
    }

    // Dispara o poller de active_consult em background — atualiza o snapshot
    // de status (REJECTED, CONSENT_APPROVED, etc.) das linhas que ficaram
    // com kind='active_consult' para a UI mostrar inline.
    fetch(`${supabaseUrl}/functions/v1/v8-active-consult-poller`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${serviceRoleKey}`,
      },
      body: JSON.stringify(manualBatchId ? { batch_id: manualBatchId } : {}),
    }).catch((e) => console.error("[v8-retry-cron] poller dispatch err", e));

    console.log(`[v8-retry-cron] sub_pass=${subPass} scanned=${candidates?.length ?? 0} eligible=${eligible.length} ok=${okCount} fail=${failCount}`);

    return ok({
      scanned: candidates?.length ?? 0,
      eligible: eligible.length,
      retried_ok: okCount,
      retried_fail: failCount,
      sub_pass: subPass,
      duration_ms: Date.now() - startedAt,
    });
  } catch (err: any) {
    console.error("[v8-retry-cron] fatal", err);
    return ok({ success: false, error: String(err?.message || err) }, 200);
  }
});

function ok(body: unknown, status = 200) {
  return new Response(JSON.stringify({ success: true, ...((body as object) ?? {}) }), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
