import { Lock, ShieldAlert } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useNavigate } from 'react-router-dom';

interface EmptyStateNoAccessProps {
  /** Nome amigável da funcionalidade exibido ao usuário */
  feature?: string;
  /** Mensagem complementar opcional */
  description?: string;
  /** Ocultar botão "Voltar" */
  hideBackButton?: boolean;
}

/**
 * Estado vazio padronizado para quando o usuário tem a feature visível no menu
 * mas não possui permissão para ver os dados (ou Master desligou globalmente).
 */
export function EmptyStateNoAccess({
  feature = 'esta funcionalidade',
  description,
  hideBackButton = false,
}: EmptyStateNoAccessProps) {
  const navigate = useNavigate();

  return (
    <div className="flex items-center justify-center py-16 px-4">
      <Card className="max-w-md w-full border-dashed">
        <CardContent className="flex flex-col items-center text-center gap-4 py-10">
          <div className="w-14 h-14 rounded-full bg-muted flex items-center justify-center">
            <Lock className="w-7 h-7 text-muted-foreground" />
          </div>
          <div className="space-y-1">
            <h3 className="text-lg font-semibold flex items-center gap-2 justify-center">
              <ShieldAlert className="w-4 h-4 text-destructive" />
              Acesso restrito
            </h3>
            <p className="text-sm text-muted-foreground">
              Você não tem permissão para visualizar os dados de <strong>{feature}</strong>.
            </p>
            {description && (
              <p className="text-xs text-muted-foreground pt-1">{description}</p>
            )}
            <p className="text-xs text-muted-foreground pt-2">
              Solicite liberação ao administrador em <em>Permissões do Sistema</em>.
            </p>
          </div>
          {!hideBackButton && (
            <Button variant="outline" size="sm" onClick={() => navigate(-1)}>
              Voltar
            </Button>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

export default EmptyStateNoAccess;
