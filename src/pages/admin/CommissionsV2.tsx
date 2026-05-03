import { useState, useEffect } from 'react';
import DashboardLayout from '@/components/layout/DashboardLayout';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { DollarSign, Lightbulb, ClipboardList, Target } from 'lucide-react';
import CommIndicadores from '@/components/commission-reports/CommIndicadores';
import CommMetas from '@/components/commission-reports/CommMetas';
import { HelpButton, HELP_PARCEIROS } from '@/components/commission-reports/HelpModal';
import BaseTab from '@/components/commissions-v2/BaseTab';
import PixTab from '@/components/commissions-v2/PixTab';
import RatesFGTSTab from '@/components/commissions-v2/RatesFGTSTab';
import RatesCLTTab from '@/components/commissions-v2/RatesCLTTab';
import ExtratoTab from '@/components/commissions-v2/ExtratoTab';
import ConsolidadoTab from '@/components/commissions-v2/ConsolidadoTab';
import ConfigTab from '@/components/commissions-v2/ConfigTab';
import HistImportTab from '@/components/commissions-v2/HistImportTab';
import V2BetaBanner from '@/components/commissions-v2/V2BetaBanner';
import type { Profile } from '@/components/commissions-v2/commissionUtils';

export default function CommissionsV2() {
  const { user, isAdmin } = useAuth();
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [activeTab, setActiveTab] = useState('base');

  useEffect(() => {
    loadProfiles();
  }, []);

  const loadProfiles = async () => {
    const { data } = await supabase.rpc('get_visible_profiles');
    if (data) setProfiles(data as unknown as Profile[]);
  };

  const getSellerName = (sellerId: string) => {
    const p = profiles.find(pr => pr.user_id === sellerId);
    return p?.name || p?.email || sellerId.slice(0, 8);
  };

  return (
    <DashboardLayout>
      <div className="space-y-4">
        <div className="flex items-center gap-3">
          <DollarSign className="w-6 h-6 text-primary" />
          <h1 className="text-2xl font-bold">Comissões Parceiros</h1>
          <HelpButton title="Como funciona Comissões Parceiros" sections={HELP_PARCEIROS} />
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <V2BetaBanner />
          <TabsList className="flex-wrap h-auto">
            <TabsTrigger value="base">Base</TabsTrigger>
            <TabsTrigger value="pix">PIX</TabsTrigger>
            {isAdmin && <TabsTrigger value="rates-fgts">Taxas FGTS</TabsTrigger>}
            {isAdmin && <TabsTrigger value="rates-clt">Taxas CLT</TabsTrigger>}
            <TabsTrigger value="extrato">Extrato</TabsTrigger>
            {isAdmin && <TabsTrigger value="consolidado">Consolidado</TabsTrigger>}
            {isAdmin && <TabsTrigger value="config">Configurações</TabsTrigger>}
            {isAdmin && <TabsTrigger value="indicadores"><Lightbulb className="w-3.5 h-3.5 mr-1" />Indicadores</TabsTrigger>}
            {isAdmin && <TabsTrigger value="metas"><Target className="w-3.5 h-3.5 mr-1" />Metas</TabsTrigger>}
            {isAdmin && <TabsTrigger value="hist-importacoes"><ClipboardList className="w-3.5 h-3.5 mr-1" />Hist. Importações</TabsTrigger>}
          </TabsList>

          <TabsContent value="base">
            <BaseTab profiles={profiles} getSellerName={getSellerName} isAdmin={isAdmin} userId={user?.id || ''} />
          </TabsContent>
          <TabsContent value="pix">
            <PixTab profiles={profiles} getSellerName={getSellerName} isAdmin={isAdmin} userId={user?.id || ''} />
          </TabsContent>
          {isAdmin && (
            <TabsContent value="rates-fgts">
              <RatesFGTSTab />
            </TabsContent>
          )}
          {isAdmin && (
            <TabsContent value="rates-clt">
              <RatesCLTTab />
            </TabsContent>
          )}
          <TabsContent value="extrato">
            <ExtratoTab profiles={profiles} getSellerName={getSellerName} isAdmin={isAdmin} userId={user?.id || ''} />
          </TabsContent>
          {isAdmin && (
            <TabsContent value="consolidado">
              <ConsolidadoTab profiles={profiles} getSellerName={getSellerName} />
            </TabsContent>
          )}
          {isAdmin && (
            <TabsContent value="config">
              <ConfigTab profiles={profiles} getSellerName={getSellerName} />
            </TabsContent>
          )}
          {isAdmin && (
            <TabsContent value="indicadores">
              <CommIndicadores
                profiles={profiles}
                getSellerName={getSellerName}
                salesTable="commission_sales_v2"
                cltRatesTable="commission_rates_clt_v2"
                fgtsRatesTable="commission_rates_fgts_v2"
              />
            </TabsContent>
          )}
          {isAdmin && (
            <TabsContent value="metas">
              <CommMetas
                profiles={profiles}
                getSellerName={getSellerName}
                salesTable="commission_sales_v2"
                settingsTable="commission_settings_v2"
                rewardsTable="commission_annual_rewards_v2"
                bonusTiersTable="commission_bonus_tiers_v2"
              />
            </TabsContent>
          )}
          {isAdmin && (
            <TabsContent value="hist-importacoes">
              <HistImportTab userId={user?.id || ''} profiles={profiles} getSellerName={getSellerName} />
            </TabsContent>
          )}
        </Tabs>
      </div>
    </DashboardLayout>
  );
}
