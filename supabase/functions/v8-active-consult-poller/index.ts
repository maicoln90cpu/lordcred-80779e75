/**
 * v8-active-consult-poller
 *
 * Para cada simulação V8 que ficou com error_kind='active_consult' ("já existe
 * consulta ativa para este CPF"), busca na V8 o status atual da consulta e grava
 * em raw_response.v8_status_snapshot + v8_status_snapshot_at.
 *
 * Assim o frontend mostra REJECTED / CONSENT_APPROVED + nome + motivo INLINE
 * na coluna Motivo, sem o usuário precisar abrir o modal "Ver status na V8".
 *
 * Acionado por pg_cron a cada 1 min. Reusa a action 'check_consult_status' da
 * v8-clt-api via fetch interno com SERVICE_ROLE.
 */
import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Não revisita snapshots recentes (economia de chamadas à V8).
const REFRESH_AFTER_SECONDS = 120;
const BATCH_LIMIT = 200;

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const startedAt = Date.now();
  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const supabase = createClient(supabaseUrl, serviceRoleKey);

  // Aceita { batch_id?, simulation_id?, sub_pass?, manual? } para chamadas focadas.
  let batchId: string | null = null;
  let simulationId: string | null = null;
  let subPass = 0;
  let manualMode = false;
  try {
    if (req.method === "POST") {
      const body = await req.json().catch(() => ({} as any));
      batchId = body?.batch_id ?? null;
      simulationId = body?.simulation_id ?? null;
      subPass = Number(body?.sub_pass ?? 0) || 0;
      manualMode = !!body?.manual;
    }
  } catch (_) { /* ignore */ }

  // Workaround para o limite de 1 min do pg_cron: agenda 2 sub-passadas extras
  // a 20s e 40s para efetivar uma cadência de ~20s (igual ao retry-cron).
  if (!manualMode && !simulationId && subPass === 0) {
    for (const delaySec of [20, 40]) {
      try {
        // @ts-ignore EdgeRuntime is available in Supabase Edge Runtime
        EdgeRuntime.waitUntil((async () => {
          await new Promise((r) => setTimeout(r, delaySec * 1000));
          await fetch(`${supabaseUrl}/functions/v1/v8-active-consult-poller`, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "Authorization": `Bearer ${serviceRoleKey}`,
            },
            body: JSON.stringify({ sub_pass: delaySec === 20 ? 1 : 2 }),
          }).catch(() => {});
        })());
      } catch (_) { /* EdgeRuntime indisponível em dev: ignora */ }
    }
  }

  try {
    const cutoffIso = new Date(Date.now() - REFRESH_AFTER_SECONDS * 1000).toISOString();
    let q = supabase
      .from("v8_simulations")
      .select("id, batch_id, cpf, v8_status_snapshot_at")
      .eq("error_kind", "active_consult")
      .or(`v8_status_snapshot_at.is.null,v8_status_snapshot_at.lte.${cutoffIso}`)
      .order("v8_status_snapshot_at", { ascending: true, nullsFirst: true })
      .limit(BATCH_LIMIT);
    if (batchId) q = q.eq("batch_id", batchId);
    if (simulationId) q = q.eq("id", simulationId);

    const { data: rows, error } = await q;
    if (error) {
      console.error("[v8-active-consult-poller] select error", error);
      return ok({ success: false, error: error.message });
    }

    const list = rows ?? [];
    if (list.length === 0) {
      return ok({ scanned: 0, updated: 0, duration_ms: Date.now() - startedAt });
    }

    let updated = 0;
    let failed = 0;

    for (const row of list) {
      try {
        const resp = await fetch(`${supabaseUrl}/functions/v1/v8-clt-api`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${serviceRoleKey}`,
            "x-cron-trigger": "v8-active-consult-poller",
          },
          body: JSON.stringify({
            action: "check_consult_status",
            params: { cpf: row.cpf },
          }),
        });

        const json = await resp.json().catch(() => ({} as any));

        // Mesmo quando a V8 não tem dados (success=false ou data vazio), marcamos
        // v8_status_snapshot_at para não repolling no próximo ciclo (cooldown 120s).
        if (!json?.success || !json?.data) {
          await supabase
            .from("v8_simulations")
            .update({ v8_status_snapshot_at: new Date().toISOString() })
            .eq("id", row.id);
          failed += 1;
          continue;
        }

        // Pega snapshot atual para mesclar (não sobrescrever campos do webhook).
        const { data: current } = await supabase
          .from("v8_simulations")
          .select("raw_response")
          .eq("id", row.id)
          .maybeSingle();

        const merged = {
          ...((current?.raw_response as any) ?? {}),
          v8_status_snapshot: json.data,
        };

        const { error: updErr } = await supabase
          .from("v8_simulations")
          .update({
            raw_response: merged,
            v8_status_snapshot_at: new Date().toISOString(),
          })
          .eq("id", row.id);

        if (updErr) {
          console.error("[v8-active-consult-poller] update err", row.id, updErr);
          failed += 1;
        } else {
          updated += 1;
        }
      } catch (err) {
        console.error("[v8-active-consult-poller] fetch err", row.id, err);
        failed += 1;
      }
    }

    return ok({
      scanned: list.length,
      updated,
      failed,
      duration_ms: Date.now() - startedAt,
    });
  } catch (err: any) {
    console.error("[v8-active-consult-poller] fatal", err);
    return ok({ success: false, error: String(err?.message || err) });
  }
});

function ok(body: unknown, status = 200) {
  return new Response(JSON.stringify({ success: true, ...((body as object) ?? {}) }), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
