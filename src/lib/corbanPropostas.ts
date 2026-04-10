export interface NormalizedCorbanProposta {
  // Campos já existentes
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

  // Proposta
  proposta_id_banco?: string | null;
  valor_financiado?: number | null;
  taxa?: string | null;
  seguro?: string | null;
  tabela_nome?: string | null;
  link_formalizacao?: string | null;
  comissoes?: string | null;

  // Equipe
  vendedor_nome?: string | null;
  digitador_nome?: string | null;
  equipe_nome?: string | null;
  promotora_nome?: string | null;
  origem?: string | null;

  // API
  status_api?: string | null;
  status_api_descricao?: string | null;
  data_atualizacao_api?: string | null;
  data_status?: string | null;

  // Datas
  data_formalizacao?: string | null;
  data_averbacao?: string | null;

  // Averbação
  agencia?: string | null;
  conta?: string | null;
  banco_averbacao?: string | null;
  pix?: string | null;

  // Cliente
  cliente_sexo?: string | null;
  nascimento?: string | null;
  nome_mae?: string | null;
  renda?: number | null;
  endereco_completo?: string | null;

  // Outros
  observacoes?: string | null;
  tipo_cadastro?: string | null;

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

const buildEnderecoCompleto = (source: unknown): string | null => {
  const logradouro = toFlatString(findDeepValue(source, ['logradouro', 'rua', 'endereco']));
  const numero = toFlatString(findDeepValue(source, ['numero']));
  const complemento = toFlatString(findDeepValue(source, ['complemento']));
  const bairro = toFlatString(findDeepValue(source, ['bairro']));
  const cidade = toFlatString(findDeepValue(source, ['cidade', 'municipio']));
  const uf = toFlatString(findDeepValue(source, ['uf', 'estado']));
  const cep = toFlatString(findDeepValue(source, ['cep']));

  const parts = [logradouro, numero, complemento, bairro, cidade, uf, cep].filter(Boolean);
  return parts.length > 0 ? parts.join(', ') : null;
};

const buildObservacoes = (source: unknown): string | null => {
  const lastApi = toFlatString(findDeepValue(source, ['observacao_api', 'obs_api', 'last_api']));
  const lastManual = toFlatString(findDeepValue(source, ['observacao', 'obs', 'last_manual', 'observacoes']));
  const parts = [];
  if (lastApi) parts.push(`API: ${lastApi}`);
  if (lastManual) parts.push(`Manual: ${lastManual}`);
  return parts.length > 0 ? parts.join(' | ') : null;
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
    // Campos originais
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

    // Proposta extras
    proposta_id_banco: toFlatString(findDeepValue(source, ['proposta_id_banco', 'id_banco', 'numero_proposta_banco'])),
    valor_financiado: toFlatNumber(findDeepValue(source, ['valor_financiado', 'vlr_financiado', 'valor_bruto'])),
    taxa: toFlatString(findDeepValue(source, ['taxa', 'taxa_juros', 'taxa_cliente'])),
    seguro: toFlatString(findDeepValue(source, ['seguro', 'tipo_seguro', 'seguro_prestamista'])),
    tabela_nome: toFlatString(findDeepValue(source, ['tabela_nome', 'nome_tabela', 'tabela'])),
    link_formalizacao: toFlatString(findDeepValue(source, ['link_formalizacao', 'url_formalizacao', 'link'])),
    comissoes: toFlatString(findDeepValue(source, ['comissao', 'comissoes', 'valor_comissao'])),

    // Equipe
    vendedor_nome: toFlatString(findDeepValue(source, ['vendedor_nome', 'nome_vendedor', 'vendedor'])),
    digitador_nome: toFlatString(findDeepValue(source, ['digitador_nome', 'nome_digitador', 'digitador'])),
    equipe_nome: toFlatString(findDeepValue(source, ['equipe_nome', 'nome_equipe', 'equipe'])),
    promotora_nome: toFlatString(findDeepValue(source, ['promotora_nome', 'nome_promotora', 'promotora', 'substabelecimento'])),
    origem: toFlatString(findDeepValue(source, ['origem', 'canal'])),

    // API
    status_api: toFlatString(findDeepValue(source, ['status_api', 'codigo_status'])),
    status_api_descricao: toFlatString(findDeepValue(source, ['status_api_descricao', 'descricao_status_api'])),
    data_atualizacao_api: toFlatString(findDeepValue(source, ['data_atualizacao_api', 'ultima_atualizacao_api', 'data_atualizacao'])),
    data_status: toFlatString(findDeepValue(source, ['data_status', 'data_ultimo_status'])),

    // Datas
    data_formalizacao: toFlatString(findDeepValue(source, ['data_formalizacao', 'formalizacao'])),
    data_averbacao: toFlatString(findDeepValue(source, ['data_averbacao', 'averbacao_data'])),

    // Averbação
    agencia: toFlatString(findDeepValue(source, ['agencia', 'agencia_pagamento'])),
    conta: toFlatString(findDeepValue(source, ['conta', 'conta_pagamento', 'numero_conta'])),
    banco_averbacao: toFlatString(findDeepValue(source, ['banco_averbacao', 'banco_pagamento'])),
    pix: toFlatString(findDeepValue(source, ['pix', 'chave_pix'])),

    // Cliente
    cliente_sexo: toFlatString(findDeepValue(source, ['sexo', 'genero'])),
    nascimento: toFlatString(findDeepValue(source, ['nascimento', 'data_nascimento', 'dt_nascimento'])),
    nome_mae: toFlatString(findDeepValue(source, ['nome_mae', 'mae', 'filiacao'])),
    renda: toFlatNumber(findDeepValue(source, ['renda', 'renda_mensal', 'salario'])),
    endereco_completo: buildEnderecoCompleto(source),

    // Outros
    observacoes: buildObservacoes(source),
    tipo_cadastro: toFlatString(findDeepValue(source, ['tipo_cadastro', 'tipo'])),

    raw: source,
  };
};

export function normalizeCorbanPropostasInput(input: unknown): NormalizedCorbanProposta[] {
  return coerceToPropostasArray(input).map(normalizeSingleProposta);
}
