import { useMemo } from 'react';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, Legend } from 'recharts';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

interface Chip {
  id: string;
  status: string;
  slot_number: number;
}

interface ChipsStatusChartProps {
  chips: Chip[];
}

export function ChipsStatusChart({ chips }: ChipsStatusChartProps) {
  const chartData = useMemo(() => {
    const connected = chips.filter((c) => c.status === 'connected').length;
    const disconnected = chips.filter((c) => c.status === 'disconnected').length;
    const connecting = chips.filter((c) => c.status === 'connecting').length;

    return [
      { name: 'Conectados', value: connected, color: 'hsl(var(--primary))' },
      { name: 'Desconectados', value: disconnected, color: 'hsl(var(--muted-foreground))' },
      { name: 'Conectando', value: connecting, color: 'hsl(var(--warning))' },
    ].filter((d) => d.value > 0);
  }, [chips]);

  if (chips.length === 0) {
    return (
      <Card className="border-border/50">
        <CardHeader>
          <CardTitle>Status dos Chips</CardTitle>
          <CardDescription>Distribuição por status</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="h-[200px] flex items-center justify-center text-muted-foreground">
            Nenhum chip cadastrado
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="border-border/50">
      <CardHeader>
        <CardTitle>Status dos Chips</CardTitle>
        <CardDescription>Distribuição por status</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="h-[200px] w-full">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={chartData}
                cx="50%"
                cy="50%"
                innerRadius={50}
                outerRadius={80}
                paddingAngle={5}
                dataKey="value"
              >
                {chartData.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={entry.color} />
                ))}
              </Pie>
              <Tooltip
                contentStyle={{
                  backgroundColor: 'hsl(var(--card))',
                  border: '1px solid hsl(var(--border))',
                  borderRadius: '8px',
                }}
              />
              <Legend 
                formatter={(value) => (
                  <span style={{ color: 'hsl(var(--foreground))' }}>{value}</span>
                )}
              />
            </PieChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  );
}
