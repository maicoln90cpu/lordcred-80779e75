export function isValidCpf(value: string): boolean {
  const raw = value.replace(/\D/g, '');
  if (raw.length !== 11 || /^(\d)\1{10}$/.test(raw)) return false;
  let sum = 0;
  for (let i = 0; i < 9; i++) sum += Number(raw[i]) * (10 - i);
  if (((sum * 10) % 11) % 10 !== Number(raw[9])) return false;
  sum = 0;
  for (let i = 0; i < 10; i++) sum += Number(raw[i]) * (11 - i);
  return ((sum * 10) % 11) % 10 === Number(raw[10]);
}

export function isValidCnpj(value: string): boolean {
  const raw = value.replace(/\D/g, '');
  if (raw.length !== 14 || /^(\d)\1{13}$/.test(raw)) return false;
  const w1 = [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];
  const w2 = [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];
  let s = 0;
  for (let i = 0; i < 12; i++) s += Number(raw[i]) * w1[i];
  const d1 = s % 11 < 2 ? 0 : 11 - (s % 11);
  if (d1 !== Number(raw[12])) return false;
  s = 0;
  for (let i = 0; i < 13; i++) s += Number(raw[i]) * w2[i];
  const d2 = s % 11 < 2 ? 0 : 11 - (s % 11);
  return d2 === Number(raw[13]);
}

export function formatCnpj(value: string): string {
  const raw = value.replace(/\D/g, '').slice(0, 14);
  if (raw.length <= 2) return raw;
  if (raw.length <= 5) return `${raw.slice(0, 2)}.${raw.slice(2)}`;
  if (raw.length <= 8) return `${raw.slice(0, 2)}.${raw.slice(2, 5)}.${raw.slice(5)}`;
  if (raw.length <= 12) return `${raw.slice(0, 2)}.${raw.slice(2, 5)}.${raw.slice(5, 8)}/${raw.slice(8)}`;
  return `${raw.slice(0, 2)}.${raw.slice(2, 5)}.${raw.slice(5, 8)}/${raw.slice(8, 12)}-${raw.slice(12)}`;
}

export function formatCpf(value: string): string {
  const raw = value.replace(/\D/g, '').slice(0, 11);
  if (raw.length <= 3) return raw;
  if (raw.length <= 6) return `${raw.slice(0, 3)}.${raw.slice(3)}`;
  if (raw.length <= 9) return `${raw.slice(0, 3)}.${raw.slice(3, 6)}.${raw.slice(6)}`;
  return `${raw.slice(0, 3)}.${raw.slice(3, 6)}.${raw.slice(6, 9)}-${raw.slice(9)}`;
}

export function formatPhone(value: string): string {
  const raw = value.replace(/\D/g, '').slice(0, 11);
  if (raw.length <= 2) return raw;
  if (raw.length <= 7) return `(${raw.slice(0, 2)}) ${raw.slice(2)}`;
  return `(${raw.slice(0, 2)}) ${raw.slice(2, 7)}-${raw.slice(7)}`;
}

export function formatCep(value: string): string {
  const raw = value.replace(/\D/g, '').slice(0, 8);
  if (raw.length <= 5) return raw;
  return `${raw.slice(0, 5)}-${raw.slice(5)}`;
}

export function validateForContract(form: Record<string, any>): Record<string, string> {
  const errors: Record<string, string> = {};
  if (!form.razao_social || (form.razao_social || '').trim().length < 3) errors.razao_social = 'Razão Social é obrigatória';
  const cnpjRaw = (form.cnpj || '').replace(/\D/g, '');
  if (!cnpjRaw || cnpjRaw.length < 14) errors.cnpj = 'CNPJ válido é obrigatório';
  else if (!isValidCnpj(cnpjRaw)) errors.cnpj = 'CNPJ inválido — verifique os dígitos';
  if (!form.endereco_pj_rua || (form.endereco_pj_rua || '').trim().length < 3) errors.endereco_pj_rua = 'Rua da empresa é obrigatória';
  if (!form.endereco_pj_numero || (form.endereco_pj_numero || '').trim().length < 1) errors.endereco_pj_numero = 'Número é obrigatório';
  if (!form.endereco_pj_bairro || (form.endereco_pj_bairro || '').trim().length < 2) errors.endereco_pj_bairro = 'Bairro é obrigatório';
  if (!form.endereco_pj_municipio || (form.endereco_pj_municipio || '').trim().length < 2) errors.endereco_pj_municipio = 'Município é obrigatório';
  if (!form.endereco_pj_uf || (form.endereco_pj_uf || '').trim().length < 2) errors.endereco_pj_uf = 'UF é obrigatória';
  if (!form.endereco_pj_cep || (form.endereco_pj_cep || '').trim().length < 5) errors.endereco_pj_cep = 'CEP é obrigatório';
  const nome = (form.nome || '').trim();
  const parts = nome.split(' ').filter(Boolean);
  if (!nome) errors.nome = 'Nome do representante é obrigatório';
  else if (parts.length < 2) errors.nome = 'Informe nome e sobrenome do representante';
  else if (/\d/.test(nome)) errors.nome = 'Nome não pode conter números';
  const cpf = (form.cpf || '').replace(/\D/g, '');
  if (!cpf) errors.cpf = 'CPF do representante é obrigatório';
  else if (!isValidCpf(cpf)) errors.cpf = 'CPF inválido';
  if (!form.telefone || (form.telefone || '').trim().length < 8) errors.telefone = 'Telefone é obrigatório';
  if (!form.email || !form.email.includes('@')) errors.email = 'Email válido é obrigatório';
  if (!form.nacionalidade || (form.nacionalidade || '').trim().length < 3) errors.nacionalidade = 'Nacionalidade é obrigatória';
  if (!form.estado_civil || (form.estado_civil || '').trim().length < 3) errors.estado_civil = 'Estado civil é obrigatório';
  if (!form.endereco_rep_cep || (form.endereco_rep_cep || '').replace(/\D/g, '').length < 8) errors.endereco_rep_cep = 'CEP pessoal é obrigatório';
  if (!form.endereco_rep_rua || (form.endereco_rep_rua || '').trim().length < 3) errors.endereco_rep_rua = 'Rua é obrigatória';
  if (!form.endereco_rep_numero || (form.endereco_rep_numero || '').trim().length < 1) errors.endereco_rep_numero = 'Número é obrigatório';
  if (!form.endereco_rep_bairro || (form.endereco_rep_bairro || '').trim().length < 2) errors.endereco_rep_bairro = 'Bairro é obrigatório';
  if (!form.endereco_rep_municipio || (form.endereco_rep_municipio || '').trim().length < 2) errors.endereco_rep_municipio = 'Município é obrigatório';
  if (!form.endereco_rep_uf || (form.endereco_rep_uf || '').trim().length < 2) errors.endereco_rep_uf = 'UF é obrigatória';
  return errors;
}

export const PIPELINE_STATUSES = [
  { value: 'contato_inicial', label: 'Contato Inicial' },
  { value: 'reuniao_marcada', label: 'Reunião Marcada' },
  { value: 'link_enviado', label: 'Link Enviado' },
  { value: 'confirmou', label: 'Confirmou' },
  { value: 'mei_pendente', label: 'MEI Pendente' },
  { value: 'mei_criado', label: 'MEI Criado' },
  { value: 'contrato_pendente', label: 'Contrato Pendente' },
  { value: 'contrato_assinado', label: 'Contrato Assinado' },
  { value: 'em_treinamento', label: 'Em Treinamento' },
  { value: 'ativo', label: 'Ativo' },
  { value: 'desistencia', label: 'Desistência' },
];

export const CONTRATO_STATUSES = [
  { value: 'pendente', label: 'Pendente' },
  { value: 'gerado', label: 'Gerado' },
  { value: 'pendente_parceiro', label: 'Aguardando Assinatura' },
  { value: 'assinado', label: 'Assinado' },
];

export const TREINAMENTO_STATUSES = [
  { value: 'pendente', label: 'Pendente' },
  { value: 'em_andamento', label: 'Em Andamento' },
  { value: 'concluido', label: 'Concluído' },
];

export const ACTION_LABELS: Record<string, string> = {
  'criado': 'Parceiro criado',
  'dados_atualizados': 'Dados atualizados',
  'status_alterado': 'Status alterado',
  'contrato_gerado': 'Contrato gerado',
  'contrato_assinado': 'Contrato assinado',
  'contrato_enviado': 'Contrato enviado para assinatura',
  'nota_adicionada': 'Nota adicionada',
};

export const ACTION_ICONS: Record<string, string> = {
  'criado': '🆕',
  'dados_atualizados': '✏️',
  'status_alterado': '🔄',
  'contrato_gerado': '📄',
  'contrato_assinado': '✅',
  'contrato_enviado': '📧',
  'nota_adicionada': '💬',
};
