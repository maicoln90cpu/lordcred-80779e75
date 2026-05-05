import { Eye } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';

/**
 * Banner exibido em páginas administrativas quando o usuário tem acesso
 * apenas em modo `menu_only` (vê o menu/página mas só os próprios dados).
 */
export function MenuOnlyScopeBanner({ feature }: { feature: string }) {
  return (
    <Card className="border-amber-500/40 bg-amber-500/5 mb-3">
      <CardContent className="flex items-start gap-3 py-2.5 px-3">
        <Eye className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
        <div className="text-xs">
          <p className="font-medium text-amber-700 dark:text-amber-400">
            Acesso restrito a {feature.toLowerCase()} criados por você
          </p>
          <p className="text-muted-foreground">
            Você está em modo "Só menu" — não vê itens cadastrados por outros usuários.
            Para ver tudo, peça ao administrador para liberar "Acesso total".
          </p>
        </div>
      </CardContent>
    </Card>
  );
}

export default MenuOnlyScopeBanner;
