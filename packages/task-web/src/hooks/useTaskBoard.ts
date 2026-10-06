'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { tasks as tasksApi, type ExportTasksParams, type ListTasksParams } from '../lib/api/client';
import type {
  TaskPriorityName,
  TaskSlaState,
  TaskSortKey,
  TaskStats,
  TaskStatusName,
  TaskView,
} from '../lib/tasks/types';

export type TaskScope = 'own' | 'team';

export interface TaskBoardFilters {
  assigneeId: string;
  unassigned: boolean;
  status: TaskStatusName | '';
  priority: TaskPriorityName | '';
  sla: Exclude<TaskSlaState, 'none'> | '';
  listId: string;
  q: string;
  includeCompleted: boolean;
}

export const EMPTY_TASK_FILTERS: TaskBoardFilters = {
  assigneeId: '',
  unassigned: false,
  status: '',
  priority: '',
  sla: '',
  listId: '',
  q: '',
  includeCompleted: false,
};

export const TASK_PAGE_SIZE = 25;
// The board shows every status as a column, so it loads one larger page instead
// of paging per column. The server caps a page at 100.
export const TASK_BOARD_LIMIT = 100;

interface Options {
  scope: TaskScope;
  filters: TaskBoardFilters;
  sort: TaskSortKey;
  dir: 'asc' | 'desc';
  page: number;
  /** Table pages by TASK_PAGE_SIZE; the board asks for one big page. */
  limit: number;
}

interface UseTaskBoardReturn {
  items: TaskView[];
  total: number;
  stats: TaskStats | null;
  loading: boolean;
  error: string | null;
  /** Re-reads the list and the KPI tiles without flashing the loading state. */
  refetch: () => Promise<void>;
  setError: (message: string | null) => void;
}

/** The filters as API params, minus paging — shared by the list call and the CSV export. */
export function toExportParams(scope: TaskScope, f: TaskBoardFilters, sort: TaskSortKey, dir: 'asc' | 'desc'): ExportTasksParams {
  return {
    scope,
    sort,
    dir,
    unassigned: f.unassigned || undefined,
    // `unassigned` wins server-side, so don't send a contradictory assignee.
    assignee_id: f.unassigned ? undefined : f.assigneeId || undefined,
    status: f.status || undefined,
    priority: f.priority || undefined,
    sla_state: f.sla || undefined,
    list_id: f.listId || undefined,
    q: f.q.trim() || undefined,
    include_completed: f.includeCompleted,
  };
}

function toParams(o: Options): ListTasksParams {
  return { ...toExportParams(o.scope, o.filters, o.sort, o.dir), page: o.page, limit: o.limit };
}

export function useTaskBoard(options: Options): UseTaskBoardReturn {
  const [items, setItems] = useState<TaskView[]>([]);
  const [total, setTotal] = useState(0);
  const [stats, setStats] = useState<TaskStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const optionsRef = useRef(options);
  optionsRef.current = options;
  // A slow earlier response must not overwrite a newer one (fast filter changes).
  const requestId = useRef(0);

  const fetchData = useCallback(async (silent: boolean) => {
    const id = ++requestId.current;
    if (!silent) setLoading(true);
    const current = optionsRef.current;
    try {
      const [list, statRes] = await Promise.all([
        tasksApi.list(toParams(current)),
        tasksApi.stats({ scope: current.scope, list_id: current.filters.listId || undefined }),
      ]);
      if (id !== requestId.current) return;
      setItems(list.data);
      setTotal(list.total);
      setStats(statRes.data);
      setError(null);
    } catch (err) {
      if (id !== requestId.current) return;
      setError(err instanceof Error ? err.message : 'Failed to load tasks.');
    } finally {
      if (id === requestId.current && !silent) setLoading(false);
    }
  }, []);

  // Stringified key, not object identity, so an unchanged filter set never refetches.
  const key = JSON.stringify([options.scope, options.filters, options.sort, options.dir, options.page, options.limit]);
  useEffect(() => {
    void fetchData(false);
  }, [key, fetchData]);

  const refetch = useCallback(() => fetchData(true), [fetchData]);

  return { items, total, stats, loading, error, refetch, setError };
}
