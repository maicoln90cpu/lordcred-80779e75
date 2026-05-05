import { useEffect, useMemo, useState } from 'react';
import { applySortToData, useSortState, type SortConfig } from '@/components/commission-reports/CRSortUtils';

export interface UseTableStateOptions {
  pageSize?: number;
  /** Inputs (filters) that should reset the page when they change. */
  resetPageOn?: unknown[];
}

export interface UseTableStateResult<T> {
  sort: SortConfig;
  toggleSort: (key: string) => void;
  page: number;
  setPage: (n: number | ((prev: number) => number)) => void;
  pageSize: number;
  setPageSize: (n: number) => void;
  apply: (data: T[], getValue?: (item: T, key: string) => any) => {
    sorted: T[];
    paged: T[];
    totalPages: number;
    total: number;
  };
}

/**
 * Standardized hook for table state across the app:
 * - sortable columns (via CRSortUtils)
 * - pagination (page + pageSize)
 * - automatic page reset when filter inputs change
 *
 * Usage:
 *   const table = useTableState<Row>({ pageSize: 30, resetPageOn: [filterA, filterB] });
 *   const { sorted, paged, totalPages } = table.apply(filteredRows);
 */
export function useTableState<T = any>(opts: UseTableStateOptions = {}): UseTableStateResult<T> {
  const { sort, toggle: toggleSort } = useSortState();
  const [page, setPage] = useState(0);
  const [pageSize, setPageSize] = useState(opts.pageSize ?? 30);

  // Reset page when watched filter inputs change
  const dep = JSON.stringify(opts.resetPageOn ?? []);
  useEffect(() => { setPage(0); }, [dep]);

  const apply = useMemo(() => {
    return (data: T[], getValue?: (item: T, key: string) => any) => {
      const sorted = applySortToData(data, sort, getValue);
      const totalPages = Math.max(1, Math.ceil(sorted.length / pageSize));
      const safePage = Math.min(page, totalPages - 1);
      const paged = sorted.slice(safePage * pageSize, (safePage + 1) * pageSize);
      return { sorted, paged, totalPages, total: sorted.length };
    };
  }, [sort, page, pageSize]);

  return { sort, toggleSort, page, setPage, pageSize, setPageSize, apply };
}
