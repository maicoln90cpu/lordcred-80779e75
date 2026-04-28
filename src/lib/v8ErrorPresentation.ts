type V8RawResponse = Record<string, any> | null | undefined;

function firstNonEmpty(...values: Array<unknown>) {
  for (const value of values) {
    if (typeof value === 'string' && value.trim()) return value.trim();
  }
  return null;
}

export function getV8RawPayload(rawResponse: V8RawResponse) {
  if (!rawResponse) return null;
  return rawResponse.payload ?? rawResponse.response ?? rawResponse;
}

export function getV8ErrorHeadline(rawResponse: V8RawResponse, fallback?: string | null) {
  const payload = getV8RawPayload(rawResponse);

  return firstNonEmpty(
    rawResponse?.title,
    payload?.title,
    rawResponse?.detail,
    payload?.detail,
    rawResponse?.message,
    payload?.message,
    rawResponse?.error,
    payload?.error,
    fallback,
  );
}

export function getV8ErrorSecondary(rawResponse: V8RawResponse) {
  const payload = getV8RawPayload(rawResponse);
  const headline = getV8ErrorHeadline(rawResponse);

  const secondary = firstNonEmpty(
    rawResponse?.detail,
    payload?.detail,
    rawResponse?.message,
    payload?.message,
    rawResponse?.guidance,
    payload?.guidance,
    rawResponse?.error,
    payload?.error,
  );

  return secondary && secondary !== headline ? secondary : null;
}

export function getV8ErrorMeta(rawResponse: V8RawResponse) {
  return {
    step: firstNonEmpty(rawResponse?.step, rawResponse?.payload?.step),
    kind: firstNonEmpty(rawResponse?.kind, rawResponse?.error_kind, rawResponse?.payload?.kind),
    guidance: firstNonEmpty(rawResponse?.guidance, rawResponse?.payload?.guidance),
  };
}

export function stringifyV8Payload(rawResponse: V8RawResponse) {
  const payload = getV8RawPayload(rawResponse);
  if (!payload) return null;

  try {
    return JSON.stringify(payload, null, 2);
  } catch {
    return String(payload);
  }
}

/**
 * Remove linhas duplicadas (preservando a ordem) de uma string multilinha.
 * Útil porque tentativas sucessivas concatenam o mesmo texto de orientação
 * em `error_message`, gerando 3+ repetições da mesma frase na UI.
 */
export function dedupeLines(text: string | null | undefined): string {
  if (!text) return '';
  const seen = new Set<string>();
  const out: string[] = [];
  for (const raw of String(text).split(/\r?\n/)) {
    const line = raw.trim();
    if (!line) continue;
    const key = line.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(line);
  }
  return out.join('\n');
}

/**
 * Mensagem única e limpa para exibir na UI: combina headline + error_message
 * removendo linhas repetidas. Mantém apenas a primeira ocorrência de cada frase.
 */
export function getV8ErrorMessageDeduped(
  rawResponse: V8RawResponse,
  errorMessage?: string | null,
): string {
  const headline = getV8ErrorHeadline(rawResponse, errorMessage);
  const combined = [headline, errorMessage].filter(Boolean).join('\n');
  return dedupeLines(combined);
}

/**
 * Tradução PT-BR dos status crus do banco (`v8_simulations.status` e
 * `v8_batches.status`). Use como fallback genérico — quando houver kind
 * de erro classificado, prefira `getSimulationStatusLabel` que é mais rico.
 */
const V8_STATUS_PTBR: Record<string, string> = {
  success: 'sucesso',
  failed: 'falha',
  pending: 'aguardando V8',
  processing: 'processando',
  completed: 'concluído',
  cancelled: 'cancelado',
  canceled: 'cancelado',
};

export function translateV8Status(status: string | null | undefined): string {
  if (!status) return '—';
  const key = String(status).trim().toLowerCase();
  return V8_STATUS_PTBR[key] ?? status;
}
