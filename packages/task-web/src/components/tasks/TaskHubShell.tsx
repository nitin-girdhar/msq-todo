'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import type { SessionUser } from '@platform/types';
import { Alert, Button, PageBody, PageHeader, Pagination, useIsMobile } from '@platform/ui-kit';
import { tasks as tasksApi, taskLists as taskListsApi } from '../../lib/api/client';
import type { TaskListView, TaskSortKey, TaskStatusName, TaskView } from '../../lib/tasks/types';
import {
  EMPTY_TASK_FILTERS,
  TASK_BOARD_LIMIT,
  TASK_PAGE_SIZE,
  toExportParams,
  useTaskBoard,
  type TaskBoardFilters,
  type TaskScope,
} from '../../hooks/useTaskBoard';
import { useAssignableUsers } from '../../hooks/useAssignableUsers';
import { notifyTasksChanged } from '../../hooks/useOverdueTaskCount';
import {
  canAssignTasks,
  canBulkUpdateTasks,
  canDeleteTasks,
  canExportTasks,
} from '../../lib/tasks/permissions';
import TasksTabs from './TasksTabs';
import TaskStatsCards, { type TaskTileId } from './TaskStatsCards';
import TaskFilterBar from './TaskFilterBar';
import TaskQuickAdd, { type QuickAddValues } from './TaskQuickAdd';
import TaskTable from './TaskTable';
import TaskBoard from './TaskBoard';
import MobileTaskCard from './MobileTaskCard';
import TaskBulkBar from './TaskBulkBar';
import TaskCreateModal from './TaskCreateModal';
import TaskDetailDrawer from './TaskDetailDrawer';

type ViewMode = 'table' | 'board';
const VIEW_KEY = 'task:view';

interface Props {
  actor: SessionUser;
  /** `own` = My Tasks (created by / assigned to me); `team` = my reports' work. */
  scope: TaskScope;
}

const TILE_STATUS: Partial<Record<TaskTileId, TaskStatusName>> = {
  todo: 'todo',
  in_progress: 'in_progress',
  blocked: 'blocked',
};

// Which KPI tile is lit is derived from the filters, so it stays in step when the
// same filter is chosen from the bar.
function activeTile(f: TaskBoardFilters): TaskTileId {
  if (f.unassigned && !f.status && !f.sla) return 'unassigned';
  if (f.sla === 'overdue' && !f.status && !f.unassigned) return 'overdue';
  if (f.status && !f.sla && !f.unassigned && (f.status === 'todo' || f.status === 'in_progress' || f.status === 'blocked')) {
    return f.status;
  }
  return 'all';
}

function readView(): ViewMode {
  try {
    return window.localStorage.getItem(VIEW_KEY) === 'board' ? 'board' : 'table';
  } catch {
    return 'table';
  }
}

export default function TaskHubShell({ actor, scope }: Props) {
  const isMobile = useIsMobile();
  const [filters, setFilters] = useState<TaskBoardFilters>(EMPTY_TASK_FILTERS);
  const [sort, setSort] = useState<TaskSortKey>('created_at');
  const [dir, setDir] = useState<'asc' | 'desc'>('desc');
  const [page, setPage] = useState(1);
  const [view, setView] = useState<ViewMode>('table');
  const [selectedIds, setSelectedIds] = useState<ReadonlySet<string>>(new Set());
  const [openTask, setOpenTask] = useState<TaskView | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [lists, setLists] = useState<TaskListView[]>([]);
  const [notice, setNotice] = useState<string | null>(null);
  const [exporting, setExporting] = useState(false);

  const assignableUsers = useAssignableUsers();
  const canAssign = canAssignTasks(actor);
  const canBulk = canBulkUpdateTasks(actor);
  const canExport = canExportTasks(actor);

  // The saved choice is read after mount so server and first client render agree.
  useEffect(() => { setView(readView()); }, []);

  // Phones always get cards; the board is a desktop view.
  const effectiveView: ViewMode = isMobile ? 'table' : view;
  const boardMode = effectiveView === 'board';

  const { items, total, stats, loading, error, refetch, setError } = useTaskBoard({
    scope,
    filters,
    sort,
    dir,
    page: boardMode ? 1 : page,
    limit: boardMode ? TASK_BOARD_LIMIT : TASK_PAGE_SIZE,
  });

  useEffect(() => {
    taskListsApi
      .list({ scope: scope === 'team' ? 'team' : 'own', limit: 100 })
      .then((res) => setLists(res.data))
      .catch(() => setLists([]));
  }, [scope]);

  const clearSelection = useCallback(() => setSelectedIds(new Set()), []);

  // Re-read the list + tiles, and tell the nav badge to re-count.
  const afterChange = useCallback(async () => {
    await refetch();
    notifyTasksChanged();
  }, [refetch]);

  const changeFilters = (patch: Partial<TaskBoardFilters>) => {
    setFilters((p) => ({ ...p, ...patch }));
    setPage(1);
    clearSelection();
  };

  const selectTile = (tile: TaskTileId) => {
    const reset = { status: '' as const, sla: '' as const, unassigned: false };
    if (tile === 'all' || tile === activeTile(filters)) return changeFilters(reset);
    if (tile === 'overdue') return changeFilters({ ...reset, sla: 'overdue' });
    if (tile === 'unassigned') return changeFilters({ ...reset, unassigned: true });
    return changeFilters({ ...reset, status: TILE_STATUS[tile] ?? '' });
  };

  const changeSort = (key: TaskSortKey) => {
    if (key === sort) setDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    else { setSort(key); setDir(key === 'created_at' || key === 'task_no' ? 'desc' : 'asc'); }
    setPage(1);
    clearSelection();
  };

  const chooseView = (v: ViewMode) => {
    setView(v);
    setPage(1);
    clearSelection();
    try { window.localStorage.setItem(VIEW_KEY, v); } catch { /* a remembered tab is a convenience only */ }
  };

  const toggleOne = (id: string) =>
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });

  const toggleAll = (ids: string[], checked: boolean) =>
    setSelectedIds((prev) => {
      const next = new Set(prev);
      for (const id of ids) { if (checked) next.add(id); else next.delete(id); }
      return next;
    });

  const bulkTargets = useMemo(() => items.filter((t) => selectedIds.has(t.id)), [items, selectedIds]);

  const quickAdd = async (v: QuickAddValues) => {
    setError(null);
    try {
      await tasksApi.create({
        title: v.title,
        list_id: filters.listId || null,
        status_name: 'todo',
        priority_name: v.priority_name,
        due_at: v.due_at,
      });
      await afterChange();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create the task.');
    }
  };

  const moveTask = async (task: TaskView, status: TaskStatusName) => {
    setError(null);
    try {
      await tasksApi.update(task.id, { status_name: status, expected_updated_at: new Date(task.updated_at).toISOString() });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update the task.');
    }
    // On success this shows the new column; on a 409 it pulls the current row so
    // the board stops showing the version the user just failed to write over.
    await afterChange();
  };

  const exportCsv = async () => {
    setExporting(true);
    setNotice(null);
    setError(null);
    try {
      const { blob, filename, truncated } = await tasksApi.exportCsv(toExportParams(scope, filters, sort, dir));
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
      if (truncated) setNotice('The export was capped at 5,000 tasks. Narrow the filters to get the rest.');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Export failed.');
    } finally {
      setExporting(false);
    }
  };

  const isTeam = scope === 'team';

  return (
    <div className="flex w-full flex-1 flex-col">
      <PageHeader
        title={isTeam ? 'Team tasks' : 'My Tasks'}
        subtitle={isTeam ? 'Work across your team, with SLA status.' : `Everything you created or are assigned, ${actor.name || actor.email}.`}
        tabs={<TasksTabs actor={actor} />}
        actions={
          <>
            {canExport && (
              <Button variant="secondary" onClick={() => void exportCsv()} disabled={exporting || total === 0}>
                {exporting ? 'Exporting…' : 'Export CSV'}
              </Button>
            )}
            <Button variant="primary" onClick={() => setCreateOpen(true)}>+ New task</Button>
          </>
        }
      />

      <PageBody>
        {error && <Alert tone="error">{error}</Alert>}
        {notice && <Alert tone="success">{notice}</Alert>}

        <TaskStatsCards scope={scope} stats={stats} active={activeTile(filters)} onSelect={selectTile} />

        {!isTeam && <TaskQuickAdd onCreate={quickAdd} />}

        <div className="flex flex-wrap items-end justify-between gap-3">
          <TaskFilterBar
            filters={filters}
            assignableUsers={assignableUsers}
            lists={lists}
            onChange={changeFilters}
            completedCount={stats?.completed}
          />
          {!isMobile && (
            <div role="group" aria-label="View" className="flex overflow-hidden rounded-lg border border-outline-variant">
              {(['table', 'board'] as const).map((v) => (
                <button
                  key={v}
                  type="button"
                  aria-pressed={view === v}
                  onClick={() => chooseView(v)}
                  className={`h-[34px] px-3 text-xs font-semibold capitalize ${
                    view === v ? 'bg-primary text-on-primary' : 'bg-surface-container-lowest text-on-surface-variant hover:bg-surface-container-low'
                  }`}
                >
                  {v === 'table' ? 'List' : 'Board'}
                </button>
              ))}
            </div>
          )}
        </div>

        {canBulk && (
          <TaskBulkBar
            targets={bulkTargets}
            assignableUsers={assignableUsers}
            canAssign={canAssign}
            onClear={clearSelection}
            onApplied={() => void afterChange()}
          />
        )}

        {loading ? (
          <div className="flex items-center justify-center py-12 text-sm text-outline" role="status">Loading…</div>
        ) : items.length === 0 ? (
          <p className="rounded-xl border border-dashed border-outline-variant bg-surface-container-lowest px-4 py-8 text-center text-sm text-outline">
            {isTeam ? 'No team tasks match these filters.' : 'No tasks match these filters.'}
          </p>
        ) : boardMode ? (
          <TaskBoard tasks={items} includeCompleted={filters.includeCompleted} onOpen={setOpenTask} onMove={moveTask} />
        ) : isMobile ? (
          <div className="-mx-4 flex flex-col gap-3 sm:-mx-5">
            {items.map((t) => (
              <MobileTaskCard
                key={t.id}
                task={t}
                selected={selectedIds.has(t.id)}
                onToggle={canBulk ? toggleOne : undefined}
                onOpen={setOpenTask}
              />
            ))}
          </div>
        ) : (
          <TaskTable
            tasks={items}
            selected={selectedIds}
            onToggle={canBulk ? toggleOne : undefined}
            onToggleAll={canBulk ? toggleAll : undefined}
            sort={sort}
            dir={dir}
            onSort={changeSort}
            onOpen={setOpenTask}
          />
        )}

        {!loading && !boardMode && total > TASK_PAGE_SIZE && (
          <div className="rounded-xl bg-surface-container-lowest shadow-card">
            <Pagination page={page} pageSize={TASK_PAGE_SIZE} total={total} onPageChange={(p) => { setPage(p); clearSelection(); }} />
          </div>
        )}
        {!loading && boardMode && total > TASK_BOARD_LIMIT && (
          <Alert tone="success">Showing the first {TASK_BOARD_LIMIT} of {total} tasks. Narrow the filters, or switch to List to page through all of them.</Alert>
        )}
      </PageBody>

      <TaskCreateModal
        open={createOpen}
        lists={lists}
        assignableUsers={assignableUsers}
        canAssign={canAssign}
        defaultListId={filters.listId}
        onClose={() => setCreateOpen(false)}
        onCreated={() => void afterChange()}
      />

      <TaskDetailDrawer
        task={openTask}
        lists={lists}
        assignableUsers={assignableUsers}
        actor={actor}
        canAssign={canAssign}
        canDelete={canDeleteTasks(actor)}
        onClose={() => setOpenTask(null)}
        onChanged={() => void afterChange()}
      />
    </div>
  );
}
