import { useMemo } from 'react';
import { format, subDays, startOfDay, endOfDay } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

interface Message {
  id: string;
  created_at: string;
  direction: string;
}

interface MessagesChartProps {
  messages: Message[];
  title?: string;
  description?: string;
}

export function MessagesChart({ 
  messages, 
  title = "Mensagens por Dia",
  description = "Últimos 7 dias" 
}: MessagesChartProps) {
  const chartData = useMemo(() => {
    const days: { date: Date; label: string; sent: number; received: number }[] = [];
    
    for (let i = 6; i >= 0; i--) {
      const date = subDays(new Date(), i);
      days.push({
        date,
        label: format(date, 'EEE', { locale: ptBR }),
        sent: 0,
        received: 0,
      });
    }

    messages.forEach((msg) => {
      const msgDate = new Date(msg.created_at);
      const dayIndex = days.findIndex(
        (d) => msgDate >= startOfDay(d.date) && msgDate <= endOfDay(d.date)
      );
      
      if (dayIndex !== -1) {
        if (msg.direction === 'sent' || msg.direction === 'outgoing') {
          days[dayIndex].sent++;
        } else if (msg.direction === 'received' || msg.direction === 'incoming') {
          days[dayIndex].received++;
        }
      }
    });

    return days.map((d) => ({
      name: d.label,
      enviadas: d.sent,
      recebidas: d.received,
      total: d.sent + d.received,
    }));
  }, [messages]);

  return (
    <Card className="border-border/50">
      <CardHeader>
        <CardTitle>{title}</CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="h-[250px] w-full">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={chartData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
              <defs>
                <linearGradient id="colorSent" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0} />
                </linearGradient>
                <linearGradient id="colorReceived" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="hsl(var(--info))" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="hsl(var(--info))" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
              <XAxis 
                dataKey="name" 
                stroke="hsl(var(--muted-foreground))"
                fontSize={12}
              />
              <YAxis 
                stroke="hsl(var(--muted-foreground))"
                fontSize={12}
              />
              <Tooltip
                contentStyle={{
                  backgroundColor: 'hsl(var(--card))',
                  border: '1px solid hsl(var(--border))',
                  borderRadius: '8px',
                }}
                labelStyle={{ color: 'hsl(var(--foreground))' }}
              />
              <Area
                type="monotone"
                dataKey="enviadas"
                stroke="hsl(var(--primary))"
                fillOpacity={1}
                fill="url(#colorSent)"
                strokeWidth={2}
              />
              <Area
                type="monotone"
                dataKey="recebidas"
                stroke="hsl(var(--info))"
                fillOpacity={1}
                fill="url(#colorReceived)"
                strokeWidth={2}
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
        <div className="flex items-center justify-center gap-6 mt-4 text-sm">
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full bg-primary" />
            <span className="text-muted-foreground">Enviadas</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full bg-info" />
            <span className="text-muted-foreground">Recebidas</span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
