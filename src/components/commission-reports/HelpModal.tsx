import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { HelpCircle } from 'lucide-react';
import { cn } from '@/lib/utils';

interface HelpSection {
  title: string;
  content: string;
}

interface HelpButtonProps {
  title: string;
  sections: HelpSection[];
  className?: string;
}

export function HelpButton({ title, sections, className }: HelpButtonProps) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <Button
        variant="ghost"
        size="icon"
        className={cn("h-7 w-7 rounded-full text-muted-foreground hover:text-foreground", className)}
        onClick={() => setOpen(true)}
        title="Como funciona?"
      >
        <HelpCircle className="w-5 h-5" />
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <HelpCircle className="w-5 h-5 text-primary" />
              {title}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-5 text-sm">
            {sections.map((section, i) => (
              <div key={i}>
                <h3 className="font-semibold text-base mb-2">{section.title}</h3>
                <div className="text-muted-foreground whitespace-pre-line leading-relaxed">
                  {section.content}
                </div>
              </div>
            ))}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}

export const HELP_PARCEIROS = [
  {
    title: '📋 O que é este módulo?',
    content: 'O módulo Comissões Parceiros gerencia as vendas dos vendedores, calcula comissões automaticamente com base nas taxas cadastradas e gera extratos semanais e consolidados mensais.',
  },
  {
    title: '⚙️ Como funciona o cálculo automático?',
    content: `Toda vez que uma venda é registrada (manual ou importação), o sistema executa um "trigger" automático no banco de dados que:

1. Identifica o produto (FGTS ou Crédito do Trabalhador)
2. Busca a taxa vigente na data da venda, no banco correspondente
3. Multiplica o valor liberado pela taxa para gerar a comissão
4. Calcula o "week_label" (rótulo da semana) baseado no dia de início configurado
5. Verifica se o vendedor atingiu a meta semanal de bônus`,
  },
  {
    title: '🎯 Como funciona o Bônus?',
    content: `O bônus é configurável na aba "Configurações":

• Tipo de meta: por Valor Liberado (R$) ou por Nº de Contratos
• Tipo de premiação: Taxa percentual (%) sobre o valor ou Valor Fixo (R$)
• O bônus é avaliado por semana — quando o vendedor atinge a meta na semana, as vendas seguintes recebem o bônus
• Vendas anteriores NÃO são recalculadas automaticamente`,
  },
  {
    title: '📅 Semanas e Datas',
    content: `• O dia de início da semana é configurável (padrão: Sexta-feira)
• O sistema usa o timezone America/Sao_Paulo para converter datas
• O "week_label" mostra o período (ex: "28/03 a 03/04 - Semana 1 Abril")
• Isso permite agrupar vendas por semana no extrato e consolidado`,
  },
  {
    title: '📊 Extrato vs Consolidado',
    content: `• Extrato: lista individual de vendas com comissão calculada, filtrado por vendedor e semana
• Consolidado: visão agregada por vendedor x semana, com totais de valor liberado, comissão e bônus`,
  },
  {
    title: '📥 Importação',
    content: `Aceita planilhas Excel (.xlsx) ou dados colados (Ctrl+V). Colunas esperadas: Data Pago, Produto, Banco, Prazo, Valor Liberado, Seguro, Nome, CPF, Telefone, Vendedor, ID.

O sistema cria um "lote" de importação para rastreabilidade. Lotes podem ser visualizados em "Hist. Importações".`,
  },
];

export const HELP_RELATORIOS = [
  {
    title: '📋 O que é este módulo?',
    content: 'O módulo Relatório de Comissões é uma ferramenta de AUDITORIA que cruza dados de diferentes fontes (produção, repasse, seguros) para verificar se as comissões recebidas estão corretas em relação às esperadas.',
  },
  {
    title: '📥 Importação de Dados (4 fontes)',
    content: `O sistema recebe dados de 4 planilhas diferentes:

• Geral (17 colunas): dados de produção do New Corban
• Repasse (21 colunas): dados de pagamento/repasse
• Seguros (5 colunas): comissões de seguros prestamistas
• Relatório (14 colunas): dados de vendas com detalhes do contrato

Cada importação cria um "lote" rastreável em "Hist. Importações".`,
  },
  {
    title: '⚙️ Motor de Cálculo (RPC no servidor)',
    content: `O cálculo é feito inteiramente no banco de dados (função calculate_commission_audit) para performance:

1. Para cada contrato em cr_relatorio, identifica se é FGTS ou CLT
2. Busca a regra de comissão aplicável (tabela, banco, prazo, seguro)
3. Aplica a taxa sobre o valor liberado para gerar a "comissão esperada"
4. Cruza o num_contrato com cr_geral (ADE/cod_contrato) + cr_repasse + cr_seguros para obter a "comissão recebida"
5. Calcula a diferença (recebida - esperada)`,
  },
  {
    title: '🔀 Cross-reference (Cruzamento)',
    content: `O sistema cruza dados pelo número do contrato (ADE):

• cr_geral: soma cms_rep onde ADE ou cod_contrato = num_contrato
• cr_repasse: soma cms_rep_favorecido onde ADE ou cod_contrato = num_contrato
• cr_seguros: soma valor_comissao onde descrição contém "ADE {num_contrato}"

A comissão recebida = geral + repasse + seguros.`,
  },
  {
    title: '📊 Regras CLT e FGTS',
    content: `Cada banco tem regras específicas com data de vigência:

FGTS: taxa varia por banco, tabela_chave (ex: GOLD PLUS, SONHO), faixa de valor/prazo e seguro
CLT: taxa varia por banco, tabela_chave, faixa de prazo e seguro

Regras especiais:
• Mercantil do Brasil: base = valor_liberado / 0.7
• Hub: lookup por valor (FGTS) ou tabela específica (CLT)
• Lotus: chave extraída do último caractere da tabela
• Paraná: chave = "SEGURO" se tem seguro, "PARANA" caso contrário`,
  },
  {
    title: '⚠️ Divergências',
    content: `Uma divergência é quando |comissão recebida - esperada| ≥ R$ 1,00.

O sistema calcula automaticamente e destaca essas divergências para revisão. Divergências podem indicar:
• Regra de comissão desatualizada
• Erro na planilha importada
• Mudança de taxa não comunicada pelo banco`,
  },
  {
    title: '🕐 Timezone',
    content: 'Todos os cálculos de data usam America/Sao_Paulo para evitar erros de um dia (ex: 23:00 UTC = 20:00 SP, que pode ser dia anterior).',
  },
];
