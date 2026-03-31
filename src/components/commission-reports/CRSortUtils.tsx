import { useState } from 'react';
import { TableHead } from '@/components/ui/table';
import { Tooltip, TooltipContent, TooltipTrigger, TooltipProvider } from '@/components/ui/tooltip';
import { ArrowUpDown, ArrowUp, ArrowDown } from 'lucide-react';

// ==================== SORT ====================
export type SortDir = 'asc' | 'desc' | null;
export interface SortConfig { key: string; dir: SortDir }

export function useSortState() {
  const [sort, setSort] = useState<SortConfig>({ key: '', dir: null });
  const toggle = (key: string) => {
    setSort(prev => {
      if (prev.key !== key) return { key, dir: 'asc' };
      if (prev.dir === 'asc') return { key, dir: 'desc' };
      return { key: '', dir: null };
    });
  };
  return { sort, toggle };
}

export function applySortToData<T>(data: T[], sort: SortConfig, getValue?: (item: T, key: string) => any): T[] {
  if (!sort.key || !sort.dir) return data;
  return [...data].sort((a, b) => {
    const va = getValue ? getValue(a, sort.key) : (a as any)[sort.key] ?? '';
    const vb = getValue ? getValue(b, sort.key) : (b as any)[sort.key] ?? '';
    if (typeof va === 'number' && typeof vb === 'number') return sort.dir === 'asc' ? va - vb : vb - va;
    return sort.dir === 'asc' ? String(va).localeCompare(String(vb)) : String(vb).localeCompare(String(va));
  });
}

// ==================== TOOLTIP SORT HEAD ====================
interface TSHeadProps {
  label: string;
  sortKey: string;
  sort: SortConfig;
  toggle: (k: string) => void;
  tooltip?: string;
  className?: string;
}

export function TSHead({ label, sortKey, sort, toggle, tooltip, className }: TSHeadProps) {
  const Icon = sort.key === sortKey ? (sort.dir === 'asc' ? ArrowUp : ArrowDown) : ArrowUpDown;
  const content = (
    <TableHead className={`cursor-pointer select-none hover:bg-muted/50 ${className || ''}`} onClick={() => toggle(sortKey)}>
      <span className="inline-flex items-center gap-1">
        {label}
        <Icon className={`w-3 h-3 ${sort.key === sortKey ? 'text-foreground' : 'text-muted-foreground/50'}`} />
      </span>
    </TableHead>
  );

  if (!tooltip) return content;

  return (
    <TooltipProvider delayDuration={300}>
      <Tooltip>
        <TooltipTrigger asChild>{content}</TooltipTrigger>
        <TooltipContent side="top" className="max-w-xs text-xs">{tooltip}</TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

// ==================== TOOLTIP TABLE HEAD (no sort) ====================
interface THeadProps {
  label: string;
  tooltip?: string;
  className?: string;
}

export function THead({ label, tooltip, className }: THeadProps) {
  const content = <TableHead className={className}>{label}</TableHead>;
  if (!tooltip) return content;
  return (
    <TooltipProvider delayDuration={300}>
      <Tooltip>
        <TooltipTrigger asChild>{content}</TooltipTrigger>
        <TooltipContent side="top" className="max-w-xs text-xs">{tooltip}</TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

// ==================== TOOLTIP WRAPPER ====================
export function TipWrap({ tip, children }: { tip: string; children: React.ReactNode }) {
  return (
    <TooltipProvider delayDuration={300}>
      <Tooltip>
        <TooltipTrigger asChild><span>{children}</span></TooltipTrigger>
        <TooltipContent side="top" className="max-w-xs text-xs">{tip}</TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

// ==================== TOOLTIP MAPS ====================
export const TOOLTIPS_GERAL: Record<string, string> = {
  data_pgt_cliente: 'Data em que o pagamento foi realizado ao cliente',
  data_digitacao: 'Data em que o contrato foi digitado no sistema',
  ade: 'Número identificador do contrato ADE',
  cod_contrato: 'Código do contrato no sistema do banco',
  cpf: 'CPF do cliente beneficiário',
  idade: 'Idade do cliente (N/D quando indisponível)',
  nome_cliente: 'Nome completo do cliente',
  convenio: 'Convênio/tabela utilizada no contrato',
  pmts: 'Código PMTS do contrato',
  prazo: 'Prazo do contrato em meses',
  prod_liq: 'Produção líquida — valor efetivamente liberado',
  pct_cms: 'Percentual de comissão sobre produção líquida',
  prod_bruta: 'Produção bruta antes de descontos',
  pct_cms_bruta: 'Percentual de comissão sobre produção bruta',
  tipo_operacao: 'Tipo da operação (FGTS, CLT, etc.)',
  banco: 'Banco/instituição financeira do contrato',
  cms_rep: 'Valor da comissão do representante',
};

export const TOOLTIPS_REPASSE: Record<string, string> = {
  ...TOOLTIPS_GERAL,
  pct_rateio: 'Percentual de rateio variável',
  pct_rateio_fixo: 'Percentual de rateio fixo',
  cms_rep_favorecido: 'Valor da comissão repassada ao favorecido',
  favorecido: 'Nome do favorecido que recebe o repasse',
};

export const TOOLTIPS_SEGUROS: Record<string, string> = {
  id_seguro: 'Identificador do seguro prestamista',
  data_registro: 'Data de registro da comissão do seguro',
  descricao: 'Descrição do seguro ou referência ao contrato',
  tipo_comissao: 'Tipo de comissão (pagamento, estorno, etc.)',
  valor_comissao: 'Valor da comissão do seguro',
};

export const TOOLTIPS_RULES_FGTS: Record<string, string> = {
  data_vigencia: 'Data a partir da qual esta regra é válida',
  banco: 'Banco ao qual a regra se aplica',
  tabela_chave: 'Tabela/chave específica (* = todas)',
  seguro: 'Se a regra se aplica a contratos com seguro',
  min_valor: 'Valor mínimo de produção para aplicar esta taxa',
  max_valor: 'Valor máximo de produção para aplicar esta taxa',
  taxa: 'Percentual de comissão esperada',
};

export const TOOLTIPS_RULES_CLT: Record<string, string> = {
  data_vigencia: 'Data a partir da qual esta regra é válida',
  banco: 'Banco ao qual a regra se aplica',
  tabela_chave: 'Tabela/chave específica (* = todas)',
  seguro: 'Se a regra se aplica a contratos com seguro',
  prazo_min: 'Prazo mínimo em meses para aplicar esta taxa',
  prazo_max: 'Prazo máximo em meses para aplicar esta taxa',
  taxa: 'Percentual de comissão esperada',
};

export const TOOLTIPS_RELATORIO: Record<string, string> = {
  ade: 'Número ADE — identificador do contrato',
  nome: 'Nome do cliente',
  banco: 'Banco do contrato',
  produto: 'FGTS ou CLT, identificado pelo tipo de operação',
  valor_liberado: 'Valor líquido liberado ao cliente',
  cms_geral: 'Comissão recebida via aba Geral (CMS REP)',
  cms_repasse: 'Comissão recebida via aba Repasse',
  cms_seguro: 'Comissão do seguro vinculada ao contrato',
  comissao_recebida: 'Soma: CMS Geral + CMS Repasse + CMS Seguro',
  comissao_esperada: 'Calculada pelas regras FGTS/CLT cadastradas',
  diferenca: 'Recebida − Esperada (positivo = recebeu mais)',
};

export const TOOLTIPS_HISTORICO: Record<string, string> = {
  num_contrato: 'ADE ou número do contrato',
  banco: 'Banco do contrato',
  produto: 'Tipo: FGTS ou CLT',
  valor_liberado: 'Valor liberado no contrato',
  comissao_recebida: 'Comissão efetivamente recebida',
  comissao_esperada: 'Comissão calculada pelas regras',
  diferenca: 'Diferença entre recebida e esperada',
};

export const TOOLTIPS_PARCEIROS_BASE: Record<string, string> = {
  week_label: 'Semana calculada com base no dia de início configurado',
  sale_date: 'Data em que o pagamento foi realizado',
  product: 'Tipo do produto: FGTS ou Crédito do Trabalhador',
  bank: 'Banco/instituição financeira',
  term: 'Prazo do contrato em meses',
  released_value: 'Valor efetivamente liberado ao cliente',
  has_insurance: 'Se o contrato possui seguro prestamista',
  client_name: 'Nome do cliente',
  seller_id: 'Vendedor responsável pela venda',
  commission_rate: 'Taxa de comissão aplicada (%)',
  commission_value: 'Valor da comissão calculada automaticamente',
  external_proposal_id: 'ID da proposta no sistema externo',
};

export const TOOLTIPS_PARCEIROS_PIX: Record<string, string> = {
  seller_id: 'Vendedor dono da chave PIX',
  pix_type: 'Tipo: CPF, CNPJ, e-mail, celular ou chave aleatória',
  pix_key: 'Chave PIX para recebimento de comissões',
};

export const TOOLTIPS_PARCEIROS_RATES_FGTS: Record<string, string> = {
  effective_date: 'Data de vigência da taxa',
  bank: 'Banco ao qual a taxa se aplica',
  rate_no_insurance: 'Taxa (%) para contratos SEM seguro',
  rate_with_insurance: 'Taxa (%) para contratos COM seguro',
};

export const TOOLTIPS_PARCEIROS_RATES_CLT: Record<string, string> = {
  effective_date: 'Data de vigência da taxa',
  bank: 'Banco ao qual a taxa se aplica',
  term_min: 'Prazo mínimo em meses',
  term_max: 'Prazo máximo em meses',
  has_insurance: 'Se aplica a contratos com seguro',
  rate: 'Taxa de comissão (%)',
  obs: 'Observações adicionais',
};

export const TOOLTIPS_RESUMO: Record<string, string> = {
  contratos: 'Total de contratos importados no período',
  valor_liberado: 'Soma de toda produção líquida',
  comissao_recebida: 'Soma de todas as comissões recebidas',
  diferenca: 'Recebida − Esperada (negativo = perda)',
  banco: 'Banco/instituição financeira',
  count: 'Quantidade de contratos do banco',
  recebida: 'Total de comissão recebida do banco',
  esperada: 'Total de comissão esperada do banco',
};
