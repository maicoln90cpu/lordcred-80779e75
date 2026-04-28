// Validação Zod do payload recebido pelo webhook V8.
//
// Filosofia: o webhook recebe MUITAS variações (consulta, operação, handshakes
// `webhook.test` / `webhook.registered`, replays, payloads esquisitos da prod).
// Não podemos rejeitar nada que pareça remotamente válido — senão perderíamos
// eventos. O schema usa `passthrough` (mantém campos extras) e valida apenas
// o mínimo: precisa ser um OBJETO JSON com PELO MENOS um identificador válido
// (consultId/operationId/etc) OU ser um handshake reconhecido.
//
// Saída:
//   { ok: true, kind: 'handshake' | 'consult' | 'operation' | 'unknown' }
//   { ok: false, errors: string[] } → 200 com {success:false, validation_error}

import { z } from "https://esm.sh/zod@3.23.8";

const HANDSHAKE_TYPES = ["webhook.test", "webhook.registered"] as const;

/** Schema permissivo: objeto não-vazio. Tudo o resto é validado por regra. */
export const V8WebhookPayloadSchema = z
  .object({})
  .catchall(z.unknown())
  .passthrough();

export type V8WebhookPayload = z.infer<typeof V8WebhookPayloadSchema>;

export type V8PayloadKind = "handshake" | "consult" | "operation" | "unknown";

export interface ValidationOk {
  ok: true;
  kind: V8PayloadKind;
  payload: Record<string, unknown>;
}

export interface ValidationFail {
  ok: false;
  errors: string[];
  reason: "not_object" | "empty_payload" | "no_identifier" | "parse_error";
}

export type ValidationResult = ValidationOk | ValidationFail;

/**
 * Valida o payload recebido. Nunca lança — sempre retorna ValidationResult.
 * Aceita objeto JS já parseado OU string JSON bruta.
 */
export function validateV8WebhookPayload(input: unknown): ValidationResult {
  // Se vier string, tenta parsear
  let candidate: unknown = input;
  if (typeof input === "string") {
    try {
      candidate = input.trim() ? JSON.parse(input) : {};
    } catch (err) {
      return {
        ok: false,
        reason: "parse_error",
        errors: [`JSON inválido: ${(err as Error).message}`],
      };
    }
  }

  // Tem que ser objeto (V8 nunca envia array no top-level)
  if (
    candidate === null ||
    typeof candidate !== "object" ||
    Array.isArray(candidate)
  ) {
    return {
      ok: false,
      reason: "not_object",
      errors: ["Payload precisa ser um objeto JSON"],
    };
  }

  const parsed = V8WebhookPayloadSchema.safeParse(candidate);
  if (!parsed.success) {
    return {
      ok: false,
      reason: "parse_error",
      errors: parsed.error.errors.map((e) => `${e.path.join(".") || "(root)"}: ${e.message}`),
    };
  }

  const obj = parsed.data as Record<string, unknown>;

  if (Object.keys(obj).length === 0) {
    return {
      ok: false,
      reason: "empty_payload",
      errors: ["Payload vazio"],
    };
  }

  const type = String(obj.type ?? "").toLowerCase();
  if ((HANDSHAKE_TYPES as readonly string[]).includes(type)) {
    return { ok: true, kind: "handshake", payload: obj };
  }

  const consultId = obj.consultId ?? obj.consult_id ?? obj.id;
  const operationId = obj.operationId ?? obj.operation_id;

  if (operationId) return { ok: true, kind: "operation", payload: obj };
  if (consultId) return { ok: true, kind: "consult", payload: obj };

  return {
    ok: false,
    reason: "no_identifier",
    errors: [
      "Payload não tem identificador esperado (consultId/operationId/id) nem é handshake (webhook.test/webhook.registered)",
    ],
  };
}
