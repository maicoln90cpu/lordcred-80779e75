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