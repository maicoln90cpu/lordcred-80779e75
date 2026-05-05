import { Button } from '@/components/ui/button';

interface TablePaginationProps {
  page: number;
  totalPages: number;
  total?: number;
  onChange: (page: number) => void;
  label?: string;
}

/**
 * Standardized pagination footer used across tables.
 * Hidden when there is only a single page.
 */
export function TablePagination({ page, totalPages, total, onChange, label = 'registros' }: TablePaginationProps) {
  if (totalPages <= 1) return null;
  return (
    <div className="flex items-center justify-center gap-2 py-3 border-t">
      <Button variant="outline" size="sm" disabled={page === 0} onClick={() => onChange(page - 1)}>
        Anterior
      </Button>
      <span className="text-xs text-muted-foreground">
        Página {page + 1} de {totalPages}
        {typeof total === 'number' && ` (${total} ${label})`}
      </span>
      <Button variant="outline" size="sm" disabled={page >= totalPages - 1} onClick={() => onChange(page + 1)}>
        Próxima
      </Button>
    </div>
  );
}
