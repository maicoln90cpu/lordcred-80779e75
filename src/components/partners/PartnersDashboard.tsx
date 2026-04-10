import { useMemo } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Users, TrendingUp, Clock, AlertTriangle } from 'lucide-react';

interface Partner {
  id: string;
  pipeline_status: string;
  created_at: string;
  updated_at: string;
  nome: string;
  [key: string]: any;
}

const PIPELINE_ORDER = [
  'contato_inicial', 'reuniao_marcada', 'link_enviado', 'confirmou',
  'mei_pendente', 'mei_criado', 'contrato_pendente', 'contrato_assinado',
  'em_treinamento', 'ativo', 'desistencia'
];

const ACTIVE_STATUSES = ['contrato_assinado', 'em_treinamento', 'ativo'];

export function PartnersDashboard({ partners }: { partners: Partner[] }) {
  const stats = useMemo(() => {
    const total = partners.length;
    const ativos = partners.filter(p => ACTIVE_STATUSES.includes(p.pipeline_status)).length;
    const desistencias = partners.filter(p => p.pipeline_status === 'desistencia').length;
    const taxaConversao = total > 0 ? Math.round((ativos / total) * 100) : 0;

    const now = Date.now();
    const INACTIVITY_DAYS = 7;
    const inativos = partners.filter(p => {
      const lastUpdate = new Date(p.updated_at).getTime();
      const daysSince = (now - lastUpdate) / (1000 * 60 * 60 * 24);
      return daysSince > INACTIVITY_DAYS && !['ativo', 'desistencia'].includes(p.pipeline_status);
    }).length;

    return { total, ativos, desistencias, taxaConversao, inativos };
  }, [partners]);

  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
      <Card>
        <CardContent className="p-4 flex items-center gap-3">
          <div className="p-2 rounded-lg bg-primary/10">
            <Users className="w-5 h-5 text-primary" />
          </div>
          <div>
            <p className="text-2xl font-bold">{stats.total}</p>
            <p className="text-xs text-muted-foreground">Total Parceiros</p>
          </div>
        </CardContent>
      </Card>
      <Card>
        <CardContent className="p-4 flex items-center gap-3">
          <div className="p-2 rounded-lg bg-green-500/10">
            <TrendingUp className="w-5 h-5 text-green-500" />
          </div>
          <div>
            <p className="text-2xl font-bold">{stats.taxaConversao}%</p>
            <p className="text-xs text-muted-foreground">Conversão ({stats.ativos} ativos)</p>
          </div>
        </CardContent>
      </Card>
      <Card>
        <CardContent className="p-4 flex items-center gap-3">
          <div className="p-2 rounded-lg bg-amber-500/10">
            <Clock className="w-5 h-5 text-amber-500" />
          </div>
          <div>
            <p className="text-2xl font-bold">{stats.inativos}</p>
            <p className="text-xs text-muted-foreground">Inativos (+7 dias)</p>
          </div>
        </CardContent>
      </Card>
      <Card>
        <CardContent className="p-4 flex items-center gap-3">
          <div className="p-2 rounded-lg bg-destructive/10">
            <AlertTriangle className="w-5 h-5 text-destructive" />
          </div>
          <div>
            <p className="text-2xl font-bold">{stats.desistencias}</p>
            <p className="text-xs text-muted-foreground">Desistências</p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
