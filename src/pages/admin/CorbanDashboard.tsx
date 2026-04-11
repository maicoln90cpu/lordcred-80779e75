import DashboardLayout from '@/components/layout/DashboardLayout';
import { Building2, LayoutDashboard, BarChart3, Users, Cog } from 'lucide-react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { CorbanOverviewTab } from '@/components/corban/CorbanOverviewTab';
import { CorbanAnalyticsTab } from '@/components/corban/CorbanAnalyticsTab';
import { SellerMappingTab } from '@/components/corban/SellerMappingTab';
import { CorbanConfigTab } from '@/components/corban/CorbanConfigTab';

export default function CorbanDashboard() {
  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Building2 className="w-6 h-6 text-primary" />
            Dashboard Corban
          </h1>
          <p className="text-muted-foreground text-sm mt-1">Integração com a plataforma NewCorban</p>
        </div>

        <Tabs defaultValue="overview" className="space-y-4">
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="overview" className="gap-1.5">
              <LayoutDashboard className="w-4 h-4" />
              <span className="hidden sm:inline">Visão Geral</span>
            </TabsTrigger>
            <TabsTrigger value="analytics" className="gap-1.5">
              <BarChart3 className="w-4 h-4" />
              <span className="hidden sm:inline">Analytics</span>
            </TabsTrigger>
            <TabsTrigger value="sellers" className="gap-1.5">
              <Users className="w-4 h-4" />
              <span className="hidden sm:inline">Vendedores</span>
            </TabsTrigger>
            <TabsTrigger value="config" className="gap-1.5">
              <Cog className="w-4 h-4" />
              <span className="hidden sm:inline">Configuração</span>
            </TabsTrigger>
          </TabsList>

          <TabsContent value="overview">
            <CorbanOverviewTab />
          </TabsContent>
          <TabsContent value="analytics">
            <CorbanAnalyticsTab />
          </TabsContent>
          <TabsContent value="sellers">
            <SellerMappingTab />
          </TabsContent>
          <TabsContent value="config">
            <CorbanConfigTab />
          </TabsContent>
        </Tabs>
      </div>
    </DashboardLayout>
  );
}
