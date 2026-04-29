import { useState } from "react";
import { Button, type ButtonProps } from "@/components/ui/button";
import { FilePlus2 } from "lucide-react";
import CreateOperationDialog from "./CreateOperationDialog";
import type { DraftOrigin } from "@/hooks/useV8OperationDraft";

interface CreateOperationButtonProps extends Omit<ButtonProps, "onClick"> {
  consultId?: string | null;
  simulationId?: string | null;
  origin: DraftOrigin;
  originId?: string | null;
  prefill?: {
    cpf?: string;
    name?: string;
    birth_date?: string;
    phone?: string;
    email?: string;
  };
  onCreated?: (operationId: string | null) => void;
  label?: string;
}

/**
 * Botão reutilizável que abre o CreateOperationDialog (Etapa 5).
 * Pode ser dropado em V8OperacoesTab, V8HistoricoTab, Leads/Kanban etc.
 */
export default function CreateOperationButton({
  consultId, simulationId, origin, originId, prefill, onCreated, label = "Criar proposta",
  variant = "default", size = "sm", ...rest
}: CreateOperationButtonProps) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button variant={variant} size={size} onClick={() => setOpen(true)} {...rest}>
        <FilePlus2 className="w-4 h-4 mr-1" />
        {label}
      </Button>
      <CreateOperationDialog
        open={open}
        onOpenChange={setOpen}
        consultId={consultId}
        simulationId={simulationId}
        origin={origin}
        originId={originId}
        prefill={prefill}
        onCreated={onCreated}
      />
    </>
  );
}
