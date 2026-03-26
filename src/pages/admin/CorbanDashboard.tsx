import DashboardLayout from '@/components/layout/DashboardLayout';
import { Building2, ClipboardList, Landmark, TrendingUp, Clock } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useNavigate } from 'react-router-dom';
import { invokeCorban } from '@/lib/invokeCorban';
import { useState } from 'react';
import { toast } from 'sonner';

export default function CorbanDashboard() {
  const navigate = useNavigate();
  const [testing, setTesting] = useState(false);

  const handleTestConnection = async () => {
    setTesting(true);
    const { data, error } = await invokeCorban('testConnection');
    setTesting(false);
    if (error) {
      toast.error('Falha na conexão com a API Corban', { description: error });
    } else {
      toast.success('Conexão com a API Corban estabelecida com sucesso!');
    }
  };

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
          <Button onClick={handleTestConnection} disabled={testing} variant="outline">
            {testing ? 'Testando...' : 'Testar Conexão'}
          </Button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <Card className="cursor-pointer hover:border-primary/50 transition-colors" onClick={() => navigate('/admin/corban/propostas')}>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                <ClipboardList className="w-4 h-4" />
                Propostas
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold">—</p>
              <p className="text-xs text-muted-foreground">Consultar propostas por status, banco e período</p>
            </CardContent>
          </Card>

          <Card className="cursor-pointer hover:border-primary/50 transition-colors" onClick={() => navigate('/admin/corban/fgts')}>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                <Landmark className="w-4 h-4" />
                Fila FGTS
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold">—</p>
              <p className="text-xs text-muted-foreground">Consultas FGTS pendentes e concluídas</p>
            </CardContent>
          </Card>

          <Card className="cursor-pointer hover:border-primary/50 transition-colors" onClick={() => navigate('/admin/corban/assets')}>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                <TrendingUp className="w-4 h-4" />
                Assets Sincronizados
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold">—</p>
              <p className="text-xs text-muted-foreground">Bancos, convênios, produtos e status</p>
            </CardContent>
          </Card>

          <Card className="cursor-pointer hover:border-primary/50 transition-colors" onClick={() => navigate('/admin/corban/config')}>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                <Clock className="w-4 h-4" />
                Configuração
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold">⚙</p>
              <p className="text-xs text-muted-foreground">Credenciais e visibilidade de features</p>
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Resumo da Integração</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">
              A integração com a NewCorban permite consultar propostas, gerenciar fila FGTS, sincronizar assets (bancos, convênios, produtos) e criar propostas diretamente a partir dos leads do sistema.
              Use o botão "Testar Conexão" para verificar se as credenciais estão configuradas corretamente.
            </p>
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}
