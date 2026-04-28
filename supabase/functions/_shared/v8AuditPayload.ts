// Helper compartilhado para empacotar payloads V8 em audit_logs.details
// sem estourar o limite prático de uma linha jsonb (~1MB no Postgres,
// mas mantemos teto conservador de 250KB para deixar margem aos outros campos).
//
// Regras:
// - Se o payload serializado couber em maxBytes → grava em payload_full.
// - Se exceder → grava prefixo em payload_truncated_preview + flags.
// - Se for null/undefined → não adiciona nada (silencioso).
//
// Uso:
//   const extras = packPayloadForAudit(rawData);
//   await writeAuditLog(supabase, { ..., details: { ...resumo, ...extras } });

const DEFAULT_MAX_BYTES = 250_000;

export interface PackedPayload {
  payload_full?: unknown;
  payload_truncated?: boolean;
  payload_truncated_preview?: string;
  payload_full_size_bytes?: number;
}

/** Empacota um valor para inclusão em audit_logs.details. Nunca lança. */
export function packPayloadForAudit(
  value: unknown,
  key: string = "payload_full",
  maxBytes: number = DEFAULT_MAX_BYTES,
): Record<string, unknown> {
  if (value === null || value === undefined) return {};
  try {
    const serialized = JSON.stringify(value);
    const bytes = new TextEncoder().encode(serialized).length;
    if (bytes <= maxBytes) {
      return { [key]: value, [`${key}_size_bytes`]: bytes };
    }
    return {
      [`${key}_truncated`]: true,
      [`${key}_truncated_preview`]: serialized.slice(0, maxBytes),
      [`${key}_full_size_bytes`]: bytes,
    };
  } catch (err) {
    return {
      [`${key}_serialize_error`]: (err as Error)?.message || String(err),
    };
  }
}

/** Acumulador de chamadas HTTP feitas à V8 dentro de uma única ação. */
export interface V8HttpCall {
  step: string;
  method: string;
  url: string;
  request_body?: unknown;
  http_status?: number | null;
  response_body?: unknown;
  duration_ms?: number;
  error?: string | null;
}

export class V8HttpCallRecorder {
  private calls: V8HttpCall[] = [];

  record(call: V8HttpCall): void {
    this.calls.push(call);
  }

  /** Retorna as chamadas serializáveis, com cada response truncado individualmente. */
  toAuditField(maxBytesPerCall: number = 80_000): V8HttpCall[] {
    return this.calls.map((c) => {
      const out: V8HttpCall = { ...c };
      try {
        const bodyStr = JSON.stringify(c.response_body ?? null);
        if (new TextEncoder().encode(bodyStr).length > maxBytesPerCall) {
          out.response_body = {
            __truncated: true,
            preview: bodyStr.slice(0, maxBytesPerCall),
            full_size_bytes: bodyStr.length,
          };
        }
      } catch (_) { /* ignore */ }
      return out;
    });
  }

  count(): number {
    return this.calls.length;
  }
}

/** Filtra headers HTTP, removendo os que carregam segredos. */
export function safeHeaders(headers: Headers | Record<string, string>): Record<string, string> {
  const SENSITIVE = ["authorization", "cookie", "x-api-key", "apikey", "x-supabase-auth"];
  const out: Record<string, string> = {};
  const iter: Iterable<[string, string]> = headers instanceof Headers
    ? (headers as any).entries()
    : Object.entries(headers);
  for (const [k, v] of iter) {
    out[k] = SENSITIVE.includes(k.toLowerCase()) ? "<redacted>" : v;
  }
  return out;
}
