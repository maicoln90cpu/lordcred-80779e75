import { Card, CardContent } from '@/components/ui/card';
import { FileText, CalendarClock, CalendarCheck, CheckCircle2 } from 'lucide-react';
import { useMemo } from 'react';
import type { HRCandidate } from '@/hooks/useHRCandidates';

interface HRIndicatorsProps {
  candidates: HRCandidate[];
  loading: boolean;
}

export function HRIndicators({ candidates, loading }: HRIndicatorsProps) {
  const stats = useMemo(() => {
    const count = (status: string) => candidates.filter(c => c.kanban_status === status).length;
    return {
      newResume: count('new_resume'),
      scheduledE1: count('scheduled_e1'),
      scheduledE2: count('scheduled_e2'),
      approved: count('approved'),
    };
  }, [candidates]);

  const cards = [
    { label: 'Currículos novos', value: stats.newResume, icon: FileText, color: 'text-blue-500' },
    { label: 'E1 agendadas', value: stats.scheduledE1, icon: CalendarClock, color: 'text-amber-500' },
    { label: 'E2 agendadas', value: stats.scheduledE2, icon: CalendarCheck, color: 'text-purple-500' },
    { label: 'Aprovados', value: stats.approved, icon: CheckCircle2, color: 'text-emerald-500' },
  ];

  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
      {cards.map(card => (
        <Card key={card.label}>
          <CardContent className="p-4 flex items-center gap-3">
            <div className={`p-2 rounded-lg bg-muted ${card.color}`}>
              <card.icon className="w-5 h-5" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground">{card.label}</p>
              <p className="text-2xl font-bold">{loading ? '—' : card.value}</p>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
