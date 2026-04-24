import { useRef } from 'react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { SheetTitle, SheetDescription } from '@/components/ui/sheet';
import { Badge } from '@/components/ui/badge';
import { Camera, Loader2 } from 'lucide-react';
import type { HRCandidate, HRKanbanStatus } from '@/hooks/useHRCandidates';
import { HR_COLUMNS } from './hrColumns';

interface Props {
  candidate: HRCandidate;
  photoUrl?: string | null;
  uploading: boolean;
  onPhotoSelected: (file: File) => void;
}

function getInitials(name: string) {
  return name.split(' ').filter(Boolean).slice(0, 2).map(n => n[0]?.toUpperCase() ?? '').join('') || '?';
}

const STATUS_LABEL = new Map<HRKanbanStatus, string>(HR_COLUMNS.map(c => [c.id, c.name]));

/** Cabeçalho do modal: avatar com upload de foto + nome + badges de status. */
export function CandidateHeader({ candidate, photoUrl, uploading, onPhotoSelected }: Props) {
  const inputRef = useRef<HTMLInputElement>(null);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) onPhotoSelected(file);
    if (inputRef.current) inputRef.current.value = '';
  };

  return (
    <div className="flex items-start gap-3">
      <div className="relative">
        <Avatar className="w-16 h-16">
          <AvatarImage src={photoUrl || undefined} alt={candidate.full_name} />
          <AvatarFallback className="text-lg">{getInitials(candidate.full_name)}</AvatarFallback>
        </Avatar>
        <button
          onClick={() => inputRef.current?.click()}
          className="absolute -bottom-1 -right-1 w-6 h-6 rounded-full bg-primary text-primary-foreground flex items-center justify-center shadow-md hover:scale-105 transition-transform"
          title="Trocar foto"
          disabled={uploading}
        >
          {uploading ? <Loader2 className="w-3 h-3 animate-spin" /> : <Camera className="w-3 h-3" />}
        </button>
        <input ref={inputRef} type="file" accept="image/*" hidden onChange={handleChange} />
      </div>
      <div className="flex-1 min-w-0 pt-1">
        <SheetTitle className="text-left text-xl truncate">{candidate.full_name}</SheetTitle>
        <SheetDescription className="text-left flex items-center gap-2 mt-1">
          <Badge variant="outline" className="text-[10px]">
            {candidate.type === 'partner' ? 'Parceiro' : 'CLT'}
          </Badge>
          <span className="text-xs">{STATUS_LABEL.get(candidate.kanban_status)}</span>
        </SheetDescription>
      </div>
    </div>
  );
}
