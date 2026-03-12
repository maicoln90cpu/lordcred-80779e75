import DashboardLayout from '@/components/layout/DashboardLayout';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import LeadImporter from '@/components/admin/LeadImporter';
import LeadsTable from '@/components/admin/LeadsTable';

export default function Leads() {
  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold">Gestão de Leads</h1>
          <p className="text-muted-foreground">Importe planilhas e atribua leads aos vendedores</p>
        </div>

        <Tabs defaultValue="leads" className="space-y-4">
          <TabsList>
            <TabsTrigger value="leads">Leads</TabsTrigger>
            <TabsTrigger value="import">Importar Planilha</TabsTrigger>
          </TabsList>

          <TabsContent value="leads">
            <LeadsTable />
          </TabsContent>

          <TabsContent value="import">
            <LeadImporter />
          </TabsContent>
        </Tabs>
      </div>
    </DashboardLayout>
  );
}
