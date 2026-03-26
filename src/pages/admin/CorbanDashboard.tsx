import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import DashboardLayout from '@/components/layout/DashboardLayout';
import { Building2, ClipboardList, Landmark, TrendingUp, Clock, CheckCircle, AlertTriangle, Wifi } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { useNavigate } from 'react-router-dom';
import { invokeCorban } from '@/lib/invokeCorban';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

export default function CorbanDashboard() {
  const navigate = useNavigate();
  const [testing, setTesting] = useState(false);
  const [connectionOk, setConnectionOk] = useState<boolean | null>(null);
  const [assetCount, setAssetCount] = useState(0);

  useEffect(() => {
    (async () => {
      const { count } = await supabase
        .from('corban_assets_cache')
        .select('id', { count: 'exact', head: true });
      setAssetCount(count || 0);
    })();
  }, []);

  const handleTestConnection = async () => {
    setTesting(true);
    const { data, error } = await invokeCorban('testConnection');
    setTesting(false);
    if (error) {
      setConnectionOk(false);
      toast.error('Falha na conexão com a API Corban', { description: error });
    } else {
      setConnectionOk(true);
      toast.success('Conexão com a API Corban estabelecida com sucesso!');
    }
  };

  const cards = [
    {
      icon: ClipboardList,
      title: 'Propostas',
      description: 'Consultar propostas por CPF, status, banco e período',
      href: '/admin/corban/propostas',
    },
    {
      icon: Landmark,
      title: 'Fila FGTS',
      description: 'Consultar e incluir CPFs na fila FGTS',
      href: '/admin/corban/fgts',
    },
    {
      icon: TrendingUp,
      title: 'Assets Sincronizados',
      description: `${assetCount} itens em cache (bancos, convênios, etc.)`,
      href: '/admin/corban/assets',
    },
    {
      icon: Clock,
      title: 'Configuração',
      description: 'Visibilidade de features por role',
      href: '/admin/corban/config',
    },
  ];

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2">
              <Building2 className="w-6 h-6 text-primary" />
              Dashboard Corban
            </h1>
            <p className="text-muted-foreground text-sm mt-1">Integração com a plataforma NewCorban</p>
          </div>
          <div className="flex items-center gap-3">
            {connectionOk !== null && (
              <Badge variant={connectionOk ? 'default' : 'destructive'} className="gap-1">
                {connectionOk ? <CheckCircle className="w-3 h-3" /> : <AlertTriangle className="w-3 h-3" />}
                {connectionOk ? 'Conectado' : 'Falha'}
              </Badge>
            )}
            <Button onClick={handleTestConnection} disabled={testing} variant="outline" size="sm">
              <Wifi className="w-4 h-4 mr-2" />
              {testing ? 'Testando...' : 'Testar Conexão'}
            </Button>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {cards.map((card, i) => (
            <motion.div
              key={card.title}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3, delay: i * 0.08 }}
            >
              <Card
                className="cursor-pointer hover:border-primary/50 transition-colors group"
                onClick={() => navigate(card.href)}
              >
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                    <card.icon className="w-4 h-4 group-hover:text-primary transition-colors" />
                    {card.title}
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-xs text-muted-foreground">{card.description}</p>
                </CardContent>
              </Card>
            </motion.div>
          ))}
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Resumo da Integração</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
              <div className="p-3 rounded-lg bg-muted/50">
                <p className="font-medium">Endpoints Disponíveis</p>
                <p className="text-muted-foreground text-xs mt-1">getPropostas, getAssets, listLogins, insertQueueFGTS, listQueueFGTS, createProposta</p>
              </div>
              <div className="p-3 rounded-lg bg-muted/50">
                <p className="font-medium">Segurança</p>
                <p className="text-muted-foreground text-xs mt-1">Credenciais no servidor (Edge Function), JWT validado, ações de escrita restritas a admin/support</p>
              </div>
              <div className="p-3 rounded-lg bg-muted/50">
                <p className="font-medium">Auditoria</p>
                <p className="text-muted-foreground text-xs mt-1">Todas as chamadas logadas em audit_logs com user, action e resultado</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}
