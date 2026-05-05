import DashboardLayout from '@/components/layout/DashboardLayout';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Calculator } from 'lucide-react';
import { useSearchParams } from 'react-router-dom';
import V8NovaSimulacaoTab from '@/components/v8/V8NovaSimulacaoTab';
import V8HistoricoTab from '@/components/v8/V8HistoricoTab';
import V8ConfigTab from '@/components/v8/V8ConfigTab';
import V8ConsultasTab from '@/components/v8/V8ConsultasTab';
import V8PropostasTab from '@/components/v8/V8PropostasTab';
import V8WebhooksTab from '@/components/v8/V8WebhooksTab';
import V8OperacoesTab from '@/components/v8/V8OperacoesTab';
import V8ContactPoolTab from '@/components/v8/pool/V8ContactPoolTab';
import V8InstrucoesTab from '@/components/v8/V8InstrucoesTab';
import { V8RealtimeStatusBar } from '@/components/v8/V8RealtimeStatusBar';
import V8KpisBar from '@/components/v8/V8KpisBar';
import { Badge } from '@/components/ui/badge';
import { useFeatureAccess } from '@/hooks/useFeatureAccess';
import { EmptyStateNoAccess } from '@/components/common/EmptyStateNoAccess';
import { MenuOnlyScopeBanner } from '@/components/common/MenuOnlyScopeBanner';
import { Loader2 } from 'lucide-react';

export default function V8Simulador() {
  // Etapa 11: abas legacy (Consultas, Histórico) ocultas por padrão.
  // Reaparecem com ?legacy=1 na URL — código permanece para reverter sem deploy
  // por 30 dias antes da remoção definitiva.
  const [searchParams] = useSearchParams();
  const showLegacy = searchParams.get('legacy') === '1';
  const { canSee, loading, isMenuOnly } = useFeatureAccess('v8_simulador');

  if (loading) {
    return <DashboardLayout><div className="flex items-center justify-center py-20 text-muted-foreground"><Loader2 className="w-6 h-6 animate-spin mr-2" />Carregando...</div></DashboardLayout>;
  }
  if (!canSee) {
    return <DashboardLayout><EmptyStateNoAccess feature="Simulador V8" /></DashboardLayout>;
  }

  return (
    <DashboardLayout>
      <div className="p-6 space-y-4">
        <div className="flex items-center gap-3">
          <Calculator className="w-7 h-7 text-primary" />
          <div>
            <h1 className="text-2xl font-bold">Simulador V8 CLT</h1>
            <p className="text-sm text-muted-foreground">
              Simulações em lote integradas com a V8 Sistema (Crédito do Trabalhador)
            </p>
          </div>
        </div>

        {isMenuOnly && <MenuOnlyScopeBanner feature="Simulador V8" />}

        <div className="rounded-lg border border-yellow-500/30 bg-yellow-500/10 p-3 text-sm">
          🧪 <strong>Integração em validação</strong> — confira valores antes de fechar com o cliente.
        </div>

        <V8RealtimeStatusBar />

        <V8KpisBar />

        <Tabs defaultValue="operacoes">
          <TabsList className="flex-wrap h-auto">
            <TabsTrigger value="operacoes">Operações</TabsTrigger>
            <TabsTrigger value="nova">Nova Simulação</TabsTrigger>
            <TabsTrigger value="pool">Pool de Contatos</TabsTrigger>
            <TabsTrigger value="propostas">Propostas</TabsTrigger>
            {showLegacy && (
              <>
                <TabsTrigger value="consultas">
                  Consultas <Badge variant="outline" className="ml-1 text-[10px] h-4 px-1">legacy</Badge>
                </TabsTrigger>
                <TabsTrigger value="historico">
                  Histórico <Badge variant="outline" className="ml-1 text-[10px] h-4 px-1">legacy</Badge>
                </TabsTrigger>
              </>
            )}
            <TabsTrigger value="webhooks">Webhooks</TabsTrigger>
            <TabsTrigger value="config">Configurações</TabsTrigger>
            <TabsTrigger value="instrucoes">📖 Instruções</TabsTrigger>
          </TabsList>
          <TabsContent value="operacoes" className="mt-4">
            <V8OperacoesTab />
          </TabsContent>
          <TabsContent value="nova" className="mt-4">
            <V8NovaSimulacaoTab />
          </TabsContent>
          <TabsContent value="pool" className="mt-4">
            <V8ContactPoolTab />
          </TabsContent>
          <TabsContent value="propostas" className="mt-4">
            <V8PropostasTab />
          </TabsContent>
          {showLegacy && (
            <>
              <TabsContent value="consultas" className="mt-4">
                <V8ConsultasTab />
              </TabsContent>
              <TabsContent value="historico" className="mt-4">
                <V8HistoricoTab />
              </TabsContent>
            </>
          )}
          <TabsContent value="webhooks" className="mt-4">
            <V8WebhooksTab />
          </TabsContent>
          <TabsContent value="config" className="mt-4">
            <V8ConfigTab />
          </TabsContent>
          <TabsContent value="instrucoes" className="mt-4">
            <V8InstrucoesTab />
          </TabsContent>
        </Tabs>
      </div>
    </DashboardLayout>
  );
}
