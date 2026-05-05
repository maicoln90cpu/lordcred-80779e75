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
    // 0) Etapa 4 (item 10): promove lotes da fila (queued) quando o operador
    //    não tem nenhum lote ativo (processing ou scheduled prestes a rodar).
    //    Só promove o de menor queue_position por dono.
    const { data: queuedHeads } = await supabase
      .from("v8_batches")
      .select("id, queue_owner, queue_position, name")
      .eq("status", "queued")
      .order("queue_position", { ascending: true });

    const ownersSeen = new Set<string>();
    for (const q of (queuedHeads ?? []) as any[]) {
      const owner = q.queue_owner as string;
      if (!owner || ownersSeen.has(owner)) continue;
      ownersSeen.add(owner);

      // Verifica se o dono já tem outro lote ATIVO (não zumbi).
      // IMPORTANTE: ignora lotes parados há > 10 min — eles são zumbis e não devem
      // bloquear a fila. Watchdog separado (orphan-reconciler) os fecha.
      const activityCutoff = new Date(Date.now() - 10 * 60 * 1000).toISOString();
      const { data: activeRows } = await supabase
        .from("v8_batches")
        .select("id, status, updated_at, name")
        .eq("created_by", owner)
        .in("status", ["processing", "scheduled"])
        .gte("updated_at", activityCutoff)
        .limit(1);

      if (activeRows && activeRows.length > 0) {
        const blocker = activeRows[0] as any;
        console.log(`[v8-scheduled-launcher] queue blocked owner=${owner} by batch=${blocker.id} name="${blocker.name}" status=${blocker.status} updated=${blocker.updated_at}`);
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
        for (let i = 0; i < (insertedSims ?? []).length; i++) {
          const sim = (insertedSims ?? [])[i] as any;
          const parsedRow = rows.find((r) => r.cpf === sim.cpf);
          try {
            await fetch(cltUrl, {
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
            dispatched += 1;
          } catch (err) {
            console.warn("[v8-scheduled-launcher] dispatch fail", sim.cpf, err);
          }
          if (i < (insertedSims?.length ?? 0) - 1) {
            await new Promise((r) => setTimeout(r, throttleMs));
          }
        }

        launchedCount += 1;
        perBatch.push({ batch_id: batchId, dispatched, total: sims.length });
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
