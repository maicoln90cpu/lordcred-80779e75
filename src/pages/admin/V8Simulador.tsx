import DashboardLayout from '@/components/layout/DashboardLayout';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Calculator } from 'lucide-react';
import V8NovaSimulacaoTab from '@/components/v8/V8NovaSimulacaoTab';
import V8HistoricoTab from '@/components/v8/V8HistoricoTab';
import V8ConfigTab from '@/components/v8/V8ConfigTab';
import V8ConsultasTab from '@/components/v8/V8ConsultasTab';
import { V8RealtimeStatusBar } from '@/components/v8/V8RealtimeStatusBar';

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

        <Tabs defaultValue="nova">
          <TabsList>
            <TabsTrigger value="nova">Nova Simulação</TabsTrigger>
            <TabsTrigger value="consultas">Consultas</TabsTrigger>
            <TabsTrigger value="historico">Histórico</TabsTrigger>
            <TabsTrigger value="config">Configurações</TabsTrigger>
          </TabsList>
          <TabsContent value="nova" className="mt-4">
            <V8NovaSimulacaoTab />
          </TabsContent>
          <TabsContent value="consultas" className="mt-4">
            <V8ConsultasTab />
          </TabsContent>
          <TabsContent value="historico" className="mt-4">
            <V8HistoricoTab />
          </TabsContent>
          <TabsContent value="config" className="mt-4">
            <V8ConfigTab />
          </TabsContent>
        </Tabs>
      </div>
    </DashboardLayout>
  );
}
