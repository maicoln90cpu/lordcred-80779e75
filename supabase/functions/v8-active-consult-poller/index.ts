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
 *
 * Cuidado de produção: este poller chama a Edge Function v8-clt-api UMA VEZ
 * por simulação. Para evitar estouro do limite por função do Supabase Edge,
 * o tamanho do lote é conservador e existe pequeno delay entre chamadas.
 */
import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { writeAuditLog } from "../_shared/auditLog.ts";
import { packPayloadForAudit } from "../_shared/v8AuditPayload.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Não revisita snapshots recentes (economia de chamadas à V8).
const REFRESH_AFTER_SECONDS = 180;
// Limite conservador por execução para evitar RateLimitError do runtime.
const BATCH_LIMIT = 25;
// Pequeno espaço entre chamadas — evita rajada que estoura limite por função.
const PER_CALL_DELAY_MS = 250;

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const startedAt = Date.now();
  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const supabase = createClient(supabaseUrl, serviceRoleKey);

  // Aceita { batch_id?, simulation_id?, manual? } para chamadas focadas (ex: clique do operador).
  let batchId: string | null = null;
  let simulationId: string | null = null;
  let manualMode = false;
  try {
    if (req.method === "POST") {
      const body = await req.json().catch(() => ({} as any));
      batchId = body?.batch_id ?? null;
      simulationId = body?.simulation_id ?? null;
      manualMode = !!body?.manual;
    }
  } catch (_) { /* ignore */ }

  try {
    const cutoffIso = new Date(Date.now() - REFRESH_AFTER_SECONDS * 1000).toISOString();
    let q = supabase
      .from("v8_simulations")
      .select("id, batch_id, cpf, v8_status_snapshot_at, raw_response, simulation_strategy, v8_batches!inner(status)")
      .eq("error_kind", "active_consult")
      .neq("v8_batches.status", "canceled")
      .or(`v8_status_snapshot_at.is.null,v8_status_snapshot_at.lte.${cutoffIso}`)
      .order("v8_status_snapshot_at", { ascending: true, nullsFirst: true })
      .limit(simulationId ? 1 : BATCH_LIMIT);
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

    let updated = 0;        // snapshot encontrado e gravado
    let notFound = 0;        // V8 respondeu, mas sem dados para o CPF
    let rateLimited = 0;     // V8 ou Edge Runtime negou por limite
    let failed = 0;          // erros diversos
    const perSimResults: Array<Record<string, unknown>> = [];

    for (const row of list) {
      const probedAtIso = new Date().toISOString();
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

        // Detecta rate limit (V8 ou edge runtime)
        const errorText = String(json?.error ?? json?.message ?? "").toLowerCase();
        const isRateLimit = errorText.includes("limite de requisições")
          || errorText.includes("rate limit")
          || resp.status === 429;

        const baseRaw = (row.raw_response as any) ?? {};

        if (isRateLimit) {
          rateLimited += 1;
          perSimResults.push({ simulation_id: row.id, cpf_masked: maskCpf(row.cpf), outcome: "rate_limited", http_status: resp.status });
          // Grava estado legível para o front-end. NÃO atualiza v8_status_snapshot_at
          // para que o cron tente este CPF de novo no próximo ciclo.
          await supabase
            .from("v8_simulations")
            .update({
              raw_response: {
                ...baseRaw,
                v8_status_snapshot: {
                  found: false,
                  rate_limited: true,
                  probed_at: probedAtIso,
                  message: "V8 limitou as consultas. Nova tentativa automática em instantes.",
                },
              },
            })
            .eq("id", row.id);
          continue;
        }

        if (!json?.success || !json?.data) {
          // V8 respondeu mas não temos dados — anota cooldown para não repolling agressivo.
          notFound += 1;
          perSimResults.push({ simulation_id: row.id, cpf_masked: maskCpf(row.cpf), outcome: "not_found", message: json?.user_message ?? json?.error ?? null });
          await supabase
            .from("v8_simulations")
            .update({
              v8_status_snapshot_at: probedAtIso,
              raw_response: {
                ...baseRaw,
                v8_status_snapshot: {
                  found: false,
                  probed_at: probedAtIso,
                  message: json?.user_message
                    ?? json?.error
                    ?? "Sem retorno da V8 para este CPF.",
                },
              },
            })
            .eq("id", row.id);
          continue;
        }

        // Sucesso — grava o snapshot completo (dados crus + flag found:true).
        const snapshot = {
          ...(json.data as object),
          probed_at: probedAtIso,
        };

        // Tenta extrair availableMarginValue do snapshot — V8 às vezes coloca em
        // data.availableMarginValue, data.latest.availableMarginValue ou nos itens de data.all.
        // Manter sincronizado com src/lib/v8MarginExtractor.ts (helper TS).
        function extractMarginFromSnapshot(s: any): number | null {
          if (!s || typeof s !== 'object') return null;
          const candidates: any[] = [
            s.availableMarginValue, s.available_margin_value,
            s.availableMargin, s.marginValue,
            s.latest?.availableMarginValue,
            s.result?.availableMarginValue,
            s.data?.availableMarginValue,
          ];
          if (Array.isArray(s.all)) {
            for (const c of s.all) {
              candidates.push(c?.availableMarginValue, c?.available_margin_value);
            }
          }
          for (const c of candidates) {
            if (c == null) continue;
            const n = Number(c);
            if (Number.isFinite(n) && n > 0) return n;
          }
          return null;
        }
        const margemFromSnapshot = extractMarginFromSnapshot(json.data);

        const updatePayload: Record<string, unknown> = {
          raw_response: { ...baseRaw, v8_status_snapshot: snapshot },
          v8_status_snapshot_at: probedAtIso,
        };
        if (margemFromSnapshot != null) {
          updatePayload.margem_valor = margemFromSnapshot;
        }

        const { error: updErr } = await supabase
          .from("v8_simulations")
          .update(updatePayload)
          .eq("id", row.id);

        if (updErr) {
          console.error("[v8-active-consult-poller] update err", row.id, updErr);
          failed += 1;
          perSimResults.push({ simulation_id: row.id, cpf_masked: maskCpf(row.cpf), outcome: "update_failed", error: updErr.message });
        } else {
          updated += 1;
          perSimResults.push({
            simulation_id: row.id,
            cpf_masked: maskCpf(row.cpf),
            outcome: "snapshot_updated",
            v8_status: snapshot?.status ?? snapshot?.latest?.status ?? null,
            margem_valor: margemFromSnapshot,
            ...packPayloadForAudit(snapshot, "snapshot_full"),
          });
        }
      } catch (err) {
        failed += 1;
        perSimResults.push({ simulation_id: row.id, cpf_masked: maskCpf(row.cpf), outcome: "exception", error: String((err as Error)?.message || err) });
        console.error("[v8-active-consult-poller] fetch err", row.id, err);
      }

      if (PER_CALL_DELAY_MS > 0) {
        await new Promise((r) => setTimeout(r, PER_CALL_DELAY_MS));
      }
    }

    console.log(
      `[v8-active-consult-poller] scanned=${list.length} updated=${updated} not_found=${notFound} rate_limited=${rateLimited} failed=${failed} manual=${manualMode}`,
    );

    // Auditoria: 1 entrada por ciclo (visível em /admin/audit-logs)
    await writeAuditLog(supabase, {
      action: "v8_poller_cycle",
      category: "simulator",
      success: failed === 0,
      targetTable: "v8_simulations",
      details: {
        trigger_source: manualMode ? "manual" : "cron",
        batch_id: batchId,
        focused_simulation_id: simulationId,
        scanned: list.length,
        updated,
        not_found: notFound,
        rate_limited: rateLimited,
        failed,
        duration_ms: Date.now() - startedAt,
        ...packPayloadForAudit(perSimResults, "per_simulation_results"),
      },
    });

    return ok({
      scanned: list.length,
      updated,
      not_found: notFound,
      rate_limited: rateLimited,
      failed,
      duration_ms: Date.now() - startedAt,
    });
  } catch (err: any) {
    console.error("[v8-active-consult-poller] fatal", err);
    await writeAuditLog(supabase, {
      action: "v8_poller_cycle",
      category: "simulator",
      success: false,
      targetTable: "v8_simulations",
      details: { fatal_error: String(err?.message || err), trigger_source: manualMode ? "manual" : "cron", batch_id: batchId, focused_simulation_id: simulationId },
    });
    return ok({ success: false, error: String(err?.message || err) });
  }
});

function maskCpf(cpf?: string | null): string | null {
  if (!cpf) return null;
  return String(cpf).replace(/\d(?=\d{4})/g, "*");
}

function ok(body: unknown, status = 200) {
  return new Response(JSON.stringify({ success: true, ...((body as object) ?? {}) }), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
