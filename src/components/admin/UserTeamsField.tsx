import { X } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import type { TeamOption } from '@/lib/userTeams';

interface UserTeamsFieldProps {
  teams: TeamOption[];
  selectedTeamIds: string[];
  onSelectedTeamIdsChange: (teamIds: string[]) => void;
  isLoading?: boolean;
  disabled?: boolean;
}

export function UserTeamsField({
  teams,
  selectedTeamIds,
  onSelectedTeamIdsChange,
  isLoading = false,
  disabled = false,
}: UserTeamsFieldProps) {
  const toggleTeam = (teamId: string) => {
    onSelectedTeamIdsChange(
      selectedTeamIds.includes(teamId)
        ? selectedTeamIds.filter((id) => id !== teamId)
        : [...selectedTeamIds, teamId],
    );
  };

  const selectedTeams = teams.filter((team) => selectedTeamIds.includes(team.id));
  const triggerLabel = isLoading
    ? 'Carregando equipes...'
    : teams.length === 0
      ? 'Nenhuma equipe cadastrada'
      : selectedTeamIds.length === 0
        ? 'Selecionar equipes...'
        : `${selectedTeamIds.length} equipe(s) selecionada(s)`;

  return (
    <div className="space-y-2">
      <Label>Equipes</Label>

      {selectedTeams.length > 0 ? (
        <div className="flex flex-wrap gap-1">
          {selectedTeams.map((team) => (
            <Badge
              key={team.id}
              variant="secondary"
              className="gap-1 px-2 py-1"
            >
              {team.name}
              {!disabled && (
                <button
                  type="button"
                  onClick={() => toggleTeam(team.id)}
                  className="inline-flex items-center"
                  aria-label={`Remover ${team.name}`}
                >
                  <X className="w-3 h-3" />
                </button>
              )}
            </Badge>
          ))}
        </div>
      ) : (
        <p className="text-xs text-muted-foreground">
          {isLoading
            ? 'Carregando vínculo de equipes...'
            : 'Este usuário ainda não participa de nenhuma equipe.'}
        </p>
      )}

      <Popover>
        <PopoverTrigger asChild>
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="w-full justify-start text-sm"
            disabled={disabled || isLoading}
          >
            {triggerLabel}
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-64 p-2" align="start">
          {teams.length === 0 ? (
            <p className="text-sm text-muted-foreground px-2 py-3">
              Crie uma equipe primeiro para poder vincular usuários.
            </p>
          ) : (
            <div className="space-y-1 max-h-48 overflow-y-auto">
              {teams.map((team) => (
                <label
                  key={team.id}
                  className="flex items-center gap-2 px-2 py-1.5 rounded hover:bg-accent cursor-pointer text-sm"
                >
                  <Checkbox
                    checked={selectedTeamIds.includes(team.id)}
                    onCheckedChange={() => toggleTeam(team.id)}
                  />
                  <span>{team.name}</span>
                </label>
              ))}
            </div>
          )}
        </PopoverContent>
      </Popover>

      <p className="text-xs text-muted-foreground">
        Escolha se o usuário participa de uma ou mais equipes.
      </p>
    </div>
  );
}