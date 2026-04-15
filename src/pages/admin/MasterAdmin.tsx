import { useEffect, useState } from 'react';
import { Crown, Loader2 } from 'lucide-react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { supabase } from '@/integrations/supabase/client';
import DashboardLayout from '@/components/layout/DashboardLayout';
import ExportDataTab from '@/components/admin/ExportDataTab';
import MigrationSQLTab from '@/components/admin/MigrationSQLTab';
import MasterModulesTab from '@/components/admin/MasterModulesTab';

export default function MasterAdmin() {
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    supabase.from('system_settings').select('id').limit(1).maybeSingle().then(() => setIsLoading(false));
  }, []);

  if (isLoading) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center h-64">
          <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex items-center gap-3">
          <Crown className="w-6 h-6 text-primary" />
          <div>
            <h1 className="text-2xl font-bold">Master Admin</h1>
            <p className="text-muted-foreground">
              Controle de módulos, exportação de dados e migração SQL
            </p>
          </div>
        </div>

        <Tabs defaultValue="modules" className="w-full">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="modules">Módulos</TabsTrigger>
            <TabsTrigger value="export">Exportar Dados</TabsTrigger>
            <TabsTrigger value="migration">SQL Migração</TabsTrigger>
          </TabsList>

          <TabsContent value="modules">
            <MasterModulesTab />
          </TabsContent>

          <TabsContent value="export">
            <ExportDataTab />
          </TabsContent>

          <TabsContent value="migration">
            <MigrationSQLTab />
          </TabsContent>
        </Tabs>
      </div>
    </DashboardLayout>
  );
}
