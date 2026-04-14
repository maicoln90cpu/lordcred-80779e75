import { useEffect, useState } from 'react';
import { Crown, Loader2 } from 'lucide-react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { supabase } from '@/integrations/supabase/client';
import DashboardLayout from '@/components/layout/DashboardLayout';
import ExportDataTab from '@/components/admin/ExportDataTab';
import MigrationSQLTab from '@/components/admin/MigrationSQLTab';

export default function MasterAdmin() {
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    // Quick check to confirm settings exist
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
              Exportação de dados e migração SQL — acesso exclusivo master
            </p>
          </div>
        </div>

        <Tabs defaultValue="export" className="w-full">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="export">Exportar Dados</TabsTrigger>
            <TabsTrigger value="migration">SQL Migração</TabsTrigger>
          </TabsList>

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
