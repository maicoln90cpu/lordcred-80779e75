import DashboardLayout from '@/components/layout/DashboardLayout';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { UserPlus, Users2, Settings as SettingsIcon } from 'lucide-react';
import { HRIndicators } from '@/components/hr/HRIndicators';
import { useHRCandidates } from '@/hooks/useHRCandidates';
import { useAuth } from '@/contexts/AuthContext';

export default function HR() {
  const { candidates, loading } = useHRCandidates();
  const { isAdmin } = useAuth();

  return (
    <DashboardLayout>
      <div className="p-6 space-y-6 max-w-[1600px] mx-auto">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <UserPlus className="w-6 h-6" />
            Recursos Humanos
          </h1>
          <p className="text-sm text-muted-foreground">
            Recrutamento de candidatos CLT, captação de parceiros e configurações de notificação.
          </p>
        </div>

        <HRIndicators candidates={candidates} loading={loading} />

        <Tabs defaultValue="candidates" className="space-y-4">
          <TabsList>
            <TabsTrigger value="candidates" className="gap-2">
              <UserPlus className="w-4 h-4" /> Candidatos CLT
            </TabsTrigger>
            <TabsTrigger value="partners" className="gap-2">
              <Users2 className="w-4 h-4" /> Funil Parceiros
            </TabsTrigger>
            {isAdmin && (
              <TabsTrigger value="settings" className="gap-2">
                <SettingsIcon className="w-4 h-4" /> Configurações
              </TabsTrigger>
            )}
          </TabsList>

          <TabsContent value="candidates">
            <div className="rounded-lg border border-dashed border-border p-12 text-center text-muted-foreground">
              <p className="text-sm">Aba do Kanban — implementada na Etapa 5.</p>
            </div>
          </TabsContent>

          <TabsContent value="partners">
            <div className="rounded-lg border border-dashed border-border p-12 text-center text-muted-foreground">
              <p className="text-sm">Funil de parceiros — implementado na Etapa 7.</p>
            </div>
          </TabsContent>

          {isAdmin && (
            <TabsContent value="settings">
              <div className="rounded-lg border border-dashed border-border p-12 text-center text-muted-foreground">
                <p className="text-sm">Configurações de timers e templates — implementadas na Etapa 8.</p>
              </div>
            </TabsContent>
          )}
        </Tabs>
      </div>
    </DashboardLayout>
  );
}
