export interface NormalizedCorbanProposta {
  proposta_id: string | null;
  cpf: string | null;
  nome: string | null;
  telefone: string | null;
  banco: string | null;
  produto: string | null;
  status: string | null;
  valor_liberado: number | null;
  valor_parcela: number | null;
  prazo: number | string | null;
  data_cadastro: string | null;
  data_pagamento: string | null;
  convenio: string | null;
  tipo_liberacao?: string | null;
  raw?: unknown;
}

const isRecord = (value: unknown): value is Record<string, unknown> => (
  typeof value === 'object' && value !== null && !Array.isArray(value)
);

const normalizeLookupKey = (value: string) => (
  value.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '')
);

const maybeParseJson = (value: unknown): unknown => {
  if (typeof value !== 'string') return value;
  const trimmed = value.trim();
  if (!trimmed || (!trimmed.startsWith('{') && !trimmed.startsWith('['))) return value;
  try {
    return JSON.parse(trimmed);
  } catch {
    return value;
  }
};

const hasContent = (value: unknown) => !(
  value === undefined ||
  value === null ||
  (typeof value === 'string' && value.trim() === '')
);

const findDeepValueByKey = (source: unknown, candidate: string, seen = new WeakSet<object>()): unknown => {
  const target = normalizeLookupKey(candidate);

  const walk = (value: unknown): unknown => {
    const current = maybeParseJson(value);

    if (Array.isArray(current)) {
      for (const item of current) {
        const found = walk(item);
        if (hasContent(found)) return found;
      }
      return undefined;
    }

    if (!isRecord(current)) return undefined;
    if (seen.has(current)) return undefined;

    seen.add(current);

    for (const [key, nested] of Object.entries(current)) {
      if (normalizeLookupKey(key) === target) {
        return maybeParseJson(nested);
      }
    }

    for (const nested of Object.values(current)) {
      const found = walk(nested);
      if (hasContent(found)) return found;
    }

    return undefined;
  };

  return walk(source);
};

const findDeepValue = (source: unknown, candidates: string[]) => {
  for (const candidate of candidates) {
    const found = findDeepValueByKey(source, candidate);
    if (hasContent(found)) return found;
  }
  return null;
};

const toFlatString = (value: unknown): string | null => {
  const parsed = maybeParseJson(value);
  if (parsed === null || parsed === undefined) return null;
  if (typeof parsed === 'string') return parsed.trim() || null;
  if (typeof parsed === 'number' || typeof parsed === 'boolean') return String(parsed);
  return null;
};

const toFlatNumber = (value: unknown): number | null => {
  const parsed = maybeParseJson(value);
  if (typeof parsed === 'number' && Number.isFinite(parsed)) return parsed;
  if (typeof parsed !== 'string') return null;

  const cleaned = parsed
    .replace(/\s+/g, '')
    .replace(/R\$/gi, '')
    .replace(/\.(?=\d{3}(?:\D|$))/g, '')
    .replace(',', '.')
    .replace(/[^\d.-]/g, '');

  if (!cleaned) return null;

  const numeric = Number(cleaned);
  return Number.isFinite(numeric) ? numeric : null;
};

const coerceToPropostasArray = (input: unknown): Record<string, unknown>[] => {
  const parsed = maybeParseJson(input);

  if (Array.isArray(parsed)) {
    return parsed
      .map((item) => maybeParseJson(item))
      .filter(isRecord);
  }

  if (!isRecord(parsed)) return [];

  for (const wrapperKey of ['data', 'dados', 'propostas', 'items', 'lista']) {
    if (wrapperKey in parsed) {
      const nested = coerceToPropostasArray(parsed[wrapperKey]);
      if (nested.length > 0) return nested;
    }
  }

  const numericEntries = Object.entries(parsed).filter(([key, value]) => /^\d+$/.test(key) && value != null);
  if (numericEntries.length > 0) {
    return numericEntries.map(([key, value]) => {
      const parsedValue = maybeParseJson(value);
      return isRecord(parsedValue)
        ? { proposta_id: key, ...parsedValue }
        : { proposta_id: key, raw: parsedValue };
    });
  }

  if (
    'proposta_id' in parsed ||
    'id' in parsed ||
    'averbacao' in parsed ||
    'api' in parsed ||
    'datas' in parsed ||
    'cliente' in parsed
  ) {
    return [parsed];
  }

  return [];
};

const normalizeSingleProposta = (input: unknown): NormalizedCorbanProposta => {
  const source = maybeParseJson(input);
  const prazoValue = findDeepValue(source, ['prazo', 'prazos', 'parcelas', 'quantidade_parcelas']);

  return {
    proposta_id: toFlatString(findDeepValue(source, ['proposta_id', 'id', 'codigo_proposta'])),
    cpf: toFlatString(findDeepValue(source, ['cpf', 'cpf_cliente', 'cliente_cpf', 'documento', 'cpfcnpj'])),
    nome: toFlatString(findDeepValue(source, ['nome', 'nome_cliente', 'cliente_nome', 'nome_completo'])),
    telefone: toFlatString(findDeepValue(source, ['telefone', 'celular', 'fone', 'whatsapp'])),
    banco: toFlatString(findDeepValue(source, ['banco_nome', 'nome_banco', 'banco_averbacao_nome', 'banco_averbacao', 'banco'])),
    produto: toFlatString(findDeepValue(source, ['produto_nome', 'produto_descricao', 'produto', 'tipo_operacao'])),
    status: toFlatString(findDeepValue(source, ['status_api_descricao', 'status_nome', 'status_descricao', 'descricao_status', 'status_api', 'status'])),
    valor_liberado: toFlatNumber(findDeepValue(source, ['valor_liberado', 'vlr_liberado', 'valorliberado', 'valor_liquido', 'valor'])),
    valor_parcela: toFlatNumber(findDeepValue(source, ['valor_parcela', 'vlr_parcela', 'parcela'])),
    prazo: typeof prazoValue === 'number' ? prazoValue : toFlatString(prazoValue),
    data_cadastro: toFlatString(findDeepValue(source, ['data_cadastro', 'cadastro', 'inclusao'])),
    data_pagamento: toFlatString(findDeepValue(source, ['data_pagamento', 'pagamento', 'data_pago'])),
    convenio: toFlatString(findDeepValue(source, ['convenio_nome', 'convenio'])),
    tipo_liberacao: toFlatString(findDeepValue(source, ['tipo_liberacao'])),
    raw: source,
  };
};

export function normalizeCorbanPropostasInput(input: unknown): NormalizedCorbanProposta[] {
  return coerceToPropostasArray(input).map(normalizeSingleProposta);
}