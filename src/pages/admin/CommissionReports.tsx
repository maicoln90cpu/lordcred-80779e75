import { useState } from 'react';
import DashboardLayout from '@/components/layout/DashboardLayout';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { FileSpreadsheet, ArrowRightLeft, Shield, Calculator, BarChart3, History, AlertTriangle, Settings, ClipboardList, Lightbulb, FileInput, PieChart } from 'lucide-react';
import CRImportTab, { GERAL_COLUMNS, REPASSE_COLUMNS, SEGUROS_COLUMNS, RELATORIO_COLUMNS } from '@/components/commission-reports/CRImportTab';
import CRImportHistory from '@/components/commission-reports/CRImportHistory';
import CRRulesFGTS from '@/components/commission-reports/CRRulesFGTS';
import CRRulesCLT from '@/components/commission-reports/CRRulesCLT';
import CRRelatorio from '@/components/commission-reports/CRRelatorio';
import CRResumo from '@/components/commission-reports/CRResumo';
import CRHistorico from '@/components/commission-reports/CRHistorico';
import CRIndicadores from '@/components/commission-reports/CRIndicadores';
import CRProductionDashboard from '@/components/commission-reports/CRProductionDashboard';
import { HelpButton, HELP_RELATORIOS } from '@/components/commission-reports/HelpModal';

export default function CommissionReports() {
  const [activeTab, setActiveTab] = useState('geral');

  const tabs = [
    { value: 'geral', label: 'Geral', icon: FileSpreadsheet },
    { value: 'repasse', label: 'Repasse', icon: ArrowRightLeft },
    { value: 'seguros', label: 'Seguros', icon: Shield },
    { value: 'relatorio_import', label: 'Relatório (Import)', icon: FileInput },
    { value: 'rules_fgts', label: 'Regras FGTS', icon: Settings },
    { value: 'rules_clt', label: 'Regras CLT', icon: Settings },
    { value: 'relatorio', label: 'Relatório', icon: Calculator },
    { value: 'resumo', label: 'Resumo', icon: BarChart3 },
    { value: 'historico', label: 'Histórico', icon: History },
    { value: 'divergencias', label: 'Divergências', icon: AlertTriangle },
    { value: 'import_history', label: 'Hist. Importações', icon: ClipboardList },
    { value: 'indicadores', label: 'Indicadores', icon: Lightbulb },
    { value: 'producao', label: 'Produção', icon: PieChart },
  ];

  return (
    <DashboardLayout>
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-2xl font-bold">Relatórios Comissões</h1>
              <HelpButton title="Como funciona Relatório de Comissões" sections={HELP_RELATORIOS} />
            </div>
            <p className="text-sm text-muted-foreground">Auditoria de comissões recebidas vs esperadas</p>
          </div>
          <Badge variant="outline" className="text-xs">Módulo Auditoria</Badge>
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="flex flex-wrap h-auto gap-1 bg-muted/50 p-1">
            {tabs.map(tab => (
              <TabsTrigger key={tab.value} value={tab.value} className="text-xs gap-1.5 data-[state=active]:bg-background">
                <tab.icon className="w-3.5 h-3.5" />
                {tab.label}
              </TabsTrigger>
            ))}
          </TabsList>

          <TabsContent value="geral">
            <CRImportTab module="geral" tableName="cr_geral" columns={GERAL_COLUMNS} title="Geral" description="Importação de dados de produção do New Corban. Upload de Excel com 17 colunas." />
          </TabsContent>
          <TabsContent value="repasse">
            <CRImportTab module="repasse" tableName="cr_repasse" columns={REPASSE_COLUMNS} title="Repasse" description="Importação de dados de repasse/pagamento com 21 colunas." />
          </TabsContent>
          <TabsContent value="seguros">
            <CRImportTab module="seguros" tableName="cr_seguros" columns={SEGUROS_COLUMNS} title="Seguros" description="Importação de dados de seguros prestamistas com 5 colunas." noHeader />
          </TabsContent>
          <TabsContent value="relatorio_import">
            <CRImportTab module="relatorio" tableName="cr_relatorio" columns={RELATORIO_COLUMNS} title="Relatório" description="Importação dos dados de vendas do New Corban (14 colunas: Data Pago, Nº Contrato, Produto, Banco, Prazo, Tabela, Valor Liberado, Seguro, CPF, Nome, Data Nasc., Telefone, Vendedor, ID)." />
          </TabsContent>
          <TabsContent value="rules_fgts"><CRRulesFGTS /></TabsContent>
          <TabsContent value="rules_clt"><CRRulesCLT /></TabsContent>
          <TabsContent value="relatorio"><CRRelatorio /></TabsContent>
          <TabsContent value="resumo"><CRResumo /></TabsContent>
          <TabsContent value="historico"><CRHistorico /></TabsContent>
          <TabsContent value="divergencias"><CRRelatorio divergenciasOnly /></TabsContent>
          <TabsContent value="import_history"><CRImportHistory moduleFilter="relatorios" /></TabsContent>
          <TabsContent value="indicadores"><CRIndicadores /></TabsContent>
          <TabsContent value="producao"><CRProductionDashboard /></TabsContent>
        </Tabs>
      </div>
    </DashboardLayout>
  );
}
