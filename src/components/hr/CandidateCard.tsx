import { memo, DragEvent } from 'react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Phone, FileText, User, AlertTriangle } from 'lucide-react';
import type { HRCandidate } from '@/hooks/useHRCandidates';
import { formatBrazilianPhone, hasPendingPhone } from '@/lib/phoneUtils';

interface Props {
  candidate: HRCandidate;
  columnColor: string;
  onClick: (candidate: HRCandidate) => void;
}

function getInitials(name: string) {
  return name
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map(n => n[0]?.toUpperCase() ?? '')
    .join('') || '?';
}

export default memo(function CandidateCard({ candidate, columnColor, onClick }: Props) {
  const handleDragStart = (e: DragEvent) => {
    e.dataTransfer.setData('text/plain', candidate.id);
    e.dataTransfer.effectAllowed = 'move';
  };

  const phonePending = hasPendingPhone(candidate);

  return (
    <div
      draggable
      onDragStart={handleDragStart}
      onClick={() => onClick(candidate)}
      className="group cursor-grab active:cursor-grabbing rounded-lg border border-border/50 bg-card p-3 shadow-sm hover:shadow-md hover:border-border transition-all"
      style={{ borderLeft: `3px solid ${columnColor}` }}
    >
      <div className="flex items-start gap-2.5">
        <Avatar className="w-9 h-9 shrink-0">
          <AvatarImage src={candidate.photo_url || undefined} alt={candidate.full_name} />
          <AvatarFallback className="text-xs font-semibold bg-muted text-muted-foreground">
            {getInitials(candidate.full_name)}
          </AvatarFallback>
        </Avatar>
        <div className="flex-1 min-w-0">
          <h4 className="text-sm font-semibold text-foreground truncate leading-tight">
            {candidate.full_name}
          </h4>
          {candidate.phone && !phonePending && (
            <div className="flex items-center gap-1 mt-0.5 text-[11px] text-muted-foreground">
              <Phone className="w-3 h-3" />
              <span className="truncate">{formatBrazilianPhone(candidate.phone)}</span>
            </div>
          )}
        </div>
      </div>

      <div className="flex items-center gap-1.5 mt-2 flex-wrap">
        <Badge variant="outline" className="text-[10px] py-0 h-5 gap-1">
          {candidate.type === 'partner' ? (
            <><User className="w-2.5 h-2.5" /> Parceiro</>
          ) : (
            <><User className="w-2.5 h-2.5" /> CLT</>
          )}
        </Badge>
        {candidate.age != null && (
          <Badge variant="secondary" className="text-[10px] py-0 h-5">
            {candidate.age} anos
          </Badge>
        )}
        {candidate.resume_url && (
          <Badge variant="secondary" className="text-[10px] py-0 h-5 gap-1">
            <FileText className="w-2.5 h-2.5" /> CV
          </Badge>
        )}
        {phonePending && (
          <Badge
            variant="outline"
            className="text-[10px] py-0 h-5 gap-1 border-warning/60 bg-warning/10 text-warning"
            title="Telefone ausente ou inválido — atualize antes de contatar"
          >
            <AlertTriangle className="w-2.5 h-2.5" /> Tel pendente
          </Badge>
        )}
      </div>
    </div>
  );
});
