import { memo, DragEvent } from 'react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Phone, FileText, User, AlertTriangle, Clock } from 'lucide-react';
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

// Deterministic HSL hue from name → consistent avatar color per candidate
function avatarHue(name: string) {
  let hash = 0;
  for (let i = 0; i < name.length; i++) hash = (hash * 31 + name.charCodeAt(i)) >>> 0;
  return hash % 360;
}

function daysSince(iso: string) {
  const ms = Date.now() - new Date(iso).getTime();
  return Math.max(0, Math.floor(ms / 86_400_000));
}

export default memo(function CandidateCard({ candidate, columnColor, onClick }: Props) {
  const handleDragStart = (e: DragEvent) => {
    e.dataTransfer.setData('text/plain', candidate.id);
    e.dataTransfer.effectAllowed = 'move';
  };

  const phonePending = hasPendingPhone(candidate);
  const days = daysSince(candidate.updated_at);
  // Aging: show only when stuck >= 3 days; warning >= 7 days
  const showAging = days >= 3;
  const isStale = days >= 7;
  const hue = avatarHue(candidate.full_name);

  return (
    <div
      draggable
      onDragStart={handleDragStart}
      onClick={() => onClick(candidate)}
      className="group cursor-grab active:cursor-grabbing rounded-lg border border-border/50 bg-card p-3 shadow-sm hover:shadow-md hover:border-border hover:-translate-y-0.5 transition-all"
      style={{ borderLeft: `3px solid ${columnColor}` }}
    >
      <div className="flex items-start gap-2.5">
        <Avatar className="w-9 h-9 shrink-0 ring-2 ring-background">
          <AvatarImage src={candidate.photo_url || undefined} alt={candidate.full_name} />
          <AvatarFallback
            className="text-xs font-semibold text-foreground"
            style={{ backgroundColor: `hsl(${hue} 65% 30% / 0.4)` }}
          >
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
        {showAging && (
          <Badge
            variant="outline"
            className={`shrink-0 text-[10px] py-0 h-5 gap-1 ${
              isStale
                ? 'border-destructive/60 bg-destructive/10 text-destructive'
                : 'border-warning/60 bg-warning/10 text-warning'
            }`}
            title={`Parado nesta etapa há ${days} dia${days === 1 ? '' : 's'}`}
          >
            <Clock className="w-2.5 h-2.5" /> {days}d
          </Badge>
        )}
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
