// Reconciler de órfãos V8: cruza webhooks órfãos (sem simulation_id local)
// com simulações pending por CPF e promove os dados quando match.
// Chamado por pg_cron a cada 2 min.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { applyConsultExtras, extractConsultExtras, mapV8ConsultStatus } from "../_shared/v8Status.ts";
import { writeAuditLog } from "../_shared/auditLog.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

function onlyDigits(s: string | null | undefined): string {
  return (s || "").replace(/\D+/g, "");
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const admin = createClient(SUPABASE_URL, SERVICE_ROLE);
  const startedAt = Date.now();
  let scanned = 0;
  let matched = 0;
  let promoted = 0;
  let zombiesClosed = 0;

  try {
    // 1. Pega últimos webhooks órfãos (sem simulation_id) com CPF preenchido.
    const { data: orphans } = await admin
      .from("v8_webhook_logs")
      .select("id, payload, received_at, cpf, processed")
      .is("simulation_id", null)
      .not("cpf", "is", null)
      .gte("received_at", new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString())
      .order("received_at", { ascending: false })
      .limit(500);

    scanned = orphans?.length ?? 0;

    for (const orph of orphans ?? []) {
      const cpf = onlyDigits(orph.cpf as string);
      if (cpf.length !== 11) continue;

      // 2. Procura simulação pending para esse CPF (mais recente).
      const { data: sim } = await admin
        .from("v8_simulations")
        .select("id, status, raw_response, batch_id")
        .eq("cpf", cpf)
        .in("status", ["pending"])
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (!sim) continue;
      matched += 1;

      const payload = (orph.payload ?? {}) as any;
      const v8Status = payload?.status || payload?.data?.status;
      const internal = mapV8ConsultStatus(v8Status);
      if (!internal) continue;

      const extras = extractConsultExtras(payload);
      const updates: Record<string, unknown> = {
        status: internal,
        webhook_status: v8Status,
        last_attempt_at: new Date().toISOString(),
        raw_response: { ...(sim.raw_response as any || {}), reconciled_from_orphan: orph.id, payload },
      };
      applyConsultExtras(updates, extras);

      // Promove valueMax/installmentsMax para colunas display quando SUCCESS.
      if (internal === "success") {
        if (extras.simValueMax != null && updates.released_value == null) {
          updates.released_value = extras.simValueMax;
        }
        if (extras.simInstallmentsMax != null && updates.installments == null) {
          updates.installments = extras.simInstallmentsMax;
        }
        updates.simulate_status = "not_started";
      }

      const { error: upErr } = await admin
        .from("v8_simulations")
        .update(updates)
        .eq("id", sim.id);

      if (!upErr) {
        promoted += 1;
        await admin
          .from("v8_webhook_logs")
          .update({ processed: true, simulation_id: sim.id })
          .eq("id", orph.id);
      }
    }

    await writeAuditLog(admin, {
      action: "v8_orphan_reconciler_run",
      category: "simulator",
      success: true,
      details: { scanned, matched, promoted, duration_ms: Date.now() - startedAt },
    });

    return new Response(
      JSON.stringify({ success: true, scanned, matched, promoted, duration_ms: Date.now() - startedAt }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (err) {
    console.error("[v8-orphan-reconciler] erro:", err);
    await writeAuditLog(admin, {
      action: "v8_orphan_reconciler_error",
      category: "simulator",
      success: false,
      details: { error: (err as Error).message, scanned, matched, promoted },
    });
    return new Response(
      JSON.stringify({ success: false, fallback: true, error: (err as Error).message, scanned, matched, promoted }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
