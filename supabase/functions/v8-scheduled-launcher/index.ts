// v8-scheduled-launcher
// Etapa 3 (item 7): cron pg_cron chama a cada 1 min. Procura lotes em status='scheduled'
// cujo scheduled_for já chegou, materializa as v8_simulations e dispara as consultas.
// Idempotente: troca status='scheduled' -> 'processing' com cláusula de match
// (.eq('status', 'scheduled')) — duas execuções concorrentes nunca disparam o mesmo lote.

import { createClient } from "npm:@supabase/supabase-js@2.57.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const ok = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

function normalizeBirth(v: string | null | undefined): string | null {
  if (!v) return null;
  // já vem normalizado pelo schedule_batch — só passa adiante.
  return String(v);
}

// Etapa 3C (mai/2026) — Cache module-level de v8_settings (TTL 60s).
// Sobrevive entre invocações enquanto o worker estiver "quente".
let _settingsCache: { value: any; expiresAt: number } | null = null;
async function getCachedSettings(supabase: any): Promise<any> {
  const now = Date.now();
  if (_settingsCache && _settingsCache.expiresAt > now) return _settingsCache.value;
  const { data } = await supabase
    .from("v8_settings")
    .select("max_concurrent_batches_per_owner, consult_throttle_ms")
    .eq("singleton", true)
    .maybeSingle();
  _settingsCache = { value: data ?? {}, expiresAt: now + 60_000 };
  return _settingsCache.value;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  const startedAt = Date.now();

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  // Limites generosos: pg_cron roda a cada 1 min, melhor processar em batches pequenos
  const MAX_BATCHES_PER_RUN = 5;

  try {
    // Etapa 2 (mai/2026): paralelismo configurável por operador.
    // Lê v8_settings.max_concurrent_batches_per_owner (default 2).
    let maxConcurrent = 2;
    try {
      const { data: stg } = await supabase
        .from("v8_settings")
        .select("max_concurrent_batches_per_owner")
        .eq("singleton", true)
        .maybeSingle();
      const v = Number((stg as any)?.max_concurrent_batches_per_owner);
      if (Number.isFinite(v) && v >= 1 && v <= 3) maxConcurrent = v;
    } catch (_) { /* mantém default */ }

    // 0) Etapa 4 (item 10): promove lotes da fila (queued) quando o operador
    //    tem menos de `maxConcurrent` lotes ativos.
    const { data: queuedHeads } = await supabase
      .from("v8_batches")
      .select("id, queue_owner, queue_position, name")
      .eq("status", "queued")
      .order("queue_position", { ascending: true });

    const ownerPromoted = new Map<string, number>(); // promoções nesta execução
    for (const q of (queuedHeads ?? []) as any[]) {
      const owner = q.queue_owner as string;
      if (!owner) continue;

      // Verifica se o dono já tem lotes ATIVOS (não zumbis).
      const activityCutoff = new Date(Date.now() - 10 * 60 * 1000).toISOString();
      const { data: activeRows } = await supabase
        .from("v8_batches")
        .select("id, status, updated_at, name")
        .eq("created_by", owner)
        .in("status", ["processing", "scheduled"])
        .gte("updated_at", activityCutoff);

      const activeCount = (activeRows?.length ?? 0) + (ownerPromoted.get(owner) ?? 0);
      if (activeCount >= maxConcurrent) {
        const blocker = activeRows?.[0] as any;
        console.log(`[v8-scheduled-launcher] queue blocked owner=${owner} active=${activeCount}/${maxConcurrent} blocker=${blocker?.id} name="${blocker?.name}"`);
        continue;
      }

      // Promove para 'scheduled' com scheduled_for=now() — vai cair no select abaixo.
      const promoteIso = new Date().toISOString();
      const { error: promErr } = await supabase
        .from("v8_batches")
        .update({
          status: "scheduled",
          scheduled_for: promoteIso,
          queue_position: null,
          updated_at: promoteIso,
        })
        .eq("id", q.id)
        .eq("status", "queued"); // lock otimista
      if (promErr) console.warn("[v8-scheduled-launcher] promote fail", q.id, promErr.message);
      else ownerPromoted.set(owner, (ownerPromoted.get(owner) ?? 0) + 1);
    }

    // 1) Encontra lotes prontos para começar.
    const nowIso = new Date().toISOString();
    const { data: ready, error: selErr } = await supabase
      .from("v8_batches")
      .select("id, name, config_id, config_name, installments, scheduled_for, scheduled_strategy, scheduled_payload, created_by, is_paused")
      .eq("status", "scheduled")
      .eq("is_paused", false)
      .lte("scheduled_for", nowIso)
      .order("scheduled_for", { ascending: true })
      .limit(MAX_BATCHES_PER_RUN);

    if (selErr) {
      console.error("[v8-scheduled-launcher] select error", selErr);
      return ok({ success: false, error: selErr.message });
    }

    if (!ready || ready.length === 0) {
      return ok({ success: true, launched: 0, duration_ms: Date.now() - startedAt });
    }

    let launchedCount = 0;
    const perBatch: Array<Record<string, unknown>> = [];

    for (const batch of ready) {
      const batchId = batch.id as string;
      // 2) Lock otimista: troca status só se ainda for 'scheduled'.
      const { data: locked, error: lockErr } = await supabase
        .from("v8_batches")
        .update({ status: "processing", updated_at: nowIso })
        .eq("id", batchId)
        .eq("status", "scheduled")
        .select("id")
        .maybeSingle();

      if (lockErr || !locked) {
        perBatch.push({ batch_id: batchId, skipped: true, reason: "lock_failed_or_taken" });
        continue;
      }

      try {
        const payload = (batch.scheduled_payload || {}) as any;
        const rows: Array<{ cpf: string; nome: string | null; data_nascimento: string | null; genero: string | null; telefone: string | null }> =
          Array.isArray(payload.rows) ? payload.rows : [];

        // 3) Materializa as simulações (mesmo formato do create_batch).
        const sims = rows.map((r, idx) => ({
          batch_id: batchId,
          created_by: batch.created_by,
          cpf: (r.cpf || "").replace(/\D/g, ""),
          name: r.nome ?? null,
          birth_date: normalizeBirth(r.data_nascimento),
          status: "pending",
          error_kind: "analysis_pending",
          config_id: batch.config_id,
          config_name: batch.config_name,
          installments: batch.installments,
          paste_order: idx,
        }));

        if (sims.length === 0) {
          await supabase.from("v8_batches").update({
            status: "failed", updated_at: new Date().toISOString(),
          }).eq("id", batchId);
          perBatch.push({ batch_id: batchId, error: "no_rows_in_schedule" });
          continue;
        }

        const { error: insErr } = await supabase.from("v8_simulations").insert(sims);
        if (insErr) {
          // Tenta reverter para scheduled? Não: deixa em processing para retry manual.
          perBatch.push({ batch_id: batchId, error: "insert_sims_failed: " + insErr.message });
          continue;
        }

        // 4) Dispara as consultas via v8-clt-api (action=simulate_consult_only),
        // throttled — mesma lógica do front no fluxo webhook_only.
        const { data: insertedSims } = await supabase
          .from("v8_simulations")
          .select("id, cpf, name, birth_date")
          .eq("batch_id", batchId)
          .order("paste_order", { ascending: true });

        const projectUrl = Deno.env.get("SUPABASE_URL")!;
        const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
        const cltUrl = `${projectUrl}/functions/v1/v8-clt-api`;
        const throttleMs = 1200;

        let dispatched = 0;
        let dispatchFailed = 0;
        for (let i = 0; i < (insertedSims ?? []).length; i++) {
          const sim = (insertedSims ?? [])[i] as any;
          const parsedRow = rows.find((r) => r.cpf === sim.cpf);

          // Etapa 4 (b): heartbeat ANTES do POST — grava attempt_count++ e last_attempt_at.
          // Assim o watchdog consegue distinguir "nunca disparou" (attempt_count=0) de
          // "disparou e está aguardando webhook" (attempt_count>=1, last_attempt_at recente).
          await supabase
            .from("v8_simulations")
            .update({
              attempt_count: 1,
              last_attempt_at: new Date().toISOString(),
              last_step: "dispatch_started",
            })
            .eq("id", sim.id);

          let dispatchOk = false;
          try {
            const resp = await fetch(cltUrl, {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${serviceKey}`,
                "x-cron-trigger": "v8-scheduled-launcher",
              },
              body: JSON.stringify({
                action: "simulate_consult_only",
                params: {
                  cpf: sim.cpf,
                  nome: sim.name,
                  data_nascimento: sim.birth_date,
                  genero: parsedRow?.genero ?? null,
                  telefone: parsedRow?.telefone ?? null,
                  config_id: batch.config_id,
                  parcelas: batch.installments,
                  batch_id: batchId,
                  simulation_id: sim.id,
                  attempt_count: 1,
                  triggered_by: "schedule",
                },
              }),
            });
            dispatchOk = resp.ok;
            if (resp.ok) dispatched += 1;
            else {
              const txt = await resp.text().catch(() => "");
              console.warn("[v8-scheduled-launcher] dispatch http_fail", sim.cpf, resp.status, txt.slice(0, 200));
            }
          } catch (err) {
            console.warn("[v8-scheduled-launcher] dispatch fail", sim.cpf, err);
          }

          // Etapa 4 (a): se o dispatch HTTP falhou, marca a linha como failed
          // imediatamente. Sem isso ficava pending eterno e o lote "concluía" zumbi.
          if (!dispatchOk) {
            dispatchFailed += 1;
            await supabase
              .from("v8_simulations")
              .update({
                status: "failed",
                error_kind: "dispatch_failed",
                error_message: "Falha ao disparar a consulta para a V8 (timeout/erro de rede no launcher).",
                last_step: "dispatch_failed",
                processed_at: new Date().toISOString(),
              })
              .eq("id", sim.id);
            await supabase.rpc("v8_increment_batch_failure", { _batch_id: batchId });
          }

          if (i < (insertedSims?.length ?? 0) - 1) {
            await new Promise((r) => setTimeout(r, throttleMs));
          }
        }

        launchedCount += 1;
        perBatch.push({ batch_id: batchId, dispatched, dispatch_failed: dispatchFailed, total: sims.length });
      } catch (e: any) {
        console.error("[v8-scheduled-launcher] batch error", batchId, e);
        perBatch.push({ batch_id: batchId, error: String(e?.message || e) });
      }
    }

    return ok({
      success: true,
      launched: launchedCount,
      scanned: ready.length,
      details: perBatch,
      duration_ms: Date.now() - startedAt,
    });
  } catch (e: any) {
    console.error("[v8-scheduled-launcher] fatal", e);
    return ok({ success: false, fallback: true, error: String(e?.message || e) });
  }
});
