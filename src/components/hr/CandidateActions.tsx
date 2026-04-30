import { Button } from '@/components/ui/button';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { Calendar, Loader2, Save, Trash2, UserPlus } from 'lucide-react';
import type { HRCandidate } from '@/hooks/useHRCandidates';

interface Props {
  candidate: HRCandidate;
  saving: boolean;
  onSave: () => void;
  onScheduleE1?: () => void;
  onScheduleE2?: () => void;
  onMoveToPartner?: () => void;
  onDelete: () => void;
}

/**
 * Barra de ações do candidato (rodapé do modal).
 * Inclui confirmação obrigatória para "Mover para Parceiros" (item 10.15 da auditoria).
 */
export function CandidateActions({
  candidate, saving, onSave, onScheduleE1, onScheduleE2, onMoveToPartner, onDelete,
}: Props) {
  // Etapa 4C (abr/2026): liberado para QUALQUER status — candidatos não aprovados em CLT
  // podem ter perfil de parceiro. Só ocultamos se já foi migrado para evitar duplicar.
  const canMoveToPartner = candidate.kanban_status !== 'migrated_partner';

  return (
    <div className="flex flex-wrap gap-2 pt-2">
      <Button onClick={onSave} disabled={saving} className="gap-1.5">
        {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
        Salvar dados
      </Button>
      <Button variant="outline" onClick={onScheduleE1} className="gap-1.5">
        <Calendar className="w-4 h-4" /> Agendar E1
      </Button>
      <Button variant="outline" onClick={onScheduleE2} className="gap-1.5">
        <Calendar className="w-4 h-4" /> Agendar E2
      </Button>

      {canMoveToPartner && (
        <AlertDialog>
          <AlertDialogTrigger asChild>
            <Button variant="secondary" className="gap-1.5">
              <UserPlus className="w-4 h-4" /> Mover para Parceiros
            </Button>
          </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Mover para o funil de Parceiros?</AlertDialogTitle>
              <AlertDialogDescription>
                <b>{candidate.full_name}</b> será movido(a) para a aba <b>Funil Parceiros</b> e marcado(a) como
                "Virou parceiro" no Kanban. Esta ação cria automaticamente um registro de captação.
                <br /><br />
                Você poderá continuar acompanhando o progresso na aba de parceiros.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancelar</AlertDialogCancel>
              <AlertDialogAction onClick={onMoveToPartner}>Confirmar e mover</AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      )}

      <div className="ml-auto">
        <AlertDialog>
          <AlertDialogTrigger asChild>
            <Button variant="destructive" size="sm" className="gap-1.5">
              <Trash2 className="w-4 h-4" /> Excluir
            </Button>
          </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Remover candidato?</AlertDialogTitle>
              <AlertDialogDescription>
                Esta ação removerá <b>{candidate.full_name}</b> e todas as entrevistas/respostas associadas.
                Não pode ser desfeito.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancelar</AlertDialogCancel>
              <AlertDialogAction onClick={onDelete}>Remover</AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </div>
  );
}
