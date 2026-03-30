import { useState } from 'react';
import DashboardLayout from '@/components/layout/DashboardLayout';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { FileSpreadsheet, ArrowRightLeft, Shield, Calculator, BarChart3, History, AlertTriangle, Upload, Settings, ClipboardList } from 'lucide-react';
import CRImportTab, { GERAL_COLUMNS, REPASSE_COLUMNS, SEGUROS_COLUMNS } from '@/components/commission-reports/CRImportTab';
import CRImportHistory from '@/components/commission-reports/CRImportHistory';

export default function CommissionReports() {
  const [activeTab, setActiveTab] = useState('geral');

  const tabs = [
    { value: 'geral', label: 'Geral', icon: FileSpreadsheet },
    { value: 'repasse', label: 'Repasse', icon: ArrowRightLeft },
    { value: 'seguros', label: 'Seguros', icon: Shield },
    { value: 'rules_fgts', label: 'Regras FGTS', icon: Settings },
    { value: 'rules_clt', label: 'Regras CLT', icon: Settings },
    { value: 'relatorio', label: 'Relatório', icon: Calculator },
    { value: 'resumo', label: 'Resumo', icon: BarChart3 },
    { value: 'historico', label: 'Histórico', icon: History },
    { value: 'divergencias', label: 'Divergências', icon: AlertTriangle },
    { value: 'import_history', label: 'Hist. Importações', icon: ClipboardList },
  ];

  return (
    <DashboardLayout>
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold">Relatórios Comissões</h1>
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
            <CRImportTab
              module="geral"
              tableName="cr_geral"
              columns={GERAL_COLUMNS}
              title="Geral"
              description="Importação de dados de produção do New Corban. Upload de Excel com 17 colunas (Data Pgt, ADE, CPF, Nome, Banco, Prod Líq, etc)."
            />
          </TabsContent>

          <TabsContent value="repasse">
            <CRImportTab
              module="repasse"
              tableName="cr_repasse"
              columns={REPASSE_COLUMNS}
              title="Repasse"
              description="Importação de dados de repasse/pagamento com 21 colunas (inclui Rateio, CMS REP Favorecido, Favorecido)."
            />
          </TabsContent>

          <TabsContent value="seguros">
            <CRImportTab
              module="seguros"
              tableName="cr_seguros"
              columns={SEGUROS_COLUMNS}
              title="Seguros"
              description="Importação de dados de seguros prestamistas com 5 colunas. Planilha pode não ter cabeçalho."
              noHeader
            />
          </TabsContent>

          <TabsContent value="rules_fgts">
            <PlaceholderTab title="Regras FGTS" description="CRUD de regras de comissão FGTS por banco, tabela, seguro e faixa de valor." />
          </TabsContent>
          <TabsContent value="rules_clt">
            <PlaceholderTab title="Regras CLT" description="CRUD de regras de comissão CLT por banco, tabela, seguro e faixa de prazo." />
          </TabsContent>
          <TabsContent value="relatorio">
            <PlaceholderTab title="Relatório" description="Tabela calculada cruzando Geral + Repasse + Seguros + Regras. Comissão esperada vs recebida." />
          </TabsContent>
          <TabsContent value="resumo">
            <PlaceholderTab title="Resumo" description="Dashboard com totais do período, cards de valor liberado, comissão esperada/recebida e diferença." />
          </TabsContent>
          <TabsContent value="historico">
            <PlaceholderTab title="Histórico" description="Fechamentos salvos com resumo e detalhamento por contrato." />
          </TabsContent>
          <TabsContent value="divergencias">
            <PlaceholderTab title="Divergências" description="Contratos com diferença entre comissão esperada e recebida. Filtros por banco, produto e tipo." />
          </TabsContent>

          <TabsContent value="import_history">
            <CRImportHistory moduleFilter="relatorios" />
          </TabsContent>
        </Tabs>
      </div>
    </DashboardLayout>
  );
}

function PlaceholderTab({ title, description }: { title: string; description: string }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg">{title}</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="flex flex-col items-center justify-center py-16 text-center text-muted-foreground">
          <Upload className="w-12 h-12 mb-4 opacity-30" />
          <p className="text-sm max-w-md">{description}</p>
          <Badge variant="secondary" className="mt-4">Implementação na próxima etapa</Badge>
        </div>
      </CardContent>
    </Card>
  );
}
