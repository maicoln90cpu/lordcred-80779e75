import DashboardLayout from '@/components/layout/DashboardLayout';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Calculator } from 'lucide-react';
import V8NovaSimulacaoTab from '@/components/v8/V8NovaSimulacaoTab';
import V8HistoricoTab from '@/components/v8/V8HistoricoTab';
import V8ConfigTab from '@/components/v8/V8ConfigTab';
import V8ConsultasTab from '@/components/v8/V8ConsultasTab';
import V8PropostasTab from '@/components/v8/V8PropostasTab';
import V8WebhooksTab from '@/components/v8/V8WebhooksTab';
import V8OperacoesTab from '@/components/v8/V8OperacoesTab';
import { V8RealtimeStatusBar } from '@/components/v8/V8RealtimeStatusBar';
import { Badge } from '@/components/ui/badge';

export default function V8Simulador() {
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

        <div className="rounded-lg border border-yellow-500/30 bg-yellow-500/10 p-3 text-sm">
          🧪 <strong>Integração em validação</strong> — confira valores antes de fechar com o cliente.
        </div>

        <V8RealtimeStatusBar />

        <Tabs defaultValue="operacoes">
          <TabsList className="flex-wrap h-auto">
            <TabsTrigger value="operacoes" className="gap-1.5">
              Operações
              <Badge variant="secondary" className="text-[10px] h-4 px-1">novo</Badge>
            </TabsTrigger>
            <TabsTrigger value="nova">Nova Simulação</TabsTrigger>
            <div className="mx-2 h-5 w-px bg-border self-center" aria-hidden />
            <span className="text-[10px] uppercase tracking-wide text-muted-foreground self-center mr-1">Avançado</span>
            <TabsTrigger value="consultas">Consultas</TabsTrigger>
            <TabsTrigger value="propostas">Propostas</TabsTrigger>
            <TabsTrigger value="historico">Histórico</TabsTrigger>
            <div className="mx-2 h-5 w-px bg-border self-center" aria-hidden />
            <span className="text-[10px] uppercase tracking-wide text-muted-foreground self-center mr-1">Diagnóstico</span>
            <TabsTrigger value="webhooks">Webhooks</TabsTrigger>
            <TabsTrigger value="config">Configurações</TabsTrigger>
          </TabsList>
          <TabsContent value="operacoes" className="mt-4">
            <V8OperacoesTab />
          </TabsContent>
          <TabsContent value="nova" className="mt-4">
            <V8NovaSimulacaoTab />
          </TabsContent>
          <TabsContent value="consultas" className="mt-4">
            <V8ConsultasTab />
          </TabsContent>
          <TabsContent value="propostas" className="mt-4">
            <V8PropostasTab />
          </TabsContent>
          <TabsContent value="historico" className="mt-4">
            <V8HistoricoTab />
          </TabsContent>
          <TabsContent value="webhooks" className="mt-4">
            <V8WebhooksTab />
          </TabsContent>
          <TabsContent value="config" className="mt-4">
            <V8ConfigTab />
          </TabsContent>
        </Tabs>
      </div>
    </DashboardLayout>
  );
}

