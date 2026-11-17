/**
 * usePagination — lightweight hook that owns page state and produces
 * the query-string params needed to call a paginated API endpoint.
 *
 * Usage:
 *   const { page, perPage, meta, setPage, setMeta } = usePagination(50);
 */
import { useState, useCallback } from 'react';

export interface PaginationMeta {
  page: number;
  perPage: number;
  total: number;
  totalPages: number;
}

export function usePagination(defaultPerPage = 50) {
  const [page, setPageState] = useState(1);
  const [perPage] = useState(defaultPerPage);
  const [meta, setMetaState] = useState<PaginationMeta>({
    page: 1,
    perPage: defaultPerPage,
    total: 0,
    totalPages: 1,
  });

  const setPage = useCallback((p: number) => {
    setPageState(p);
  }, []);

  const setMeta = useCallback(
    (raw: { page: number; perPage: number; total: number }) => {
      setMetaState({
        page: raw.page,
        perPage: raw.perPage,
        total: raw.total,
        totalPages: Math.max(1, Math.ceil(raw.total / raw.perPage)),
      });
    },
    [],
  );

  return { page, perPage, meta, setPage, setMeta };
}









