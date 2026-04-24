import { useState } from 'react';
import DashboardLayout from '@/components/layout/DashboardLayout';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { UserPlus, Users2, Settings as SettingsIcon } from 'lucide-react';
import { HRIndicators } from '@/components/hr/HRIndicators';
import { HRCandidatesTab } from '@/components/hr/HRCandidatesTab';
import { HRPartnerLeadsTab } from '@/components/hr/HRPartnerLeadsTab';
import { CandidateModal } from '@/components/hr/CandidateModal';
import { CandidateCreateDialog } from '@/components/hr/CandidateCreateDialog';
import { useHRCandidates, type HRCandidate } from '@/hooks/useHRCandidates';
import { useAuth } from '@/contexts/AuthContext';

export default function HR() {
  const { candidates, loading } = useHRCandidates();
  const { isAdmin } = useAuth();
  const [selected, setSelected] = useState<HRCandidate | null>(null);
  const [createOpen, setCreateOpen] = useState(false);

  // Keep "selected" in sync with realtime updates so the open Sheet shows fresh data
  const liveSelected = selected
    ? candidates.find(c => c.id === selected.id) ?? selected
    : null;

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
            <HRCandidatesTab
              onCandidateClick={setSelected}
              onCreateClick={() => setCreateOpen(true)}
            />
          </TabsContent>

          <TabsContent value="partners">
            <HRPartnerLeadsTab />
          </TabsContent>

          {isAdmin && (
            <TabsContent value="settings">
              <div className="rounded-lg border border-dashed border-border p-12 text-center text-muted-foreground">
                <p className="text-sm">Configurações de timers e templates — implementadas na Etapa 8.</p>
              </div>
            </TabsContent>
          )}
        </Tabs>

        <CandidateModal
          open={!!selected}
          onOpenChange={(o) => !o && setSelected(null)}
          candidate={liveSelected}
        />

        <CandidateCreateDialog
          open={createOpen}
          onOpenChange={setCreateOpen}
        />
      </div>
    </DashboardLayout>
  );
}
